'use client';

import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { Tabs } from './ui/Tabs';
import { categoryStyles } from '@/lib/palette';
import ConceptList from './ConceptList';
import PitfallList from './PitfallList';
import { NarrativeBlockRenderer } from './NarrativeRenderer';
import ModuleNav from './ModuleNav';
import { getModuleComponents } from '@/lib/module-registry';
import ConceptMapRenderer from './ConceptMapRenderer';
import type { Locale } from '@/lib/i18n';
import { getModuleSlug } from '@/lib/data';
import { getLabels } from '@/lib/labels';

interface ModuleDetailProps {
  module: Module;
  category: Category;
  locale: Locale;
  prev?: Module;
  next?: Module;
}

export default function ModuleDetail({ module, category, locale, prev, next }: ModuleDetailProps) {
  const styles = categoryStyles[category.color];
  const labels = getLabels(locale);
  const isZh = locale === 'zh';
  const registry = getModuleComponents(module.id);

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

  const HeroInteractive = registry?.heroInteractive ?? null;
  const SecondaryInteractive = registry?.secondaryInteractive ?? null;
  const conceptMapSchema = registry?.conceptMapSchema ?? null;

  const focusQuestionMatch = module.narrative?.[0]?.type === 'heading'
    ? module.narrative[0].content.match(/^(?:焦点问题|Focus Question)[:：]\s*(.+)$/)
    : null;
  const focusQuestion = module.focusQuestion ?? focusQuestionMatch?.[1] ?? null;
  const narrativeBlocks = !module.focusQuestion && focusQuestion ? module.narrative?.slice(1) ?? [] : module.narrative ?? [];
  const quickRoute = module.logicChain.slice(0, 3);

  const openingSection = module.opening ? (
    <section className="overflow-hidden rounded-xl bg-zinc-100/70 dark:bg-[#0b3a45]/70">
      {(() => {
        const paragraphs = module.opening.split('\n\n');
        const hasNumberArray = (p: string) => /\[[\d, ]+\]/.test(p);

        return (
          <div className="mx-auto max-w-2xl p-6 sm:p-8">
            {paragraphs.map((p, i) => {
              if (hasNumberArray(p)) {
                const match = p.match(/["”]([^"”]+)["”].*?(\[[\d, ]+\])/);
                if (match) {
                  const humanText = match[1];
                  const numbers = match[2];
                  return (
                    <div key={i} className={`${i > 0 ? 'mt-6' : ''}`}>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 p-6 dark:bg-[#073642]">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">你输入</div>
                          <div className="text-2xl font-bold tracking-wide text-[color:var(--color-text)]">{humanText}</div>
                        </div>
                        <div className="flex flex-col items-center justify-center rounded-xl bg-zinc-900 p-6 dark:bg-[#001f27]">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-[#93a1a1]">模型看到</div>
                          <div className="font-mono text-base font-bold leading-relaxed text-emerald-400 sm:text-lg">{numbers}</div>
                          <div className="mt-1 h-4 w-2 animate-pulse bg-emerald-400" aria-hidden />
                        </div>
                      </div>
                    </div>
                  );
                }
              }
              return (
                <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-base leading-[1.75] text-[color:var(--color-text)]`}>{p}</p>
              );
            })}
          </div>
        );
      })()}
    </section>
  ) : null;

  const keyInsightSection = module.keyInsight ? (
    <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/80 p-5 dark:bg-[#0b3a45]/45 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {isZh ? '本章关键洞察' : 'Key insight'}
        </div>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)] sm:text-base">{module.keyInsight}</p>
      </div>
    </section>
  ) : null;

  const narrativeBody = narrativeBlocks.length > 0 ? (
    <article className="mx-auto max-w-2xl pb-8 prose-custom">
      {narrativeBlocks.map((block, i) => (
        <NarrativeBlockRenderer key={i} block={block} accentBorder={headingBorder} />
      ))}
    </article>
  ) : null;

  const bridgeSection = module.bridgeTo && next ? (
    <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/80 p-6 dark:bg-[#0b3a45]/55 sm:p-8">
      <div className="mx-auto max-w-2xl">
        {module.bridgeTo.split('\n\n').map((p, i) => (
          <p key={i} className={`${i > 0 ? 'mt-4' : ''} text-sm leading-[1.75] text-[color:var(--color-text)] sm:text-base`}>
            {p}
          </p>
        ))}
        <div className="mt-6 flex items-center gap-2">
          <span className="text-xl text-[color:var(--color-muted)]">↓</span>
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
      <header className="pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
          <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">{module.title}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)] sm:text-base">{module.subtitle}</p>
        {module.quote && (
          <p className="mt-4 border-l-2 border-[color:var(--color-border)] pl-3 text-sm italic text-[color:var(--color-muted)]">
            “{module.quote}”
          </p>
        )}

        {(focusQuestion || quickRoute.length > 0) && (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            {focusQuestion && (
              <section className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/80 p-4 dark:bg-[#0b3a45]/45">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  {isZh ? '本章焦点问题' : 'Focus question'}
                </div>
                <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)] sm:text-base">{focusQuestion}</p>
              </section>
            )}

            {quickRoute.length > 0 && (
              <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                  {isZh ? '本章路线' : 'Chapter route'}
                </div>
                <ol className="mt-3 space-y-2">
                  {quickRoute.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[color:var(--color-text)]">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-semibold text-[color:var(--color-muted)] dark:bg-[#0b3a45]">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        )}
      </header>

      {HeroInteractive && <div className="mx-auto max-w-2xl pb-10"><HeroInteractive /></div>}

      <Tabs tabs={tabs} defaultTab="learn">
        <div className="space-y-12">
          {openingSection}
          {keyInsightSection}
          {conceptMapSchema && <ConceptMapRenderer schema={conceptMapSchema} color={category.color} />}
          {narrativeBody}
          {bridgeSection}
        </div>

        <div className="space-y-8">
          {SecondaryInteractive && <div className="mx-auto max-w-2xl"><SecondaryInteractive /></div>}
        </div>

        <div className="space-y-8">
          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
            <h2 className="text-base font-semibold text-[color:var(--color-text)]">{labels.sections.conceptList}</h2>
            <div className="mt-4">
              <ConceptList items={module.concepts.items} locale={locale} />
            </div>
          </section>

          <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
            <h2 className="text-base font-semibold text-[color:var(--color-text)]">{labels.sections.logicChain}</h2>
            <ol className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
              {module.logicChain.length ? (
                module.logicChain.map((step, index) => (
                  <li key={`${step}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 leading-6">
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
              <h2 className="text-base font-semibold text-[color:var(--color-text)]">{labels.sections.examples}</h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
                {module.examples.length ? (
                  module.examples.map((example, index) => (
                    <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 leading-6">
                      {example}
                    </li>
                  ))
                ) : (
                  <li className="text-[color:var(--color-muted)]">{labels.empty.examples}</li>
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <h2 className="text-base font-semibold text-[color:var(--color-text)]">{labels.sections.counterexamples}</h2>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
                {module.counterexamples.length ? (
                  module.counterexamples.map((example, index) => (
                    <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 leading-6">
                      {example}
                    </li>
                  ))
                ) : (
                  <li className="text-[color:var(--color-muted)]">{labels.empty.counterexamples}</li>
                )}
              </ul>
            </section>
          </div>

          {module.pitfalls.length > 0 && (
            <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
              <h2 className="text-base font-semibold text-[color:var(--color-text)]">{labels.sections.pitfalls}</h2>
              <div className="mt-4">
                <PitfallList items={module.pitfalls} locale={locale} />
              </div>
            </section>
          )}
        </div>
      </Tabs>

      <div className="pt-10">
        <ModuleNav locale={locale} prev={prev} next={next} />
      </div>
    </div>
  );
}
