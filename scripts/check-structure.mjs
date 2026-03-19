#!/usr/bin/env node
/**
 * Structural integrity checks for all course packages.
 */

import { loadAllCourses } from './lib/course-package-source.mjs';

let bad = false;
const fail = (course, msg) => { bad = true; console.error(`❌ [${course}] ${msg}`); };

for (const { slug: courseSlug, course, modules } of loadAllCourses()) {
  console.log(`\n=== Checking structure: ${courseSlug} ===`);

  const categoryIds = new Set((course.categories ?? []).map((c) => c.id));
  const ids = modules.map((m) => m.data.number);
  const unique = new Set(ids);
  if (unique.size !== ids.length) fail(courseSlug, 'duplicate module numbers');

  for (let i = 0; i < ids.length; i++) {
    const expected = i + 1;
    if (ids[i] !== expected) fail(courseSlug, `module sequence broken at index ${i}: expected number=${expected}, got number=${ids[i]}`);
  }

  const order = course.moduleGraph?.order ?? [];
  const slugs = modules.map((m) => m.data.id);
  if (JSON.stringify(order) !== JSON.stringify(slugs)) {
    fail(courseSlug, 'course.moduleGraph.order does not match module file order');
  }

  for (const { name, data } of modules) {
    const expectedName = `${data.id}.json`;
    if (name !== expectedName) fail(courseSlug, `${name}: filename does not match module id ${data.id}`);
    if (!categoryIds.has(data.category)) fail(courseSlug, `${name}: unknown category '${data.category}'`);
  }
}

console.log('');
if (bad) process.exit(1);
console.log('✅ Structure checks passed.');
