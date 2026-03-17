import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles, phaseLabels } from '@/lib/palette';
import ConceptList from './ConceptList';
import WeaknessList from './WeaknessList';

interface ModuleDetailProps {
  module: Module;
  category: Category;
  prev?: Module;
  next?: Module;
}

export default function ModuleDetail({ module, category, prev, next }: ModuleDetailProps) {
  const styles = categoryStyles[category.color];
  const phase = phaseLabels[module.phase] ?? phaseLabels['not-started'];

  const conceptNames = module.concepts.items.map((item) => item.name);
  const conceptMap = conceptNames.length >= 2 ? conceptNames.slice(0, -1).map((name, index) => `${name} → ${conceptNames[index + 1]}`) : [];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>{category.name}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${phase.className}`}>{phase.label}</span>
          {module.feynman.tested ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                module.feynman.passed
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200'
              }`}
            >
              🧪 {module.feynman.passed ? '通过' : '未通过'}
            </span>
          ) : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold text-[color:var(--color-text)]">{module.title}</h1>
        <p className="mt-1 text-base text-[color:var(--color-muted)]">{module.subtitle}</p>
        {module.quote ? <p className="mt-4 text-sm italic text-zinc-500">“{module.quote}”</p> : null}
        {module.keyInsight ? (
          <div className="mt-4 rounded-lg border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-panel)]/70 p-4 text-sm text-[color:var(--color-text)]">
            <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">关键洞察</div>
            <div className="mt-1">{module.keyInsight}</div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">概念地图</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">按学习顺序展示概念之间的关系链路。</p>
          <div className="mt-4 space-y-2">
            {conceptMap.length ? (
              conceptMap.map((item) => (
                <div key={item} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 text-sm text-[color:var(--color-text)]">
                  {item}
                </div>
              ))
            ) : (
              <div className="text-sm text-[color:var(--color-muted)]">暂无概念关系，建议补充概念链路。</div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">逻辑链条</h2>
          <ol className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.logicChain.length ? (
              module.logicChain.map((step, index) => (
                <li key={`${step}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {index + 1}. {step}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">暂无逻辑链条</li>
            )}
          </ol>
        </section>
      </div>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">概念清单</h2>
        <div className="mt-4">
          <ConceptList items={module.concepts.items} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">关键例子</h2>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.examples.length ? (
              module.examples.map((example, index) => (
                <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {example}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">暂无例子</li>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">反例提醒</h2>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
            {module.counterexamples.length ? (
              module.counterexamples.map((example, index) => (
                <li key={`${example}-${index}`} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3">
                  {example}
                </li>
              ))
            ) : (
              <li className="text-[color:var(--color-muted)]">暂无反例</li>
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">薄弱点追踪</h2>
        <div className="mt-4">
          <WeaknessList items={module.weaknesses} />
        </div>
      </section>

      <section className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--color-text)]">费曼测试</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {module.feynman.tested ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                module.feynman.passed
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-200'
              }`}
            >
              {module.feynman.passed ? '通过' : '未通过'}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-200">
              未测试
            </span>
          )}
          <span className="text-[color:var(--color-muted)]">{module.feynman.notes || '暂无费曼测试记录。'}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="text-sm font-semibold text-[color:var(--color-text)] hover:underline">
          ← 返回时间线
        </Link>
        <div className="flex flex-wrap gap-3 text-sm">
          {prev ? (
            <Link href={`/m/${prev.id}`} className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel)]">
              上一模块：{prev.title}
            </Link>
          ) : null}
          {next ? (
            <Link href={`/m/${next.id}`} className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-[color:var(--color-panel)]">
              下一模块：{next.title}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
