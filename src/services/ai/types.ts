import type { AISettings, Energy, Priority, RoadmapInput, TaskKind } from '@/types';

/** Shape every provider (mock or LLM) must return. No ids/dates: the app assigns them. */
export interface GeneratedTask {
  title: string;
  description?: string;
  kind: TaskKind;
  priority: Priority;
  energy: Energy;
  estimatedMinutes: number;
}
export interface GeneratedTopic {
  title: string;
  description?: string;
  tasks: GeneratedTask[];
}
export interface GeneratedPhase {
  title: string;
  description?: string;
  topics: GeneratedTopic[];
}
export interface GeneratedRoadmap {
  title: string;
  emoji: string;
  phases: GeneratedPhase[];
}

export interface GeneratedIdea {
  kind: 'project' | 'review' | 'next-topic';
  title: string;
  body: string;
  task: GeneratedTask;
}

export interface SuggestContext {
  goal: string;
  currentPhase?: string;
  completedTopics: string[];
  pendingTopics: string[];
}

export interface AIProvider {
  readonly id: AISettings['provider'];
  readonly label: string;
  generateRoadmap(input: RoadmapInput): Promise<GeneratedRoadmap>;
  suggestIdeas(ctx: SuggestContext): Promise<GeneratedIdea[]>;
}
