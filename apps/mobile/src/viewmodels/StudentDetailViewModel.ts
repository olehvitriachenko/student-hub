import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { Messenger } from '../core/mvvm/Messenger';
import { isExcellent, validateStudent, type Student } from '../models/Student';
import type { INavigationService, IQueryAttributable, QueryParams } from '../services/NavigationService';

/**
 * StudentDetailViewModel (лаб. 2).
 *
 * Ч. 1: IQueryAttributable — отримує обраного Student зі словника параметрів навігації.
 * Ч. 2: GoBackCommand (GoToAsync("..")), редагування середнього балу,
 *       SaveCommand — передає оновлений Student назад до списку.
 */
export class StudentDetailViewModel extends ViewModelBase implements IQueryAttributable {
  private original: Student | null = null;
  private _averageScore = 0;

  readonly goBackCommand: Command;
  readonly saveCommand: Command;

  constructor(
    private readonly navigation: INavigationService,
    private readonly messenger: Messenger,
  ) {
    super();
    this.goBackCommand = new Command(() => this.navigation.goBack());
    this.saveCommand = new Command(() => this.save(), () => this.isDirty && this.validationError === null);
  }

  get id() { return this.original?.id ?? ''; }
  get fullName() { return this.original?.fullName ?? ''; }
  get group() { return this.original?.group ?? ''; }

  get averageScore() { return this._averageScore; }
  set averageScore(v: number) {
    const rounded = Math.round(v * 10) / 10;
    if (this.setProperty('averageScore', this._averageScore, rounded, (x) => (this._averageScore = x))) {
      this.onPropertyChanged('isExcellent');
      this.saveCommand.raiseCanExecuteChanged();
    }
  }

  get isExcellent() { return isExcellent({ averageScore: this._averageScore }); }

  get isDirty() { return !!this.original && this.original.averageScore !== this._averageScore; }

  get validationError(): string | null {
    return this.original ? validateStudent({ fullName: this.original.fullName, averageScore: this._averageScore }) : null;
  }

  /** ApplyQueryAttributes: заповнюємо властивості з переданого об'єкта. */
  applyQueryAttributes(query: QueryParams): void {
    const student = query.SelectedStudent as Student | undefined;
    if (!student) return;
    this.original = student;
    this._averageScore = student.averageScore;
    this.onPropertyChanged('*'); // оновити всі прив'язки
    this.saveCommand.raiseCanExecuteChanged();
  }

  private save(): void {
    if (!this.original) return;
    const updated: Student = { ...this.original, averageScore: this._averageScore };
    this.original = updated;
    // Передаємо оновлений об'єкт назад (обидва способи з методички):
    this.messenger.send('StudentUpdated', updated); // WeakReferenceMessenger
    this.navigation.goBack({ UpdatedStudent: updated }); // GoToAsync("..", parameters)
  }
}
