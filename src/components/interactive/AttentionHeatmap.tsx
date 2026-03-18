'use client';

import { useState, useMemo } from 'react';

/* ── Pre-computed attention weights for demo sentences ── */

interface AttentionData {
  tokens: string[];
  weights: number[][]; // weights[i][j] = attention from token i to token j
}

const SENTENCES: { label: string; data: AttentionData }[] = [
  {
    label: 'The cat sat on the mat because it was tired',
    data: {
      tokens: ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'],
      weights: [
        // The
        [0.35, 0.25, 0.10, 0.05, 0.10, 0.05, 0.03, 0.03, 0.02, 0.02],
        // cat
        [0.15, 0.30, 0.20, 0.05, 0.05, 0.10, 0.03, 0.05, 0.03, 0.04],
        // sat
        [0.05, 0.30, 0.20, 0.15, 0.03, 0.15, 0.02, 0.05, 0.03, 0.02],
        // on
        [0.03, 0.10, 0.25, 0.20, 0.08, 0.25, 0.02, 0.03, 0.02, 0.02],
        // the
        [0.10, 0.05, 0.05, 0.08, 0.25, 0.35, 0.03, 0.03, 0.03, 0.03],
        // mat
        [0.05, 0.15, 0.15, 0.15, 0.15, 0.20, 0.03, 0.05, 0.03, 0.04],
        // because
        [0.03, 0.15, 0.20, 0.05, 0.03, 0.10, 0.20, 0.10, 0.08, 0.06],
        // it → cat has highest weight (coreference resolution!)
        [0.03, 0.42, 0.08, 0.03, 0.03, 0.12, 0.10, 0.10, 0.04, 0.05],
        // was
        [0.02, 0.15, 0.10, 0.03, 0.02, 0.05, 0.08, 0.30, 0.15, 0.10],
        // tired
        [0.02, 0.25, 0.08, 0.02, 0.02, 0.05, 0.10, 0.20, 0.15, 0.11],
      ],
    },
  },
  {
    label: '我 喜欢 吃 苹果 因为 苹果 很 甜',
    data: {
      tokens: ['我', '喜欢', '吃', '苹果', '因为', '苹果', '很', '甜'],
      weights: [
        // 我
        [0.40, 0.25, 0.15, 0.08, 0.04, 0.04, 0.02, 0.02],
        // 喜欢
        [0.25, 0.25, 0.20, 0.15, 0.05, 0.05, 0.03, 0.02],
        // 吃
        [0.10, 0.30, 0.20, 0.25, 0.05, 0.05, 0.03, 0.02],
        // 苹果
        [0.05, 0.15, 0.30, 0.25, 0.05, 0.10, 0.05, 0.05],
        // 因为
        [0.05, 0.15, 0.10, 0.20, 0.20, 0.15, 0.08, 0.07],
        // 苹果(2) → first 苹果 has high weight
        [0.03, 0.10, 0.15, 0.35, 0.10, 0.12, 0.08, 0.07],
        // 很
        [0.02, 0.05, 0.05, 0.10, 0.08, 0.20, 0.25, 0.25],
        // 甜
        [0.02, 0.08, 0.05, 0.15, 0.10, 0.20, 0.15, 0.25],
      ],
    },
  },
];

function heatColor(weight: number): string {
  // 0 → transparent, 1 → deep blue
  if (weight >= 0.35) return 'bg-blue-600 text-white dark:bg-blue-500';
  if (weight >= 0.25) return 'bg-blue-500 text-white dark:bg-blue-400';
  if (weight >= 0.15) return 'bg-blue-400 text-white dark:bg-blue-400/80';
  if (weight >= 0.10) return 'bg-blue-300 text-blue-900 dark:bg-blue-500/50 dark:text-blue-100';
  if (weight >= 0.05) return 'bg-blue-200 text-blue-800 dark:bg-blue-500/30 dark:text-blue-200';
  return 'bg-blue-100/50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300';
}

export default function AttentionHeatmap() {
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [selectedToken, setSelectedToken] = useState(7); // default: "it"

  const sentence = SENTENCES[sentenceIdx];
  const { tokens, weights } = sentence.data;

  // When switching sentence, reset selection
  const handleSentenceChange = (idx: number) => {
    setSentenceIdx(idx);
    setSelectedToken(idx === 0 ? 7 : 3); // "it" or "苹果"
  };

  const selectedWeights = useMemo(() => {
    if (selectedToken >= weights.length) return null;
    return weights[selectedToken];
  }, [selectedToken, weights]);

  // Find max weight for bar chart scaling
  const maxWeight = selectedWeights ? Math.max(...selectedWeights) : 0;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-xs font-bold text-white">A</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">注意力热力图</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Attention Heatmap</span>
        </div>
      </div>

      {/* Sentence selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择示例句子</div>
        <div className="flex flex-wrap gap-2">
          {SENTENCES.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSentenceChange(i)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                sentenceIdx === i
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-emerald-300 dark:hover:border-emerald-500/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Token selector — click a word to see its attention */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">点击一个词，查看它关注了哪些其他词</div>
        <div className="flex flex-wrap gap-1.5">
          {tokens.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedToken(i)}
              className={`rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${
                selectedToken === i
                  ? 'border-emerald-400 bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400/30 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-200'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Attention bar chart for selected token */}
      {selectedWeights && (
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">
            &ldquo;<span className="font-bold text-emerald-600 dark:text-emerald-400">{tokens[selectedToken]}</span>&rdquo; 对每个词的注意力权重
          </div>
          <div className="space-y-1.5">
            {tokens.map((t, i) => {
              const w = selectedWeights[i];
              const pct = maxWeight > 0 ? (w / maxWeight) * 100 : 0;
              const isSelf = i === selectedToken;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-12 shrink-0 text-right text-xs font-medium ${isSelf ? 'text-emerald-600 dark:text-emerald-400' : 'text-[color:var(--color-text)]'}`}>
                    {t}
                  </span>
                  <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-300 ${
                        w >= 0.25 ? 'bg-blue-500 dark:bg-blue-400' : 'bg-blue-300 dark:bg-blue-500/60'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-mono text-[color:var(--color-muted)]">
                    {(w * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap grid */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4 overflow-x-auto">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">完整注意力矩阵</div>
        <table className="border-collapse text-[10px] font-mono">
          <thead>
            <tr>
              <th className="p-1" />
              {tokens.map((t, i) => (
                <th key={i} className="p-1 text-center text-[color:var(--color-muted)] font-normal" style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', maxHeight: 60 }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t, row) => (
              <tr key={row} className={row === selectedToken ? 'ring-1 ring-emerald-400/50' : ''}>
                <td className={`px-1 py-0.5 text-right ${row === selectedToken ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-[color:var(--color-muted)]'}`}>
                  {t}
                </td>
                {weights[row].map((w, col) => (
                  <td key={col} className="p-0.5">
                    <div className={`flex items-center justify-center rounded w-7 h-7 ${heatColor(w)} text-[9px]`}>
                      {(w * 100).toFixed(0)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-emerald-50/50 dark:bg-emerald-500/5">
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          <span className="font-semibold">试试看：</span>
          {sentenceIdx === 0
            ? '点击 "it"，注意它对 "cat" 的注意力远高于 "mat"——模型学会了代词消解。'
            : '点击第二个"苹果"，注意它对第一个"苹果"的注意力最高——模型识别了共指关系。'
          }
        </p>
      </div>
    </div>
  );
}
