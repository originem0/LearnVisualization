import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { getCourseData } from '@/lib/data';
import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import { enabledLocales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.flatMap((locale) => listMirroredCourseSlugs().map((courseSlug) => ({ locale, courseSlug })));
}

export default function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale; courseSlug: string };
}) {
  if (!listMirroredCourseSlugs().includes(params.courseSlug)) {
    notFound();
  }

  const data = getCourseData(params.locale, params.courseSlug);
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Header project={data.project} locale={params.locale} basePath={basePath} />
      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-12 pt-6">
        <Sidebar categories={data.categories} modules={data.modules} locale={params.locale} basePath={basePath} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
