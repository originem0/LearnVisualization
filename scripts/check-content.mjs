#!/usr/bin/env node
/**
 * Content completeness checker for pero-viz-next.
 *
 * Validates that every module in zh content source meets the minimum quality bar.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadZhState() {
  const base = resolve(root, 'src/content/zh');
  const modulesDir = resolve(base, 'modules');
  const moduleFiles = readdirSync(modulesDir)
    .filter((name) => /^s\d\d\.json$/.test(name))
    .sort();

  return {
    project: loadJson(resolve(base, 'project.json')),
    categories: loadJson(resolve(base, 'categories.json')),
    modules: moduleFiles.map((name) => loadJson(resolve(modulesDir, name))),
  };
}

const REQUIRED_HERO = {
  1: 'TokenizerPlayground', 2: 'VectorArithmetic', 3: 'AttentionHeatmap', 4: 'TransformerFlow',
  5: 'NextWordGame', 6: 'LossLandscape', 7: 'AlignmentCompare', 8: 'PromptWorkshop',
  9: 'ScalingLawPlotter', 10: 'EmergenceStaircase', 11: 'ContextLengthCalc', 12: 'FullPipelineTracer',
};
const REQUIRED_SECONDARY = {
  1: 'BPESimulator', 2: 'EmbeddingLookup', 3: 'QKVStepper', 4: 'ArchitectureCompare',
  5: 'MLMvsCLM', 6: 'LRScheduleViz', 7: 'LoRACalculator', 8: 'FewShotBuilder',
  9: 'TrainingBudgetCalc', 10: 'CoTToggle', 11: 'ContextFitCalc', 12: 'KnowledgeNetwork',
};

function checkModule(mod, totalModules) {
  const errors = [];
  const id = mod.id;
  const slug = `s${String(id).padStart(2, '0')}`;

  if (!mod.title) errors.push('missing title');
  if (!mod.subtitle) errors.push('missing subtitle');
  if (!mod.opening) errors.push('missing opening');
  if (!mod.narrative || mod.narrative.length === 0) errors.push('missing narrative (empty or absent)');
  if (mod.narrative && mod.narrative.length < 3) errors.push(`narrative too short (${mod.narrative.length} blocks, need ≥3)`);
  if (id < totalModules && !mod.bridgeTo) errors.push('missing bridgeTo (not last module)');
  if (!mod.concepts || !mod.concepts.items || mod.concepts.items.length === 0) errors.push('missing concepts.items');
  if (!mod.logicChain || mod.logicChain.length === 0) errors.push('missing logicChain');
  if (!REQUIRED_HERO[id]) errors.push('no hero interactive in registry');
  if (!REQUIRED_SECONDARY[id]) errors.push('no secondary interactive in registry');

  return { slug, errors };
}

let hasFailures = false;
const state = loadZhState();
const total = state.modules.length;

console.log(`\n=== Checking zh (${total} modules) ===\n`);
const results = state.modules.map((mod) => checkModule(mod, total));
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
