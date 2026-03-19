import Link from 'next/link';
import { listMirroredCourseSummaries } from '@/lib/course-package-adapter';
import type { Locale } from '@/lib/i18n';
import { siteProject } from '@/lib/site-config';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const courses = listMirroredCourseSummaries();
  const isZh = params.locale === 'zh';

  const totalModules = courses.reduce((sum, c) => sum + c.moduleCount, 0);

  return (
    <div className="space-y-14">
      <section className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '可视化交互学习' : 'Visual Interactive Learning'}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
            {siteProject.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">
            {siteProject.goal}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-[#0b3a45]">
              <div className="text-xl font-bold text-[color:var(--color-text)]">{courses.length}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                {isZh ? '专题课程' : 'Courses'}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-4 dark:bg-[#0b3a45]">
              <div className="text-xl font-bold text-[color:var(--color-text)]">{totalModules}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                {isZh ? '学习模块' : 'Modules'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '全部课程' : 'All courses'}
          </div>
          <h2 className="mt-3 text-xl font-bold text-[color:var(--color-text)] sm:text-2xl">
            {isZh ? '选择一个专题开始' : 'Pick a course to begin'}
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.slug}
              href={`/${params.locale}/courses/${course.slug}/`}
              className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 transition-colors hover:border-[color:var(--color-muted)]/60"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[color:var(--color-text)]">{course.title}</h3>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-[color:var(--color-muted)] dark:bg-[#0b3a45]">
                  {course.status}
                </span>
              </div>
              {course.subtitle ? (
                <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{course.subtitle}</p>
              ) : null}
              <div className="mt-4 flex items-center gap-4 text-xs text-[color:var(--color-muted)]">
                <span>{course.moduleCount} {isZh ? '章' : 'modules'}</span>
                <span className="font-mono">{course.slug}</span>
              </div>
              <div className="mt-3 text-sm font-medium text-[color:var(--color-muted)] group-hover:text-[color:var(--color-text)]">
                {isZh ? '进入课程 →' : 'Enter course →'}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
