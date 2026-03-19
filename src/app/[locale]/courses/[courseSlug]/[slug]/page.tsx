import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ModuleDetail from '@/components/ModuleDetail';
import { PRIMARY_COURSE_SLUG, getCategoriesById, getCourseData } from '@/lib/data';
import { getModuleSlug } from '@/lib/module-slug';
import { listMirroredCourseSlugs } from '@/lib/course-package-adapter';
import { enabledLocales, type Locale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return enabledLocales.flatMap((locale) =>
    listMirroredCourseSlugs().flatMap((courseSlug) => {
      const data = getCourseData(locale, courseSlug);
      return data.modules.map((module) => ({ locale, courseSlug, slug: getModuleSlug(module.id) }));
    })
  );
}

interface ModulePageProps {
  params: { locale: Locale; courseSlug: string; slug: string };
}

export function generateMetadata({ params }: ModulePageProps): Metadata {
  const { locale, courseSlug, slug } = params;
  const data = getCourseData(locale, courseSlug);
  const id = Number(slug.replace(/^s/, ''));
  const mod = data.modules.find((m) => m.id === id);
  if (!mod) return {};

  const categoriesById = getCategoriesById(data);
  const category = categoriesById[mod.category];
  const title = `${getModuleSlug(mod.id)} ${mod.title} — ${data.project.title}`;
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

  const data = getCourseData(locale, courseSlug);
  const categoriesById = getCategoriesById(data);
  const id = Number(slug.replace(/^s/, ''));
  const index = data.modules.findIndex((module) => module.id === id);
  if (Number.isNaN(id) || index === -1) {
    notFound();
  }

  const module = data.modules[index];
  const category = categoriesById[module.category];
  const prev = index > 0 ? data.modules[index - 1] : undefined;
  const next = index < data.modules.length - 1 ? data.modules[index + 1] : undefined;
  const basePath = `/${locale}/courses/${courseSlug}`;
  const registryEntry = courseSlug === PRIMARY_COURSE_SLUG ? undefined : null;

  return (
    <ModuleDetail
      module={module}
      category={category}
      prev={prev}
      next={next}
      locale={locale}
      basePath={basePath}
      registryEntry={registryEntry}
    />
  );
}
