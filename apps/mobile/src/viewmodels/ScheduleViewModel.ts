import { Command } from '../core/mvvm/Command';
import type { Messenger } from '../core/mvvm/Messenger';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IEventRepository } from '../data/EventRepository';
import type { Lesson, Schedule } from '../models/Lesson';
import type { PlannerEvent } from '../models/PlannerEvent';
import { userMessage } from '../services/ApiClient';
import type { AuthService } from '../services/AuthService';
import type { INavigationService } from '../services/NavigationService';
import type { ScheduleService } from '../services/ScheduleService';
import { formatDate, greeting, minutesOf, startOfDay, WEEKDAYS_FULL, WEEKDAYS_SHORT } from '../utils/format';

const DAY = 86_400_000;

export interface WeekDay {
  date: number;
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  count: number;
}

export type TimelineItem =
  | { kind: 'lesson'; key: string; start: string; end: string; lesson: Lesson }
  | { kind: 'event'; key: string; start: string; end: string; event: PlannerEvent };

export type ItemState = 'past' | 'now' | 'upcoming';

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Вкладка «Розклад»: тиждень Пн–Нд з гортанням, пари групи + власні події планувальника
 * в одній стрічці дня, підсумок «зараз / далі».
 */
export class ScheduleViewModel extends ViewModelBase {
  private _schedule: Schedule | null = null;
  private _events: PlannerEvent[] = [];
  private _selectedDate = startOfDay(Date.now());
  private _weekStart = mondayOf(Date.now());
  private _error: string | null = null;
  private _now = Date.now();

  readonly refreshCommand: Command;
  readonly selectDateCommand: Command<number>;
  readonly prevWeekCommand: Command;
  readonly nextWeekCommand: Command;
  readonly todayCommand: Command;
  /** Свайп по стрічці дня: наступний / попередній день (з переходом між тижнями). */
  readonly shiftDayCommand: Command<number>;
  readonly addEventCommand: Command;
  readonly openEventCommand: Command<PlannerEvent>;

  constructor(
    private readonly scheduleService: ScheduleService,
    private readonly eventsRepo: IEventRepository,
    private readonly auth: AuthService,
    private readonly navigation: INavigationService,
    messenger: Messenger,
    private readonly log: ILogger,
  ) {
    super();
    this.refreshCommand = new Command(() => this.load(true));
    this.selectDateCommand = new Command<number>((d) => {
      this.setProperty('selectedDate', this._selectedDate, d, (v) => (this._selectedDate = v));
    });
    this.prevWeekCommand = new Command(() => this.moveWeek(-1));
    this.nextWeekCommand = new Command(() => this.moveWeek(1));
    this.todayCommand = new Command(() => {
      this.setWeek(mondayOf(Date.now()));
      this.setProperty('selectedDate', this._selectedDate, startOfDay(Date.now()), (v) => (this._selectedDate = v));
    });
    this.shiftDayCommand = new Command<number>((d) => {
      const date = this._selectedDate + d * DAY;
      if (date < this._weekStart || date >= this._weekStart + 7 * DAY) this.setWeek(mondayOf(date));
      this.setProperty('selectedDate', this._selectedDate, date, (v) => (this._selectedDate = v));
    });
    // Дату обраного дня передаємо як параметр навігації (IQueryAttributable на боці події).
    this.addEventCommand = new Command(() => navigation.goTo('/event/new', { date: this._selectedDate }));
    this.openEventCommand = new Command<PlannerEvent>((e) => navigation.goTo(`/event/${e.id}`, { event: e }));

    const timer = setInterval(() => this.setProperty('now', this._now, Date.now(), (v) => (this._now = v)), 30_000);
    this.track(() => clearInterval(timer));
    this.track(auth.subscribe(() => this.onPropertyChanged('user')));
    this.track(messenger.register('EventsChanged', () => void this.loadEvents()));
    this.track(messenger.register('ScheduleLoaded', (s) => this.setSchedule(s)));
  }

  get selectedDate() { return this._selectedDate; }
  get error() { return this._error; }
  get group() { return this._schedule?.group ?? this.auth.user?.group ?? ''; }
  get hasData() { return this._schedule !== null; }
  get isCurrentWeek() { return this._weekStart === mondayOf(this._now); }

  get greetingText() {
    const first = this.auth.user?.fullName.split(' ')[1] ?? '';
    return `${greeting(new Date(this._now))}${first ? `, ${first}` : ''}`;
  }

  get weekTitle() {
    const end = this._weekStart + 6 * DAY;
    return `${formatDate(this._weekStart)} — ${formatDate(end)}`;
  }

  get selectedTitle() {
    const d = new Date(this._selectedDate);
    const today = startOfDay(this._now);
    if (this._selectedDate === today) return 'Сьогодні';
    if (this._selectedDate === today + DAY) return 'Завтра';
    return WEEKDAYS_FULL[d.getDay()];
  }

  get week(): WeekDay[] {
    const today = startOfDay(this._now);
    return Array.from({ length: 7 }, (_, i) => {
      const date = this._weekStart + i * DAY;
      const d = new Date(date);
      return {
        date,
        label: WEEKDAYS_SHORT[d.getDay()],
        dayOfMonth: d.getDate(),
        isToday: date === today,
        count: this.itemsOf(date).length,
      };
    });
  }

  get items(): TimelineItem[] {
    return this.itemsOf(this._selectedDate);
  }

  itemState(item: TimelineItem): ItemState {
    const today = startOfDay(this._now);
    if (this._selectedDate < today) return 'past';
    if (this._selectedDate > today) return 'upcoming';
    const d = new Date(this._now);
    const mins = d.getHours() * 60 + d.getMinutes();
    if (mins >= minutesOf(item.end)) return 'past';
    if (mins >= minutesOf(item.start)) return 'now';
    return 'upcoming';
  }

  /** Картка зверху: що зараз / що далі сьогодні (пари та події разом). */
  get todaySummary(): { title: string; item: TimelineItem | null; minutesLeft: number | null } {
    const items = this.itemsOf(startOfDay(this._now));
    const d = new Date(this._now);
    const mins = d.getHours() * 60 + d.getMinutes();
    if (!items.length) return { title: 'Сьогодні вільний день', item: null, minutesLeft: null };
    const current = items.find((i) => mins >= minutesOf(i.start) && mins < minutesOf(i.end));
    if (current) return { title: `Зараз · до ${current.end}`, item: current, minutesLeft: minutesOf(current.end) - mins };
    const next = items.find((i) => minutesOf(i.start) > mins);
    if (next) {
      const left = minutesOf(next.start) - mins;
      return { title: left < 60 ? `Через ${left} хв` : `Далі о ${next.start}`, item: next, minutesLeft: left };
    }
    return { title: 'На сьогодні все — гарного вечора', item: null, minutesLeft: null };
  }

  override async onAppearing() {
    if (!this._schedule) {
      const cached = await this.scheduleService.cached();
      if (cached) this.setSchedule(cached);
    }
    await this.loadEvents();
    await this.load(false);
  }

  private itemsOf(date: number): TimelineItem[] {
    const dow = new Date(date).getDay();
    const lessons: TimelineItem[] = (this._schedule?.lessons ?? [])
      .filter((l) => l.day === dow)
      .map((l) => ({ kind: 'lesson', key: `l-${l.id}`, start: l.start, end: l.end, lesson: l }));
    const events: TimelineItem[] = this._events
      .filter((e) => startOfDay(e.startAt) === date)
      .map((e) => ({ kind: 'event', key: `e-${e.id}`, start: hhmm(e.startAt), end: hhmm(e.startAt + e.durationMin * 60_000), event: e }));
    return [...lessons, ...events].sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
  }

  private moveWeek(delta: number) {
    this.setWeek(this._weekStart + delta * 7 * DAY);
    const weekday = (new Date(this._selectedDate).getDay() + 6) % 7;
    this.setProperty('selectedDate', this._selectedDate, this._weekStart + weekday * DAY, (v) => (this._selectedDate = v));
  }

  private setWeek(start: number) {
    if (this.setProperty('weekStart', this._weekStart, start, (v) => (this._weekStart = v))) void this.loadEvents();
  }

  private async loadEvents() {
    this._events = await this.eventsRepo.getRange(this._weekStart, this._weekStart + 7 * DAY);
    this.onPropertyChanged('events');
  }

  private async load(userInitiated: boolean) {
    if (userInitiated) this.setBusy(true);
    try {
      this.setSchedule(await this.scheduleService.fetch());
      this.setProperty('error', this._error, null, (v) => (this._error = v));
    } catch (e) {
      this.log.warn('Schedule refresh failed', { reason: userMessage(e) });
      const msg = this._schedule ? 'Офлайн — показано збережений розклад' : userMessage(e);
      this.setProperty('error', this._error, msg, (v) => (this._error = v));
    } finally {
      this.setBusy(false);
    }
  }

  private setSchedule(s: Schedule) {
    this._schedule = s;
    this.onPropertyChanged('schedule');
  }
}

function mondayOf(t: number) {
  const day = startOfDay(t);
  const dow = new Date(day).getDay();
  return day - ((dow + 6) % 7) * DAY;
}
