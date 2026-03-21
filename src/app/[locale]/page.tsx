import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import type { Locale } from '@/lib/i18n';
import { getCoursePackage } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { siteProject } from '@/lib/site-config';
import GenerateForm from '@/components/GenerateForm';
import CourseList from '@/components/CourseList';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const courses = listMirroredCourseSlugs().map((slug) => {
    const pkg = getCoursePackage(params.locale, slug);
    return {
      slug,
      title: pkg.title,
      topic: (pkg as any).topic || '',
      moduleCount: pkg.modules.length,
      firstModuleSlug: getModuleSlug(pkg.modules[0].id),
    };
  });
  const isZh = params.locale === 'zh';

  return (
    <div className="mx-auto max-w-2xl space-y-16 py-12 px-4">
      {/* Generate entry */}
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">
          {siteProject.title}
        </h1>
        <p className="mt-3 text-sm text-[color:var(--color-muted)] sm:text-base">
          {isZh ? '告诉我你想学什么' : 'Tell me what you want to learn'}
        </p>
        <GenerateForm locale={params.locale} />
        <p className="mt-3 text-xs text-[color:var(--color-muted)]/60 leading-relaxed">
          {isZh
            ? '课程生成约需 20-40 分钟，期间请不要关闭网页。'
            : 'Course generation takes ~20-40 min. Please keep this page open.'}
        </p>
      </section>

      {/* Existing courses */}
      <CourseList initialCourses={courses} locale={params.locale} />
    </div>
  );
}
