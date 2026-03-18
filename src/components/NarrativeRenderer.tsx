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
        <p key={i} className="text-base leading-[1.78] text-[color:var(--color-text)]">
          {p}
        </p>
      ))}
    </div>
  );
}

export function NarrativeCode({ content }: { content: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-zinc-950 dark:bg-[#001f27]">
      <div className="border-b border-[color:var(--color-border)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-[#93a1a1]">
        Code / Pseudocode
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed text-zinc-100 dark:text-[#eee8d5]">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function NarrativeDiagram({ content, label }: { content: string; label?: string }) {
  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] shadow-sm">
      <div className="border-b border-[color:var(--color-border)] px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {label || '结构图'}
        </div>
      </div>
      <div className="overflow-x-auto bg-zinc-50/70 px-4 py-5 dark:bg-[#0b3a45]/35">
        <pre className="mx-auto w-fit min-w-full text-sm leading-7 text-[color:var(--color-text)] sm:min-w-0">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}

export function NarrativeComparison({ content, label }: { content: string; label?: string }) {
  const lines = content.split('\n').filter(Boolean);
  const left = lines[0] || '';
  const right = lines[1] || '';

  const parseItem = (line: string) => {
    const zhColonIdx = line.indexOf('：');
    const enColonIdx = line.indexOf(':');
    const colonIdx = zhColonIdx > 0 ? zhColonIdx : enColonIdx;
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
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-500/25 dark:bg-blue-500/8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
              A
            </span>
            <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{a.heading || '方案 A'}</div>
          </div>
          <p className="text-sm leading-7 text-[color:var(--color-text)]">{a.body}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-500/25 dark:bg-amber-500/8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
              B
            </span>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-300">{b.heading || '方案 B'}</div>
          </div>
          <p className="text-sm leading-7 text-[color:var(--color-text)]">{b.body}</p>
        </div>
      </div>
    </div>
  );
}

export function NarrativeCallout({ content }: { content: string }) {
  return (
    <div className="my-8 rounded-2xl border border-[color:var(--color-border)] bg-zinc-50/70 px-5 py-4 dark:bg-[#0b3a45]/35">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
        记住这句
      </div>
      <div className="text-base font-medium leading-7 text-[color:var(--color-text)]">{content}</div>
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
            <div key={i} className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] shadow-sm">
              <div className="flex items-start gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white dark:bg-blue-600">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[color:var(--color-text)]">{step.title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-[color:var(--color-muted)]">{step.description}</div>
                </div>
              </div>
              <div className="overflow-x-auto bg-zinc-50/70 px-4 py-4 dark:bg-[#0b3a45]/30">
                <pre className="text-sm leading-7 text-[color:var(--color-text)]">
                  <code>{renderVisual(step.visual, step.highlight)}</code>
                </pre>
              </div>
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
