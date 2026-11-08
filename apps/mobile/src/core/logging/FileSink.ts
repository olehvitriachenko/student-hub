import { Directory, File, Paths } from 'expo-file-system';
import { LogLevel, type LogEntry, type LogSink } from './Logger';

/**
 * Файловий sink із щоденною ротацією (лаб. 5) — аналог
 * `WriteTo.File("logs/app-.log", rollingInterval: Day, retainedFileCountLimit: 7)`.
 *
 * Формат — JSON Lines (один запис на рядок), щоб екран логів міг парсити й фільтрувати.
 * Записи буферизуються й скидаються на диск раз на 2 с; Error/Critical — одразу.
 */
export class RollingFileSink implements LogSink {
  readonly dir: Directory;
  private buffer: string[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly retainedFileCountLimit = 7,
    private readonly flushIntervalMs = 2000,
  ) {
    this.dir = new Directory(Paths.document, 'logs');
    try {
      if (!this.dir.exists) this.dir.create();
      this.applyRetention();
    } catch {
      // файлова система недоступна (наприклад, web) — працюємо лише з консоллю
    }
  }

  emit(entry: LogEntry): void {
    this.buffer.push(JSON.stringify(entry));
    if (entry.level >= LogLevel.Error) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
  }

  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.buffer.length === 0) return this.writing;
    const chunk = this.buffer.join('\n') + '\n';
    this.buffer = [];
    // Послідовні записи, щоб рядки не перемішувались.
    this.writing = this.writing.then(() => this.append(chunk)).catch(() => undefined);
    return this.writing;
  }

  /** Файли логів, найновіші першими. */
  files(): File[] {
    if (!this.dir.exists) return [];
    return this.dir
      .list()
      .filter((f): f is File => f instanceof File && /^app-\d{8}\.log$/.test(f.name))
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  /** Останні N записів з файлів (для екрана перегляду логів). */
  async readRecent(limit = 200): Promise<LogEntry[]> {
    await this.flush();
    const result: LogEntry[] = [];
    for (const file of this.files()) {
      const lines = (await file.text()).split('\n').filter(Boolean).reverse();
      for (const line of lines) {
        try {
          result.push(JSON.parse(line) as LogEntry);
        } catch {
          // пошкоджений рядок — пропускаємо
        }
        if (result.length >= limit) return result;
      }
    }
    return result;
  }

  clear(): void {
    this.files().forEach((f) => f.delete());
  }

  private async append(chunk: string) {
    const file = new File(this.dir, `app-${dateStamp(new Date())}.log`);
    if (!file.exists) {
      file.create();
      this.applyRetention();
    }
    await file.write(chunk, { append: true });
  }

  private applyRetention() {
    this.files()
      .slice(this.retainedFileCountLimit)
      .forEach((f) => f.delete());
  }
}

function dateStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
