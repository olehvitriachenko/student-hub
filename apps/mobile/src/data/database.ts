import * as SQLite from 'expo-sqlite';

/**
 * Відкриття локальної БД та міграції схеми (лаб. 4).
 *
 * Версія схеми зберігається в PRAGMA user_version. При старті застосовуються
 * лише ті міграції, номер яких більший за поточну версію — послідовно.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS students (
        id             TEXT PRIMARY KEY NOT NULL,
        fullName       TEXT NOT NULL,
        "group"        TEXT NOT NULL DEFAULT '',
        averageScore   REAL NOT NULL DEFAULT 0
      );`,
  },
  {
    // v2: поля для синхронізації та зашифрований номер документа + черга офлайн-змін.
    version: 2,
    sql: `
      ALTER TABLE students ADD COLUMN documentNumberEnc TEXT NOT NULL DEFAULT '';
      ALTER TABLE students ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE students ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS sync_queue (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        entityType  TEXT NOT NULL,
        entityId    TEXT NOT NULL,
        operation   TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        createdAt   INTEGER NOT NULL,
        attempts    INTEGER NOT NULL DEFAULT 0
      );`,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function openDatabase(name = 'student-hub.db'): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
  }
}
