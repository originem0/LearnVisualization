'use client';

import { useState } from 'react';
import type { RetrievalPrompt } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';

interface RetrievalSectionProps {
  prompts?: RetrievalPrompt[];
  locale: Locale;
}

const typeLabels: Record<string, { zh: string; en: string }> = {
  'predict-next-step': { zh: '预测下一步', en: 'Predict next step' },
  'fill-gap': { zh: '填补空缺', en: 'Fill the gap' },
  'rebuild-map': { zh: '重建关系', en: 'Rebuild the map' },
  'compare-variants': { zh: '比较方案', en: 'Compare variants' },
};

export default function RetrievalSection({ prompts, locale }: RetrievalSectionProps) {
  if (!prompts || prompts.length === 0) return null;
  const isZh = locale === 'zh';

  return (
    <section className="my-10">
      <div className="mx-auto w-full max-w-[54rem]">
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
          {isZh ? '检验你的理解' : 'Check your understanding'}
        </div>
        <div className="space-y-6">
          {prompts.map((prompt, i) => (
            <RetrievalCard key={i} prompt={prompt} isZh={isZh} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RetrievalCard({ prompt, isZh }: { prompt: RetrievalPrompt; isZh: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const typeLabel = typeLabels[prompt.type] ?? { zh: prompt.type, en: prompt.type };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
          {isZh ? typeLabel.zh : typeLabel.en}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{prompt.prompt}</p>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          aria-expanded={revealed}
          aria-label={isZh ? '显示参考提示' : 'Reveal answer hint'}
          className="mt-3 text-sm text-[color:var(--color-muted)] underline decoration-[color:var(--color-border)] underline-offset-4 transition-colors hover:text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
        >
          {isZh ? '我想好了，看提示' : "I've thought about it — show hint"}
        </button>
      ) : (
        <div className="mt-3 border-l-[3px] border-[color:var(--color-border)] pl-4">
          <p className="text-sm leading-6 text-[color:var(--color-muted)]">
            {prompt.answerShape ?? (isZh ? '回顾本章的焦点问题和关键洞察，检查你的理解是否覆盖了核心关系。' : 'Review the focus question and key insight of this chapter.')}
          </p>
        </div>
      )}
    </div>
  );
}
