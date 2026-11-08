import * as Crypto from 'expo-crypto';
import { Command } from '../core/mvvm/Command';
import { ObservableCollection } from '../core/mvvm/ObservableCollection';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { Messenger } from '../core/mvvm/Messenger';
import type { ILogger } from '../core/logging/Logger';
import type { IStudentRepository } from '../data/StudentRepository';
import { isExcellent, validateStudent, type Student } from '../models/Student';
import type { AppLifecycleService } from '../services/AppLifecycleService';
import type { Analytics } from '../services/CrashReporting';
import { BACK_ROUTE, type INavigationService, type IQueryAttributable, type QueryParams } from '../services/NavigationService';
import type { IPreferences } from '../services/Preferences';
import type { SyncService } from '../services/SyncService';

const DRAFT_KEY = 'draft.newStudent';

interface Draft {
  fullName: string;
  group: string;
  averageScore: number;
  documentNumber: string;
}

/**
 * Головна ViewModel "Особистий кабінет студента".
 *
 * Лаб. 1: властивості з PropertyChanged, обчислювані greeting / isExcellent,
 *         AddStudentCommand з CanExecute, ObservableCollection<Student>.
 * Лаб. 2: OpenDetailsCommand → навігація з передачею об'єкта Student;
 *         отримання оновленого запису назад (query-параметри + Messenger).
 * Лаб. 3: OnAppearing → LoadCommand; збереження чернетки форми на Stopped.
 * Лаб. 4: CRUD через репозиторій, SyncCommand.
 * Лаб. 5: логування ключових подій.
 */
export class StudentViewModel extends ViewModelBase implements IQueryAttributable {
  // Інкапсульований об'єкт моделі, як `_student` у прикладі з лаб. 1.
  private readonly draft: Draft = { fullName: '', group: '', averageScore: 4.0, documentNumber: '' };

  readonly students = new ObservableCollection<Student>();

  readonly addStudentCommand: Command;
  readonly openDetailsCommand: Command<Student>;
  readonly deleteStudentCommand: Command<Student>;
  readonly loadCommand: Command;
  readonly syncCommand: Command;
  readonly openSettingsCommand: Command;

  private _lastEditedId: string | null = null;

  constructor(
    private readonly repository: IStudentRepository,
    private readonly navigation: INavigationService,
    private readonly messenger: Messenger,
    readonly sync: SyncService,
    private readonly prefs: IPreferences,
    lifecycle: AppLifecycleService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.addStudentCommand = new Command(() => this.addStudent(), () => this.canAddStudent());
    this.openDetailsCommand = new Command<Student>((s) => this.openDetails(s));
    this.deleteStudentCommand = new Command<Student>((s) => this.deleteStudent(s));
    this.loadCommand = new Command(() => this.load());
    this.syncCommand = new Command(() => this.sync.sync(), () => !this.sync.isSyncing);
    this.openSettingsCommand = new Command(() => this.navigation.goTo('/settings'));

    // Лаб. 2, ч. 2: оновлення списку через повідомлення від сторінки деталей.
    this.track(messenger.register('StudentUpdated', (s) => this.upsertInList(s)));
    this.track(messenger.register('StudentDeleted', ({ id }) => this.students.remove((x) => x.id === id)));
    this.track(messenger.register('StudentsSynced', () => void this.load()));
    this.track(sync.subscribe(() => this.syncCommand.raiseCanExecuteChanged()));

    // Лаб. 3: зберегти чернетку форми при згортанні застосунку.
    this.track(lifecycle.on((e) => (e === 'Stopped' ? this.saveDraft() : undefined)));
    void this.restoreDraft();
  }

  // ---------- Властивості для прив'язки (TwoWay) ----------

  get fullName() { return this.draft.fullName; }
  set fullName(value: string) {
    if (this.setProperty('fullName', this.draft.fullName, value, (v) => (this.draft.fullName = v))) {
      this.onPropertyChanged('greeting');
      this.addStudentCommand.raiseCanExecuteChanged();
    }
  }

  get group() { return this.draft.group; }
  set group(value: string) {
    if (this.setProperty('group', this.draft.group, value, (v) => (this.draft.group = v))) {
      this.onPropertyChanged('greeting');
    }
  }

  get averageScore() { return this.draft.averageScore; }
  set averageScore(value: number) {
    const rounded = Math.round(value * 10) / 10;
    if (this.setProperty('averageScore', this.draft.averageScore, rounded, (v) => (this.draft.averageScore = v))) {
      this.onPropertyChanged('isExcellent');
    }
  }

  get documentNumber() { return this.draft.documentNumber; }
  set documentNumber(value: string) {
    this.setProperty('documentNumber', this.draft.documentNumber, value, (v) => (this.draft.documentNumber = v));
  }

  // ---------- Обчислювані властивості (OneWay) ----------

  /** «Студент: {FullName}, група {Group}» */
  get greeting(): string {
    if (!this.fullName.trim()) return 'Введіть дані студента';
    return `Студент: ${this.fullName}${this.group ? `, група ${this.group}` : ''}`;
  }

  /** Візуальна індикація, якщо AverageScore ≥ 4.0 (замість IValueConverter). */
  get isExcellent(): boolean {
    return isExcellent(this.draft);
  }

  get lastEditedId() {
    return this._lastEditedId;
  }

  // ---------- Життєвий цикл сторінки ----------

  override async onAppearing(): Promise<void> {
    this.log.debug('StudentListPage appearing');
    // Лаб. 2, ч. 2 (варіант 1): параметри, передані через GoToAsync("..", parameters).
    const back = this.navigation.takeParams(BACK_ROUTE);
    if (back) this.applyQueryAttributes(back);
    this.loadCommand.execute();
  }

  override onDisappearing(): void {
    this.log.debug('StudentListPage disappearing');
  }

  applyQueryAttributes(query: QueryParams): void {
    const updated = query.UpdatedStudent as Student | undefined;
    if (updated) {
      this.upsertInList(updated);
      this.setProperty('lastEditedId', this._lastEditedId, updated.id, (v) => (this._lastEditedId = v));
    }
  }

  // ---------- Команди ----------

  private canAddStudent(): boolean {
    return this.fullName.trim().length > 0;
  }

  private async addStudent(): Promise<void> {
    const error = validateStudent(this.draft);
    if (error) {
      this.log.warn('Validation failed on add', { error });
      return;
    }
    const student: Student = {
      id: Crypto.randomUUID(),
      fullName: this.fullName.trim(),
      group: this.group.trim(),
      averageScore: this.averageScore,
      documentNumber: this.documentNumber.trim(),
      updatedAt: Date.now(),
      deleted: false,
    };
    await this.repository.save(student);
    this.students.insert(0, student);
    this.analytics.trackEvent('StudentAdded', { group: student.group });

    // Очистити поля вводу.
    this.fullName = '';
    this.group = '';
    this.documentNumber = '';
    await this.prefs.remove(DRAFT_KEY);
    void this.sync.notifyLocalChange();
  }

  private openDetails(student: Student): void {
    if (!student) return;
    this.analytics.trackEvent('StudentOpened', { id: student.id });
    // Складний об'єкт передаємо словником параметрів (IQueryAttributable на приймачі).
    this.navigation.goTo(`/students/${student.id}`, { SelectedStudent: student });
  }

  private async deleteStudent(student: Student): Promise<void> {
    await this.repository.delete(student.id);
    this.students.remove((s) => s.id === student.id);
    void this.sync.notifyLocalChange();
  }

  private async load(): Promise<void> {
    this.setBusy(true);
    try {
      this.log.info('Loading students');
      const all = await this.repository.getAll();
      this.students.reset(all);
      this.log.info('Students loaded', { count: all.length });
    } catch (e) {
      this.log.error(e, 'Failed to load students');
    } finally {
      this.setBusy(false);
    }
  }

  private upsertInList(s: Student) {
    if (!this.students.replace((x) => x.id === s.id, s)) this.students.insert(0, s);
  }

  // ---------- Збереження стану форми (лаб. 3) ----------

  private async saveDraft() {
    if (!this.fullName && !this.group && !this.documentNumber) return;
    await this.prefs.setJson(DRAFT_KEY, this.draft);
    this.log.info('Form draft saved on Stopped');
  }

  private async restoreDraft() {
    const saved = await this.prefs.getJson<Draft>(DRAFT_KEY);
    if (!saved) return;
    this.fullName = saved.fullName;
    this.group = saved.group;
    this.averageScore = saved.averageScore;
    this.documentNumber = saved.documentNumber;
    this.log.info('Form draft restored');
  }
}
