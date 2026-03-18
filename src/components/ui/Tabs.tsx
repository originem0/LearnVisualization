'use client';

import { Children, useMemo, useState, useId } from 'react';

interface TabsProps {
  tabs: { id: string; label: string }[];
  defaultTab?: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ tabs, defaultTab, children, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || '');
  const panels = useMemo(() => Children.toArray(children), [children]);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === active));
  const baseId = useId();

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex !== null) {
      e.preventDefault();
      setActive(tabs[nextIndex].id);
      // Focus the new tab button
      const btn = document.getElementById(`${baseId}-tab-${tabs[nextIndex].id}`);
      btn?.focus();
    }
  };

  return (
    <div className={className}>
      <div className="flex border-b border-[color:var(--color-border)]" role="tablist" aria-orientation="horizontal">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            id={`${baseId}-tab-${tab.id}`}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? 'border-b-2 border-[color:var(--color-text)] text-[color:var(--color-text)]'
                : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="mt-6"
        role="tabpanel"
        id={`${baseId}-panel-${tabs[activeIndex]?.id}`}
        aria-labelledby={`${baseId}-tab-${tabs[activeIndex]?.id}`}
      >
        {panels[activeIndex] ?? null}
      </div>
    </div>
  );
}
