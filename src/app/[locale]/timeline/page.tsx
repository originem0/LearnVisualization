import TimelineCard from '@/components/TimelineCard';
import BarChart from '@/components/BarChart';
import { getData, getCategoriesById } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';
import { categoryStyles } from '@/lib/palette';

export default function TimelinePage({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const categoriesById = getCategoriesById(data);
  const labels = getLabels(params.locale);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{labels.sections.timelineTitle}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">{labels.sections.timelineSubtitle}</p>
      </section>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="mb-3 text-sm font-semibold text-[color:var(--color-muted)]">{labels.sections.layersTitle}</div>
        <div className="flex flex-wrap gap-3">
          {data.categories.map((category) => {
            const styles = categoryStyles[category.color];
            return (
              <div key={category.id} className="flex items-center gap-2 text-xs font-medium">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                <span>{category.name}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
            <span>🧪 {labels.sections.feynman}</span>
            <span>⚠️ {labels.sections.weaknesses}</span>
          </div>
        </div>
      </section>

      <section className="space-y-10">
        {data.modules.map((module, index) => {
          const category = categoriesById[module.category];
          return (
            <TimelineCard
              key={module.id}
              module={module}
              category={category}
              isLast={index === data.modules.length - 1}
              locale={params.locale}
            />
          );
        })}
      </section>

      <BarChart modules={data.modules} categoriesById={categoriesById} locale={params.locale} />
    </div>
  );
}
