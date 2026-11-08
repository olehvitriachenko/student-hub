import { router } from 'expo-router';

/**
 * Навігація з ViewModel (лаб. 2) — аналог Shell.Current.GoToAsync.
 *
 * ViewModel залежить лише від INavigationService, а не від expo-router,
 * тому навігаційну логіку можна тестувати з mock-реалізацією.
 *
 * Два способи передачі параметрів, як у MAUI:
 *  1. Примітиви в URI: goTo('/students/42')            → [QueryProperty] / useLocalSearchParams
 *  2. Складні об'єкти: goTo('/students/42', { SelectedStudent: student })
 *     → об'єкт кладеться у сховище параметрів, а ViewModel-приймач отримує його
 *       через IQueryAttributable.applyQueryAttributes (без серіалізації в рядок).
 */
export type QueryParams = Record<string, unknown>;

export interface IQueryAttributable {
  applyQueryAttributes(query: QueryParams): void;
}

export interface INavigationService {
  goTo(route: string, params?: QueryParams): void;
  /** GoToAsync("..") з необов'язковими параметрами для попередньої сторінки. */
  goBack(params?: QueryParams): void;
  /** Забрати параметри, передані на маршрут (викликається один раз при появі сторінки). */
  takeParams(route: string): QueryParams | undefined;
}

/** Ключ, під яким зберігаються параметри повернення (GoToAsync("..", params)). */
export const BACK_ROUTE = '..';

export class ExpoRouterNavigationService implements INavigationService {
  private readonly pending = new Map<string, QueryParams>();

  goTo(route: string, params?: QueryParams): void {
    if (params) this.pending.set(route, params);
    router.push(route as never);
  }

  goBack(params?: QueryParams): void {
    // Попередня сторінка забере їх у OnAppearing (useFocusEffect) через takeParams('..').
    if (params) this.pending.set(BACK_ROUTE, params);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  takeParams(route: string): QueryParams | undefined {
    const p = this.pending.get(route);
    this.pending.delete(route);
    return p;
  }
}
