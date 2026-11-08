import { ObservableObject } from './ObservableObject';

export type CollectionChangedAction = 'add' | 'remove' | 'replace' | 'reset';

/**
 * Аналог ObservableCollection<T>: на відміну від звичайного масиву
 * сповіщає View про додавання / видалення / заміну елементів,
 * тому список (FlatList) оновлюється в реальному часі.
 */
export class ObservableCollection<T> extends ObservableObject {
  private _items: readonly T[] = [];

  constructor(initial: Iterable<T> = []) {
    super();
    this._items = [...initial];
  }

  /** Незмінний знімок — нове посилання після кожної зміни (зручно для FlatList). */
  get items(): readonly T[] {
    return this._items;
  }

  get count(): number {
    return this._items.length;
  }

  add(item: T): void {
    this._items = [...this._items, item];
    this.notify('add');
  }

  insert(index: number, item: T): void {
    const next = [...this._items];
    next.splice(index, 0, item);
    this._items = next;
    this.notify('add');
  }

  remove(predicate: (item: T) => boolean): boolean {
    const next = this._items.filter((i) => !predicate(i));
    if (next.length === this._items.length) return false;
    this._items = next;
    this.notify('remove');
    return true;
  }

  replace(predicate: (item: T) => boolean, item: T): boolean {
    const idx = this._items.findIndex(predicate);
    if (idx < 0) return false;
    const next = [...this._items];
    next[idx] = item;
    this._items = next;
    this.notify('replace');
    return true;
  }

  /** Повна заміна вмісту (аналог Clear() + Add() у циклі, але з одним сповіщенням). */
  reset(items: Iterable<T>): void {
    this._items = [...items];
    this.notify('reset');
  }

  clear(): void {
    this.reset([]);
  }

  private notify(action: CollectionChangedAction) {
    this.onPropertyChanged(`CollectionChanged:${action}`);
  }
}
