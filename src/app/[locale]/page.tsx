import Link from 'next/link';
import { getData } from '@/lib/data';
import type { Locale } from '@/lib/i18n';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const isZh = params.locale === 'zh';

  return (
    <div className="space-y-10">
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6">
        <div className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          {isZh ? '学习路径' : 'Learning Path'}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{data.project.title}</h1>
        <p className="mt-3 text-base text-[color:var(--color-muted)]">{data.project.goal}</p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/${params.locale}/timeline/`}
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[color:var(--color-text)] hover:bg-[color:var(--color-panel)]"
          >
            {isZh ? '进入时间线' : 'Open timeline'}
          </Link>
          <Link
            href={`/${params.locale}/compare/`}
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[color:var(--color-text)] hover:bg-[color:var(--color-panel)]"
          >
            {isZh ? '版本对比' : 'Compare modules'}
          </Link>
          <Link
            href={`/${params.locale}/layers/`}
            className="rounded-full border border-[color:var(--color-border)] px-4 py-2 text-[color:var(--color-text)] hover:bg-[color:var(--color-panel)]"
          >
            {isZh ? '架构层' : 'Architecture layers'}
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold">{isZh ? '时间线' : 'Timeline'}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{isZh ? '循序渐进的学习路径与进度追踪。' : 'Progressive path with milestones and progress tracking.'}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold">{isZh ? '版本对比' : 'Compare'}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{isZh ? '横向对比不同模块的掌握情况。' : 'Compare modules side-by-side.'}</p>
        </div>
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold">{isZh ? '架构层' : 'Layers'}</h2>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">{isZh ? '从宏观视角理解知识结构。' : 'Understand the macro architecture of concepts.'}</p>
        </div>
      </section>
    </div>
  );
}
