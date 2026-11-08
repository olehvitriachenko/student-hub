import type { Student } from '../models/Student';
import type { IPreferences } from '../services/Preferences';
import type { ILogger } from '../core/logging/Logger';

/**
 * Репозиторій студентів: ViewModel працює лише з цим інтерфейсом.
 * У лаб. 3 дані зберігаються в Preferences (щоб список і deep link працювали
 * після перезапуску); у лаб. 4 реалізацію буде замінено на SQLite без змін у ViewModel.
 */
export interface IStudentRepository {
  getAll(): Promise<Student[]>;
  getById(id: string): Promise<Student | null>;
  save(student: Student): Promise<void>;
  delete(id: string): Promise<void>;
}

const KEY = 'students';

export class PreferencesStudentRepository implements IStudentRepository {
  constructor(
    private readonly prefs: IPreferences,
    private readonly log: ILogger,
  ) {}

  async getAll(): Promise<Student[]> {
    const list = (await this.prefs.getJson<Student[]>(KEY)) ?? [];
    return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getById(id: string): Promise<Student | null> {
    return (await this.getAll()).find((s) => s.id === id) ?? null;
  }

  async save(student: Student): Promise<void> {
    const list = await this.getAll();
    const idx = list.findIndex((s) => s.id === student.id);
    if (idx >= 0) list[idx] = student;
    else list.push(student);
    await this.prefs.setJson(KEY, list);
    this.log.info('Student saved', { id: student.id });
  }

  async delete(id: string): Promise<void> {
    const list = await this.getAll();
    await this.prefs.setJson(KEY, list.filter((s) => s.id !== id));
    this.log.info('Student deleted', { id });
  }
}
