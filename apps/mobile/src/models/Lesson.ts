export type LessonType = 'Лекція' | 'Практика' | 'Лабораторна';

/** Пара в розкладі групи. */
export interface Lesson {
  id: string;
  /** 1 = понеділок … 5 = п'ятниця */
  day: number;
  pair: number;
  start: string;
  end: string;
  subject: string;
  type: LessonType;
  room: string;
  teacher: string;
}

export interface Schedule {
  group: string;
  lessons: Lesson[];
}
