import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { ViewModelBase } from './ViewModelBase';
import { useViewModel } from './hooks';

/**
 * Зв'язує сторінку з її ViewModel (аналог `BindingContext = new XViewModel(...)`):
 *  - створює ViewModel один раз на сторінку;
 *  - викликає onAppearing / onDisappearing при фокусі / втраті фокусу екрана;
 *  - викликає dispose при знищенні сторінки;
 *  - підписує компонент на PropertyChanged.
 */
export function usePageViewModel<T extends ViewModelBase>(factory: () => T): T {
  const [vm] = useState(factory);

  useFocusEffect(
    useCallback(() => {
      void vm.onAppearing();
      return () => vm.onDisappearing();
    }, [vm]),
  );

  useEffect(() => () => vm.dispose(), [vm]);

  return useViewModel(vm);
}
