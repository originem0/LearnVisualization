#!/usr/bin/env node
/**
 * Content completeness checker for primary course package.
 */

import { loadPrimaryCourse } from './lib/course-package-source.mjs';

function checkModule(mod, totalModules) {
  const errors = [];
  const slug = mod.id;

  if (!mod.title) errors.push('missing title');
  if (!mod.subtitle) errors.push('missing subtitle');
  if (!mod.focusQuestion) errors.push('missing focusQuestion');
  if (!mod.keyInsight) errors.push('missing keyInsight');
  if (!mod.moduleKind) errors.push('missing moduleKind');
  if (!mod.primaryCognitiveAction) errors.push('missing primaryCognitiveAction');
  if (!mod.opening) errors.push('missing opening');
  if (!mod.narrative || mod.narrative.length === 0) errors.push('missing narrative (empty or absent)');
  if (mod.narrative && mod.narrative.length < 3) errors.push(`narrative too short (${mod.narrative.length} blocks, need ≥3)`);
  if (mod.number < totalModules && !mod.bridgeTo) errors.push('missing bridgeTo (not last module)');
  if (!Array.isArray(mod.concepts) || mod.concepts.length === 0) errors.push('missing concepts');
  if (!mod.logicChain || mod.logicChain.length === 0) errors.push('missing logicChain');
  if (!Array.isArray(mod.visuals) || mod.visuals.length === 0) errors.push('missing visuals');
  if (!Array.isArray(mod.interactionRequirements) || mod.interactionRequirements.length === 0) errors.push('missing interactionRequirements');

  return { slug, errors };
}

let hasFailures = false;
const { modules } = loadPrimaryCourse();
const total = modules.length;

console.log(`\n=== Checking primary course package (${total} modules) ===\n`);
const results = modules.map(({ data }) => checkModule(data, total));
for (const r of results) {
  const status = r.errors.length === 0 ? '✅' : '❌';
  const detail = r.errors.length === 0 ? '' : r.errors.join('; ');
  console.log(`  ${status} ${r.slug}  ${detail}`);
  if (r.errors.length > 0) hasFailures = true;
}
console.log('');
if (hasFailures) {
  console.error('❌ Content check FAILED — fix the issues above before building.');
  process.exit(1);
} else {
  console.log('✅ All content checks passed.');
}
