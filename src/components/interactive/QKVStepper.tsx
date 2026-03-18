'use client';

import { useState, useMemo, useCallback } from 'react';

/* ── Simplified 3-token QKV computation walkthrough ──
   We use a tiny example with 3 tokens and d_k=3 to show each step.
   Values are pre-computed for determinism.
*/

// Input vectors (3 tokens, each 3-dim)
const TOKENS = ['猫', '坐', '了'];
const X = [
  [1.0, 0.5, -0.3],
  [0.2, 0.8, 0.6],
  [-0.1, 0.3, 0.9],
];

// Weight matrices (3x3 each, simplified)
const W_Q = [[0.5, 0.1, -0.2], [0.3, 0.7, 0.1], [-0.1, 0.2, 0.6]];
const W_K = [[0.4, -0.1, 0.3], [0.2, 0.5, -0.2], [0.1, 0.3, 0.8]];
const W_V = [[0.6, 0.2, 0.1], [-0.1, 0.4, 0.3], [0.2, -0.2, 0.7]];

function matMulRow(vec: number[], mat: number[][]): number[] {
  return mat[0].map((_, j) =>
    vec.reduce((sum, v, i) => sum + v * mat[i][j], 0)
  );
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(v => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return exps.map(v => v / sum);
}

function fmt(n: number): string {
  return n.toFixed(2);
}

function numColor(v: number): string {
  if (v > 0.5) return 'text-red-600 dark:text-red-400';
  if (v > 0) return 'text-amber-600 dark:text-amber-400';
  if (v < -0.3) return 'text-blue-600 dark:text-blue-400';
  if (v < 0) return 'text-sky-600 dark:text-sky-400';
  return 'text-[color:var(--color-muted)]';
}

interface StepInfo {
  title: string;
  description: string;
}

const STEP_INFO: StepInfo[] = [
  { title: '输入向量', description: '每个 token 都有一个 d 维向量表示' },
  { title: 'Q = X · W_Q', description: 'Query — "我在找什么"' },
  { title: 'K = X · W_K', description: 'Key — "我有什么"' },
  { title: 'V = X · W_V', description: 'Value — "我的内容"' },
  { title: 'Q · K^T', description: '计算注意力分数（匹配度）' },
  { title: '÷ √d_k', description: '缩放防止数值过大' },
  { title: '因果遮罩', description: '生成时只能看前面的词' },
  { title: 'Softmax', description: '转换为概率分布' },
  { title: 'Attn × V', description: '用概率对 Value 加权求和' },
];

const TOTAL_STEPS = STEP_INFO.length - 1;

export default function QKVStepper() {
  const [step, setStep] = useState(0);
  const [causalMask, setCausalMask] = useState(true);

  const goNext = useCallback(() => setStep(s => Math.min(s + 1, TOTAL_STEPS)), []);
  const goPrev = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  // Pre-compute everything
  const computed = useMemo(() => {
    const Q = X.map(row => matMulRow(row, W_Q));
    const K = X.map(row => matMulRow(row, W_K));
    const V = X.map(row => matMulRow(row, W_V));

    const d_k = 3;
    const scale = Math.sqrt(d_k);

    // Q · K^T
    const scores: number[][] = Q.map(q =>
      K.map(k => dotProduct(q, k))
    );

    // Scaled scores
    const scaled: number[][] = scores.map(row =>
      row.map(v => v / scale)
    );

    // Causal mask
    const masked: number[][] = scaled.map((row, i) =>
      row.map((v, j) => (causalMask && j > i) ? -Infinity : v)
    );

    // Softmax per row
    const attnWeights: number[][] = masked.map(row => softmax(row));

    // Output = attnWeights × V
    const output: number[][] = attnWeights.map(row =>
      V[0].map((_, dim) =>
        row.reduce((s, w, j) => s + w * V[j][dim], 0)
      )
    );

    return { Q, K, V, scores, scaled, masked, attnWeights, output, scale };
  }, [causalMask]);

  // Render a matrix
  const MatrixDisplay = ({ data, labels, highlight }: { data: number[][]; labels: string[]; highlight?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs font-mono">
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td className="pr-2 py-0.5 text-right font-semibold text-[color:var(--color-muted)]">{labels[i]}</td>
              {row.map((v, j) => (
                <td key={j} className="px-1.5 py-0.5 text-center">
                  <span className={`inline-block rounded px-1 py-0.5 min-w-[3rem] ${
                    v === -Infinity
                      ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500'
                      : highlight
                        ? `font-bold ${numColor(v)}`
                        : numColor(v)
                  }`}>
                    {v === -Infinity ? '-∞' : fmt(v)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const currentInfo = STEP_INFO[step];

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 text-xs font-bold text-white">Q</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">QKV 计算步进器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Step-by-Step Self-Attention</span>
        </div>
      </div>

      {/* Tokens display */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[color:var(--color-muted)]">输入句子:</span>
          {TOKENS.map((t, i) => (
            <span key={i} className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 px-2 py-1 text-sm font-medium text-[color:var(--color-text)] dark:bg-zinc-800">
              {t}
            </span>
          ))}
          <span className="text-xs text-[color:var(--color-muted)] ml-2">d_k = 3</span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500 text-xs font-bold text-white">
            {step + 1}
          </span>
          <div>
            <div className="text-sm font-semibold text-[color:var(--color-text)]">{currentInfo.title}</div>
            <div className="text-xs text-[color:var(--color-muted)]">{currentInfo.description}</div>
          </div>
        </div>
        {/* Progress dots */}
        <div className="mt-2 flex gap-1">
          {STEP_INFO.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-4 bg-purple-500' : i < step ? 'w-1.5 bg-purple-300 dark:bg-purple-500/40' : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Causal mask toggle */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-2">
        <button
          type="button"
          onClick={() => setCausalMask(!causalMask)}
          className={`rounded border px-2 py-0.5 text-xs transition ${
            causalMask
              ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
              : 'border-[color:var(--color-border)] text-[color:var(--color-muted)]'
          }`}
        >
          因果遮罩: {causalMask ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Matrix display area */}
      <div className="px-5 py-4 space-y-4">
        {step >= 0 && (
          <div>
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">X (输入)</div>
            <MatrixDisplay data={X} labels={TOKENS} />
          </div>
        )}

        {step >= 1 && (
          <div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Q = X · W_Q</div>
            <MatrixDisplay data={computed.Q} labels={TOKENS} highlight />
          </div>
        )}

        {step >= 2 && (
          <div>
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">K = X · W_K</div>
            <MatrixDisplay data={computed.K} labels={TOKENS} highlight />
          </div>
        )}

        {step >= 3 && (
          <div>
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">V = X · W_V</div>
            <MatrixDisplay data={computed.V} labels={TOKENS} highlight />
          </div>
        )}

        {step >= 4 && (
          <div>
            <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">
              Q · K<sup>T</sup> {step >= 5 && <span>÷ √{computed.scale.toFixed(1)}</span>}
              {step >= 6 && causalMask && <span className="text-amber-600 dark:text-amber-400"> + 因果遮罩</span>}
            </div>
            <MatrixDisplay
              data={step >= 6 ? computed.masked : step >= 5 ? computed.scaled : computed.scores}
              labels={TOKENS}
              highlight
            />
          </div>
        )}

        {step >= 7 && (
          <div>
            <div className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-1">Softmax (注意力权重)</div>
            <MatrixDisplay data={computed.attnWeights} labels={TOKENS} highlight />
          </div>
        )}

        {step >= 8 && (
          <div>
            <div className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Output = Attention × V</div>
            <MatrixDisplay data={computed.output} labels={TOKENS} highlight />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[color:var(--color-muted)]">
            步骤 {step + 1}/{TOTAL_STEPS + 1}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] transition hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800"
            >
              ← 上一步
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={step >= TOTAL_STEPS}
              className="rounded-lg border border-purple-400 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
            >
              下一步 →
            </button>
            <button
              type="button"
              onClick={() => setStep(0)}
              disabled={step === 0}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted)] transition hover:text-[color:var(--color-text)] hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/50 dark:bg-purple-500/5">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <span className="font-semibold">核心公式：</span>
          Attention(Q,K,V) = softmax(QK<sup>T</sup>/√d<sub>k</sub>) · V。每一步都是矩阵乘法——"简单到离谱"。
        </p>
      </div>
    </div>
  );
}
