#!/usr/bin/env node
/**
 * Compare legacy src/content/zh source with mirrored course package.
 * Produces a human-readable summary for migration confidence,
 * distinguishing expected design drifts from risky drifts.
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
let riskyDriftCount = 0;
let expectedDriftCount = 0;

function hasLeadingFocusQuestionHeading(legacyModule) {
  const first = legacyModule?.narrative?.[0];
  return first?.type === 'heading' && /^(?:焦点问题|Focus Question)[:：]\s*/.test(first?.content ?? '');
}

function classifyIssue(issue, legacy, mirrored) {
  if (issue !== 'narrative length drift') return 'risky';

  const legacyLen = legacy.narrative?.length ?? 0;
  const mirroredLen = mirrored.narrative?.length ?? 0;
  if (hasLeadingFocusQuestionHeading(legacy) && legacyLen === mirroredLen + 1 && mirrored.focusQuestion) {
    return 'expected';
  }

  return 'risky';
}

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

  const expected = [];
  const risky = [];
  for (const issue of issues) {
    (classifyIssue(issue, legacy, mirrored) === 'expected' ? expected : risky).push(issue);
  }

  if (expected.length) expectedDriftCount += 1;
  if (risky.length) riskyDriftCount += 1;

  if (!expected.length && !risky.length) {
    add(`- ${mirrored.id}: OK`);
  } else if (expected.length && !risky.length) {
    add(`- ${mirrored.id}: expected drift -> ${expected.join(', ')}`);
  } else if (!expected.length && risky.length) {
    add(`- ${mirrored.id}: risky drift -> ${risky.join(', ')}`);
  } else {
    add(`- ${mirrored.id}: expected drift -> ${expected.join(', ')} | risky drift -> ${risky.join(', ')}`);
  }
}

add('');
add('## Summary');
add(`- Modules with expected design drift: ${expectedDriftCount}/${pairs}`);
add(`- Modules with risky drift: ${riskyDriftCount}/${pairs}`);
add(`- Runtime switch available: LEARNING_SITE_DATA_SOURCE=mirrored`);
add(`- Course package guardrail in build: yes`);

console.log(lines.join('\n'));
