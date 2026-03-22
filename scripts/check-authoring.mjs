#!/usr/bin/env node
/**
 * Authoring checks driven by narrative-block-spec.json
 * against all course package modules.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { loadAllCourses, root } from './lib/course-package-source.mjs';

const spec = JSON.parse(readFileSync(resolve(root, 'src/data/narrative-block-spec.json'), 'utf-8'));

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

for (const { slug: courseSlug, modules } of loadAllCourses()) {
  console.log(`\n=== Checking authoring: ${courseSlug} ===`);

  for (const { name, data: mod } of modules) {
    const blocks = mod.narrative || [];

    blocks.forEach((block, idx) => {
      const rule = spec[block.type];
      if (!rule) {
        // Unknown block types are allowed (v3 passthrough) — just skip spec validation
        return;
      }

      for (const field of rule.required || []) {
        if (field === 'steps') continue;
        if (typeof block[field] !== 'string') {
          fail(`[${courseSlug}] ${name}: narrative[${idx}] missing string field '${field}'`);
        }
      }

      if (block.type === 'steps') {
        if (!Array.isArray(block.steps) || block.steps.length === 0) {
          fail(`[${courseSlug}] ${name}: narrative[${idx}] steps block missing steps[]`);
        } else {
          for (const [sidx, step] of block.steps.entries()) {
            for (const key of rule.stepRequired || []) {
              if (!step[key] || typeof step[key] !== 'string') {
                fail(`[${courseSlug}] ${name}: narrative[${idx}].steps[${sidx}] missing '${key}'`);
              }
            }
          }
        }
      }

      if (block.type === 'comparison' && typeof block.content === 'string') {
        const lines = block.content.split('\n').filter(Boolean);
        if (lines.length !== 2) {
          console.warn(`⚠  [${courseSlug}] ${name}: narrative[${idx}] comparison prefers exactly 2 lines, got ${lines.length}`);
        }
      }
    });
  }
}

console.log('');
if (bad) process.exit(1);
console.log('✅ Authoring checks passed.');
