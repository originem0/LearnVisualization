import 'server-only';

import {
  getMirroredCompiledCoursePackage,
  getMirroredCoursePackage,
} from '@/lib/course-package-adapter';
import type {
  CompiledCoursePackage,
  CompiledModuleRuntime,
  RuntimeCoursePackage,
} from '../../engine/course-package-engine.mjs';
import type { CoursePackage, CourseModule } from './course-schema';
import type { Category } from './types';

export const PRIMARY_COURSE_SLUG = 'llm-fundamentals';

export function getCoursePackage(_locale: string, courseSlug: string): RuntimeCoursePackage {
  return getMirroredCoursePackage(courseSlug);
}

export function getCompiledCoursePackage(_locale: string, courseSlug: string): CompiledCoursePackage {
  return getMirroredCompiledCoursePackage(courseSlug);
}

export function getCategoriesById(pkg: Pick<CoursePackage, 'categories'>): Record<string, Category> {
  return pkg.categories.reduce<Record<string, Category>>((acc, category) => {
    acc[category.id] = category;
    return acc;
  }, {});
}

export function getModuleBySlug(pkg: Pick<CoursePackage, 'modules'>, slug: string): CourseModule | undefined {
  return pkg.modules.find((m) => m.id === slug);
}

export function getModuleRuntime(pkg: CompiledCoursePackage, slug: string): CompiledModuleRuntime | undefined {
  return pkg.moduleRuntimeById[slug];
}
