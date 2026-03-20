import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ModuleRenderer } from '@/components/module';
import {
  getCategoriesById,
  getCompiledCoursePackage,
  getModuleBySlug,
  getModuleRuntime,
} from '@/lib/data';
import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import { enabledLocales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.flatMap((locale) =>
    listMirroredCourseSlugs().flatMap((courseSlug) => {
      const pkg = getCompiledCoursePackage(locale, courseSlug).coursePackage;
      return pkg.modules.map((module) => ({ locale, courseSlug, slug: module.id }));
    })
  );
}

interface ModulePageProps {
  params: { locale: Locale; courseSlug: string; slug: string };
}

export function generateMetadata({ params }: ModulePageProps): Metadata {
  const { locale, courseSlug, slug } = params;
  const pkg = getCompiledCoursePackage(locale, courseSlug).coursePackage;
  const mod = getModuleBySlug(pkg, slug);
  if (!mod) return {};

  const categoriesById = getCategoriesById(pkg);
  const category = categoriesById[mod.category];
  const title = `${mod.id} ${mod.title} — ${pkg.title}`;
  const description = mod.subtitle;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    other: {
      'article:section': category?.name ?? '',
    },
  };
}

export default function CourseModulePage({ params }: ModulePageProps) {
  const { locale, courseSlug, slug } = params;
  if (!listMirroredCourseSlugs().includes(courseSlug)) notFound();

  const compiled = getCompiledCoursePackage(locale, courseSlug);
  const pkg = compiled.coursePackage;
  const categoriesById = getCategoriesById(pkg);
  const module = getModuleBySlug(pkg, slug);
  const moduleRuntime = getModuleRuntime(compiled, slug);
  if (!module) notFound();
  if (!moduleRuntime) notFound();

  const index = pkg.modules.findIndex((candidate) => candidate.id === module.id);
  const category = categoriesById[module.category];
  const prev = index > 0 ? pkg.modules[index - 1] : undefined;
  const next = index < pkg.modules.length - 1 ? pkg.modules[index + 1] : undefined;
  const basePath = `/${locale}/courses/${courseSlug}`;

  return (
    <ModuleRenderer
      module={module}
      moduleRuntime={moduleRuntime}
      category={category}
      prev={prev}
      next={next}
      locale={locale}
      basePath={basePath}
    />
  );
}
