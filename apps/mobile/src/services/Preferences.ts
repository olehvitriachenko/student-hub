import AsyncStorage from '@react-native-async-storage/async-storage';

/** Аналог Preferences у MAUI: прості key-value дані між сеансами (лаб. 3). */
export interface IPreferences {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  getJson<T>(key: string): Promise<T | null>;
  setJson(key: string, value: unknown): Promise<void>;
}

export class AsyncStoragePreferences implements IPreferences {
  get = (key: string) => AsyncStorage.getItem(key);
  set = (key: string, value: string) => AsyncStorage.setItem(key, value);
  remove = (key: string) => AsyncStorage.removeItem(key);

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  setJson = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));
}
