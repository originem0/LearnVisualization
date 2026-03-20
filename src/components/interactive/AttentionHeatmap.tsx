'use client';

import { useState } from 'react';

interface AttentionData {
  tokens: string[];
  weights: number[][];
}

const SENTENCES: { label: string; data: AttentionData }[] = [
  {
    label: 'The cat sat on the mat because it was tired',
    data: {
      tokens: ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'],
      weights: [
        [0.35, 0.25, 0.10, 0.05, 0.10, 0.05, 0.03, 0.03, 0.02, 0.02],
        [0.15, 0.30, 0.20, 0.05, 0.05, 0.10, 0.03, 0.05, 0.03, 0.04],
        [0.05, 0.30, 0.20, 0.15, 0.03, 0.15, 0.02, 0.05, 0.03, 0.02],
        [0.03, 0.10, 0.25, 0.20, 0.08, 0.25, 0.02, 0.03, 0.02, 0.02],
        [0.10, 0.05, 0.05, 0.08, 0.25, 0.35, 0.03, 0.03, 0.03, 0.03],
        [0.05, 0.15, 0.15, 0.15, 0.15, 0.20, 0.03, 0.05, 0.03, 0.04],
        [0.03, 0.15, 0.20, 0.05, 0.03, 0.10, 0.20, 0.10, 0.08, 0.06],
        [0.03, 0.42, 0.08, 0.03, 0.03, 0.12, 0.10, 0.10, 0.04, 0.05],
        [0.02, 0.15, 0.10, 0.03, 0.02, 0.05, 0.08, 0.30, 0.15, 0.10],
        [0.02, 0.25, 0.08, 0.02, 0.02, 0.05, 0.10, 0.20, 0.15, 0.11],
      ],
    },
  },
  {
    label: '我 喜欢 吃 苹果 因为 苹果 很 甜',
    data: {
      tokens: ['我', '喜欢', '吃', '苹果', '因为', '苹果', '很', '甜'],
      weights: [
        [0.40, 0.25, 0.15, 0.08, 0.04, 0.04, 0.02, 0.02],
        [0.25, 0.25, 0.20, 0.15, 0.05, 0.05, 0.03, 0.02],
        [0.10, 0.30, 0.20, 0.25, 0.05, 0.05, 0.03, 0.02],
        [0.05, 0.15, 0.30, 0.25, 0.05, 0.10, 0.05, 0.05],
        [0.05, 0.15, 0.10, 0.20, 0.20, 0.15, 0.08, 0.07],
        [0.03, 0.10, 0.15, 0.35, 0.10, 0.12, 0.08, 0.07],
        [0.02, 0.05, 0.05, 0.10, 0.08, 0.20, 0.25, 0.25],
        [0.02, 0.08, 0.05, 0.15, 0.10, 0.20, 0.15, 0.25],
      ],
    },
  },
];

function heatColor(weight: number): string {
  if (weight >= 0.35) return 'bg-blue-600 text-white dark:bg-blue-500';
  if (weight >= 0.25) return 'bg-blue-500 text-white dark:bg-blue-400';
  if (weight >= 0.15) return 'bg-blue-400 text-white dark:bg-blue-400/80';
  if (weight >= 0.10) return 'bg-blue-300 text-blue-900 dark:bg-blue-500/50 dark:text-blue-100';
  if (weight >= 0.05) return 'bg-blue-200 text-blue-800 dark:bg-blue-500/30 dark:text-blue-200';
  return 'bg-blue-100/50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300';
}

export default function AttentionHeatmap() {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [selectedToken, setSelectedToken] = useState(7);
  const [showMatrix, setShowMatrix] = useState(false);

  const sentence = SENTENCES[sentenceIdx];
  const { tokens, weights } = sentence.data;
  const selectedWeights = weights[selectedToken] ?? [];
  const maxWeight = Math.max(...selectedWeights, 0);
  const rankedTargets = tokens
    .map((token, index) => ({ token, index, weight: selectedWeights[index] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);
  const topTargets = rankedTargets.filter((item) => item.index !== selectedToken).slice(0, 3);

  const handleSentenceChange = (idx: number) => {
    setSentenceIdx(idx);
    setSelectedToken(idx === 0 ? 7 : 5);
    setShowMatrix(false);
  };

  const focusSummary = describeAttentionFocus(sentenceIdx, selectedToken, tokens[selectedToken], topTargets);

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)]">
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-white">A</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">注意力热力图</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Attention Heatmap</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--color-muted)]">
          先盯住一个 token，看它把有限注意力预算分给谁，再决定要从哪里取回上下文。
        </p>
      </div>

      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">选择示例句子</div>
            <div className="flex flex-wrap gap-2">
              {SENTENCES.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSentenceChange(index)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    sentenceIdx === index
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-emerald-300 dark:hover:border-emerald-500/40'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-[color:var(--color-muted)]">点击一个词，看它正在向谁取信息</div>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((token, index) => (
                <button
                  key={`${token}-${index}`}
                  type="button"
                  onClick={() => setSelectedToken(index)}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                    selectedToken === index
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/30 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-200'
                      : 'border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="mb-3 text-xs font-medium text-[color:var(--color-muted)]">
              “<span className="font-semibold text-emerald-600 dark:text-emerald-400">{tokens[selectedToken]}</span>”
              当前把注意力分给谁
            </div>
            <div className="space-y-2">
              {tokens.map((token, index) => {
                const weight = selectedWeights[index] ?? 0;
                const pct = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
                const isSelf = index === selectedToken;

                return (
                  <div key={`${token}-${index}`} className="flex items-center gap-2">
                    <span
                      className={`w-12 shrink-0 text-right text-xs font-medium ${
                        isSelf ? 'text-emerald-600 dark:text-emerald-400' : 'text-[color:var(--color-text)]'
                      }`}
                    >
                      {token}
                    </span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          weight >= 0.25 ? 'bg-blue-500 dark:bg-blue-400' : 'bg-blue-300 dark:bg-blue-500/60'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[11px] font-mono text-[color:var(--color-muted)]">
                      {(weight * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-2xl border border-[color:var(--color-border)] bg-zinc-50/70 p-4 dark:bg-[#0b3a45]/35">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
              当前发生了什么
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--color-text)]">{focusSummary}</p>

            <div className="mt-4 space-y-2">
              {topTargets.map((target) => (
                <div
                  key={`${target.token}-${target.index}`}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-3 py-2"
                >
                  <span className="text-sm text-[color:var(--color-text)]">{target.token}</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {(target.weight * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <button
          type="button"
          onClick={() => setShowMatrix((value) => !value)}
          className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted)] transition-colors hover:bg-zinc-50 hover:text-[color:var(--color-text)] dark:hover:bg-[#0b3a45]"
        >
          {showMatrix ? '收起完整矩阵' : '展开完整矩阵'}
        </button>
      </div>

      {showMatrix ? (
        <div className="border-t border-[color:var(--color-border)] px-5 py-4 overflow-x-auto">
          <div className="mb-3 text-xs font-medium text-[color:var(--color-muted)]">完整注意力矩阵</div>
          <table className="border-collapse text-[10px] font-mono">
            <thead>
              <tr>
                <th className="p-1" />
                {tokens.map((token, index) => (
                  <th
                    key={`${token}-${index}`}
                    className="p-1 text-center font-normal text-[color:var(--color-muted)]"
                    style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', maxHeight: 56 }}
                  >
                    {token}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, row) => (
                <tr key={`${token}-${row}`} className={row === selectedToken ? 'ring-1 ring-emerald-400/50' : ''}>
                  <td
                    className={`px-1 py-0.5 text-right ${
                      row === selectedToken ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-[color:var(--color-muted)]'
                    }`}
                  >
                    {token}
                  </td>
                  {weights[row].map((weight, column) => (
                    <td key={`${row}-${column}`} className="p-0.5">
                      <div className={`flex h-6 w-6 items-center justify-center rounded ${heatColor(weight)} text-[9px]`}>
                        {(weight * 100).toFixed(0)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="border-t border-[color:var(--color-border)] bg-emerald-50/50 px-5 py-3 dark:bg-emerald-500/5">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          <span className="font-semibold">读法：</span>
          热力图不是“模型在看哪里”的装饰图，而是当前 token 正在怎样重组上下文的直接证据。
        </p>
      </div>
    </div>
  );
}

function describeAttentionFocus(
  sentenceIdx: number,
  selectedTokenIndex: number,
  selectedTokenLabel: string,
  topTargets: Array<{ token: string; index: number; weight: number }>,
) {
  if (topTargets.length === 0) {
    return '当前这个 token 还没有明显偏向，说明它对上下文的依赖比较弱。';
  }

  if (sentenceIdx === 0 && selectedTokenLabel === 'it') {
    return `“it” 主要参考 ${topTargets[0].token}，而不是机械地回看最近的名词。这说明注意力是在动态判断指代对象。`;
  }

  if (sentenceIdx === 1 && selectedTokenIndex === 5 && selectedTokenLabel === '苹果') {
    return `第二个“苹果”明显回看第一个“苹果”，说明同一个表面词在不同位置会被重新解释。`;
  }

  const primaryTargets = topTargets.slice(0, 2).map((item) => item.token).join('、');
  return `当前这个 token 主要向 ${primaryTargets} 取信息。注意力的本质不是平均浏览，而是带着当前问题去找最有用的上下文。`;
}
