import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'path';
import { loadEssayCoursePackageFromDir, compileEssayCourse, validateEssayCoursePackage } from './essay-course-engine.mjs';

const FIXTURE = resolve(process.cwd(), 'fixtures/essay-min');

function loadMut() {
  // 深拷贝 fixture 的 source，便于逐项制造非法数据
  const src = loadEssayCoursePackageFromDir(FIXTURE);
  return JSON.parse(JSON.stringify(src));
}

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

test('valid fixture: ok true, no errors', () => {
  const result = validateEssayCoursePackage(FIXTURE);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('missing drivingQuestion -> error', () => {
  const src = loadMut();
  delete src.course.drivingQuestion;
  const result = validateEssayCoursePackage(src);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((m) => m.includes('drivingQuestion')));
});

test('bad register -> error', () => {
  const src = loadMut();
  src.course.register = 'lecture';
  const result = validateEssayCoursePackage(src);
  assert.ok(result.errors.some((m) => m.includes('register')));
});

test('invalid narrative block type -> error', () => {
  const src = loadMut();
  src.chapters[0].data.narrative[0].type = 'steps';
  const result = validateEssayCoursePackage(src);
  assert.ok(result.errors.some((m) => m.includes('invalid type')));
});

test('bespoke highlight without component -> error', () => {
  const src = loadMut();
  delete src.chapters[2].data.highlight.component;
  const result = validateEssayCoursePackage(src);
  assert.ok(result.errors.some((m) => m.includes('bespoke highlight requires component')));
});

test('chapters[] order mismatch -> error', () => {
  const src = loadMut();
  src.course.chapters = ['c01', 'c02', 'c03']; // 漏掉 c04
  const result = validateEssayCoursePackage(src);
  assert.ok(result.errors.some((m) => m.includes('chapters[]')));
});

test('published without approval -> error', () => {
  const src = loadMut();
  src.course.status = 'published';
  const result = validateEssayCoursePackage(src);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((m) => m.includes('approval')));
});
