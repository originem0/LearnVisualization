import Link from 'next/link';
import { getData, getModuleSlug } from '@/lib/data';
import { categoryStyles } from '@/lib/palette';
import type { Locale } from '@/lib/i18n';

export default function LocaleHome({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const isZh = params.locale === 'zh';
  const firstModule = data.modules[0];

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
              {isZh ? '可视化学习路径' : 'Visual Learning Path'}
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--color-text)] sm:text-5xl">
              {data.project.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[color:var(--color-muted)] sm:text-lg">
              {isZh
                ? '不是术语堆砌，不是静态文档。这里把 LLM 从 token、embedding、注意力、Transformer，到训练、对齐、涌现与上下文窗口，拆成可以看、可以玩、可以一层层穿透的学习页面。'
                : 'Not a glossary dump and not static docs. This path turns LLMs into a visual, interactive learning experience — from tokens and embeddings to attention, training, alignment, emergence, and context windows.'}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/${params.locale}/${getModuleSlug(firstModule.id)}/`}
                className="rounded-full bg-[color:var(--color-text)] px-5 py-2.5 font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
              >
                {isZh ? '从第一章开始' : 'Start from Chapter 1'}
              </Link>
              <Link
                href={`/${params.locale}/timeline/`}
                className="rounded-full border border-[color:var(--color-border)] px-5 py-2.5 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                {isZh ? '查看完整路径' : 'Open full path'}
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">{data.modules.length}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '模块' : 'Modules'}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">{data.categories.length}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '知识层' : 'Layers'}
                </div>
              </div>
              <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="text-2xl font-bold text-[color:var(--color-text)]">24+</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                  {isZh ? '交互演示' : 'Interactive demos'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-zinc-100 dark:border-zinc-800">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
              {isZh ? '核心路径' : 'Core path'}
            </div>
            <pre className="overflow-x-auto text-sm leading-7 text-zinc-200">
              <code>{`原始文本
   ↓ 分词
Token IDs
   ↓ Embedding
向量表示
   ↓ Attention
上下文聚合
   ↓ Transformer
层层加工
   ↓ Pretrain / Align
能力成形
   ↓ Prompt + Context
输出结果`}</code>
            </pre>
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
              <div className="font-mono text-xs text-zinc-500">while learning:</div>
              <pre className="mt-2 overflow-x-auto text-sm leading-6 text-zinc-300">
                <code>{`see the structure()
play with the mechanism()
understand the trade-off()
connect it to the next layer()`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Core idea */}
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '核心模式' : 'Core pattern'}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-[color:var(--color-text)]">
            {isZh ? '先看到全貌，再动手理解局部' : 'See the whole, then manipulate the parts'}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[color:var(--color-muted)] sm:text-base">
            {isZh
              ? '这个项目不是把 LLM 知识拆成 12 篇孤立文章，而是把它做成一条连续的学习链。每一页都会给你一个核心问题、一张概念关系图、至少一个交互演示，以及通向下一页的桥。'
              : 'This project is not a pile of disconnected articles. Each page gives you a core question, a concept map, at least one interactive demo, and a bridge to the next layer.'}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              {
                title: isZh ? '看结构' : 'See structure',
                desc: isZh ? '用概念图先抓住系统骨架，而不是先背定义。' : 'Start from concept maps, not isolated definitions.',
              },
              {
                title: isZh ? '做实验' : 'Run experiments',
                desc: isZh ? '自己输入、拖动、点下一步，让机制在眼前发生。' : 'Type, drag, toggle, and step through the mechanism yourself.',
              },
              {
                title: isZh ? '看权衡' : 'See trade-offs',
                desc: isZh ? '每一页都强调“为什么这样设计，而不是那样设计”。' : 'Every page explains why this design, not some other one.',
              },
              {
                title: isZh ? '连到下一层' : 'Bridge forward',
                desc: isZh ? '每个概念都不是终点，而是下一层的前提。' : 'Every concept becomes a prerequisite for the next layer.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900/60">
                <div className="font-semibold text-[color:var(--color-text)]">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-6 sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '推荐入口' : 'Suggested entries'}
          </div>
          <div className="mt-4 space-y-3">
            {[
              {
                href: `/${params.locale}/s01/`,
                title: isZh ? '从 Token 开始' : 'Start with Tokens',
                desc: isZh ? '先搞清“模型看到的不是字，而是整数”。' : 'Begin with the idea that models see integers, not words.',
              },
              {
                href: `/${params.locale}/timeline/`,
                title: isZh ? '按路径顺着学' : 'Follow the full path',
                desc: isZh ? '按 12 个模块的顺序，从基础表示走到系统化回顾。' : 'Move from representation to system-level understanding in order.',
              },
              {
                href: `/${params.locale}/layers/`,
                title: isZh ? '从层级视角看' : 'View by layers',
                desc: isZh ? '从基础概念、架构、训练、应用、前沿五层来组织理解。' : 'Organize the whole site into five conceptual layers.',
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl border border-[color:var(--color-border)] p-4 transition-colors hover:border-[color:var(--color-muted)]/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              >
                <div className="font-semibold text-[color:var(--color-text)]">{item.title}</div>
                <div className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Learning path */}
      <section className="space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
            {isZh ? '学习路径' : 'Learning path'}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-[color:var(--color-text)]">
            {isZh ? '按知识层走，而不是按术语表走' : 'Move by layers, not by glossary entries'}
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
