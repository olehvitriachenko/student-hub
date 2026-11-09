/**
 * Розклад занять групи. Для навчального проєкту генерується детерміновано з назви групи:
 * та сама група завжди отримує той самий розклад, різні групи — різний.
 */
export type LessonType = 'Лекція' | 'Практика' | 'Лабораторна';

export interface Lesson {
  id: string;
  /** 1 = понеділок … 5 = п'ятниця */
  day: number;
  /** Номер пари (1–4) */
  pair: number;
  start: string;
  end: string;
  subject: string;
  type: LessonType;
  room: string;
  teacher: string;
}

export const SUBJECTS: { name: string; teacher: string }[] = [
  { name: 'Мобільна розробка', teacher: 'доц. Коваленко О. В.' },
  { name: 'Бази даних', teacher: 'проф. Шевчук І. М.' },
  { name: 'Веб-технології', teacher: 'ст. викл. Бондар Т. С.' },
  { name: 'Алгоритми та структури даних', teacher: 'доц. Мельник А. П.' },
  { name: 'Комп’ютерні мережі', teacher: 'доц. Ткаченко Р. Ю.' },
  { name: 'Операційні системи', teacher: 'ст. викл. Кравець Н. О.' },
  { name: 'Теорія ймовірностей', teacher: 'проф. Олійник В. Д.' },
  { name: 'Англійська мова', teacher: 'викл. Савчук М. Л.' },
];

const SLOTS = [
  ['08:30', '09:50'],
  ['10:05', '11:25'],
  ['11:40', '13:00'],
  ['13:30', '14:50'],
] as const;

const TYPES: LessonType[] = ['Лекція', 'Практика', 'Лабораторна'];

/** Простий детермінований ГПВЧ (mulberry32) із сідом із рядка. */
function rng(seedText: string) {
  let seed = 2166136261;
  for (const ch of seedText) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scheduleFor(group: string): Lesson[] {
  const rand = rng(group.trim().toUpperCase() || 'GROUP');
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const lessons: Lesson[] = [];
  for (let day = 1; day <= 5; day++) {
    const count = 2 + Math.floor(rand() * 3); // 2–4 пари
    const firstPair = rand() < 0.3 ? 2 : 1;
    for (let i = 0; i < count && firstPair + i <= SLOTS.length; i++) {
      const pair = firstPair + i;
      const subject = pick(SUBJECTS);
      const type = subject.name === 'Англійська мова' ? 'Практика' : pick(TYPES);
      lessons.push({
        id: `${day}-${pair}`,
        day,
        pair,
        start: SLOTS[pair - 1][0],
        end: SLOTS[pair - 1][1],
        subject: subject.name,
        type,
        room: type === 'Лекція' ? `${pick(['А', 'Б'])}-${100 + Math.floor(rand() * 30)}` : `${200 + Math.floor(rand() * 220)}`,
        teacher: subject.teacher,
      });
    }
  }
  return lessons;
}

/** Стартові завдання для нового акаунта, щоб застосунок не був порожнім після реєстрації. */
export function starterAssignments(now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  return [
    { title: 'Лабораторна робота №3: життєвий цикл', subject: 'Мобільна розробка', due: 3, done: false, grade: null },
    { title: 'ER-діаграма для курсового проєкту', subject: 'Бази даних', due: 6, done: false, grade: null },
    { title: 'Верстка лендінгу (адаптив)', subject: 'Веб-технології', due: 1, done: false, grade: null },
    { title: 'Задачі на графи: BFS/DFS', subject: 'Алгоритми та структури даних', due: -2, done: true, grade: 92 },
    { title: 'Essay: My future profession', subject: 'Англійська мова', due: -5, done: true, grade: 85 },
  ].map((a) => ({
    title: a.title,
    subject: a.subject,
    description: '',
    dueAt: now + a.due * day,
    done: a.done,
    grade: a.grade,
  }));
}
