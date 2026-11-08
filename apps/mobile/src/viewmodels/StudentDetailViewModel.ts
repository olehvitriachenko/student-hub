import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { Messenger } from '../core/mvvm/Messenger';
import type { ILogger } from '../core/logging/Logger';
import type { IStudentRepository } from '../data/StudentRepository';
import { isExcellent, validateStudent, type Student } from '../models/Student';
import type { AppLifecycleService } from '../services/AppLifecycleService';
import type { AppStateService } from '../services/AppStateService';
import type { INavigationService, IQueryAttributable, QueryParams } from '../services/NavigationService';
import type { IPreferences } from '../services/Preferences';

const draftKey = (id: string) => `draft.student.${id}`;

/**
 * ViewModel сторінки деталей студента.
 *
 * Лаб. 2: IQueryAttributable (отримання Student зі словника параметрів),
 *         GoBackCommand, SaveCommand з передачею оновленого запису назад.
 * Лаб. 3: deep link studenthub://students/<id> → loadById (аналог [QueryProperty]);
 *         збереження чернетки редагування при згортанні застосунку.
 * Лаб. 3: Update / Delete через репозиторій.
 */
export class StudentDetailViewModel extends ViewModelBase implements IQueryAttributable {
  private original: Student | null = null;
  private _averageScore = 0;
  private _group = '';
  private _notFound = false;

  readonly goBackCommand: Command;
  readonly saveCommand: Command;
  readonly deleteCommand: Command;

  constructor(
    private readonly repository: IStudentRepository,
    private readonly navigation: INavigationService,
    private readonly messenger: Messenger,
    private readonly prefs: IPreferences,
    lifecycle: AppLifecycleService,
    private readonly appState: AppStateService,
    private readonly log: ILogger,
  ) {
    super();
    this.goBackCommand = new Command(() => this.navigation.goBack());
    this.saveCommand = new Command(() => this.save(), () => this.isDirty && this.validationError === null);
    this.deleteCommand = new Command(() => this.delete(), () => this.original !== null);
    this.track(lifecycle.on((e) => (e === 'Stopped' ? this.saveDraft() : undefined)));
  }

  // ---------- Властивості ----------

  get id() { return this.original?.id ?? ''; }
  get fullName() { return this.original?.fullName ?? ''; }
  get notFound() { return this._notFound; }

  get group() { return this._group; }
  set group(v: string) { this.setEditable('group', this._group, v, (x) => (this._group = x)); }

  get averageScore() { return this._averageScore; }
  set averageScore(v: number) {
    const rounded = Math.round(v * 10) / 10;
    if (this.setEditable('averageScore', this._averageScore, rounded, (x) => (this._averageScore = x))) {
      this.onPropertyChanged('isExcellent');
    }
  }

  get isExcellent() { return isExcellent({ averageScore: this._averageScore }); }

  get isDirty(): boolean {
    const o = this.original;
    return !!o && (o.group !== this._group || o.averageScore !== this._averageScore);
  }

  get validationError(): string | null {
    return this.original ? validateStudent({ fullName: this.original.fullName, averageScore: this._averageScore }) : null;
  }

  // ---------- Отримання параметрів ----------

  /** Лаб. 2: складний об'єкт зі словника параметрів навігації. */
  applyQueryAttributes(query: QueryParams): void {
    const student = query.SelectedStudent as Student | undefined;
    if (student) void this.populate(student);
  }

  /** Лаб. 3 (deep link) / [QueryProperty]: примітивний id з URI → завантаження з БД. */
  async loadById(id: string): Promise<void> {
    if (this.original?.id === id) return;
    this.setBusy(true);
    try {
      const student = await this.repository.getById(id);
      if (!student) {
        this.log.warn('Student not found', { id });
        this.setProperty('notFound', this._notFound, true, (v) => (this._notFound = v));
        return;
      }
      await this.populate(student);
    } finally {
      this.setBusy(false);
    }
  }

  private async populate(student: Student) {
    this.original = student;
    this.appState.setSelectedStudent(student.id);
    this._group = student.group;
    this._averageScore = student.averageScore;

    // Відновлюємо незбережені правки, якщо застосунок був згорнутий під час редагування.
    const draft = await this.prefs.getJson<Pick<Student, 'group' | 'averageScore'>>(draftKey(student.id));
    if (draft) {
      Object.assign(this, { _group: draft.group, _averageScore: draft.averageScore });
      this.log.info('Edit draft restored', { id: student.id });
    }
    this.onPropertyChanged('*');
    this.raiseCommands();
  }

  // ---------- Команди ----------

  private async save(): Promise<void> {
    if (!this.original) return;
    const updated: Student = {
      ...this.original,
      group: this._group.trim(),
      averageScore: this._averageScore,
    };
    await this.repository.save(updated);
    this.original = updated;
    await this.prefs.remove(draftKey(updated.id));
    this.log.info('Student updated', { id: updated.id });

    // Повертаємо оновлений об'єкт двома способами:
    this.messenger.send('StudentUpdated', updated); // WeakReferenceMessenger
    this.navigation.goBack({ UpdatedStudent: updated }); // GoToAsync("..", parameters)
  }

  private async delete(): Promise<void> {
    if (!this.original) return;
    const { id } = this.original;
    await this.repository.delete(id);
    await this.prefs.remove(draftKey(id));
    this.messenger.send('StudentDeleted', { id });
    this.navigation.goBack();
  }

  override dispose(): void {
    this.appState.setSelectedStudent(null);
    super.dispose();
  }

  // ---------- helpers ----------

  private setEditable<V>(name: string, current: V, next: V, assign: (v: V) => void): boolean {
    const changed = this.setProperty(name, current, next, assign);
    if (changed) this.raiseCommands();
    return changed;
  }

  private raiseCommands() {
    this.saveCommand.raiseCanExecuteChanged();
    this.deleteCommand.raiseCanExecuteChanged();
  }

  private async saveDraft() {
    if (!this.original || !this.isDirty) return;
    await this.prefs.setJson(draftKey(this.original.id), {
      group: this._group,
      averageScore: this._averageScore,
    });
    this.log.info('Edit draft saved on Stopped', { id: this.original.id });
  }
}
