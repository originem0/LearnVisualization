import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, '..', '..');
export const PRIMARY_COURSE = 'llm-fundamentals';
export const courseBase = resolve(root, 'courses', PRIMARY_COURSE);

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf-8'));

export function loadPrimaryCourse() {
  const course = loadJson(resolve(courseBase, 'course.json'));
  const modulesDir = resolve(courseBase, 'modules');
  const moduleFiles = readdirSync(modulesDir)
    .filter((name) => /^s\d\d\.json$/.test(name))
    .sort();
  const modules = moduleFiles.map((name) => ({
    name,
    data: loadJson(resolve(modulesDir, name)),
  }));
  const conceptMaps = loadJson(resolve(courseBase, 'visuals', 'concept-maps.json'));
  const interactions = loadJson(resolve(courseBase, 'interactions', 'registry.json'));

  return {
    course,
    modulesDir,
    moduleFiles,
    modules,
    conceptMaps,
    interactions,
  };
}
