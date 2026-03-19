#!/usr/bin/env node
/**
 * Visual + interaction registry validation for all course packages.
 * Draft courses get warnings instead of failures for missing nodes/edges/componentHint.
 */

import { loadAllCourses } from './lib/course-package-source.mjs';

let hasError = false;
const fail = (msg) => {
  hasError = true;
  console.error(`❌ ${msg}`);
};
const warn = (msg) => {
  console.warn(`⚠️  ${msg}`);
};

for (const { slug: courseSlug, course, modules, conceptMaps, interactions } of loadAllCourses()) {
  const isDraft = course.status !== 'published';
  const report = isDraft ? warn : fail;

  console.log(`\n=== Checking registry: ${courseSlug} (${isDraft ? 'draft — warnings only' : 'published'}) ===`);

  for (const { data: mod } of modules) {
    const slug = mod.id;
    const schema = conceptMaps[String(mod.number)];

    if (!schema) {
      report(`[${courseSlug}] ${slug}: missing concept-map schema`);
      continue;
    }
    if (!Array.isArray(schema.nodes) || schema.nodes.length === 0) report(`[${courseSlug}] ${slug}: schema.nodes empty`);
    if (!Array.isArray(schema.edges) || schema.edges.length === 0) report(`[${courseSlug}] ${slug}: schema.edges empty`);
    if (!schema.svgW || !schema.svgH) report(`[${courseSlug}] ${slug}: missing svg dimensions`);
    if (!schema.ariaLabel) report(`[${courseSlug}] ${slug}: missing ariaLabel`);

    if (Array.isArray(schema.nodes)) {
      const ids = new Set();
      for (const node of schema.nodes) {
        if (ids.has(node.id)) fail(`[${courseSlug}] ${slug}: duplicate node id '${node.id}'`);
        ids.add(node.id);
      }
      if (Array.isArray(schema.edges)) {
        for (const edge of schema.edges) {
          if (!ids.has(edge.from)) fail(`[${courseSlug}] ${slug}: edge.from '${edge.from}' not found in nodes`);
          if (!ids.has(edge.to)) fail(`[${courseSlug}] ${slug}: edge.to '${edge.to}' not found in nodes`);
        }
      }
    }

    const reg = interactions[slug];
    if (!reg) report(`[${courseSlug}] ${slug}: missing interaction registry entry`);
    if (!reg?.heroInteractive?.componentHint) report(`[${courseSlug}] ${slug}: missing heroInteractive.componentHint`);
    if (!reg?.secondaryInteractive?.componentHint) report(`[${courseSlug}] ${slug}: missing secondaryInteractive.componentHint`);
  }
}

console.log('');
if (hasError) {
  process.exit(1);
} else {
  console.log('✅ Registry and concept-map schema checks passed.');
}
