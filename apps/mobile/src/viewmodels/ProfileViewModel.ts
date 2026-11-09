import { Command } from '../core/mvvm/Command';
import type { Messenger } from '../core/mvvm/Messenger';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IAssignmentRepository } from '../data/AssignmentRepository';
import { averageGrade, type Assignment } from '../models/Assignment';
import { userMessage } from '../services/ApiClient';
import type { AuthService } from '../services/AuthService';
import type { INavigationService } from '../services/NavigationService';
import type { ReminderService, ReminderSettings } from '../services/ReminderService';
import type { FocusService } from '../services/FocusService';
import type { ScheduleService } from '../services/ScheduleService';
import type { SyncService } from '../services/SyncService';
import type { ThemePreference, ThemeService } from '../services/ThemeService';
import { initials, startOfDay } from '../utils/format';

/** Вкладка «Профіль»: дані акаунта, статистика, редагування, тема, вихід. */
export class ProfileViewModel extends ViewModelBase {
  private assignments: Assignment[] = [];
  private _isEditing = false;
  private _editFullName = '';
  private _editGroup = '';
  private _error: string | null = null;

  readonly startEditCommand: Command;
  readonly cancelEditCommand: Command;
  readonly saveProfileCommand: Command;
  readonly setThemeCommand: Command<ThemePreference>;
  readonly syncCommand: Command;
  readonly openDiagnosticsCommand: Command;
  readonly openLogsCommand: Command;
  readonly logoutCommand: Command;
  readonly toggleReminderCommand: Command<keyof Omit<ReminderSettings, 'lessonLeadMin'>>;
  readonly setLeadCommand: Command<number>;
  readonly testNotificationCommand: Command;
  readonly fixPermissionCommand: Command;

  constructor(
    private readonly auth: AuthService,
    private readonly repo: IAssignmentRepository,
    readonly sync: SyncService,
    readonly theme: ThemeService,
    readonly reminders: ReminderService,
    readonly focus: FocusService,
    private readonly schedule: ScheduleService,
    navigation: INavigationService,
    messenger: Messenger,
    private readonly log: ILogger,
  ) {
    super();
    this.startEditCommand = new Command(() => {
      this._editFullName = this.auth.user?.fullName ?? '';
      this._editGroup = this.auth.user?.group ?? '';
      this.setProperty('isEditing', this._isEditing, true, (v) => (this._isEditing = v));
      this.onPropertyChanged('editFullName');
      this.onPropertyChanged('editGroup');
    });
    this.cancelEditCommand = new Command(() => {
      this.setProperty('isEditing', this._isEditing, false, (v) => (this._isEditing = v));
      this.setError(null);
    });
    this.saveProfileCommand = new Command(
      () => this.saveProfile(),
      () => !!this._editFullName.trim() && !!this._editGroup.trim(),
    );
    this.setThemeCommand = new Command<ThemePreference>((t) => theme.setPreference(t));
    this.syncCommand = new Command(() => sync.sync(), () => !sync.isSyncing);
    this.openDiagnosticsCommand = new Command(() => navigation.goTo('/settings'));
    this.openLogsCommand = new Command(() => navigation.goTo('/logs'));
    this.logoutCommand = new Command(async () => {
      this.setError(null);
      try { await auth.signOut(); }
      catch (e) {
        this.log.warn('Sign out failed', { reason: String(e) });
        this.setError('Не вдалося завершити вихід. Спробуйте ще раз.');
      }
    });
    this.toggleReminderCommand = new Command((key) => reminders.update({ [key]: !reminders.settings[key] }));
    this.setLeadCommand = new Command<number>((m) => reminders.update({ lessonLeadMin: m }));
    this.testNotificationCommand = new Command(() => reminders.sendTest());
    // Якщо дозвіл ще не питали — питаємо; якщо відхилено — ведемо в системні налаштування.
    this.fixPermissionCommand = new Command(() =>
      reminders.permission === 'denied' ? reminders.openSystemSettings() : void reminders.requestPermission(),
    );

    for (const source of [auth, theme, sync, reminders, focus]) {
      this.track(
        source.subscribe((p) => {
          this.onPropertyChanged(p);
          this.syncCommand.raiseCanExecuteChanged();
        }),
      );
    }
    this.track(messenger.register('AssignmentsSynced', () => void this.loadStats()));
    this.track(messenger.register('AssignmentSaved', () => void this.loadStats()));
    this.track(messenger.register('AssignmentDeleted', () => void this.loadStats()));
  }

  get user() { return this.auth.user; }
  get initials() { return initials(this.auth.user?.fullName ?? ''); }
  get isEditing() { return this._isEditing; }
  get error() { return this._error; }

  get editFullName() { return this._editFullName; }
  set editFullName(v: string) {
    if (this.setProperty('editFullName', this._editFullName, v, (x) => (this._editFullName = x))) {
      this.saveProfileCommand.raiseCanExecuteChanged();
    }
  }
  get editGroup() { return this._editGroup; }
  set editGroup(v: string) {
    if (this.setProperty('editGroup', this._editGroup, v.toUpperCase(), (x) => (this._editGroup = x))) {
      this.saveProfileCommand.raiseCanExecuteChanged();
    }
  }

  /** Середня оцінка за предметами — для графіка (від найкращої). */
  get gradesBySubject(): { subject: string; average: number; count: number }[] {
    const by = new Map<string, number[]>();
    for (const a of this.assignments) if (a.grade !== null) by.set(a.subject, [...(by.get(a.subject) ?? []), a.grade]);
    return [...by.entries()]
      .map(([subject, g]) => ({ subject, average: g.reduce((s, x) => s + x, 0) / g.length, count: g.length }))
      .sort((x, y) => y.average - x.average);
  }

  get stats() {
    const today = startOfDay(Date.now());
    const avg = averageGrade(this.assignments);
    const done = this.assignments.filter((a) => a.done).length;
    return {
      total: this.assignments.length,
      done,
      active: this.assignments.length - done,
      overdue: this.assignments.filter((a) => !a.done && a.dueAt < today).length,
      average: avg === null ? '—' : avg.toFixed(0),
      progress: this.assignments.length ? done / this.assignments.length : 0,
    };
  }

  override onAppearing() {
    void this.loadStats();
  }

  private async loadStats() {
    this.assignments = await this.repo.getAll();
    this.onPropertyChanged('stats');
  }

  private async saveProfile() {
    const groupChanged = this._editGroup.trim() !== this.auth.user?.group;
    try {
      await this.auth.updateProfile({ fullName: this._editFullName, group: this._editGroup });
      this.setProperty('isEditing', this._isEditing, false, (v) => (this._isEditing = v));
      this.setError(null);
      if (groupChanged) await this.schedule.fetch().catch(() => undefined); // інша група — інший розклад
    } catch (e) {
      this.log.warn('Profile update failed', { reason: userMessage(e) });
      this.setError(userMessage(e));
    }
  }

  private setError(e: string | null) {
    this.setProperty('error', this._error, e, (v) => (this._error = v));
  }
}
