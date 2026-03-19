import type { Metadata } from 'next';
import RedirectPage from '@/components/RedirectPage';
import type { Locale } from '@/lib/i18n';

const TARGET_PATH = '/courses/llm-fundamentals/timeline/';

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const target = `/${params.locale}${TARGET_PATH}`;
  return {
    alternates: { canonical: target },
    robots: { index: false, follow: true },
  };
}

/** Legacy LLM timeline page redirects to course-scoped equivalent. */
export default function TimelinePage({ params }: { params: { locale: Locale } }) {
  const target = `/${params.locale}${TARGET_PATH}`;
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <RedirectPage to={target} label="此页面已迁移至课程目录。" />
    </>
  );
}
