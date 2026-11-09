import type { SQLiteDatabase } from 'expo-sqlite';
import type { Assignment } from '../models/Assignment';
import type { SyncOperation, SyncQueueItem } from '../models/SyncQueueItem';
import type { ICryptoService } from '../services/CryptoService';
import type { ILogger } from '../core/logging/Logger';

/**
 * Репозиторій (лаб. 4): ViewModel не знає про SQLite — лише про цей інтерфейс.
 * Тому в тестах його можна підмінити in-memory реалізацією.
 */
export interface IAssignmentRepository {
  getAll(): Promise<Assignment[]>;
  getById(id: string): Promise<Assignment | null>;
  /** Insert або Update + запис у чергу синхронізації (в одній транзакції). */
  save(assignment: Assignment): Promise<void>;
  /** Soft delete + запис у чергу синхронізації. */
  delete(id: string): Promise<void>;
}

export interface ISyncQueueRepository {
  pending(): Promise<SyncQueueItem[]>;
  count(): Promise<number>;
  remove(id: number): Promise<void>;
  markFailed(id: number): Promise<void>;
  /** Застосувати запис, отриманий із сервера (без постановки в чергу), з урахуванням last-write-wins. */
  applyRemote(a: Assignment): Promise<boolean>;
  decodePayload(item: SyncQueueItem): Assignment;
  /** Повне очищення локальних даних (вихід з акаунта). */
  clearAll(): Promise<void>;
}

interface AssignmentRow {
  id: string;
  title: string;
  subject: string;
  descriptionEnc: string;
  dueAt: number;
  done: number;
  grade: number | null;
  updatedAt: number;
  deleted: number;
}

const ENTITY = 'Assignment';

export class SqliteAssignmentRepository implements IAssignmentRepository, ISyncQueueRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly crypto: ICryptoService,
    private readonly log: ILogger,
  ) {}

  // ---------- Assignments ----------

  async getAll(): Promise<Assignment[]> {
    const rows = await this.db.getAllAsync<AssignmentRow>(
      'SELECT * FROM assignments WHERE deleted = 0 ORDER BY done, dueAt',
    );
    this.log.debug('Loaded assignments from SQLite', { count: rows.length });
    return rows.map((r) => this.fromRow(r));
  }

  async getById(id: string): Promise<Assignment | null> {
    const row = await this.db.getFirstAsync<AssignmentRow>('SELECT * FROM assignments WHERE id = ?', id);
    return row && !row.deleted ? this.fromRow(row) : null;
  }

  async save(a: Assignment): Promise<void> {
    try {
      const row = this.toRow(a);
      await this.db.withTransactionAsync(async () => {
        await this.upsertRow(row);
        await this.enqueue(a.id, 'Upsert', row);
      });
      this.log.info('Assignment saved', { id: a.id });
    } catch (e) {
      this.log.error(e, 'Failed to save assignment', { id: a.id });
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.getFirstAsync<AssignmentRow>('SELECT * FROM assignments WHERE id = ?', id);
    if (!existing) {
      this.log.warn('Delete requested for unknown assignment', { id });
      return;
    }
    const row = { ...existing, deleted: 1, updatedAt: Date.now() };
    await this.db.withTransactionAsync(async () => {
      await this.upsertRow(row);
      await this.enqueue(id, 'Delete', row);
    });
    this.log.info('Assignment deleted (soft)', { id });
  }

  async applyRemote(a: Assignment): Promise<boolean> {
    const local = await this.db.getFirstAsync<{ updatedAt: number }>('SELECT updatedAt FROM assignments WHERE id = ?', a.id);
    if (local && local.updatedAt >= a.updatedAt) return false; // локальна версія новіша або та сама
    await this.upsertRow(this.toRow(a));
    return true;
  }

  async clearAll(): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM assignments');
      await this.db.runAsync('DELETE FROM sync_queue');
    });
    this.log.info('Local data cleared');
  }

  // ---------- Sync queue ----------

  pending(): Promise<SyncQueueItem[]> {
    return this.db.getAllAsync<SyncQueueItem>('SELECT * FROM sync_queue ORDER BY id');
  }

  async count(): Promise<number> {
    const r = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_queue');
    return r?.n ?? 0;
  }

  async remove(id: number): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
  }

  async markFailed(id: number): Promise<void> {
    await this.db.runAsync('UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?', id);
  }

  /** Розшифровує payload з черги перед відправкою на сервер. */
  decodePayload(item: SyncQueueItem): Assignment {
    return this.fromRow(JSON.parse(item.payloadJson) as AssignmentRow);
  }

  // ---------- helpers ----------

  private async enqueue(entityId: string, operation: SyncOperation, row: AssignmentRow) {
    // Згортаємо кілька змін одного запису в одну операцію — серверу потрібен лише фінальний стан.
    await this.db.runAsync('DELETE FROM sync_queue WHERE entityType = ? AND entityId = ?', ENTITY, entityId);
    await this.db.runAsync(
      'INSERT INTO sync_queue (entityType, entityId, operation, payloadJson, createdAt) VALUES (?, ?, ?, ?, ?)',
      ENTITY,
      entityId,
      operation,
      JSON.stringify(row),
      Date.now(),
    );
  }

  private upsertRow(r: AssignmentRow) {
    return this.db.runAsync(
      `INSERT INTO assignments (id, title, subject, descriptionEnc, dueAt, done, grade, updatedAt, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, subject = excluded.subject, descriptionEnc = excluded.descriptionEnc,
         dueAt = excluded.dueAt, done = excluded.done, grade = excluded.grade,
         updatedAt = excluded.updatedAt, deleted = excluded.deleted`,
      r.id,
      r.title,
      r.subject,
      r.descriptionEnc,
      r.dueAt,
      r.done,
      r.grade,
      r.updatedAt,
      r.deleted,
    );
  }

  private toRow(a: Assignment): AssignmentRow {
    return {
      id: a.id,
      title: a.title,
      subject: a.subject,
      descriptionEnc: this.crypto.encrypt(a.description),
      dueAt: a.dueAt,
      done: a.done ? 1 : 0,
      grade: a.grade,
      updatedAt: a.updatedAt,
      deleted: a.deleted ? 1 : 0,
    };
  }

  private fromRow(r: AssignmentRow): Assignment {
    let description = '';
    try {
      description = this.crypto.decrypt(r.descriptionEnc);
    } catch {
      this.log.warn('Could not decrypt description', { id: r.id });
    }
    return {
      id: r.id,
      title: r.title,
      subject: r.subject,
      description,
      dueAt: r.dueAt,
      done: r.done === 1,
      grade: r.grade,
      updatedAt: r.updatedAt,
      deleted: r.deleted === 1,
    };
  }
}
