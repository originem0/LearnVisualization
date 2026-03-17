import { notFound } from 'next/navigation';
import ModuleDetail from '@/components/ModuleDetail';
import { data, categoriesById } from '@/lib/data';

export const dynamicParams = false;

export function generateStaticParams() {
  return data.modules.map((module) => ({ id: module.id.toString() }));
}

interface ModulePageProps {
  params: { id: string };
}

export default function ModulePage({ params }: ModulePageProps) {
  const id = Number(params.id);
  const index = data.modules.findIndex((module) => module.id === id);
  if (Number.isNaN(id) || index === -1) {
    notFound();
  }

  const module = data.modules[index];
  const category = categoriesById[module.category];
  const prev = index > 0 ? data.modules[index - 1] : undefined;
  const next = index < data.modules.length - 1 ? data.modules[index + 1] : undefined;

  return <ModuleDetail module={module} category={category} prev={prev} next={next} />;
}
