import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { loadEssayCoursePackageFromDir, compileEssayCourse } from './essay-course-engine.mjs';

const FIXTURE = resolve(process.cwd(), 'fixtures/essay-min');

test('loads fixture: course + 4 chapters', () => {
  const src = loadEssayCoursePackageFromDir(FIXTURE);
  assert.equal(src.course.id, 'essay-min');
  assert.equal(src.chapters.length, 4);
  assert.deepEqual(src.chapterFiles, ['c01.json', 'c02.json', 'c03.json', 'c04.json']);
});

test('compile orders chapters by course.chapters', () => {
  const compiled = compileEssayCourse(FIXTURE);
  assert.deepEqual(compiled.chapterIds, ['c01', 'c02', 'c03', 'c04']);
  assert.equal(compiled.summary.chapterCount, 4);
  assert.equal(compiled.summary.register, 'explainer');
  assert.equal(compiled.unresolvedChapterIds.length, 0);
  assert.equal(compiled.extraChapters.length, 0);
});
