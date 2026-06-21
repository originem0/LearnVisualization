import Link from 'next/link';
import TimelineCard from '@/components/TimelineCard';
import BarChart from '@/components/BarChart';
import { getCategoriesById, getCourseKind, getCoursePackage, getEssayCoursePackage } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';
import { categoryStyles } from '@/lib/palette';

export default function CourseTimelinePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  if (getCourseKind(params.locale, params.courseSlug) === 'essay') {
    return <EssayTimelinePage params={params} />;
  }

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

function EssayTimelinePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const pkg = getEssayCoursePackage(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="mx-auto max-w-[54rem] space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          {isZh ? '阅读顺序' : 'Reading order'}
        </h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{pkg.centralTension}</p>
      </section>
      <section className="space-y-4">
        {pkg.chapters.map((chapter, index) => (
          <div key={chapter.id} className="grid grid-cols-[2rem_1fr] gap-4">
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--color-border)] font-mono text-xs text-[color:var(--color-muted)]">
                {index + 1}
              </span>
              {index < pkg.chapters.length - 1 ? <span className="h-full w-px bg-[color:var(--color-border)]" /> : null}
            </div>
            <Link href={`${basePath}/${chapter.id}/`} className="rounded-lg border border-[color:var(--color-border)] p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]">
              <div className="font-medium text-[color:var(--color-text)]">{chapter.title}</div>
              <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{chapter.role}</p>
            </Link>
          </div>
        ))}
      </section>
    </div>
  );
}
