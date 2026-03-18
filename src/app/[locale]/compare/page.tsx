import { getData, getCategoriesById } from '@/lib/data';
import { getLabels } from '@/lib/labels';
import { getModuleSlug } from '@/lib/data';
import { categoryStyles } from '@/lib/palette';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

export default function ComparePage({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const categoriesById = getCategoriesById(data);
  const labels = getLabels(params.locale);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{labels.nav.compare}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          {params.locale === 'zh' ? '所有模块的概念一览。' : 'Overview of concepts across all modules.'}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {data.modules.map((module) => {
          const category = categoriesById[module.category];
          const styles = categoryStyles[category.color];
          return (
            <Link
              key={module.id}
              href={`/${params.locale}/${getModuleSlug(module.id)}/`}
              className="block rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-4 transition-colors hover:border-[color:var(--color-muted)]"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
                <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
              </div>
              <div className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">{module.title}</div>
              <div className="mt-1 text-sm text-[color:var(--color-muted)]">{module.subtitle}</div>
              {module.concepts.items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {module.concepts.items.slice(0, 5).map((item) => (
                    <span
                      key={item.name}
                      className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-[color:var(--color-text)] dark:bg-zinc-800"
                    >
                      {item.name}
                    </span>
                  ))}
                  {module.concepts.items.length > 5 && (
                    <span className="text-xs text-[color:var(--color-muted)]">
                      +{module.concepts.items.length - 5}
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
