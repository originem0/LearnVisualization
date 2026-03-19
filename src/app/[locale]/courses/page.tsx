import type { Metadata } from 'next';
import RedirectPage from '@/components/RedirectPage';
import type { Locale } from '@/lib/i18n';

export function generateMetadata({ params }: { params: { locale: Locale } }): Metadata {
  const target = `/${params.locale}/`;
  return {
    alternates: { canonical: target },
    robots: { index: false, follow: true },
  };
}

/** /courses/ redirects to locale root (the course hub). Single canonical entry. */
export default function CoursesCatalogPage({ params }: { params: { locale: Locale } }) {
  const target = `/${params.locale}/`;
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${target}`} />
      <RedirectPage to={target} label="课程目录已合并到首页。" />
    </>
  );
}
