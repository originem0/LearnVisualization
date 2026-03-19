'use client';

import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';
import { getModuleSlug } from '@/lib/module-slug';
import type { Locale } from '@/lib/i18n';
import { useState } from 'react';

interface KnowledgeMapProps {
  categories: Category[];
  modules: Module[];
  locale: Locale;
  basePath?: string;
}

/**
 * Interactive vertical knowledge map.
 * Shows layers as horizontal bands with module nodes + inter-layer connections.
 */
export default function KnowledgeMap({ categories, modules, locale, basePath = `/${locale}` }: KnowledgeMapProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const grouped = categories.map((cat) => ({
    ...cat,
    modules: modules.filter((m) => m.category === cat.id),
  }));

  return (
    <div className="space-y-1">
      {grouped.map((group, layerIdx) => {
        const styles = categoryStyles[group.color];
        const isLast = layerIdx === grouped.length - 1;

        return (
          <div key={group.id}>
            {/* Layer band */}
            <div className={`rounded-xl border ${styles.border} bg-[color:var(--color-panel)] p-4 sm:p-5`}>
              {/* Layer header */}
              <div className="mb-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${styles.badge} rounded-full px-2 py-0.5`}>
                  {group.name}
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  — {locale === 'zh' ? layerDescriptions[group.id] : layerDescriptionsEn[group.id]}
                </span>
              </div>

              {/* Module nodes */}
              <div className="flex flex-wrap gap-2">
                {group.modules.map((mod, modIdx) => {
                  const isHovered = hovered === mod.id;
                  const slug = getModuleSlug(mod.id);
                  const isLastInGroup = modIdx === group.modules.length - 1;

                  return (
                    <div key={mod.id} className="flex items-center">
                      <Link
                        href={`/${locale}/${slug}/`}
                        className={`relative block rounded-lg border px-3 py-2.5 transition-all ${
                          isHovered
                            ? `${styles.border} shadow-md scale-[1.03] ${styles.soft}`
                            : 'border-[color:var(--color-border)] hover:border-[color:var(--color-muted)]'
                        }`}
                        onMouseEnter={() => setHovered(mod.id)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[color:var(--color-muted)]">{slug}</span>
                          <span className="text-sm font-medium text-[color:var(--color-text)]">{mod.title}</span>
                        </div>
                        {/* Tooltip on hover */}
                        {isHovered && (
                          <div className="absolute left-0 top-full z-10 mt-2 w-56 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-3 shadow-lg">
                            <div className="text-xs text-[color:var(--color-muted)]">{mod.subtitle}</div>
                          </div>
                        )}
                      </Link>
                      {/* Arrow between modules in same layer */}
                      {!isLastInGroup && (
                        <span className="mx-1 text-[color:var(--color-muted)]">→</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inter-layer connector */}
            {!isLast && (
              <div className="flex justify-center py-1">
                <div className="flex flex-col items-center">
                  <div className="h-4 w-px bg-[color:var(--color-border)]" />
                  <span className="text-xs text-[color:var(--color-muted)]">↓</span>
                  <div className="h-4 w-px bg-[color:var(--color-border)]" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const layerDescriptions: Record<string, string> = {
  foundations: '文本如何变成模型能处理的数字',
  architecture: '信息如何在网络中流动和变换',
  training: '模型如何从数据中获得能力',
  application: '如何让模型按人类意图工作',
  frontier: '规模、涌现与系统化认知',
};

const layerDescriptionsEn: Record<string, string> = {
  foundations: 'How text becomes numbers a model can process',
  architecture: 'How information flows and transforms in the network',
  training: 'How models acquire capabilities from data',
  application: 'How to make models work as intended',
  frontier: 'Scale, emergence, and system-level understanding',
};
