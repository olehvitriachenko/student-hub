import { ObservableObject } from './ObservableObject';

/**
 * Базовий клас ViewModel: ObservableObject + керування підписками.
 * Сторінка викликає onAppearing/onDisappearing (лаб. 3) і dispose при знищенні.
 */
export abstract class ViewModelBase extends ObservableObject {
  private readonly disposables: (() => void)[] = [];
  private _isBusy = false;

  get isBusy() {
    return this._isBusy;
  }

  protected setBusy(value: boolean) {
    this.setProperty('isBusy', this._isBusy, value, (v) => (this._isBusy = v));
  }

  /** Аналог OnAppearing — сторінка стала видимою. */
  onAppearing(): void | Promise<void> {}

  /** Аналог OnDisappearing — сторінку приховано. */
  onDisappearing(): void {}

  /** Реєструє функцію відписки, яка буде викликана у dispose(). */
  protected track(unsubscribe: () => void): void {
    this.disposables.push(unsubscribe);
  }

  dispose(): void {
    this.disposables.splice(0).forEach((d) => d());
  }
}
