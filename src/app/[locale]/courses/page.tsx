import Link from 'next/link';
import { listMirroredCourseSummaries } from '@/lib/course-package-adapter';
import type { Locale } from '@/lib/i18n';

export default function CoursesCatalogPage({ params }: { params: { locale: Locale } }) {
  const courses = listMirroredCourseSummaries();
  const isZh = params.locale === 'zh';

  return (
    <div className="space-y-8">
      <section>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '专题目录' : 'Course catalog'}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          {isZh ? 'Learning Site Engine 课程包目录' : 'Learning Site Engine course packages'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
          {isZh
            ? '这里列出当前主项目已经认得的专题课程包。LLM Fundamentals 是现有主站内容，PostgreSQL Internals 是第二专题压力测试。'
            : 'All mirrored course packages currently recognized by the project.'}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {courses.map((course) => (
          <Link
            key={course.slug}
            href={`/${params.locale}/courses/${course.slug}/`}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 transition-colors hover:border-[color:var(--color-muted)]/60"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[color:var(--color-text)]">{course.title}</h2>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-[color:var(--color-muted)] dark:bg-[#0b3a45]">
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
          </Link>
        ))}
      </section>
    </div>
  );
}
