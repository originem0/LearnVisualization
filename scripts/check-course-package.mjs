#!/usr/bin/env node
/**
 * Course package integrity checks.
 * Validates the mirrored course package under courses/llm-fundamentals/
 * and compares key structure against the legacy zh source.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  bad = true;
};

let bad = false;

const legacyBase = resolve(root, 'src/content/zh');
const legacyModulesDir = resolve(legacyBase, 'modules');
const legacyCategories = load(resolve(legacyBase, 'categories.json'));
const legacyCategoryIds = new Set(legacyCategories.map((c) => c.id));
const legacyModuleFiles = readdirSync(legacyModulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();
const legacyModules = legacyModuleFiles.map((name) => load(resolve(legacyModulesDir, name)));

const courseBase = resolve(root, 'courses/llm-fundamentals');
const course = load(resolve(courseBase, 'course.json'));
const mirroredModulesDir = resolve(courseBase, 'modules');
const mirroredModuleFiles = readdirSync(mirroredModulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();
const mirroredModules = mirroredModuleFiles.map((name) => load(resolve(mirroredModulesDir, name)));
const conceptMaps = load(resolve(courseBase, 'visuals/concept-maps.json'));
const interactionRegistry = load(resolve(courseBase, 'interactions/registry.json'));

const MODULE_KINDS = new Set([
  'concept-clarification',
  'mechanism-walkthrough',
  'system-overview',
  'case-study',
  'meta-reflection',
  'integration-review',
]);

const COG_ACTIONS = new Set([
  'distinguish',
  'trace',
  'compare',
  'simulate',
  'rebuild',
  'reflect',
]);

if (!course.id) fail('course.json: missing id');
if (!course.slug) fail('course.json: missing slug');
if (!course.title) fail('course.json: missing title');
if (!course.goal) fail('course.json: missing goal');
if (!course.projectType) fail('course.json: missing projectType');
if (!course.startDate) fail('course.json: missing startDate');
if (!Array.isArray(course.categories) || course.categories.length === 0) fail('course.json: missing categories');
if (!Array.isArray(course.modules) || course.modules.length === 0) fail('course.json: missing modules list');
if (!course.moduleGraph || !Array.isArray(course.moduleGraph.order)) fail('course.json: missing moduleGraph.order');

if (legacyModules.length !== mirroredModules.length) {
  fail(`mirrored module count mismatch: legacy=${legacyModules.length}, mirrored=${mirroredModules.length}`);
}

const mirroredIds = mirroredModules.map((m) => m.id);
const orderIds = course.moduleGraph?.order ?? [];
if (JSON.stringify(mirroredIds) !== JSON.stringify(orderIds)) {
  fail('course.json moduleGraph.order does not match mirrored module file order');
}
if (JSON.stringify(course.modules) !== JSON.stringify(orderIds)) {
  fail('course.json modules list does not match moduleGraph.order');
}

for (let i = 0; i < mirroredModules.length; i++) {
  const legacy = legacyModules[i];
  const mirrored = mirroredModules[i];
  const expectedSlug = `s${String(mirrored.number).padStart(2, '0')}`;

  if (mirrored.id !== expectedSlug) fail(`${mirrored.id}: id does not match number ${mirrored.number}`);
  if (mirrored.title !== legacy.title) fail(`${mirrored.id}: title drift from legacy source`);
  if (mirrored.category !== legacy.category) fail(`${mirrored.id}: category drift from legacy source`);
  if (!legacyCategoryIds.has(mirrored.category)) fail(`${mirrored.id}: unknown category '${mirrored.category}'`);
  if (!MODULE_KINDS.has(mirrored.moduleKind)) fail(`${mirrored.id}: invalid moduleKind '${mirrored.moduleKind}'`);
  if (!COG_ACTIONS.has(mirrored.primaryCognitiveAction)) fail(`${mirrored.id}: invalid primaryCognitiveAction '${mirrored.primaryCognitiveAction}'`);
  if (!mirrored.focusQuestion) fail(`${mirrored.id}: missing focusQuestion`);
  if (!mirrored.keyInsight) fail(`${mirrored.id}: missing keyInsight`);
  if (!Array.isArray(mirrored.narrative) || mirrored.narrative.length === 0) fail(`${mirrored.id}: missing narrative`);
  if (!Array.isArray(mirrored.logicChain) || mirrored.logicChain.length === 0) fail(`${mirrored.id}: missing logicChain`);
  if (!Array.isArray(mirrored.visuals) || mirrored.visuals.length === 0) fail(`${mirrored.id}: missing visuals`);
  if (!Array.isArray(mirrored.interactionRequirements) || mirrored.interactionRequirements.length === 0) fail(`${mirrored.id}: missing interactionRequirements`);

  const visual = mirrored.visuals[0];
  if (visual?.type === 'conceptMap') {
    const numericId = String(mirrored.number);
    if (!conceptMaps[numericId]) fail(`${mirrored.id}: missing concept map schema ${numericId}`);
  }

  const reg = interactionRegistry[mirrored.id];
  if (!reg) fail(`${mirrored.id}: missing interaction registry entry`);

  if (i < mirroredModules.length - 1) {
    const expectedNext = mirroredModules[i + 1].id;
    if (mirrored.nextModuleId !== expectedNext) {
      fail(`${mirrored.id}: nextModuleId should be ${expectedNext}, got ${mirrored.nextModuleId}`);
    }
  } else if (mirrored.nextModuleId !== null) {
    fail(`${mirrored.id}: last module nextModuleId should be null`);
  }
}

if (bad) {
  process.exit(1);
}

console.log('✅ Course package checks passed.');
