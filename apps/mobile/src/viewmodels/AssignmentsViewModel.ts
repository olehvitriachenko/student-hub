import { Command } from '../core/mvvm/Command';
import type { Messenger } from '../core/mvvm/Messenger';
import { ObservableCollection } from '../core/mvvm/ObservableCollection';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ILogger } from '../core/logging/Logger';
import type { IAssignmentRepository } from '../data/AssignmentRepository';
import type { Assignment } from '../models/Assignment';
import type { Analytics } from '../services/CrashReporting';
import type { INavigationService } from '../services/NavigationService';
import type { SyncService } from '../services/SyncService';
import { startOfDay } from '../utils/format';

export type AssignmentFilter = 'active' | 'done' | 'all';

/** Вкладка «Завдання»: список з фільтром, відмітка «виконано», перехід до редагування. */
export class AssignmentsViewModel extends ViewModelBase {
  /** ObservableCollection — список оновлюється при кожній зміні (лаб. 1). */
  readonly items = new ObservableCollection<Assignment>();
  private _filter: AssignmentFilter = 'active';
  /** Видалене завдання, яке ще можна повернути (4 с), — далі видалення фіксується в БД. */
  private pendingDelete: { item: Assignment; timer: ReturnType<typeof setTimeout> } | null = null;
  private _undoText: string | null = null;

  readonly loadCommand: Command;
  readonly refreshCommand: Command;
  readonly setFilterCommand: Command<AssignmentFilter>;
  readonly toggleDoneCommand: Command<Assignment>;
  readonly openCommand: Command<Assignment>;
  readonly addCommand: Command;
  readonly deleteCommand: Command<Assignment>;
  readonly undoDeleteCommand: Command;
  readonly focusCommand: Command<Assignment>;

  constructor(
    private readonly repo: IAssignmentRepository,
    readonly sync: SyncService,
    private readonly messenger: Messenger,
    navigation: INavigationService,
    private readonly analytics: Analytics,
    private readonly log: ILogger,
  ) {
    super();
    this.loadCommand = new Command(() => this.load());
    this.refreshCommand = new Command(async () => {
      this.setBusy(true);
      try {
        await this.sync.sync();
        await this.load();
      } finally {
        this.setBusy(false);
      }
    });
    this.setFilterCommand = new Command<AssignmentFilter>((f) => {
      this.setProperty('filter', this._filter, f, (v) => (this._filter = v));
    });
    this.toggleDoneCommand = new Command<Assignment>((a) => this.toggleDone(a));
    // Передаємо цілий об'єкт через параметри навігації (IQueryAttributable, лаб. 2).
    this.openCommand = new Command<Assignment>((a) => navigation.goTo(`/assignment/${a.id}`, { assignment: a }));
    this.addCommand = new Command(() => navigation.goTo('/assignment/new'));
    this.deleteCommand = new Command<Assignment>((a) => this.deleteWithUndo(a));
    this.undoDeleteCommand = new Command(() => this.undoDelete(), () => this.pendingDelete !== null);
    this.focusCommand = new Command<Assignment>((a) => navigation.goTo(`/focus/${a.id}`, { assignment: a }));
    this.track(() => void this.commitDelete()); // йдемо з екрана — фіксуємо відкладене видалення

    this.track(messenger.register('AssignmentsSynced', () => void this.load()));
    this.track(messenger.register('AssignmentSaved', (a) => this.upsertLocal(a)));
    this.track(messenger.register('AssignmentDeleted', ({ id }) => this.items.remove((x) => x.id === id)));
  }

  get filter() { return this._filter; }
  get undoText() { return this._undoText; }

  get visible(): readonly Assignment[] {
    const all = this.items.items;
    if (this._filter === 'active') return all.filter((a) => !a.done);
    if (this._filter === 'done') return all.filter((a) => a.done);
    return all;
  }

  get activeCount() { return this.items.items.filter((a) => !a.done).length; }
  get doneCount() { return this.items.items.filter((a) => a.done).length; }
  get overdueCount() {
    const today = startOfDay(Date.now());
    return this.items.items.filter((a) => !a.done && a.dueAt < today).length;
  }

  override onAppearing() {
    this.loadCommand.execute();
  }

  private async load() {
    this.items.reset(sortAssignments(await this.repo.getAll()));
  }

  /** Свайп «видалити»: прибираємо зі списку одразу, у БД — через 4 с, якщо не натиснули «Скасувати». */
  private async deleteWithUndo(a: Assignment) {
    await this.commitDelete(); // попереднє відкладене видалення фіксуємо
    this.items.remove((x) => x.id === a.id);
    this.pendingDelete = { item: a, timer: setTimeout(() => void this.commitDelete(), 4000) };
    this.setUndo(`«${a.title.length > 24 ? a.title.slice(0, 24) + '…' : a.title}» видалено`);
  }

  private undoDelete() {
    const p = this.pendingDelete;
    if (!p) return;
    clearTimeout(p.timer);
    this.pendingDelete = null;
    this.upsertLocal(p.item);
    this.setUndo(null);
    this.log.info('Assignment delete undone', { id: p.item.id });
  }

  private async commitDelete() {
    const p = this.pendingDelete;
    if (!p) return;
    clearTimeout(p.timer);
    this.pendingDelete = null;
    this.setUndo(null);
    await this.repo.delete(p.item.id);
    this.messenger.send('AssignmentDeleted', { id: p.item.id });
    this.analytics.trackEvent('AssignmentDeleted', { via: 'swipe' });
    await this.sync.notifyLocalChange();
  }

  private setUndo(text: string | null) {
    this.setProperty('undoText', this._undoText, text, (v) => (this._undoText = v));
    this.undoDeleteCommand.raiseCanExecuteChanged();
  }

  private upsertLocal(a: Assignment) {
    const next = this.items.items.filter((x) => x.id !== a.id);
    this.items.reset(sortAssignments([...next, a]));
  }

  private async toggleDone(a: Assignment) {
    const updated: Assignment = { ...a, done: !a.done, updatedAt: Date.now() };
    this.upsertLocal(updated); // оптимістично оновлюємо UI
    try {
      await this.repo.save(updated);
      this.analytics.trackEvent(updated.done ? 'AssignmentDone' : 'AssignmentReopened');
      await this.sync.notifyLocalChange();
    } catch (e) {
      this.log.error(e, 'Failed to toggle assignment');
      this.upsertLocal(a);
    }
  }
}

/** Невиконані — за дедлайном, виконані — в кінці (найсвіжіші першими). */
function sortAssignments(items: Assignment[]): Assignment[] {
  return [...items].sort((x, y) => (x.done === y.done ? (x.done ? y.dueAt - x.dueAt : x.dueAt - y.dueAt) : x.done ? 1 : -1));
}
