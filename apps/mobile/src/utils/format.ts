/** Форматування дат українською без залежності від Intl (Hermes підтримує його не скрізь однаково). */

const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const WEEKDAYS_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const WEEKDAYS_FULL = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П’ятниця', 'Субота'];

const DAY = 24 * 60 * 60 * 1000;

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** «14 листопада» */
export const formatDate = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
};

/** «Сьогодні», «Завтра», «через 3 дн.», «прострочено на 2 дн.» */
export function relativeDue(dueAt: number, now = Date.now()): { text: string; tone: 'danger' | 'warning' | 'muted' } {
  const days = Math.round((startOfDay(dueAt) - startOfDay(now)) / DAY);
  if (days < 0) return { text: `прострочено на ${-days} дн.`, tone: 'danger' };
  if (days === 0) return { text: 'сьогодні', tone: 'warning' };
  if (days === 1) return { text: 'завтра', tone: 'warning' };
  return { text: `через ${days} дн.`, tone: 'muted' };
}

/** «Доброго ранку» / «Добрий день» / «Добрий вечір» */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Доброї ночі';
  if (h < 12) return 'Доброго ранку';
  if (h < 18) return 'Добрий день';
  return 'Добрий вечір';
}

export const initials = (fullName: string) =>
  fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

/** Хвилини від початку доби для рядка «08:30». */
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
