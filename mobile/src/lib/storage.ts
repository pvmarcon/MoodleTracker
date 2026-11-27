import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLocalRepository } from '@/services/repository';
import type { KeyValueStore } from '@/services/storage/keyValueStore';

/** AsyncStorage implementation of the shared KeyValueStore contract. */
const asyncStore = (namespace = 'trilha:v1'): KeyValueStore => {
  const k = (key: string) => `${namespace}:${key}`;
  return {
    async get<T>(key: string) {
      try {
        const raw = await AsyncStorage.getItem(k(key));
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T) {
      await AsyncStorage.setItem(k(key), JSON.stringify(value));
    },
    async remove(key: string) {
      await AsyncStorage.removeItem(k(key));
    },
  };
};

export const repository = createLocalRepository(asyncStore());
