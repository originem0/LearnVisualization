import type { DialogTurn } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

interface CourseIntroDialogProps {
  turns: DialogTurn[];
  locale: Locale;
}

export default function CourseIntroDialog({ turns, locale }: CourseIntroDialogProps) {
  if (turns.length === 0) return null;
  const isZh = locale === 'zh';

  return (
    <section className="mb-8 border-t border-[color:var(--color-border)] pt-6">
      <div className="mx-auto w-full max-w-[54rem] space-y-4">
        {turns.map((turn, i) => {
          const isLearner = turn.role === 'learner';
          return (
            <div
              key={i}
              className={`flex gap-3 ${isLearner ? '' : 'flex-row-reverse'}`}
            >
              {/* Avatar */}
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  isLearner
                    ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}
              >
                {isLearner ? (isZh ? '学' : 'Q') : (isZh ? '导' : 'A')}
              </div>
              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-[1.75] text-[color:var(--color-text)] ${
                  isLearner
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : 'bg-amber-50/60 dark:bg-amber-900/20'
                }`}
              >
                {turn.text}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
