import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { getCoursePackage } from '@/lib/data';
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

  const pkg = getCoursePackage(params.locale, params.courseSlug);
  const basePath = `/${params.locale}/courses/${params.courseSlug}`;

  return (
    <div className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <Header project={{ title: pkg.title, goal: pkg.goal }} locale={params.locale} basePath={basePath} />
      <div className="mx-auto flex max-w-[1440px] gap-5 px-4 pb-12 pt-6 xl:gap-8">
        <Sidebar categories={pkg.categories} modules={pkg.modules} locale={params.locale} basePath={basePath} />
        <main id="main-content" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
