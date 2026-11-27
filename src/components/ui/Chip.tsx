import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Chip({
  active,
  onClick,
  children,
  icon,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'tap inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-ring',
        active ? 'border-accent/60 bg-accent/15 text-fg' : 'border-line bg-surface text-muted hover:text-fg',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'accent' }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/15 text-warning',
    success: 'bg-success/15 text-success',
    accent: 'bg-accent/15 text-accent',
  };
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium', tones[tone])}>{children}</span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-line bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 flex-1 rounded-lg text-[13px] font-medium transition-all focus-ring',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
