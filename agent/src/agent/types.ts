import type { GeneratedRoadmap } from '@/services/ai/types';

/**
 * Generative-UI contract. The agent never returns HTML: it streams events and,
 * when useful, asks the client to render one of the known canvases with data.
 * With a real LLM this maps 1:1 to a tool call: render_canvas({ kind, ...data }).
 */
export type IntentId = 'roadmap' | 'resume' | 'interview' | 'salary' | 'transition' | 'chat';

export interface RoadmapCanvas {
  kind: 'roadmap';
  goal: string;
  hoursPerWeek: number;
  weeks: number;
  roadmap: GeneratedRoadmap;
}

export interface ResumeCanvas {
  kind: 'resume';
  role: string;
  score: number;
  sections: { name: string; score: number; status: 'good' | 'warn' | 'bad'; feedback: string }[];
  rewrites: { before: string; after: string; why: string }[];
  keywords: { have: string[]; missing: string[] };
}

export interface InterviewCanvas {
  kind: 'interview';
  role: string;
  questions: { q: string; type: 'comportamental' | 'técnica' | 'situacional'; tip: string; rubric: string[] }[];
}

export interface SalaryCanvas {
  kind: 'salary';
  role: string;
  level: string;
  location: string;
  /** Monthly gross, BRL */
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  offer?: number;
  factors: { label: string; impact: number }[];
  scripts: { title: string; text: string }[];
}

export interface TransitionCanvas {
  kind: 'transition';
  from: string;
  paths: {
    title: string;
    emoji: string;
    overlap: number;
    months: number;
    demand: 'alta' | 'média' | 'baixa';
    salaryDelta: number;
    reuse: string[];
    learn: string[];
  }[];
}

export type Canvas = RoadmapCanvas | ResumeCanvas | InterviewCanvas | SalaryCanvas | TransitionCanvas;
export type CanvasKind = Canvas['kind'];

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  /** Reasoning/status steps shown as "Pensou por Xs". */
  steps?: string[];
  thoughtMs?: number;
  suggestions?: string[];
  /** Canvas produced by this turn (rendered in the side panel + as an inline chip). */
  canvas?: Canvas;
  /** Intent detected for this turn (lets the UI show the right skeleton early). */
  intent?: IntentId;
  pending?: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  intent: IntentId;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type AgentEvent =
  | { type: 'status'; label: string }
  | { type: 'intent'; intent: IntentId; title: string }
  | { type: 'text'; delta: string }
  | { type: 'canvas'; canvas: Canvas }
  | { type: 'suggestions'; items: string[] }
  | { type: 'done' };

export interface AgentProvider {
  readonly id: string;
  readonly label: string;
  run(input: { messages: Message[]; signal?: AbortSignal }): AsyncIterable<AgentEvent>;
}
