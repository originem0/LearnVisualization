#!/usr/bin/env node
/**
 * Primary course package visual + interaction validation.
 */

import { loadPrimaryCourse } from './lib/course-package-source.mjs';

const { modules, conceptMaps, interactions } = loadPrimaryCourse();
let hasError = false;
const fail = (msg) => {
  hasError = true;
  console.error(`❌ ${msg}`);
};

for (const { data: mod } of modules) {
  const slug = mod.id;
  const schema = conceptMaps[String(mod.number)];

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

  const reg = interactions[slug];
  if (!reg) fail(`${slug}: missing interaction registry entry`);
  if (!reg?.heroInteractive?.componentHint) fail(`${slug}: missing heroInteractive.componentHint`);
  if (!reg?.secondaryInteractive?.componentHint) fail(`${slug}: missing secondaryInteractive.componentHint`);
}

if (hasError) {
  process.exit(1);
} else {
  console.log('✅ Registry and concept-map schema checks passed.');
}
