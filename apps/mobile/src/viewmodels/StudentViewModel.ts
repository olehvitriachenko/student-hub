import * as Crypto from 'expo-crypto';
import { Command } from '../core/mvvm/Command';
import { ObservableCollection } from '../core/mvvm/ObservableCollection';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import { isExcellent, type Student } from '../models/Student';

/**
 * StudentViewModel (лаб. 1).
 *
 * Частина 1: властивості з PropertyChanged і перевіркою на рівність,
 *            обчислювані greeting (OneWay) та isExcellent (візуальна індикація).
 * Частина 2: AddStudentCommand з CanExecute + ObservableCollection<Student>.
 */
export class StudentViewModel extends ObservableObject {
  // Інкапсульований об'єкт моделі (`private Student _student = new();`).
  private readonly student: Omit<Student, 'id'> = { fullName: '', group: '', averageScore: 4.0 };

  readonly students = new ObservableCollection<Student>();
  readonly addStudentCommand: Command;

  constructor() {
    super();
    this.addStudentCommand = new Command(() => this.addStudent(), () => this.canAddStudent());
  }

  // ---------- Властивості для прив'язки (TwoWay) ----------

  get fullName() { return this.student.fullName; }
  set fullName(value: string) {
    if (this.setProperty('fullName', this.student.fullName, value, (v) => (this.student.fullName = v))) {
      this.onPropertyChanged('greeting');
      this.addStudentCommand.raiseCanExecuteChanged(); // кнопка перевіряє CanExecute заново
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

  // ---------- Обчислювані властивості (OneWay) ----------

  /** «Студент: {FullName}, група {Group}» */
  get greeting(): string {
    if (!this.fullName.trim()) return 'Введіть дані студента';
    return `Студент: ${this.fullName}${this.group ? `, група ${this.group}` : ''}`;
  }

  /** true, якщо AverageScore ≥ 4.0 — View фарбує вітання в зелений (замість IValueConverter). */
  get isExcellent(): boolean {
    return isExcellent(this.student);
  }

  // ---------- Команди ----------

  private canAddStudent(): boolean {
    return this.fullName.trim().length > 0;
  }

  private addStudent(): void {
    this.students.add({
      id: Crypto.randomUUID(),
      fullName: this.fullName.trim(),
      group: this.group.trim(),
      averageScore: this.averageScore,
    });
    // Очистити поля вводу.
    this.fullName = '';
    this.group = '';
  }
}
