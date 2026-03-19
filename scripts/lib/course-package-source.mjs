import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, '..', '..');
export const PRIMARY_COURSE = 'llm-fundamentals';
export const courseBase = resolve(root, 'courses', PRIMARY_COURSE);

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));

/** List all course slugs under courses/ that have a course.json. */
export function listCourseSlugs() {
  const coursesDir = resolve(root, 'courses');
  if (!existsSync(coursesDir)) return [];
  return readdirSync(coursesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(coursesDir, entry.name, 'course.json')))
    .map((entry) => entry.name)
    .sort();
}

/** Load a specific course package by slug. */
export function loadCourse(slug) {
  const base = resolve(root, 'courses', slug);
  const course = loadJson(resolve(base, 'course.json'));
  const modulesDir = resolve(base, 'modules');
  const moduleFiles = readdirSync(modulesDir)
    .filter((name) => /^s\d\d\.json$/.test(name))
    .sort();
  const modules = moduleFiles.map((name) => ({
    name,
    data: loadJson(resolve(modulesDir, name)),
  }));
  const conceptMaps = loadJson(resolve(base, 'visuals', 'concept-maps.json'));
  const interactions = loadJson(resolve(base, 'interactions', 'registry.json'));

  return { course, slug, modulesDir, moduleFiles, modules, conceptMaps, interactions };
}

/** Load all course packages. */
export function loadAllCourses() {
  return listCourseSlugs().map((slug) => loadCourse(slug));
}

/** Backwards-compatible: load the primary (LLM) course. */
export function loadPrimaryCourse() {
  return loadCourse(PRIMARY_COURSE);
}
