import 'server-only';

import { getMirroredStateData } from '@/lib/course-package-adapter';
import { getLegacyStateData } from '@/lib/legacy-content-adapter';
import type { Category, Module, StateData } from './types';
import type { Locale } from './i18n';

export type RuntimeDataSource = 'legacy' | 'mirrored';
export const PRIMARY_COURSE_SLUG = 'llm-fundamentals';

export function getRuntimeDataSource(): RuntimeDataSource {
  return process.env.LEARNING_SITE_DATA_SOURCE === 'legacy' ? 'legacy' : 'mirrored';
}

export function getLegacyData(locale: Locale): StateData {
  return getLegacyStateData(locale);
}

export function getCourseData(locale: Locale, courseSlug: string): StateData {
  if (locale === 'zh' && getRuntimeDataSource() === 'mirrored') {
    return getMirroredStateData(courseSlug);
  }

  return getLegacyData(locale);
}

export function getData(locale: Locale): StateData {
  return getCourseData(locale, PRIMARY_COURSE_SLUG);
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

export function getMirroredData() {
  return getMirroredStateData(PRIMARY_COURSE_SLUG);
}
