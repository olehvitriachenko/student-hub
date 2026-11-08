# Student Hub — «Особистий кабінет студента»

Гілка **lab3** — стан проєкту після лабораторної роботи № 3. Застосунок на React Native (Expo SDK 58, Expo Router).
Повна версія з усіма лабораторними — гілки `lab5` / `main`.

## Запуск

```bash
npm run install:all
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
