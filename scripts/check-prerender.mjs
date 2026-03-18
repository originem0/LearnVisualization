#!/usr/bin/env node
/**
 * Post-build smoke test.
 * Validates the prerender manifest contains every expected zh route,
 * and that removed/disabled routes (en, compare) do not come back.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.next/prerender-manifest.json'), 'utf-8'));
const routes = new Set(Object.keys(manifest.routes || {}));

let bad = false;
const fail = (msg) => { bad = true; console.error(`❌ ${msg}`); };

const required = ['/zh', '/zh/layers', '/zh/timeline'];
for (let i = 1; i <= 12; i++) required.push(`/zh/s${String(i).padStart(2, '0')}`);

for (const route of required) {
  if (!routes.has(route)) fail(`missing prerendered route: ${route}`);
}

for (const route of routes) {
  if (route.startsWith('/en')) fail(`unexpected en route still prerendered: ${route}`);
  if (route.includes('/compare')) fail(`unexpected compare route still prerendered: ${route}`);
}

if (bad) process.exit(1);
console.log('✅ Prerender smoke checks passed.');
