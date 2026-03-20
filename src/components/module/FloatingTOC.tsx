import type { Locale } from '@/lib/i18n';
import type { NarrativeHeadingLink } from './narrative-headings';

interface FloatingTOCProps {
  headings: NarrativeHeadingLink[];
  locale: Locale;
}

export default function FloatingTOC({ headings, locale }: FloatingTOCProps) {
  if (headings.length === 0) return null;

  const isZh = locale === 'zh';

  return (
    <aside className="hidden xl:block xl:sticky xl:top-24">
      <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-[color:var(--color-border)]/80 bg-[color:var(--color-panel)]/85 p-3 backdrop-blur">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {isZh ? '页内导航' : 'On this page'}
        </div>
        <nav aria-label={isZh ? '页内导航' : 'Table of contents'} className="mt-3">
          <ol className="space-y-1.5">
            {headings.map((heading, index) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className="group flex gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--color-muted)] transition-colors hover:bg-zinc-50/80 hover:text-[color:var(--color-text)] dark:hover:bg-[#0b3a45]"
                >
                  <span className="w-4 shrink-0 text-[11px] font-semibold text-[color:var(--color-muted)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 leading-5 text-[color:var(--color-text)]/90 group-hover:text-[color:var(--color-text)]">
                    {heading.label}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </aside>
  );
}
