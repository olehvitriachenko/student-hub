import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { ILogger } from '../core/logging/Logger';
import type { IPreferences } from './Preferences';

export interface FocusStats {
  totalMin: number;
  sessions: number;
  /** id завдання → хвилин фокусу */
  byAssignment: Record<string, number>;
  /** YYYY-MM-DD → хвилин (для «сьогодні») */
  byDay: Record<string, number>;
}

const KEY = 'focus.stats';
const EMPTY: FocusStats = { totalMin: 0, sessions: 0, byAssignment: {}, byDay: {} };
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Облік фокус-сесій (Pomodoro): скільки хвилин витрачено на кожне завдання. */
export class FocusService extends ObservableObject {
  private _stats: FocusStats = EMPTY;

  constructor(
    private readonly prefs: IPreferences,
    private readonly log: ILogger,
  ) {
    super();
  }

  get stats() { return this._stats; }
  get todayMin() { return this._stats.byDay[dayKey(Date.now())] ?? 0; }

  minutesFor(assignmentId: string) {
    return this._stats.byAssignment[assignmentId] ?? 0;
  }

  async load() {
    this._stats = { ...EMPTY, ...((await this.prefs.getJson<FocusStats>(KEY)) ?? {}) };
    this.onPropertyChanged('stats');
  }

  async addSession(assignmentId: string, minutes: number) {
    const s = this._stats;
    const today = dayKey(Date.now());
    this._stats = {
      totalMin: s.totalMin + minutes,
      sessions: s.sessions + 1,
      byAssignment: { ...s.byAssignment, [assignmentId]: (s.byAssignment[assignmentId] ?? 0) + minutes },
      byDay: { ...s.byDay, [today]: (s.byDay[today] ?? 0) + minutes },
    };
    await this.prefs.setJson(KEY, this._stats);
    this.onPropertyChanged('stats');
    this.log.info('Focus session completed', { assignmentId, minutes });
  }

  async clear() {
    this._stats = EMPTY;
    await this.prefs.remove(KEY);
    this.onPropertyChanged('stats');
  }
}
