import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '@/components/ui/Button';
import { useNav } from '@/store/navigation';

/** Large-title header for tab roots. */
export function ScreenHeader({ eyebrow, title, right }: { eyebrow?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-2 pt-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-0.5 text-[13px] font-medium text-subtle first-letter:uppercase">{eyebrow}</div>}
        <h1 className="truncate text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      </div>
      {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
    </header>
  );
}

/** Compact sticky header for pushed screens. */
export function StackHeader({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  const { pop } = useNav();
  return (
    <header className="sticky top-0 z-30 -mx-4 flex h-14 items-center gap-1 border-b border-line/0 bg-bg/85 px-2 pt-safe backdrop-blur-xl">
      <IconButton label="Voltar" onClick={pop}>
        <ChevronLeft size={24} />
      </IconButton>
      <div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{title}</div>
      {right}
    </header>
  );
}
