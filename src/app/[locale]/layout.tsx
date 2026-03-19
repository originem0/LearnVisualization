import type { Metadata } from 'next';
import LocaleShell from '@/components/LocaleShell';
import { getData } from '@/lib/data';
import { enabledLocales, type Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'LLM 原理与实践 — 可视化交互学习',
  description: '通过交互式可视化，从零理解 Transformer 架构、训练机制与应用实践',
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

  return <LocaleShell data={data} locale={params.locale}>{children}</LocaleShell>;
}
