import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import { simulateUnhandledException, simulateUnhandledRejection } from '../core/logging/globalErrorHandler';
import type { AppLifecycleService } from '../services/AppLifecycleService';
import type { AppStateService } from '../services/AppStateService';
import { crashReportingEnabled, nativeCrash } from '../services/CrashReporting';
import type { INavigationService } from '../services/NavigationService';
import type { SyncService } from '../services/SyncService';
import type { ThemePreference, ThemeService } from '../services/ThemeService';

/** Екран «Синхронізація та діагностика»: стан черги (лаб. 4), життєвий цикл (лаб. 3), діагностика (лаб. 5). */
export class SettingsViewModel extends ViewModelBase {
  readonly setThemeCommand: Command<ThemePreference>;
  readonly syncNowCommand: Command;
  readonly openLogsCommand: Command;
  readonly simulateExceptionCommand: Command;
  readonly simulateRejectionCommand: Command;
  readonly nativeCrashCommand: Command;
  readonly crashReportingEnabled = crashReportingEnabled;

  constructor(
    readonly theme: ThemeService,
    readonly sync: SyncService,
    readonly lifecycle: AppLifecycleService,
    readonly appState: AppStateService,
    navigation: INavigationService,
    private readonly log: ILogger,
  ) {
    super();
    this.setThemeCommand = new Command<ThemePreference>((t) => theme.setPreference(t), (t) => t !== theme.preference);
    this.syncNowCommand = new Command(() => sync.sync(), () => !sync.isSyncing);
    this.openLogsCommand = new Command(() => navigation.goTo('/logs'));
    this.simulateExceptionCommand = new Command(() => {
      this.log.warn('Simulating unhandled exception');
      simulateUnhandledException();
    });
    this.simulateRejectionCommand = new Command(() => {
      this.log.warn('Simulating unhandled promise rejection');
      simulateUnhandledRejection();
    });
    this.nativeCrashCommand = new Command(() => nativeCrash(), () => crashReportingEnabled);

    // Пробрасуємо зміни сервісів як PropertyChanged цієї ViewModel.
    for (const source of [theme, sync, lifecycle, appState]) {
      this.track(
        source.subscribe((p) => {
          this.onPropertyChanged(p);
          this.setThemeCommand.raiseCanExecuteChanged();
          this.syncNowCommand.raiseCanExecuteChanged();
        }),
      );
    }
  }

  get sessionDuration(): string {
    const s = Math.floor((Date.now() - this.appState.sessionStartedAt) / 1000);
    return `${Math.floor(s / 60)} хв ${s % 60} с`;
  }
}
