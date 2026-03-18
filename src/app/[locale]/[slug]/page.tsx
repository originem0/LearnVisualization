import { notFound } from 'next/navigation';
import ModuleDetail from '@/components/ModuleDetail';
import { getData, getCategoriesById, getModuleSlug } from '@/lib/data';
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

interface ModulePageProps {
  params: { locale: Locale; slug: string };
}

export default function ModulePage({ params }: ModulePageProps) {
  const { locale, slug } = params;
  const data = getData(locale);
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

  return <ModuleDetail module={module} category={category} prev={prev} next={next} locale={locale} />;
}
