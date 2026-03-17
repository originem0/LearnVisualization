import Link from 'next/link';
import type { Category, Module } from '@/lib/types';
import { categoryStyles } from '@/lib/palette';

interface SidebarProps {
  categories: Category[];
  modules: Module[];
}

export default function Sidebar({ categories, modules }: SidebarProps) {
  return (
    <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-56 flex-shrink-0 overflow-y-auto pr-2 lg:block">
      <div className="space-y-6">
        {categories.map((category) => {
          const grouped = modules.filter((module) => module.category === category.id);
          const styles = categoryStyles[category.color];
          return (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                {category.name}
              </div>
              <div className="space-y-1">
                {grouped.map((module) => (
                  <Link
                    key={module.id}
                    href={`/m/${module.id}`}
                    className={`flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-sm transition hover:border-[color:var(--color-border)] hover:bg-[color:var(--color-panel)] ${
                      module.current ? 'font-semibold text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'
                    }`}
                  >
                    <span className="truncate">{module.title}</span>
                    {module.current ? (
                      <span className="ml-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
