import { useMemo, useState } from 'react';
import { INTENTS, QUICK_INTENTS } from '~/agent/intents';
import { pickGreeting, segments } from '~/lib/greeting';
import { Composer } from './Composer';

export function Home({ onSend }: { onSend: (t: string) => void }) {
  const greeting = useMemo(() => pickGreeting(), []);
  const [seed, setSeed] = useState<{ text: string; n: number }>();

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-4 pb-10 pt-16">
      {/* Aurora */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-[420px] w-[620px] -translate-x-1/2 animate-drift rounded-full bg-accent/20 blur-[110px]" />
        <div className="absolute left-[58%] top-[30%] h-[260px] w-[360px] animate-drift rounded-full bg-mint/10 blur-[100px] [animation-delay:-6s]" />
      </div>

      <div className="relative w-full max-w-[720px]">
        <h1 key={greeting.title} className="animate-rise text-center text-[34px] font-semibold leading-[1.15] tracking-tight sm:text-[46px]">
          {segments(greeting.title).map((s, i) =>
            s.em ? (
              <span key={i} className="text-gradient font-serif text-[1.08em] font-normal italic">
                {s.text}
              </span>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-md animate-rise text-center text-[15px] text-muted [animation-delay:80ms]">{greeting.subtitle}</p>

        <div className="mt-9 animate-rise [animation-delay:160ms]">
          <Composer variant="hero" onSend={onSend} autoFocus seed={seed} />
        </div>

        <div className="mt-5 flex animate-rise flex-wrap justify-center gap-2 [animation-delay:240ms]">
          {QUICK_INTENTS.map((id) => {
            const it = INTENTS[id];
            return (
              <button
                key={id}
                onClick={() => setSeed({ text: it.prompt, n: Date.now() })}
                className="group flex items-center gap-2 rounded-full border border-line bg-panel/60 px-3.5 py-2 text-[13px] text-muted backdrop-blur transition hover:border-subtle/50 hover:text-fg active:scale-[0.97] focus-ring"
              >
                <it.icon size={15} style={{ color: it.color }} />
                {it.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="absolute bottom-4 px-4 text-center text-[11px] text-subtle">
        Modo demonstração · respostas simuladas localmente. Confira informações importantes.
      </p>
    </div>
  );
}
