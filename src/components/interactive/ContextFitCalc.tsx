'use client';

import { useState } from 'react';

/* ── Context Fit Calculator ──
   Stacking blocks: different content types filling a model context window.
   Visual: colored blocks in a container.
*/

interface ContentType {
  id: string;
  name: string;
  tokens: number;
  color: string;
  darkColor: string;
  icon: string;
}

const CONTENT_TYPES: ContentType[] = [
  { id: 'email',    name: '一封邮件',         tokens: 500,     color: 'bg-blue-200 dark:bg-blue-500/20',    darkColor: 'text-blue-700 dark:text-blue-300',   icon: '✉' },
  { id: 'article',  name: '一篇新闻文章',     tokens: 2000,    color: 'bg-emerald-200 dark:bg-emerald-500/20', darkColor: 'text-emerald-700 dark:text-emerald-300', icon: '📰' },
  { id: 'paper',    name: '一篇学术论文',     tokens: 8000,    color: 'bg-purple-200 dark:bg-purple-500/20', darkColor: 'text-purple-700 dark:text-purple-300', icon: '📄' },
  { id: 'chapter',  name: '一章小说',         tokens: 15000,   color: 'bg-amber-200 dark:bg-amber-500/20',   darkColor: 'text-amber-700 dark:text-amber-300',  icon: '📖' },
  { id: 'book',     name: '一本书',           tokens: 100000,  color: 'bg-red-200 dark:bg-red-500/20',       darkColor: 'text-red-700 dark:text-red-300',      icon: '📚' },
  { id: 'codebase', name: '一个代码仓库',     tokens: 500000,  color: 'bg-zinc-300 dark:bg-zinc-600/30',     darkColor: 'text-zinc-700 dark:text-zinc-300',    icon: '💻' },
];

interface ModelCtx {
  name: string;
  tokens: number;
}

const MODELS: ModelCtx[] = [
  { name: 'GPT-3.5',     tokens: 16000 },
  { name: 'GPT-4',       tokens: 128000 },
  { name: 'Claude 3.5',  tokens: 200000 },
  { name: 'Gemini 1.5',  tokens: 1000000 },
];

function formatK(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(n);
}

export default function ContextFitCalc() {
  const [selectedItems, setSelectedItems] = useState<string[]>(['email', 'article']);
  const [modelIdx, setModelIdx] = useState(1); // GPT-4

  const model = MODELS[modelIdx];

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedContents = CONTENT_TYPES.filter(c => selectedItems.includes(c.id));
  const totalTokens = selectedContents.reduce((sum, c) => sum + c.tokens, 0);
  const fits = totalTokens <= model.tokens;
  const fillPercent = Math.min(100, (totalTokens / model.tokens) * 100);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-xs font-bold text-white">F</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">上下文容量计算器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">What Fits in Context?</span>
        </div>
      </div>

      {/* Model selector */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择模型</div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setModelIdx(i)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                modelIdx === i
                  ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
              }`}
            >
              {m.name} ({formatK(m.tokens)})
            </button>
          ))}
        </div>
      </div>

      {/* Content type picker */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">选择要放入上下文的内容（可多选）</div>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map(c => {
            const active = selectedItems.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleItem(c.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:border-red-300 dark:hover:border-red-500/40'
                }`}
              >
                {c.icon} {c.name} (~{formatK(c.tokens)})
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual: stacked blocks in container */}
      <div className="px-5 py-5">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">
          {model.name} 的上下文窗口（{formatK(model.tokens)} tokens）
        </div>

        {/* Container */}
        <div className="relative h-16 rounded-lg border-2 border-[color:var(--color-border)] bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden">
          {/* Stacked blocks */}
          <div className="absolute inset-0 flex">
            {selectedContents.map(c => {
              const widthPercent = Math.min(100, (c.tokens / model.tokens) * 100);
              return (
                <div
                  key={c.id}
                  className={`h-full ${c.color} flex items-center justify-center border-r border-white/50 dark:border-zinc-600/50 transition-all duration-300`}
                  style={{ width: `${widthPercent}%`, minWidth: widthPercent > 0.5 ? 20 : 4 }}
                >
                  {widthPercent > 5 && (
                    <span className={`text-[10px] font-medium ${c.darkColor} truncate px-1`}>
                      {c.icon} {formatK(c.tokens)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overflow indicator */}
          {!fits && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-red-500/30 to-transparent flex items-center justify-center">
              <span className="text-red-600 dark:text-red-400 text-lg font-bold">!</span>
            </div>
          )}
        </div>

        {/* Fill bar below */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                fits ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, fillPercent)}%` }}
            />
          </div>
          <span className={`text-xs font-mono font-semibold ${fits ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {fillPercent.toFixed(0)}%
          </span>
        </div>

        {/* Summary */}
        <div className="mt-2 text-xs text-[color:var(--color-text)]">
          已用 <span className="font-mono font-semibold">{formatK(totalTokens)}</span> / {formatK(model.tokens)} tokens
          {fits
            ? <span className="ml-2 text-emerald-600 dark:text-emerald-400">— 可以放入</span>
            : <span className="ml-2 text-red-600 dark:text-red-400">— 超出上下文窗口！</span>
          }
        </div>
      </div>

      {/* Cross-model comparison */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">各模型能否容纳你的选择</div>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => {
            const canFit = totalTokens <= m.tokens;
            return (
              <div
                key={m.name}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  canFit
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                }`}
              >
                {m.name}: {canFit ? '✓' : '✗'} ({formatK(m.tokens)})
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-4">
        <div className="text-xs text-[color:var(--color-text)] leading-relaxed">
          <span className="font-semibold">原理：</span>
          上下文窗口是模型一次能"看到"的最大文本量。窗口越大，能处理的信息越多——
          但计算成本以 O(n²) 增长。不同模型在上下文大小上差异巨大：
          GPT-3.5 只有 16K，而 Gemini 1.5 达到 1M。
        </div>
      </div>

      {/* Insight */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3 bg-red-50/50 dark:bg-red-500/5">
        <p className="text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold">试试看：</span>
          同时选中"一本书"和"一个代码仓库"，看看哪些模型能容纳。
          然后在 GPT-3.5 和 Gemini 1.5 之间切换——上下文大小差了 62 倍！
        </p>
      </div>
    </div>
  );
}
