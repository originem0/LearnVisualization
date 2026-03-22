import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import AnnouncementBell from './AnnouncementBell';
import SettingsPanel from './SettingsPanel';
import type { Locale } from '@/lib/i18n';
import { getLabels } from '@/lib/labels';

interface HeaderProps {
  project: { title: string; goal: string };
  locale: Locale;
  basePath?: string;
}

export default function Header({ project, locale, basePath = `/${locale}` }: HeaderProps) {
  const labels = getLabels(locale);
  const isCoursePage = basePath !== `/${locale}`;
  const containerWidth = isCoursePage ? 'max-w-[1440px]' : 'max-w-6xl';

  return (
    <>
      <a href="#main-content" className="skip-link">跳到主内容</a>
      <header className="sticky top-0 z-50 h-14 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/90 backdrop-blur">
      <div className={`mx-auto flex h-14 items-center justify-between px-4 ${containerWidth}`}>
        <div className="flex items-center gap-4">
          {isCoursePage && (
            <Link
              href={`/${locale}/`}
              className="text-xs text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-text)]"
            >
              {locale === 'zh' ? '← 全部课程' : '← All courses'}
            </Link>
          )}
          <Link href={`${basePath}/`} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white shadow-sm">
              LV
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-[color:var(--color-text)]">{project.title}</div>
              <div className="hidden text-xs text-[color:var(--color-muted)] line-clamp-1 sm:block">{project.goal}</div>
            </div>
          </Link>
          {isCoursePage && (
            <nav className="hidden items-center gap-4 text-sm text-[color:var(--color-muted)] lg:flex">
              <Link href={`${basePath}/timeline/`} className="hover:text-[color:var(--color-text)]">{labels.nav.timeline}</Link>
              <Link href={`${basePath}/layers/`} className="hover:text-[color:var(--color-text)]">{labels.nav.layers}</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SettingsPanel locale={locale} />
          <AnnouncementBell locale={locale} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
    </>
  );
}
