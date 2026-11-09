import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import { userMessage } from '../services/ApiClient';
import type { AuthService } from '../services/AuthService';
import type { Analytics } from '../services/CrashReporting';
import type { INavigationService } from '../services/NavigationService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Головний екран для гостя: дві дії — створити акаунт або увійти. */
export class WelcomeViewModel extends ViewModelBase {
  readonly openRegisterCommand: Command;
  readonly openLoginCommand: Command;

  constructor(navigation: INavigationService) {
    super();
    this.openRegisterCommand = new Command(() => navigation.goTo('/register'));
    this.openLoginCommand = new Command(() => navigation.goTo('/login'));
  }
}

/**
 * Екран входу. Після успішного входу навігацію робить кореневий layout:
 * AuthService.isAuthenticated змінюється → Stack.Protected показує вкладки.
 */
export class LoginViewModel extends ViewModelBase {
  private _email = '';
  private _password = '';
  private _error: string | null = null;

  readonly loginCommand: Command;
  readonly backCommand: Command;
  readonly openRegisterCommand: Command;

  constructor(
    private readonly auth: AuthService,
    navigation: INavigationService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.loginCommand = new Command(() => this.login(), () => this._email.trim().length > 0 && this._password.length > 0);
    this.backCommand = new Command(() => navigation.goBack());
    this.openRegisterCommand = new Command(() => navigation.goTo('/register'));
  }

  get email() { return this._email; }
  set email(v: string) { this.setField('email', this._email, v, (x) => (this._email = x)); }

  get password() { return this._password; }
  set password(v: string) { this.setField('password', this._password, v, (x) => (this._password = x)); }

  get error() { return this._error; }

  private async login() {
    if (!EMAIL_RE.test(this._email.trim())) return this.setError('Некоректний email');
    this.setError(null);
    try {
      await this.auth.login(this._email, this._password);
      this.analytics.trackEvent('Login');
    } catch (e) {
      this.log.warn('Login failed', { reason: userMessage(e) });
      this.setError(userMessage(e));
    }
  }

  private setField(name: string, current: string, next: string, assign: (v: string) => void) {
    if (this.setProperty(name, current, next, assign)) {
      this.setError(null);
      this.loginCommand.raiseCanExecuteChanged();
    }
  }

  private setError(e: string | null) {
    this.setProperty('error', this._error, e, (v) => (this._error = v));
  }
}

export type RegisterStep = 1 | 2 | 3;

const STEP_TEXT: Record<RegisterStep, { title: string; subtitle: string; action: string }> = {
  1: { title: 'Ваш email', subtitle: 'Він буде логіном до кабінету.', action: 'Далі' },
  2: { title: 'Придумайте пароль', subtitle: 'Пароль зберігається лише у вигляді хешу Argon2.', action: 'Далі' },
  3: { title: 'Розкажіть про себе', subtitle: 'За групою ми підтягнемо ваш розклад.', action: 'Створити акаунт' },
};

/**
 * Реєстрація у 3 кроки (візард): email → пароль → ПІБ і група.
 * Кожен крок валідується перед переходом; email перевіряється на сервері вже на першому кроці.
 */
export class RegisterViewModel extends ViewModelBase {
  private readonly fields = { email: '', password: '', confirm: '', fullName: '', group: '' };
  private _step: RegisterStep = 1;
  private _error: string | null = null;

  readonly totalSteps = 3;
  readonly nextCommand: Command;
  readonly backCommand: Command;
  readonly openLoginCommand: Command;

  constructor(
    private readonly auth: AuthService,
    private readonly navigation: INavigationService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.nextCommand = new Command(() => this.next(), () => this.stepFilled);
    this.backCommand = new Command(() => (this._step > 1 ? this.setStep((this._step - 1) as RegisterStep) : navigation.goBack()));
    this.openLoginCommand = new Command(() => navigation.goTo('/login'));
  }

  get step() { return this._step; }
  get stepText() { return STEP_TEXT[this._step]; }
  get error() { return this._error; }

  get email() { return this.fields.email; }
  set email(v: string) { this.setField('email', v); }
  get password() { return this.fields.password; }
  set password(v: string) { this.setField('password', v); }
  get confirm() { return this.fields.confirm; }
  set confirm(v: string) { this.setField('confirm', v); }
  get fullName() { return this.fields.fullName; }
  set fullName(v: string) { this.setField('fullName', v); }
  get group() { return this.fields.group; }
  set group(v: string) { this.setField('group', v.toUpperCase()); }

  /** Чек-лист вимог до пароля (OneWay-прив'язка, оновлюється під час введення). */
  get passwordChecks(): { label: string; ok: boolean }[] {
    const { password: p, confirm } = this.fields;
    return [
      { label: 'Щонайменше 8 символів', ok: p.length >= 8 },
      { label: 'Літери та цифри', ok: /\d/.test(p) && /\p{L}/u.test(p) },
      { label: 'Паролі збігаються', ok: p.length > 0 && p === confirm },
    ];
  }

  private get stepFilled(): boolean {
    const f = this.fields;
    if (this._step === 1) return !!f.email.trim();
    if (this._step === 2) return !!f.password && !!f.confirm;
    return !!f.fullName.trim() && !!f.group.trim();
  }

  private async next() {
    this.setError(null);
    if (this._step === 1) return this.submitEmail();
    if (this._step === 2) {
      if (!this.passwordChecks.every((c) => c.ok)) return this.setError('Пароль не відповідає вимогам');
      return this.setStep(3);
    }
    return this.register();
  }

  private async submitEmail() {
    const email = this.fields.email.trim();
    if (!EMAIL_RE.test(email)) return this.setError('Некоректний email');
    try {
      if (!(await this.auth.isEmailAvailable(email))) return this.setError('Цей email уже зареєстровано — увійдіть');
      this.setStep(2);
    } catch (e) {
      this.setError(userMessage(e));
    }
  }

  private async register() {
    const { fullName, group, email, password } = this.fields;
    if (fullName.trim().split(/\s+/).length < 2) return this.setError('Вкажіть прізвище та ім’я');
    try {
      await this.auth.register({ fullName, group, email, password });
      this.analytics.trackEvent('SignUp', { group });
    } catch (e) {
      this.log.warn('Registration failed', { reason: userMessage(e) });
      this.setError(userMessage(e));
    }
  }

  private setStep(step: RegisterStep) {
    if (this.setProperty('step', this._step, step, (v) => (this._step = v))) {
      this.onPropertyChanged('stepText');
      this.setError(null);
      this.nextCommand.raiseCanExecuteChanged();
    }
  }

  private setField(name: keyof typeof this.fields, v: string) {
    if (this.setProperty(name, this.fields[name], v, (x) => (this.fields[name] = x))) {
      this.setError(null);
      if (name === 'password' || name === 'confirm') this.onPropertyChanged('passwordChecks');
      this.nextCommand.raiseCanExecuteChanged();
    }
  }

  private setError(e: string | null) {
    this.setProperty('error', this._error, e, (v) => (this._error = v));
  }
}
