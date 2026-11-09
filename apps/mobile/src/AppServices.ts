import type { SQLiteDatabase } from 'expo-sqlite';
import { ServiceContainer, ServiceKey } from './core/di/ServiceContainer';
import { ConsoleSink, LoggerFactory } from './core/logging/Logger';
import { RollingFileSink } from './core/logging/FileSink';
import { installGlobalErrorHandlers } from './core/logging/globalErrorHandler';
import { Messenger } from './core/mvvm/Messenger';
import { openDatabase } from './data/database';
import { SqliteAssignmentRepository } from './data/AssignmentRepository';
import { SqliteEventRepository } from './data/EventRepository';
import { ApiClient } from './services/ApiClient';
import { AppLifecycleService } from './services/AppLifecycleService';
import { AppStateService } from './services/AppStateService';
import { AuthService } from './services/AuthService';
import { ChatService } from './services/ChatService';
import { FocusService } from './services/FocusService';
import { Analytics, SentrySink, initCrashReporting } from './services/CrashReporting';
import { AesCryptoService, type ICryptoService } from './services/CryptoService';
import { ExpoRouterNavigationService, type INavigationService } from './services/NavigationService';
import { AsyncStoragePreferences, type IPreferences } from './services/Preferences';
import { ReminderService } from './services/ReminderService';
import { ScheduleService } from './services/ScheduleService';
import { SyncService } from './services/SyncService';
import { ThemeService } from './services/ThemeService';
import { LoginViewModel, RegisterViewModel, WelcomeViewModel } from './viewmodels/AuthViewModels';
import { ScheduleViewModel } from './viewmodels/ScheduleViewModel';
import { AssignmentsViewModel } from './viewmodels/AssignmentsViewModel';
import { AssignmentEditViewModel } from './viewmodels/AssignmentEditViewModel';
import { EventEditViewModel } from './viewmodels/EventEditViewModel';
import { ProfileViewModel } from './viewmodels/ProfileViewModel';
import { ChatViewModel } from './viewmodels/ChatViewModel';
import { FocusViewModel } from './viewmodels/FocusViewModel';
import { SettingsViewModel } from './viewmodels/SettingsViewModel';
import { LogsViewModel } from './viewmodels/LogsViewModel';

/**
 * Composition root — аналог MauiProgram.cs (лаб. 3).
 * Тут і лише тут вирішується, яка реалізація стоїть за кожним інтерфейсом.
 */
export const Services = {
  LoggerFactory: new ServiceKey<LoggerFactory>('LoggerFactory'),
  FileSink: new ServiceKey<RollingFileSink>('RollingFileSink'),
  Database: new ServiceKey<SQLiteDatabase>('SQLiteDatabase'),
  Crypto: new ServiceKey<ICryptoService>('ICryptoService'),
  Preferences: new ServiceKey<IPreferences>('IPreferences'),
  Messenger: new ServiceKey<Messenger>('Messenger'),
  Navigation: new ServiceKey<INavigationService>('INavigationService'),
  AppState: new ServiceKey<AppStateService>('IAppStateService'),
  Lifecycle: new ServiceKey<AppLifecycleService>('AppLifecycleService'),
  Theme: new ServiceKey<ThemeService>('ThemeService'),
  Api: new ServiceKey<ApiClient>('ApiClient'),
  Auth: new ServiceKey<AuthService>('AuthService'),
  Schedule: new ServiceKey<ScheduleService>('ScheduleService'),
  AssignmentRepository: new ServiceKey<SqliteAssignmentRepository>('IAssignmentRepository'),
  EventRepository: new ServiceKey<SqliteEventRepository>('IEventRepository'),
  Reminders: new ServiceKey<ReminderService>('ReminderService'),
  Sync: new ServiceKey<SyncService>('SyncService'),
  Chat: new ServiceKey<ChatService>('ChatService'),
  Focus: new ServiceKey<FocusService>('FocusService'),
  Analytics: new ServiceKey<Analytics>('Analytics'),
  // ViewModels — transient: новий екземпляр на кожну сторінку
  WelcomeViewModel: new ServiceKey<WelcomeViewModel>('WelcomeViewModel'),
  LoginViewModel: new ServiceKey<LoginViewModel>('LoginViewModel'),
  RegisterViewModel: new ServiceKey<RegisterViewModel>('RegisterViewModel'),
  ScheduleViewModel: new ServiceKey<ScheduleViewModel>('ScheduleViewModel'),
  AssignmentsViewModel: new ServiceKey<AssignmentsViewModel>('AssignmentsViewModel'),
  AssignmentEditViewModel: new ServiceKey<AssignmentEditViewModel>('AssignmentEditViewModel'),
  ProfileViewModel: new ServiceKey<ProfileViewModel>('ProfileViewModel'),
  EventEditViewModel: new ServiceKey<EventEditViewModel>('EventEditViewModel'),
  ChatViewModel: new ServiceKey<ChatViewModel>('ChatViewModel'),
  FocusViewModel: new ServiceKey<FocusViewModel>('FocusViewModel'),
  SettingsViewModel: new ServiceKey<SettingsViewModel>('SettingsViewModel'),
  LogsViewModel: new ServiceKey<LogsViewModel>('LogsViewModel'),
} as const;

export const container = new ServiceContainer();

let bootPromise: Promise<void> | null = null;

/** Ініціалізація застосунку. Ідемпотентна — безпечно викликати повторно (Fast Refresh). */
export function bootstrap(): Promise<void> {
  return (bootPromise ??= doBootstrap());
}

async function doBootstrap() {
  // 1. Логування та crash-репортинг — першими, щоб зловити помилки ініціалізації.
  initCrashReporting();
  const fileSink = new RollingFileSink(7);
  const loggerFactory = new LoggerFactory().writeTo(new ConsoleSink()).writeTo(fileSink).writeTo(new SentrySink());
  installGlobalErrorHandlers(loggerFactory);
  const log = (category: string) => loggerFactory.createLogger(category);
  log('Bootstrap').info('Application starting');

  // 2. Асинхронні залежності (БД, ключ шифрування) готуємо до реєстрації.
  const db = await openDatabase();
  const crypto = new AesCryptoService();
  await crypto.init();

  // 3. Реєстрація сервісів.
  container
    .addSingleton(Services.LoggerFactory, () => loggerFactory)
    .addSingleton(Services.FileSink, () => fileSink)
    .addSingleton(Services.Database, () => db)
    .addSingleton(Services.Crypto, () => crypto)
    .addSingleton(Services.Preferences, () => new AsyncStoragePreferences())
    .addSingleton(Services.Messenger, () => new Messenger())
    .addSingleton(Services.Navigation, () => new ExpoRouterNavigationService())
    .addSingleton(Services.AppState, () => new AppStateService())
    .addSingleton(Services.Lifecycle, () => new AppLifecycleService(log('AppLifecycle')))
    .addSingleton(Services.Theme, (c) => new ThemeService(c.get(Services.Preferences), log('ThemeService')))
    .addSingleton(Services.Api, () => new ApiClient())
    .addSingleton(Services.Auth, (c) => new AuthService(c.get(Services.Api), c.get(Services.Preferences), log('Auth')))
    .addSingleton(Services.Schedule, (c) => new ScheduleService(c.get(Services.Api), c.get(Services.Preferences), log('Schedule'), c.get(Services.Messenger)))
    .addSingleton(
      Services.AssignmentRepository,
      (c) => new SqliteAssignmentRepository(c.get(Services.Database), c.get(Services.Crypto), log('AssignmentRepository')),
    )
    .addSingleton(
      Services.EventRepository,
      (c) => new SqliteEventRepository(c.get(Services.Database), c.get(Services.Crypto), log('EventRepository')),
    )
    .addSingleton(
      Services.Reminders,
      (c) =>
        new ReminderService(
          c.get(Services.Schedule),
          c.get(Services.AssignmentRepository),
          c.get(Services.EventRepository),
          c.get(Services.Preferences),
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          log('Reminders'),
        ),
    )
    .addSingleton(
      Services.Sync,
      (c) =>
        new SyncService(
          c.get(Services.AssignmentRepository),
          c.get(Services.Api),
          c.get(Services.Preferences),
          c.get(Services.Messenger),
          log('SyncService'),
          () => c.get(Services.Auth).isAuthenticated,
        ),
    )
    .addSingleton(Services.Chat, (c) => new ChatService(c.get(Services.Api), log('Chat')))
    .addSingleton(Services.Focus, (c) => new FocusService(c.get(Services.Preferences), log('Focus')))
    .addTransient(
      Services.FocusViewModel,
      (c) =>
        new FocusViewModel(
          c.get(Services.Focus),
          c.get(Services.Reminders),
          c.get(Services.AssignmentRepository),
          c.get(Services.Navigation),
          c.get(Services.Analytics),
          log('FocusViewModel'),
        ),
    )
    .addTransient(Services.ChatViewModel, (c) => new ChatViewModel(c.get(Services.Chat), c.get(Services.Auth)))
    .addSingleton(Services.Analytics, () => {
      const a = log('Analytics');
      return new Analytics((name, props) => a.info(`Event: ${name}`, props));
    })
    .addTransient(Services.WelcomeViewModel, (c) => new WelcomeViewModel(c.get(Services.Navigation)))
    .addTransient(
      Services.LoginViewModel,
      (c) => new LoginViewModel(c.get(Services.Auth), c.get(Services.Navigation), c.get(Services.Analytics), log('LoginViewModel')),
    )
    .addTransient(
      Services.RegisterViewModel,
      (c) =>
        new RegisterViewModel(c.get(Services.Auth), c.get(Services.Navigation), c.get(Services.Analytics), log('RegisterViewModel')),
    )
    .addTransient(
      Services.ScheduleViewModel,
      (c) =>
        new ScheduleViewModel(
          c.get(Services.Schedule),
          c.get(Services.EventRepository),
          c.get(Services.Auth),
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          log('ScheduleViewModel'),
        ),
    )
    .addTransient(
      Services.AssignmentsViewModel,
      (c) =>
        new AssignmentsViewModel(
          c.get(Services.AssignmentRepository),
          c.get(Services.Sync),
          c.get(Services.Messenger),
          c.get(Services.Navigation),
          c.get(Services.Analytics),
          log('AssignmentsViewModel'),
        ),
    )
    .addTransient(
      Services.AssignmentEditViewModel,
      (c) =>
        new AssignmentEditViewModel(
          c.get(Services.AssignmentRepository),
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          c.get(Services.Sync),
          c.get(Services.Schedule),
          c.get(Services.Preferences),
          c.get(Services.Lifecycle),
          c.get(Services.Analytics),
          log('AssignmentEditViewModel'),
        ),
    )
    .addTransient(
      Services.ProfileViewModel,
      (c) =>
        new ProfileViewModel(
          c.get(Services.Auth),
          c.get(Services.AssignmentRepository),
          c.get(Services.Sync),
          c.get(Services.Theme),
          c.get(Services.Reminders),
          c.get(Services.Focus),
          c.get(Services.Schedule),
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          log('ProfileViewModel'),
        ),
    )
    .addTransient(
      Services.EventEditViewModel,
      (c) =>
        new EventEditViewModel(
          c.get(Services.EventRepository),
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          c.get(Services.Analytics),
          log('EventEditViewModel'),
        ),
    )
    .addTransient(
      Services.SettingsViewModel,
      (c) =>
        new SettingsViewModel(
          c.get(Services.Theme),
          c.get(Services.Sync),
          c.get(Services.Lifecycle),
          c.get(Services.AppState),
          c.get(Services.Navigation),
          log('SettingsViewModel'),
        ),
    )
    .addTransient(Services.LogsViewModel, (c) => new LogsViewModel(c.get(Services.FileSink), log('LogsViewModel')));

  // 4. Сесія: при виході стираємо локальні дані користувача, при вході — синхронізуємо.
  const auth = container.get(Services.Auth);
  const sync = container.get(Services.Sync);
  const reminders = container.get(Services.Reminders);
  await reminders.init();
  const chat = container.get(Services.Chat);
  const focus = container.get(Services.Focus);
  await focus.load();
  auth.onSignOut(() => chat.disconnect());
  auth.onSignOut(() => focus.clear());
  auth.onSignOut(() => reminders.disable());
  auth.onSignOut(() => container.get(Services.EventRepository).clearAll());
  auth.onSignOut(() => container.get(Services.AssignmentRepository).clearAll());
  auth.onSignOut(() => container.get(Services.Schedule).clear());
  auth.onSignOut(() => sync.reset());
  auth.onSignIn(() => {
    void sync.sync();
    void reminders.enable();
    chat.connect();
  });
  await auth.restore();
  if (auth.isAuthenticated) {
    void reminders.enable();
    chat.connect();
  }

  // 5. Запуск фонових сервісів.
  await container.get(Services.Theme).load();
  container.get(Services.Lifecycle).start();
  sync.start();

  // Скидаємо лог на диск, коли застосунок іде у фон (Stopped) — далі ОС може його вбити.
  container.get(Services.Lifecycle).on((e) => (e === 'Stopped' ? loggerFactory.flush() : undefined));

  log('Bootstrap').info('Application started');
}
