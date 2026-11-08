/**
 * Model (лаб. 1): "чистий" тип без залежностей від React / React Native.
 * Поля id, documentNumber, updatedAt, deleted додано в лаб. 4 (SQLite + синхронізація).
 */
export interface Student {
  /** UUID, генерується на клієнті — запис можна створити офлайн. */
  id: string;
  fullName: string;
  group: string;
  /** Середній бал за 5-бальною шкалою. */
  averageScore: number;
  /** Номер документа — чутливе поле, у локальній БД зберігається зашифрованим (лаб. 4). */
  documentNumber: string;
  /** Час останньої зміни (epoch ms) — для стратегії last-write-wins. */
  updatedAt: number;
  /** Soft delete (tombstone) — щоб видалення синхронізувалось з сервером. */
  deleted: boolean;
}

export const EXCELLENT_SCORE = 4.0;

export const isExcellent = (s: Pick<Student, 'averageScore'>) => s.averageScore >= EXCELLENT_SCORE;

/** Правило валідації моделі. */
export function validateStudent(s: Pick<Student, 'fullName' | 'averageScore'>): string | null {
  if (!s.fullName.trim()) return 'ПІБ не може бути порожнім';
  if (s.averageScore < 0 || s.averageScore > 5) return 'Середній бал має бути в межах 0–5';
  return null;
}
