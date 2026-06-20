# 叙事化重构 · 计划 1：数据契约 (Data Contract) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为新的"主线 + 章节"叙事课程模型落地一套可校验的数据契约（TS 类型 + JS 校验/编译引擎 + Python 规范化器 + 通过校验的最小 fixture），且全程不破坏现有应用。

**Architecture:** 新契约**增量并存**——新建独立的 `engine/essay-course-engine.mjs` 与新 TS 接口、新 Python 模块，旧的 `course-package-engine.mjs` / 旧 schema 原样保留，直到后续计划完成切换再删除。新引擎同时承担"校验"与"运行时编译"两职（与旧引擎对称），因为前端阅读路径将消费它。

**Tech Stack:** Node ESM（`node --test` 内置测试，无新依赖）、TypeScript 5（`tsc --noEmit` 类型校验）、Python 3.10 `unittest`。

## Global Constraints

- 语言：课程内容为 `zh`；`course.language` 固定 `"zh"`。
- 字段名逐字采用 spec §4（`drivingQuestion`/`centralTension`/`overview.{whyExists,wherePoints,arc}`/`register`/`knowledgeType`/`chapters`；章节 `role`/`narrative`/`highlight`/`bridge`）。
- 新契约**增量**：不修改 `engine/course-package-engine.mjs`、`src/lib/course-schema.ts` 现有导出、`src/lib/types.ts` 现有导出、`agent-backend/app/quality.py`。只新增。
- `register` 取值仅 `explainer | essay`；narrative block `type` 仅 `text|heading|callout|code|quote`；`highlight.kind` 仅 `bespoke|trace`。
- 章节文件名 `c\d\d.json`（`c01`…），`number` 从 1 连续；`course.chapters` 顺序必须与文件顺序一致。
- 每门课 4–6 章为期望区间（越界是 warning，不是 error）。
- JS 测试文件必须命名 `engine/<name>.test.mjs`（`package.json` 的 `test:node` 用 `engine/*.test.mjs` glob）。
- Python 测试置于 `agent-backend/tests/test_*.py`，沿用 `test_normalize.py` 的 sys.path 注入方式。

---

## File Structure

- Create: `fixtures/essay-min/course.json` + `fixtures/essay-min/chapters/c01..c04.json` + `fixtures/essay-min/review/approval.json` — 通过校验的最小新模型课程，作所有测试基线。
- Create: `engine/essay-course-engine.mjs` — 加载 + 校验 + 编译（新模型）。
- Create: `engine/essay-course-engine.test.mjs` — 引擎单测。
- Create: `scripts/validate-essay-course.mjs` — CLI 包装（镜像 `validate-course-package.mjs`）。
- Create: `agent-backend/app/essay_schema.py` — Python 规范化器。
- Create: `agent-backend/tests/test_essay_schema.py` — Python 单测。
- Modify: `src/lib/types.ts` — 新增 `EssayBlockType` / `EssayNarrativeBlock`（仅追加）。
- Modify: `src/lib/course-schema.ts` — 新增 `CourseRegister` / `CourseOverview` / `EssayCourse` / `HighlightKind` / `Highlight` / `Chapter`（仅追加）。

---

### Task 1: 最小 fixture 课程

**Files:**
- Create: `fixtures/essay-min/course.json`
- Create: `fixtures/essay-min/chapters/c01.json`
- Create: `fixtures/essay-min/chapters/c02.json`
- Create: `fixtures/essay-min/chapters/c03.json`
- Create: `fixtures/essay-min/chapters/c04.json`
- Create: `fixtures/essay-min/review/approval.json`

**Interfaces:**
- Produces: 一个目录 `fixtures/essay-min/`，被 Task 4/6 的校验测试、Task 5 的编译测试消费。`status: "draft"` + `approved: false` → 期望校验 `ok:true`（draft 不强制 review）。

- [ ] **Step 1: 写 `course.json`**

```json
{
  "id": "essay-min",
  "slug": "essay-min",
  "title": "最小叙事课",
  "subtitle": "data-contract fixture",
  "topic": "fixture",
  "language": "zh",
  "status": "draft",
  "register": "explainer",
  "knowledgeType": "procedural",
  "drivingQuestion": "这个最小课用来验证什么？",
  "centralTension": "schema 要严到挡住坏数据，又松到容纳连续散文。",
  "overview": {
    "whyExists": "给新数据契约一个会通过校验的最小样例。",
    "wherePoints": "成为校验器与编译器的测试基线。",
    "arc": ["第1章立题", "第2章演示", "第3章转折", "第4章收束"]
  },
  "chapters": ["c01", "c02", "c03", "c04"]
}
```

- [ ] **Step 2: 写 `chapters/c01.json`**

```json
{
  "id": "c01",
  "number": 1,
  "title": "立题",
  "role": "抛出驱动问题",
  "narrative": [
    { "type": "text", "content": "第一段直接进入问题，不做摆拍开场。" },
    { "type": "heading", "content": "一个小节" },
    { "type": "text", "content": "继续展开，保持连续散文。" }
  ],
  "highlight": null,
  "bridge": "下一章承接这里抛出的问题。"
}
```

- [ ] **Step 3: 写 `chapters/c02.json`（含 trace 高光）**

```json
{
  "id": "c02",
  "number": 2,
  "title": "演示",
  "role": "演示机制",
  "narrative": [
    { "type": "text", "content": "展开正文，引出一段代码。" },
    { "type": "code", "content": "print('hi')", "lang": "python" },
    { "type": "text", "content": "解释这段代码做了什么。" }
  ],
  "highlight": { "kind": "trace", "data": { "steps": [] }, "caption": "看它一步步执行", "afterBlock": 1 },
  "bridge": "由演示过渡到转折。"
}
```

- [ ] **Step 4: 写 `chapters/c03.json`（含 bespoke 高光）**

```json
{
  "id": "c03",
  "number": 3,
  "title": "转折",
  "role": "引入反直觉",
  "narrative": [
    { "type": "text", "content": "提出一个让前面结论站不住的反例。" },
    { "type": "callout", "content": "这里是真正的关键洞见。" }
  ],
  "highlight": { "kind": "bespoke", "component": "TokenizerPlayground", "caption": "动手切词", "afterBlock": 0 },
  "bridge": "把转折收束回主线。"
}
```

- [ ] **Step 5: 写 `chapters/c04.json`（末章，bridge=null）**

```json
{
  "id": "c04",
  "number": 4,
  "title": "收束",
  "role": "回到驱动问题给出回答",
  "narrative": [
    { "type": "text", "content": "回到开篇的问题，给出经过推进后的回答。" },
    { "type": "quote", "content": "一句收尾引文。", "cite": "某出处" }
  ],
  "highlight": null,
  "bridge": null
}
```

- [ ] **Step 6: 写 `review/approval.json`**

```json
{ "approved": false, "reviewedBy": "", "reviewedAt": "", "notes": "fixture" }
```

- [ ] **Step 7: 校验 JSON 可解析**

Run: `node -e "for(const f of ['course.json','chapters/c01.json','chapters/c02.json','chapters/c03.json','chapters/c04.json','review/approval.json']){JSON.parse(require('fs').readFileSync('fixtures/essay-min/'+f,'utf8'));console.log('ok',f)}"`
Expected: 6 行 `ok <file>`，无异常。

- [ ] **Step 8: Commit**

```bash
git add fixtures/essay-min
git commit -m "test: add minimal essay-course fixture for data contract"
```

---

### Task 2: 新 TS 类型（增量）

**Files:**
- Modify: `src/lib/types.ts`（文件尾部追加）
- Modify: `src/lib/course-schema.ts`（文件尾部追加）

**Interfaces:**
- Consumes: `src/lib/course-schema.ts` 已有 `CourseStatus`、`CourseLanguage`。
- Produces: `EssayNarrativeBlock`、`EssayBlockType`（types.ts）；`EssayCourse`、`Chapter`、`Highlight`、`CourseRegister`、`CourseOverview`、`HighlightKind`（course-schema.ts）。供 Plan 5 前端阅读器消费。

- [ ] **Step 1: 在 `src/lib/types.ts` 末尾追加**

```ts
export type EssayBlockType = 'text' | 'heading' | 'callout' | 'code' | 'quote';

export interface EssayNarrativeBlock {
  type: EssayBlockType;
  content: string;
  lang?: string; // 仅 type === 'code'
  cite?: string; // 仅 type === 'quote'
}
```

- [ ] **Step 2: 在 `src/lib/course-schema.ts` 末尾追加**

```ts
import type { EssayNarrativeBlock } from '@/lib/types';

export type CourseRegister = 'explainer' | 'essay';
export type HighlightKind = 'bespoke' | 'trace';

export interface CourseOverview {
  whyExists: string;
  wherePoints: string;
  arc: string[];
}

export interface Highlight {
  kind: HighlightKind;
  component?: string; // kind === 'bespoke' 时必填
  data?: Record<string, unknown>; // kind === 'trace' 时必填
  caption: string;
  afterBlock: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  role?: string;
  narrative: EssayNarrativeBlock[];
  highlight?: Highlight | null;
  bridge?: string | null;
}

export interface EssayCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  topic: string;
  language: CourseLanguage;
  status: CourseStatus;
  register: CourseRegister;
  knowledgeType: string;
  drivingQuestion: string;
  centralTension: string;
  overview: CourseOverview;
  chapters: string[];
}
```

> 注：`course-schema.ts` 顶部已有一条 `import type { ... } from '@/lib/types'`。若 lint 要求合并导入，把 `EssayNarrativeBlock` 并入既有那行而非新增一行 import。

- [ ] **Step 3: 类型校验通过**

Run: `npx tsc --noEmit`
Expected: 无输出、退出码 0（无类型错误）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/lib/course-schema.ts
git commit -m "feat: add essay-course TypeScript contract types"
```

---

### Task 3: 引擎加载器 + 编译器

**Files:**
- Create: `engine/essay-course-engine.mjs`
- Create: `engine/essay-course-engine.test.mjs`

**Interfaces:**
- Produces:
  - `loadEssayCoursePackageFromDir(dir) -> source` ；`source = { slug, packageDir, course, chaptersDir, chapterFiles, chapters: [{name,path,data}], reviewApproval, reviewApprovalPath }`
  - `loadEssayCoursePackageBySlug(slug, options?) -> source`
  - `compileEssayCourse(input) -> { ...source, chapters, chapterIds, unresolvedChapterIds, extraChapters, coursePackage, summary }`，`summary = { slug, title, subtitle, status, register, chapterCount, chapterIds }`
  - 这些是 Task 4 `validateEssayCoursePackage` 与 Plan 5 前端的输入。

- [ ] **Step 1: 写失败测试 `engine/essay-course-engine.test.mjs`**

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test engine/essay-course-engine.test.mjs`
Expected: FAIL（`Cannot find module './essay-course-engine.mjs'` 或导出未定义）。

- [ ] **Step 3: 写 `engine/essay-course-engine.mjs`（加载 + 编译部分）**

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test engine/essay-course-engine.test.mjs`
Expected: PASS（2 测试通过）。

- [ ] **Step 5: Commit**

```bash
git add engine/essay-course-engine.mjs engine/essay-course-engine.test.mjs
git commit -m "feat: essay-course engine loader + compiler"
```

---

### Task 4: 引擎校验器

**Files:**
- Modify: `engine/essay-course-engine.mjs`（追加 `summarizeReviewApproval` + `validateEssayCoursePackage`）
- Modify: `engine/essay-course-engine.test.mjs`（追加校验测试）

**Interfaces:**
- Consumes: Task 3 的 `normalizeLoadedSource`、`compileEssayCourse`、`isNonEmptyString`、`isRecord`、`REGISTERS`、`BLOCK_TYPES`、`HIGHLIGHT_KINDS`。
- Produces: `validateEssayCoursePackage(input, options?) -> { ok, promoteReady, publishReady, errors: string[], warnings: string[], summary, reviewApproval }`，`options.requireReviewApproval?: boolean`。供 Task 6 CLI 与 Plan 4 后端导出闸消费。

- [ ] **Step 1: 追加失败测试到 `engine/essay-course-engine.test.mjs`**

```js
import { validateEssayCoursePackage } from './essay-course-engine.mjs';

function loadMut() {
  // 深拷贝 fixture 的 source，便于逐项制造非法数据
  const src = loadEssayCoursePackageFromDir(FIXTURE);
  return JSON.parse(JSON.stringify(src));
}

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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test engine/essay-course-engine.test.mjs`
Expected: FAIL（`validateEssayCoursePackage is not a function`）。

- [ ] **Step 3: 追加实现到 `engine/essay-course-engine.mjs`**

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test engine/essay-course-engine.test.mjs`
Expected: PASS（全部测试通过）。

- [ ] **Step 5: Commit**

```bash
git add engine/essay-course-engine.mjs engine/essay-course-engine.test.mjs
git commit -m "feat: essay-course package validator"
```

---

### Task 5: CLI 校验脚本

**Files:**
- Create: `scripts/validate-essay-course.mjs`

**Interfaces:**
- Consumes: `loadEssayCoursePackageBySlug`、`loadEssayCoursePackageFromDir`、`validateEssayCoursePackage`。
- Produces: 命令行 `node scripts/validate-essay-course.mjs --dir <path> [--slug <slug>] [--json] [--require-review-approval]`，校验通过退出码 0，否则 1。

- [ ] **Step 1: 写 `scripts/validate-essay-course.mjs`**

```js
#!/usr/bin/env node
import {
  loadEssayCoursePackageBySlug,
  loadEssayCoursePackageFromDir,
  validateEssayCoursePackage,
} from '../engine/essay-course-engine.mjs';

function parseArgs(argv) {
  const parsed = { dir: null, slug: null, json: false, requireReviewApproval: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') { parsed.dir = argv[i + 1] ?? null; i += 1; continue; }
    if (arg === '--slug') { parsed.slug = argv[i + 1] ?? null; i += 1; continue; }
    if (arg === '--json') { parsed.json = true; continue; }
    if (arg === '--require-review-approval') { parsed.requireReviewApproval = true; continue; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.dir && parsed.slug) throw new Error('Use either --dir or --slug, not both.');
  return parsed;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
  const source = args.slug
    ? loadEssayCoursePackageBySlug(args.slug)
    : loadEssayCoursePackageFromDir(args.dir ?? process.cwd());
  const result = validateEssayCoursePackage(source, { requireReviewApproval: args.requireReviewApproval });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(JSON.stringify({ ok: result.ok, promoteReady: result.promoteReady, publishReady: result.publishReady, errorCount: result.errors.length, warningCount: result.warnings.length }, null, 2));
  }
  process.exit(result.ok ? 0 : 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
```

- [ ] **Step 2: 跑 fixture 确认通过**

Run: `node scripts/validate-essay-course.mjs --dir fixtures/essay-min`
Expected: 打印 `{ "ok": true, "promoteReady": false, "publishReady": false, "errorCount": 0, "warningCount": 0 }`，退出码 0。

- [ ] **Step 3: 确认非法包退出码 1**

Run: `node scripts/validate-essay-course.mjs --dir fixtures` (上一级，没有 course.json)
Expected: stderr 打印 `Invalid essay course package ...`，退出码 1。

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-essay-course.mjs
git commit -m "feat: essay-course validation CLI"
```

---

### Task 6: Python 规范化器

**Files:**
- Create: `agent-backend/app/essay_schema.py`
- Create: `agent-backend/tests/test_essay_schema.py`

**Interfaces:**
- Produces:
  - `register_for_knowledge_type(knowledge_type: str) -> str`（'essay' for conceptual/strategic/metacognitive，否则 'explainer'）
  - `normalize_essay_plan_payload(payload: dict, *, topic: str, slug: str) -> dict`（产出 §4.1 course 形状）
  - `normalize_chapter_payload(payload: dict, *, chapter_id: str, number: int) -> dict`（产出 §4.2 chapter 形状）
  - `validate_essay_narrative_block(block: dict, index: int) -> dict`
  - 供 Plan 4 后端生成流程消费。

- [ ] **Step 1: 写失败测试 `agent-backend/tests/test_essay_schema.py`**

```python
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from essay_schema import (
    normalize_chapter_payload,
    normalize_essay_plan_payload,
    register_for_knowledge_type,
    validate_essay_narrative_block,
)


class TestRegisterMapping(unittest.TestCase):
    def test_conceptual_is_essay(self):
        self.assertEqual(register_for_knowledge_type("conceptual"), "essay")
        self.assertEqual(register_for_knowledge_type("strategic"), "essay")

    def test_procedural_is_explainer(self):
        self.assertEqual(register_for_knowledge_type("procedural"), "explainer")
        self.assertEqual(register_for_knowledge_type("factual"), "explainer")
        self.assertEqual(register_for_knowledge_type("anything-else"), "explainer")


class TestPlanNormalization(unittest.TestCase):
    def test_fills_register_from_knowledge_type(self):
        plan = {"title": "T", "knowledgeType": "conceptual", "drivingQuestion": "Q?",
                "centralTension": "X", "chapters": ["c01", "c02", "c03", "c04"]}
        result = normalize_essay_plan_payload(plan, topic="哲学", slug="phil")
        self.assertEqual(result["register"], "essay")
        self.assertEqual(result["slug"], "phil")
        self.assertEqual(result["language"], "zh")
        self.assertEqual(result["chapters"], ["c01", "c02", "c03", "c04"])
        self.assertIn("whyExists", result["overview"])

    def test_explicit_register_wins(self):
        plan = {"title": "T", "register": "explainer", "knowledgeType": "conceptual",
                "drivingQuestion": "Q?", "centralTension": "X"}
        result = normalize_essay_plan_payload(plan, topic="t", slug="s")
        self.assertEqual(result["register"], "explainer")


class TestChapterNormalization(unittest.TestCase):
    def test_basic_chapter(self):
        ch = {"title": "立题", "role": "抛问题",
              "narrative": [{"type": "text", "content": "正文"}],
              "bridge": "下一章"}
        result = normalize_chapter_payload(ch, chapter_id="c01", number=1)
        self.assertEqual(result["id"], "c01")
        self.assertEqual(result["number"], 1)
        self.assertEqual(len(result["narrative"]), 1)
        self.assertIsNone(result["highlight"])
        self.assertEqual(result["bridge"], "下一章")

    def test_invalid_block_type_coerced_to_text(self):
        block = validate_essay_narrative_block({"type": "steps", "content": "x"}, 0)
        self.assertEqual(block["type"], "text")

    def test_code_block_keeps_lang(self):
        block = validate_essay_narrative_block({"type": "code", "content": "print(1)", "lang": "python"}, 0)
        self.assertEqual(block["lang"], "python")

    def test_bespoke_highlight_needs_component(self):
        ch = {"title": "t", "narrative": [{"type": "text", "content": "a"}],
              "highlight": {"kind": "bespoke", "caption": "c", "afterBlock": 0}}
        result = normalize_chapter_payload(ch, chapter_id="c02", number=2)
        self.assertIsNone(result["highlight"])  # 缺 component -> 丢弃

    def test_trace_highlight_kept(self):
        ch = {"title": "t", "narrative": [{"type": "text", "content": "a"}],
              "highlight": {"kind": "trace", "data": {"steps": []}, "caption": "c", "afterBlock": 0}}
        result = normalize_chapter_payload(ch, chapter_id="c02", number=2)
        self.assertEqual(result["highlight"]["kind"], "trace")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd agent-backend && python3 -m unittest tests.test_essay_schema -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'essay_schema'`）。

- [ ] **Step 3: 写 `agent-backend/app/essay_schema.py`**

```python
from __future__ import annotations

from typing import Any

REGISTERS = {"explainer", "essay"}
BLOCK_TYPES = {"text", "heading", "callout", "code", "quote"}
HIGHLIGHT_KINDS = {"bespoke", "trace"}
ESSAY_KNOWLEDGE_TYPES = {"conceptual", "strategic", "metacognitive"}


def _s(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _str_list(value: Any) -> list[str]:
    return [str(x).strip() for x in value if str(x).strip()] if isinstance(value, list) else []


def register_for_knowledge_type(knowledge_type: str) -> str:
    return "essay" if _s(knowledge_type).lower() in ESSAY_KNOWLEDGE_TYPES else "explainer"


def normalize_essay_plan_payload(payload: dict[str, Any] | None, *, topic: str, slug: str) -> dict[str, Any]:
    p = payload or {}
    overview = p.get("overview") or {}
    register = _s(p.get("register")) or register_for_knowledge_type(_s(p.get("knowledgeType")))
    if register not in REGISTERS:
        register = "explainer"
    return {
        "id": slug,
        "slug": slug,
        "title": _s(p.get("title")) or topic,
        "subtitle": _s(p.get("subtitle")),
        "topic": topic,
        "language": "zh",
        "status": "draft",
        "register": register,
        "knowledgeType": _s(p.get("knowledgeType")) or "factual",
        "drivingQuestion": _s(p.get("drivingQuestion")),
        "centralTension": _s(p.get("centralTension")),
        "overview": {
            "whyExists": _s(overview.get("whyExists")),
            "wherePoints": _s(overview.get("wherePoints")),
            "arc": _str_list(overview.get("arc")),
        },
        "chapters": [c for c in (_str_list(p.get("chapters")))],
    }


def validate_essay_narrative_block(block: dict[str, Any] | None, index: int) -> dict[str, Any]:
    b = block or {}
    btype = _s(b.get("type")) or "text"
    if btype not in BLOCK_TYPES:
        btype = "text"
    out: dict[str, Any] = {"type": btype, "content": _s(b.get("content"))}
    if btype == "code" and _s(b.get("lang")):
        out["lang"] = _s(b.get("lang"))
    if btype == "quote" and _s(b.get("cite")):
        out["cite"] = _s(b.get("cite"))
    return out


def _normalize_highlight(raw: Any, narrative_len: int) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    kind = _s(raw.get("kind"))
    if kind not in HIGHLIGHT_KINDS:
        return None
    after = raw.get("afterBlock")
    if not isinstance(after, int) or after < 0 or after >= max(narrative_len, 1):
        after = 0
    out: dict[str, Any] = {"kind": kind, "caption": _s(raw.get("caption")), "afterBlock": after}
    if kind == "bespoke":
        if not _s(raw.get("component")):
            return None
        out["component"] = _s(raw.get("component"))
    if kind == "trace":
        if not isinstance(raw.get("data"), dict):
            return None
        out["data"] = raw["data"]
    return out


def normalize_chapter_payload(payload: dict[str, Any] | None, *, chapter_id: str, number: int) -> dict[str, Any]:
    p = payload or {}
    narrative = [validate_essay_narrative_block(b, i) for i, b in enumerate(p.get("narrative") or [])]
    bridge_raw = p.get("bridge")
    bridge = _s(bridge_raw) or None if bridge_raw is not None else None
    return {
        "id": chapter_id,
        "number": number,
        "title": _s(p.get("title")) or f"第 {number} 章",
        "role": _s(p.get("role")),
        "narrative": narrative,
        "highlight": _normalize_highlight(p.get("highlight"), len(narrative)),
        "bridge": bridge,
    }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd agent-backend && python3 -m unittest tests.test_essay_schema -v`
Expected: PASS（全部测试通过）。

- [ ] **Step 5: Commit**

```bash
git add agent-backend/app/essay_schema.py agent-backend/tests/test_essay_schema.py
git commit -m "feat: python essay-schema normalizers"
```

---

### Task 7: 全量测试闸 + 文档登记

**Files:**
- Modify: `docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md`（§13 分期标注 Plan 1 完成）

**Interfaces:**
- Consumes: 前 6 个任务的全部产物。
- Produces: 绿色测试基线，证明契约层不破坏现有套件。

- [ ] **Step 1: 跑既有 + 新增的全部测试**

Run: `npm test`
Expected: `test:node`（旧引擎测试 + 新 `essay-course-engine.test.mjs`）与 `test:python`（旧 `test_normalize.py` 等 + 新 `test_essay_schema.py`）全部 PASS。

- [ ] **Step 2: 确认现有构建未被破坏**

Run: `npm run check`
Expected: 退出码 0（fixture 在 `fixtures/` 而非 `courses/`，旧的 check 脚本只扫 `courses/`，不受影响）。

- [ ] **Step 3: 在 spec §13 标注 Plan 1 完成**

在 `docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md` 的 §13 第 1 条 "后端" 那行前补一句：`> Plan 1（数据契约）已完成：新 schema 的 TS 类型 / JS 引擎 / Python 规范化器 / fixture 就位。`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md
git commit -m "docs: mark Plan 1 (data contract) complete"
```

---

## Self-Review

**1. Spec coverage（本计划只覆盖 spec §4 数据模型这一层）：**
- §4.1 course 脊柱 schema → Task 2（TS）+ Task 6（Python）+ Task 1（fixture）。✅
- §4.2 章节 schema + 删字段 → 新 schema 根本不含旧字段，Task 2/6 只定义新字段。✅
- §4.3 highlight → Task 2（类型）+ Task 4（校验）+ Task 6（规范化）。✅
- §6 register 映射 → Task 6 `register_for_knowledge_type`。✅
- 其余 spec 章节（§5 生成流程、§7 防八股、§8 quality.py、§9 前端、§10 交互、§11 文档+种子、§12 迁移）**不在本计划**，属于后续 Plan 2–6。

**2. Placeholder scan：** 无 TBD/TODO；每个 step 含完整代码或精确命令。✅

**3. Type consistency：** `EssayNarrativeBlock`（types.ts）被 `Chapter.narrative` 引用一致；引擎 `BLOCK_TYPES`/`HIGHLIGHT_KINDS`/`REGISTERS` 与 TS 字面量、Python 集合三处取值一致（text/heading/callout/code/quote；bespoke/trace；explainer/essay）；`validateEssayCoursePackage` 返回的 `errors: string[]` 与测试里 `result.errors.some(...)` 一致。✅

---

## 后续计划路线图（Plan 2–6，共享本 spec）

> 依赖关系：1 是所有计划的地基。可视化产出最早在 Plan 3 + Plan 5 最小切片后出现。

- **Plan 2 — 设计文档改写**：`DESIGN.md` + `design/01–05` 翻转为叙事哲学；重接 `prompt_assets.py:load_design_prompt_principles()` 读新段落。（可与 Plan 1 并行，无代码依赖。）
- **Plan 3 — 金种子**：手写 explainer + essay 各一门种子课（用 Plan 1 契约校验通过；voice 由用户拍板）。依赖 1 + 2 + 用户。
- **Plan 4 — 后端生成引擎**：plan 出脊柱、章节串上一章、双语域、防八股 prompt、LLM 评审闸、`quality.py` 改写、pipeline 线程化、few-shot 取自种子；导出走 Plan 1 校验器。依赖 1–3。
- **Plan 5 — 前端阅读器切换**：拆 12 站为 4 站章节阅读器 + 全景落地页；交互裁到 bespoke + trace；接入 Plan 1 编译器；移除旧阅读路径。依赖 1（可在 Plan 3 后先做最小切片渲染种子以锁定观感）。
- **Plan 6 — 迁移与打磨**：转 llm-fundamentals、重生成、删死课、更新 `scripts/check-*.mjs`、删旧引擎/旧类型、排版、可选课级"领地图"。依赖 4 + 5。
