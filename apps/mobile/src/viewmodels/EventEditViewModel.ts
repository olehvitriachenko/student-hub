import * as Crypto from 'expo-crypto';
import { Command } from '../core/mvvm/Command';
import type { Messenger } from '../core/mvvm/Messenger';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IEventRepository } from '../data/EventRepository';
import { validateEvent, type EventCategory, type PlannerEvent } from '../models/PlannerEvent';
import type { Analytics } from '../services/CrashReporting';
import type { IQueryAttributable, INavigationService, QueryParams } from '../services/NavigationService';
import { startOfDay } from '../utils/format';

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Створення / редагування події планувальника. */
export class EventEditViewModel extends ViewModelBase implements IQueryAttributable {
  private original: PlannerEvent | null = null;
  private _isNew = true;
  private _notFound = false;
  private _title = '';
  private _category: EventCategory = 'study';
  private _startAt = defaultStart(startOfDay(Date.now()));
  private _durationMin = 60;
  private _note = '';
  private _remind = true;
  private _error: string | null = null;

  readonly saveCommand: Command;
  readonly deleteCommand: Command;
  readonly setCategoryCommand: Command<EventCategory>;
  readonly shiftDayCommand: Command<number>;
  readonly shiftTimeCommand: Command<number>;
  readonly setDurationCommand: Command<number>;
  readonly toggleRemindCommand: Command;

  constructor(
    private readonly repo: IEventRepository,
    private readonly navigation: INavigationService,
    private readonly messenger: Messenger,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.saveCommand = new Command(() => this.save(), () => !!this._title.trim());
    this.deleteCommand = new Command(() => this.remove(), () => !this._isNew);
    this.setCategoryCommand = new Command<EventCategory>((c) => this.set('category', c));
    this.shiftDayCommand = new Command<number>((d) => this.set('startAt', this._startAt + d * DAY));
    this.shiftTimeCommand = new Command<number>((m) => this.set('startAt', this._startAt + m * 60_000));
    this.setDurationCommand = new Command<number>((m) => this.set('durationMin', m));
    this.toggleRemindCommand = new Command(() => this.set('remind', !this._remind));
  }

  get isNew() { return this._isNew; }
  get notFound() { return this._notFound; }
  get title() { return this._title; }
  set title(v: string) { this.set('title', v); }
  get category() { return this._category; }
  get startAt() { return this._startAt; }
  get endAt() { return this._startAt + this._durationMin * 60_000; }
  get durationMin() { return this._durationMin; }
  get note() { return this._note; }
  set note(v: string) { this.set('note', v); }
  get remind() { return this._remind; }
  get error() { return this._error; }

  async initialize(id: string) {
    const params = this.navigation.takeParams(`/event/${id}`);
    if (params?.event) return this.applyQueryAttributes(params);
    if (id === 'new') {
      if (typeof params?.date === 'number') this.set('startAt', defaultStart(params.date));
      return;
    }
    const found = await this.repo.getById(id);
    if (found) this.applyQueryAttributes({ event: found });
    else this.set('notFound', true);
  }

  applyQueryAttributes(query: QueryParams): void {
    const e = query.event as PlannerEvent | undefined;
    if (!e) return;
    this.original = e;
    this.set('isNew', false);
    this.set('title', e.title);
    this.set('category', e.category);
    this.set('startAt', e.startAt);
    this.set('durationMin', e.durationMin);
    this.set('note', e.note);
    this.set('remind', e.remind);
  }

  private async save() {
    const problem = validateEvent({ title: this._title, durationMin: this._durationMin });
    if (problem) return this.set('error', problem);
    const event: PlannerEvent = {
      id: this.original?.id ?? Crypto.randomUUID(),
      title: this._title.trim(),
      category: this._category,
      startAt: this._startAt,
      durationMin: this._durationMin,
      note: this._note.trim(),
      remind: this._remind,
      createdAt: this.original?.createdAt ?? Date.now(),
    };
    await this.repo.save(event);
    this.analytics.trackEvent(this._isNew ? 'EventCreated' : 'EventUpdated', { category: event.category });
    this.messenger.send('EventsChanged', { id: event.id });
    this.navigation.goBack();
  }

  private async remove() {
    if (!this.original) return;
    await this.repo.delete(this.original.id);
    this.log.info('Event removed by user');
    this.messenger.send('EventsChanged', { id: this.original.id });
    this.navigation.goBack();
  }

  private set<K extends 'isNew' | 'notFound' | 'title' | 'category' | 'startAt' | 'durationMin' | 'note' | 'remind' | 'error'>(name: K, value: this[K]) {
    const field = `_${name}`;
    const self = this as unknown as Record<string, unknown>;
    if (this.setProperty(name, self[field], value, (v) => (self[field] = v))) {
      if (name === 'startAt' || name === 'durationMin') this.onPropertyChanged('endAt');
      if (name !== 'error') this.setProperty('error', this._error, null, (v) => (this._error = v));
      this.saveCommand.raiseCanExecuteChanged();
      this.deleteCommand.raiseCanExecuteChanged();
    }
  }
}

/** Новa подія за замовчуванням: найближча повна година (але не раніше 9:00) обраного дня. */
function defaultStart(day: number) {
  const now = Date.now();
  if (startOfDay(now) === day) return Math.max(day + 9 * HOUR, Math.ceil(now / HOUR) * HOUR);
  return day + 16 * HOUR;
}
