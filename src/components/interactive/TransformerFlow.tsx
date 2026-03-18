'use client';

import { useState } from 'react';

/* ── Transformer Block data flow visualizer ──
   Shows: Input → Attention → Add&Norm → FFN → Add&Norm → Output
   User can toggle residual connections and layer normalization on/off
   to see their effect on the data values.
*/

interface BlockComponent {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  darkColor: string;
}

const BLOCK_COMPONENTS: BlockComponent[] = [
  { id: 'input', label: '输入', sublabel: 'Token Embeddings', color: 'bg-zinc-200', darkColor: 'dark:bg-zinc-700' },
  { id: 'attn', label: '自注意力', sublabel: 'Self-Attention', color: 'bg-emerald-100', darkColor: 'dark:bg-emerald-500/15' },
  { id: 'addnorm1', label: 'Add & Norm', sublabel: '残差 + 归一化', color: 'bg-blue-100', darkColor: 'dark:bg-blue-500/15' },
  { id: 'ffn', label: '前馈网络', sublabel: 'FFN (ReLU)', color: 'bg-amber-100', darkColor: 'dark:bg-amber-500/15' },
  { id: 'addnorm2', label: 'Add & Norm', sublabel: '残差 + 归一化', color: 'bg-blue-100', darkColor: 'dark:bg-blue-500/15' },
  { id: 'output', label: '输出', sublabel: '→ 下一层', color: 'bg-zinc-200', darkColor: 'dark:bg-zinc-700' },
];

// Simulated data values at each stage
function getValues(residual: boolean, layernorm: boolean): Record<string, number[]> {
  const input = [0.52, -0.31, 0.78, 0.15];
  const attnOut = [0.89, 0.12, -0.45, 0.67];

  // After Add&Norm 1
  let addnorm1: number[];
  if (residual && layernorm) {
    // residual + layernorm → well-behaved values
    addnorm1 = [0.91, -0.12, 0.21, 0.53];
  } else if (residual) {
    // residual only → sum might be larger
    addnorm1 = input.map((v, i) => v + attnOut[i]); // [1.41, -0.19, 0.33, 0.82]
  } else if (layernorm) {
    // just layernorm on attention output
    addnorm1 = [1.12, 0.15, -0.57, 0.84];
  } else {
    // no residual, no layernorm → raw attention out, info loss
    addnorm1 = attnOut;
  }

  const ffnOut = residual && layernorm
    ? [1.23, 0.45, -0.11, 0.87]
    : !residual && !layernorm
      ? [3.45, -2.78, 5.12, -4.56] // unstable without both
      : residual
        ? [2.15, 0.33, 0.22, 1.49]
        : [2.89, -1.23, 3.45, -2.11];

  let addnorm2: number[];
  if (residual && layernorm) {
    addnorm2 = [0.88, 0.31, 0.05, 0.72];
  } else if (residual) {
    addnorm2 = addnorm1.map((v, i) => v + ffnOut[i]);
  } else if (layernorm) {
    addnorm2 = ffnOut.map(v => v * 0.5);
  } else {
    addnorm2 = ffnOut; // unstable
  }

  return {
    input,
    attn: attnOut,
    addnorm1,
    ffn: ffnOut,
    addnorm2,
    output: addnorm2,
  };
}

function valColor(v: number): string {
  const abs = Math.abs(v);
  if (abs > 3) return 'text-red-600 font-bold dark:text-red-400';
  if (abs > 1.5) return 'text-amber-600 font-bold dark:text-amber-400';
  return 'text-[color:var(--color-text)]';
}

function stabilityLabel(residual: boolean, layernorm: boolean): { text: string; color: string } {
  if (residual && layernorm) return { text: '稳定', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30' };
  if (residual || layernorm) return { text: '部分稳定', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30' };
  return { text: '不稳定！数值爆炸', color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-300 dark:border-red-500/30' };
}

export default function TransformerFlow() {
  const [residual, setResidual] = useState(true);
  const [layernorm, setLayernorm] = useState(true);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);

  const values = getValues(residual, layernorm);
  const stability = stabilityLabel(residual, layernorm);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-500 text-xs font-bold text-white">T</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">层级数据流模拟器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Transformer Block Visualizer</span>
        </div>
      </div>

      {/* Toggle controls */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setResidual(!residual)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              residual
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-red-300 bg-red-50 text-red-600 line-through dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400'
            }`}
          >
            残差连接 {residual ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => setLayernorm(!layernorm)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              layernorm
                ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300'
                : 'border-red-300 bg-red-50 text-red-600 line-through dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400'
            }`}
          >
            层归一化 {layernorm ? 'ON' : 'OFF'}
          </button>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stability.color}`}>
            {stability.text}
          </span>
        </div>
      </div>

      {/* Block flow diagram */}
      <div className="px-5 py-6">
        <div className="flex flex-col items-center gap-2">
          {BLOCK_COMPONENTS.map((comp, i) => {
            const isActive = activeBlock === comp.id;
            const vals = values[comp.id] || values.input;
            const showResidualArrow = residual && (comp.id === 'addnorm1' || comp.id === 'addnorm2');

            return (
              <div key={comp.id} className="w-full max-w-sm">
                {/* Arrow between blocks */}
                {i > 0 && (
                  <div className="flex justify-center py-1">
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-600" />
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-zinc-300 dark:border-t-zinc-600" />
                    </div>
                    {showResidualArrow && (
                      <div className="absolute -ml-32 mt-0.5 text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                        ← + 残差
                      </div>
                    )}
                  </div>
                )}

                {/* Block */}
                <button
                  type="button"
                  onClick={() => setActiveBlock(isActive ? null : comp.id)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition ${
                    isActive
                      ? 'border-indigo-400 ring-2 ring-indigo-400/20 dark:border-indigo-500/60'
                      : 'border-[color:var(--color-border)] hover:border-indigo-300 dark:hover:border-indigo-500/40'
                  } ${comp.color} ${comp.darkColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--color-text)]">{comp.label}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">{comp.sublabel}</div>
                    </div>
                    <div className="text-xs text-[color:var(--color-muted)]">
                      {isActive ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Data values (always visible but smaller when not active) */}
                  <div className={`mt-2 flex gap-1.5 font-mono text-xs ${isActive ? '' : 'opacity-60'}`}>
                    {vals.map((v, vi) => (
                      <span key={vi} className={`rounded px-1.5 py-0.5 bg-white/60 dark:bg-zinc-900/40 ${valColor(v)}`}>
                        {v.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation panel */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        {!residual && !layernorm && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <span className="font-semibold">数值爆炸！</span> 没有残差连接和层归一化，数值在每一层都会急剧膨胀或衰减。
            几十层堆叠后，梯度要么消失（太小无法学习）要么爆炸（训练崩溃）。
          </div>
        )}
        {residual && !layernorm && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="font-semibold">有残差但没归一化：</span> 残差连接保留了原始信息（梯度可以直接跳过子层），
            但数值会随着层数增加逐渐偏移。归一化能把分布"拉回来"。
          </div>
        )}
        {!residual && layernorm && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="font-semibold">有归一化但没残差：</span> 归一化稳定了数值，但没有残差连接，
            深层的梯度只能沿着变换路径传播，信息逐层衰减。
          </div>
        )}
        {residual && layernorm && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="font-semibold">稳定运行。</span> 残差连接 + 层归一化 = 深层 Transformer 的生命线。
            残差让梯度"高速公路"直通底层，归一化让每层输出保持健康的分布。
          </div>
        )}
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-indigo-50/50 dark:bg-indigo-500/5">
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          <span className="font-semibold">试试看：</span>
          关掉残差连接和层归一化，观察数值如何失控。这就是为什么"Attention Is All You Need"标题有误导性——没有这些"配角"，注意力层根本无法堆叠。
        </p>
      </div>
    </div>
  );
}
