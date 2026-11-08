# Student Hub — «Особистий кабінет студента»

Гілка **lab1** — стан проєкту після лабораторної роботи № 1. Застосунок на React Native (Expo SDK 58, Expo Router).
Повна версія з усіма лабораторними — гілки `lab5` / `main`.

## Запуск

```bash
npm run install:all
npm run mobile               # Metro; відкрийте в Expo Go / емуляторі
npm run typecheck
```

## Що реалізовано

**Лаб. 1 — MVVM і Data Binding.** Модель `Student` без залежностей від UI. `StudentViewModel` з властивостями, що сповіщають про зміни; обчислювані `greeting` (OneWay) і `isExcellent` (зелений колір при балі ≥ 4.0). `AddStudentCommand` блокує кнопку, поки ПІБ порожнє. Список — `FlatList` над `ObservableCollection`.
