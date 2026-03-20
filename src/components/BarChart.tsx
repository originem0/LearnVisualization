import type { Category } from '@/lib/types';
import type { CourseModule } from '@/lib/course-schema';
import { categoryStyles } from '@/lib/palette';
import { getModuleSlug } from '@/lib/module-slug';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

interface BarChartProps {
  modules: CourseModule[];
  categoriesById: Record<string, Category>;
  locale: Locale;
  basePath?: string;
}

export default function BarChart({ modules, categoriesById, locale, basePath = `/${locale}` }: BarChartProps) {
  const grouped: Record<string, CourseModule[]> = {};
  for (const m of modules) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-lg font-semibold text-[color:var(--color-text)]">
        {locale === 'zh' ? '模块概览' : 'Module Overview'}
      </h2>
      {Object.entries(grouped).map(([catId, mods]) => {
        const category = categoriesById[catId];
        if (!category) return null;
        const styles = categoryStyles[category.color];
        return (
          <div key={catId}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">{category.name}</span>
            </div>
            <div className="space-y-1.5">
              {mods.map((m) => (
                <Link
                  key={m.id}
                  href={`${basePath}/${getModuleSlug(m.id)}/`}
                  className="block rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-sm transition-colors hover:border-[color:var(--color-muted)]"
                >
                  <span className="font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(m.id)}</span>
                  <span className="ml-2 font-medium text-[color:var(--color-text)]">{m.title}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
