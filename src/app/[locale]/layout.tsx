import type { Metadata } from 'next';
import LocaleShell from '@/components/LocaleShell';
import { enabledLocales, type Locale } from '@/lib/i18n';
import { siteProject } from '@/lib/site-config';

export const metadata: Metadata = {
  title: '复杂知识学习引擎',
  description: '把复杂知识转化成可被理解、可被穿透、可被迁移的学习体验',
};

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  return <LocaleShell siteProject={siteProject} locale={params.locale}>{children}</LocaleShell>;
}
