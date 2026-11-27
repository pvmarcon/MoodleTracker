import { CalendarCheck2, Map, Sparkles, UserRound } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useApp } from '@/store/AppStore';
import { useNav, type Tab } from '@/store/navigation';

const TABS: { id: Tab; label: string; Icon: typeof Map }[] = [
  { id: 'today', label: 'Hoje', Icon: CalendarCheck2 },
  { id: 'roadmaps', label: 'Roadmaps', Icon: Map },
  { id: 'suggestions', label: 'Sugestões IA', Icon: Sparkles },
  { id: 'profile', label: 'Perfil', Icon: UserRound },
];

export function BottomTabBar() {
  const { tab, stack, setTab } = useNav();
  const { suggestions } = useApp();
  const badge = suggestions.filter((s) => s.score >= 60).length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 pb-safe backdrop-blur-xl" aria-label="Navegação principal">
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id && (stack.length === 0 || id !== 'today');
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className="group relative flex h-16 flex-1 flex-col items-center justify-center gap-1 focus-ring"
            >
              <span
                className={cn(
                  'relative flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200',
                  tab === id ? 'bg-accent/15 text-accent' : 'text-subtle group-active:scale-90',
                )}
              >
                <Icon size={21} strokeWidth={tab === id ? 2.4 : 2} />
                {id === 'suggestions' && badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className={cn('text-[11px] font-medium', tab === id ? 'text-fg' : 'text-subtle', active && 'font-semibold')}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
