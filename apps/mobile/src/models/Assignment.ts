/**
 * Model: завдання студента. "Чистий" тип без залежностей від React / React Native.
 */
export interface Assignment {
  /** UUID, генерується на клієнті — завдання можна створити офлайн. */
  id: string;
  title: string;
  subject: string;
  /** Нотатки — у локальній БД зберігаються зашифрованими (лаб. 4). */
  description: string;
  /** Дедлайн (epoch ms). */
  dueAt: number;
  done: boolean;
  /** Оцінка 0–100 або null, якщо ще не оцінено. */
  grade: number | null;
  /** Час останньої зміни (epoch ms) — для стратегії last-write-wins. */
  updatedAt: number;
  /** Soft delete (tombstone) — щоб видалення синхронізувалось із сервером. */
  deleted: boolean;
}

export function validateAssignment(a: Pick<Assignment, 'title' | 'subject' | 'grade'>): string | null {
  if (!a.title.trim()) return 'Вкажіть назву завдання';
  if (!a.subject.trim()) return 'Оберіть предмет';
  if (a.grade !== null && (Number.isNaN(a.grade) || a.grade < 0 || a.grade > 100)) return 'Оцінка — від 0 до 100';
  return null;
}

/** Середня оцінка за виконаними й оціненими завданнями. */
export function averageGrade(items: readonly Assignment[]): number | null {
  const graded = items.filter((a) => a.grade !== null);
  if (!graded.length) return null;
  return graded.reduce((s, a) => s + (a.grade ?? 0), 0) / graded.length;
}
