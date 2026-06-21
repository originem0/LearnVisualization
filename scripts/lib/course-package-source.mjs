import {
  compileCoursePackage,
  coursesRoot,
  getCourseSummary,
  loadCoursePackageBySlug,
  repoRoot,
  validateCoursePackage,
} from '../../engine/course-package-engine.mjs';
import {
  compileEssayCourse,
  loadEssayCoursePackageBySlug,
  validateEssayCoursePackage,
} from '../../engine/essay-course-engine.mjs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';

export const root = repoRoot;
export const PRIMARY_COURSE = 'llm-fundamentals';
export const courseBase = `${coursesRoot}/${PRIMARY_COURSE}`;
export const PUBLIC_LEGACY_COURSES = new Set(['llm-fundamentals', 'postgresql-internals', 'git-internals', 'claude-code']);

function listPackageDirs() {
  if (!existsSync(coursesRoot)) return [];
  return readdirSync(coursesRoot)
    .filter((name) => existsSync(resolve(coursesRoot, name, 'course.json')))
    .sort();
}

export function isEssayCourse(slug) {
  const dir = resolve(coursesRoot, slug);
  if (!existsSync(resolve(dir, 'chapters'))) return false;
  try {
    const meta = JSON.parse(readFileSync(resolve(dir, 'course.json'), 'utf-8'));
    return Array.isArray(meta.chapters) && typeof meta.drivingQuestion === 'string';
  } catch {
    return false;
  }
}

export function listCourseSlugs() {
  return listPackageDirs().filter((slug) => !isEssayCourse(slug));
}

export function listEssayCourseSlugs() {
  return listPackageDirs().filter((slug) => isEssayCourse(slug));
}

export function listPublicLegacyCourseSlugs() {
  return listCourseSlugs().filter((slug) => PUBLIC_LEGACY_COURSES.has(slug));
}

export function listPublicCourseSlugs() {
  return listPackageDirs().filter((slug) => isEssayCourse(slug) || PUBLIC_LEGACY_COURSES.has(slug));
}

export function loadCourse(slug) {
  return loadCoursePackageBySlug(slug);
}

export function loadAllCourses() {
  return listCourseSlugs().map((slug) => loadCourse(slug));
}

export function loadEssayCourse(slug) {
  return loadEssayCoursePackageBySlug(slug);
}

export function loadAllEssayCourses() {
  return listEssayCourseSlugs().map((slug) => loadEssayCourse(slug));
}

export function loadPrimaryCourse() {
  return loadCourse(PRIMARY_COURSE);
}

export {
  compileCoursePackage,
  compileEssayCourse,
  getCourseSummary,
  validateEssayCoursePackage,
  validateCoursePackage,
};
