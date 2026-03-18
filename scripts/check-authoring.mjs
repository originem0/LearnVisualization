#!/usr/bin/env node
/**
 * Authoring checks driven by narrative-block-spec.json
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const spec = JSON.parse(readFileSync(resolve(root, 'src/data/narrative-block-spec.json'), 'utf-8'));
const modulesDir = resolve(root, 'src/content/zh/modules');
const moduleFiles = readdirSync(modulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

for (const name of moduleFiles) {
  const mod = JSON.parse(readFileSync(resolve(modulesDir, name), 'utf-8'));
  const blocks = mod.narrative || [];

  blocks.forEach((block, idx) => {
    const rule = spec[block.type];
    if (!rule) {
      fail(`${name}: narrative[${idx}] unknown block type '${block.type}'`);
      return;
    }

    for (const field of rule.required || []) {
      if (field === 'steps') continue;
      if (typeof block[field] !== 'string') {
        fail(`${name}: narrative[${idx}] missing string field '${field}'`);
      }
    }

    if (block.type === 'steps') {
      if (!Array.isArray(block.steps) || block.steps.length === 0) {
        fail(`${name}: narrative[${idx}] steps block missing steps[]`);
      } else {
        for (const [sidx, step] of block.steps.entries()) {
          for (const key of rule.stepRequired || []) {
            if (!step[key] || typeof step[key] !== 'string') {
              fail(`${name}: narrative[${idx}].steps[${sidx}] missing '${key}'`);
            }
          }
        }
      }
    }

    if (block.type === 'comparison' && typeof block.content === 'string') {
      const lines = block.content.split('\n').filter(Boolean);
      if (lines.length !== 2) {
        fail(`${name}: narrative[${idx}] comparison should prefer exactly 2 lines, got ${lines.length}`);
      }
    }
  });
}

if (bad) process.exit(1);
console.log('✅ Authoring checks passed.');
