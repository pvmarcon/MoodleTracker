import type { Profile, Roadmap } from '@/types';
import { createLocalStorageStore, type KeyValueStore } from './storage/keyValueStore';

/**
 * Persistence boundary of the app. UI/state code only talks to this interface.
 *
 * Migration path: implement `AppRepository` with fetch calls, e.g.
 *   GET    /roadmaps            -> listRoadmaps
 *   PUT    /roadmaps/:id        -> upsertRoadmap
 *   DELETE /roadmaps/:id        -> deleteRoadmap
 *   GET/PUT /me/profile         -> getProfile / saveProfile
 * (or Supabase tables roadmaps/phases/topics/tasks) and swap it in `repository` below.
 */
export interface AppRepository {
  listRoadmaps(): Promise<Roadmap[] | null>;
  upsertRoadmap(roadmap: Roadmap): Promise<void>;
  deleteRoadmap(id: string): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  getDismissedSuggestions(): Promise<string[]>;
  saveDismissedSuggestions(ids: string[]): Promise<void>;
  exportAll(): Promise<string>;
  importAll(json: string): Promise<void>;
  reset(): Promise<void>;
}

const KEYS = { roadmaps: 'roadmaps', profile: 'profile', dismissed: 'dismissed' } as const;

export const createLocalRepository = (store: KeyValueStore = createLocalStorageStore()): AppRepository => {
  // Serialise writes so rapid toggles never interleave read-modify-write cycles.
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    return next;
  };

  const readRoadmaps = async () => (await store.get<Roadmap[]>(KEYS.roadmaps)) ?? [];

  return {
    listRoadmaps: () => store.get<Roadmap[]>(KEYS.roadmaps),
    upsertRoadmap: (r) =>
      enqueue(async () => {
        const list = await readRoadmaps();
        const i = list.findIndex((x) => x.id === r.id);
        if (i >= 0) list[i] = r;
        else list.push(r);
        await store.set(KEYS.roadmaps, list);
      }),
    deleteRoadmap: (id) =>
      enqueue(async () => {
        await store.set(KEYS.roadmaps, (await readRoadmaps()).filter((x) => x.id !== id));
      }),
    getProfile: () => store.get<Profile>(KEYS.profile),
    saveProfile: (p) => enqueue(() => store.set(KEYS.profile, p)),
    getDismissedSuggestions: async () => (await store.get<string[]>(KEYS.dismissed)) ?? [],
    saveDismissedSuggestions: (ids) => enqueue(() => store.set(KEYS.dismissed, ids.slice(-200))),
    exportAll: async () =>
      JSON.stringify(
        { version: 1, exportedAt: new Date().toISOString(), roadmaps: await readRoadmaps(), profile: await store.get(KEYS.profile) },
        null,
        2,
      ),
    importAll: (json) =>
      enqueue(async () => {
        const data = JSON.parse(json);
        if (!Array.isArray(data.roadmaps)) throw new Error('Arquivo inválido');
        await store.set(KEYS.roadmaps, data.roadmaps);
        if (data.profile) await store.set(KEYS.profile, data.profile);
      }),
    reset: () =>
      enqueue(async () => {
        await Promise.all(Object.values(KEYS).map((k) => store.remove(k)));
      }),
  };
};

export const repository: AppRepository = createLocalRepository();
