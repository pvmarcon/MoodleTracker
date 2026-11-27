import type { AISettings, RoadmapInput } from '@/types';
import { createGeminiProvider, createOpenAIProvider, createProxyProvider } from './llmProviders';
import { mockProvider } from './mockProvider';
import type { AIProvider, GeneratedIdea, GeneratedRoadmap, SuggestContext } from './types';

export type { AIProvider, GeneratedIdea, GeneratedRoadmap } from './types';

import { getAIEnv } from './env';

export { setAIEnv } from './env';

/**
 * Resolution order:
 *  1. Settings chosen in the app (Perfil > IA), including an on-device key
 *  2. Platform env (VITE_* on web, EXPO_PUBLIC_* on mobile) via setAIEnv
 *  3. Proxy URL
 *  4. Mock Inteligente
 */
export const resolveProvider = (settings?: AISettings): AIProvider => {
  const env = getAIEnv();
  const provider = settings?.provider && settings.provider !== 'mock' ? settings.provider : env.provider;
  const proxy = env.proxyUrl;

  if (provider === 'openai') {
    const key = settings?.apiKey || env.openaiKey;
    const model = settings?.model || env.openaiModel;
    if (key) return createOpenAIProvider(key, model || undefined);
    if (proxy) return createProxyProvider(proxy, 'openai');
  }
  if (provider === 'gemini') {
    const key = settings?.apiKey || env.geminiKey;
    const model = settings?.model || env.geminiModel;
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
