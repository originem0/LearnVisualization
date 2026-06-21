#!/usr/bin/env node
/**
 * Visual + interaction registry validation for all course packages.
 * Draft courses keep non-structural registry gaps as warnings.
 */

import { compileEssayCourse, getCourseSummary, loadAllCourses, loadAllEssayCourses, validateCoursePackage } from './lib/course-package-source.mjs';

function groupRegistryIssues(issues) {
  const byModule = new Map();
  const courseLevel = [];

  for (const issue of issues) {
    if (!issue.moduleId) {
      courseLevel.push(issue);
      continue;
    }

    if (!byModule.has(issue.moduleId)) {
      byModule.set(issue.moduleId, []);
    }
    byModule.get(issue.moduleId).push(issue);
  }

  return { byModule, courseLevel };
}

for (const source of loadAllEssayCourses()) {
  const summary = compileEssayCourse(source).summary;
  console.log(`\n=== Checking registry: ${summary.slug} (essay — no registry) ===`);
}

let hasError = false;

for (const source of loadAllCourses()) {
  const summary = getCourseSummary(source);
  const result = validateCoursePackage(source);
  const registryIssues = result.issuesByCategory.registry.errors.concat(result.issuesByCategory.registry.warnings);
  const { byModule, courseLevel } = groupRegistryIssues(registryIssues);
  const mode = summary.status === 'published' ? 'published' : `${summary.status ?? 'draft'} — warnings only`;

  console.log(`\n=== Checking registry: ${summary.slug} (${mode}) ===`);

  for (const issue of courseLevel) {
    const prefix = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`${prefix} ${issue.message}`);
    if (issue.severity === 'error') {
      hasError = true;
    }
  }

  for (const moduleId of summary.moduleIds) {
    const issues = byModule.get(moduleId) ?? [];
    for (const issue of issues) {
      const prefix = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`${prefix} ${issue.message}`);
      if (issue.severity === 'error') {
        hasError = true;
      }
    }
  }
}

console.log('');
if (hasError) {
  process.exit(1);
}

console.log('✅ Registry and concept-map schema checks passed.');
