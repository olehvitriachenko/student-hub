import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { container } from '../../AppServices';
import type { ServiceKey } from '../di/ServiceContainer';
import type { ViewModelBase } from './ViewModelBase';
import { useViewModel } from './hooks';

/**
 * Зв'язує сторінку з її ViewModel (аналог `BindingContext = vm` через DI у конструкторі сторінки):
 *  - бере transient-екземпляр із DI-контейнера один раз на сторінку;
 *  - викликає onAppearing / onDisappearing при фокусі/втраті фокусу екрана (лаб. 3);
 *  - викликає dispose при знищенні сторінки;
 *  - підписує компонент на PropertyChanged.
 */
export function usePageViewModel<T extends ViewModelBase>(key: ServiceKey<T>): T {
  const [vm] = useState(() => container.get(key));

  useFocusEffect(
    useCallback(() => {
      void vm.onAppearing();
      return () => vm.onDisappearing();
    }, [vm]),
  );

  useEffect(() => () => vm.dispose(), [vm]);

  return useViewModel(vm);
}
