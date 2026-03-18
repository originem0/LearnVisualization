import Link from 'next/link';
import { getData, getModuleSlug } from '@/lib/data';
import { categoryStyles } from '@/lib/palette';
import type { Locale } from '@/lib/i18n';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const isZh = params.locale === 'zh';
  const firstModule = data.modules[0];

  // Compute real numbers instead of hardcoding
  const moduleCount = data.modules.length;
  const layerCount = data.categories.length;
  const interactiveCount = moduleCount * 2; // hero + secondary per module

  const grouped = data.categories.map((category) => ({
    ...category,
    modules: data.modules.filter((module) => module.category === category.id),
  }));

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_0.95fr] lg:p-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
              {isZh ? '可视化交互学习' : 'Visual Interactive Learning'}
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-5xl">
              {data.project.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--color-muted)] sm:text-lg">
              {isZh
                ? '不是术语堆砌，不是静态文档。这里把 LLM 从 token、embedding、注意力、Transformer，到训练、对齐、涌现与上下文窗口，拆成可以看、可以玩、可以一层层穿透的学习页面。'
                : 'Not a glossary dump and not static docs. This path turns LLMs into a visual, interactive learning experience.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/${params.locale}/${getModuleSlug(firstModule.id)}/`}
                className="rounded-full bg-[color:var(--color-text)] px-5 py-2.5 font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
              >
                {isZh ? '从第一章开始' : 'Start from Chapter 1'}
              </Link>
              <Link
                href={`/${params.locale}/layers/`}
                className="rounded-full border border-[color:var(--color-border)] px-5 py-2.5 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                {isZh ? '查看知识地图' : 'Knowledge map'}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">{moduleCount}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '模块' : 'Modules'}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">{layerCount}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '知识层' : 'Layers'}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">{interactiveCount}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '交互演示' : 'Interactive demos'}
                </div>
              </div>
            </div>
          </div>

          {/* Mini knowledge map — replaces static ASCII panel */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 dark:border-zinc-800">
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {isZh ? '核心路径' : 'Core path'}
            </div>
            <div className="space-y-2">
              {grouped.map((group, layerIdx) => {
                const isLast = layerIdx === grouped.length - 1;
                return (
                  <div key={group.id}>
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${categoryStyles[group.color].dot}`} />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{group.name}</span>
                    </div>
                    <div className="ml-4 mt-1 flex flex-wrap items-center gap-1">
                      {group.modules.map((mod, i) => (
                        <span key={mod.id} className="flex items-center">
                          <Link
                            href={`/${params.locale}/${getModuleSlug(mod.id)}/`}
                            className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
                          >
                            {getModuleSlug(mod.id)}
                          </Link>
                          {i < group.modules.length - 1 && (
                            <span className="mx-0.5 text-xs text-zinc-600">→</span>
                          )}
                        </span>
                      ))}
                    </div>
                    {!isLast && (
                      <div className="ml-5 h-3 border-l border-zinc-700" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Learning path routing — 3 personas */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Link
          href={`/${params.locale}/s01/`}
          className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 transition-colors hover:border-[color:var(--color-muted)]/60"
        >
          <div className="text-2xl">🔰</div>
          <h3 className="mt-3 text-lg font-bold text-[color:var(--color-text)]">
            {isZh ? '系统学习' : 'Full path'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {isZh
              ? '从 s01 顺着走到 s12。每一章为下一章铺路，概念层层递进。适合想完整理解 LLM 的人。'
              : 'Walk from s01 to s12. Each chapter sets up the next. For those who want complete understanding.'}
          </p>
          <div className="mt-4 font-mono text-xs text-[color:var(--color-muted)] group-hover:text-[color:var(--color-text)]">
            s01 → s02 → … → s12
          </div>
        </Link>

        <Link
          href={`/${params.locale}/s01/`}
          className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 transition-colors hover:border-[color:var(--color-muted)]/60"
        >
          <div className="text-2xl">⚡</div>
          <h3 className="mt-3 text-lg font-bold text-[color:var(--color-text)]">
            {isZh ? '只看核心机制' : 'Core mechanism'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {isZh
              ? '4 章搞定 LLM 核心原理：token 化 → 注意力 → Transformer → 预训练。最小知识量，最大密度。'
              : 'Four chapters for the core: tokens → attention → transformer → pre-training. Minimum effort, maximum density.'}
          </p>
          <div className="mt-4 font-mono text-xs text-[color:var(--color-muted)] group-hover:text-[color:var(--color-text)]">
            s01 → s03 → s04 → s05
          </div>
        </Link>

        <Link
          href={`/${params.locale}/s07/`}
          className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 transition-colors hover:border-[color:var(--color-muted)]/60"
        >
          <div className="text-2xl">🎯</div>
          <h3 className="mt-3 text-lg font-bold text-[color:var(--color-text)]">
            {isZh ? '应用导向' : 'Application-focused'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
            {isZh
              ? '已经会用但想知道为什么？对齐 → Prompt → 上下文窗口，直接讲你每天在用的东西。'
              : 'Already using LLMs and want to know why? Alignment → Prompting → Context windows.'}
          </p>
          <div className="mt-4 font-mono text-xs text-[color:var(--color-muted)] group-hover:text-[color:var(--color-text)]">
            s07 → s08 → s11
          </div>
        </Link>
      </section>

      {/* Full module grid by layer */}
      <section className="space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '全部模块' : 'All modules'}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-[color:var(--color-text)]">
            {isZh ? '按知识层组织' : 'Organized by knowledge layer'}
          </h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
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
                      href={`/${params.locale}/${getModuleSlug(module.id)}/`}
                      className="flex items-start rounded-xl border border-[color:var(--color-border)] px-4 py-3 transition-colors hover:border-[color:var(--color-muted)]/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
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
        </div>
      </section>
    </div>
  );
}
