import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';
import { getModuleSlug } from '@/lib/data';
import type { Locale } from '@/lib/i18n';

interface SidebarProps {
  categories: Category[];
  modules: Module[];
  locale: Locale;
}

export default function Sidebar({ categories, modules, locale }: SidebarProps) {
  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-56 flex-shrink-0 overflow-y-auto pr-2 lg:block">
      <div className="space-y-5">
        {categories.map((category) => {
          const grouped = modules.filter((module) => module.category === category.id);
          const styles = categoryStyles[category.color];
          return (
            <div key={category.id}>
              <div className="flex items-center gap-1.5 pb-1.5">
                <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
                  {category.name}
                </span>
              </div>
              <ul className="space-y-0.5">
                {grouped.map((module) => (
                  <li key={module.id}>
                    <Link
                      href={`/${locale}/${getModuleSlug(module.id)}/`}
                      className="block rounded-md px-2.5 py-1.5 text-sm text-[color:var(--color-muted)] transition-colors hover:bg-zinc-100 hover:text-[color:var(--color-text)] dark:hover:bg-zinc-800/50"
                    >
                      <span className="font-mono text-xs">{getModuleSlug(module.id)}</span>
                      <span className="ml-1.5">{module.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
