import { useCallback, useEffect, useRef, useState } from 'react';
import { uid } from '~/lib/id';
import { mockAgent } from './mockAgent';
import type { AgentProvider, Conversation, Message } from './types';

const STORE = 'mentor:conversations';

const load = (): Conversation[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '[]');
  } catch {
    return [];
  }
};

/**
 * Conversation state + agent runner. Swap `provider` for a real LLM-backed
 * implementation of AgentProvider and nothing else changes.
 */
export function useChat(provider: AgentProvider = mockAgent) {
  const [conversations, setConversations] = useState<Conversation[]>(load);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      // Never persist half-finished turns.
      const clean = conversations.map((c) => ({ ...c, messages: c.messages.map((m) => (m.pending ? { ...m, pending: false } : m)) }));
      localStorage.setItem(STORE, JSON.stringify(clean.slice(0, 50)));
    } catch {
      /* ignore quota / private mode */
    }
  }, [conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const patchMessage = (convId: string, msgId: string, fn: (m: Message) => Message) =>
    setConversations((cs) =>
      cs.map((c) => (c.id !== convId ? c : { ...c, updatedAt: new Date().toISOString(), messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) })),
    );

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || busy) return;
      const now = new Date().toISOString();
      const user: Message = { id: uid('m'), role: 'user', text: body, createdAt: now };
      const reply: Message = { id: uid('m'), role: 'assistant', text: '', createdAt: now, pending: true, steps: [] };

      let convId = activeId;
      let history: Message[] = [];
      if (!convId || !conversations.some((c) => c.id === convId)) {
        convId = uid('c');
        const conv: Conversation = { id: convId, title: body.slice(0, 48), intent: 'chat', messages: [user, reply], createdAt: now, updatedAt: now };
        setConversations((cs) => [conv, ...cs]);
        setActiveId(convId);
        history = [user];
      } else {
        history = [...(conversations.find((c) => c.id === convId)?.messages ?? []), user];
        setConversations((cs) => {
          const c = cs.find((x) => x.id === convId)!;
          const updated = { ...c, messages: [...c.messages, user, reply], updatedAt: now };
          return [updated, ...cs.filter((x) => x.id !== convId)];
        });
      }

      const id = convId;
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      const started = performance.now();
      let firstTurn = history.filter((m) => m.role === 'user').length === 1;

      try {
        for await (const ev of provider.run({ messages: history, signal: ctrl.signal })) {
          switch (ev.type) {
            case 'intent':
              patchMessage(id, reply.id, (m) => ({ ...m, intent: ev.intent }));
              if (ev.intent !== 'chat' || firstTurn) {
                setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, intent: ev.intent === 'chat' ? c.intent : ev.intent, title: firstTurn || ev.intent !== 'chat' ? ev.title : c.title } : c)));
              }
              firstTurn = false;
              break;
            case 'status':
              patchMessage(id, reply.id, (m) => ({ ...m, steps: [...(m.steps ?? []), ev.label] }));
              break;
            case 'canvas':
              patchMessage(id, reply.id, (m) => ({ ...m, canvas: ev.canvas, thoughtMs: Math.round(performance.now() - started) }));
              break;
            case 'text':
              patchMessage(id, reply.id, (m) => ({ ...m, text: m.text + ev.delta, thoughtMs: m.thoughtMs ?? Math.round(performance.now() - started) }));
              break;
            case 'suggestions':
              patchMessage(id, reply.id, (m) => ({ ...m, suggestions: ev.items }));
              break;
            case 'done':
              break;
          }
        }
        patchMessage(id, reply.id, (m) => ({ ...m, pending: false }));
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === 'AbortError';
        patchMessage(id, reply.id, (m) => ({ ...m, pending: false, error: aborted ? undefined : String(e), text: m.text || (aborted ? '_Resposta interrompida._' : '') }));
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [activeId, busy, conversations, provider],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    setActiveId(null);
  }, []);
  const remove = useCallback((id: string) => {
    setConversations((cs) => cs.filter((c) => c.id !== id));
    setActiveId((a) => (a === id ? null : a));
  }, []);

  return { conversations, active, activeId, select: setActiveId, send, stop, busy, newChat, remove, provider };
}
