#!/usr/bin/env node
/**
 * Post-build smoke test.
 * Validates the prerender manifest contains every expected route.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PRIMARY_COURSE, listCourseSlugs, loadCourse } from './lib/course-package-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.next/prerender-manifest.json'), 'utf-8'));
const routes = new Set(Object.keys(manifest.routes || {}));

let bad = false;
const fail = (message) => {
  bad = true;
  console.error(`❌ ${message}`);
};

const required = ['/zh'];
const primaryCourse = loadCourse(PRIMARY_COURSE);

required.push('/zh/layers', '/zh/timeline');
for (const { data: module } of primaryCourse.modules) {
  required.push(`/zh/${module.id}`);
}

for (const courseSlug of listCourseSlugs()) {
  const course = loadCourse(courseSlug);
  required.push(`/zh/courses/${courseSlug}`);
  required.push(`/zh/courses/${courseSlug}/layers`);
  required.push(`/zh/courses/${courseSlug}/timeline`);

  for (const { data: module } of course.modules) {
    required.push(`/zh/courses/${courseSlug}/${module.id}`);
  }
}

for (const route of required) {
  if (!routes.has(route)) {
    fail(`missing prerendered route: ${route}`);
  }
}

for (const route of routes) {
  if (route.startsWith('/en')) {
    fail(`unexpected en route still prerendered: ${route}`);
  }
  if (route.includes('/compare')) {
    fail(`unexpected compare route still prerendered: ${route}`);
  }
}

if (bad) {
  process.exit(1);
}

console.log('✅ Prerender smoke checks passed.');
