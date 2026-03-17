import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import type { ProjectInfo } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import LanguageToggle from './LanguageToggle';
import { getLabels } from '@/lib/labels';

interface HeaderProps {
  project: ProjectInfo;
  locale: Locale;
}

export default function Header({ project, locale }: HeaderProps) {
  const labels = getLabels(locale);
  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/`} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--color-panel)] text-sm font-semibold text-[color:var(--color-text)] shadow-sm">
              L
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-[color:var(--color-text)]">{project.title}</div>
              <div className="text-xs text-[color:var(--color-muted)] line-clamp-1">{project.goal}</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-[color:var(--color-muted)] lg:flex">
            <Link href={`/${locale}/timeline/`} className="hover:text-[color:var(--color-text)]">{labels.nav.timeline}</Link>
            <Link href={`/${locale}/compare/`} className="hover:text-[color:var(--color-text)]">{labels.nav.compare}</Link>
            <Link href={`/${locale}/layers/`} className="hover:text-[color:var(--color-text)]">{labels.nav.layers}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle locale={locale} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  );
}
