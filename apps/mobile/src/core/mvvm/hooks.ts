import { useSyncExternalStore } from 'react';
import type { ObservableObject } from './ObservableObject';
import type { ICommand } from './Command';

/**
 * "Data Binding" для React: компонент перерендериться щоразу,
 * коли ViewModel генерує PropertyChanged. Аналог BindingContext у XAML.
 */
export function useViewModel<T extends ObservableObject>(vm: T): T {
  useSyncExternalStore(vm.subscribe, vm.getVersion, vm.getVersion);
  return vm;
}

/** Підписка на кілька observable-об'єктів одразу (наприклад, VM + її колекція). */
export function useObservables(...objects: ObservableObject[]): void {
  const subscribe = (cb: () => void) => {
    const unsubs = objects.map((o) => o.subscribe(cb));
    return () => unsubs.forEach((u) => u());
  };
  const snapshot = () => objects.map((o) => o.getVersion()).join(':');
  useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** Прив'язка кнопки до ICommand: повертає `disabled` і `onPress` (аналог Command="{Binding ...}"). */
export function useCommand<P>(command: ICommand<P>, param: P) {
  useSyncExternalStore(command.subscribe, command.getVersion, command.getVersion);
  return {
    disabled: !command.canExecute(param),
    onPress: () => command.execute(param),
  };
}

/**
 * Двостороння прив'язка (Mode=TwoWay) TextInput до властивості ViewModel:
 * `<TextInput {...bindText(vm, 'fullName')} />`.
 */
export function bindText<T extends object, K extends keyof T>(vm: T, key: K) {
  return {
    value: String(vm[key] ?? ''),
    onChangeText: (text: string) => {
      (vm as Record<K, unknown>)[key] = text;
    },
  };
}
