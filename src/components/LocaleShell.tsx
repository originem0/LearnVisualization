'use client';

import { useSelectedLayoutSegments } from 'next/navigation';
import Header from '@/components/Header';
import type { Locale } from '@/lib/i18n';

interface LocaleShellProps {
  children: React.ReactNode;
  siteProject: { title: string; goal: string };
  locale: Locale;
}

export default function LocaleShell({ children, siteProject, locale }: LocaleShellProps) {
  const segments = useSelectedLayoutSegments();
  const isCourseRoute = segments[0] === 'courses' && segments.length > 1;

  // Course sub-routes have their own layout (Header + Sidebar scoped to course)
  if (isCourseRoute) {
    return <>{children}</>;
  }

  // Site-level pages (hub, catalog): show site Header, no sidebar
  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Header project={siteProject} locale={locale} />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6">
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
