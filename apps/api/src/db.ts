import { DatabaseSync } from 'node:sqlite';

/** Server-side Student record. `updatedAt` (epoch ms) drives last-write-wins conflict resolution. */
export interface StudentRecord {
  id: string;
  fullName: string;
  group: string;
  averageScore: number;
  documentNumber: string;
  updatedAt: number;
  deleted: boolean;
}

type Row = Omit<StudentRecord, 'deleted'> & { deleted: number };

const SCHEMA_VERSION = 1;

export function openDatabase(path = process.env.DB_PATH ?? 'student-hub.db') {
  const db = new DatabaseSync(path);
  migrate(db);
  return db;
}

/** Schema versioning via PRAGMA user_version — the same technique the mobile app uses (lab 4). */
function migrate(db: DatabaseSync) {
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (user_version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS students (
        id             TEXT PRIMARY KEY,
        fullName       TEXT NOT NULL,
        "group"        TEXT NOT NULL DEFAULT '',
        averageScore   REAL NOT NULL DEFAULT 0,
        documentNumber TEXT NOT NULL DEFAULT '',
        updatedAt      INTEGER NOT NULL,
        deleted        INTEGER NOT NULL DEFAULT 0
      );
    `);
  }
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

const toRecord = (r: Row): StudentRecord => ({ ...r, deleted: r.deleted === 1 });

export class StudentStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(since = 0): StudentRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM students WHERE updatedAt > ? ORDER BY fullName')
        .all(since) as unknown as Row[]
    ).map(toRecord);
  }

  get(id: string): StudentRecord | undefined {
    const row = this.db.prepare('SELECT * FROM students WHERE id = ?').get(id) as Row | undefined;
    return row ? toRecord(row) : undefined;
  }

  /**
   * Upsert with last-write-wins: the incoming record is applied only if it is
   * at least as new as what the server already has. Returns the winning record.
   */
  upsert(incoming: StudentRecord): { record: StudentRecord; applied: boolean } {
    const existing = this.get(incoming.id);
    if (existing && existing.updatedAt > incoming.updatedAt) {
      return { record: existing, applied: false };
    }
    this.db
      .prepare(
        `INSERT INTO students (id, fullName, "group", averageScore, documentNumber, updatedAt, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           fullName = excluded.fullName, "group" = excluded."group",
           averageScore = excluded.averageScore, documentNumber = excluded.documentNumber,
           updatedAt = excluded.updatedAt, deleted = excluded.deleted`,
      )
      .run(
        incoming.id,
        incoming.fullName,
        incoming.group,
        incoming.averageScore,
        incoming.documentNumber,
        incoming.updatedAt,
        incoming.deleted ? 1 : 0,
      );
    return { record: incoming, applied: true };
  }
}
