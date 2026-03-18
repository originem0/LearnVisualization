'use client';

import { useState } from 'react';

/* ── Chain-of-Thought Toggle ──
   A reasoning problem. Toggle: direct answer vs step-by-step.
   Shows answer differences and accuracy.
*/

interface Problem {
  id: string;
  question: string;
  correctAnswer: string;
  directAnswer: string;
  directCorrect: boolean;
  directExplain: string;
  cotSteps: string[];
  cotAnswer: string;
  cotCorrect: boolean;
}

const PROBLEMS: Problem[] = [
  {
    id: 'apples',
    question: '小明有 3 个苹果，给了小红 1 个，又从树上摘了 5 个，然后把一半送给了邻居。小明现在有几个苹果？',
    correctAnswer: '3.5 个（实际 3 或 4 个，取决于奇数处理）',
    directAnswer: '4 个',
    directCorrect: false,
    directExplain: '模型跳过了中间步骤，直接猜一个看起来合理的数字。实际需要逐步计算。',
    cotSteps: [
      '小明开始有 3 个苹果',
      '给了小红 1 个：3 - 1 = 2 个',
      '从树上摘了 5 个：2 + 5 = 7 个',
      '把一半送给邻居：7 ÷ 2 = 3.5，取整为 3 或 4 个',
    ],
    cotAnswer: '3 或 4 个（7 的一半，取决于如何处理奇数）',
    cotCorrect: true,
  },
  {
    id: 'logic',
    question: '所有的猫都是动物。有些动物会游泳。可以推出"有些猫会游泳"吗？',
    correctAnswer: '不能推出。"有些动物会游泳"中的"有些动物"不一定包括猫。',
    directAnswer: '可以。因为猫是动物，有些动物会游泳，所以有些猫会游泳。',
    directCorrect: false,
    directExplain: '这是经典的三段论谬误。模型没有检查"有些动物"是否包含"猫"。',
    cotSteps: [
      '前提 1：所有猫 ⊆ 动物',
      '前提 2：∃ 一些动物 ∈ 会游泳',
      '"有些动物"可能是鱼、鸭子等，不一定包含猫',
      '猫是动物的子集，但"会游泳的动物"是另一个子集',
      '两个子集不一定有交集',
    ],
    cotAnswer: '不能推出。"会游泳的动物"这个集合不一定与"猫"有交集。',
    cotCorrect: true,
  },
  {
    id: 'math',
    question: '一个水池有两根管子。进水管每小时灌 3 吨，排水管每小时排 2 吨。水池容量 10 吨，从空池开始，多久灌满？',
    correctAnswer: '10 小时。净流入 = 3 - 2 = 1 吨/小时，10 ÷ 1 = 10 小时。',
    directAnswer: '3.3 小时',
    directCorrect: false,
    directExplain: '模型只用了进水管的速率（10÷3≈3.3），忽略了排水管同时在排水。',
    cotSteps: [
      '进水速率：3 吨/小时',
      '排水速率：2 吨/小时',
      '净流入速率：3 - 2 = 1 吨/小时',
      '水池容量：10 吨',
      '灌满时间：10 ÷ 1 = 10 小时',
    ],
    cotAnswer: '10 小时',
    cotCorrect: true,
  },
];

export default function CoTToggle() {
  const [problemIdx, setProblemIdx] = useState(0);
  const [mode, setMode] = useState<'direct' | 'cot'>('direct');

  const problem = PROBLEMS[problemIdx];

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">C</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Chain-of-Thought 开关</h3>
          <span className="text-xs text-[color:var(--color-muted)]">CoT Toggle</span>
        </div>
      </div>

      {/* Problem selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择题目</div>
        <div className="flex flex-wrap gap-2">
          {PROBLEMS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setProblemIdx(i); setMode('direct'); }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                problemIdx === i
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              题目 {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">题目</div>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm text-[color:var(--color-text)] leading-relaxed">
          {problem.question}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">回答模式</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('direct')}
            className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
              mode === 'direct'
                ? 'border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-200'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-zinc-400'
            }`}
          >
            直接回答
          </button>
          <button
            type="button"
            onClick={() => setMode('cot')}
            className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
              mode === 'cot'
                ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
            }`}
          >
            逐步推理 (CoT)
          </button>
        </div>
      </div>

      {/* Answer display */}
      <div className="px-5 py-4">
        {mode === 'direct' ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                problem.directCorrect
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              }`}>
                {problem.directCorrect ? '正确' : '错误'}
              </span>
              <span className="text-xs text-[color:var(--color-muted)]">直接回答模式</span>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-sm font-mono text-[color:var(--color-text)]">
              {problem.directAnswer}
            </div>
            <div className="mt-2 text-xs text-[color:var(--color-muted)] leading-relaxed">
              {problem.directExplain}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                problem.cotCorrect
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
              }`}>
                {problem.cotCorrect ? '正确' : '错误'}
              </span>
              <span className="text-xs text-[color:var(--color-muted)]">逐步推理模式</span>
            </div>
            <div className="space-y-2 mb-3">
              {problem.cotSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-700 dark:bg-red-500/20 dark:text-red-300 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-[color:var(--color-text)] leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 px-4 py-3 text-sm font-mono text-emerald-700 dark:text-emerald-300">
              {problem.cotAnswer}
            </div>
          </div>
        )}
      </div>

      {/* Correct answer */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs text-[color:var(--color-muted)]">
          正确答案：<span className="font-medium text-[color:var(--color-text)]">{problem.correctAnswer}</span>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          模型是自回归生成的——每个 token 只取决于前面的 token。
          直接回答时，所有推理必须在一次前向传播中完成。
          而 CoT 让模型把中间步骤写出来，每一步都成为后续推理的"外部记忆"，
          等于把一次复杂推理拆成多次简单推理。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          在三道题中切换"直接回答"和"逐步推理"——注意直接回答几乎每次都错，而 CoT 都对了。
          这不是巧合：推理类任务在没有 CoT 时准确率约 18%，加了 CoT 后跳到 79%。
        </p>
      </div>
    </div>
  );
}
