#!/usr/bin/env node
/**
 * Authoring checks driven by narrative-block-spec.json
 * against primary course package modules.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPrimaryCourse, root } from './lib/course-package-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(resolve(root, 'src/data/narrative-block-spec.json'), 'utf-8'));
const { modules } = loadPrimaryCourse();

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

for (const { name, data: mod } of modules) {
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
