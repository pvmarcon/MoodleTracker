import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ToastItem {
  id: number;
  message: ReactNode;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  tone?: 'default' | 'success';
}

const Ctx = createContext<(t: Omit<ToastItem, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-[60] flex flex-col items-center gap-2 px-4 pb-safe">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl shadow-black/40',
              t.tone === 'success' ? 'border-success/30 bg-surface' : 'border-line bg-surface',
            )}
          >
            {t.icon}
            <div className="flex-1">{t.message}</div>
            {t.action && (
              <button
                className="text-[13px] font-semibold text-accent"
                onClick={() => {
                  t.action!.onClick();
                  setItems((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
