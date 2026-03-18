#!/usr/bin/env node
/**
 * Structural integrity checks for primary course package.
 */

import { loadPrimaryCourse } from './lib/course-package-source.mjs';

const { course, modules } = loadPrimaryCourse();
let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

const categoryIds = new Set((course.categories ?? []).map((c) => c.id));
const ids = modules.map((m) => m.data.number);
const unique = new Set(ids);
if (unique.size !== ids.length) fail('duplicate module numbers');

for (let i = 0; i < ids.length; i++) {
  const expected = i + 1;
  if (ids[i] !== expected) fail(`module sequence broken at index ${i}: expected number=${expected}, got number=${ids[i]}`);
}

const order = course.moduleGraph?.order ?? [];
const slugs = modules.map((m) => m.data.id);
if (JSON.stringify(order) !== JSON.stringify(slugs)) {
  fail('course.moduleGraph.order does not match module file order');
}

for (const { name, data } of modules) {
  const expectedName = `${data.id}.json`;
  if (name !== expectedName) fail(`${name}: filename does not match module id ${data.id}`);
  if (!categoryIds.has(data.category)) fail(`${name}: unknown category '${data.category}'`);
}

if (bad) process.exit(1);
console.log('✅ Structure checks passed.');
