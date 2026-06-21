'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Chapter } from '@/lib/course-schema';
import type { Locale } from '@/lib/i18n';

interface EssaySidebarProps {
  chapters: Chapter[];
  locale: Locale;
  basePath: string;
}

export default function EssaySidebar({ chapters, locale, basePath }: EssaySidebarProps) {
  const pathname = usePathname();
  const isZh = locale === 'zh';

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-52 flex-shrink-0 overflow-y-auto pr-1 xl:block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
        {isZh ? '章节' : 'Chapters'}
      </div>
      <nav className="mt-3 space-y-1">
        {chapters.map((chapter) => {
          const href = `${basePath}/${chapter.id}/`;
          const active = pathname === href || pathname === href.replace(/\/$/, '');
          return (
            <Link
              key={chapter.id}
              href={href}
              className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-zinc-100 text-[color:var(--color-text)] dark:bg-[#0b3a45]'
                  : 'text-[color:var(--color-muted)] hover:bg-zinc-50 hover:text-[color:var(--color-text)] dark:hover:bg-[#0b3a45]/45'
              }`}
            >
              <span className="block font-mono text-[11px] uppercase tracking-[0.16em]">{chapter.id}</span>
              <span className="mt-1 block leading-5">{chapter.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
