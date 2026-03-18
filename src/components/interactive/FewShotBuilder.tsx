'use client';

import { useState } from 'react';

/* ── Data ── */

interface ShotExample {
  input: string;
  label: string;
  sentiment: '正面' | '负面';
}

const EXAMPLE_POOL: ShotExample[] = [
  { input: '这个产品质量很好，推荐！', label: '正面', sentiment: '正面' },
  { input: '发货太慢了，等了两周',     label: '负面', sentiment: '负面' },
  { input: '性价比不错，值得购买',     label: '正面', sentiment: '正面' },
  { input: '包装破损，客服态度差',     label: '负面', sentiment: '负面' },
];

const TEST_INPUT = '手感不错但电池不耐用';

/** Accuracy by shot count: 0-shot=55%, 1-shot=72%, 2-shot=83%, 3-shot=89% */
const ACCURACY: Record<number, number> = { 0: 55, 1: 72, 2: 83, 3: 89 };
/** "Understanding" meter — 0-shot=20, 1-shot=50, 2-shot=75, 3-shot=92 */
const UNDERSTANDING: Record<number, number> = { 0: 20, 1: 50, 2: 75, 3: 92 };

const PREDICTIONS: Record<number, string> = {
  0: '正面（模型倾向正面偏置，忽略"但电池不耐用"）',
  1: '正面（识别到情感词，但对混合情感判断不稳定）',
  2: '偏正面，但犹豫（开始注意到转折结构）',
  3: '混合情感：正面(手感) + 负面(电池)（准确识别两种情感）',
};

/* ── Component ── */

export default function FewShotBuilder() {
  const [shotCount, setShotCount] = useState(0);

  const activeExamples = EXAMPLE_POOL.slice(0, shotCount);
  const accuracy = ACCURACY[shotCount] ?? 55;
  const understanding = UNDERSTANDING[shotCount] ?? 20;
  const prediction = PREDICTIONS[shotCount] ?? PREDICTIONS[0];

  // Build the assembled prompt text
  const buildPrompt = (): string => {
    const lines: string[] = [];
    lines.push('请对以下评论进行情感分类（正面/负面/混合）。');

    if (activeExamples.length > 0) {
      lines.push('');
      lines.push('示例：');
      activeExamples.forEach((ex, i) => {
        lines.push(`${i + 1}. "${ex.input}" → ${ex.label}`);
      });
    }

    lines.push('');
    lines.push(`评论："${TEST_INPUT}"`);
    lines.push('分类：');
    return lines.join('\n');
  };

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">F</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Few-shot 构建器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Few-shot Builder</span>
        </div>
      </div>

      {/* Shot count selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择示例数量</div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setShotCount(n)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                shotCount === n
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300 dark:hover:border-amber-500/40'
              }`}
            >
              {n}-shot
            </button>
          ))}
        </div>
      </div>

      {/* Examples list */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">
          示例池 — 已选中 <span className="font-bold text-amber-600 dark:text-amber-400">{shotCount}</span> 个
        </div>
        <div className="space-y-2">
          {EXAMPLE_POOL.map((ex, i) => {
            const isActive = i < shotCount;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setShotCount(i < shotCount ? i : i + 1)}
                className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${
                  isActive
                    ? 'border-amber-400 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10'
                    : 'border-[color:var(--color-border)] opacity-50 hover:opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[color:var(--color-text)] ${isActive ? '' : 'line-through'}`}>
                    &ldquo;{ex.input}&rdquo;
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    ex.sentiment === '正面'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                  }`}>
                    {isActive ? `→ ${ex.label}` : ex.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column: prompt + metrics */}
      <div className="flex flex-col lg:flex-row">

        {/* Assembled prompt */}
        <div className="flex-1 border-b border-[color:var(--color-border)] lg:border-b-0 lg:border-r px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">实际发送的 Prompt</div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs font-mono text-[color:var(--color-text)] whitespace-pre-wrap leading-relaxed min-h-[140px]">
            {buildPrompt()}
          </div>
        </div>

        {/* Metrics panel */}
        <div className="w-full lg:w-64 shrink-0 px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">模型表现</div>

          {/* Understanding meter */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[color:var(--color-text)]">模型理解度</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{understanding}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${understanding}%` }}
              />
            </div>
          </div>

          {/* Accuracy */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[color:var(--color-text)]">模拟准确率</span>
              <span className={`text-sm font-bold ${
                accuracy >= 85 ? 'text-emerald-600 dark:text-emerald-400'
                  : accuracy >= 70 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500 dark:text-red-400'
              }`}>
                {accuracy}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  accuracy >= 85 ? 'bg-emerald-500'
                    : accuracy >= 70 ? 'bg-amber-500'
                      : 'bg-red-400'
                }`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>

          {/* Test prediction */}
          <div className="border-t border-[color:var(--color-border)] pt-3">
            <div className="text-xs text-[color:var(--color-muted)] mb-1">
              测试输入：&ldquo;{TEST_INPUT}&rdquo;
            </div>
            <div className="text-xs font-medium text-[color:var(--color-text)] leading-relaxed">
              预测：{prediction}
            </div>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          Few-shot prompting 通过在输入中提供标注好的示例，利用模型的 in-context learning 能力来"教"它完成任务。
          模型不会更新参数——它只是从示例中推断出输入→输出的映射模式。
          示例越多、越多样，模型越能准确捕捉任务意图。但并非无限加好——通常 3-5 个精选示例就能达到接近微调的效果。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">试试看：</span>
          从 0-shot 开始逐步添加示例。注意 1→2 shot 时准确率跳跃最大——第二个示例让模型理解了"正面 vs 负面"的对比模式。3-shot 时模型开始能处理混合情感这种边界情况。
        </p>
      </div>
    </div>
  );
}
