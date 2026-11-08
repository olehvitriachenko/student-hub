/**
 * Структуроване логування (лаб. 5) — аналог ILogger<T> + Serilog sinks.
 *
 * Logger розсилає кожен запис у набір "приймачів" (sinks): консоль, файл,
 * crash-репортер. Мінімальний рівень: Debug у dev-збірці, Information у production.
 */
export enum LogLevel {
  Trace = 0,
  Debug = 1,
  Information = 2,
  Warning = 3,
  Error = 4,
  Critical = 5,
}

export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.Trace]: 'TRC',
  [LogLevel.Debug]: 'DBG',
  [LogLevel.Information]: 'INF',
  [LogLevel.Warning]: 'WRN',
  [LogLevel.Error]: 'ERR',
  [LogLevel.Critical]: 'CRT',
};

export interface LogEntry {
  /** epoch ms */
  t: number;
  level: LogLevel;
  /** Категорія — аналог T у ILogger<T>. */
  ctx: string;
  msg: string;
  props?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export interface LogSink {
  emit(entry: LogEntry): void;
  flush?(): Promise<void>;
}

export interface ILogger {
  trace(msg: string, props?: Record<string, unknown>): void;
  debug(msg: string, props?: Record<string, unknown>): void;
  info(msg: string, props?: Record<string, unknown>): void;
  warn(msg: string, props?: Record<string, unknown>): void;
  error(error: unknown, msg: string, props?: Record<string, unknown>): void;
  critical(error: unknown, msg: string, props?: Record<string, unknown>): void;
}

export function serializeError(error: unknown): LogEntry['error'] {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: 'NonError', message: String(error) };
}

export class LoggerFactory {
  private readonly sinks: LogSink[] = [];

  constructor(public minimumLevel: LogLevel = __DEV__ ? LogLevel.Debug : LogLevel.Information) {}

  writeTo(sink: LogSink): this {
    this.sinks.push(sink);
    return this;
  }

  /** Аналог ILogger<T>: `factory.createLogger('StudentRepository')`. */
  createLogger(category: string): ILogger {
    const write = (level: LogLevel, msg: string, props?: Record<string, unknown>, error?: unknown) => {
      if (level < this.minimumLevel) return;
      const entry: LogEntry = { t: Date.now(), level, ctx: category, msg, props };
      if (error !== undefined) entry.error = serializeError(error);
      for (const sink of this.sinks) {
        try {
          sink.emit(entry);
        } catch {
          // Логер ніколи не повинен валити застосунок.
        }
      }
    };
    return {
      trace: (m, p) => write(LogLevel.Trace, m, p),
      debug: (m, p) => write(LogLevel.Debug, m, p),
      info: (m, p) => write(LogLevel.Information, m, p),
      warn: (m, p) => write(LogLevel.Warning, m, p),
      error: (e, m, p) => write(LogLevel.Error, m, p, e),
      critical: (e, m, p) => write(LogLevel.Critical, m, p, e),
    };
  }

  async flush(): Promise<void> {
    await Promise.all(this.sinks.map((s) => s.flush?.()));
  }
}

/** Форматування рядка для консолі / екрана логів. */
export function formatEntry(e: LogEntry): string {
  const time = new Date(e.t).toISOString().slice(11, 23);
  const props = e.props ? ' ' + JSON.stringify(e.props) : '';
  const err = e.error ? `\n  ${e.error.name}: ${e.error.message}` : '';
  return `${time} [${LOG_LEVEL_NAMES[e.level]}] ${e.ctx}: ${e.msg}${props}${err}`;
}

export class ConsoleSink implements LogSink {
  emit(e: LogEntry) {
    const line = formatEntry(e);
    if (e.level >= LogLevel.Error) console.error(line);
    else if (e.level === LogLevel.Warning) console.warn(line);
    else console.log(line);
  }
}
