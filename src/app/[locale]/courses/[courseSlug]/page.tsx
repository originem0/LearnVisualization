import Link from 'next/link';
import { getCourseKind, getCoursePackage, getEssayCoursePackage } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { categoryStyles } from '@/lib/palette';
import type { Locale } from '@/lib/i18n';

export default function CourseHomePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const kind = getCourseKind(params.locale, params.courseSlug);
  if (kind === 'essay') {
    return <EssayCourseHomePage params={params} />;
  }

  const pkg = getCoursePackage(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const firstModule = pkg.modules[0];
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;
  const learningPaths = pkg.paths ?? [];

  const grouped = pkg.categories.map((category) => ({
    ...category,
    modules: pkg.modules.filter((module) => module.category === category.id),
  }));

  const getPathModules = (moduleIds: string[]) =>
    moduleIds.flatMap((moduleId) => {
      const module = pkg.modules.find((candidate) => candidate.id === moduleId);
      return module ? [module] : [];
    });

  return (
    <div className="space-y-12 stagger-in">
      {/* ---- Hero: single-column, no sidebar ---- */}
      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '专题课程包' : 'Course package'}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-4xl">{pkg.title}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">{pkg.goal}</p>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link
            href={`${basePath}/${getModuleSlug(firstModule.id)}/`}
            className="rounded-full bg-[color:var(--color-text)] px-5 py-2.5 font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
          >
            {isZh ? '开始第一章' : 'Start chapter 1'}
          </Link>
          <Link
            href={`${basePath}/layers/`}
            className="rounded-full border border-[color:var(--color-border)] px-5 py-2.5 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]"
          >
            {isZh ? '知识地图' : 'Knowledge map'}
          </Link>
        </div>
      </section>

      {/* ---- Module directory: grouped by category ---- */}
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
                      <span className="mt-1 block text-sm text-[color:var(--color-muted)]">{module.subtitle ?? ''}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* ---- Learning paths: only if 2+ paths ---- */}
      {learningPaths.length >= 2 ? (
        <section className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
              {isZh ? '学习路径' : 'Learning paths'}
            </div>
            <h2 className="mt-3 text-xl font-bold text-[color:var(--color-text)] sm:text-2xl">
              {isZh ? '按你的目标开始，而不是只看目录' : 'Start with a route, not just a table of contents'}
            </h2>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {learningPaths.map((path) => {
              const pathModules = getPathModules(path.moduleIds);
              const firstPathModule = pathModules[0];
              return (
                <div
                  key={path.id}
                  className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-[color:var(--color-text)]">{path.title}</div>
                      {path.description ? (
                        <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{path.description}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-[color:var(--color-muted)] dark:bg-[#0b3a45]">
                      {path.moduleIds.length} {isZh ? '章' : 'modules'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {pathModules.slice(0, 5).map((module) => (
                      <span
                        key={`${path.id}-${module.id}`}
                        className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs text-[color:var(--color-muted)]"
                      >
                        {getModuleSlug(module.id)}
                      </span>
                    ))}
                  </div>

                  {firstPathModule ? (
                    <Link
                      href={`${basePath}/${getModuleSlug(firstPathModule.id)}/`}
                      className="mt-5 inline-flex rounded-full border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text)] transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45]"
                    >
                      {isZh ? `从 ${getModuleSlug(firstPathModule.id)} 开始` : `Start from ${getModuleSlug(firstPathModule.id)}`}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EssayCourseHomePage({ params }: { params: { locale: Locale; courseSlug: string } }) {
  const pkg = getEssayCoursePackage(params.locale, params.courseSlug);
  const isZh = params.locale === 'zh';
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;
  const firstChapter = pkg.chapters[0];

  return (
    <div className="mx-auto max-w-[64rem] space-y-12 stagger-in">
      <section className="border-b border-[color:var(--color-border)] pb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {pkg.register === 'essay' ? (isZh ? '叙事随笔课' : 'Narrative essay') : (isZh ? '技术解说课' : 'Explainer course')}
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[color:var(--color-text)] sm:text-5xl">
          {pkg.drivingQuestion}
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-[color:var(--color-muted)]">
          {pkg.centralTension}
        </p>
        {firstChapter ? (
          <Link
            href={`${basePath}/${firstChapter.id}/`}
            className="mt-7 inline-flex rounded-lg bg-[color:var(--color-text)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
          >
            {isZh ? '开始第一章' : 'Start chapter 1'}
          </Link>
        ) : null}
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-text)]">{isZh ? '为什么存在' : 'Why it exists'}</h2>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{pkg.overview.whyExists}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--color-text)]">{isZh ? '指向哪里' : 'Where it points'}</h2>
          <p className="mt-2 text-sm leading-7 text-[color:var(--color-muted)]">{pkg.overview.wherePoints}</p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '旅程' : 'Arc'}
        </h2>
        <div className="mt-5 space-y-3">
          {pkg.chapters.map((chapter, index) => (
            <Link
              key={chapter.id}
              href={`${basePath}/${chapter.id}/`}
              className="grid gap-3 rounded-lg border border-[color:var(--color-border)] p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-[#0b3a45] sm:grid-cols-[4rem_1fr]"
            >
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted)]">{chapter.id}</span>
              <span>
                <span className="block font-medium text-[color:var(--color-text)]">{chapter.title}</span>
                <span className="mt-1 block text-sm leading-6 text-[color:var(--color-muted)]">
                  {chapter.role || pkg.overview.arc[index] || ''}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
