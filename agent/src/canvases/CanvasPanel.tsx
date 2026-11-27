import { X } from 'lucide-react';
import { INTENTS } from '~/agent/intents';
import type { Canvas, IntentId } from '~/agent/types';
import { cn } from '~/lib/cn';
import { InterviewCanvas } from './InterviewCanvas';
import { canvasTitle } from './meta';
import { ResumeCanvas } from './ResumeCanvas';
import { RoadmapCanvas } from './RoadmapCanvas';
import { SalaryCanvas } from './SalaryCanvas';
import { TransitionCanvas } from './TransitionCanvas';

export function CanvasBody({ canvas, onAsk }: { canvas: Canvas; onAsk: (t: string) => void }) {
  switch (canvas.kind) {
    case 'roadmap':
      return <RoadmapCanvas data={canvas} onAsk={onAsk} />;
    case 'resume':
      return <ResumeCanvas data={canvas} onAsk={onAsk} />;
    case 'interview':
      return <InterviewCanvas data={canvas} onAsk={onAsk} />;
    case 'salary':
      return <SalaryCanvas data={canvas} onAsk={onAsk} />;
    case 'transition':
      return <TransitionCanvas data={canvas} onAsk={onAsk} />;
  }
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="skeleton h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-4 w-2/3 rounded" />
          <div className="skeleton h-3 w-1/3 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[68px] rounded-2xl" />)}</div>
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
    </div>
  );
}

/** Side panel on desktop, full-screen sheet on mobile. */
export function CanvasPanel({
  canvas,
  pendingIntent,
  onClose,
  onAsk,
  className,
}: {
  canvas: Canvas | null;
  pendingIntent?: IntentId;
  onClose: () => void;
  onAsk: (t: string) => void;
  className?: string;
}) {
  const intent = canvas?.kind ?? pendingIntent ?? 'chat';
  const it = INTENTS[intent];
  return (
    <section className={cn('flex h-full min-h-0 flex-col bg-bg', className)} aria-label="Painel gerado">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4 pt-safe">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${it.color} 15%, transparent)` }}>
          <it.icon size={16} style={{ color: it.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium">{canvas ? canvasTitle(canvas) : `Gerando ${it.label.toLowerCase()}…`}</div>
          <div className="text-[11px] text-subtle">Interface gerada para este pedido</div>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-fg focus-ring" aria-label="Fechar painel">
          <X size={18} />
        </button>
      </header>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div key={canvas ? JSON.stringify(canvas).length + canvas.kind : 'sk'} className="mx-auto max-w-[640px] animate-rise">
          {canvas ? <CanvasBody canvas={canvas} onAsk={onAsk} /> : <Skeleton />}
        </div>
      </div>
    </section>
  );
}
