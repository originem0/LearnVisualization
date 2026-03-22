'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Category } from '@/lib/types';
import type { CourseModule } from '@/lib/course-schema';
import { categoryStyles } from '@/lib/palette';
import { getModuleSlug } from '@/lib/module-slug';
import type { Locale } from '@/lib/i18n';

interface SidebarProps {
  categories: Category[];
  modules: CourseModule[];
  locale: Locale;
  basePath?: string;
}

export default function Sidebar({ categories, modules, locale, basePath = `/${locale}` }: SidebarProps) {
  const pathname = usePathname();

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, CourseModule[]>();
    for (const cat of categories) {
      map.set(cat.id, modules.filter((m) => m.category === cat.id));
    }
    return map;
  }, [categories, modules]);

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-48 flex-shrink-0 overflow-y-auto pr-1 xl:block 2xl:w-52">
      <div className="space-y-4">
        {categories.map((category) => {
          const grouped = groupedByCategory.get(category.id) ?? [];
          const styles = categoryStyles[category.color];
          const hasActiveChild = grouped.some(
            (m) => pathname === `${basePath}/${getModuleSlug(m.id)}` || pathname === `${basePath}/${getModuleSlug(m.id)}/`
          );

          return (
            <div key={category.id}>
              <div className="flex items-center gap-1.5 pb-1.5">
                <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
                    hasActiveChild ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'
                  }`}
                >
                  {category.name}
                </span>
              </div>
              <ul className="space-y-1">
                {grouped.map((module) => {
                  const href = `${basePath}/${getModuleSlug(module.id)}/`;
                  const isActive = pathname === href || pathname === href.replace(/\/$/, '');
                  return (
                    <li key={module.id}>
                      <Link
                        href={href}
                        className={`block rounded-xl px-2.5 py-2 transition-colors ${
                          isActive
                            ? `${styles.soft} border border-transparent text-[color:var(--color-text)]`
                            : 'border border-transparent text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:bg-zinc-50 hover:text-[color:var(--color-text)] dark:hover:bg-[#0b3a45]/45'
                        }`}
                      >
                        <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
                          {getModuleSlug(module.id)}
                        </span>
                        <span className="mt-1 block text-[13px] leading-5">{module.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
