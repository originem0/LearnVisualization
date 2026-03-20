'use client';

import { useState } from 'react';
import type { ConceptItem, PitfallItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import ConceptList from '@/components/ConceptList';
import PitfallList from '@/components/PitfallList';
import { getLabels } from '@/lib/labels';

interface ReferencePanelProps {
  concepts: ConceptItem[];
  logicChain: string[];
  examples: string[];
  counterexamples?: string[];
  pitfalls?: PitfallItem[];
  locale: Locale;
}

export default function ReferencePanel({
  concepts,
  logicChain,
  examples,
  counterexamples,
  pitfalls,
  locale,
}: ReferencePanelProps) {
  const [open, setOpen] = useState(false);
  const labels = getLabels(locale);
  const isZh = locale === 'zh';
  const counterexamplesList = counterexamples ?? [];
  const pitfallsList = pitfalls ?? [];

  const hasContent = concepts.length > 0 || logicChain.length > 0 || examples.length > 0 || counterexamplesList.length > 0 || pitfallsList.length > 0;
  if (!hasContent) return null;

  return (
    <section className="my-8">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between border-t border-[color:var(--color-border)] px-0 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[color:var(--color-text)]">
          {isZh ? '参考资料与结构化数据' : 'Reference & structured data'}
        </span>
        <span className="text-[color:var(--color-muted)] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </button>

      {open && (
        <div className="space-y-6 pb-4">
          {concepts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--color-text)]">{labels.sections.conceptList}</h3>
              <div className="mt-3">
                <ConceptList items={concepts} locale={locale} />
              </div>
            </div>
          )}

          {logicChain.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--color-text)]">{labels.sections.logicChain}</h3>
              <ol className="mt-3 space-y-1.5 text-sm text-[color:var(--color-text)]">
                {logicChain.map((step, index) => (
                  <li key={`${step}-${index}`} className="leading-6 pl-1">
                    <span className="text-[color:var(--color-muted)] font-mono text-xs">{index + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {examples.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--color-text)]">{labels.sections.examples}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--color-text)]">
                  {examples.map((example, index) => (
                    <li key={`${example}-${index}`} className="leading-6 pl-1">
                      · {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {counterexamplesList.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--color-text)]">{labels.sections.counterexamples}</h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[color:var(--color-text)]">
                  {counterexamplesList.map((example, index) => (
                    <li key={`${example}-${index}`} className="leading-6 pl-1">
                      · {example}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {pitfallsList.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--color-text)]">{labels.sections.pitfalls}</h3>
              <div className="mt-3">
                <PitfallList items={pitfallsList} locale={locale} />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
