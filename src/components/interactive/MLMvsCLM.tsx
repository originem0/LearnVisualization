'use client';

import { useState } from 'react';

/* ── MLM vs CLM comparison ──
   Visualises the two dominant pretraining objectives:
   - CLM (Causal LM): autoregressive, left-to-right, right side masked
   - MLM (Masked LM): random 15% masked, bidirectional context
   Shows information flow difference on the same sentence.          */

const SENTENCE = '今天天气真的很不错';
const TOKENS = ['今', '天', '天', '气', '真', '的', '很', '不', '错'];

// CLM: at each position, the model sees everything to the left.
// We let the user step through positions to see the causal mask grow.
// MLM: fixed random 15% mask (pre-chosen indices 2, 5, 7 — roughly 3/9 ≈ 33%,
// but we use 3 to keep the visual clear for a short sentence).
const MLM_MASKED_INDICES = [2, 5, 7];

type Mode = 'clm' | 'mlm';

export default function MLMvsCLM() {
  const [mode, setMode] = useState<Mode>('clm');
  const [clmPos, setClmPos] = useState(4); // which position is being predicted (1..8)
  const [mlmReveal, setMlmReveal] = useState(false);

  const handleModeSwitch = (m: Mode) => {
    setMode(m);
    setMlmReveal(false);
  };

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-500 text-xs font-bold text-white">M</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">MLM vs CLM 对比</h3>
          <span className="text-xs text-[color:var(--color-muted)]">Masked vs Causal Language Modeling</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择预训练目标</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleModeSwitch('clm')}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              mode === 'clm'
                ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500/50 dark:bg-purple-500/10 dark:text-purple-300'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-purple-300 dark:hover:border-purple-500/40'
            }`}
          >
            CLM 因果语言模型
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('mlm')}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
              mode === 'mlm'
                ? 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500/50 dark:bg-purple-500/10 dark:text-purple-300'
                : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-purple-300 dark:hover:border-purple-500/40'
            }`}
          >
            MLM 掩码语言模型
          </button>
        </div>
      </div>

      {/* Sentence visualisation */}
      <div className="px-5 py-5">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-1">
          示例句子: {SENTENCE}
        </div>
        <div className="text-xs text-[color:var(--color-muted)] mb-4">
          {mode === 'clm'
            ? '从左到右逐个预测——每个位置只能看到它左边的词'
            : '随机遮住一些词——每个 [MASK] 可以看到左右两边的上下文'}
        </div>

        {/* Token row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {TOKENS.map((token, i) => {
            let tokenClass: string;
            let display: string;

            if (mode === 'clm') {
              // Tokens before clmPos are visible, clmPos is the target, rest are hidden
              if (i < clmPos) {
                tokenClass = 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/40';
                display = token;
              } else if (i === clmPos) {
                tokenClass = 'bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-400/50 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40 dark:ring-amber-500/30';
                display = '?';
              } else {
                tokenClass = 'bg-zinc-200 text-zinc-400 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-500 dark:border-zinc-600';
                display = '\u2588'; // block character for "unseen"
              }
            } else {
              // MLM mode
              if (MLM_MASKED_INDICES.includes(i)) {
                if (mlmReveal) {
                  tokenClass = 'bg-green-100 text-green-800 border-green-400 dark:bg-green-500/20 dark:text-green-200 dark:border-green-500/40';
                  display = token;
                } else {
                  tokenClass = 'bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-400/50 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40 dark:ring-amber-500/30';
                  display = 'MASK';
                }
              } else {
                tokenClass = 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/20 dark:text-purple-200 dark:border-purple-500/40';
                display = token;
              }
            }

            return (
              <span
                key={i}
                className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-mono font-medium min-w-[2.5rem] transition-colors ${tokenClass}`}
              >
                {display}
              </span>
            );
          })}
        </div>

        {/* Information flow arrows */}
        <div className="rounded-lg border border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">信息流向</div>
          {mode === 'clm' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                <svg width="120" height="24" viewBox="0 0 120 24" className="shrink-0">
                  <defs>
                    <marker id="arrowFlowCLM" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,1 L9,5 L0,9 z" className="fill-purple-500 dark:fill-purple-400" />
                    </marker>
                  </defs>
                  <line x1="4" y1="12" x2="112" y2="12" className="stroke-purple-500 dark:stroke-purple-400" strokeWidth="2" markerEnd="url(#arrowFlowCLM)" />
                </svg>
                <span className="text-xs">单向: 从左到右</span>
              </div>
              <p className="text-xs text-[color:var(--color-muted)]">
                位置 {clmPos} 的预测只依赖位置 0~{clmPos - 1} 的信息。未来的词被完全遮挡——这是 GPT 系列的训练方式。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                <svg width="120" height="24" viewBox="0 0 120 24" className="shrink-0">
                  <defs>
                    <marker id="arrowFlowMLMR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,1 L9,5 L0,9 z" className="fill-purple-500 dark:fill-purple-400" />
                    </marker>
                    <marker id="arrowFlowMLML" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M10,1 L1,5 L10,9 z" className="fill-purple-500 dark:fill-purple-400" />
                    </marker>
                  </defs>
                  <line x1="4" y1="8" x2="112" y2="8" className="stroke-purple-500 dark:stroke-purple-400" strokeWidth="2" markerEnd="url(#arrowFlowMLMR)" />
                  <line x1="116" y1="18" x2="8" y2="18" className="stroke-purple-500 dark:stroke-purple-400" strokeWidth="2" markerEnd="url(#arrowFlowMLML)" />
                </svg>
                <span className="text-xs">双向: 左右都能看到</span>
              </div>
              <p className="text-xs text-[color:var(--color-muted)]">
                每个 [MASK] 的预测可以同时利用左右两侧的上下文。被遮住的位置: {MLM_MASKED_INDICES.map(i => `"${TOKENS[i]}"`).join('、')}——这是 BERT 系列的训练方式。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        {mode === 'clm' ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[color:var(--color-muted)]">预测位置</span>
            <input
              type="range"
              min={1}
              max={TOKENS.length - 1}
              value={clmPos}
              onChange={e => setClmPos(Number(e.target.value))}
              className="flex-1 max-w-[200px] accent-purple-500"
            />
            <span className="text-xs font-mono text-[color:var(--color-text)]">
              {clmPos}/{TOKENS.length - 1}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMlmReveal(!mlmReveal)}
              className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition ${
                mlmReveal
                  ? 'border-green-400 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-300'
                  : 'border-purple-400 bg-purple-50 text-purple-700 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300'
              }`}
            >
              {mlmReveal ? '重新遮住' : '揭示答案'}
            </button>
            <span className="text-xs text-[color:var(--color-muted)]">
              遮住了 {MLM_MASKED_INDICES.length}/{TOKENS.length} 个词 ({Math.round(MLM_MASKED_INDICES.length / TOKENS.length * 100)}%)
            </span>
          </div>
        )}
      </div>

      {/* Comparison table */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">对比总结</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`rounded-lg border p-3 transition ${
            mode === 'clm'
              ? 'border-purple-300 bg-purple-50/50 dark:border-purple-500/30 dark:bg-purple-500/5'
              : 'border-[color:var(--color-border)]'
          }`}>
            <div className="font-semibold text-[color:var(--color-text)] mb-2">CLM (因果)</div>
            <ul className="space-y-1 text-[color:var(--color-muted)]">
              <li>方向: 单向 (左→右)</li>
              <li>遮挡: 右侧全部遮住</li>
              <li>代表: GPT 系列</li>
              <li>擅长: 生成任务</li>
            </ul>
          </div>
          <div className={`rounded-lg border p-3 transition ${
            mode === 'mlm'
              ? 'border-purple-300 bg-purple-50/50 dark:border-purple-500/30 dark:bg-purple-500/5'
              : 'border-[color:var(--color-border)]'
          }`}>
            <div className="font-semibold text-[color:var(--color-text)] mb-2">MLM (掩码)</div>
            <ul className="space-y-1 text-[color:var(--color-muted)]">
              <li>方向: 双向 (左↔右)</li>
              <li>遮挡: 随机 15% 词</li>
              <li>代表: BERT 系列</li>
              <li>擅长: 理解任务</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-purple-50/50 dark:bg-purple-500/5">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          <span className="font-semibold">关键区别: </span>
          CLM 的因果掩码让模型适合<em>生成</em>——训练和推理时的信息流一致；MLM 的双向上下文让模型更好地<em>理解</em>语义——但无法直接自回归生成。两种目标都是自监督的: 用文本自身构造训练信号，不需要人工标注。
        </p>
      </div>
    </div>
  );
}
