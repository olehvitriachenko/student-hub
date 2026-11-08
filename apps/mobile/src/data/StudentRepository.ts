import type { SQLiteDatabase } from 'expo-sqlite';
import type { Student } from '../models/Student';
import type { SyncOperation, SyncQueueItem } from '../models/SyncQueueItem';
import type { ICryptoService } from '../services/CryptoService';
import type { ILogger } from '../core/logging/Logger';

/**
 * Репозиторій (лаб. 4): ViewModel не знає про SQLite — лише про цей інтерфейс.
 * Тому в тестах його можна підмінити in-memory реалізацією.
 */
export interface IStudentRepository {
  getAll(): Promise<Student[]>;
  getById(id: string): Promise<Student | null>;
  /** Insert або Update + запис у чергу синхронізації. */
  save(student: Student): Promise<void>;
  /** Soft delete + запис у чергу синхронізації. */
  delete(id: string): Promise<void>;
  /** Застосувати запис, отриманий із сервера (без постановки в чергу), з урахуванням last-write-wins. */
  applyRemote(student: Student): Promise<boolean>;
}

export interface ISyncQueueRepository {
  pending(): Promise<SyncQueueItem[]>;
  count(): Promise<number>;
  remove(id: number): Promise<void>;
  markFailed(id: number): Promise<void>;
}

interface StudentRow {
  id: string;
  fullName: string;
  group: string;
  averageScore: number;
  documentNumberEnc: string;
  updatedAt: number;
  deleted: number;
}

export class SqliteStudentRepository implements IStudentRepository, ISyncQueueRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly crypto: ICryptoService,
    private readonly log: ILogger,
  ) {}

  // ---------- Students ----------

  async getAll(): Promise<Student[]> {
    const rows = await this.db.getAllAsync<StudentRow>(
      'SELECT * FROM students WHERE deleted = 0 ORDER BY fullName COLLATE NOCASE',
    );
    this.log.debug('Loaded students from SQLite', { count: rows.length });
    return rows.map((r) => this.fromRow(r));
  }

  async getById(id: string): Promise<Student | null> {
    const row = await this.db.getFirstAsync<StudentRow>('SELECT * FROM students WHERE id = ?', id);
    return row ? this.fromRow(row) : null;
  }

  async save(student: Student): Promise<void> {
    try {
      const row = this.toRow(student);
      await this.db.withTransactionAsync(async () => {
        await this.upsertRow(row);
        await this.enqueue(student.id, 'Upsert', row);
      });
      this.log.info('Student saved', { id: student.id });
    } catch (e) {
      this.log.error(e, 'Failed to save student', { id: student.id });
      throw e;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.getFirstAsync<StudentRow>('SELECT * FROM students WHERE id = ?', id);
    if (!existing) {
      this.log.warn('Delete requested for unknown student', { id });
      return;
    }
    const row = { ...existing, deleted: 1, updatedAt: Date.now() };
    await this.db.withTransactionAsync(async () => {
      await this.upsertRow(row);
      await this.enqueue(id, 'Delete', row);
    });
    this.log.info('Student deleted (soft)', { id });
  }

  async applyRemote(student: Student): Promise<boolean> {
    const local = await this.db.getFirstAsync<{ updatedAt: number }>(
      'SELECT updatedAt FROM students WHERE id = ?',
      student.id,
    );
    if (local && local.updatedAt >= student.updatedAt) return false; // локальна версія новіша
    await this.upsertRow(this.toRow(student));
    return true;
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
  decodePayload(item: SyncQueueItem): Student {
    return this.fromRow(JSON.parse(item.payloadJson) as StudentRow);
  }

  // ---------- helpers ----------

  private async enqueue(entityId: string, operation: SyncOperation, row: StudentRow) {
    // Згортаємо кілька змін одного запису в одну операцію — серверу потрібен лише фінальний стан.
    await this.db.runAsync('DELETE FROM sync_queue WHERE entityType = ? AND entityId = ?', 'Student', entityId);
    await this.db.runAsync(
      'INSERT INTO sync_queue (entityType, entityId, operation, payloadJson, createdAt) VALUES (?, ?, ?, ?, ?)',
      'Student',
      entityId,
      operation,
      JSON.stringify(row),
      Date.now(),
    );
  }

  private upsertRow(r: StudentRow) {
    return this.db.runAsync(
      `INSERT INTO students (id, fullName, "group", averageScore, documentNumberEnc, updatedAt, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         fullName = excluded.fullName, "group" = excluded."group", averageScore = excluded.averageScore,
         documentNumberEnc = excluded.documentNumberEnc, updatedAt = excluded.updatedAt, deleted = excluded.deleted`,
      r.id,
      r.fullName,
      r.group,
      r.averageScore,
      r.documentNumberEnc,
      r.updatedAt,
      r.deleted,
    );
  }

  private toRow(s: Student): StudentRow {
    return {
      id: s.id,
      fullName: s.fullName,
      group: s.group,
      averageScore: s.averageScore,
      documentNumberEnc: this.crypto.encrypt(s.documentNumber),
      updatedAt: s.updatedAt,
      deleted: s.deleted ? 1 : 0,
    };
  }

  private fromRow(r: StudentRow): Student {
    let documentNumber = '';
    try {
      documentNumber = this.crypto.decrypt(r.documentNumberEnc);
    } catch (e) {
      this.log.warn('Could not decrypt documentNumber', { id: r.id });
    }
    return {
      id: r.id,
      fullName: r.fullName,
      group: r.group,
      averageScore: r.averageScore,
      documentNumber,
      updatedAt: r.updatedAt,
      deleted: r.deleted === 1,
    };
  }
}
