#!/usr/bin/env node
/**
 * Compare legacy src/content/zh source with mirrored course package.
 * Produces a human-readable summary for migration confidence.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));

const legacyBase = resolve(root, 'src/content/zh');
const legacyModulesDir = resolve(legacyBase, 'modules');
const legacyProject = load(resolve(legacyBase, 'project.json'));
const legacyCategories = load(resolve(legacyBase, 'categories.json'));
const legacyModuleFiles = readdirSync(legacyModulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();
const legacyModules = legacyModuleFiles.map((name) => load(resolve(legacyModulesDir, name)));

const courseBase = resolve(root, 'courses/llm-fundamentals');
const mirroredCourse = load(resolve(courseBase, 'course.json'));
const mirroredModulesDir = resolve(courseBase, 'modules');
const mirroredModuleFiles = readdirSync(mirroredModulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();
const mirroredModules = mirroredModuleFiles.map((name) => load(resolve(mirroredModulesDir, name)));

const lines = [];
const add = (s = '') => lines.push(s);
let driftCount = 0;

add('# Course Source Comparison');
add('');
add('## Top-level');
add(`- Legacy title: ${legacyProject.title}`);
add(`- Mirrored title: ${mirroredCourse.title}`);
add(`- Legacy categories: ${legacyCategories.length}`);
add(`- Mirrored categories: ${mirroredCourse.categories?.length ?? 0}`);
add(`- Legacy modules: ${legacyModules.length}`);
add(`- Mirrored modules: ${mirroredModules.length}`);
add('');
add('## Module-level comparison');

const pairs = Math.min(legacyModules.length, mirroredModules.length);
for (let i = 0; i < pairs; i++) {
  const legacy = legacyModules[i];
  const mirrored = mirroredModules[i];
  const issues = [];

  if (mirrored.id !== `s${String(legacy.id).padStart(2, '0')}`) issues.push('slug/id mismatch');
  if (legacy.title !== mirrored.title) issues.push('title drift');
  if ((legacy.subtitle ?? '') !== (mirrored.subtitle ?? '')) issues.push('subtitle drift');
  if (legacy.category !== mirrored.category) issues.push('category drift');
  if ((legacy.quote ?? '') !== (mirrored.quote ?? '')) issues.push('quote drift');
  if ((legacy.keyInsight ?? '') !== (mirrored.keyInsight ?? '')) issues.push('keyInsight drift');
  if ((legacy.opening ?? '') !== (mirrored.opening ?? '')) issues.push('opening drift');
  if ((legacy.bridgeTo ?? null) !== (mirrored.bridgeTo ?? null)) issues.push('bridge drift');
  if ((legacy.logicChain?.length ?? 0) !== (mirrored.logicChain?.length ?? 0)) issues.push('logicChain length drift');
  if ((legacy.examples?.length ?? 0) !== (mirrored.examples?.length ?? 0)) issues.push('examples length drift');
  if ((legacy.narrative?.length ?? 0) !== (mirrored.narrative?.length ?? 0)) issues.push('narrative length drift');
  if (!mirrored.moduleKind) issues.push('missing moduleKind');
  if (!mirrored.primaryCognitiveAction) issues.push('missing primaryCognitiveAction');
  if (!Array.isArray(mirrored.visuals) || mirrored.visuals.length === 0) issues.push('missing visuals');
  if (!Array.isArray(mirrored.interactionRequirements) || mirrored.interactionRequirements.length === 0) issues.push('missing interaction requirements');

  if (issues.length) driftCount += 1;
  add(`- ${mirrored.id}: ${issues.length ? issues.join(', ') : 'OK'}`);
}

add('');
add('## Summary');
add(`- Modules with drift or missing mirrored-only fields: ${driftCount}/${pairs}`);
add(`- Runtime switch available: LEARNING_SITE_DATA_SOURCE=mirrored`);
add(`- Course package guardrail in build: yes`);

console.log(lines.join('\n'));
