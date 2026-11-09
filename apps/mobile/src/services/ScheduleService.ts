import type { ILogger } from '../core/logging/Logger';
import type { Messenger } from '../core/mvvm/Messenger';
import type { Schedule } from '../models/Lesson';
import type { ApiClient } from './ApiClient';
import type { IPreferences } from './Preferences';

const CACHE_KEY = 'schedule.cache';

/**
 * Розклад групи: мережа + кеш у Preferences, щоб розклад був доступний офлайн.
 */
export class ScheduleService {
  constructor(
    private readonly api: ApiClient,
    private readonly prefs: IPreferences,
    private readonly log: ILogger,
    private readonly messenger: Messenger,
  ) {}

  cached(): Promise<Schedule | null> {
    return this.prefs.getJson<Schedule>(CACHE_KEY);
  }

  async fetch(): Promise<Schedule> {
    const schedule = await this.api.schedule();
    await this.prefs.setJson(CACHE_KEY, schedule);
    this.log.info('Schedule loaded', { group: schedule.group, lessons: schedule.lessons.length });
    this.messenger.send('ScheduleLoaded', schedule);
    return schedule;
  }

  clear(): Promise<void> {
    return this.prefs.remove(CACHE_KEY);
  }
}
