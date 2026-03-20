import Link from 'next/link';
import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import type { Locale } from '@/lib/i18n';
import { getCoursePackage } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { siteProject } from '@/lib/site-config';
import GenerateForm from '@/components/GenerateForm';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const courses = listMirroredCourseSlugs().map((slug) => {
    const pkg = getCoursePackage(params.locale, slug);
    return {
      ...pkg,
      moduleCount: pkg.modules.length,
      firstModule: pkg.modules[0],
    };
  });
  const isZh = params.locale === 'zh';

  return (
    <div className="mx-auto max-w-2xl space-y-16 py-12">
      {/* ---- Generate entry — first visual focus ---- */}
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
          {siteProject.title}
        </h1>
        <p className="mt-3 text-sm text-[color:var(--color-muted)] sm:text-base">
          {isZh ? '告诉我你想学什么' : 'Tell me what you want to learn'}
        </p>
        <GenerateForm locale={params.locale} />
      </section>

      {/* ---- Existing courses — minimal list ---- */}
      {courses.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            {isZh ? '已有课程' : 'Existing courses'}
          </h2>
          <div className="mt-4 divide-y divide-[color:var(--color-border)]">
            {courses.map((course) => (
              <Link
                key={course.slug}
                href={`/${params.locale}/courses/${course.slug}/${getModuleSlug(course.firstModule.id)}/`}
                className="flex items-center justify-between py-3 text-[color:var(--color-text)] transition-colors hover:text-[color:var(--color-accent)]"
              >
                <span className="text-sm font-medium">{course.title}</span>
                <span className="flex items-center gap-3 text-xs text-[color:var(--color-muted)]">
                  <span>{course.moduleCount} {isZh ? '章' : 'ch'}</span>
                  <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
