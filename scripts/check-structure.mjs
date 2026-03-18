#!/usr/bin/env node
/**
 * Structural integrity checks for split content source.
 * - module ids unique + contiguous
 * - category ids valid
 * - module filenames match ids
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const base = resolve(root, 'src/content/zh');
const modulesDir = resolve(base, 'modules');

const load = (p) => JSON.parse(readFileSync(p, 'utf-8'));
const categories = load(resolve(base, 'categories.json'));
const categoryIds = new Set(categories.map((c) => c.id));
const moduleFiles = readdirSync(modulesDir).filter((n) => /^s\d\d\.json$/.test(n)).sort();
const modules = moduleFiles.map((name) => ({ name, data: load(resolve(modulesDir, name)) }));

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

const ids = modules.map((m) => m.data.id);
const unique = new Set(ids);
if (unique.size !== ids.length) fail('duplicate module ids');

for (let i = 0; i < ids.length; i++) {
  const expected = i + 1;
  if (ids[i] !== expected) fail(`module sequence broken at index ${i}: expected id=${expected}, got id=${ids[i]}`);
}

for (const { name, data } of modules) {
  const expectedName = `s${String(data.id).padStart(2, '0')}.json`;
  if (name !== expectedName) fail(`${name}: filename does not match module id ${data.id}`);
  if (!categoryIds.has(data.category)) fail(`${name}: unknown category '${data.category}'`);
}

if (bad) process.exit(1);
console.log('✅ Structure checks passed.');
