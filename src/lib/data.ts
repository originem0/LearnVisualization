import 'server-only';

import { getMirroredStateData } from '@/lib/course-package-adapter';
import type { Category, Module, StateData } from './types';

export const PRIMARY_COURSE_SLUG = 'llm-fundamentals';

export function getCourseData(_locale: string, courseSlug: string): StateData {
  return getMirroredStateData(courseSlug);
}

export function getData(_locale: string): StateData {
  return getCourseData(_locale, PRIMARY_COURSE_SLUG);
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
