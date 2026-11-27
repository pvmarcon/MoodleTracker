import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '~/lib/cn';

export function Section({ title, right, children, className }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('animate-rise', className)}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-subtle">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Box({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-line bg-panel', className)}>{children}</div>;
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-3 py-3">
      <div className="text-[20px] font-semibold tracking-tight" style={tone ? { color: tone } : undefined}>{value}</div>
      <div className="mt-0.5 text-[12px] text-subtle">{label}</div>
    </div>
  );
}

export function Bar({ value, color = 'rgb(var(--accent))', className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-raised', className)}>
      <div className="h-full origin-left animate-grow rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 9, color, children }: { value: number; size?: number; stroke?: number; color: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1400);
      }}
      className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-subtle transition hover:bg-raised hover:text-fg"
    >
      {ok ? <Check size={13} className="text-mint" /> : <Copy size={13} />} {ok ? 'Copiado' : 'Copiar'}
    </button>
  );
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'bad' | 'warn' | 'accent' }) {
  const t = {
    neutral: 'bg-raised text-muted',
    good: 'bg-mint/15 text-mint',
    bad: 'bg-rose/15 text-rose',
    warn: 'bg-amber/15 text-amber',
    accent: 'bg-accent/15 text-accent',
  }[tone];
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium', t)}>{children}</span>;
}
