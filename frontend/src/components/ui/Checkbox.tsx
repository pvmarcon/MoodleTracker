import { Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2;
  return { dx: `${Math.cos(a) * 22}px`, dy: `${Math.sin(a) * 22}px` };
});

/** Round checkbox with a pop + particle burst when checked. */
export function TaskCheckbox({
  checked,
  onChange,
  color = 'rgb(var(--success))',
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
  disabled?: boolean;
  label: string;
}) {
  const [burst, setBurst] = useState(0);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!checked) {
          setBurst((b) => b + 1);
          navigator.vibrate?.(12);
        }
        onChange(!checked);
      }}
      className="relative -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-ring disabled:opacity-40"
    >
      <span
        key={checked ? `on-${burst}` : 'off'}
        className={cn(
          'flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 transition-colors duration-150',
          checked ? 'animate-pop border-transparent' : 'border-subtle/60 hover:border-fg/60',
        )}
        style={checked ? { background: color } : undefined}
      >
        <Check
          size={16}
          strokeWidth={3.5}
          className={cn('text-white transition-all duration-150', checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}
        />
      </span>
      {burst > 0 && checked && (
        <span key={burst} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 animate-burst rounded-full"
              style={{ background: color, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy }}
            />
          ))}
        </span>
      )}
    </button>
  );
}
