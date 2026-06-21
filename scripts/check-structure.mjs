#!/usr/bin/env node
/**
 * Structural integrity checks for all course packages.
 */

import {
  compileEssayCourse,
  getCourseSummary,
  loadAllCourses,
  loadAllEssayCourses,
  validateCoursePackage,
  validateEssayCoursePackage,
} from './lib/course-package-source.mjs';

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

for (const source of loadAllEssayCourses()) {
  const summary = compileEssayCourse(source).summary;
  const result = validateEssayCoursePackage(source);
  console.log(`\n=== Checking structure: ${summary.slug} ===`);
  for (const message of result.errors) {
    console.log(`❌ ${message}`);
    bad = true;
  }
  for (const message of result.warnings) {
    console.log(`⚠️ ${message}`);
  }
}

console.log('');
if (bad) {
  process.exit(1);
}

console.log('✅ Structure checks passed.');
