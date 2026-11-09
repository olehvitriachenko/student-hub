# CLAUDE.md

Student Hub — university lab project (labs 1–5, "Mobile development", MVVM). The original assignments target .NET MAUI; this repo implements the same concepts in React Native. UI strings and code comments are in Ukrainian; keep that convention. README.md has the MAUI → RN mapping table and per-lab feature list.

## Layout

- `apps/mobile` — Expo SDK 58 app, Expo Router (routes in `src/app/`), TypeScript strict. Read `apps/mobile/AGENTS.md` before touching Expo APIs (versions change between SDKs — check the installed package typings rather than memory).
- `apps/api` — Fastify 5 + `node:sqlite`, run as `.ts` directly by Node (type stripping). Use only erasable TS syntax there: no enums, no constructor parameter properties, and `.ts` extensions in imports.
- These are two independent npm packages, not workspaces. Install mobile deps with `npx expo install <pkg>` from inside `apps/mobile`.

## Commands

```bash
npm run install:all     # npm install in both apps
npm run api             # API dev server (node --watch), port 3000
npm run mobile          # expo start
npm run typecheck       # tsc in both apps — run before declaring done
npm test                # API tests (node --test, fastify.inject, :memory: DB)
```

In `apps/mobile`, `CI=1 npx expo export --platform ios` checks that Metro can bundle. Babel catches syntax that tsc allows (e.g. `declare` class fields).

## Mobile architecture (MVVM)

- **Hand-rolled MVVM core** in `src/core/mvvm` stands in for MAUI concepts on purpose (the labs grade INotifyPropertyChanged/ICommand/ObservableCollection), so don't replace it with MobX/Zustand.
  - ViewModels extend `ViewModelBase` and change state only via `setProperty(name, current, next, assign)`, which does the equality check and raises PropertyChanged. A getter that is computed from other state needs an explicit `onPropertyChanged('x')` call.
  - Commands: `new Command(execute, canExecute)`. Call `raiseCanExecuteChanged()` when canExecute inputs change. Buttons use `<CommandButton command=… />`.
  - Views (`src/app/*`) only bind: `usePageViewModel(Services.X)` + `bindText(vm, 'prop')` + commands. No business logic or service calls in views.
- **DI**: everything is registered in `src/AppServices.ts` (the composition root, like MauiProgram.cs). Services are singletons and ViewModels are transient. Add new services and VMs there with a `ServiceKey`.
- **Navigation**: VMs use `INavigationService.goTo(route, params)` / `goBack(params)`, never `expo-router` directly. Complex objects go through the params store, which the target VM gets via `applyQueryAttributes`. Return values are read under `BACK_ROUTE` ('..').
- **Auth**: `AuthService` keeps the session token in SecureStore and the cached user in Preferences. The root `_layout.tsx` uses `Stack.Protected` on `isAuthenticated` to switch between `(auth)` (welcome / login / 3-step register) and `(tabs)` (Розклад / Завдання / Профіль, custom floating tab bar). The API hashes passwords with Argon2id (`@node-rs/argon2`) and stores only SHA-256 of session tokens.
- **Data**: `SqliteAssignmentRepository` (`src/data`) — every write is a transaction that also enqueues to `sync_queue`. `SqliteEventRepository` holds local planner events (not synced). Schema changes = append a new entry to `MIGRATIONS` in `src/data/database.ts` (never edit old ones). Notes are stored encrypted (`descriptionEnc`, `noteEnc`).
- **Sync**: `SyncService` pushes the queue, then pulls `GET /assignments?since=`, with last-write-wins on `updatedAt` on both sides. Deletes are soft (tombstones). The schedule is mocked server-side (deterministic per group) and cached in Preferences.
- **Chat**: `@fastify/websocket` at `GET /chat/ws?token=` (token in query, since RN WebSocket headers are awkward). The room is the user's group. Messages are stored in SQLite, and history comes from `GET /chat/messages`. On the client, `ChatService` (singleton) owns the single socket, reconnects with backoff, and tracks the unread count for the tab badge.
- **Gestures**: `GestureHandlerRootView` wraps the root. Swipeable cards use `react-native-gesture-handler/ReanimatedSwipeable`. Note that `onSwipeableOpen(direction)` reports the gesture direction, so `RIGHT` means the left panel opened. The day swipe uses the RNGH 3 hooks API (`usePanGesture` + `GestureDetector`).
- **Reminders**: `ReminderService` (expo-notifications, local only) rebuilds all scheduled notifications whenever the Messenger reports a data change. iOS caps pending notifications at 64, so it keeps 60. Reminders use the identifiers `rem-*`, and the focus timer uses `focus-end`, so a reschedule never cancels the timer.
- **UI**: design tokens in `src/theme/theme.ts`, shared components in `src/components/ui.tsx`. Animations use react-native-reanimated: keep them to short fades and timing (the user rejected springy/bouncy motion), and use reanimated's `Easing` inside `withTiming`.
- **Logging**: get a logger via `loggerFactory.createLogger('Category')` (injected as `ILogger`). Sinks: console, rolling JSONL file (`RollingFileSink`, read by the Logs screen), Sentry (only when `EXPO_PUBLIC_SENTRY_DSN` is set).

## Gotchas

- `.env` keys must be prefixed `EXPO_PUBLIC_` to reach the app. See `apps/mobile/.env.example`.
- The API listens on `0.0.0.0` so a phone running Expo Go can reach it. The mobile app derives the API host from Metro's `hostUri`.
- `crypto-js` has no secure RNG on Hermes. Always pass an explicit key and an IV from `expo-crypto`.
