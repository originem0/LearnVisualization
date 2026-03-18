'use client';

import { Children, useMemo, useState } from 'react';

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

  return (
    <div className={className}>
      <div className="flex border-b border-[color:var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
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
      <div className="mt-6">{panels[activeIndex] ?? null}</div>
    </div>
  );
}
