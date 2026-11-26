import { capacityMinutes } from './capacity';
import { normalizeIdeas, normalizeRoadmap, parseJSONLoose } from './normalize';
import { IDEAS_SYSTEM, ROADMAP_SYSTEM, ideasUserPrompt, roadmapUserPrompt } from './prompts';
import type { AIProvider } from './types';

type Complete = (system: string, user: string) => Promise<string>;

const build = (id: AIProvider['id'], label: string, complete: Complete): AIProvider => ({
  id,
  label,
  async generateRoadmap(input) {
    const text = await complete(ROADMAP_SYSTEM, roadmapUserPrompt(input, capacityMinutes(input)));
    return normalizeRoadmap(parseJSONLoose(text));
  },
  async suggestIdeas(ctx) {
    const text = await complete(IDEAS_SYSTEM, ideasUserPrompt(ctx));
    return normalizeIdeas(parseJSONLoose(text));
  },
});

const ensureOk = async (res: Response) => {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
};

export const createOpenAIProvider = (apiKey: string, model = 'gpt-4o-mini'): AIProvider =>
  build('openai', `OpenAI · ${model}`, async (system, user) => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const data = await ensureOk(res);
    return data.choices?.[0]?.message?.content ?? '';
  });

export const createGeminiProvider = (apiKey: string, model = 'gemini-2.0-flash'): AIProvider =>
  build('gemini', `Gemini · ${model}`, async (system, user) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.6, responseMimeType: 'application/json' },
      }),
    });
    const data = await ensureOk(res);
    return data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  });

/**
 * Your own backend endpoint (recommended for production: keeps keys server-side).
 * Contract: POST { system, user } -> { text: string }
 */
export const createProxyProvider = (url: string, id: AIProvider['id']): AIProvider =>
  build(id, 'Proxy de IA', async (system, user) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, user }),
    });
    const data = await ensureOk(res);
    return typeof data === 'string' ? data : data.text ?? JSON.stringify(data);
  });
