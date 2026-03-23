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
          {isZh ? '思考题' : 'Reflections'}
        </div>
        <div className="space-y-4">
          {exercises.map((ex, i) => (
            <ExerciseCard key={ex.id || i} exercise={ex} index={i} isZh={isZh} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ExerciseCard({ exercise, index, isZh }: { exercise: Exercise; index: number; isZh: boolean }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const hints = exercise.hints || [];

  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-accent)]/10 text-xs font-bold text-[color:var(--color-accent)]">
          {index + 1}
        </span>
      </div>

      <p className="text-sm leading-7 text-[color:var(--color-text)]">{exercise.prompt}</p>

      {hints.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {hints.map((hint, k) => (
            <div key={k} className="border-l-[3px] border-amber-300 pl-3">
              <p className="text-xs leading-5 text-[color:var(--color-muted)]">{hint}</p>
            </div>
          ))}
        </div>
      )}

      {exercise.answer && (
        <div className="mt-3">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="text-xs text-[color:var(--color-muted)] underline decoration-[color:var(--color-border)] underline-offset-4 transition-colors hover:text-[color:var(--color-text)]"
          >
            {showAnswer
              ? (isZh ? '收起参考思路' : 'Hide reference')
              : (isZh ? '查看参考思路' : 'Show reference')}
          </button>
          {showAnswer && (
            <div className="mt-2 border-l-[3px] border-emerald-400 pl-4">
              <p className="text-sm leading-6 text-[color:var(--color-text)]">{exercise.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
