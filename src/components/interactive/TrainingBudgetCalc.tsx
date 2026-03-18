'use client';

import { useState } from 'react';

/* ── Training Budget Calculator ──
   Input: GPU count, GPU type, training days.
   Output: total FLOPs, recommended params, recommended data (Chinchilla).
   Compare with real models.
*/

interface GPUType {
  id: string;
  name: string;
  tflops: number; // BF16 peak TFLOPS
}

const GPU_TYPES: GPUType[] = [
  { id: 'a100',  name: 'A100 80GB',   tflops: 312 },
  { id: 'h100',  name: 'H100 80GB',   tflops: 990 },
  { id: 'h200',  name: 'H200 141GB',  tflops: 1979 },
];

interface RealModel {
  name: string;
  params: number;     // billions
  data: number;       // trillions tokens
  gpus: number;
  gpuType: string;
  days: number;
  flops: number;      // in 1e21
}

const REAL_MODELS: RealModel[] = [
  { name: 'GPT-3 175B',      params: 175,   data: 0.3,   gpus: 10000, gpuType: 'V100', days: 34,  flops: 3.14 },
  { name: 'Chinchilla 70B',  params: 70,    data: 1.4,   gpus: 4096,  gpuType: 'TPUv4', days: 21, flops: 5.76 },
  { name: 'LLaMA-2 70B',     params: 70,    data: 2.0,   gpus: 2048,  gpuType: 'A100',  days: 58, flops: 8.42 },
  { name: 'LLaMA-3 70B',     params: 70,    data: 15,    gpus: 16384, gpuType: 'H100',  days: 25, flops: 39.3 },
];

export default function TrainingBudgetCalc() {
  const [gpuTypeIdx, setGpuTypeIdx] = useState(1); // H100 default
  const [gpuCount, setGpuCount] = useState(1024);
  const [days, setDays] = useState(30);

  const gpu = GPU_TYPES[gpuTypeIdx];

  // Total FLOPs = gpuCount × TFLOPS × seconds × utilization
  // Utilization ~40% for large-scale training (MFU)
  const utilization = 0.4;
  const totalSeconds = days * 24 * 3600;
  const totalFlops = gpuCount * gpu.tflops * 1e12 * totalSeconds * utilization; // in FLOPs
  const totalFlopsE21 = totalFlops / 1e21;

  // Chinchilla optimal: C ≈ 6 * N * D, where N = params, D = tokens
  // Chinchilla: N_opt ≈ (C / 6 / 20)^0.5 (since D = 20N, C = 6*N*20*N = 120*N²)
  // N_opt = sqrt(C / 120), D_opt = 20 * N_opt
  const nOpt = Math.sqrt(totalFlops / 120); // in raw param count
  const nOptB = nOpt / 1e9; // billions
  const dOptTokens = 20 * nOpt;
  const dOptT = dOptTokens / 1e12; // trillions

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">B</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">训练预算计算器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Training Budget Calculator</span>
        </div>
      </div>

      {/* GPU type selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">GPU 型号</div>
        <div className="flex flex-wrap gap-2">
          {GPU_TYPES.map((g, i) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGpuTypeIdx(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                gpuTypeIdx === i
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              {g.name} ({g.tflops} TFLOPS)
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="gpu-count">GPU 数量</label>
            <input
              id="gpu-count"
              type="range"
              min={0}
              max={5}
              step={0.05}
              value={Math.log10(gpuCount)}
              onChange={e => setGpuCount(Math.round(Math.pow(10, parseFloat(e.target.value))))}
              className="w-28 accent-red-500"
            />
            <span className="w-16 text-xs font-mono text-[color:var(--color-text)]">{gpuCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="train-days">训练天数</label>
            <input
              id="train-days"
              type="range"
              min={1}
              max={120}
              step={1}
              value={days}
              onChange={e => setDays(parseInt(e.target.value))}
              className="w-28 accent-red-500"
            />
            <span className="w-12 text-xs font-mono text-[color:var(--color-text)]">{days}天</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-center">
            <div className="text-xs text-[color:var(--color-muted)]">总算力</div>
            <div className="mt-1 text-lg font-bold font-mono text-red-600 dark:text-red-400">
              {totalFlopsE21 < 0.01 ? totalFlopsE21.toExponential(1) : totalFlopsE21.toFixed(1)}
            </div>
            <div className="text-[10px] text-[color:var(--color-muted)]">× 10²¹ FLOPs</div>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-center">
            <div className="text-xs text-[color:var(--color-muted)]">推荐参数量</div>
            <div className="mt-1 text-lg font-bold font-mono text-[color:var(--color-text)]">
              {nOptB < 1 ? nOptB.toFixed(2) : nOptB < 1000 ? nOptB.toFixed(0) : (nOptB / 1000).toFixed(1) + 'T'}
            </div>
            <div className="text-[10px] text-[color:var(--color-muted)]">{nOptB < 1000 ? 'B 参数' : '参数'}</div>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-center">
            <div className="text-xs text-[color:var(--color-muted)]">推荐数据量</div>
            <div className="mt-1 text-lg font-bold font-mono text-[color:var(--color-text)]">
              {dOptT < 0.01 ? dOptT.toExponential(1) : dOptT < 1 ? dOptT.toFixed(2) : dOptT.toFixed(1)}
            </div>
            <div className="text-[10px] text-[color:var(--color-muted)]">T tokens</div>
          </div>
        </div>
      </div>

      {/* Real model comparison */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">对比真实模型</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-[color:var(--color-text)]">
            <thead>
              <tr className="border-b border-[color:var(--color-border)]">
                <th className="py-1.5 pr-3 text-left font-medium text-[color:var(--color-muted)]">模型</th>
                <th className="py-1.5 px-2 text-right font-medium text-[color:var(--color-muted)]">参数</th>
                <th className="py-1.5 px-2 text-right font-medium text-[color:var(--color-muted)]">数据</th>
                <th className="py-1.5 px-2 text-right font-medium text-[color:var(--color-muted)]">GPU</th>
                <th className="py-1.5 px-2 text-right font-medium text-[color:var(--color-muted)]">天数</th>
                <th className="py-1.5 pl-2 text-right font-medium text-[color:var(--color-muted)]">FLOPs(×10²¹)</th>
              </tr>
            </thead>
            <tbody>
              {REAL_MODELS.map(m => (
                <tr key={m.name} className="border-b border-[color:var(--color-border)] last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{m.name}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{m.params}B</td>
                  <td className="py-1.5 px-2 text-right font-mono">{m.data}T</td>
                  <td className="py-1.5 px-2 text-right font-mono">{m.gpus.toLocaleString()}</td>
                  <td className="py-1.5 px-2 text-right font-mono">{m.days}</td>
                  <td className="py-1.5 pl-2 text-right font-mono">{m.flops}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          训练总算力 C = GPU数 × 峰值FLOPS × 训练时间 × MFU（≈40%）。
          Chinchilla 法则推荐参数量和数据量同步缩放：给定算力 C，最优 N ≈ √(C/120)，D ≈ 20N。
          这里使用了约 40% 的 MFU（Model FLOPs Utilization），反映实际大规模训练中的效率。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          用 1024 块 H100 训练 30 天，看看 Chinchilla 建议你训练多大的模型。
          再把 GPU 加到 16384 块——推荐的参数量是线性增长还是亚线性的？
        </p>
      </div>
    </div>
  );
}
