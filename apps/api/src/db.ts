import { DatabaseSync } from 'node:sqlite';

/**
 * Серверна БД (node:sqlite) з міграціями через PRAGMA user_version — той самий прийом,
 * що й у мобільному застосунку (лаб. 4). Старі міграції ніколи не редагуються.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS students (
        id             TEXT PRIMARY KEY,
        fullName       TEXT NOT NULL,
        "group"        TEXT NOT NULL DEFAULT '',
        averageScore   REAL NOT NULL DEFAULT 0,
        documentNumber TEXT NOT NULL DEFAULT '',
        updatedAt      INTEGER NOT NULL,
        deleted        INTEGER NOT NULL DEFAULT 0
      );`,
  },
  {
    // v2: облікові записи, сесії та завдання користувача.
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        email        TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        fullName     TEXT NOT NULL,
        "group"      TEXT NOT NULL,
        studentCard  TEXT NOT NULL,
        createdAt    INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        tokenHash TEXT PRIMARY KEY,
        userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assignments (
        id          TEXT PRIMARY KEY,
        userId      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        subject     TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        dueAt       INTEGER NOT NULL,
        done        INTEGER NOT NULL DEFAULT 0,
        grade       REAL,
        updatedAt   INTEGER NOT NULL,
        deleted     INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments(userId, updatedAt);`,
  },
  {
    // v3: чат групи (кімната = академічна група).
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS messages (
        id        TEXT PRIMARY KEY,
        room      TEXT NOT NULL,
        userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author    TEXT NOT NULL,
        text      TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room, createdAt);`,
  },
  {
    // v4: реакції на повідомлення (одна реакція від користувача на повідомлення).
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS reactions (
        messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji     TEXT NOT NULL,
        PRIMARY KEY (messageId, userId)
      );`,
  },
];

export function openDatabase(path = process.env.DB_PATH ?? 'student-hub.db') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (const m of MIGRATIONS) {
    if (m.version <= user_version) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

// ---------------- Users & sessions ----------------

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  group: string;
  studentCard: string;
  createdAt: number;
}

export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export const toPublicUser = ({ passwordHash: _, ...u }: UserRecord): PublicUser => u;

export class UserStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  byEmail(email: string): UserRecord | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRecord | undefined;
  }

  byId(id: string): UserRecord | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRecord | undefined;
  }

  insert(u: UserRecord): void {
    this.db
      .prepare(
        `INSERT INTO users (id, email, passwordHash, fullName, "group", studentCard, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(u.id, u.email, u.passwordHash, u.fullName, u.group, u.studentCard, u.createdAt);
  }

  updateProfile(id: string, fields: { fullName: string; group: string }): void {
    this.db.prepare('UPDATE users SET fullName = ?, "group" = ? WHERE id = ?').run(fields.fullName, fields.group, id);
  }

  createSession(tokenHash: string, userId: string, ttlMs: number): void {
    const now = Date.now();
    this.db
      .prepare('INSERT INTO sessions (tokenHash, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
      .run(tokenHash, userId, now, now + ttlMs);
  }

  /** Повертає користувача для дійсної (не простроченої) сесії. */
  bySession(tokenHash: string): UserRecord | undefined {
    return this.db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId
         WHERE s.tokenHash = ? AND s.expiresAt > ?`,
      )
      .get(tokenHash, Date.now()) as UserRecord | undefined;
  }

  deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE tokenHash = ?').run(tokenHash);
  }
}

// ---------------- Assignments ----------------

/** Завдання студента. `updatedAt` (epoch ms) — основа last-write-wins під час синхронізації. */
export interface AssignmentRecord {
  id: string;
  title: string;
  subject: string;
  description: string;
  dueAt: number;
  done: boolean;
  grade: number | null;
  updatedAt: number;
  deleted: boolean;
}

type AssignmentRow = Omit<AssignmentRecord, 'done' | 'deleted'> & { userId: string; done: number; deleted: number };

const toAssignment = ({ userId: _, ...r }: AssignmentRow): AssignmentRecord => ({
  ...r,
  done: r.done === 1,
  deleted: r.deleted === 1,
});

export class AssignmentStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(userId: string, since = 0): AssignmentRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM assignments WHERE userId = ? AND updatedAt > ? ORDER BY dueAt')
        .all(userId, since) as unknown as AssignmentRow[]
    ).map(toAssignment);
  }

  /** Сирий рядок разом із власником — щоб перевірити, чи запис належить користувачу. */
  private row(id: string): AssignmentRow | undefined {
    return this.db.prepare('SELECT * FROM assignments WHERE id = ?').get(id) as AssignmentRow | undefined;
  }

  get(userId: string, id: string): AssignmentRecord | undefined | 'forbidden' {
    const r = this.row(id);
    if (!r) return undefined;
    return r.userId === userId ? toAssignment(r) : 'forbidden';
  }

  /**
   * Upsert з last-write-wins: запис застосовується, лише якщо він не старіший за серверний.
   * Повертає переможця (його клієнт і збереже).
   */
  upsert(userId: string, a: AssignmentRecord): { record: AssignmentRecord; applied: boolean } | 'forbidden' {
    const existing = this.get(userId, a.id);
    if (existing === 'forbidden') return 'forbidden';
    if (existing && existing.updatedAt > a.updatedAt) return { record: existing, applied: false };
    this.db
      .prepare(
        `INSERT INTO assignments (id, userId, title, subject, description, dueAt, done, grade, updatedAt, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, subject = excluded.subject, description = excluded.description,
           dueAt = excluded.dueAt, done = excluded.done, grade = excluded.grade,
           updatedAt = excluded.updatedAt, deleted = excluded.deleted`,
      )
      .run(a.id, userId, a.title, a.subject, a.description, a.dueAt, a.done ? 1 : 0, a.grade, a.updatedAt, a.deleted ? 1 : 0);
    return { record: a, applied: true };
  }
}

// ---------------- Chat ----------------

export interface ChatMessage {
  id: string;
  room: string;
  userId: string;
  author: string;
  text: string;
  createdAt: number;
  /** emoji → id користувачів, що поставили реакцію */
  reactions?: Record<string, string[]>;
}

export class ChatStore {
  private readonly db: DatabaseSync;
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  insert(m: ChatMessage): void {
    this.db
      .prepare('INSERT INTO messages (id, room, userId, author, text, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(m.id, m.room, m.userId, m.author, m.text, m.createdAt);
  }

  /** Останні `limit` повідомлень кімнати до `before` — у хронологічному порядку. */
  history(room: string, before = Number.MAX_SAFE_INTEGER, limit = 50): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE room = ? AND createdAt < ? ORDER BY createdAt DESC LIMIT ?')
      .all(room, before, limit) as unknown as ChatMessage[];
    return rows.reverse().map((m) => ({ ...m, reactions: this.reactions(m.id) }));
  }

  room(messageId: string): string | undefined {
    return (this.db.prepare('SELECT room FROM messages WHERE id = ?').get(messageId) as { room: string } | undefined)?.room;
  }

  /** Тогл реакції: та сама емодзі ще раз — зняти, інша — замінити. */
  toggleReaction(messageId: string, userId: string, emoji: string): Record<string, string[]> {
    const current = this.db.prepare('SELECT emoji FROM reactions WHERE messageId = ? AND userId = ?').get(messageId, userId) as
      | { emoji: string }
      | undefined;
    if (current?.emoji === emoji) {
      this.db.prepare('DELETE FROM reactions WHERE messageId = ? AND userId = ?').run(messageId, userId);
    } else {
      this.db
        .prepare('INSERT INTO reactions (messageId, userId, emoji) VALUES (?, ?, ?) ON CONFLICT(messageId, userId) DO UPDATE SET emoji = excluded.emoji')
        .run(messageId, userId, emoji);
    }
    return this.reactions(messageId);
  }

  reactions(messageId: string): Record<string, string[]> {
    const rows = this.db.prepare('SELECT emoji, userId FROM reactions WHERE messageId = ?').all(messageId) as unknown as {
      emoji: string;
      userId: string;
    }[];
    const out: Record<string, string[]> = {};
    for (const r of rows) (out[r.emoji] ??= []).push(r.userId);
    return out;
  }
}
