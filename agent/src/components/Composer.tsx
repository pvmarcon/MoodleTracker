import { ArrowUp, ChevronDown, Mic, Paperclip, Square, Sparkles, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/cn';
import { PLACEHOLDERS } from '~/lib/greeting';

const MODES = [
  { id: 'mentor', label: 'Mentor', desc: 'Equilibrado para carreira' },
  { id: 'direto', label: 'Direto ao ponto', desc: 'Respostas curtas e práticas' },
  { id: 'profundo', label: 'Análise profunda', desc: 'Mais contexto e alternativas' },
];

/** Typewriter that cycles example prompts in the placeholder (home only). */
function useCyclingPlaceholder(active: boolean) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) return;
    let i = 0;
    let pos = 0;
    let deleting = false;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = PLACEHOLDERS[i % PLACEHOLDERS.length];
      if (!deleting) {
        pos++;
        setText(full.slice(0, pos));
        if (pos >= full.length) {
          deleting = true;
          t = setTimeout(tick, 2200);
          return;
        }
        t = setTimeout(tick, 28 + Math.random() * 40);
      } else {
        pos -= 2;
        setText(full.slice(0, Math.max(0, pos)));
        if (pos <= 0) {
          deleting = false;
          i++;
          t = setTimeout(tick, 350);
          return;
        }
        t = setTimeout(tick, 14);
      }
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [active]);
  return text;
}

export function Composer({
  onSend,
  onStop,
  busy,
  variant = 'docked',
  autoFocus,
  seed,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  variant?: 'hero' | 'docked';
  autoFocus?: boolean;
  /** Text injected from outside (e.g. quick-action chips). */
  seed?: { text: string; n: number };
}) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState(MODES[0]);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const hero = variant === 'hero';
  const cycling = useCyclingPlaceholder(hero && !value);

  useEffect(() => {
    if (!seed) return;
    setValue(seed.text);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(seed.text.length, seed.text.length);
    });
  }, [seed]);

  // Auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, hero ? 220 : 180)}px`;
  }, [value, hero]);

  const submit = () => {
    if (!value.trim() || busy) return;
    onSend(value);
    setValue('');
  };

  return (
    <div
      className={cn(
        'group relative w-full rounded-[26px] border border-line bg-panel/90 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors focus-within:border-accent/40',
        hero ? 'p-3 pl-4' : 'p-2.5 pl-3.5',
      )}
    >
      <textarea
        ref={ref}
        autoFocus={autoFocus}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={hero ? cycling || ' ' : 'Pergunte ou peça um ajuste…'}
        aria-label="Mensagem para o mentor"
        className={cn(
          'block w-full resize-none bg-transparent pr-2 text-fg placeholder:text-subtle focus:outline-none',
          hero ? 'min-h-[56px] pt-1.5 text-[17px] leading-relaxed' : 'min-h-[28px] pt-1 text-[15px]',
        )}
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-subtle transition hover:bg-raised hover:text-fg focus-ring" title="Anexar arquivo (em breve)" aria-label="Anexar arquivo">
          <Paperclip size={18} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-medium text-muted transition hover:text-fg focus-ring"
            aria-haspopup="listbox"
            aria-expanded={menu}
          >
            <Sparkles size={14} className="text-accent" />
            {mode.label}
            <ChevronDown size={14} className={cn('transition', menu && 'rotate-180')} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div role="listbox" className={cn('absolute left-0 z-20 w-64 animate-rise rounded-2xl border border-line bg-panel p-1.5 shadow-2xl', hero ? 'top-11' : 'bottom-11')}>
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.id === mode.id}
                    onClick={() => {
                      setMode(m);
                      setMenu(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-raised"
                  >
                    <div className="flex-1">
                      <div className="text-[14px] font-medium">{m.label}</div>
                      <div className="text-[12px] text-subtle">{m.desc}</div>
                    </div>
                    {m.id === mode.id && <Check size={16} className="text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex-1" />
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-subtle transition hover:bg-raised hover:text-fg focus-ring" title="Falar (em breve)" aria-label="Falar">
          <Mic size={18} />
        </button>
        {busy ? (
          <button type="button" onClick={onStop} aria-label="Parar resposta" className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition active:scale-90 focus-ring">
            <Square size={13} className="fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Enviar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition enabled:active:scale-90 disabled:bg-raised disabled:text-subtle focus-ring"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
