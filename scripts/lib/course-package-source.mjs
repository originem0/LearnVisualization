import {
  compileCoursePackage,
  coursesRoot,
  getCourseSummary,
  listCourseSlugs as listCourseSlugsFromEngine,
  loadCoursePackageBySlug,
  repoRoot,
  validateCoursePackage,
} from '../../engine/course-package-engine.mjs';

export const root = repoRoot;
export const PRIMARY_COURSE = 'llm-fundamentals';
export const courseBase = `${coursesRoot}/${PRIMARY_COURSE}`;

export function listCourseSlugs() {
  return listCourseSlugsFromEngine();
}

export function loadCourse(slug) {
  return loadCoursePackageBySlug(slug);
}

export function loadAllCourses() {
  return listCourseSlugs().map((slug) => loadCourse(slug));
}

export function loadPrimaryCourse() {
  return loadCourse(PRIMARY_COURSE);
}

export {
  compileCoursePackage,
  getCourseSummary,
  validateCoursePackage,
};
