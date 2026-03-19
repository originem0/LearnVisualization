#!/usr/bin/env node
/**
 * Post-build smoke test.
 * Validates the prerender manifest contains every expected route.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.next/prerender-manifest.json'), 'utf-8'));
const routes = new Set(Object.keys(manifest.routes || {}));

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

// Hub page
const required = ['/zh'];

// Legacy redirect routes (still prerendered as redirect pages)
required.push('/zh/layers', '/zh/timeline');
for (let i = 1; i <= 12; i++) required.push(`/zh/s${String(i).padStart(2, '0')}`);

// Course routes — discover from courses/ directory
const coursesDir = resolve(root, 'courses');
if (existsSync(coursesDir)) {
  const courseSlugs = readdirSync(coursesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(resolve(coursesDir, e.name, 'course.json')))
    .map((e) => e.name);

  for (const slug of courseSlugs) {
    required.push(`/zh/courses/${slug}`);
  }
}

for (const route of required) {
  if (!routes.has(route)) fail(`missing prerendered route: ${route}`);
}

for (const route of routes) {
  if (route.startsWith('/en')) fail(`unexpected en route still prerendered: ${route}`);
  if (route.includes('/compare')) fail(`unexpected compare route still prerendered: ${route}`);
}

if (bad) process.exit(1);
console.log('✅ Prerender smoke checks passed.');
