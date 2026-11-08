import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { Messenger } from '../core/mvvm/Messenger';
import type { ILogger } from '../core/logging/Logger';
import type { SqliteStudentRepository } from '../data/StudentRepository';
import type { ApiClient } from './ApiClient';
import type { IPreferences } from './Preferences';

const LAST_PULL_KEY = 'sync.lastPullAt';

/**
 * Offline-first синхронізація (лаб. 4).
 *
 * 1. Усі CRUD-операції спершу пишуться в SQLite + таблицю sync_queue (див. репозиторій).
 * 2. Коли з'являється мережа (NetInfo) — push: послідовно відправляємо чергу на сервер,
 *    успішні елементи видаляємо, невдалі лишаємо з attempts + 1.
 * 3. Pull: забираємо зміни з сервера з моменту останньої синхронізації.
 *
 * Конфлікти: last-write-wins за полем updatedAt — і на сервері, і на клієнті.
 */
export class SyncService extends ObservableObject {
  private _isOnline = false;
  private _isSyncing = false;
  private _pendingCount = 0;
  private _lastSyncAt: number | null = null;
  private _lastError: string | null = null;
  private unsubscribeNet?: () => void;

  constructor(
    private readonly repo: SqliteStudentRepository,
    private readonly api: ApiClient,
    private readonly prefs: IPreferences,
    private readonly messenger: Messenger,
    private readonly log: ILogger,
  ) {
    super();
  }

  get isOnline() { return this._isOnline; }
  get isSyncing() { return this._isSyncing; }
  get pendingCount() { return this._pendingCount; }
  get lastSyncAt() { return this._lastSyncAt; }
  get lastError() { return this._lastError; }
  get apiUrl() { return this.api.baseUrl; }

  start(): void {
    this.unsubscribeNet = NetInfo.addEventListener((s) => this.onNetworkChanged(s));
    void this.refreshPendingCount();
  }

  stop(): void {
    this.unsubscribeNet?.();
  }

  /** Викликається репозиторієм/ViewModel після локальної зміни. */
  async notifyLocalChange(): Promise<void> {
    await this.refreshPendingCount();
    if (this._isOnline) void this.sync();
  }

  async sync(): Promise<void> {
    if (this._isSyncing) return;
    this.set('isSyncing', true);
    this.set('lastError', null);
    try {
      if (!(await this.api.health())) {
        this.log.warn('Sync skipped: API is unreachable', { url: this.api.baseUrl });
        this.set('lastError', `API недоступний (${this.api.baseUrl})`);
        return;
      }
      const pushed = await this.push();
      const pulled = await this.pull();
      this.set('lastSyncAt', Date.now());
      this.log.info('Sync completed', { pushed, pulled });
      this.messenger.send('StudentsSynced', { pushed, pulled });
    } catch (e) {
      this.log.error(e, 'Sync failed');
      this.set('lastError', e instanceof Error ? e.message : String(e));
    } finally {
      await this.refreshPendingCount();
      this.set('isSyncing', false);
    }
  }

  private async push(): Promise<number> {
    let pushed = 0;
    for (const item of await this.repo.pending()) {
      const student = this.repo.decodePayload(item);
      try {
        if (item.operation === 'Delete') {
          await this.api.delete(student.id, student.updatedAt);
        } else {
          const { conflict, record } = await this.api.upsert(student);
          if (conflict) {
            this.log.warn('Conflict: server version is newer, keeping server copy', { id: record.id });
            await this.repo.applyRemote(record);
          }
        }
        await this.repo.remove(item.id);
        pushed++;
      } catch (e) {
        await this.repo.markFailed(item.id);
        this.log.error(e, 'Failed to push queue item', { queueId: item.id, attempts: item.attempts + 1 });
        throw e; // зупиняємо push, щоб зберегти порядок операцій
      }
    }
    return pushed;
  }

  private async pull(): Promise<number> {
    const since = Number((await this.prefs.get(LAST_PULL_KEY)) ?? 0);
    const remote = await this.api.pull(since);
    let applied = 0;
    let maxUpdated = since;
    for (const s of remote) {
      if (await this.repo.applyRemote(s)) applied++;
      maxUpdated = Math.max(maxUpdated, s.updatedAt);
    }
    await this.prefs.set(LAST_PULL_KEY, String(maxUpdated));
    return applied;
  }

  private onNetworkChanged(state: NetInfoState) {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    if (!this.set('isOnline', online)) return;
    this.log.info(online ? 'Network: online' : 'Network: offline', { type: state.type });
    if (online) void this.sync();
  }

  private async refreshPendingCount() {
    this.set('pendingCount', await this.repo.count());
  }

  private set<K extends 'isOnline' | 'isSyncing' | 'pendingCount' | 'lastSyncAt' | 'lastError'>(
    name: K,
    value: this[K],
  ): boolean {
    const field = `_${name}` as const;
    return this.setProperty(name, (this as any)[field], value, (v) => ((this as any)[field] = v));
  }
}
