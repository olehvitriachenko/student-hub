import * as SecureStore from 'expo-secure-store';
import { ObservableObject } from '../core/mvvm/ObservableObject';
import type { ILogger } from '../core/logging/Logger';
import type { AuthResponse, User } from '../models/User';
import { ApiError, type ApiClient } from './ApiClient';
import type { IPreferences } from './Preferences';

const TOKEN_KEY = 'student_hub_session_token';
const USER_KEY = 'auth.user';

/**
 * Сесія користувача (singleton у DI).
 *
 * - Токен сесії зберігається в SecureStore (Keychain / Keystore), а не в AsyncStorage.
 * - Профіль кешується в Preferences, тож застосунок відкривається одразу й офлайн.
 * - Після старту профіль тихо оновлюється з сервера; 401 → вихід з акаунта.
 */
export class AuthService extends ObservableObject {
  private _user: User | null = null;
  private readonly signOutHandlers = new Set<() => Promise<void> | void>();
  private readonly signInHandlers = new Set<() => void>();

  constructor(
    private readonly api: ApiClient,
    private readonly prefs: IPreferences,
    private readonly log: ILogger,
  ) {
    super();
    api.onUnauthorized = () => {
      if (!this._user) return;
      this.log.warn('Session expired (401), signing out');
      void this.signOut(false);
    };
  }

  get user() { return this._user; }
  get isAuthenticated() { return this._user !== null; }

  /** Підписка на вихід з акаунта (наприклад, очистити локальну БД). */
  onSignOut(handler: () => Promise<void> | void): () => void {
    this.signOutHandlers.add(handler);
    return () => this.signOutHandlers.delete(handler);
  }

  /** Підписка на вхід (наприклад, запустити синхронізацію). */
  onSignIn(handler: () => void): () => void {
    this.signInHandlers.add(handler);
    return () => this.signInHandlers.delete(handler);
  }

  /** Відновлення сесії при запуску застосунку. */
  async restore(): Promise<void> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const cached = await this.prefs.getJson<User>(USER_KEY);
    if (!token || !cached) return;
    this.api.setToken(token);
    this.setUser(cached);
    this.log.info('Session restored', { userId: cached.id });
    void this.refreshProfile();
  }

  /** Чи вільний email — для першого кроку реєстрації. */
  async isEmailAvailable(email: string): Promise<boolean> {
    return (await this.api.checkEmail(email.trim())).available;
  }

  async login(email: string, password: string): Promise<void> {
    await this.applyAuth(await this.api.login(email.trim(), password));
    this.log.info('Signed in');
  }

  async register(input: { email: string; password: string; fullName: string; group: string }): Promise<void> {
    await this.applyAuth(await this.api.register(input));
    this.log.info('Account registered');
  }

  async updateProfile(fields: { fullName: string; group: string }): Promise<void> {
    const user = await this.api.updateMe(fields);
    await this.prefs.setJson(USER_KEY, user);
    this.setUser(user);
    this.log.info('Profile updated');
  }

  async refreshProfile(): Promise<void> {
    try {
      const user = await this.api.me();
      await this.prefs.setJson(USER_KEY, user);
      this.setUser(user);
    } catch (e) {
      if (!(e instanceof ApiError)) this.log.debug('Profile refresh skipped: offline');
    }
  }

  /** @param notifyServer false — коли сервер уже відхилив токен (401). */
  async signOut(notifyServer = true): Promise<void> {
    if (notifyServer) await this.api.logout().catch(() => undefined);
    this.api.setToken(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await this.prefs.remove(USER_KEY);
    for (const h of this.signOutHandlers) await h();
    this.setUser(null);
    this.log.info('Signed out');
  }

  private async applyAuth({ token, user }: AuthResponse) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await this.prefs.setJson(USER_KEY, user);
    this.api.setToken(token);
    this.setUser(user);
    this.signInHandlers.forEach((h) => h());
  }

  private setUser(user: User | null) {
    if (this.setProperty('user', this._user, user, (v) => (this._user = v))) {
      this.onPropertyChanged('isAuthenticated');
    }
  }
}
