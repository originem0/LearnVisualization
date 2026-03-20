#!/usr/bin/env node
/**
 * Structural integrity checks for all course packages.
 */

import { getCourseSummary, loadAllCourses, validateCoursePackage } from './lib/course-package-source.mjs';

let bad = false;

for (const source of loadAllCourses()) {
  const summary = getCourseSummary(source);
  const result = validateCoursePackage(source);
  const issues = result.issuesByCategory.structure.errors.concat(result.issuesByCategory.structure.warnings);

  console.log(`\n=== Checking structure: ${summary.slug} ===`);

  for (const issue of issues) {
    const prefix = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`${prefix} ${issue.message}`);
    if (issue.severity === 'error') {
      bad = true;
    }
  }
}

console.log('');
if (bad) {
  process.exit(1);
}

console.log('✅ Structure checks passed.');
