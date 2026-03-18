import Link from 'next/link';
import type { Module } from '@/lib/types';
import { getModuleSlug } from '@/lib/data';
import { getLabels } from '@/lib/labels';
import type { Locale } from '@/lib/i18n';

interface ModuleNavProps {
  locale: Locale;
  prev?: Module;
  next?: Module;
}

export default function ModuleNav({ locale, prev, next }: ModuleNavProps) {
  const labels = getLabels(locale);
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
