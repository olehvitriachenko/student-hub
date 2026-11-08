# Student Hub — «Особистий кабінет студента»

Гілка **lab4** — стан проєкту після лабораторної роботи № 4. Застосунок на React Native (Expo SDK 58, Expo Router) з бекендом на Fastify.
Повна версія з усіма лабораторними — гілки `lab5` / `main`.

## Запуск

```bash
npm run install:all
npm run api                  # API на http://0.0.0.0:3000
npm run mobile               # Metro; відкрийте в Expo Go / емуляторі
npm run typecheck
```

## Що реалізовано

**Лаб. 1 — MVVM і Data Binding.** Модель `Student` без залежностей від UI. `StudentViewModel` з властивостями, що сповіщають про зміни; обчислювані `greeting` (OneWay) і `isExcellent` (зелений колір при балі ≥ 4.0). `AddStudentCommand` блокує кнопку, поки ПІБ порожнє. Список — `FlatList` над `ObservableCollection`.

**Лаб. 2 — Команди та навігація.** `OpenDetailsCommand` передає цілий об'єкт `Student` на сторінку деталей через словник параметрів (`IQueryAttributable`). `GoBackCommand`. `SaveCommand` повертає оновлений запис двома способами: через `goBack({ UpdatedStudent })` і через `Messenger` (`StudentUpdated`). Список оновлюється без перезапуску.

**Лаб. 3 — Життєвий цикл.** Події `Created/Resumed/Deactivated/Stopped` пишуться в лог і видні на екрані налаштувань. Чернетки форм (нового студента та редагування) зберігаються на `Stopped` і відновлюються. `onAppearing` запускає `LoadCommand`. `AppStateService` — singleton у DI. Тема (системна / світла / темна) застосовується до всіх екранів і зберігається. Deep link:

```bash
npx uri-scheme open "studenthub://students/<id>" --ios      # або --android
# Expo Go: exp://<ip>:8081/--/students/<id>
```

**Лаб. 4 — Локальна БД і синхронізація.** Схема (`students`, `sync_queue`) з міграціями за `PRAGMA user_version`. CRUD через `IStudentRepository`. Offline-first: кожна зміна спершу пишеться в SQLite + чергу в одній транзакції; `SyncService` при появі мережі (NetInfo) відправляє чергу (`PUT`/`DELETE`), потім забирає зміни з сервера (`GET /students?since=`). Конфлікти — **last-write-wins** за `updatedAt` (сервер повертає `409` зі своєю версією, якщо вона новіша). `documentNumber` шифрується AES-256-CBC перед записом у БД; ключ — у SecureStore.
