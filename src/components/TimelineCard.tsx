'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles, phaseStyles } from '@/lib/palette';
import ConceptList from './ConceptList';
import WeaknessList from './WeaknessList';
import { getModuleSlug } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import { getLabels, phaseLabels } from '@/lib/labels';

interface TimelineCardProps {
  module: Module;
  category: Category;
  isLast: boolean;
  locale: Locale;
}

export default function TimelineCard({ module, category, isLast, locale }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const styles = categoryStyles[category.color];
  const phaseStyle = phaseStyles[module.phase] ?? phaseStyles['not-started'];
  const labels = getLabels(locale);
  const phaseText = phaseLabels[module.phase]?.[locale] ?? phaseLabels['not-started'][locale];
  const progress = module.concepts.total ? Math.round((module.concepts.learned / module.concepts.total) * 100) : 0;
  const weaknessCount = module.weaknesses.length;

  return (
    <div ref={ref} className={`flex gap-4 transition-all duration-700 ease-smooth ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
      <div className="relative flex flex-col items-center">
        <div className={`relative flex h-10 w-10 items-center justify-center rounded-full ${styles.dot} text-sm font-semibold text-white`}>
          {module.current ? (
            <span className={`absolute inset-0 rounded-full ring-4 ${styles.ring} animate-ping`} />
          ) : null}
          <span className="relative z-10">{module.id}</span>
        </div>
        {!isLast ? <div className="mt-2 w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-800" /> : null}
      </div>

      <div className="flex-1">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 shadow-sm transition hover:border-zinc-300/70 dark:hover:border-zinc-600/60 sm:p-5">
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
            {weaknessCount > 0 ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-200">
                {labels.compare.weaknesses} {weaknessCount}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/${locale}/${getModuleSlug(module.id)}/`} className="text-lg font-semibold text-[color:var(--color-text)] hover:underline">
                {module.title}
              </Link>
              <div className="text-sm text-[color:var(--color-muted)]">{module.subtitle}</div>
              <Link href={`/${locale}/${getModuleSlug(module.id)}/`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-text)] hover:underline">
                {labels.module.learnMore}<span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="text-right text-xs text-[color:var(--color-muted)]">
              {labels.module.concepts} {module.concepts.learned}/{module.concepts.total}
            </div>
          </div>

          <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-1.5 rounded-full ${styles.bar}`} style={{ width: `${progress}%` }} />
          </div>

          {module.keyInsight ? (
            <div className="mt-3 rounded-lg border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-panel)]/70 p-3 text-sm text-[color:var(--color-text)]">
              <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{labels.module.keyInsight}</span>
              <div className="mt-1">{module.keyInsight}</div>
            </div>
          ) : null}

          <div className="mt-3 text-sm italic text-zinc-500">“{module.quote}”</div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
            >
              {expanded ? labels.buttons.collapse : labels.buttons.expand}
              <span>{expanded ? '−' : '+'}</span>
            </button>
            <Link
              href={`/${locale}/${getModuleSlug(module.id)}/`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--color-text)] hover:underline"
            >
              {labels.buttons.learnMore} →
            </Link>
          </div>

          {expanded ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{labels.sections.conceptList}</div>
                <ConceptList items={module.concepts.items} locale={locale} />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{labels.sections.weaknesses}</div>
                <WeaknessList items={module.weaknesses} locale={locale} />
              </div>
              {module.feynman.tested && module.feynman.notes ? (
                <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 text-sm text-[color:var(--color-text)]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{labels.sections.feynman}</div>
                  <div className="mt-2">{module.feynman.notes}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
