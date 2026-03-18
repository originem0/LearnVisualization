'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';
import { getModuleSlug } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

interface TimelineCardProps {
  module: Module;
  category: Category;
  isLast: boolean;
  locale: Locale;
}

export default function TimelineCard({ module, category, isLast, locale }: TimelineCardProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const labels = getLabels(locale);

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

  return (
    <div ref={ref} className={`flex gap-4 transition-all duration-700 ease-smooth ${visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
      {/* Timeline dot + line */}
      <div className="relative flex flex-col items-center">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${styles.dot} text-sm font-bold text-white`}>
          {module.id}
        </div>
        {!isLast ? <div className="mt-2 w-0.5 flex-1 bg-zinc-200 dark:bg-zinc-800" /> : null}
      </div>

      {/* Content card */}
      <div className="flex-1 pb-2">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 transition-colors hover:border-[color:var(--color-muted)]/30 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
            <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
          </div>

          <h3 className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {module.title}
            <span className="ml-2 text-sm font-normal text-[color:var(--color-muted)]">{module.subtitle}</span>
          </h3>

          {module.keyInsight && (
            <p className="mt-3 text-sm italic text-zinc-500 dark:text-zinc-400">
              &ldquo;{module.keyInsight}&rdquo;
            </p>
          )}

          <Link
            href={`/${locale}/${getModuleSlug(module.id)}/`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--color-text)] hover:underline"
          >
            {labels.module?.learnMore || (locale === 'zh' ? '开始学习' : 'Learn more')}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
