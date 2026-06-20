import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, '..');
export const coursesRoot = resolve(repoRoot, 'courses');

export const REGISTERS = new Set(['explainer', 'essay']);
export const BLOCK_TYPES = new Set(['text', 'heading', 'callout', 'code', 'quote']);
export const HIGHLIGHT_KINDS = new Set(['bespoke', 'trace']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}
function safeReadJson(path, errs) {
  try {
    return readJson(path);
  } catch (error) {
    errs.push({ path, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function loadEssayCoursePackageFromDir(packageDir) {
  const dir = resolve(String(packageDir));
  const coursePath = resolve(dir, 'course.json');
  const chaptersDir = resolve(dir, 'chapters');
  const reviewPath = resolve(dir, 'review', 'approval.json');
  const parseErrors = [];
  const missing = [];

  let course = null;
  if (!existsSync(coursePath)) missing.push(coursePath);
  else course = safeReadJson(coursePath, parseErrors);

  let chapterFiles = [];
  const chapters = [];
  if (!existsSync(chaptersDir)) {
    missing.push(`${chaptersDir}/c*.json`);
  } else {
    chapterFiles = readdirSync(chaptersDir)
      .filter((name) => /^c\d\d\.json$/.test(name))
      .sort();
    if (chapterFiles.length === 0) missing.push(`${chaptersDir}/c*.json`);
    for (const name of chapterFiles) {
      const filePath = resolve(chaptersDir, name);
      const data = safeReadJson(filePath, parseErrors);
      if (data) chapters.push({ name, path: filePath, data });
    }
  }

  const reviewExists = existsSync(reviewPath);
  const reviewApproval = reviewExists ? safeReadJson(reviewPath, parseErrors) : null;

  if (!course || chapters.length === 0) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      parseErrors.length ? `parse errors: ${parseErrors.map((e) => `${e.path}: ${e.message}`).join('; ')}` : '',
    ].filter(Boolean);
    throw new Error(`Invalid essay course package at ${dir}${details.length ? ` (${details.join(' | ')})` : ''}`);
  }

  return {
    slug: course.slug || course.id || basename(dir),
    packageDir: dir,
    course,
    chaptersDir,
    chapterFiles,
    chapters,
    reviewApproval,
    reviewApprovalPath: reviewExists ? reviewPath : null,
  };
}

export function loadEssayCoursePackageBySlug(slug, options = {}) {
  return loadEssayCoursePackageFromDir(resolve(options.coursesDir ?? coursesRoot, slug));
}

export function normalizeLoadedSource(input) {
  if (typeof input === 'string') return loadEssayCoursePackageFromDir(input);
  if (input && typeof input === 'object' && input.course && Array.isArray(input.chapters)) return input;
  throw new Error('Expected an essay package directory or a loaded source object.');
}

export function compileEssayCourse(input) {
  const source = normalizeLoadedSource(input);
  const byId = Object.fromEntries(source.chapters.map((c) => [c.data.id, c.data]));
  const declaredOrder = Array.isArray(source.course?.chapters) ? source.course.chapters : [];
  const ordered = [];
  const unresolvedChapterIds = [];
  for (const id of declaredOrder) {
    if (byId[id]) ordered.push(byId[id]);
    else unresolvedChapterIds.push(id);
  }
  const orderedIds = new Set(ordered.map((c) => c.id));
  const extraChapters = source.chapters.map((c) => c.data).filter((c) => !orderedIds.has(c.id));
  const chapters = declaredOrder.length ? ordered.concat(extraChapters) : source.chapters.map((c) => c.data);

  return {
    ...source,
    chapters,
    chapterIds: chapters.map((c) => c.id),
    unresolvedChapterIds,
    extraChapters,
    coursePackage: { ...source.course, chapters },
    summary: {
      slug: source.course.slug || source.course.id || source.slug,
      title: source.course.title,
      subtitle: source.course.subtitle,
      status: source.course.status,
      register: source.course.register,
      chapterCount: chapters.length,
      chapterIds: chapters.map((c) => c.id),
    },
  };
}
