import * as Crypto from 'expo-crypto';
import { Command } from '../core/mvvm/Command';
import type { Messenger } from '../core/mvvm/Messenger';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IAssignmentRepository } from '../data/AssignmentRepository';
import { validateAssignment, type Assignment } from '../models/Assignment';
import type { AppLifecycleService } from '../services/AppLifecycleService';
import type { Analytics } from '../services/CrashReporting';
import type { IQueryAttributable, INavigationService, QueryParams } from '../services/NavigationService';
import type { IPreferences } from '../services/Preferences';
import type { ScheduleService } from '../services/ScheduleService';
import type { SyncService } from '../services/SyncService';
import { startOfDay } from '../utils/format';

const DRAFT_KEY = 'draft.assignment.new';
const DAY = 86_400_000;
const FALLBACK_SUBJECTS = ['Мобільна розробка', 'Бази даних', 'Веб-технології', 'Алгоритми та структури даних'];

type Draft = Pick<Assignment, 'title' | 'subject' | 'description' | 'dueAt'>;

/**
 * Створення / редагування завдання.
 * Отримує завдання через IQueryAttributable (лаб. 2) або читає його з БД за id (deep link, лаб. 3).
 * Чернетку нового завдання зберігає, коли застосунок іде у фон (лаб. 3).
 */
export class AssignmentEditViewModel extends ViewModelBase implements IQueryAttributable {
  private original: Assignment | null = null;
  private _isNew = true;
  private _notFound = false;
  private _title = '';
  private _subject = '';
  private _description = '';
  private _dueAt = startOfDay(Date.now()) + 7 * DAY + 23 * 3_600_000 + 59 * 60_000;
  private _done = false;
  private _gradeText = '';
  private _error: string | null = null;
  private _subjects: string[] = FALLBACK_SUBJECTS;

  readonly saveCommand: Command;
  readonly deleteCommand: Command;
  readonly cancelCommand: Command;
  readonly setDueInDaysCommand: Command<number>;
  readonly shiftDueCommand: Command<number>;
  readonly setSubjectCommand: Command<string>;
  readonly toggleDoneCommand: Command;
  readonly focusCommand: Command;

  constructor(
    private readonly repo: IAssignmentRepository,
    private readonly navigation: INavigationService,
    private readonly messenger: Messenger,
    private readonly sync: SyncService,
    private readonly schedule: ScheduleService,
    private readonly prefs: IPreferences,
    lifecycle: AppLifecycleService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.saveCommand = new Command(() => this.save(), () => !!this._title.trim() && !!this._subject);
    this.deleteCommand = new Command(() => this.remove(), () => !this._isNew);
    this.cancelCommand = new Command(() => navigation.goBack());
    this.setDueInDaysCommand = new Command<number>((d) =>
      this.setDue(startOfDay(Date.now()) + d * DAY + 23 * 3_600_000 + 59 * 60_000),
    );
    this.shiftDueCommand = new Command<number>((d) => this.setDue(this._dueAt + d * DAY));
    this.setSubjectCommand = new Command<string>((s) => this.set('subject', s));
    this.toggleDoneCommand = new Command(() => this.set('done', !this._done));
    this.focusCommand = new Command(
      () => {
        if (this.original) navigation.goTo(`/focus/${this.original.id}`, { assignment: this.original });
      },
      () => !this._isNew,
    );

    this.track(lifecycle.on((e) => (e === 'Stopped' ? void this.saveDraft() : undefined)));
  }

  // ---------- bindable properties ----------
  get isNew() { return this._isNew; }
  get notFound() { return this._notFound; }
  get title() { return this._title; }
  set title(v: string) { this.set('title', v); }
  get subject() { return this._subject; }
  get description() { return this._description; }
  set description(v: string) { this.set('description', v); }
  get dueAt() { return this._dueAt; }
  get done() { return this._done; }
  get gradeText() { return this._gradeText; }
  set gradeText(v: string) { this.set('gradeText', v.replace(/[^\d.,]/g, '').slice(0, 5)); }
  get error() { return this._error; }
  get subjects() { return this._subjects; }

  /** Викликається сторінкою з id маршруту. */
  async initialize(id: string) {
    const cached = await this.schedule.cached();
    if (cached) this.setSubjects([...new Set(cached.lessons.map((l) => l.subject))]);

    const params = this.navigation.takeParams(`/assignment/${id}`);
    if (params) return this.applyQueryAttributes(params);
    if (id === 'new') return this.restoreDraft();

    const found = await this.repo.getById(id);
    if (found) this.applyQueryAttributes({ assignment: found });
    else this.set('notFound', true);
  }

  applyQueryAttributes(query: QueryParams): void {
    const a = query.assignment as Assignment | undefined;
    if (!a) return;
    this.original = a;
    this.set('isNew', false);
    this.set('title', a.title);
    this.set('subject', a.subject);
    this.set('description', a.description);
    this.set('dueAt', a.dueAt);
    this.set('done', a.done);
    this.set('gradeText', a.grade === null ? '' : String(a.grade));
    if (!this._subjects.includes(a.subject)) this.setSubjects([a.subject, ...this._subjects]);
  }

  private async save() {
    const gradeRaw = this._gradeText.replace(',', '.').trim();
    const grade = gradeRaw ? Number(gradeRaw) : null;
    const draft = { title: this._title.trim(), subject: this._subject, grade };
    const problem = validateAssignment(draft);
    if (problem) return this.set('error', problem);

    const assignment: Assignment = {
      id: this.original?.id ?? Crypto.randomUUID(),
      title: draft.title,
      subject: draft.subject,
      description: this._description.trim(),
      dueAt: this._dueAt,
      done: this._done,
      grade,
      updatedAt: Date.now(),
      deleted: false,
    };
    await this.repo.save(assignment);
    if (this._isNew) await this.prefs.remove(DRAFT_KEY);
    this.analytics.trackEvent(this._isNew ? 'AssignmentCreated' : 'AssignmentUpdated', { subject: assignment.subject });
    // Повертаємо результат двома способами: Messenger (для всіх підписників) і параметри GoBack.
    this.messenger.send('AssignmentSaved', assignment);
    void this.sync.notifyLocalChange();
    this.navigation.goBack({ savedAssignment: assignment });
  }

  private async remove() {
    if (!this.original) return;
    await this.repo.delete(this.original.id);
    this.analytics.trackEvent('AssignmentDeleted');
    this.messenger.send('AssignmentDeleted', { id: this.original.id });
    void this.sync.notifyLocalChange();
    this.navigation.goBack();
  }

  private async saveDraft() {
    if (!this._isNew || !(this._title || this._description)) return;
    const draft: Draft = { title: this._title, subject: this._subject, description: this._description, dueAt: this._dueAt };
    await this.prefs.setJson(DRAFT_KEY, draft);
    this.log.info('Assignment draft saved');
  }

  private async restoreDraft() {
    const draft = await this.prefs.getJson<Draft>(DRAFT_KEY);
    if (!draft) {
      if (!this._subject && this._subjects.length) this.set('subject', this._subjects[0]);
      return;
    }
    this.set('title', draft.title);
    this.set('subject', draft.subject || this._subjects[0] || '');
    this.set('description', draft.description);
    this.set('dueAt', draft.dueAt);
    this.log.info('Assignment draft restored');
  }

  private setDue(t: number) {
    this.set('dueAt', t);
  }

  private setSubjects(list: string[]) {
    this.setProperty('subjects', this._subjects, list, (v) => (this._subjects = v));
  }

  private set<K extends 'isNew' | 'notFound' | 'title' | 'subject' | 'description' | 'dueAt' | 'done' | 'gradeText' | 'error'>(
    name: K,
    value: this[K],
  ) {
    const field = `_${name}`;
    const self = this as unknown as Record<string, unknown>;
    if (this.setProperty(name, self[field], value, (v) => (self[field] = v))) {
      if (name !== 'error') this.setProperty('error', this._error, null, (v) => (this._error = v));
      this.saveCommand.raiseCanExecuteChanged();
      this.deleteCommand.raiseCanExecuteChanged();
      this.focusCommand.raiseCanExecuteChanged();
    }
  }
}
