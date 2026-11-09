import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IAssignmentRepository } from '../data/AssignmentRepository';
import type { Assignment } from '../models/Assignment';
import type { Analytics } from '../services/CrashReporting';
import type { FocusService } from '../services/FocusService';
import type { INavigationService } from '../services/NavigationService';
import type { ReminderService } from '../services/ReminderService';

export type FocusMode = 'focus' | 'break';
const BREAK_MIN = 5;

/**
 * Фокус-таймер (Pomodoro) для завдання.
 * Час рахується від абсолютного `endAt`, тому таймер коректний і після згортання застосунку;
 * про завершення сесії у фоні повідомить локальне сповіщення.
 */
export class FocusViewModel extends ViewModelBase {
  private _assignment: Assignment | null = null;
  private _mode: FocusMode = 'focus';
  private _focusMin = 25;
  private _endAt: number | null = null;
  private _remainingMs = 25 * 60_000;
  private _now = Date.now();
  private _sessions = 0;
  private _justFinished = false;

  readonly toggleCommand: Command;
  readonly resetCommand: Command;
  readonly skipCommand: Command;
  readonly setDurationCommand: Command<number>;
  readonly closeCommand: Command;

  constructor(
    private readonly focus: FocusService,
    private readonly reminders: ReminderService,
    private readonly repo: IAssignmentRepository,
    private readonly navigation: INavigationService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.toggleCommand = new Command(() => (this.running ? this.pause() : this.start()));
    this.resetCommand = new Command(() => this.reset(), () => this.progress > 0 || this.running);
    this.skipCommand = new Command(() => this.finish(false));
    this.setDurationCommand = new Command<number>(
      (m) => {
        this._focusMin = m;
        this.reset();
      },
      () => !this.running && this._mode === 'focus',
    );
    this.closeCommand = new Command(() => navigation.goBack());

    const timer = setInterval(() => this.tick(), 250);
    this.track(() => clearInterval(timer));
    this.track(() => void (this.running ? undefined : this.reminders.cancelFocusEnd()));
    this.track(focus.subscribe(() => this.onPropertyChanged('focusedMinutes')));
  }

  get assignment() { return this._assignment; }
  get mode() { return this._mode; }
  get focusMin() { return this._focusMin; }
  get running() { return this._endAt !== null; }
  get sessions() { return this._sessions; }
  get justFinished() { return this._justFinished; }
  get totalMs() { return (this._mode === 'focus' ? this._focusMin : BREAK_MIN) * 60_000; }
  get remainingMs() { return this._endAt !== null ? Math.max(0, this._endAt - this._now) : this._remainingMs; }
  get progress() { return 1 - this.remainingMs / this.totalMs; }
  get focusedMinutes() { return this._assignment ? this.focus.minutesFor(this._assignment.id) : 0; }

  get timeText() {
    const s = Math.ceil(this.remainingMs / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  async initialize(id: string) {
    const params = this.navigation.takeParams(`/focus/${id}`);
    const a = (params?.assignment as Assignment | undefined) ?? (await this.repo.getById(id));
    this._assignment = a ?? null;
    this.onPropertyChanged('assignment');
  }

  private start() {
    this._endAt = Date.now() + this.remainingMs;
    this._justFinished = false;
    this.changed();
    const title = this._mode === 'focus' ? 'Фокус-сесію завершено 🎉' : 'Перерва скінчилась';
    const body = this._mode === 'focus' ? `${this._assignment?.title ?? 'Завдання'} — час на перерву` : 'Повертаймося до роботи';
    void this.reminders.scheduleFocusEnd(this._endAt, title, body);
    this.log.info('Focus timer started', { mode: this._mode, minutes: this.totalMs / 60_000 });
  }

  private pause() {
    this._remainingMs = this.remainingMs;
    this._endAt = null;
    this.changed();
    void this.reminders.cancelFocusEnd();
  }

  private reset() {
    this._endAt = null;
    this._remainingMs = this.totalMs;
    this.changed();
    void this.reminders.cancelFocusEnd();
  }

  private tick() {
    if (this._endAt === null) return;
    this._now = Date.now();
    if (this._now >= this._endAt) void this.finish(true);
    else this.onPropertyChanged('remainingMs');
  }

  /** Кінець сесії: зараховуємо хвилини фокусу й перемикаємо режим фокус ↔ перерва. */
  private async finish(completed: boolean) {
    const wasFocus = this._mode === 'focus';
    const spentMin = Math.round((this.totalMs - this.remainingMs) / 60_000);
    this._endAt = null;
    void this.reminders.cancelFocusEnd();
    if (wasFocus && this._assignment && spentMin > 0) {
      await this.focus.addSession(this._assignment.id, completed ? this._focusMin : spentMin);
      this._sessions++;
      this.analytics.trackEvent('FocusSession', { minutes: String(spentMin), completed: String(completed) });
    }
    this._justFinished = completed;
    this._mode = wasFocus ? 'break' : 'focus';
    this._remainingMs = this.totalMs;
    this.changed();
  }

  private changed() {
    this._now = Date.now();
    this.onPropertyChanged('state');
    this.resetCommand.raiseCanExecuteChanged();
    this.setDurationCommand.raiseCanExecuteChanged();
  }
}
