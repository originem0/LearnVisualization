'use client';

import { useState } from 'react';
import type { Exercise } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

interface ExerciseSectionProps {
  exercises?: Exercise[];
  locale: Locale;
}

export default function ExerciseSection({ exercises, locale }: ExerciseSectionProps) {
  if (!exercises || exercises.length === 0) return null;
  const isZh = locale === 'zh';

  return (
    <section className="my-10">
      <div className="mx-auto w-full max-w-[54rem]">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {isZh ? '动手练习' : 'Practice'}
        </div>
        <div className="space-y-6">
          {exercises.map((ex, i) => (
            <ExerciseCard key={ex.id || i} exercise={ex} index={i} isZh={isZh} />
          ))}
        </div>
      </div>
    </section>
  );
}

const scaffoldLabels: Record<string, { zh: string; en: string }> = {
  full: { zh: '完全引导', en: 'Guided' },
  'faded-1': { zh: '部分引导', en: 'Partially guided' },
  'faded-2': { zh: '少量引导', en: 'Lightly guided' },
  free: { zh: '自主完成', en: 'Independent' },
};

function ExerciseCard({ exercise, index, isZh }: { exercise: Exercise; index: number; isZh: boolean }) {
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hintsRevealed, setHintsRevealed] = useState(0);

  const scaffoldLabel = scaffoldLabels[exercise.scaffoldLevel || 'full'];
  const hints = exercise.hints || [];
  const hasAnswer = Boolean(exercise.answer);

  const handleSubmit = () => {
    if (userAnswer.trim().length > 0) setSubmitted(true);
  };

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-accent)]/10 text-xs font-bold text-[color:var(--color-accent)]">
          {index + 1}
        </span>
        {scaffoldLabel && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {isZh ? scaffoldLabel.zh : scaffoldLabel.en}
          </span>
        )}
      </div>

      {/* Prompt */}
      <p className="text-sm leading-7 text-[color:var(--color-text)]">{exercise.prompt}</p>

      {/* Options for select-type exercises */}
      {exercise.responseType === 'select' && exercise.options && !submitted && (
        <div className="mt-3 space-y-2">
          {exercise.options.map((opt, j) => (
            <button
              key={j}
              onClick={() => { setUserAnswer(opt); setSubmitted(true); }}
              className="block w-full rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-left text-sm text-[color:var(--color-text)] transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/5"
            >
              {String.fromCharCode(65 + j)}. {opt}
            </button>
          ))}
        </div>
      )}

      {/* Text input for generate/explain/code types */}
      {exercise.responseType !== 'select' && !submitted && (
        <div className="mt-3">
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder={isZh ? '写下你的回答...' : 'Write your answer...'}
            rows={3}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)] focus:outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={userAnswer.trim().length === 0}
            className="mt-2 rounded-lg bg-[color:var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
          >
            {isZh ? '提交' : 'Submit'}
          </button>
        </div>
      )}

      {/* After submission: show answer */}
      {submitted && hasAnswer && (
        <div className="mt-4 border-l-[3px] border-emerald-400 pl-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {isZh ? '参考答案' : 'Reference answer'}
          </div>
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-text)]">{exercise.answer}</p>
        </div>
      )}

      {/* Hints — progressive reveal based on scaffoldLevel */}
      {hints.length > 0 && !submitted && (
        <div className="mt-3">
          {hints.slice(0, hintsRevealed).map((hint, k) => (
            <div key={k} className="mt-2 border-l-[3px] border-amber-300 pl-3">
              <p className="text-xs leading-5 text-[color:var(--color-muted)]">{hint}</p>
            </div>
          ))}
          {hintsRevealed < hints.length && (
            <button
              onClick={() => setHintsRevealed(hintsRevealed + 1)}
              className="mt-2 text-xs text-[color:var(--color-muted)] underline decoration-[color:var(--color-border)] underline-offset-4 transition-colors hover:text-[color:var(--color-text)]"
            >
              {isZh ? `看提示 (${hintsRevealed + 1}/${hints.length})` : `Show hint (${hintsRevealed + 1}/${hints.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
