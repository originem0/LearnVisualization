import Link from 'next/link';
import { getCourseData } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { categoryStyles } from '@/lib/palette';
import type { Locale } from '@/lib/i18n';

export default function CourseHomePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const data = getCourseData(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const firstModule = data.modules[0];
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  const grouped = data.categories.map((category) => ({
    ...category,
    modules: data.modules.filter((module) => module.category === category.id),
  }));

  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '专题课程包' : 'Course package'}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">{data.project.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">{data.project.goal}</p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href={`${basePath}/${getModuleSlug(firstModule.id)}/`}
            className="rounded-full bg-[color:var(--color-text)] px-5 py-2.5 font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
          >
            {isZh ? '进入第一章' : 'Start from chapter 1'}
          </Link>
          <Link
            href={`${basePath}/layers/`}
            className="rounded-full border border-[color:var(--color-border)] px-5 py-2.5 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]"
          >
            {isZh ? '查看知识地图' : 'Knowledge map'}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {grouped.map((group) => {
          const styles = categoryStyles[group.color];
          return (
            <div key={group.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{group.name}</span>
                <span className="text-xs text-[color:var(--color-muted)]">{group.modules.length} {isZh ? '个模块' : 'modules'}</span>
              </div>
              <div className="mt-4 space-y-2">
                {group.modules.map((module) => (
                  <Link
                    key={module.id}
                    href={`${basePath}/${getModuleSlug(module.id)}/`}
                    className="flex items-start rounded-xl border border-[color:var(--color-border)] px-4 py-3 transition-colors hover:border-[color:var(--color-muted)]/40 hover:bg-zinc-50 dark:hover:bg-[#0b3a45]"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-[color:var(--color-muted)]">{getModuleSlug(module.id)}</span>
                    <span>
                      <span className="block font-medium text-[color:var(--color-text)]">{module.title}</span>
                      <span className="mt-1 block text-sm text-[color:var(--color-muted)]">{module.subtitle}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
