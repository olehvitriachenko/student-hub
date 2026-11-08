import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { ILogger } from '../core/logging/Logger';

/**
 * Життєвий цикл застосунку (лаб. 3).
 *
 * Відповідність подіям Window у .NET MAUI:
 *   Created     → start() (перший рендер кореневого layout)
 *   Activated / Resumed → AppState 'active'
 *   Deactivated → AppState 'inactive' (iOS: дзвінок, шторка, app switcher)
 *   Stopped     → AppState 'background'
 *   Destroying  → у RN немає гарантованої події; найближче — 'background',
 *                 тому весь стан зберігаємо саме на Stopped.
 */
export type LifecycleEvent = 'Created' | 'Resumed' | 'Deactivated' | 'Stopped';
type Handler = (event: LifecycleEvent) => void | Promise<void>;

export interface LifecycleLogItem {
  event: LifecycleEvent;
  at: number;
}

export class AppLifecycleService extends ObservableObject {
  private sub?: NativeEventSubscription;
  private readonly handlers = new Set<Handler>();
  private prev: string | null | undefined = AppState.currentState;
  private _history: LifecycleLogItem[] = [];

  constructor(private readonly log: ILogger) {
    super();
  }

  get history(): readonly LifecycleLogItem[] {
    return this._history;
  }

  start(): void {
    this.sub = AppState.addEventListener('change', (next) => this.onChange(next));
    this.raise('Created');
  }

  stop(): void {
    this.sub?.remove();
  }

  /** Підписка на події (аналог window.Stopped += ...). */
  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private onChange(next: AppStateStatus) {
    if (next === this.prev) return;
    this.prev = next;
    if (next === 'active') this.raise('Resumed');
    else if (next === 'inactive') this.raise('Deactivated');
    else if (next === 'background') this.raise('Stopped');
  }

  private raise(event: LifecycleEvent) {
    this.log.info(`App lifecycle: ${event}`);
    this._history = [{ event, at: Date.now() }, ...this._history].slice(0, 50);
    this.onPropertyChanged('history');
    this.handlers.forEach((h) => {
      Promise.resolve(h(event)).catch((e) => this.log.error(e, `Lifecycle handler failed on ${event}`));
    });
  }
}
