import * as Crypto from 'expo-crypto';
import { Command } from '../core/mvvm/Command';
import { ObservableCollection } from '../core/mvvm/ObservableCollection';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { Messenger } from '../core/mvvm/Messenger';
import { isExcellent, type Student } from '../models/Student';
import { BACK_ROUTE, type INavigationService, type IQueryAttributable, type QueryParams } from '../services/NavigationService';

/**
 * StudentViewModel.
 *
 * Лаб. 1: властивості з PropertyChanged, greeting / isExcellent, AddStudentCommand, ObservableCollection.
 * Лаб. 2: OpenDetailsCommand → навігація з передачею обраного Student;
 *         отримання відредагованого запису назад двома способами:
 *           1) параметри GoToAsync("..", parameters) → applyQueryAttributes;
 *           2) повідомлення "StudentUpdated" через Messenger.
 */
export class StudentViewModel extends ViewModelBase implements IQueryAttributable {
  private readonly student: Omit<Student, 'id'> = { fullName: '', group: '', averageScore: 4.0 };
  private _lastEditedId: string | null = null;

  readonly students = new ObservableCollection<Student>();
  readonly addStudentCommand: Command;
  readonly openDetailsCommand: Command<Student>;

  constructor(
    private readonly navigation: INavigationService,
    messenger: Messenger,
  ) {
    super();
    this.addStudentCommand = new Command(() => this.addStudent(), () => this.fullName.trim().length > 0);
    this.openDetailsCommand = new Command<Student>((s) => this.openDetails(s));

    // Спосіб 2: WeakReferenceMessenger.
    this.track(messenger.register('StudentUpdated', (s) => this.students.replace((x) => x.id === s.id, s)));
  }

  // ---------- Властивості (TwoWay) ----------

  get fullName() { return this.student.fullName; }
  set fullName(value: string) {
    if (this.setProperty('fullName', this.student.fullName, value, (v) => (this.student.fullName = v))) {
      this.onPropertyChanged('greeting');
      this.addStudentCommand.raiseCanExecuteChanged();
    }
  }

  get group() { return this.student.group; }
  set group(value: string) {
    if (this.setProperty('group', this.student.group, value, (v) => (this.student.group = v))) {
      this.onPropertyChanged('greeting');
    }
  }

  get averageScore() { return this.student.averageScore; }
  set averageScore(value: number) {
    const rounded = Math.round(value * 10) / 10;
    if (this.setProperty('averageScore', this.student.averageScore, rounded, (v) => (this.student.averageScore = v))) {
      this.onPropertyChanged('isExcellent');
    }
  }

  // ---------- Обчислювані (OneWay) ----------

  get greeting(): string {
    if (!this.fullName.trim()) return 'Введіть дані студента';
    return `Студент: ${this.fullName}${this.group ? `, група ${this.group}` : ''}`;
  }

  get isExcellent(): boolean {
    return isExcellent(this.student);
  }

  /** Підсвічуємо щойно відредагований запис. */
  get lastEditedId() {
    return this._lastEditedId;
  }

  // ---------- Навігація ----------

  override onAppearing(): void {
    // Спосіб 1: параметри, передані при поверненні GoToAsync("..", parameters).
    const back = this.navigation.takeParams(BACK_ROUTE);
    if (back) this.applyQueryAttributes(back);
  }

  applyQueryAttributes(query: QueryParams): void {
    const updated = query.UpdatedStudent as Student | undefined;
    if (!updated) return;
    this.students.replace((x) => x.id === updated.id, updated);
    this.setProperty('lastEditedId', this._lastEditedId, updated.id, (v) => (this._lastEditedId = v));
  }

  private openDetails(student: Student): void {
    if (!student) return;
    // Складний об'єкт — у словнику параметрів, без серіалізації в рядок.
    this.navigation.goTo(`/students/${student.id}`, { SelectedStudent: student });
  }

  private addStudent(): void {
    this.students.add({
      id: Crypto.randomUUID(),
      fullName: this.fullName.trim(),
      group: this.group.trim(),
      averageScore: this.averageScore,
    });
    this.fullName = '';
    this.group = '';
  }
}
