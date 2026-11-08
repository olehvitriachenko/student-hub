import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { AppLifecycleService } from '../services/AppLifecycleService';
import type { AppStateService } from '../services/AppStateService';
import type { ThemePreference, ThemeService } from '../services/ThemeService';

/** Екран налаштувань: тема оформлення, стан сесії та журнал життєвого циклу (лаб. 3). */
export class SettingsViewModel extends ViewModelBase {
  readonly setThemeCommand: Command<ThemePreference>;

  constructor(
    readonly theme: ThemeService,
    readonly lifecycle: AppLifecycleService,
    readonly appState: AppStateService,
    log: ILogger,
  ) {
    super();
    this.setThemeCommand = new Command<ThemePreference>((t) => theme.setPreference(t), (t) => t !== theme.preference);
    log.debug('Settings opened');

    // Пробрасуємо зміни сервісів як PropertyChanged цієї ViewModel.
    for (const source of [theme, lifecycle, appState]) {
      this.track(
        source.subscribe((p) => {
          this.onPropertyChanged(p);
          this.setThemeCommand.raiseCanExecuteChanged();
        }),
      );
    }
  }

  get sessionDuration(): string {
    const s = Math.floor((Date.now() - this.appState.sessionStartedAt) / 1000);
    return `${Math.floor(s / 60)} хв ${s % 60} с`;
  }
}
