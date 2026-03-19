import type { Metadata } from 'next';
import LocaleShell from '@/components/LocaleShell';
import { getData } from '@/lib/data';
import { enabledLocales, type Locale } from '@/lib/i18n';
import { siteProject } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Pero 可视化学习 — 交互式专题课程',
  description: '通过交互式可视化学习多个技术专题',
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
  const data = getData(params.locale);

  return <LocaleShell data={data} siteProject={siteProject} locale={params.locale}>{children}</LocaleShell>;
}
