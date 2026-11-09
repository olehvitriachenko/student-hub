/**
 * Аналог ICommand / RelayCommand.
 *
 * Інкапсулює дію користувача (execute) та умову її доступності (canExecute).
 * Кнопка, прив'язана до команди, автоматично блокується, коли canExecute() === false.
 * ViewModel викликає `raiseCanExecuteChanged()`, коли змінюються дані, від яких залежить canExecute.
 */
export interface ICommand<TParam = void> {
  execute(param: TParam): void;
  canExecute(param: TParam): boolean;
  subscribe(handler: () => void): () => void;
  getVersion(): number;
  /** true, поки виконується асинхронна дія. */
  readonly isRunning?: boolean;
}

type MaybePromise = void | Promise<void>;

export class Command<TParam = void> implements ICommand<TParam> {
  private readonly handlers = new Set<() => void>();
  private version = 0;
  private running = false;

  constructor(
    private readonly executeFn: (param: TParam) => MaybePromise,
    private readonly canExecuteFn: (param: TParam) => boolean = () => true,
  ) {}

  /** true, поки виконується асинхронна дія (аналог AsyncRelayCommand.IsRunning). */
  get isRunning(): boolean {
    return this.running;
  }

  canExecute(param: TParam): boolean {
    return !this.running && this.canExecuteFn(param);
  }

  execute(param: TParam): void {
    if (!this.canExecute(param)) return;
    const result = this.executeFn(param);
    if (result instanceof Promise) {
      this.setRunning(true);
      // Помилку не ковтаємо: вона піде в глобальний обробник необроблених Promise (лаб. 5).
      result.finally(() => this.setRunning(false));
    }
  }

  subscribe = (handler: () => void): (() => void) => {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  };

  getVersion = (): number => this.version;

  raiseCanExecuteChanged(): void {
    this.version++;
    this.handlers.forEach((h) => h());
  }

  private setRunning(value: boolean) {
    this.running = value;
    this.raiseCanExecuteChanged();
  }
}
