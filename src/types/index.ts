/**
 * Domain model. Kept framework-agnostic (plain serialisable objects) so it can
 * be shared with a future React Native app or mapped 1:1 to REST/SQL tables:
 *   roadmaps -> phases -> topics -> tasks
 */

export type Level3 = 'low' | 'medium' | 'high';
export type Priority = Level3;
export type Energy = Level3;
export type TaskKind = 'study' | 'practice' | 'project' | 'review';
export type RoadmapStatus = 'active' | 'paused' | 'completed';
export type ISODate = string; // YYYY-MM-DD (local day)
export type ISODateTime = string; // full ISO timestamp

export interface Task {
  id: string;
  title: string;
  description?: string;
  kind: TaskKind;
  priority: Priority;
  energy: Energy;
  estimatedMinutes: number;
  dueDate: ISODate | null;
  completedAt: ISODateTime | null;
}

export interface Topic {
  id: string;
  title: string;
  description?: string;
  tasks: Task[];
}

export interface Phase {
  id: string;
  title: string;
  description?: string;
  topics: Topic[];
}

export interface RoadmapInput {
  goal: string;
  currentLevel: string;
  hoursPerWeek: number;
  deadline: ISODate;
}

export interface Roadmap extends RoadmapInput {
  id: string;
  title: string;
  emoji: string;
  color: RoadmapColor;
  status: RoadmapStatus;
  source: 'ai' | 'mock' | 'manual';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastRecalibratedAt?: ISODateTime;
  phases: Phase[];
}

export type RoadmapColor = 'violet' | 'green' | 'blue' | 'orange' | 'pink' | 'cyan';

export type ThemePref = 'dark' | 'light';

export type AIProviderId = 'mock' | 'openai' | 'gemini';

export interface AISettings {
  provider: AIProviderId;
  /** Key typed in the app (kept on-device). Overrides VITE_* env keys. */
  apiKey?: string;
  model?: string;
}

export interface Profile {
  name: string;
  headline: string;
  /** 0 = Sunday ... 6 = Saturday */
  studyDays: number[];
  dailyGoalMinutes: number;
  theme: ThemePref;
  ai: AISettings;
  onboarded: boolean;
}

export type SuggestionKind = 'project' | 'review' | 'next-topic' | 'recalibrate' | 'pace' | 'habit';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  body: string;
  roadmapId?: string;
  /** Optional task payload that can be added to a roadmap with one tap. */
  task?: Omit<Task, 'id' | 'completedAt' | 'dueDate'>;
  /** Phase where the task should be inserted. */
  phaseId?: string;
  score: number;
}

/** Reference to a task inside the tree, handy for flat lists (Today screen). */
export interface TaskRef {
  task: Task;
  roadmap: Roadmap;
  phase: Phase;
  topic: Topic;
  phaseIndex: number;
}
