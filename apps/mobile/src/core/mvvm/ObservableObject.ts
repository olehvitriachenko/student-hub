/**
 * Аналог INotifyPropertyChanged з .NET.
 *
 * ViewModel успадковує цей клас і змінює стан лише через `setProperty`,
 * який перевіряє рівність старого/нового значення (уникаємо зайвих сповіщень)
 * і генерує подію PropertyChanged. View підписується через хук `useViewModel`.
 */
export type PropertyChangedHandler = (propertyName: string) => void;

export abstract class ObservableObject {
  private readonly propertyChangedHandlers = new Set<PropertyChangedHandler>();
  /** Монотонний лічильник змін — потрібен для useSyncExternalStore. */
  private version = 0;

  /** Підписка на PropertyChanged. Повертає функцію відписки. */
  subscribe = (handler: PropertyChangedHandler): (() => void) => {
    this.propertyChangedHandlers.add(handler);
    return () => this.propertyChangedHandlers.delete(handler);
  };

  getVersion = (): number => this.version;

  protected onPropertyChanged(propertyName: string): void {
    this.version++;
    this.propertyChangedHandlers.forEach((h) => h(propertyName));
  }

  /**
   * Встановлює значення та сповіщає підписників лише якщо значення змінилось
   * (аналог `if (_student.FullName != value) { ...; OnPropertyChanged(); }`).
   * @returns true, якщо значення було змінено
   */
  protected setProperty<V>(propertyName: string, current: V, next: V, assign: (value: V) => void): boolean {
    if (Object.is(current, next)) return false;
    assign(next);
    this.onPropertyChanged(propertyName);
    return true;
  }
}
