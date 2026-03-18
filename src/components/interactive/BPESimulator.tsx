'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Pre-computed BPE states ──
   Training corpus: low ×5, lowest ×2, newer ×6, wider ×3
   Initial chars (with end-of-word marker _):
     l o w _       ×5
     l o w e s t _ ×2
     n e w e r _   ×6
     w i d e r _   ×3

   Pair counts at each step computed by hand:
   Step 0 → merge (e,r): 6+3=9
   Step 1 → merge (er,_): 6+3=9
   Step 2 → merge (n,e): appears in "n e w er_" ×6 → 6
   Step 3 → merge (ne,w): appears in "ne w er_" ×6 → 6
   Step 4 → merge (new,er_): appears in "new er_" ×6 → 6
   Step 5 → merge (l,o): appears in "l o w _" ×5 + "l o w e s t _" ×2 → 7
   Step 6 → merge (lo,w): appears in "lo w _" ×5 + "lo w e s t _" ×2 → 7
*/

interface BPEWord {
  chars: string[];
  count: number;
}

interface BPEStep {
  words: BPEWord[];
  topPair: [string, string] | null;
  topPairCount: number;
  mergeResult: string;
  vocab: string[];
}

// highlight indices: for each word, which consecutive char indices form the top pair
function findHighlightIndices(chars: string[], pair: [string, string] | null): number[] {
  if (!pair) return [];
  const indices: number[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    if (chars[i] === pair[0] && chars[i + 1] === pair[1]) {
      indices.push(i, i + 1);
    }
  }
  return indices;
}

const STEPS: BPEStep[] = [
  // Step 0: Initial state
  {
    words: [
      { chars: ['l', 'o', 'w', '_'], count: 5 },
      { chars: ['l', 'o', 'w', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'e', 'r', '_'], count: 6 },
      { chars: ['w', 'i', 'd', 'e', 'r', '_'], count: 3 },
    ],
    topPair: ['e', 'r'],
    topPairCount: 9,
    mergeResult: 'er',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_'],
  },
  // Step 1: After merging e+r → er
  {
    words: [
      { chars: ['l', 'o', 'w', '_'], count: 5 },
      { chars: ['l', 'o', 'w', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'er', '_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er', '_'], count: 3 },
    ],
    topPair: ['er', '_'],
    topPairCount: 9,
    mergeResult: 'er_',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er'],
  },
  // Step 2: After merging er+_ → er_
  {
    words: [
      { chars: ['l', 'o', 'w', '_'], count: 5 },
      { chars: ['l', 'o', 'w', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: ['l', 'o'],
    topPairCount: 7,
    mergeResult: 'lo',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_'],
  },
  // Step 3: After merging l+o → lo
  {
    words: [
      { chars: ['lo', 'w', '_'], count: 5 },
      { chars: ['lo', 'w', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: ['lo', 'w'],
    topPairCount: 7,
    mergeResult: 'low',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_', 'lo'],
  },
  // Step 4: After merging lo+w → low
  {
    words: [
      { chars: ['low', '_'], count: 5 },
      { chars: ['low', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: ['low', '_'],
    topPairCount: 5,
    mergeResult: 'low_',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_', 'lo', 'low'],
  },
  // Step 5: After merging low+_ → low_
  {
    words: [
      { chars: ['low_'], count: 5 },
      { chars: ['low', 'e', 's', 't', '_'], count: 2 },
      { chars: ['n', 'e', 'w', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: ['n', 'e'],
    topPairCount: 6,
    mergeResult: 'ne',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_', 'lo', 'low', 'low_'],
  },
  // Step 6: After merging n+e → ne
  {
    words: [
      { chars: ['low_'], count: 5 },
      { chars: ['low', 'e', 's', 't', '_'], count: 2 },
      { chars: ['ne', 'w', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: ['ne', 'w'],
    topPairCount: 6,
    mergeResult: 'new',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_', 'lo', 'low', 'low_', 'ne'],
  },
  // Step 7: After merging ne+w → new  (final display state)
  {
    words: [
      { chars: ['low_'], count: 5 },
      { chars: ['low', 'e', 's', 't', '_'], count: 2 },
      { chars: ['new', 'er_'], count: 6 },
      { chars: ['w', 'i', 'd', 'er_'], count: 3 },
    ],
    topPair: null,
    topPairCount: 0,
    mergeResult: '',
    vocab: ['l', 'o', 'w', 'e', 's', 't', 'n', 'r', 'i', 'd', '_', 'er', 'er_', 'lo', 'low', 'low_', 'ne', 'new'],
  },
];

const MERGE_HISTORY = [
  { pair: 'e + r', result: 'er', count: 9 },
  { pair: 'er + _', result: 'er_', count: 9 },
  { pair: 'l + o', result: 'lo', count: 7 },
  { pair: 'lo + w', result: 'low', count: 7 },
  { pair: 'low + _', result: 'low_', count: 5 },
  { pair: 'n + e', result: 'ne', count: 6 },
  { pair: 'ne + w', result: 'new', count: 6 },
];

const TOTAL_STEPS = STEPS.length - 1; // 7 merges, last state has no topPair

export default function BPESimulator() {
  const [step, setStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step >= TOTAL_STEPS;

  const goNext = useCallback(() => {
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goPrev = useCallback(() => {
    setStep(s => Math.max(s - 1, 0));
    setAutoPlay(false);
  }, []);

  const reset = useCallback(() => {
    setStep(0);
    setAutoPlay(false);
  }, []);

  // Auto-play
  useEffect(() => {
    if (!autoPlay || isLast) {
      if (isLast) setAutoPlay(false);
      return;
    }
    const timer = setInterval(goNext, 1500);
    return () => clearInterval(timer);
  }, [autoPlay, isLast, goNext]);

  return (
    <div className="my-10 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-panel)] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500 text-xs font-bold text-white">B</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text)]">BPE 合并模拟器</h3>
          <span className="text-xs text-[color:var(--color-muted)]">逐步体验 Byte Pair Encoding</span>
        </div>
      </div>

      {/* Corpus */}
      <div className="border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">训练语料</div>
        <div className="flex flex-wrap gap-3 text-sm text-[color:var(--color-text)]">
          <span className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono">low <span className="text-[color:var(--color-muted)]">×5</span></span>
          <span className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono">lowest <span className="text-[color:var(--color-muted)]">×2</span></span>
          <span className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono">newer <span className="text-[color:var(--color-muted)]">×6</span></span>
          <span className="rounded border border-[color:var(--color-border)] px-2 py-0.5 font-mono">wider <span className="text-[color:var(--color-muted)]">×3</span></span>
        </div>
      </div>

      {/* Current state */}
      <div className="px-5 py-4">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-3">当前分词状态</div>
        <div className="space-y-2">
          {current.words.map((word, wi) => {
            const highlights = findHighlightIndices(word.chars, current.topPair);
            return (
              <div key={wi} className="flex items-center gap-2 font-mono text-sm">
                <div className="flex flex-wrap gap-1">
                  {word.chars.map((ch, ci) => {
                    const isHighlighted = highlights.includes(ci);
                    return (
                      <span
                        key={ci}
                        className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 min-w-[1.75rem] text-center transition-colors ${
                          isHighlighted
                            ? 'bg-amber-200 text-amber-900 font-bold dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-400/50'
                            : 'bg-zinc-100 text-[color:var(--color-text)] dark:bg-zinc-800'
                        }`}
                      >
                        {ch}
                      </span>
                    );
                  })}
                </div>
                <span className="text-xs text-[color:var(--color-muted)] shrink-0">×{word.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top pair info */}
      {current.topPair && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[color:var(--color-muted)]">最高频对:</span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              ({current.topPair[0]}, {current.topPair[1]})
            </span>
            <span className="text-[color:var(--color-muted)]">→</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
              {current.topPairCount} 次
            </span>
          </div>
        </div>
      )}

      {isLast && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-3">
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            演示完成 — 词表从 11 个字符扩展到 {current.vocab.length} 个符号
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-[color:var(--color-muted)]">
            步骤 {step}/{TOTAL_STEPS}
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] transition hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800"
            >
              ← 上一步
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={isLast}
              className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-30 disabled:cursor-not-allowed dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
            >
              下一步 →
            </button>
            <button
              type="button"
              onClick={() => setAutoPlay(!autoPlay)}
              disabled={isLast}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-30 disabled:cursor-not-allowed ${
                autoPlay
                  ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {autoPlay ? '暂停 ⏸' : '自动播放 ▶'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isFirst}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted)] transition hover:text-[color:var(--color-text)] hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-zinc-800"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      {/* Merge history */}
      {step > 0 && (
        <div className="border-t border-[color:var(--color-border)] px-5 py-3">
          <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">合并历史</div>
          <div className="space-y-1">
            {MERGE_HISTORY.slice(0, step).map((merge, i) => (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shrink-0">
                  {i + 1}
                </span>
                <span className="text-[color:var(--color-text)]">
                  {merge.pair} → <span className="font-bold text-blue-600 dark:text-blue-400">{merge.result}</span>
                </span>
                <span className="text-[color:var(--color-muted)]">({merge.count}次)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vocab */}
      <div className="border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="text-xs font-medium text-[color:var(--color-muted)] mb-2">
          当前词表 <span className="font-mono">({current.vocab.length})</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {current.vocab.map((v, i) => {
            // Highlight newly added vocab items (those not in initial vocab)
            const isNew = i >= 11; // initial vocab has 11 chars
            return (
              <span
                key={`${v}-${i}`}
                className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                  isNew
                    ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-500/20 dark:text-blue-300'
                    : 'bg-zinc-100 text-[color:var(--color-text)] dark:bg-zinc-800'
                }`}
              >
                {v}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
