import type { SQLiteDatabase } from 'expo-sqlite';
import { ServiceContainer, ServiceKey } from './core/di/ServiceContainer';
import { ConsoleSink, LoggerFactory } from './core/logging/Logger';
import { RollingFileSink } from './core/logging/FileSink';
import { installGlobalErrorHandlers } from './core/logging/globalErrorHandler';
import { Messenger } from './core/mvvm/Messenger';
import { openDatabase } from './data/database';
import { SqliteStudentRepository, type IStudentRepository } from './data/StudentRepository';
import { ApiClient } from './services/ApiClient';
import { AppLifecycleService } from './services/AppLifecycleService';
import { AppStateService } from './services/AppStateService';
import { Analytics, SentrySink, initCrashReporting } from './services/CrashReporting';
import { AesCryptoService, type ICryptoService } from './services/CryptoService';
import { ExpoRouterNavigationService, type INavigationService } from './services/NavigationService';
import { AsyncStoragePreferences, type IPreferences } from './services/Preferences';
import { SyncService } from './services/SyncService';
import { ThemeService } from './services/ThemeService';
import { StudentViewModel } from './viewmodels/StudentViewModel';
import { StudentDetailViewModel } from './viewmodels/StudentDetailViewModel';
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
  StudentRepository: new ServiceKey<SqliteStudentRepository>('IStudentRepository'),
  Sync: new ServiceKey<SyncService>('SyncService'),
  Analytics: new ServiceKey<Analytics>('Analytics'),
  // ViewModels — transient: новий екземпляр на кожну сторінку
  StudentViewModel: new ServiceKey<StudentViewModel>('StudentViewModel'),
  StudentDetailViewModel: new ServiceKey<StudentDetailViewModel>('StudentDetailViewModel'),
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
    .addSingleton(
      Services.StudentRepository,
      (c) => new SqliteStudentRepository(c.get(Services.Database), c.get(Services.Crypto), log('StudentRepository')),
    )
    .addSingleton(
      Services.Sync,
      (c) =>
        new SyncService(
          c.get(Services.StudentRepository),
          c.get(Services.Api),
          c.get(Services.Preferences),
          c.get(Services.Messenger),
          log('SyncService'),
        ),
    )
    .addSingleton(Services.Analytics, () => {
      const a = log('Analytics');
      return new Analytics((name, props) => a.info(`Event: ${name}`, props));
    })
    .addTransient(
      Services.StudentViewModel,
      (c) =>
        new StudentViewModel(
          c.get(Services.StudentRepository) as IStudentRepository,
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          c.get(Services.Sync),
          c.get(Services.Preferences),
          c.get(Services.Lifecycle),
          c.get(Services.Analytics),
          log('StudentViewModel'),
        ),
    )
    .addTransient(
      Services.StudentDetailViewModel,
      (c) =>
        new StudentDetailViewModel(
          c.get(Services.StudentRepository) as IStudentRepository,
          c.get(Services.Navigation),
          c.get(Services.Messenger),
          c.get(Services.Sync),
          c.get(Services.Preferences),
          c.get(Services.Lifecycle),
          c.get(Services.AppState),
          log('StudentDetailViewModel'),
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

  // 4. Запуск фонових сервісів.
  await container.get(Services.Theme).load();
  container.get(Services.Lifecycle).start();
  container.get(Services.Sync).start();

  // Скидаємо лог на диск, коли застосунок іде у фон (Stopped) — далі ОС може його вбити.
  container.get(Services.Lifecycle).on((e) => (e === 'Stopped' ? loggerFactory.flush() : undefined));

  log('Bootstrap').info('Application started');
}
