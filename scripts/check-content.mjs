#!/usr/bin/env node
/**
 * Content completeness checker for all course packages.
 */

import { getCourseSummary, loadAllCourses, validateCoursePackage } from './lib/course-package-source.mjs';

function buildModuleIssueMap(issues, moduleIds) {
  const byModule = new Map(moduleIds.map((moduleId) => [moduleId, { errors: [], warnings: [] }]));

  for (const issue of issues) {
    if (!issue.moduleId || !byModule.has(issue.moduleId)) continue;
    if (issue.severity === 'error') {
      byModule.get(issue.moduleId).errors.push(issue.message);
    } else {
      byModule.get(issue.moduleId).warnings.push(issue.message);
    }
  }

  return byModule;
}

let hasFailures = false;

for (const source of loadAllCourses()) {
  const summary = getCourseSummary(source);
  const result = validateCoursePackage(source);
  const moduleIssues = buildModuleIssueMap(
    result.issuesByCategory.content.errors.concat(result.issuesByCategory.content.warnings),
    summary.moduleIds,
  );

  console.log(`\n=== Checking content: ${summary.slug} (${summary.moduleCount} modules) ===\n`);

  for (const moduleId of summary.moduleIds) {
    const entry = moduleIssues.get(moduleId) ?? { errors: [], warnings: [] };
    const status = entry.errors.length > 0 ? '❌' : entry.warnings.length > 0 ? '⚠️' : '✅';
    const detail = [
      entry.errors.length > 0 ? entry.errors.join('; ') : '',
      entry.warnings.length > 0 ? `warnings: ${entry.warnings.join('; ')}` : '',
    ].filter(Boolean).join(' | ');

    console.log(`  ${status} ${moduleId}  ${detail}`);
    if (entry.errors.length > 0) {
      hasFailures = true;
    }
  }
}

console.log('');
if (hasFailures) {
  console.error('❌ Content check FAILED — fix the issues above before building.');
  process.exit(1);
}

console.log('✅ All content checks passed.');
