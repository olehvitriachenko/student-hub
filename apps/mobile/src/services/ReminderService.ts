import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { Messenger } from '../core/mvvm/Messenger';
import type { ILogger } from '../core/logging/Logger';
import type { IAssignmentRepository } from '../data/AssignmentRepository';
import type { IEventRepository } from '../data/EventRepository';
import { categoryOf } from '../models/PlannerEvent';
import type { INavigationService } from './NavigationService';
import type { IPreferences } from './Preferences';
import type { ScheduleService } from './ScheduleService';
import { minutesOf, startOfDay } from '../utils/format';

export interface ReminderSettings {
  lessons: boolean;
  deadlines: boolean;
  events: boolean;
  lessonLeadMin: number;
}

const SETTINGS_KEY = 'reminders.settings';
const DEFAULTS: ReminderSettings = { lessons: true, deadlines: true, events: true, lessonLeadMin: 10 };
const DAY = 86_400_000;
/** iOS тримає максимум 64 заплановані локальні сповіщення — лишаємо запас. */
const MAX_SCHEDULED = 60;

type Permission = 'granted' | 'denied' | 'undetermined';

interface Planned {
  at: number;
  title: string;
  body: string;
  route: string;
}

/**
 * Нагадування (локальні сповіщення через expo-notifications):
 *  - за N хв до пари (на 7 днів уперед),
 *  - напередодні дедлайну завдання о 18:00,
 *  - за 15 хв до власної події планувальника.
 * Після будь-якої зміни даних (Messenger) розклад сповіщень перебудовується повністю.
 * Тап по сповіщенню відкриває відповідний екран.
 */
export class ReminderService extends ObservableObject {
  private _settings: ReminderSettings = DEFAULTS;
  private _permission: Permission = 'undetermined';
  private _scheduledCount = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;

  constructor(
    private readonly schedule: ScheduleService,
    private readonly assignments: IAssignmentRepository,
    private readonly events: IEventRepository,
    private readonly prefs: IPreferences,
    private readonly navigation: INavigationService,
    messenger: Messenger,
    private readonly log: ILogger,
  ) {
    super();
    const refresh = () => this.requestReschedule();
    messenger.register('ScheduleLoaded', refresh);
    messenger.register('AssignmentsSynced', refresh);
    messenger.register('AssignmentSaved', refresh);
    messenger.register('AssignmentDeleted', refresh);
    messenger.register('EventsChanged', refresh);
  }

  get settings() { return this._settings; }
  get permission() { return this._permission; }
  get scheduledCount() { return this._scheduledCount; }

  async init(): Promise<void> {
    // Показувати банер, навіть коли застосунок відкритий.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === 'string') this.navigation.goTo(route);
    });
    this._settings = { ...DEFAULTS, ...((await this.prefs.getJson<ReminderSettings>(SETTINGS_KEY)) ?? {}) };
    await this.refreshPermission();
  }

  /** Вмикається після входу в акаунт. */
  async enable(): Promise<void> {
    this.enabled = true;
    if (this._permission === 'undetermined') await this.requestPermission();
    this.requestReschedule();
  }

  /** Сповіщення про кінець фокус-сесії (окремий ідентифікатор — перебудова нагадувань його не чіпає). */
  async scheduleFocusEnd(at: number, title: string, body: string): Promise<void> {
    if (this._permission !== 'granted') return;
    await this.cancelFocusEnd();
    await Notifications.scheduleNotificationAsync({
      identifier: 'focus-end',
      content: { title, body, data: { route: '/assignments' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }

  async cancelFocusEnd(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync('focus-end').catch(() => undefined);
  }

  /** Знімаємо лише нагадування (rem-*), не чіпаючи таймер фокусу. */
  private async cancelReminders() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) if (n.identifier.startsWith('rem-')) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }

  /** Вихід з акаунта: прибираємо всі нагадування. */
  async disable(): Promise<void> {
    this.enabled = false;
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.setCount(0);
  }

  async requestPermission(): Promise<Permission> {
    const res = await Notifications.requestPermissionsAsync();
    this.setPermission(res.status as Permission);
    this.log.info('Notification permission', { status: res.status });
    if (res.status === 'granted') this.requestReschedule();
    return this._permission;
  }

  openSystemSettings() {
    void Linking.openSettings();
  }

  async update(patch: Partial<ReminderSettings>): Promise<void> {
    this._settings = { ...this._settings, ...patch };
    this.onPropertyChanged('settings');
    await this.prefs.setJson(SETTINGS_KEY, this._settings);
    if (this._permission !== 'granted' && Object.values(patch).some(Boolean)) await this.requestPermission();
    this.requestReschedule();
  }

  /** Тестове сповіщення через 3 секунди — щоб побачити, як виглядає нагадування. */
  async sendTest(): Promise<void> {
    if (this._permission !== 'granted' && (await this.requestPermission()) !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: { title: '🔔 Student Hub', body: 'Так виглядатиме нагадування про пару чи дедлайн.', data: { route: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3 },
    });
    this.log.info('Test notification scheduled');
  }

  private requestReschedule() {
    if (!this.enabled) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reschedule(), 400); // debounce: зміни часто приходять пачкою
  }

  private async reschedule() {
    if (this._permission !== 'granted') return;
    try {
      const planned = (await this.collect()).filter((p) => p.at > Date.now() + 5_000).sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
      await this.cancelReminders();
      for (const [i, p] of planned.entries()) {
        await Notifications.scheduleNotificationAsync({
          identifier: `rem-${i}`,
          content: { title: p.title, body: p.body, data: { route: p.route } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at },
        });
      }
      this.setCount(planned.length);
      this.log.info('Reminders rescheduled', { count: planned.length });
    } catch (e) {
      this.log.error(e, 'Failed to reschedule reminders');
    }
  }

  private async collect(): Promise<Planned[]> {
    const s = this._settings;
    const out: Planned[] = [];
    const now = Date.now();

    if (s.lessons) {
      const schedule = await this.schedule.cached();
      for (let d = 0; d < 7 && schedule; d++) {
        const day = startOfDay(now) + d * DAY;
        const dow = new Date(day).getDay();
        for (const l of schedule.lessons.filter((x) => x.day === dow)) {
          out.push({
            at: day + (minutesOf(l.start) - s.lessonLeadMin) * 60_000,
            title: `${l.subject} через ${s.lessonLeadMin} хв`,
            body: `${l.type} · ${l.start}–${l.end} · ауд. ${l.room}`,
            route: '/',
          });
        }
      }
    }

    if (s.deadlines) {
      for (const a of await this.assignments.getAll()) {
        if (a.done) continue;
        const eve = startOfDay(a.dueAt) - DAY + 18 * 3_600_000; // напередодні о 18:00
        out.push({ at: eve, title: 'Завтра дедлайн ⏰', body: `${a.title} · ${a.subject}`, route: `/assignment/${a.id}` });
      }
    }

    if (s.events) {
      for (const e of await this.events.getRange(now, now + 14 * DAY)) {
        if (!e.remind) continue;
        out.push({ at: e.startAt - 15 * 60_000, title: `${e.title} через 15 хв`, body: categoryOf(e.category).label, route: `/event/${e.id}` });
      }
    }
    return out;
  }

  private async refreshPermission() {
    const res = await Notifications.getPermissionsAsync();
    this.setPermission(res.status as Permission);
  }

  private setPermission(p: Permission) {
    this.setProperty('permission', this._permission, p, (v) => (this._permission = v));
  }

  private setCount(n: number) {
    this.setProperty('scheduledCount', this._scheduledCount, n, (v) => (this._scheduledCount = v));
  }
}
