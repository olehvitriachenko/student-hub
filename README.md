# Student Hub — «Особистий кабінет студента»

Мобільний застосунок на **React Native (Expo SDK 58, Expo Router)** з бекендом на **Fastify**.
Наскрізний проєкт для лабораторних робіт 1–5 з дисципліни «Мобільна розробка» (патерн **MVVM**).
Оригінальні завдання написані під .NET MAUI; тут кожне поняття MAUI реалізовано його відповідником у RN/TypeScript.

```
apps/
  mobile/   Expo-застосунок (TypeScript, MVVM)
  api/      Fastify REST API + SQLite (node:sqlite) — сервер синхронізації
```

## Запуск

Потрібен Node.js ≥ 22.6 (API запускає `.ts` напряму, без збірки).

```bash
npm run install:all          # встановити залежності обох застосунків
npm run api                  # API на http://0.0.0.0:3000
npm run mobile               # Metro; відкрийте в Expo Go / емуляторі
```

Телефон з Expo Go має бути в тій самій Wi-Fi мережі — адреса API визначається автоматично з IP Metro.
Інакше задайте `EXPO_PUBLIC_API_URL` у `apps/mobile/.env` (див. `.env.example`).

> `@sentry/react-native` (нативний краш) та SecureStore повноцінно працюють у **development build**
> (`npx expo run:android` / `run:ios`). У Expo Go решта застосунку працює, а нативний краш — ні.

Перевірки:

```bash
npm run typecheck            # tsc для api та mobile
npm test                     # інтеграційні тести API (node:test + fastify.inject)
```

## Відповідність MAUI → React Native

| .NET MAUI | Тут | Файл |
|---|---|---|
| `INotifyPropertyChanged`, `OnPropertyChanged` | `ObservableObject.setProperty` (з перевіркою рівності) | `src/core/mvvm/ObservableObject.ts` |
| `BindingContext`, `{Binding}` | `useViewModel` / `usePageViewModel` (`useSyncExternalStore`) | `src/core/mvvm/hooks.ts` |
| `Mode=TwoWay` | `bindText(vm, 'fullName')` | `src/core/mvvm/hooks.ts` |
| `ObservableCollection<T>` | `ObservableCollection<T>` | `src/core/mvvm/ObservableCollection.ts` |
| `ICommand`, `Command`, `CanExecute` | `Command<T>` + `CommandButton` | `src/core/mvvm/Command.ts`, `src/components/ui.tsx` |
| `WeakReferenceMessenger` | `Messenger` | `src/core/mvvm/Messenger.ts` |
| `AppShell`, `Routing.RegisterRoute` | файлові маршрути Expo Router | `src/app/_layout.tsx` |
| `Shell.Current.GoToAsync(route, params)` | `INavigationService.goTo` | `src/services/NavigationService.ts` |
| `IQueryAttributable` / `[QueryProperty]` | `applyQueryAttributes` / `useLocalSearchParams` | `src/viewmodels/StudentDetailViewModel.ts` |
| `MauiProgram.cs`, `AddSingleton/AddTransient` | `ServiceContainer` | `src/AppServices.ts`, `src/core/di/ServiceContainer.ts` |
| `Window.Stopped/Resumed/...` | `AppLifecycleService` (`AppState`) | `src/services/AppLifecycleService.ts` |
| `OnAppearing/OnDisappearing` | `useFocusEffect` → `vm.onAppearing()` | `src/core/mvvm/usePageViewModel.ts` |
| `Preferences` | `AsyncStoragePreferences` | `src/services/Preferences.ts` |
| `UserAppTheme` | `ThemeService` (`Appearance.setColorScheme`) | `src/services/ThemeService.ts` |
| App Links / deep link | схема `studenthub://students/<id>` | `app.json`, `src/app/students/[id].tsx` |
| `sqlite-net-pcl`, репозиторій | `expo-sqlite`, `SqliteStudentRepository` | `src/data/` |
| `PRAGMA user_version` міграції | `MIGRATIONS` | `src/data/database.ts` |
| SyncQueue + `HttpClient` | `sync_queue` + `SyncService` + `ApiClient` | `src/services/SyncService.ts` |
| AES-шифрування поля | `AesCryptoService` (ключ у SecureStore) | `src/services/CryptoService.ts` |
| `ILogger<T>` + Serilog sinks | `LoggerFactory` + `ConsoleSink` / `RollingFileSink` / `SentrySink` | `src/core/logging/` |
| `AppDomain.UnhandledException` / `UnobservedTaskException` | `ErrorUtils.setGlobalHandler` / Hermes rejection tracker | `src/core/logging/globalErrorHandler.ts` |
| App Center Crashes / Analytics | Sentry | `src/services/CrashReporting.ts` |

## Що реалізовано за лабораторними

**Лаб. 1 — MVVM і Data Binding.** Модель `Student` без залежностей від UI. `StudentViewModel` з властивостями, що сповіщають про зміни; обчислювані `greeting` (OneWay) і `isExcellent` (зелений колір при балі ≥ 4.0). `AddStudentCommand` блокує кнопку, поки ПІБ порожнє. Список — `FlatList` над `ObservableCollection`.

**Лаб. 2 — Команди та навігація.** `OpenDetailsCommand` передає цілий об'єкт `Student` на сторінку деталей через словник параметрів (`IQueryAttributable`). `GoBackCommand`. `SaveCommand` повертає оновлений запис двома способами: через `goBack({ UpdatedStudent })` і через `Messenger` (`StudentUpdated`). Список оновлюється без перезапуску.

**Лаб. 3 — Життєвий цикл.** Події `Created/Resumed/Deactivated/Stopped` пишуться в лог і видні на екрані налаштувань. Чернетки форм (нового студента та редагування) зберігаються на `Stopped` і відновлюються. `onAppearing` запускає `LoadCommand`. `AppStateService` — singleton у DI. Тема (системна / світла / темна) застосовується до всіх екранів і зберігається. Deep link:

```bash
npx uri-scheme open "studenthub://students/<id>" --ios      # або --android
# Expo Go: exp://<ip>:8081/--/students/<id>
```

**Лаб. 4 — Локальна БД і синхронізація.** Схема (`students`, `sync_queue`) з міграціями за `PRAGMA user_version`. CRUD через `IStudentRepository`. Offline-first: кожна зміна спершу пишеться в SQLite + чергу в одній транзакції; `SyncService` при появі мережі (NetInfo) відправляє чергу (`PUT`/`DELETE`), потім забирає зміни з сервера (`GET /students?since=`). Конфлікти — **last-write-wins** за `updatedAt` (сервер повертає `409` зі своєю версією, якщо вона новіша). `documentNumber` шифрується AES-256-CBC перед записом у БД; ключ — у SecureStore.

**Лаб. 5 — Логування й помилки.** Рівні Trace…Critical, мінімальний рівень Debug у dev / Information у prod. Sink'и: консоль, файл `logs/app-YYYYMMDD.log` (JSON Lines, щоденна ротація, зберігаються 7 файлів), Sentry. Глобальні обробники JS-винятків і необроблених Promise. На екрані «Налаштування → Діагностика» можна змоделювати збої, а екран «Журнал подій» показує записи з фільтром за рівнем і кнопкою «Повідомити про помилку» (до звіту додаються логи та інформація про пристрій).

## API

| Метод | Шлях | Опис |
|---|---|---|
| GET | `/health` | перевірка доступності |
| GET | `/students?since=<ms>` | зміни після `since`, включно з видаленими (tombstones) |
| GET | `/students/:id` | один запис |
| PUT | `/students/:id` | створити або оновити (LWW; `409`, якщо на сервері новіша версія) |
| DELETE | `/students/:id?updatedAt=<ms>` | soft delete |

## Здача робіт

Для кожної лабораторної потрібна окрема гілка (`lab1` … `lab5`). Звіти з відповідями на контрольні питання оформлюються окремо (PDF/Word).
