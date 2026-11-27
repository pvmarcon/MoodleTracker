/**
 * Async key-value contract. Matches the shape of React Native's AsyncStorage
 * so the mobile app can swap the implementation without touching callers.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export const createLocalStorageStore = (namespace = 'trilha:v1'): KeyValueStore => {
  const k = (key: string) => `${namespace}:${key}`;
  return {
    async get<T>(key: string) {
      try {
        const raw = localStorage.getItem(k(key));
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T) {
      try {
        localStorage.setItem(k(key), JSON.stringify(value));
      } catch (e) {
        console.warn('[storage] write failed', e);
      }
    },
    async remove(key: string) {
      try {
        localStorage.removeItem(k(key));
      } catch {
        /* ignore */
      }
    },
  };
};

/** In-memory store for tests / SSR. */
export const createMemoryStore = (): KeyValueStore => {
  const m = new Map<string, string>();
  return {
    async get<T>(key: string) {
      const v = m.get(key);
      return v ? (JSON.parse(v) as T) : null;
    },
    async set<T>(key: string, value: T) {
      m.set(key, JSON.stringify(value));
    },
    async remove(key: string) {
      m.delete(key);
    },
  };
};
