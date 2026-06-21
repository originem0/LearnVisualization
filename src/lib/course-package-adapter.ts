import 'server-only';

import { cache } from 'react';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  compileCoursePackage,
  getCourseSummary,
  coursesRoot,
  loadCoursePackageBySlug,
  type CompiledCoursePackage,
  type LoadedCoursePackageSource,
  type RuntimeCoursePackage,
} from '../../engine/course-package-engine.mjs';
import {
  compileEssayCourse,
  loadEssayCoursePackageBySlug,
  type CompiledEssayCoursePackage,
  type LoadedEssayCoursePackageSource,
} from '../../engine/essay-course-engine.mjs';

export interface MirroredCourseSummary {
  slug: string;
  title: string;
  subtitle?: string;
  status: string;
  moduleCount: number;
  chapterCount: number;
  kind: CoursePackageKind;
}

export type CoursePackageKind = 'legacy' | 'essay';

const PUBLIC_LEGACY_COURSES = new Set(['llm-fundamentals', 'postgresql-internals', 'git-internals', 'claude-code']);

function courseDir(slug: string) {
  return resolve(coursesRoot, slug);
}

function listCourseDirs(): string[] {
  if (!existsSync(coursesRoot)) return [];
  return readdirSync(coursesRoot)
    .filter((name) => existsSync(resolve(coursesRoot, name, 'course.json')))
    .sort();
}

function hasEssayShape(slug: string): boolean {
  const dir = courseDir(slug);
  if (!existsSync(resolve(dir, 'chapters'))) return false;
  try {
    const course = JSON.parse(readFileSync(resolve(dir, 'course.json'), 'utf-8'));
    return Array.isArray(course.chapters) && typeof course.drivingQuestion === 'string';
  } catch {
    return false;
  }
}

export const getCoursePackageKind = cache((slug: string): CoursePackageKind => {
  return hasEssayShape(slug) ? 'essay' : 'legacy';
});

const getMirroredCourseSource = cache((slug: string): LoadedCoursePackageSource => loadCoursePackageBySlug(slug));
export const getMirroredCompiledCoursePackage = cache((slug: string): CompiledCoursePackage => compileCoursePackage(getMirroredCourseSource(slug)));

const getMirroredEssaySource = cache((slug: string): LoadedEssayCoursePackageSource => loadEssayCoursePackageBySlug(slug));
export const getMirroredCompiledEssayCoursePackage = cache((slug: string): CompiledEssayCoursePackage => compileEssayCourse(getMirroredEssaySource(slug)));

export const listMirroredCourseSlugs = cache((): string[] => {
  return listCourseDirs().filter((slug) => hasEssayShape(slug) || PUBLIC_LEGACY_COURSES.has(slug));
});

export const getMirroredCoursePackage = cache((slug: string): RuntimeCoursePackage => {
  return getMirroredCompiledCoursePackage(slug).coursePackage;
});

export const getMirroredEssayCoursePackage = cache((slug: string): CompiledEssayCoursePackage['coursePackage'] => {
  return getMirroredCompiledEssayCoursePackage(slug).coursePackage;
});

export const listMirroredCourseSummaries = cache((): MirroredCourseSummary[] => {
  return listMirroredCourseSlugs().map((slug) => {
    const kind = getCoursePackageKind(slug);
    if (kind === 'essay') {
      const summary = getMirroredCompiledEssayCoursePackage(slug).summary;
      return {
        slug: summary.slug,
        title: summary.title ?? slug,
        subtitle: summary.subtitle,
        status: summary.status ?? 'draft',
        moduleCount: summary.chapterCount,
        chapterCount: summary.chapterCount,
        kind,
      };
    }
    const summary = getCourseSummary(getMirroredCompiledCoursePackage(slug));
    return {
      slug: summary.slug,
      title: summary.title ?? slug,
      subtitle: summary.subtitle,
      status: summary.status ?? 'draft',
      moduleCount: summary.moduleCount,
      chapterCount: summary.moduleCount,
      kind,
    };
  });
});
