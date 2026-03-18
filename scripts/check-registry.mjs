#!/usr/bin/env node
/**
 * Registry + concept-map schema validation.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadZhModules() {
  const modulesDir = resolve(root, 'src/content/zh/modules');
  return readdirSync(modulesDir)
    .filter((name) => /^s\d\d\.json$/.test(name))
    .sort()
    .map((name) => loadJson(resolve(modulesDir, name)));
}

const modules = loadZhModules();
const schemas = loadJson(resolve(root, 'src/data/concept-map-schemas.json'));

let hasError = false;
const fail = (msg) => {
  hasError = true;
  console.error(`❌ ${msg}`);
};

for (const mod of modules) {
  const id = mod.id;
  const slug = `s${String(id).padStart(2, '0')}`;
  const schema = schemas[id];

  if (!schema) {
    fail(`${slug}: missing concept-map schema`);
    continue;
  }
  if (!Array.isArray(schema.nodes) || schema.nodes.length === 0) fail(`${slug}: schema.nodes empty`);
  if (!Array.isArray(schema.edges) || schema.edges.length === 0) fail(`${slug}: schema.edges empty`);
  if (!schema.svgW || !schema.svgH) fail(`${slug}: missing svg dimensions`);
  if (!schema.ariaLabel) fail(`${slug}: missing ariaLabel`);

  const ids = new Set();
  for (const node of schema.nodes) {
    if (ids.has(node.id)) fail(`${slug}: duplicate node id '${node.id}'`);
    ids.add(node.id);
  }
  for (const edge of schema.edges) {
    if (!ids.has(edge.from)) fail(`${slug}: edge.from '${edge.from}' not found in nodes`);
    if (!ids.has(edge.to)) fail(`${slug}: edge.to '${edge.to}' not found in nodes`);
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ Registry and concept-map schema checks passed.');
}
