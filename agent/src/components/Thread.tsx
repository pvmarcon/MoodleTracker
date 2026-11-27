import { AlertCircle, ArrowUpRight, Check, ChevronRight, Copy, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { INTENTS } from '~/agent/intents';
import type { Canvas, Message } from '~/agent/types';
import { cn } from '~/lib/cn';
import { canvasTitle } from '~/canvases/meta';
import { Markdown } from './Markdown';

function Thinking({ m }: { m: Message }) {
  const [open, setOpen] = useState(false);
  const steps = m.steps ?? [];
  const working = m.pending && !m.text;
  if (!steps.length) {
    return m.pending ? (
      <div className="flex h-6 items-center gap-1">
        {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-subtle" style={{ animationDelay: `${i * 0.15}s` }} />)}
      </div>
    ) : null;
  }
  if (working) {
    return (
      <div className="space-y-1.5">
        {steps.map((s, i) => {
          const current = i === steps.length - 1;
          return (
            <div key={i} className="flex animate-fade items-center gap-2 text-[13px]">
              {current ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : <Check size={14} className="text-mint" />}
              <span className={cn(current ? 'bg-gradient-to-r from-muted via-fg to-muted bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer' : 'text-subtle')}>{s}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-[13px] text-subtle transition hover:text-muted">
        Pensou por {((m.thoughtMs ?? 0) / 1000).toFixed(1).replace('.', ',')}s
        <ChevronRight size={14} className={cn('transition', open && 'rotate-90')} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1 border-l border-line pl-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-subtle">
              <Check size={13} className="text-mint" /> {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CanvasChip({ canvas, active, onOpen }: { canvas: Canvas; active: boolean; onOpen: () => void }) {
  const it = INTENTS[canvas.kind];
  return (
    <button
      onClick={onOpen}
      className={cn(
        'group flex w-full max-w-md animate-rise items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] focus-ring',
        active ? 'border-accent/40 bg-accent/5' : 'border-line bg-panel hover:border-subtle/50',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${it.color} 15%, transparent)` }}>
        <it.icon size={18} style={{ color: it.color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{canvasTitle(canvas)}</span>
        <span className="block text-[12px] text-subtle">{it.hint} · {active ? 'aberto no painel' : 'abrir painel'}</span>
      </span>
      <ArrowUpRight size={16} className="text-subtle transition group-hover:text-fg" />
    </button>
  );
}

export function Thread({
  messages,
  onSuggestion,
  openCanvasId,
  onOpenCanvas,
  onRetry,
}: {
  messages: Message[];
  onSuggestion: (s: string) => void;
  openCanvasId: string | null;
  onOpenCanvas: (messageId: string) => void;
  onRetry: (text: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, last?.text.length, last?.steps?.length]);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-8 px-4 pb-6 pt-6">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={m.id} className="flex animate-rise justify-end">
            <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-raised px-4 py-2.5 text-[15px] leading-relaxed">{m.text}</div>
          </div>
        ) : (
          <div key={m.id} className="flex animate-rise gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-mint text-white">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <Thinking m={m} />
              {m.canvas && <CanvasChip canvas={m.canvas} active={openCanvasId === m.id} onOpen={() => onOpenCanvas(m.id)} />}
              {m.text && <Markdown text={m.text} caret={m.pending} />}
              {m.error && (
                <div className="flex items-center gap-2 rounded-xl bg-rose/10 px-3 py-2 text-[13px] text-rose">
                  <AlertCircle size={15} /> Algo deu errado.
                </div>
              )}
              {!m.pending && m.text && <Actions text={m.text} onRetry={() => onRetry(messages[i - 1]?.text ?? '')} />}
              {!m.pending && i === messages.length - 1 && m.suggestions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {m.suggestions.map((s) => (
                    <button key={s} onClick={() => onSuggestion(s)} className="animate-rise rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition hover:border-accent/40 hover:text-fg active:scale-[0.97] focus-ring">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

function Actions({ text, onRetry }: { text: string; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="-ml-1.5 flex gap-0.5 text-subtle">
      <button
        onClick={() => {
          navigator.clipboard?.writeText(text.replace(/\*\*|_/g, ''));
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-raised hover:text-fg"
        aria-label="Copiar resposta"
      >
        {copied ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
      </button>
      <button onClick={onRetry} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-raised hover:text-fg" aria-label="Gerar novamente">
        <RotateCcw size={14} />
      </button>
    </div>
  );
}
