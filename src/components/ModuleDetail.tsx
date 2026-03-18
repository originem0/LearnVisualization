'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Category, Module, NarrativeBlock, StepItem } from '@/lib/types';
import ConceptMapS01 from './ConceptMapS01';
import ConceptMapS02 from './ConceptMapS02';
import ConceptMapS03 from './ConceptMapS03';
import ConceptMapS04 from './ConceptMapS04';
import ConceptMapS05 from './ConceptMapS05';
import ConceptMapS06 from './ConceptMapS06';
import ConceptMapS07 from './ConceptMapS07';
import ConceptMapS08 from './ConceptMapS08';
import ConceptMapS09 from './ConceptMapS09';
import ConceptMapS10 from './ConceptMapS10';
import ConceptMapS11 from './ConceptMapS11';
import ConceptMapS12 from './ConceptMapS12';
import { Tabs } from './ui/Tabs';
import { categoryStyles } from '@/lib/palette';
import ConceptList from './ConceptList';
import WeaknessList from './WeaknessList';
import type { Locale } from '@/lib/i18n';
import { getModuleSlug } from '@/lib/data';
import { getLabels } from '@/lib/labels';

const TokenizerPlayground = dynamic(() => import('./interactive/TokenizerPlayground'), { ssr: false });
const BPESimulator = dynamic(() => import('./interactive/BPESimulator'), { ssr: false });
const VectorArithmetic = dynamic(() => import('./interactive/VectorArithmetic'), { ssr: false });
const EmbeddingLookup = dynamic(() => import('./interactive/EmbeddingLookup'), { ssr: false });
const AttentionHeatmap = dynamic(() => import('./interactive/AttentionHeatmap'), { ssr: false });
const QKVStepper = dynamic(() => import('./interactive/QKVStepper'), { ssr: false });
const TransformerFlow = dynamic(() => import('./interactive/TransformerFlow'), { ssr: false });
const ArchitectureCompare = dynamic(() => import('./interactive/ArchitectureCompare'), { ssr: false });
const NextWordGame = dynamic(() => import('./interactive/NextWordGame'), { ssr: false });
const MLMvsCLM = dynamic(() => import('./interactive/MLMvsCLM'), { ssr: false });
const LossLandscape = dynamic(() => import('./interactive/LossLandscape'), { ssr: false });
const LRScheduleViz = dynamic(() => import('./interactive/LRScheduleViz'), { ssr: false });
const AlignmentCompare = dynamic(() => import('./interactive/AlignmentCompare'), { ssr: false });
const LoRACalculator = dynamic(() => import('./interactive/LoRACalculator'), { ssr: false });
const PromptWorkshop = dynamic(() => import('./interactive/PromptWorkshop'), { ssr: false });
const FewShotBuilder = dynamic(() => import('./interactive/FewShotBuilder'), { ssr: false });
const ScalingLawPlotter = dynamic(() => import('./interactive/ScalingLawPlotter'), { ssr: false });
const TrainingBudgetCalc = dynamic(() => import('./interactive/TrainingBudgetCalc'), { ssr: false });
const EmergenceStaircase = dynamic(() => import('./interactive/EmergenceStaircase'), { ssr: false });
const CoTToggle = dynamic(() => import('./interactive/CoTToggle'), { ssr: false });
const ContextLengthCalc = dynamic(() => import('./interactive/ContextLengthCalc'), { ssr: false });
const ContextFitCalc = dynamic(() => import('./interactive/ContextFitCalc'), { ssr: false });
const FullPipelineTracer = dynamic(() => import('./interactive/FullPipelineTracer'), { ssr: false });
const KnowledgeNetwork = dynamic(() => import('./interactive/KnowledgeNetwork'), { ssr: false });

interface ModuleDetailProps {
  module: Module;
  category: Category;
  locale: Locale;
  prev?: Module;
  next?: Module;
}

/* ── Narrative block renderers ── */

function NarrativeHeading({ content, accentBorder }: { content: string; accentBorder: string }) {
  return (
    <h2 className={`mt-12 mb-4 border-l-4 pl-4 text-xl font-bold text-[color:var(--color-text)] ${accentBorder}`}>
      {content}
    </h2>
  );
}

function NarrativeText({ content }: { content: string }) {
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

function NarrativeCode({ content }: { content: string }) {
  return (
    <pre className="my-6 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed text-zinc-100 dark:bg-zinc-800">
      <code>{content}</code>
    </pre>
  );
}

function NarrativeDiagram({ content, label }: { content: string; label?: string }) {
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

function NarrativeComparison({ content, label }: { content: string; label?: string }) {
  const lines = content.split('\n').filter(Boolean);
  // Expect exactly 2 lines for a visual comparison; fall back to stacked if more
  const left = lines[0] || '';
  const right = lines[1] || '';

  // Parse "label: description" from each line
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
        {/* Left — blue */}
        <div className="flex flex-col items-center rounded-xl border-2 border-blue-300 bg-blue-50/60 p-5 text-center dark:border-blue-500/30 dark:bg-blue-500/5">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-lg dark:bg-blue-500/20">
            <span aria-hidden>Aa</span>
          </div>
          {a.heading && <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{a.heading}</div>}
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text)]">{a.body}</p>
        </div>
        {/* Right — amber */}
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

function NarrativeCallout({ content }: { content: string }) {
  return (
    <div className="my-8 rounded-lg border-2 border-dashed border-[color:var(--color-border)] p-6 text-center text-lg font-medium text-[color:var(--color-text)]">
      {content}
    </div>
  );
}

function NarrativeSteps({ label, steps }: { label?: string; steps: StepItem[] }) {
  return (
    <div className="my-8">
      {label && (
        <div className="mb-4 text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{label}</div>
      )}
      <div className="space-y-4">
        {steps.map((step, i) => {
          // Highlight matching tokens in the visual text
          const renderVisual = (visual: string, highlight: string) => {
            if (!highlight) return visual;
            // Escape regex special chars, split on comma for multiple highlights
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
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]"
            >
              {/* Step header */}
              <div className="flex items-center gap-3 border-b border-[color:var(--color-border)] px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white dark:bg-blue-600">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-[color:var(--color-text)]">{step.title}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{step.description}</div>
                </div>
              </div>
              {/* Visual content */}
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

function NarrativeBlockRenderer({ block, accentBorder }: { block: NarrativeBlock; accentBorder: string }) {
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

/* ── Collapsible metadata section ── */

function MetadataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
        {title}
        <span className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">{children}</div>
    </details>
  );
}

/* ── Navigation bar (shared) ── */

function ModuleNav({ locale, prev, next, labels }: { locale: Locale; prev?: Module; next?: Module; labels: ReturnType<typeof getLabels> }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/${locale}/timeline/`} className="text-sm font-semibold text-[color:var(--color-text)] hover:underline">
        ← {labels.sections.backTimeline}
      </Link>
      <div className="flex flex-wrap gap-3 text-sm">
        {prev ? (
          <Link
            href={`/${locale}/${getModuleSlug(prev.id)}/`}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel)]"
          >
            {getModuleSlug(prev.id)}: {prev.title}
          </Link>
        ) : null}
        {next ? (
          <Link
            href={`/${locale}/${getModuleSlug(next.id)}/`}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel)]"
          >
            {getModuleSlug(next.id)}: {next.title}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/* ── Dashboard (old) layout for modules without narrative ── */

function DashboardLayout({ module, category, locale, prev, next }: ModuleDetailProps) {
  const styles = categoryStyles[category.color];
  const labels = getLabels(locale);

  const conceptNames = module.concepts.items.map((item) => item.name);
  const conceptMap = conceptNames.length >= 2 ? conceptNames.slice(0, -1).map((name, index) => `${name} → ${conceptNames[index + 1]}`) : [];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
          <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-[color:var(--color-text)]">{module.title}</h1>
        <p className="mt-1 text-base text-[color:var(--color-muted)]">{module.subtitle}</p>
        {module.quote ? <p className="mt-4 text-sm italic text-zinc-500">&ldquo;{module.quote}&rdquo;</p> : null}
        {module.keyInsight ? (
          <div className="mt-4 rounded-lg border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-panel)]/70 p-4 text-sm text-[color:var(--color-text)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{labels.module.keyInsight}</div>
            <div className="mt-1">{module.keyInsight}</div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.module.conceptMap}</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{labels.module.conceptMapDesc}</p>
          <div className="mt-4 space-y-2">
            {conceptMap.length ? (
              conceptMap.map((item) => (
                <div key={item} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 text-sm text-[color:var(--color-text)]">
                  {item}
                </div>
              ))
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">{labels.empty.conceptMap}</div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.logicChain}</h2>
          <ol className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.logicChain.length ? (
              module.logicChain.map((step, index) => (
                <li key={`${step}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {index + 1}. {step}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">{labels.empty.logic}</li>
            )}
          </ol>
        </section>
      </div>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.conceptList}</h2>
        <div className="mt-4">
          <ConceptList items={module.concepts.items} locale={locale} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.examples}</h2>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.examples.length ? (
              module.examples.map((example, index) => (
                <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {example}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">{labels.empty.examples}</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.counterexamples}</h2>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.counterexamples.length ? (
              module.counterexamples.map((example, index) => (
                <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {example}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">{labels.empty.counterexamples}</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.weaknesses}</h2>
        <div className="mt-4">
          <WeaknessList items={module.weaknesses} locale={locale} />
        </div>
      </section>


      <ModuleNav locale={locale} prev={prev} next={next} labels={labels} />
    </div>
  );
}

/* ── Narrative layout for modules with rich content ── */

function NarrativeLayout({ module, category, locale, prev, next }: ModuleDetailProps) {
  const styles = categoryStyles[category.color];
  const labels = getLabels(locale);
  const isZh = locale === 'zh';

  // Derive accent border color from category
  const borderColorMap: Record<string, string> = {
    blue: 'border-l-blue-400 dark:border-l-blue-400',
    emerald: 'border-l-emerald-400 dark:border-l-emerald-400',
    purple: 'border-l-purple-400 dark:border-l-purple-400',
    amber: 'border-l-amber-400 dark:border-l-amber-400',
    red: 'border-l-red-400 dark:border-l-red-400',
  };
  const headingBorder = borderColorMap[category.color] ?? borderColorMap.blue;

  const tabs = [
    { id: 'learn', label: isZh ? '学习' : 'Learn' },
    { id: 'interactive', label: isZh ? '交互' : 'Interactive' },
    { id: 'deep', label: isZh ? '深入' : 'Deep Dive' },
  ];

  const heroInteractive = (() => {
    if (module.id === 1) return <TokenizerPlayground />;
    if (module.id === 2) return <VectorArithmetic />;
    if (module.id === 3) return <AttentionHeatmap />;
    if (module.id === 4) return <TransformerFlow />;
    if (module.id === 5) return <NextWordGame />;
    if (module.id === 6) return <LossLandscape />;
    if (module.id === 7) return <AlignmentCompare />;
    if (module.id === 8) return <PromptWorkshop />;
    if (module.id === 9) return <ScalingLawPlotter />;
    if (module.id === 10) return <EmergenceStaircase />;
    if (module.id === 11) return <ContextLengthCalc />;
    if (module.id === 12) return <FullPipelineTracer />;
    return null;
  })();

  const secondaryInteractive = (() => {
    if (module.id === 1) return <BPESimulator />;
    if (module.id === 2) return <EmbeddingLookup />;
    if (module.id === 3) return <QKVStepper />;
    if (module.id === 4) return <ArchitectureCompare />;
    if (module.id === 5) return <MLMvsCLM />;
    if (module.id === 6) return <LRScheduleViz />;
    if (module.id === 7) return <LoRACalculator />;
    if (module.id === 8) return <FewShotBuilder />;
    if (module.id === 9) return <TrainingBudgetCalc />;
    if (module.id === 10) return <CoTToggle />;
    if (module.id === 11) return <ContextFitCalc />;
    if (module.id === 12) return <KnowledgeNetwork />;
    return null;
  })();

  const conceptMap = (() => {
    if (module.id === 1) return <ConceptMapS01 />;
    if (module.id === 2) return <ConceptMapS02 />;
    if (module.id === 3) return <ConceptMapS03 />;
    if (module.id === 4) return <ConceptMapS04 />;
    if (module.id === 5) return <ConceptMapS05 />;
    if (module.id === 6) return <ConceptMapS06 />;
    if (module.id === 7) return <ConceptMapS07 />;
    if (module.id === 8) return <ConceptMapS08 />;
    if (module.id === 9) return <ConceptMapS09 />;
    if (module.id === 10) return <ConceptMapS10 />;
    if (module.id === 11) return <ConceptMapS11 />;
    if (module.id === 12) return <ConceptMapS12 />;
    return null;
  })();

  const openingSection = module.opening ? (
    <section className="overflow-hidden rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40">
      {(() => {
        const paragraphs = module.opening.split('\n\n');
        const hasNumberArray = (p: string) => /\[[\d, ]+\]/.test(p);

        return (
          <div className="p-6 sm:p-8">
            {paragraphs.map((p, i) => {
              if (hasNumberArray(p)) {
                const match = p.match(/["“]([^"”]+)["”].*?(\[[\d, ]+\])/);
                if (match) {
                  const humanText = match[1];
                  const numbers = match[2];
                  return (
                    <div key={i} className={`${i > 0 ? 'mt-6' : ''}`}>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 p-6 dark:bg-zinc-700/40">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">你输入</div>
                          <div className="text-3xl font-bold tracking-wide text-[color:var(--color-text)]">{humanText}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center rounded-xl bg-zinc-900 p-6 dark:bg-zinc-950">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">模型看到</div>
                          <div className="font-mono text-lg font-bold leading-relaxed text-emerald-400 sm:text-xl">{numbers}</div>
                          <div className="mt-1 h-4 w-2 animate-pulse bg-emerald-400" aria-hidden />
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <p key={i} className={`${i > 0 ? 'mt-4' : ''} font-mono text-base leading-[1.75] text-[color:var(--color-text)]`}>{p}</p>
                );
              }
              return (
                <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-lg leading-[1.75] text-[color:var(--color-text)]`}>{p}</p>
              );
            })}
          </div>
        );
      })()}
    </section>
  ) : null;

  const narrativeBody = module.narrative && module.narrative.length > 0 ? (
    <article className="mx-auto max-w-2xl pb-8 prose-custom">
      {module.narrative.map((block, i) => (
        <NarrativeBlockRenderer key={i} block={block} accentBorder={headingBorder} />
      ))}
    </article>
  ) : null;

  const bridgeSection = module.bridgeTo && next ? (
    <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/80 p-6 dark:bg-zinc-800/30 sm:p-8">
      <div className="mx-auto max-w-2xl">
        {module.bridgeTo.split('\n\n').map((p, i) => (
          <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-base leading-[1.75] text-[color:var(--color-text)]`}>
            {p}
          </p>
        ))}
        <div className="mt-6 flex items-center gap-2">
          <span className="text-2xl text-[color:var(--color-muted)]">↓</span>
          <Link
            href={`/${locale}/${getModuleSlug(next.id)}/`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${styles.soft} transition-opacity hover:opacity-80`}
          >
            {getModuleSlug(next.id)}: {next.title} →
          </Link>
        </div>
      </div>
    </section>
  ) : null;

  return (
    <div className="space-y-0">
      {/* A. Hero */}
      <header className="pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
          <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--color-text)]">{module.title}</h1>
        <p className="mt-2 text-lg text-[color:var(--color-muted)]">{module.subtitle}</p>
      </header>

      {/* Hero interactive (always visible) */}
      {heroInteractive ? <div className="mx-auto max-w-2xl pb-10">{heroInteractive}</div> : null}

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="learn">
        <div className="space-y-10">
          {openingSection}
          {conceptMap}
          {narrativeBody}
          {bridgeSection}
        </div>

        <div className="space-y-8">
          {secondaryInteractive ? <div className="mx-auto max-w-2xl">{secondaryInteractive}</div> : null}
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.conceptList}</h2>
            <div className="mt-4">
              <ConceptList items={module.concepts.items} locale={locale} />
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
            <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.logicChain}</h2>
            <ol className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
              {module.logicChain.length ? (
                module.logicChain.map((step, index) => (
                  <li key={`${step}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                    {index + 1}. {step}
                  </li>
                ))
              ) : (
                <li className="text-[color:var(--color-muted)]">{labels.empty.logic}</li>
              )}
            </ol>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.examples}</h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
                {module.examples.length ? (
                  module.examples.map((example, index) => (
                    <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                      {example}
                    </li>
                  ))
                ) : (
                  <li className="text-[color:var(--color-muted)]">{labels.empty.examples}</li>
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.counterexamples}</h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
                {module.counterexamples.length ? (
                  module.counterexamples.map((example, index) => (
                    <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                      {example}
                    </li>
                  ))
                ) : (
                  <li className="text-[color:var(--color-muted)]">{labels.empty.counterexamples}</li>
                )}
              </ul>
            </section>
          </div>

          {module.weaknesses.length > 0 && (
            <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.weaknesses}</h2>
              <div className="mt-4">
                <WeaknessList items={module.weaknesses} locale={locale} />
              </div>
            </section>
          )}
        </div>
      </Tabs>

      {/* Navigation */}
      <div className="pt-10">
        <ModuleNav locale={locale} prev={prev} next={next} labels={labels} />
      </div>
    </div>
  );
}

/* ── Main export ── */

export default function ModuleDetail(props: ModuleDetailProps) {
  const hasNarrative = props.module.narrative && props.module.narrative.length > 0;
  return hasNarrative ? <NarrativeLayout {...props} /> : <DashboardLayout {...props} />;
}
