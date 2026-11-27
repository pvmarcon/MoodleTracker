import { Fragment, type ReactNode } from 'react';

/** Tiny markdown subset for agent replies: paragraphs, **bold**, *italic* / _italic_, "- " lists. */
const inline = (s: string): ReactNode[] =>
  s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/).map((p, i) => {
    if (p.startsWith('**')) return <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong>;
    if ((p.startsWith('*') || p.startsWith('_')) && p.length > 2) return <em key={i} className="text-muted">{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });

export function Markdown({ text, caret }: { text: string; caret?: boolean }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-fg/90">
      {blocks.map((b, i) => {
        const last = i === blocks.length - 1;
        const lines = b.split('\n');
        const content = lines.every((l) => l.startsWith('- ')) ? (
          <ul className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>
        ) : (
          <p>
            {inline(b)}
            {last && caret && <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-blink bg-accent" />}
          </p>
        );
        return <Fragment key={i}>{content}</Fragment>;
      })}
    </div>
  );
}
