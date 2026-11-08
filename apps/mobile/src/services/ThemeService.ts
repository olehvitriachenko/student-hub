import { Appearance } from 'react-native';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { IPreferences } from './Preferences';
import type { ILogger } from '../core/logging/Logger';

/**
 * Перемикання теми (лаб. 3) — аналог Application.Current.UserAppTheme.
 * Appearance.setColorScheme застосовує тему до всіх екранів одразу,
 * вибір зберігається в Preferences.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'settings.theme';

export class ThemeService extends ObservableObject {
  private _preference: ThemePreference = 'system';

  constructor(
    private readonly prefs: IPreferences,
    private readonly log: ILogger,
  ) {
    super();
  }

  get preference() {
    return this._preference;
  }

  async load(): Promise<void> {
    const saved = (await this.prefs.get(KEY)) as ThemePreference | null;
    this.apply(saved ?? 'system');
  }

  async setPreference(value: ThemePreference): Promise<void> {
    if (!this.apply(value)) return;
    await this.prefs.set(KEY, value);
    this.log.info('Theme changed', { theme: value });
  }

  private apply(value: ThemePreference): boolean {
    // 'unspecified' повертає керування системі.
    Appearance.setColorScheme(value === 'system' ? 'unspecified' : value);
    return this.setProperty('preference', this._preference, value, (v) => (this._preference = v));
  }
}
