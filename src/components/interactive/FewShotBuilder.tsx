'use client';

import { useState } from 'react';

interface ShotExample {
  input: string;
  label: '正面' | '负面' | '混合';
  teachingPoint: string;
}

interface StageReading {
  learned: string[];
  missing: string[];
  interpretation: string;
  nextShift: string;
}

const EXAMPLE_POOL: ShotExample[] = [
  { input: '这个产品质量很好，推荐！', label: '正面', teachingPoint: '先给模型一个明确的正面锚点。' },
  { input: '发货太慢了，等了两周', label: '负面', teachingPoint: '再补一个负面对照，标签边界第一次成形。' },
  { input: '屏幕很清晰，但续航一般', label: '混合', teachingPoint: '最后补上转折句，让模型看见“正负并存”这种边界情况。' },
];

const TEST_INPUT = '手感不错但电池不耐用';

const STAGE_READINGS: Record<number, StageReading> = {
  0: {
    learned: ['模型只能依赖预训练时见过的大量通用情感模式。'],
    missing: ['它没被明确教过这次任务的标签集合。', '它也没看到“转折句可能是混合情感”这种判断边界。'],
    interpretation: '最可能先抓住“不错”这样的显眼正面词，再把后半句当成次要噪声。',
    nextShift: '只要补进第一个示例，模型就会先知道这次任务到底要输出什么标签格式。',
  },
  1: {
    learned: ['模型第一次看到了“输入句子 → 标签”的任务接口。', '它知道输出应该是一个明确类别，而不是自由评论。'],
    missing: ['只看过正面例子，负面边界仍然模糊。', '对“但”这种转折结构还没有训练样例。'],
    interpretation: '它会更愿意给出“正面”这个标签，因为目前示例只告诉它什么叫正面。',
    nextShift: '再加一个负面对照后，模型会更像在做分类，而不是被单一示例牵着走。',
  },
  2: {
    learned: ['模型已经见过正面和负面两端，知道这是一个带对照的分类任务。', '它开始理解哪些词会把句子推向负面。'],
    missing: ['它还没见过“正负同时出现”时该怎样输出。'],
    interpretation: '它大概率会注意到“电池不耐用”是强负面信号，但仍可能被迫二选一。',
    nextShift: '第三个混合示例最值钱，因为它不是再加数据量，而是在补任务边界。',
  },
  3: {
    learned: ['模型已经看到正面、负面、混合三种决策边界。', '它被明确教会了转折句不一定只能压成单标签。'],
    missing: ['它仍然没有更新权重，所以泛化能力依旧取决于示例是否贴近真实场景。'],
    interpretation: '这时它更可能把句子拆成“手感不错”和“电池不耐用”两部分，再判断为混合情感。',
    nextShift: '下一步不是无脑继续加例子，而是挑新的边界 case，比如讽刺、双重否定、隐含评价。',
  },
};

export default function FewShotBuilder() {
  const [shotCount, setShotCount] = useState(0);

  const activeExamples = EXAMPLE_POOL.slice(0, shotCount);
  const reading = STAGE_READINGS[shotCount];

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">F</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Few-shot 构建器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Few-shot Builder</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
          Few-shot 真正在做的事，不是把模型“喂得更饱”，而是把这次任务的决策边界直接摆在上下文里。
        </p>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">选择示例数量</div>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setShotCount(count)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                shotCount === count
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300 dark:hover:border-amber-500/40'
              }`}
            >
              {count}-shot
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">
          示例池，已启用 <span className="font-semibold text-amber-600 dark:text-amber-400">{shotCount}</span> 个
        </div>
        <div className="space-y-2">
          {EXAMPLE_POOL.map((example, index) => {
            const isActive = index < shotCount;

            return (
              <button
                key={`${example.input}-${index}`}
                type="button"
                onClick={() => setShotCount(index < shotCount ? index : index + 1)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-amber-400 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10'
                    : 'border-[color:var(--color-border)] opacity-55 hover:opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm leading-6 text-[color:var(--color-text)] ${isActive ? '' : 'line-through'}`}>
                      “{example.input}”
                    </div>
                    {isActive ? (
                      <div className="mt-1 text-xs leading-5 text-[color:var(--color-muted)]">{example.teachingPoint}</div>
                    ) : null}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${labelTone(example.label)}`}>
                    {example.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="border-b border-[color:var(--color-border)] lg:border-b-0 lg:border-r px-5 py-4">
          <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">实际发送的 Prompt</div>
          <div className="min-h-[160px] whitespace-pre-wrap rounded-2xl border border-[color:var(--color-border)] bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-[color:var(--color-text)] dark:bg-zinc-800/50">
            {buildPrompt(activeExamples)}
          </div>
        </div>

        <aside className="px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            这组示例在教什么
          </div>
          <ul className="mt-3 space-y-2">
            {reading.learned.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-[color:var(--color-border)] bg-zinc-50/70 px-3 py-2 text-xs leading-5 text-[color:var(--color-text)] dark:bg-[#0b3a45]/35"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-4 text-xs font-semibold text-[color:var(--color-text)]">它还没教会什么</div>
          <ul className="mt-2 space-y-2">
            {reading.missing.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2 text-xs leading-5 text-[color:var(--color-muted)]"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/8">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">测试句会怎么被读</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                手感不错
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-[color:var(--color-muted)] dark:bg-zinc-700">
                但
              </span>
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">
                电池不耐用
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-text)]">{reading.interpretation}</p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--color-muted)]">{reading.nextShift}</p>
          </div>
        </aside>
      </div>

      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs leading-relaxed text-[color:var(--color-text)]">
          <span className="font-semibold">原理：</span>
          Few-shot 不是更新模型参数，而是在当前上下文里临时展示“这个任务的输入输出映射长什么样”。真正稀缺的不是示例数量，而是示例是否刚好覆盖了任务边界。
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] bg-amber-50/50 px-5 py-3 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">试试看：</span>
          注意 2-shot 到 3-shot 的变化。真正值钱的不是又加了一条数据，而是第一次把“混合情感”这种边界 case 明确示范给模型看。
        </p>
      </div>
    </div>
  );
}

function buildPrompt(activeExamples: ShotExample[]) {
  const lines: string[] = ['请对以下评论进行情感分类（正面/负面/混合）。'];

  if (activeExamples.length > 0) {
    lines.push('');
    lines.push('示例：');
    activeExamples.forEach((example, index) => {
      lines.push(`${index + 1}. "${example.input}" → ${example.label}`);
    });
  }

  lines.push('');
  lines.push(`评论："${TEST_INPUT}"`);
  lines.push('分类：');
  return lines.join('\n');
}

function labelTone(label: ShotExample['label']) {
  if (label === '正面') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  }
  if (label === '负面') {
    return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
}
