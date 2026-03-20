import TimelineCard from '@/components/TimelineCard';
import BarChart from '@/components/BarChart';
import { getCategoriesById, getCoursePackage } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';
import { categoryStyles } from '@/lib/palette';

export default function CourseTimelinePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const pkg = getCoursePackage(params.locale, params.courseSlug);
  const categoriesById = getCategoriesById(pkg);
  const labels = getLabels(params.locale);
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">{labels.sections.timelineTitle}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">{labels.sections.timelineSubtitle}</p>
      </section>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="mb-3 text-sm font-semibold text-[color:var(--color-muted)]">{labels.sections.layersTitle}</div>
        <div className="flex flex-wrap gap-3">
          {pkg.categories.map((category) => {
            const styles = categoryStyles[category.color];
            return (
              <div key={category.id} className="flex items-center gap-2 text-xs font-medium">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                <span>{category.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-10">
        {pkg.modules.map((module, index) => {
          const category = categoriesById[module.category];
          return (
            <TimelineCard
              key={module.id}
              module={module}
              category={category}
              isLast={index === pkg.modules.length - 1}
              locale={params.locale}
              basePath={basePath}
            />
          );
        })}
      </section>

      <BarChart modules={pkg.modules} categoriesById={categoriesById} locale={params.locale} basePath={basePath} />
    </div>
  );
}
