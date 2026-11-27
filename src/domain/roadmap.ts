import type { Phase, Roadmap, Task, TaskRef, Topic } from '@/types';

export const phaseTasks = (p: Phase): Task[] => p.topics.flatMap((t) => t.tasks);
export const roadmapTasks = (r: Roadmap): Task[] => r.phases.flatMap(phaseTasks);

export interface Progress {
  done: number;
  total: number;
  ratio: number;
  minutesDone: number;
  minutesTotal: number;
}

export const progressOf = (tasks: Task[]): Progress => {
  let done = 0;
  let minutesDone = 0;
  let minutesTotal = 0;
  for (const t of tasks) {
    minutesTotal += t.estimatedMinutes;
    if (t.completedAt) {
      done++;
      minutesDone += t.estimatedMinutes;
    }
  }
  return { done, total: tasks.length, ratio: tasks.length ? done / tasks.length : 0, minutesDone, minutesTotal };
};

export const isPhaseComplete = (p: Phase) => {
  const tasks = phaseTasks(p);
  return tasks.length > 0 && tasks.every((t) => t.completedAt);
};

/** Index of the first incomplete phase (Duolingo-style "current unit"). */
export const currentPhaseIndex = (r: Roadmap): number => {
  const i = r.phases.findIndex((p) => !isPhaseComplete(p));
  return i === -1 ? r.phases.length : i;
};

export type PhaseState = 'done' | 'current' | 'locked';

export const phaseState = (r: Roadmap, index: number): PhaseState => {
  const cur = currentPhaseIndex(r);
  if (index < cur) return 'done';
  if (index === cur) return 'current';
  return 'locked';
};

/** Flat, ordered list of every task with its ancestry. */
export const flattenRoadmap = (r: Roadmap): TaskRef[] =>
  r.phases.flatMap((phase, phaseIndex) =>
    phase.topics.flatMap((topic) => topic.tasks.map((task) => ({ task, roadmap: r, phase, topic, phaseIndex }))),
  );

/** Next pending task in tree order (the "start here" node). */
export const nextTask = (r: Roadmap): TaskRef | undefined => flattenRoadmap(r).find((x) => !x.task.completedAt);

// ---------- Immutable tree updates ----------

export const mapTasks = (r: Roadmap, fn: (t: Task, topic: Topic, phase: Phase) => Task): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => ({
    ...p,
    topics: p.topics.map((tp) => ({ ...tp, tasks: tp.tasks.map((t) => fn(t, tp, p)) })),
  })),
});

export const updateTask = (r: Roadmap, taskId: string, patch: Partial<Task>): Roadmap =>
  mapTasks(r, (t) => (t.id === taskId ? { ...t, ...patch } : t));

export const removeTask = (r: Roadmap, taskId: string): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => ({
    ...p,
    topics: p.topics.map((tp) => ({ ...tp, tasks: tp.tasks.filter((t) => t.id !== taskId) })),
  })),
});

export const addTask = (r: Roadmap, topicId: string, task: Task): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => ({
    ...p,
    topics: p.topics.map((tp) => (tp.id === topicId ? { ...tp, tasks: [...tp.tasks, task] } : tp)),
  })),
});

export const updateTopic = (r: Roadmap, topicId: string, patch: Partial<Topic>): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => ({
    ...p,
    topics: p.topics.map((tp) => (tp.id === topicId ? { ...tp, ...patch } : tp)),
  })),
});

export const removeTopic = (r: Roadmap, topicId: string): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => ({ ...p, topics: p.topics.filter((tp) => tp.id !== topicId) })),
});

export const addTopic = (r: Roadmap, phaseId: string, topic: Topic): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => (p.id === phaseId ? { ...p, topics: [...p.topics, topic] } : p)),
});

export const updatePhase = (r: Roadmap, phaseId: string, patch: Partial<Phase>): Roadmap => ({
  ...r,
  phases: r.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p)),
});

export const removePhase = (r: Roadmap, phaseId: string): Roadmap => ({
  ...r,
  phases: r.phases.filter((p) => p.id !== phaseId),
});

export const addPhase = (r: Roadmap, phase: Phase, afterIndex = r.phases.length - 1): Roadmap => {
  const phases = [...r.phases];
  phases.splice(afterIndex + 1, 0, phase);
  return { ...r, phases };
};

export const movePhase = (r: Roadmap, phaseId: string, dir: -1 | 1): Roadmap => {
  const i = r.phases.findIndex((p) => p.id === phaseId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= r.phases.length) return r;
  const phases = [...r.phases];
  [phases[i], phases[j]] = [phases[j], phases[i]];
  return { ...r, phases };
};
