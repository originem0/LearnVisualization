import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

interface BarChartProps {
  modules: Module[];
  categoriesById: Record<string, Category>;
  locale: Locale;
}

export default function BarChart({ modules, categoriesById, locale }: BarChartProps) {
  const labels = getLabels(locale);
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{labels.sections.progress}</h2>
        <div className="text-xs text-[color:var(--color-muted)]">{labels.sections.progressHint}</div>
      </div>
      <div className="space-y-3">
        {modules.map((module) => {
          const category = categoriesById[module.category];
          const styles = categoryStyles[category.color];
          const ratio = module.concepts.total ? module.concepts.learned / module.concepts.total : 0;
          return (
            <div key={module.id} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-[color:var(--color-text)]">{module.title}</span>
                <span className="text-xs text-[color:var(--color-muted)]">{Math.round(ratio * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className={`h-2 rounded-full ${styles.bar}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
