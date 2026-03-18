import zh from '@/content/zh';
import { getMirroredStateData } from '@/lib/course-package-adapter';
import type { Category, Module, StateData } from './types';
import type { Locale } from './i18n';

const datasets: Record<Locale, StateData> = {
  zh: zh as StateData,
};

export function getData(locale: Locale): StateData {
  return datasets[locale] ?? datasets.zh;
}

export function getCategoriesById(data: StateData): Record<string, Category> {
  return data.categories.reduce<Record<string, Category>>((acc, category) => {
    acc[category.id] = category;
    return acc;
  }, {});
}

export function getModulesById(data: StateData): Record<number, Module> {
  return data.modules.reduce<Record<number, Module>>((acc, module) => {
    acc[module.id] = module;
    return acc;
  }, {});
}

export function getModuleSlug(id: number): string {
  return `s${String(id).padStart(2, '0')}`;
}


export function getMirroredData() {
  return getMirroredStateData('llm-fundamentals');
}
