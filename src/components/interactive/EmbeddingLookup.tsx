'use client';

import { useState, useMemo } from 'react';

/* ── Simulated embedding matrix (small for visualization) ──
   We show a 8-token × 4-dimension matrix to illustrate the lookup concept.
*/

const VOCAB: { id: number; token: string }[] = [
  { id: 0, token: '[PAD]' },
  { id: 1, token: '我' },
  { id: 2, token: '喜欢' },
  { id: 3, token: '吃' },
  { id: 4, token: '苹果' },
  { id: 5, token: 'the' },
  { id: 6, token: 'cat' },
  { id: 7, token: 'sat' },
];

// Fake embedding values (4 dims) — designed to show similar words have similar vectors
const EMBED_MATRIX: number[][] = [
  [0.00, 0.00, 0.00, 0.00],  // [PAD]
  [0.23, -0.41, 0.67, 0.12],  // 我
  [0.56, 0.31, -0.22, 0.78],  // 喜欢
  [0.48, 0.27, -0.18, 0.71],  // 吃 (similar to 喜欢 — both verbs)
  [-0.33, 0.62, 0.41, -0.15], // 苹果
  [0.11, -0.38, 0.59, 0.08],  // the (similar to 我 — both function-like)
  [-0.27, 0.58, 0.35, -0.19], // cat (similar to 苹果 — both nouns)
  [0.51, 0.22, -0.25, 0.69],  // sat (similar to 吃 — both verbs)
];

const DIM_LABELS = ['d₁', 'd₂', 'd₃', 'd₄'];

// Color scale for matrix values: negative → blue, zero → neutral, positive → red
function valueColor(v: number): string {
  if (v > 0.3) return 'bg-red-200 text-red-800 dark:bg-red-500/25 dark:text-red-300';
  if (v > 0) return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200';
  if (v < -0.3) return 'bg-blue-200 text-blue-800 dark:bg-blue-500/25 dark:text-blue-300';
  if (v < 0) return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200';
  return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';
}

const PRESETS = [
  { label: '"我"', id: 1 },
  { label: '"苹果"', id: 4 },
  { label: '"cat"', id: 6 },
  { label: '"吃"', id: 3 },
];

export default function EmbeddingLookup() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showOneHot, setShowOneHot] = useState(false);

  const oneHot = useMemo(() => {
    if (selectedId === null) return null;
    return VOCAB.map((_, i) => (i === selectedId ? 1 : 0));
  }, [selectedId]);

  const embedding = selectedId !== null ? EMBED_MATRIX[selectedId] : null;
  const selectedToken = selectedId !== null ? VOCAB[selectedId] : null;

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 text-xs font-bold text-white">E</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">Embedding 查表动画</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Embedding Lookup</span>
        </div>
      </div>

      {/* Token ID input */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择一个 Token</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                selectedId === p.id
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:text-blue-400'
              }`}
            >
              ID {p.id}: {p.label}
            </button>
          ))}
        </div>
        {/* One-hot toggle */}
        <button
          type="button"
          onClick={() => setShowOneHot(!showOneHot)}
          className={`mt-2 rounded border px-2 py-0.5 text-xs transition ${
            showOneHot
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
          }`}
        >
          {showOneHot ? '隐藏 One-Hot' : '显示 One-Hot 等价'}
        </button>
      </div>

      {/* Matrix visualization */}
      <div className="px-5 py-4 overflow-x-auto">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">
          Embedding 矩阵 <span className="font-mono">({VOCAB.length} × {DIM_LABELS.length})</span>
        </div>
        <table className="border-collapse text-xs font-mono">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[color:var(--color-muted)] font-normal">ID</th>
              <th className="px-2 py-1 text-left text-[color:var(--color-muted)] font-normal">Token</th>
              {showOneHot && <th className="px-2 py-1 text-center text-[color:var(--color-muted)] font-normal">One-Hot</th>}
              {DIM_LABELS.map(d => (
                <th key={d} className="px-2 py-1 text-center text-[color:var(--color-muted)] font-normal">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VOCAB.map((v, rowIdx) => {
              const isSelected = selectedId === rowIdx;
              return (
                <tr
                  key={v.id}
                  onClick={() => setSelectedId(rowIdx)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-100/80 dark:bg-blue-500/15'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <td className="px-2 py-1.5 text-[color:var(--color-muted)]">{v.id}</td>
                  <td className={`px-2 py-1.5 ${isSelected ? 'font-bold text-blue-700 dark:text-blue-300' : 'text-[color:var(--color-text)]'}`}>
                    {v.token}
                  </td>
                  {showOneHot && oneHot && (
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-block rounded px-1 ${
                        oneHot[rowIdx] === 1
                          ? 'bg-amber-200 text-amber-800 font-bold dark:bg-amber-500/30 dark:text-amber-200'
                          : 'text-zinc-300 dark:text-zinc-600'
                      }`}>
                        {oneHot[rowIdx]}
                      </span>
                    </td>
                  )}
                  {EMBED_MATRIX[rowIdx].map((val, ci) => (
                    <td key={ci} className="px-1 py-1.5 text-center">
                      <span className={`inline-block rounded px-1.5 py-0.5 min-w-[3rem] transition-all ${
                        isSelected ? valueColor(val) + ' font-bold ring-1 ring-blue-400/30' : valueColor(val)
                      }`}>
                        {val.toFixed(2)}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Result */}
      {embedding && selectedToken && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-4">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">查表结果</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[color:var(--color-muted)]">embed(</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{selectedToken.token}</span>
            <span className="text-[color:var(--color-muted)]">) =</span>
            <span className="font-mono font-bold text-[color:var(--color-text)]">
              [{embedding.map(v => v.toFixed(2)).join(', ')}]
            </span>
          </div>
          {showOneHot && (
            <p className="mt-2 text-xs text-[color:var(--color-muted)]">
              One-Hot × 矩阵 = 取矩阵的第 {selectedId} 行。查表本质上是矩阵乘法的特例。
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {selectedId === null && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-6 text-center text-sm text-[color:var(--color-muted)]">
          点击上方按钮或表格中的行，选择一个 token 查看其 embedding 向量
        </div>
      )}

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-blue-50/50 dark:bg-blue-500/5">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <span className="font-semibold">核心概念：</span>
          Embedding 矩阵就是一张大查找表。每个 Token ID 对应表中一行——一个 d 维向量。这些向量在训练过程中自动学习，语义相近的 token 会获得相近的向量。
        </p>
      </div>
    </div>
  );
}
