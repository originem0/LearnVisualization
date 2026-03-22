'use client';

import { useState } from 'react';
import type { RetrievalPrompt } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';

interface RetrievalSectionProps {
  prompts?: RetrievalPrompt[];
  locale: Locale;
  focusQuestion?: string;
  keyInsight?: string;
}

const typeLabels: Record<string, { zh: string; en: string }> = {
  'predict-next-step': { zh: '预测下一步', en: 'Predict next step' },
  'fill-gap': { zh: '填补空缺', en: 'Fill the gap' },
  'rebuild-map': { zh: '重建关系', en: 'Rebuild the map' },
  'compare-variants': { zh: '比较方案', en: 'Compare variants' },
};

export default function RetrievalSection({ prompts, locale, focusQuestion, keyInsight }: RetrievalSectionProps) {
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
            <RetrievalCard
              key={i}
              prompt={prompt}
              isZh={isZh}
              focusQuestion={focusQuestion}
              keyInsight={keyInsight}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const MIN_CHARS = 10;

function RetrievalCard({
  prompt,
  isZh,
  focusQuestion,
  keyInsight,
}: {
  prompt: RetrievalPrompt;
  isZh: boolean;
  focusQuestion?: string;
  keyInsight?: string;
}) {
  const [phase, setPhase] = useState<'question' | 'writing' | 'revealed'>('question');
  const [userText, setUserText] = useState('');
  const typeLabel = typeLabels[prompt.type] ?? { zh: prompt.type, en: prompt.type };

  const answerHint =
    prompt.answerShape ??
    (focusQuestion && keyInsight
      ? isZh
        ? `试着回答：${focusQuestion} 提示方向：${keyInsight.slice(0, 60)}...`
        : `Try answering: ${focusQuestion} Hint: ${keyInsight.slice(0, 60)}...`
      : isZh
        ? '回顾本章的焦点问题和关键洞察，检查你的理解是否覆盖了核心关系。'
        : 'Review the focus question and key insight of this chapter.');

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
          {isZh ? typeLabel.zh : typeLabel.en}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-[color:var(--color-text)]">{prompt.prompt}</p>

      {phase === 'question' && (
        <button
          onClick={() => setPhase('writing')}
          className="mt-3 text-sm text-[color:var(--color-muted)] underline decoration-[color:var(--color-border)] underline-offset-4 transition-colors hover:text-[color:var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
        >
          {isZh ? '我来试试' : 'Let me try'}
        </button>
      )}

      {phase === 'writing' && (
        <div className="mt-3">
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder={isZh ? '先写下你的想法...' : 'Write your thoughts first...'}
            rows={3}
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted)] focus:border-[color:var(--color-accent)] focus:outline-none"
            autoFocus
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setPhase('revealed')}
              disabled={userText.trim().length < MIN_CHARS}
              className="rounded-lg bg-[color:var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
            >
              {isZh ? '写好了，看提示' : "Done — show hint"}
            </button>
            <span className="text-[10px] text-[color:var(--color-muted)]">
              {userText.trim().length < MIN_CHARS
                ? isZh
                  ? `至少写 ${MIN_CHARS} 个字`
                  : `At least ${MIN_CHARS} characters`
                : ''}
            </span>
          </div>
        </div>
      )}

      {phase === 'revealed' && (
        <>
          {userText.trim() && (
            <div className="mt-3 rounded-lg bg-blue-50/50 px-3 py-2 dark:bg-blue-900/10">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                {isZh ? '你的回答' : 'Your answer'}
              </div>
              <p className="mt-1 text-sm leading-6 text-[color:var(--color-text)]">{userText}</p>
            </div>
          )}
          <div className="mt-3 border-l-[3px] border-[color:var(--color-border)] pl-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
              {isZh ? '参考方向' : 'Reference direction'}
            </div>
            <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{answerHint}</p>
          </div>
        </>
      )}
    </div>
  );
}
