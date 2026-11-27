/**
 * AI configuration injected by each platform at startup:
 *  - web (Vite):   setAIEnv(import.meta.env.VITE_*)
 *  - mobile (Expo): setAIEnv(process.env.EXPO_PUBLIC_*)
 * Keeps the shared AI layer free of bundler-specific globals.
 */
export interface AIEnv {
  provider?: 'mock' | 'openai' | 'gemini';
  openaiKey?: string;
  openaiModel?: string;
  geminiKey?: string;
  geminiModel?: string;
  proxyUrl?: string;
}

let current: AIEnv = {};

export const setAIEnv = (env: AIEnv) => {
  current = Object.fromEntries(Object.entries(env).filter(([, v]) => v)) as AIEnv;
};

export const getAIEnv = () => current;
