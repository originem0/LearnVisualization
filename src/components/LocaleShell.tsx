'use client';

import { useSelectedLayoutSegments } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import type { StateData } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

interface LocaleShellProps {
  children: React.ReactNode;
  data: StateData;
  locale: Locale;
}

export default function LocaleShell({ children, data, locale }: LocaleShellProps) {
  const segments = useSelectedLayoutSegments();
  const isCourseRoute = segments[0] === 'courses' && segments.length > 1;

  if (isCourseRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Header project={data.project} locale={locale} />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-12 pt-6">
        <Sidebar categories={data.categories} modules={data.modules} locale={locale} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
