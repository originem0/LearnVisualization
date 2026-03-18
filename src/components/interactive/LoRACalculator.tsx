'use client';

import { useState } from 'react';

/* ── LoRA Parameter Calculator with visual matrix decomposition ── */

interface ModelPreset {
  name: string;
  d: number;
  layers: number;
  rank: number;
}

const PRESETS: ModelPreset[] = [
  { name: '7B 模型', d: 4096, layers: 32, rank: 16 },
  { name: '13B 模型', d: 5120, layers: 40, rank: 16 },
  { name: '70B 模型', d: 8192, layers: 80, rank: 32 },
];

function formatParams(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

/** Visual representation of matrix decomposition: d×d → d×r + r×d */
function MatrixDiagram({ d, r }: { d: number; r: number }) {
  // Scale dimensions for display — map to px
  const maxBox = 120;
  const bigSize = maxBox;
  const smallW = Math.max(12, Math.round((r / d) * maxBox));
  const smallH = bigSize;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-4">
      {/* Original W: d × d */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="rounded border-2 border-zinc-400 bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-700 flex items-center justify-center"
          style={{ width: bigSize, height: bigSize }}
        >
          <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">W</span>
        </div>
        <span className="text-[10px] text-[color:var(--color-muted)]">{d}×{d}</span>
      </div>

      <span className="text-lg font-bold text-[color:var(--color-muted)]">≈</span>

      {/* LoRA A: d × r */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="rounded border-2 border-amber-400 bg-amber-100 dark:border-amber-500 dark:bg-amber-500/20 flex items-center justify-center"
          style={{ width: smallW, height: smallH }}
        >
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">A</span>
        </div>
        <span className="text-[10px] text-[color:var(--color-muted)]">{d}×{r}</span>
      </div>

      <span className="text-lg font-bold text-[color:var(--color-muted)]">×</span>

      {/* LoRA B: r × d */}
      <div className="flex flex-col items-center gap-1">
        <div
          className="rounded border-2 border-blue-400 bg-blue-100 dark:border-blue-500 dark:bg-blue-500/20 flex items-center justify-center"
          style={{ width: bigSize, height: Math.max(12, Math.round((r / d) * maxBox)) }}
        >
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">B</span>
        </div>
        <span className="text-[10px] text-[color:var(--color-muted)]">{r}×{d}</span>
      </div>
    </div>
  );
}

export default function LoRACalculator() {
  const [d, setD] = useState(4096);
  const [r, setR] = useState(16);
  const [layers, setLayers] = useState(32);

  // Full fine-tuning: each layer has Q and V weight matrices, each d×d
  const fullParams = layers * d * d * 2;
  // LoRA: each layer has A (d×r) and B (r×d) for both Q and V
  const loraParams = layers * 4 * d * r;
  const ratio = fullParams > 0 ? (loraParams / fullParams) * 100 : 0;

  const applyPreset = (p: ModelPreset) => {
    setD(p.d);
    setR(p.rank);
    setLayers(p.layers);
  };

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">B</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">LoRA 参数计算器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">LoRA Parameter Calculator</span>
        </div>
      </div>

      {/* Preset selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">快速预设</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => {
            const isActive = d === p.d && layers === p.layers && r === p.rank;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-amber-300'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Parameter sliders */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Dimension d */}
          <div>
            <label className="text-xs font-medium text-[color:var(--color-text)] block mb-1">
              隐藏维度 d = <span className="font-mono text-amber-600 dark:text-amber-400">{d}</span>
            </label>
            <input
              type="range"
              min={512}
              max={16384}
              step={512}
              value={d}
              onChange={(e) => setD(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-[color:var(--color-muted)]">
              <span>512</span>
              <span>16384</span>
            </div>
          </div>

          {/* Rank r */}
          <div>
            <label className="text-xs font-medium text-[color:var(--color-text)] block mb-1">
              LoRA 秩 r = <span className="font-mono text-amber-600 dark:text-amber-400">{r}</span>
            </label>
            <input
              type="range"
              min={1}
              max={256}
              step={1}
              value={r}
              onChange={(e) => setR(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-[color:var(--color-muted)]">
              <span>1</span>
              <span>256</span>
            </div>
          </div>

          {/* Layers */}
          <div>
            <label className="text-xs font-medium text-[color:var(--color-text)] block mb-1">
              层数 = <span className="font-mono text-amber-600 dark:text-amber-400">{layers}</span>
            </label>
            <input
              type="range"
              min={1}
              max={128}
              step={1}
              value={layers}
              onChange={(e) => setLayers(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-[color:var(--color-muted)]">
              <span>1</span>
              <span>128</span>
            </div>
          </div>
        </div>
      </div>

      {/* Matrix decomposition visual */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-2">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1 text-center">
          权重矩阵低秩分解
        </div>
        <MatrixDiagram d={d} r={r} />
        <div className="text-center text-[10px] text-[color:var(--color-muted)] pb-2">
          冻结原始权重 W，只训练低秩矩阵 A 和 B：W&apos; = W + A × B
        </div>
      </div>

      {/* Results comparison */}
      <div className="px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Full fine-tuning */}
          <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-600">
            <div className="text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider mb-2">全量微调</div>
            <div className="text-2xl font-bold font-mono text-[color:var(--color-text)]">{formatParams(fullParams)}</div>
            <div className="text-[10px] text-[color:var(--color-muted)] mt-1">
              {layers} 层 × {d}×{d} × 2 (Q, V)
            </div>
            <div className="mt-3 h-3 rounded-full bg-zinc-300 dark:bg-zinc-600 overflow-hidden">
              <div className="h-full bg-zinc-500 dark:bg-zinc-400 rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="text-right text-[10px] text-[color:var(--color-muted)] mt-0.5">100%</div>
          </div>

          {/* LoRA */}
          <div className="rounded-lg border-2 border-amber-400 p-4 dark:border-amber-500/60">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">LoRA</div>
            <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">{formatParams(loraParams)}</div>
            <div className="text-[10px] text-[color:var(--color-muted)] mt-1">
              {layers} 层 × ({d}×{r} + {r}×{d}) × 2
            </div>
            <div className="mt-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(ratio, 100)}%` }}
              />
            </div>
            <div className="text-right text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              {ratio.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Savings callout */}
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-center dark:bg-amber-500/5">
          <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
            参数减少 {(100 - ratio).toFixed(2)}%
          </span>
          <span className="text-xs text-[color:var(--color-muted)] ml-2">
            （仅需训练 {formatParams(loraParams)} / {formatParams(fullParams)} 参数）
          </span>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)]">
          <span className="font-semibold">原理：</span>
          LoRA 的核心假设是微调时的权重变化矩阵 ΔW 是低秩的。与其更新整个 d×d 矩阵（{formatParams(d * d)} 参数），
          不如将其分解为两个小矩阵 A({d}×{r}) 和 B({r}×{d})，只需 {formatParams(2 * d * r)} 参数。
          秩 r 越小，参数越少，但表达能力也越有限——通常 r=8~64 就能达到接近全量微调的效果。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5">
        <p className="text-xs text-amber-700 dark:text-amber-300">
          <span className="font-semibold">试试看：</span>
          把秩 r 从 16 拖到 256，观察 LoRA 参数占比的变化。即使 r=256，参数量仍远小于全量微调——这就是低秩分解的威力。
        </p>
      </div>
    </div>
  );
}
