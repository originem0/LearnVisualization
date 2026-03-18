'use client';

import { useState } from 'react';

/* ── Context Length Calculator ──
   User inputs text length → shows attention matrix size (n²), VRAM, compute.
   Visual: square grid that grows with n.
   Annotated with model context windows.
*/

interface ModelWindow {
  name: string;
  tokens: number;
  color: string;
}

const MODEL_WINDOWS: ModelWindow[] = [
  { name: 'GPT-3',         tokens: 4096,     color: 'rgb(59,130,246)' },
  { name: 'GPT-4',         tokens: 128000,   color: 'rgb(168,85,247)' },
  { name: 'Claude 3.5',    tokens: 200000,   color: 'rgb(245,158,11)' },
  { name: 'Gemini 1.5',    tokens: 1000000,  color: 'rgb(34,197,94)' },
];

function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + ' TB';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
  return bytes.toFixed(0) + ' B';
}

export default function ContextLengthCalc() {
  const [logTokens, setLogTokens] = useState(3.6); // ~4K tokens
  const tokens = Math.round(Math.pow(10, logTokens));

  // Attention matrix size = n²
  const matrixSize = tokens * tokens;

  // VRAM for KV cache: 2 (K+V) × n_layers × n_heads × head_dim × seq_len × 2 bytes (fp16)
  // Approximate for a 70B model: 80 layers, 64 heads, d_head=128
  const layers = 80;
  const heads = 64;
  const headDim = 128;
  const kvCacheBytes = 2 * layers * heads * headDim * tokens * 2; // fp16

  // Attention computation FLOPs per layer per head: 2 * n² * d_head (for Q*K^T and attn*V)
  const attnFlopsPerLayer = heads * 2 * matrixSize * headDim * 2; // Q*K^T + attn*V
  const totalAttnFlops = attnFlopsPerLayer * layers;

  // Relative compute: normalized to 4K tokens
  const baseTokens = 4096;
  const relativeCompute = matrixSize / (baseTokens * baseTokens);

  // Visual grid: represent attention matrix as a square
  const maxVisualSize = 160;
  const logMax = 6; // 1M tokens
  const logMin = 2; // 100 tokens
  const visualFrac = Math.min(1, (logTokens - logMin) / (logMax - logMin));
  const visualSize = Math.max(8, visualFrac * maxVisualSize);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">W</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">上下文长度计算器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Context Length Calculator</span>
        </div>
      </div>

      {/* Slider */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-[color:var(--color-muted)]" htmlFor="ctx-slider">上下文长度</label>
            <input
              id="ctx-slider"
              type="range"
              min={2}
              max={6}
              step={0.02}
              value={logTokens}
              onChange={e => setLogTokens(parseFloat(e.target.value))}
              className="flex-1 accent-red-500"
            />
            <span className="w-20 text-xs font-mono font-semibold text-[color:var(--color-text)] text-right">
              {formatNumber(tokens)} tokens
            </span>
          </div>
        </div>
        {/* Model window markers */}
        <div className="flex flex-wrap gap-2 mt-2">
          {MODEL_WINDOWS.map(m => (
            <button
              key={m.name}
              type="button"
              onClick={() => setLogTokens(Math.log10(m.tokens))}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition ${
                Math.abs(tokens - m.tokens) / m.tokens < 0.1
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              {m.name}: {formatNumber(m.tokens)}
            </button>
          ))}
        </div>
      </div>

      {/* Visual + Metrics */}
      <div className="flex flex-col sm:flex-row px-5 py-5 gap-6">
        {/* Visual: attention matrix square */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-xs text-[color:var(--color-muted)]">注意力矩阵 (n × n)</div>
          <div
            className="rounded border-2 border-red-300 dark:border-red-500/40 transition-all duration-300"
            style={{
              width: visualSize,
              height: visualSize,
              background: `linear-gradient(135deg,
                rgba(239,68,68,0.15) 0%,
                rgba(239,68,68,0.35) 50%,
                rgba(239,68,68,0.15) 100%)`,
            }}
          />
          <div className="text-[10px] font-mono text-[color:var(--color-muted)]">
            {formatNumber(tokens)} × {formatNumber(tokens)} = {formatNumber(matrixSize)} 元素
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10px] text-[color:var(--color-muted)]">注意力矩阵大小</div>
            <div className="text-sm font-bold font-mono text-red-600 dark:text-red-400">{formatNumber(matrixSize)}</div>
            <div className="text-[10px] text-[color:var(--color-muted)]">n² = {tokens.toLocaleString()}²</div>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10px] text-[color:var(--color-muted)]">KV Cache 显存</div>
            <div className="text-sm font-bold font-mono text-[color:var(--color-text)]">{formatBytes(kvCacheBytes)}</div>
            <div className="text-[10px] text-[color:var(--color-muted)]">70B 模型, fp16</div>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10px] text-[color:var(--color-muted)]">注意力 FLOPs</div>
            <div className="text-sm font-bold font-mono text-[color:var(--color-text)]">{formatNumber(totalAttnFlops)}</div>
            <div className="text-[10px] text-[color:var(--color-muted)]">全部层</div>
          </div>
          <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
            <div className="text-[10px] text-[color:var(--color-muted)]">相对计算量</div>
            <div className={`text-sm font-bold font-mono ${
              relativeCompute > 100 ? 'text-red-600 dark:text-red-400'
                : relativeCompute > 10 ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {relativeCompute < 0.01 ? relativeCompute.toExponential(1) : relativeCompute.toFixed(1)}×
            </div>
            <div className="text-[10px] text-[color:var(--color-muted)]">相对 4K 基准</div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {tokens > 100000 && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-3">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="font-semibold">注意：</span>
            {tokens > 500000
              ? ` ${formatNumber(tokens)} tokens 的注意力矩阵有 ${formatNumber(matrixSize)} 个元素。普通注意力机制在这个长度上不可行——需要 FlashAttention、稀疏注意力等优化技术。`
              : ` 在 ${formatNumber(tokens)} tokens 的长度上，KV Cache 已经需要 ${formatBytes(kvCacheBytes)} 显存。这是长上下文推理的主要瓶颈之一。`}
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          自注意力机制的每个 token 都需要和所有其他 token 计算注意力分数，
          产生 n×n 的注意力矩阵。序列长度翻倍，计算量和显存都翻四倍。
          KV Cache 是推理时的额外开销——需要缓存每一层每一个头的 Key 和 Value 向量。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          点击 GPT-4 (128K) 和 Gemini 1.5 (1M) 的按钮，比较注意力矩阵大小——
          1M 的矩阵是 128K 的 61 倍。这就是为什么超长上下文模型需要特殊架构优化。
        </p>
      </div>
    </div>
  );
}
