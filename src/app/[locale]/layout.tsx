import type { Metadata } from 'next';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { getData } from '@/lib/data';
import { locales, type Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Learn Visualization',
  description: 'Learning timeline and module detail visualization',
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}


export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  const data = getData(params.locale);

  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Header project={data.project} locale={params.locale} />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-12 pt-6">
        <Sidebar categories={data.categories} modules={data.modules} locale={params.locale} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
