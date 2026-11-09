/** Особиста подія в планувальнику (консультація, дедлайн гуртка, тренування тощо). */
export type EventCategory = 'study' | 'exam' | 'meeting' | 'personal' | 'sport';

export interface PlannerEvent {
  id: string;
  title: string;
  category: EventCategory;
  /** Початок (epoch ms). */
  startAt: number;
  durationMin: number;
  /** Нотатка — у БД шифрується, як і нотатки завдань. */
  note: string;
  /** Чи нагадувати перед початком. */
  remind: boolean;
  createdAt: number;
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; icon: string }[] = [
  { value: 'study', label: 'Навчання', icon: 'book' },
  { value: 'exam', label: 'Іспит', icon: 'school' },
  { value: 'meeting', label: 'Зустріч', icon: 'people' },
  { value: 'personal', label: 'Особисте', icon: 'heart' },
  { value: 'sport', label: 'Спорт', icon: 'barbell' },
];

export const categoryOf = (c: EventCategory) => EVENT_CATEGORIES.find((x) => x.value === c) ?? EVENT_CATEGORIES[0];

export function validateEvent(e: Pick<PlannerEvent, 'title' | 'durationMin'>): string | null {
  if (!e.title.trim()) return 'Вкажіть назву події';
  if (e.durationMin <= 0) return 'Тривалість має бути більшою за нуль';
  return null;
}
