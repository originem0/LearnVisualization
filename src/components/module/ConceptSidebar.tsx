'use client';

import { useState } from 'react';
import type { CategoryColor, ConceptItem } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

interface ConceptSidebarProps {
  concepts: ConceptItem[];
  categoryColor: CategoryColor;
  locale: Locale;
}

export default function ConceptSidebar({ concepts, categoryColor, locale }: ConceptSidebarProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  if (concepts.length === 0) return null;
  const isZh = locale === 'zh';

  const toggle = (name: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, name: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(name);
    }
  };

  return (
    <div className="my-4 pl-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
        {isZh ? '关键概念' : 'Key concepts'}
      </div>
      <div className="mt-2 space-y-1.5">
        {concepts.map((concept) => {
          const isOpen = revealed.has(concept.name);
          return (
            <div
              key={concept.name}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onClick={() => toggle(concept.name)}
              onKeyDown={(e) => handleKeyDown(e, concept.name)}
              className="cursor-pointer select-none rounded-md px-1 py-0.5 text-sm leading-6 text-[color:var(--color-text)] transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
            >
              <span className="font-semibold">{concept.name}</span>
              {concept.note && !isOpen && (
                <span className="ml-1.5 text-xs text-[color:var(--color-muted)]">
                  {isZh ? '点击回忆' : '?'}
                </span>
              )}
              {concept.note && isOpen && (
                <span className="text-[color:var(--color-muted)]"> — {concept.note}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
