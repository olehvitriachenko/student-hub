import { ObservableObject } from '../core/mvvm/ObservableObject';

/**
 * IAppStateService (лаб. 3): singleton у DI, тримає стан поточної сесії.
 * Живе, поки живе процес; для збереження між запусками — Preferences.
 */
export class AppStateService extends ObservableObject {
  readonly sessionStartedAt = Date.now();
  private _currentRoute = '/';
  private _screenViews = 0;

  get currentRoute() { return this._currentRoute; }
  get screenViews() { return this._screenViews; }

  setCurrentRoute(route: string) {
    if (this.setProperty('currentRoute', this._currentRoute, route, (v) => (this._currentRoute = v))) {
      this._screenViews++;
      this.onPropertyChanged('screenViews');
    }
  }
}
