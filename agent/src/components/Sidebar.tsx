import { Moon, PanelLeftClose, Search, SquarePen, Sun, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { INTENTS } from '~/agent/intents';
import type { Conversation } from '~/agent/types';
import { cn } from '~/lib/cn';

const group = (iso: string) => {
  const d = new Date(iso);
  const t = new Date();
  const days = Math.floor((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  return days <= 0 ? 'Hoje' : days === 1 ? 'Ontem' : days <= 7 ? 'Últimos 7 dias' : 'Anteriores';
};

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  mobile,
  theme,
  onToggleTheme,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  mobile?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  const [q, setQ] = useState('');
  const list = conversations.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()));
  const groups = list.reduce<Record<string, Conversation[]>>((acc, c) => {
    (acc[group(c.updatedAt)] ??= []).push(c);
    return acc;
  }, {});

  return (
    <aside className="flex h-full w-[272px] flex-col border-r border-line bg-panel/70 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-3">
        <div className="flex items-center gap-2 pl-1">
          <img src="/icon.svg" alt="" className="h-7 w-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-tight">
            Trilha <span className="font-serif text-[17px] font-normal italic text-accent">Mentor</span>
          </span>
        </div>
        <div className="flex-1" />
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-fg focus-ring" aria-label="Fechar barra lateral">
          {mobile ? <X size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div className="space-y-2 px-3">
        <button onClick={onNew} className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-line bg-raised/60 px-3 text-[14px] font-medium transition hover:border-subtle/50 active:scale-[0.98] focus-ring">
          <SquarePen size={16} className="text-accent" /> Nova conversa
        </button>
        <label className="flex h-9 items-center gap-2 rounded-xl px-3 text-subtle focus-within:bg-raised">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversas" className="w-full bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none" />
        </label>
      </div>

      <nav className="thin-scroll mt-2 flex-1 overflow-y-auto px-2 pb-4">
        {!list.length && <p className="px-3 py-6 text-center text-[13px] text-subtle">{q ? 'Nada encontrado.' : 'Suas conversas aparecem aqui.'}</p>}
        {Object.entries(groups).map(([g, cs]) => (
          <div key={g} className="mt-3">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">{g}</div>
            {cs.map((c) => {
              const it = INTENTS[c.intent];
              return (
                <div key={c.id} className={cn('group relative flex items-center rounded-xl', c.id === activeId ? 'bg-raised' : 'hover:bg-raised/60')}>
                  <button onClick={() => onSelect(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left focus-ring">
                    <it.icon size={15} className="shrink-0" style={{ color: it.color }} />
                    <span className={cn('truncate text-[13.5px]', c.id === activeId ? 'text-fg' : 'text-muted')}>{c.title}</span>
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    className="mr-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-subtle hover:text-rose group-hover:flex focus-ring"
                    aria-label={`Excluir ${c.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-line p-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-mint text-[13px] font-semibold text-white">V</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">Visitante</div>
          <div className="text-[11px] text-subtle">Modo demonstração</div>
        </div>
        <button onClick={onToggleTheme} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-fg focus-ring" aria-label="Alternar tema">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </aside>
  );
}
