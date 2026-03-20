import KnowledgeMap from '@/components/KnowledgeMap';
import { getCoursePackage } from '@/lib/data';
import type { Locale } from '@/lib/i18n';

export default function CourseLayersPage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const pkg = getCoursePackage(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="space-y-8">
      <section>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '知识地图' : 'Knowledge Map'}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          {isZh ? `${pkg.title} 的结构地图` : `Structure map of ${pkg.title}`}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
          {isZh ? '从课程包视角查看模块层次、分类与学习路径。' : 'View module structure, categories, and learning path from the course package.'}
        </p>
      </section>

      <KnowledgeMap categories={pkg.categories} modules={pkg.modules} locale={params.locale} basePath={basePath} />
    </div>
  );
}
