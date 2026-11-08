/**
 * Model: "чистий" тип без залежностей від React / React Native.
 * (Аналог `public class Student` без посилань на Microsoft.Maui.)
 */
export interface Student {
  /** Унікальний ідентифікатор (потрібен списку як ключ). */
  id: string;
  fullName: string;
  group: string;
  /** Середній бал за 5-бальною шкалою. */
  averageScore: number;
}

export const EXCELLENT_SCORE = 4.0;

export const isExcellent = (s: Pick<Student, 'averageScore'>) => s.averageScore >= EXCELLENT_SCORE;

/** Правило валідації моделі. */
export function validateStudent(s: Pick<Student, 'fullName' | 'averageScore'>): string | null {
  if (!s.fullName.trim()) return 'ПІБ не може бути порожнім';
  if (s.averageScore < 0 || s.averageScore > 5) return 'Середній бал має бути в межах 0–5';
  return null;
}
