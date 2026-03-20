import type { NarrativeBlock, StepItem } from '@/lib/types';

/* ── Narrative block renderers ── */

export function NarrativeHeading({ content }: { content: string }) {
  return (
    <h2 className="mt-8 mb-3 text-xl font-bold text-[color:var(--color-text)] sm:mt-10 sm:mb-4">
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

function inferCodeLabel(content: string): string {
  const first = content.trimStart();
  if (/^(\$|sudo |npm |npx |yarn |pnpm |git |pip |brew |apt |docker |curl |wget )/.test(first)) return 'Shell';
  if (/[∑∏∫∂√≈≠≤≥∈∉⊂⊃∧∨¬∀∃]/.test(first) || /\\(frac|sqrt|sum|int)\b/.test(first)) return 'Formula';
  if (/^(SELECT |INSERT |UPDATE |DELETE |CREATE |ALTER |DROP |WITH )/im.test(first)) return 'SQL';
  if (/\b(def |import |from |class |if __name__|print\(|lambda )/.test(first)) return 'Python';
  if (/\b(const |let |var |function |=>|async |import \{)/.test(first)) return 'JavaScript';
  return 'Code';
}

export function NarrativeCode({ content, label }: { content: string; label?: string }) {
  const displayLabel = label || inferCodeLabel(content);
  return (
    <div className="relative my-4 overflow-hidden rounded-lg bg-[#F3F4F6] px-4 py-3 shadow-sm sm:my-5">
      <span className="absolute right-3 top-2 text-[10px] font-medium tracking-wide text-zinc-400 select-none">
        {displayLabel}
      </span>
      <pre className="overflow-x-auto text-sm leading-relaxed text-zinc-800">
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function NarrativeDiagram({ content, label }: { content: string; label?: string }) {
  return (
    <div className="my-5 overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] sm:my-7">
      <div className="border-b border-[color:var(--color-border)] px-4 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {label || '结构图'}
        </div>
      </div>
      <div className="overflow-x-auto bg-zinc-50/70 px-4 py-4 dark:bg-[#0b3a45]/35">
        <pre className="mx-auto w-fit min-w-full text-sm leading-7 text-[color:var(--color-text)] sm:min-w-0">
          <code>{content}</code>
        </pre>
      </div>
    </div>
  );
}

export function NarrativeComparison({ content, label }: { content: string; label?: string }) {
  const lines = content.split('\n').filter(Boolean);

  const parseItem = (line: string) => {
    const zhColonIdx = line.indexOf('：');
    const enColonIdx = line.indexOf(':');
    const colonIdx = zhColonIdx > 0 ? zhColonIdx : enColonIdx;
    if (colonIdx > 0) return { heading: line.slice(0, colonIdx), body: line.slice(colonIdx + 1).trim() };
    return { heading: '', body: line };
  };

  return (
    <div className="my-5 sm:my-7">
      {label && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="grid grid-cols-1 gap-px border border-[color:var(--color-border)] sm:grid-cols-2">
        {lines.map((line, idx) => {
          const item = parseItem(line);
          const letter = String.fromCharCode(65 + idx);
          return (
            <div key={idx} className="bg-[color:var(--color-panel)] p-4">
              <div className="mb-1 text-sm font-bold text-[color:var(--color-text)]">
                {letter}. {item.heading || `方案 ${letter}`}
              </div>
              <p className="text-sm leading-7 text-[color:var(--color-text)]">{item.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NarrativeCallout({ content }: { content: string }) {
  return (
    <div className="my-5 border-l-[3px] border-[color:var(--color-border)] pl-4 sm:my-7">
      <div className="text-[1.05rem] font-medium leading-7 text-[color:var(--color-text)]">
        {content}
      </div>
    </div>
  );
}

export function NarrativeSteps({ label, steps }: { label?: string; steps: StepItem[] }) {
  return (
    <div className="my-5 sm:my-7">
      {label && (
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="relative space-y-3 pl-8" role="list">
        {/* Vertical connecting line */}
        {steps.length > 1 && (
          <div
            className="absolute left-[11px] top-[10px] w-[2px] bg-[color:var(--color-border)]"
            style={{ height: 'calc(100% - 20px)' }}
            aria-hidden="true"
          />
        )}
        {steps.map((step, i) => {
          const renderVisual = (visual: string, highlight: string) => {
            if (!highlight) return visual;
            const parts = highlight.split(',').map((s) => s.trim()).filter(Boolean);
            const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const re = new RegExp(`(${escaped.join('|')})`, 'g');
            return visual.split(re).map((seg, j) =>
              re.test(seg)
                ? <span key={j} className="font-bold text-[color:var(--color-text)]">{seg}</span>
                : <span key={j}>{seg}</span>
            );
          };

          return (
            <div key={i} className="relative" role="listitem" aria-label={`步骤 ${i + 1}/${steps.length}: ${step.title}`}>
              {/* Step number — on the vertical line */}
              <span className="absolute -left-8 top-1 flex h-6 w-6 items-center justify-center text-xs font-bold text-[color:var(--color-muted)] ring-4 ring-[color:var(--color-bg)] bg-[color:var(--color-bg)]">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-semibold text-[color:var(--color-text)]">{step.title}</div>
                <div className="mt-0.5 text-xs leading-5 text-[color:var(--color-muted)]">{step.description}</div>
                <div className="mt-1.5 overflow-x-auto rounded-lg bg-[#F3F4F6] px-3 py-2 shadow-sm">
                  <pre className="text-sm leading-6 text-zinc-800">
                    <code>{renderVisual(step.visual, step.highlight)}</code>
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NarrativeBlockRenderer({ block }: { block: NarrativeBlock }) {
  switch (block.type) {
    case 'heading':
      return <NarrativeHeading content={block.content} />;
    case 'text':
      return <NarrativeText content={block.content} />;
    case 'code':
      return <NarrativeCode content={block.content} label={block.label} />;
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
