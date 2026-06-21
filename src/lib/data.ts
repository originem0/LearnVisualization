import 'server-only';

import {
  getCoursePackageKind,
  getMirroredCompiledEssayCoursePackage,
  getMirroredCompiledCoursePackage,
  getMirroredEssayCoursePackage,
  getMirroredCoursePackage,
  type CoursePackageKind,
} from '@/lib/course-package-adapter';
import type {
  CompiledCoursePackage,
  CompiledModuleRuntime,
  RuntimeCoursePackage,
} from '../../engine/course-package-engine.mjs';
import type { CompiledEssayCoursePackage } from '../../engine/essay-course-engine.mjs';
import type { Chapter, CoursePackage, CourseModule, EssayCourse } from './course-schema';
import type { Category } from './types';

export const PRIMARY_COURSE_SLUG = 'llm-fundamentals';
export type RuntimeEssayCourse = Omit<EssayCourse, 'chapters'> & { chapters: Chapter[] };

export function getCoursePackage(_locale: string, courseSlug: string): RuntimeCoursePackage {
  return getMirroredCoursePackage(courseSlug);
}

export function getCourseKind(_locale: string, courseSlug: string): CoursePackageKind {
  return getCoursePackageKind(courseSlug);
}

export function getEssayCoursePackage(_locale: string, courseSlug: string): RuntimeEssayCourse {
  return getMirroredEssayCoursePackage(courseSlug) as RuntimeEssayCourse;
}

export function getCompiledEssayCoursePackage(_locale: string, courseSlug: string): CompiledEssayCoursePackage {
  return getMirroredCompiledEssayCoursePackage(courseSlug);
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

export function getChapterBySlug(pkg: Pick<RuntimeEssayCourse, 'chapters'>, slug: string): Chapter | undefined {
  return pkg.chapters.find((chapter) => chapter.id === slug);
}
