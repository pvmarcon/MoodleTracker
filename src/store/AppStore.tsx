import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { defaultProfile, seedRoadmaps } from '@/data/seed';
import { materializeRoadmap, pickColor, taskFrom } from '@/domain/factory';
import { addTopic, flattenRoadmap, updateTask } from '@/domain/roadmap';
import { scheduleRoadmap } from '@/domain/schedule';
import { buildSuggestions } from '@/domain/suggestions';
import { computeStats, type Stats } from '@/domain/stats';
import { uid } from '@/lib/id';
import { today } from '@/lib/date';
import { aiService } from '@/services/ai';
import type { AppRepository } from '@/services/repository';
import type { ISODate, Profile, Roadmap, RoadmapInput, Suggestion } from '@/types';

interface State {
  ready: boolean;
  roadmaps: Roadmap[];
  profile: Profile;
  dismissed: string[];
}

export interface CreateResult {
  roadmap: Roadmap;
  providerLabel: string;
  fallbackReason?: string;
}

interface AppStore extends State {
  stats: Stats;
  suggestions: Suggestion[];
  getRoadmap(id: string): Roadmap | undefined;
  setTaskDone(roadmapId: string, taskId: string, done: boolean): void;
  saveRoadmap(r: Roadmap): void;
  deleteRoadmap(id: string): void;
  generateRoadmap(input: RoadmapInput): Promise<CreateResult>;
  recalibrate(roadmapId: string, opts?: { hoursPerWeek?: number; deadline?: ISODate }): Roadmap | undefined;
  applySuggestion(s: Suggestion): Roadmap | undefined;
  dismissSuggestion(id: string): void;
  updateProfile(patch: Partial<Profile>): void;
  resetToDemo(): Promise<void>;
  clearAll(): Promise<void>;
  exportData(): Promise<string>;
  importData(json: string): Promise<void>;
}

const Ctx = createContext<AppStore | null>(null);

/**
 * Platform-agnostic store shared by web and mobile. Each platform injects its
 * persistence (LocalStorage / AsyncStorage) and how to apply the theme.
 */
export function AppStoreProvider({
  children,
  repository,
  onThemeChange,
}: {
  children: ReactNode;
  repository: AppRepository;
  onThemeChange?: (theme: Profile['theme']) => void;
}) {
  const themeRef = useRef(onThemeChange);
  themeRef.current = onThemeChange;
  const applyTheme = (theme: Profile['theme']) => themeRef.current?.(theme);
  const [state, setState] = useState<State>({ ready: false, roadmaps: [], profile: defaultProfile(), dismissed: [] });
  const stateRef = useRef(state);
  stateRef.current = state;

  // ---- bootstrap (guarded: StrictMode runs effects twice in dev) ----
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      const profile = (await repository.getProfile()) ?? defaultProfile();
      let roadmaps = await repository.listRoadmaps();
      if (roadmaps === null) {
        roadmaps = seedRoadmaps(profile);
        await Promise.all(roadmaps.map((r) => repository.upsertRoadmap(r)));
        await repository.saveProfile(profile);
      }
      const dismissed = await repository.getDismissedSuggestions();
      applyTheme(profile.theme);
      setState({ ready: true, roadmaps, profile, dismissed });
    })();
  }, []);

  const commit = useCallback((r: Roadmap) => {
    const next = { ...r, updatedAt: new Date().toISOString() };
    setState((s) => {
      const exists = s.roadmaps.some((x) => x.id === r.id);
      return { ...s, roadmaps: exists ? s.roadmaps.map((x) => (x.id === r.id ? next : x)) : [...s.roadmaps, next] };
    });
    void repository.upsertRoadmap(next);
    return next;
  }, []);

  const getRoadmap = useCallback((id: string) => stateRef.current.roadmaps.find((r) => r.id === id), []);

  const setTaskDone = useCallback(
    (roadmapId: string, taskId: string, done: boolean) => {
      const r = getRoadmap(roadmapId);
      if (!r) return;
      let next = updateTask(r, taskId, { completedAt: done ? new Date().toISOString() : null });
      const allDone = flattenRoadmap(next).every((x) => x.task.completedAt);
      next = { ...next, status: allDone ? 'completed' : next.status === 'completed' ? 'active' : next.status };
      commit(next);
    },
    [commit, getRoadmap],
  );

  const deleteRoadmap = useCallback((id: string) => {
    setState((s) => ({ ...s, roadmaps: s.roadmaps.filter((r) => r.id !== id) }));
    void repository.deleteRoadmap(id);
  }, []);

  const generateRoadmap = useCallback(
    async (input: RoadmapInput): Promise<CreateResult> => {
      const { profile, roadmaps } = stateRef.current;
      const res = await aiService.generateRoadmap(input, profile.ai);
      const roadmap = materializeRoadmap(res.data, input, {
        source: res.provider.id === 'mock' ? 'mock' : 'ai',
        color: pickColor(roadmaps.map((r) => r.color)),
        studyDays: profile.studyDays,
      });
      commit(roadmap);
      return { roadmap, providerLabel: res.provider.label, fallbackReason: res.fallbackReason };
    },
    [commit],
  );

  const recalibrate = useCallback(
    (roadmapId: string, opts: { hoursPerWeek?: number; deadline?: ISODate } = {}) => {
      const r = getRoadmap(roadmapId);
      if (!r) return;
      const base = { ...r, ...opts };
      const next = scheduleRoadmap(base, { studyDays: stateRef.current.profile.studyDays, hoursPerWeek: base.hoursPerWeek, startDate: today() });
      return commit({ ...next, lastRecalibratedAt: new Date().toISOString() });
    },
    [commit, getRoadmap],
  );

  const dismissSuggestion = useCallback((id: string) => {
    setState((s) => {
      const dismissed = [...s.dismissed, id];
      void repository.saveDismissedSuggestions(dismissed);
      return { ...s, dismissed };
    });
  }, []);

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      if (!s.roadmapId || !s.task) return;
      const r = getRoadmap(s.roadmapId);
      if (!r) return;
      const phaseId = s.phaseId ?? r.phases.at(-1)?.id;
      const phase = r.phases.find((p) => p.id === phaseId);
      if (!phase) return;
      const task = taskFrom(s.task);
      let next: Roadmap;
      const existing = phase.topics.find((t) => t.title === 'Sugestões da IA');
      if (existing) {
        next = {
          ...r,
          phases: r.phases.map((p) =>
            p.id !== phase.id ? p : { ...p, topics: p.topics.map((t) => (t.id === existing.id ? { ...t, tasks: [...t.tasks, task] } : t)) },
          ),
        };
      } else {
        next = addTopic(r, phase.id, { id: uid('tp'), title: 'Sugestões da IA', tasks: [task] });
      }
      next = scheduleRoadmap(next, { studyDays: stateRef.current.profile.studyDays, hoursPerWeek: next.hoursPerWeek });
      dismissSuggestion(s.id);
      return commit(next);
    },
    [commit, dismissSuggestion, getRoadmap],
  );

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => {
      const profile = { ...s.profile, ...patch, ai: { ...s.profile.ai, ...patch.ai } };
      void repository.saveProfile(profile);
      if (patch.theme) applyTheme(profile.theme);
      return { ...s, profile };
    });
  }, []);

  const resetToDemo = useCallback(async () => {
    await repository.reset();
    const profile = { ...defaultProfile(), theme: stateRef.current.profile.theme };
    const roadmaps = seedRoadmaps(profile);
    await Promise.all(roadmaps.map((r) => repository.upsertRoadmap(r)));
    await repository.saveProfile(profile);
    setState({ ready: true, roadmaps, profile, dismissed: [] });
  }, []);

  const clearAll = useCallback(async () => {
    await repository.reset();
    const profile = { ...stateRef.current.profile, onboarded: true };
    await repository.saveProfile(profile);
    // Persist an empty list so the seed is not recreated on next boot.
    await repository.importAll(JSON.stringify({ roadmaps: [] }));
    setState({ ready: true, roadmaps: [], profile, dismissed: [] });
  }, []);

  const importData = useCallback(async (json: string) => {
    await repository.importAll(json);
    const profile = (await repository.getProfile()) ?? defaultProfile();
    applyTheme(profile.theme);
    setState({ ready: true, roadmaps: (await repository.listRoadmaps()) ?? [], profile, dismissed: [] });
  }, []);

  const stats = useMemo(() => computeStats(state.roadmaps), [state.roadmaps]);
  const suggestions = useMemo(
    () => buildSuggestions(state.roadmaps, state.profile).filter((s) => !state.dismissed.includes(s.id)),
    [state.roadmaps, state.profile, state.dismissed],
  );

  const value: AppStore = {
    ...state,
    stats,
    suggestions,
    getRoadmap,
    setTaskDone,
    saveRoadmap: commit,
    deleteRoadmap,
    generateRoadmap,
    recalibrate,
    applySuggestion,
    dismissSuggestion,
    updateProfile,
    resetToDemo,
    clearAll,
    exportData: repository.exportAll,
    importData,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppStoreProvider>');
  return ctx;
};
