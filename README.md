# Student Hub — «Особистий кабінет студента»

Мобільний застосунок на **React Native (Expo SDK 58, Expo Router)** з бекендом на **Fastify**: акаунти (Argon2), розклад групи, завдання з офлайн-синхронізацією, планувальник подій і нагадування.
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
| `IQueryAttributable` / `[QueryProperty]` | `applyQueryAttributes` / `useLocalSearchParams` | `src/viewmodels/AssignmentEditViewModel.ts` |
| `MauiProgram.cs`, `AddSingleton/AddTransient` | `ServiceContainer` | `src/AppServices.ts`, `src/core/di/ServiceContainer.ts` |
| `Window.Stopped/Resumed/...` | `AppLifecycleService` (`AppState`) | `src/services/AppLifecycleService.ts` |
| `OnAppearing/OnDisappearing` | `useFocusEffect` → `vm.onAppearing()` | `src/core/mvvm/usePageViewModel.ts` |
| `Preferences` | `AsyncStoragePreferences` | `src/services/Preferences.ts` |
| `UserAppTheme` | `ThemeService` (`Appearance.setColorScheme`) | `src/services/ThemeService.ts` |
| App Links / deep link | `studenthub://assignment/<id>`, `studenthub://event/<id>` | `app.json`, `src/app/assignment/[id].tsx` |
| `sqlite-net-pcl`, репозиторій | `expo-sqlite`, `SqliteAssignmentRepository`, `SqliteEventRepository` | `src/data/` |
| `PRAGMA user_version` міграції | `MIGRATIONS` | `src/data/database.ts` |
| SyncQueue + `HttpClient` | `sync_queue` + `SyncService` + `ApiClient` | `src/services/SyncService.ts` |
| AES-шифрування поля | `AesCryptoService` (ключ у SecureStore) | `src/services/CryptoService.ts` |
| `ILogger<T>` + Serilog sinks | `LoggerFactory` + `ConsoleSink` / `RollingFileSink` / `SentrySink` | `src/core/logging/` |
| `AppDomain.UnhandledException` / `UnobservedTaskException` | `ErrorUtils.setGlobalHandler` / Hermes rejection tracker | `src/core/logging/globalErrorHandler.ts` |
| App Center Crashes / Analytics | Sentry | `src/services/CrashReporting.ts` |

## Застосунок (гілка `main`)

- **Головний екран → вхід / реєстрація в 3 кроки** (email з перевіркою, чи він вільний → пароль із чек-листом вимог → ПІБ і група). Паролі на сервері — Argon2id, сесійний токен у SecureStore.
- **Розклад**: тиждень Пн–Нд із гортанням, картка «Зараз / Далі», пари групи + власні події в одній стрічці. Розклад змокано на сервері (детермінований для кожної групи) і кешується офлайн.
- **Планувальник подій**: категорії, дата/час/тривалість, нотатка (шифрується), нагадування.
- **Завдання**: фільтри, відмітка «виконано», дедлайни й оцінки, offline-first синхронізація з API.
- **Нагадування** (`expo-notifications`): за N хв до пари, напередодні дедлайну, за 15 хв до події; тестове сповіщення в профілі. У Expo Go працюють локальні сповіщення; віддалені push потребують development build.
- **Чат групи** (WebSocket): повідомлення в реальному часі, «друкує…», лічильник онлайн, історія, бейдж непрочитаних на вкладці, автоперепідключення; **реакції** на довге натискання (синхронізуються між учасниками).
- **Свайпи на завданнях**: → «виконано», ← «Фокус» / «Видалити» з плашкою «Скасувати» (видалення фіксується через 4 с).
- **Фокус-таймер (Pomodoro)**: кільце прогресу на SVG + reanimated, 15/25/50 хв і перерва, сповіщення про кінець сесії у фоні, облік хвилин фокусу по кожному завданню.
- **Графік оцінок за предметами** і статистика фокусу в профілі; свайп по стрічці розкладу перемикає день; тактильний відгук (haptics) на діях.
- **Профіль**: студентський, прогрес семестру, налаштування нагадувань, тема, вихід.

Гілки `lab1`…`lab5` зберігають стан проєкту після кожної лабораторної (до редизайну).

## Що реалізовано за лабораторними

> Описи нижче відповідають гілкам `lab1`…`lab5`. У `main` ті самі механізми застосовано до завдань (`Assignment`) замість студентів.


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
| POST | `/auth/check-email` | чи вільний email (крок 1 реєстрації) |
| POST | `/auth/register` | реєстрація (Argon2id) → `{ token, user }` |
| POST | `/auth/login` | вхід → `{ token, user }` |
| POST | `/auth/logout` | завершити сесію |
| GET / PATCH | `/me` | профіль / змінити ПІБ і групу |
| GET | `/schedule` | розклад групи користувача (мок) |
| GET | `/chat/messages?before=<ms>` | історія чату групи (останні 50) |
| WS | `/chat/ws?token=<token>` | чат: `message`, `typing`, `react`, `presence`, `reactions` |
| GET | `/assignments?since=<ms>` | зміни завдань після `since`, включно з tombstones |
| PUT | `/assignments/:id` | створити або оновити (LWW; `409`, якщо на сервері новіша версія) |
| DELETE | `/assignments/:id?updatedAt=<ms>` | soft delete |

Усі маршрути, крім `/health` і `/auth/*`, потребують `Authorization: Bearer <token>`.

## Здача робіт

Кожна лабораторна має свою гілку, і кожна наступна будується на попередній:

| Гілка | Що додано |
|---|---|
| `lab1` | MVVM-ядро, модель `Student`, прив'язка даних, `AddStudentCommand`, список у пам'яті |
| `lab2` | Сторінка деталей, `INavigationService`, передача `Student` параметром, `GoBack`/`Save`, `Messenger` |
| `lab3` | DI-контейнер, життєвий цикл, чернетки форм, `AppStateService`, тема, deep link, збереження в Preferences |
| `lab4` | SQLite з міграціями, репозиторій, черга офлайн-змін і синхронізація, Fastify API, шифрування AES |
| `lab5` = `main` | Структуроване логування, файловий лог, глобальні обробники помилок, Sentry, екран логів |

Звіти з відповідями на контрольні питання оформлюються окремо (PDF/Word).
