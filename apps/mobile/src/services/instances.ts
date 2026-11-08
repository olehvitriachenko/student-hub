import { Messenger } from '../core/mvvm/Messenger';
import { ExpoRouterNavigationService, type INavigationService } from './NavigationService';

/**
 * Спільні екземпляри сервісів. ViewModel'і отримують їх через конструктор,
 * тож у лаб. 3 їх легко перенести в DI-контейнер без змін у самих ViewModel.
 */
export const navigation: INavigationService = new ExpoRouterNavigationService();
export const messenger = new Messenger();
