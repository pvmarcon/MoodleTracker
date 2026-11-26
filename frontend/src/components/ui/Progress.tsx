import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  color,
  className,
  height = 'h-3',
}: {
  value: number;
  color?: string;
  className?: string;
  height?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative w-full overflow-hidden rounded-full bg-surface-2', height, className)}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color ?? 'rgb(var(--success))' }}
      >
        {/* Duolingo-style highlight stripe */}
        {pct > 4 && <div className="absolute left-2 right-2 top-[3px] h-[3px] rounded-full bg-white/30" />}
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 5,
  color = 'rgb(var(--accent))',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
