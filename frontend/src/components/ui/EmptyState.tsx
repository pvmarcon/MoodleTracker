import type { ReactNode } from 'react';

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-2 text-4xl">{emoji}</div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
