import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

/**
 * Tiny stack navigator (tab + pushed screens). Mirrors the mental model of
 * React Navigation (bottom tabs + native stack) to ease the Expo port.
 */
export type Tab = 'today' | 'roadmaps' | 'suggestions' | 'profile';
export type Screen = { name: 'roadmap'; id: string; focusTaskId?: string } | { name: 'generator' };

interface Nav {
  tab: Tab;
  stack: Screen[];
  setTab(t: Tab): void;
  push(s: Screen): void;
  pop(): void;
  reset(tab: Tab, stack?: Screen[]): void;
}

const Ctx = createContext<Nav | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('today');
  const [stack, setStack] = useState<Screen[]>([]);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setStack([]);
    window.scrollTo({ top: 0 });
  }, []);
  const push = useCallback((s: Screen) => {
    setStack((st) => [...st, s]);
    window.scrollTo({ top: 0 });
  }, []);
  const pop = useCallback(() => setStack((st) => st.slice(0, -1)), []);
  const reset = useCallback((t: Tab, st: Screen[] = []) => {
    setTabState(t);
    setStack(st);
    window.scrollTo({ top: 0 });
  }, []);

  return <Ctx.Provider value={{ tab, stack, setTab, push, pop, reset }}>{children}</Ctx.Provider>;
}

export const useNav = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNav must be used inside <NavigationProvider>');
  return ctx;
};
