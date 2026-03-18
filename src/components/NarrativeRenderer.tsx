import type { NarrativeBlock, StepItem } from '@/lib/types';

/* ── Narrative block renderers ── */

export function NarrativeHeading({ content, accentBorder }: { content: string; accentBorder: string }) {
  return (
    <h2 className={`mt-12 mb-4 border-l-4 pl-4 text-xl font-bold text-[color:var(--color-text)] ${accentBorder}`}>
      {content}
    </h2>
  );
}

export function NarrativeText({ content }: { content: string }) {
  const paragraphs = content.split('\n\n');
  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-base leading-[1.75] text-[color:var(--color-text)]">
          {p}
        </p>
      ))}
    </div>
  );
}

export function NarrativeCode({ content }: { content: string }) {
  return (
    <pre className="my-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-100 dark:bg-zinc-800">
      <code>{content}</code>
    </pre>
  );
}

export function NarrativeDiagram({ content, label }: { content: string; label?: string }) {
  return (
    <div className="relative my-6 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 dark:bg-zinc-900">
      {label && (
        <span className="absolute left-3 top-3 rounded bg-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-200">
          {label}
        </span>
      )}
      <pre className={label ? 'mt-6' : ''}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function NarrativeComparison({ content, label }: { content: string; label?: string }) {
  const lines = content.split('\n').filter(Boolean);
  const left = lines[0] || '';
  const right = lines[1] || '';

  const parseItem = (line: string) => {
    const colonIdx = line.indexOf('：');
    if (colonIdx > 0) return { heading: line.slice(0, colonIdx), body: line.slice(colonIdx + 1).trim() };
    return { heading: '', body: line };
  };

  const a = parseItem(left);
  const b = parseItem(right);

  return (
    <div className="my-8">
      {label && (
        <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center rounded-xl border-2 border-blue-300 bg-blue-50/60 p-5 text-center dark:border-blue-500/30 dark:bg-blue-500/5">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg dark:bg-blue-500/20">
            <span aria-hidden>Aa</span>
          </div>
          {a.heading && <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{a.heading}</div>}
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text)]">{a.body}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border-2 border-amber-300 bg-amber-50/60 p-5 text-center dark:border-amber-500/30 dark:bg-amber-500/5">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg dark:bg-amber-500/20">
            <span aria-hidden>？</span>
          </div>
          {b.heading && <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{b.heading}</div>}
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text)]">{b.body}</p>
        </div>
      </div>
    </div>
  );
}

export function NarrativeCallout({ content }: { content: string }) {
  return (
    <div className="my-8 rounded-lg border-2 border-dashed border-[color:var(--color-border)] p-6 text-center text-lg font-medium text-[color:var(--color-text)]">
      {content}
    </div>
  );
}

export function NarrativeSteps({ label, steps }: { label?: string; steps: StepItem[] }) {
  return (
    <div className="my-8">
      {label && (
        <div className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="space-y-4">
        {steps.map((step, i) => {
          const renderVisual = (visual: string, highlight: string) => {
            if (!highlight) return visual;
            const parts = highlight.split(',').map((s) => s.trim()).filter(Boolean);
            const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const re = new RegExp(`(${escaped.join('|')})`, 'g');
            return visual.split(re).map((seg, j) =>
              re.test(seg)
                ? <span key={j} className="rounded bg-blue-200/80 px-0.5 font-bold text-blue-800 dark:bg-blue-500/30 dark:text-blue-200">{seg}</span>
                : <span key={j}>{seg}</span>
            );
          };

          return (
            <div key={i} className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
              <div className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white dark:bg-blue-600">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[color:var(--color-text)]">{step.title}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{step.description}</div>
                </div>
              </div>
              <pre className="overflow-x-auto px-4 py-3 text-sm leading-relaxed text-[color:var(--color-text)]">
                <code>{renderVisual(step.visual, step.highlight)}</code>
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NarrativeBlockRenderer({ block, accentBorder }: { block: NarrativeBlock; accentBorder: string }) {
  switch (block.type) {
    case 'heading':
      return <NarrativeHeading content={block.content} accentBorder={accentBorder} />;
    case 'text':
      return <NarrativeText content={block.content} />;
    case 'code':
      return <NarrativeCode content={block.content} />;
    case 'diagram':
      return <NarrativeDiagram content={block.content} label={block.label} />;
    case 'comparison':
      return <NarrativeComparison content={block.content} label={block.label} />;
    case 'callout':
      return <NarrativeCallout content={block.content} />;
    case 'steps':
      return block.steps ? <NarrativeSteps label={block.label} steps={block.steps} /> : null;
    default:
      return null;
  }
}
