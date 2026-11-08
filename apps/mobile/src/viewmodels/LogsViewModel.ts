import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import { LogLevel, type ILogger, type LogEntry } from '../core/logging/Logger';
import type { RollingFileSink } from '../core/logging/FileSink';
import { crashReportingEnabled, sendUserReport } from '../services/CrashReporting';

/** Екран перегляду локальних логів із фільтрацією за рівнем (лаб. 5, п. 6). */
export class LogsViewModel extends ViewModelBase {
  private all: LogEntry[] = [];
  private _minLevel: LogLevel = LogLevel.Debug;
  private _status: string | null = null;

  readonly limit = 300;
  readonly loadCommand: Command;
  readonly setMinLevelCommand: Command<LogLevel>;
  readonly clearCommand: Command;
  readonly reportCommand: Command<string>;

  constructor(
    private readonly sink: RollingFileSink,
    private readonly log: ILogger,
  ) {
    super();
    this.loadCommand = new Command(() => this.load());
    this.setMinLevelCommand = new Command<LogLevel>((l) => {
      this.setProperty('minLevel', this._minLevel, l, (v) => (this._minLevel = v));
      this.onPropertyChanged('entries');
    });
    this.clearCommand = new Command(async () => {
      this.sink.clear();
      this.log.warn('Log files cleared by user');
      await this.load();
    });
    this.reportCommand = new Command<string>((comment) => this.report(comment));
  }

  get minLevel() { return this._minLevel; }
  get status() { return this._status; }
  get fileNames(): string[] { return this.sink.files().map((f) => f.name); }

  /** Відфільтровані записи (найновіші першими). */
  get entries(): LogEntry[] {
    return this.all.filter((e) => e.level >= this._minLevel);
  }

  override onAppearing() {
    this.loadCommand.execute();
  }

  private async load() {
    this.setBusy(true);
    try {
      this.all = await this.sink.readRecent(this.limit);
      this.onPropertyChanged('entries');
    } finally {
      this.setBusy(false);
    }
  }

  private async report(comment: string) {
    this.log.info('User submitted error report');
    const id = await sendUserReport(comment, this.all);
    const status = crashReportingEnabled
      ? `Звіт надіслано в Sentry (id: ${id})`
      : 'Sentry не налаштовано (EXPO_PUBLIC_SENTRY_DSN) — звіт записано лише в локальний лог';
    this.setProperty('status', this._status, status, (v) => (this._status = v));
  }
}
