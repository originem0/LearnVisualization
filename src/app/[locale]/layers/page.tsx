import { getData } from '@/lib/data';
import type { Locale } from '@/lib/i18n';
import KnowledgeMap from '@/components/KnowledgeMap';

export default function LayersPage({ params }: { params: { locale: Locale } }) {
  const data = getData(params.locale);
  const isZh = params.locale === 'zh';

  return (
    <div className="space-y-8">
      <section>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '知识地图' : 'Knowledge Map'}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          {isZh ? '五层架构，一条主线' : 'Five Layers, One Thread'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--color-muted)]">
          {isZh
            ? '从文本表示到系统化认知，每一层解决一个关键问题，自然导向下一层。点击任意模块进入学习。'
            : 'From text representation to system-level cognition. Each layer solves a key problem and leads naturally to the next. Click any module to start learning.'}
        </p>
      </section>

      <KnowledgeMap
        categories={data.categories}
        modules={data.modules}
        locale={params.locale}
      />

      {/* Legend */}
      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          {isZh ? '阅读建议' : 'Reading suggestions'}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="font-medium text-[color:var(--color-text)]">
              {isZh ? '🔰 系统学习' : '🔰 Systematic'}
            </div>
            <div className="mt-1 text-sm text-[color:var(--color-muted)]">
              {isZh ? '从 s01 顺着箭头走到 s12。每一章都为下一章铺路。' : 'Follow arrows from s01 to s12. Each chapter sets up the next.'}
            </div>
          </div>
          <div>
            <div className="font-medium text-[color:var(--color-text)]">
              {isZh ? '⚡ 只看核心机制' : '⚡ Core mechanism only'}
            </div>
            <div className="mt-1 text-sm text-[color:var(--color-muted)]">
              {isZh ? 's01 → s03 → s04 → s05。理解 token、attention、transformer、预训练四件事。' : 's01 → s03 → s04 → s05. Understand tokens, attention, transformers, and pre-training.'}
            </div>
          </div>
          <div>
            <div className="font-medium text-[color:var(--color-text)]">
              {isZh ? '🎯 应用导向' : '🎯 Application-focused'}
            </div>
            <div className="mt-1 text-sm text-[color:var(--color-muted)]">
              {isZh ? 's07 → s08 → s11。对齐、Prompt 工程、上下文窗口——直接上手用。' : 's07 → s08 → s11. Alignment, prompting, context windows — hands-on.'}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
