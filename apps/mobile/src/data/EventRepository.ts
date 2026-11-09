import type { SQLiteDatabase } from 'expo-sqlite';
import type { ILogger } from '../core/logging/Logger';
import type { EventCategory, PlannerEvent } from '../models/PlannerEvent';
import type { ICryptoService } from '../services/CryptoService';

export interface IEventRepository {
  getRange(from: number, to: number): Promise<PlannerEvent[]>;
  getById(id: string): Promise<PlannerEvent | null>;
  save(e: PlannerEvent): Promise<void>;
  delete(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

interface EventRow {
  id: string;
  title: string;
  category: EventCategory;
  startAt: number;
  durationMin: number;
  noteEnc: string;
  remind: number;
  createdAt: number;
}

/** Події планувальника в SQLite. Нотатка шифрується тим самим AES-сервісом, що й завдання. */
export class SqliteEventRepository implements IEventRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly crypto: ICryptoService,
    private readonly log: ILogger,
  ) {}

  async getRange(from: number, to: number): Promise<PlannerEvent[]> {
    const rows = await this.db.getAllAsync<EventRow>('SELECT * FROM events WHERE startAt >= ? AND startAt < ? ORDER BY startAt', from, to);
    return rows.map((r) => this.fromRow(r));
  }

  async getById(id: string): Promise<PlannerEvent | null> {
    const row = await this.db.getFirstAsync<EventRow>('SELECT * FROM events WHERE id = ?', id);
    return row ? this.fromRow(row) : null;
  }

  async save(e: PlannerEvent): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO events (id, title, category, startAt, durationMin, noteEnc, remind, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, category = excluded.category, startAt = excluded.startAt,
         durationMin = excluded.durationMin, noteEnc = excluded.noteEnc, remind = excluded.remind`,
      e.id,
      e.title,
      e.category,
      e.startAt,
      e.durationMin,
      this.crypto.encrypt(e.note),
      e.remind ? 1 : 0,
      e.createdAt,
    );
    this.log.info('Event saved', { id: e.id, category: e.category });
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM events WHERE id = ?', id);
    this.log.info('Event deleted', { id });
  }

  async clearAll(): Promise<void> {
    await this.db.runAsync('DELETE FROM events');
  }

  private fromRow(r: EventRow): PlannerEvent {
    let note = '';
    try {
      note = this.crypto.decrypt(r.noteEnc);
    } catch {
      this.log.warn('Could not decrypt event note', { id: r.id });
    }
    return { id: r.id, title: r.title, category: r.category, startAt: r.startAt, durationMin: r.durationMin, note, remind: r.remind === 1, createdAt: r.createdAt };
  }
}
