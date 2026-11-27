import type { AISettings, RoadmapInput } from '@/types';
import { createGeminiProvider, createOpenAIProvider, createProxyProvider } from './llmProviders';
import { mockProvider } from './mockProvider';
import type { AIProvider, GeneratedIdea, GeneratedRoadmap, SuggestContext } from './types';

export type { AIProvider, GeneratedIdea, GeneratedRoadmap } from './types';

const env = import.meta.env;

/**
 * Resolution order:
 *  1. Settings chosen in the app (Perfil > IA), including an on-device key
 *  2. VITE_AI_PROVIDER + VITE_*_API_KEY
 *  3. VITE_AI_PROXY_URL
 *  4. Mock Inteligente
 */
export const resolveProvider = (settings?: AISettings): AIProvider => {
  const provider = settings?.provider && settings.provider !== 'mock' ? settings.provider : (env.VITE_AI_PROVIDER as AISettings['provider']);
  const proxy = env.VITE_AI_PROXY_URL as string | undefined;

  if (provider === 'openai') {
    const key = settings?.apiKey || env.VITE_OPENAI_API_KEY;
    const model = settings?.model || env.VITE_OPENAI_MODEL;
    if (key) return createOpenAIProvider(key, model || undefined);
    if (proxy) return createProxyProvider(proxy, 'openai');
  }
  if (provider === 'gemini') {
    const key = settings?.apiKey || env.VITE_GEMINI_API_KEY;
    const model = settings?.model || env.VITE_GEMINI_MODEL;
    if (key) return createGeminiProvider(key, model || undefined);
    if (proxy) return createProxyProvider(proxy, 'gemini');
  }
  return mockProvider;
};

export interface AIResult<T> {
  data: T;
  provider: AIProvider;
  /** Set when the real provider failed and the mock was used instead. */
  fallbackReason?: string;
}

const withFallback = async <T>(
  settings: AISettings | undefined,
  run: (p: AIProvider) => Promise<T>,
): Promise<AIResult<T>> => {
  const provider = resolveProvider(settings);
  try {
    return { data: await run(provider), provider };
  } catch (err) {
    if (provider.id === 'mock') throw err;
    console.warn('[ai] provider failed, falling back to mock', err);
    return {
      data: await run(mockProvider),
      provider: mockProvider,
      fallbackReason: err instanceof Error ? err.message : String(err),
    };
  }
};

export const aiService = {
  generateRoadmap: (input: RoadmapInput, settings?: AISettings): Promise<AIResult<GeneratedRoadmap>> =>
    withFallback(settings, (p) => p.generateRoadmap(input)),
  suggestIdeas: (ctx: SuggestContext, settings?: AISettings): Promise<AIResult<GeneratedIdea[]>> =>
    withFallback(settings, (p) => p.suggestIdeas(ctx)),
};
