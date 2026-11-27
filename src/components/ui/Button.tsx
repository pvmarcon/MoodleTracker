import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'success' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  // Duolingo-like chunky buttons with a pressed state for primary actions.
  primary: 'bg-accent text-accent-fg shadow-pop active:translate-y-[3px] active:shadow-none',
  success: 'bg-success text-white shadow-pop-success active:translate-y-[3px] active:shadow-none',
  // Linear-like quiet buttons for everything else.
  secondary: 'bg-surface-2 text-fg border border-line hover:border-subtle/50 active:scale-[0.98]',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2 active:scale-[0.98]',
  danger: 'bg-danger/10 text-danger border border-danger/30 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-14 px-5 text-base rounded-2xl gap-2 font-bold tracking-wide uppercase',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', icon, block, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-100 focus-ring disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ className, label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg active:scale-90 focus-ring',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
