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

function summarizeReviewApproval(reviewApproval, reviewApprovalPath = null) {
  return {
    exists: Boolean(reviewApprovalPath || reviewApproval),
    approved: Boolean(reviewApproval && reviewApproval.approved === true),
    reviewedBy: typeof reviewApproval?.reviewedBy === 'string' ? reviewApproval.reviewedBy : null,
    reviewedAt: typeof reviewApproval?.reviewedAt === 'string' ? reviewApproval.reviewedAt : null,
    notes: typeof reviewApproval?.notes === 'string' ? reviewApproval.notes : null,
  };
}

export function validateEssayCoursePackage(input, options = {}) {
  const requireReviewApproval = options.requireReviewApproval === true;
  const source = normalizeLoadedSource(input);
  const compiled = compileEssayCourse(source);
  const course = source.course ?? {};
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!isNonEmptyString(course.id)) err('course.json: missing id');
  if (!isNonEmptyString(course.title)) err('course.json: missing title');
  if (!isNonEmptyString(course.drivingQuestion)) err('course.json: missing drivingQuestion');
  if (!isNonEmptyString(course.centralTension)) err('course.json: missing centralTension');
  if (!REGISTERS.has(course.register)) err(`course.json: register must be explainer|essay (got '${course.register}')`);
  if (!isRecord(course.overview)) {
    warn('course.json: missing overview');
  } else {
    if (!isNonEmptyString(course.overview.whyExists)) warn('course.json: overview.whyExists empty');
    if (!isNonEmptyString(course.overview.wherePoints)) warn('course.json: overview.wherePoints empty');
    if (!Array.isArray(course.overview.arc) || course.overview.arc.length === 0) warn('course.json: overview.arc empty');
  }

  const declaredOrder = Array.isArray(course.chapters) ? course.chapters : [];
  if (declaredOrder.length === 0) err('course.json: missing chapters[]');
  if (declaredOrder.length < 4 || declaredOrder.length > 6) warn(`course.json: expected 4-6 chapters (got ${declaredOrder.length})`);

  const fileIds = source.chapters.map((c) => c.data.id);
  if (JSON.stringify(declaredOrder) !== JSON.stringify(fileIds)) err('course.json: chapters[] does not match chapter file order');
  if (compiled.unresolvedChapterIds.length) err(`course.json: chapters[] references missing files: ${compiled.unresolvedChapterIds.join(', ')}`);
  if (compiled.extraChapters.length) err(`chapter files missing from course.chapters[]: ${compiled.extraChapters.map((c) => c.id).join(', ')}`);

  source.chapters.forEach(({ name, data: ch }, idx) => {
    if (name !== `${ch.id}.json`) err(`${name}: filename does not match chapter id '${ch.id}'`);
    if (ch.number !== idx + 1) err(`${name}: number should be ${idx + 1} (got ${ch.number})`);
    if (!isNonEmptyString(ch.title)) err(`${name}: missing title`);
    if (!isNonEmptyString(ch.role)) warn(`${name}: missing role`);

    if (!Array.isArray(ch.narrative) || ch.narrative.length === 0) {
      err(`${name}: missing narrative`);
    } else {
      ch.narrative.forEach((b, bi) => {
        if (!BLOCK_TYPES.has(b?.type)) err(`${name}: narrative[${bi}] invalid type '${b?.type}'`);
        if (!isNonEmptyString(b?.content)) err(`${name}: narrative[${bi}] empty content`);
      });
    }

    if (ch.highlight != null) {
      const h = ch.highlight;
      if (!HIGHLIGHT_KINDS.has(h.kind)) err(`${name}: highlight.kind must be bespoke|trace`);
      if (h.kind === 'bespoke' && !isNonEmptyString(h.component)) err(`${name}: bespoke highlight requires component`);
      if (h.kind === 'trace' && !isRecord(h.data)) err(`${name}: trace highlight requires data object`);
      if (!isNonEmptyString(h.caption)) err(`${name}: highlight missing caption`);
      const n = Array.isArray(ch.narrative) ? ch.narrative.length : 0;
      if (!Number.isInteger(h.afterBlock) || h.afterBlock < 0 || h.afterBlock >= n) err(`${name}: highlight.afterBlock out of range`);
    }

    const isLast = idx === source.chapters.length - 1;
    if (!isLast && !isNonEmptyString(ch.bridge)) warn(`${name}: missing bridge (not last chapter)`);
  });

  const reviewApproval = summarizeReviewApproval(source.reviewApproval, source.reviewApprovalPath);
  const reviewMustPass = requireReviewApproval || course.status === 'published';
  if (!reviewApproval.exists) {
    if (reviewMustPass) err('missing review/approval.json');
  } else if (reviewApproval.approved === true) {
    if (!isNonEmptyString(reviewApproval.reviewedBy)) err("review/approval.json: 'reviewedBy' required when approved=true");
    if (!isNonEmptyString(reviewApproval.reviewedAt)) err("review/approval.json: 'reviewedAt' required when approved=true");
  } else if (reviewMustPass) {
    err('review approval is required before publish/promote');
  }

  const ok = errors.length === 0;
  const promoteReady = ok && reviewApproval.approved === true;
  const publishReady = promoteReady && course.status === 'published';
  return { ok, promoteReady, publishReady, errors, warnings, summary: compiled.summary, reviewApproval };
}
