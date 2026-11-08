import { ObservableObject } from '../core/mvvm/ObservableObject';

/**
 * IAppStateService (лаб. 3): singleton у DI, тримає стан поточної сесії.
 * Живе, поки живе процес; для збереження між запусками — Preferences.
 */
export class AppStateService extends ObservableObject {
  readonly sessionStartedAt = Date.now();
  private _currentRoute = '/';
  private _screenViews = 0;
  private _selectedStudentId: string | null = null;

  get currentRoute() { return this._currentRoute; }
  get screenViews() { return this._screenViews; }
  get selectedStudentId() { return this._selectedStudentId; }

  setCurrentRoute(route: string) {
    if (this.setProperty('currentRoute', this._currentRoute, route, (v) => (this._currentRoute = v))) {
      this._screenViews++;
      this.onPropertyChanged('screenViews');
    }
  }

  setSelectedStudent(id: string | null) {
    this.setProperty('selectedStudentId', this._selectedStudentId, id, (v) => (this._selectedStudentId = v));
  }
}
