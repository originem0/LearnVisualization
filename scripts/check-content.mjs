#!/usr/bin/env node
/**
 * Content completeness checker for all course packages.
 */

import {
  compileEssayCourse,
  getCourseSummary,
  loadAllCourses,
  loadAllEssayCourses,
  validateCoursePackage,
  validateEssayCoursePackage,
} from './lib/course-package-source.mjs';

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

try {
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

  for (const source of loadAllEssayCourses()) {
    const compiled = compileEssayCourse(source);
    const result = validateEssayCoursePackage(source);
    console.log(`\n=== Checking content: ${compiled.summary.slug} (${compiled.summary.chapterCount} chapters) ===\n`);
    for (const chapterId of compiled.summary.chapterIds) {
      console.log(`  ✅ ${chapterId}`);
    }
    for (const message of result.errors) {
      console.error(`  ❌ ${message}`);
      hasFailures = true;
    }
  }

  console.log('');
  if (hasFailures) {
    console.error('❌ Content check FAILED — fix the issues above before building.');
    process.exit(1);
  }

  console.log('✅ All content checks passed.');
} catch (err) {
  console.error('❌ Content check crashed:', err);
  process.exit(1);
}
