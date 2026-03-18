#!/usr/bin/env node
/**
 * Generate legacy src/content/zh files from the primary course package.
 * Default: dry-run only.
 * Use --write to materialize files.
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const shouldWrite = process.argv.includes('--write');
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));

const courseBase = resolve(root, 'courses', 'llm-fundamentals');
const course = load(resolve(courseBase, 'course.json'));
const mirroredModules = readdirSync(resolve(courseBase, 'modules'))
  .filter((name) => /^s\d\d\.json$/.test(name))
  .sort()
  .map((name) => load(resolve(courseBase, 'modules', name)));

const base = resolve(root, 'src/content/zh');
const modulesDir = resolve(base, 'modules');

const project = {
  title: course.title,
  goal: course.goal,
  type: course.projectType,
  startDate: course.startDate,
};

const categoryData = course.categories;

const legacyModules = mirroredModules.map((module) => ({
  id: module.number,
  title: module.title,
  subtitle: module.subtitle ?? '',
  category: module.category,
  concepts: {
    items: module.concepts,
  },
  pitfalls: module.pitfalls ?? [],
  quote: module.quote ?? '',
  keyInsight: module.keyInsight,
  logicChain: module.logicChain,
  examples: module.examples,
  counterexamples: module.counterexamples ?? [],
  opening: module.opening,
  narrative: module.narrative,
  bridgeTo: module.bridgeTo ?? null,
}));

const files = [
  { path: resolve(base, 'project.json'), data: project },
  { path: resolve(base, 'categories.json'), data: categoryData },
  ...legacyModules.map((mod) => ({
    path: resolve(modulesDir, `s${String(mod.id).padStart(2, '0')}.json`),
    data: mod,
  })),
];

console.log('Legacy export plan:');
for (const file of files) {
  console.log(`- ${file.path.replace(root + '/', '')}`);
}

if (!shouldWrite) {
  console.log('\nDry run only. Re-run with --write to materialize legacy files from the mirrored course package.');
  process.exit(0);
}

mkdirSync(base, { recursive: true });
mkdirSync(modulesDir, { recursive: true });

for (const file of files) {
  writeFileSync(file.path, JSON.stringify(file.data, null, 2) + '\n', 'utf-8');
}

console.log('\n✅ Legacy compatibility layer regenerated from course package.');
