import type { Metadata } from 'next';
import RedirectPage from '@/components/RedirectPage';
import { getData } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { enabledLocales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  const params: { locale: Locale; slug: string }[] = [];
  enabledLocales.forEach((locale) => {
    const data = getData(locale);
    data.modules.forEach((module) => {
      params.push({ locale, slug: getModuleSlug(module.id) });
    });
  });
  return params;
}

function getTarget(locale: string, slug: string) {
  return `/${locale}/courses/llm-fundamentals/${slug}/`;
}

export function generateMetadata({ params }: { params: { locale: Locale; slug: string } }): Metadata {
  const target = getTarget(params.locale, params.slug);
  return {
    alternates: { canonical: target },
    other: { 'http-equiv-refresh': `0;url=${target}` },
    robots: { index: false, follow: true },
  };
}

/**
 * Legacy LLM module routes redirect to their course-scoped equivalents.
 * Renders meta refresh + canonical for SEO, plus JS redirect for browsers.
 */
export default function ModulePage({ params }: { params: { locale: Locale; slug: string } }) {
  const target = getTarget(params.locale, params.slug);
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <RedirectPage to={target} label="此页面已迁移至课程目录。" />
    </>
  );
}
