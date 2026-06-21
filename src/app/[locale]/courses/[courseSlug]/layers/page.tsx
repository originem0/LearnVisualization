import KnowledgeMap from '@/components/KnowledgeMap';
import Link from 'next/link';
import { getCourseKind, getCoursePackage, getEssayCoursePackage } from '@/lib/data';
import type { Locale } from '@/lib/i18n';

export default function CourseLayersPage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  if (getCourseKind(params.locale, params.courseSlug) === 'essay') {
    return <EssayArcPage params={params} />;
  }

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

function EssayArcPage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const pkg = getEssayCoursePackage(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="mx-auto max-w-[54rem] space-y-8">
      <section>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '章节旅程' : 'Chapter arc'}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">{pkg.title}</h1>
        <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{pkg.drivingQuestion}</p>
      </section>
      <div className="space-y-3">
        {pkg.chapters.map((chapter) => (
          <Link key={chapter.id} href={`${basePath}/${chapter.id}/`} className="block rounded-lg border border-[color:var(--color-border)] p-4 hover:bg-zinc-50 dark:hover:bg-[#0b3a45]">
            <div className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">{chapter.id}</div>
            <div className="mt-1 font-medium text-[color:var(--color-text)]">{chapter.title}</div>
            <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{chapter.role}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
