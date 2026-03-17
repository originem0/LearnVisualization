import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles, phaseStyles } from '@/lib/palette';
import ConceptList from './ConceptList';
import WeaknessList from './WeaknessList';
import type { Locale } from '@/lib/i18n';
import { getModuleSlug } from '@/lib/data';
import { getLabels, phaseLabels } from '@/lib/labels';

interface ModuleDetailProps {
  module: Module;
  category: Category;
  locale: Locale;
  prev?: Module;
  next?: Module;
}

export default function ModuleDetail({ module, category, locale, prev, next }: ModuleDetailProps) {
  const styles = categoryStyles[category.color];
  const phaseStyle = phaseStyles[module.phase] ?? phaseStyles['not-started'];
  const labels = getLabels(locale);
  const phaseText = phaseLabels[module.phase]?.[locale] ?? phaseLabels['not-started'][locale];

  const conceptNames = module.concepts.items.map((item) => item.name);
  const conceptMap = conceptNames.length >= 2 ? conceptNames.slice(0, -1).map((name, index) => `${name} → ${conceptNames[index + 1]}`) : [];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${phaseStyle.className}`}>{phaseText}</span>
          {module.feynman.tested ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                module.feynman.passed
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200'
              }`}
            >
              🧪 {module.feynman.passed ? labels.badges.passed : labels.badges.failed}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold text-[color:var(--color-text)]">{module.title}</h1>
        <p className="mt-1 text-base text-[color:var(--color-muted)]">{module.subtitle}</p>
        {module.quote ? <p className="mt-4 text-sm italic text-zinc-500">“{module.quote}”</p> : null}
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

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.feynman}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {module.feynman.tested ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                module.feynman.passed
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200'
              }`}
            >
              {module.feynman.passed ? labels.badges.passed : labels.badges.failed}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-200">
              {labels.empty.feynman}
            </span>
          )}
          <span className="text-[color:var(--color-muted)]">{module.feynman.notes || labels.empty.feynman}</span>
        </div>
      </section>

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
    </div>
  );
}
