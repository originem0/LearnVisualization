# Essay 阅读体验重做（Reading Experience）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** essay 课程按语域分家排版（随笔衬线 17.5px/40rem、技术 sans 16px/42rem+宽块外溢），三种语义块视觉分离，章节页头去 role 加阅读时长与进度条，课程首页 hero 重排，移动端章节条，重试按钮语义说明。

**Architecture:** 纯前端 + CSS。essay 页面脱离与 legacy 共享的 `.prose-custom`，改用新 `.essay-prose` + `.register-essay/.register-explainer` 类族；quote/callout 在 essay 渲染链内用专属组件（不动共享的 NarrativeRenderer，legacy 零影响）；阅读时长/进度条/章节条为渲染器内小组件。

**Tech Stack:** Next.js 14 + TypeScript + Tailwind + 原生 CSS 变量。零新依赖、零 webfont、零数据结构变更。

**设计文档:** `docs/superpowers/specs/2026-07-11-reading-experience-design.md`

## Global Constraints

- 只改 essay 课渲染链；**legacy 四门手写课零接触**（共享文件 NarrativeRenderer.tsx、`.prose-custom` 规则不得修改）
- 零新依赖、零 webfont 下载；衬线用系统栈 `"Noto Serif SC","Source Han Serif SC","Songti SC","SimSun",serif`
- 验证命令：`npx tsc --noEmit`（每 Task）；最终 `npm run check && npm run build`（prerender smoke 必须过）
- 每 Task 结束 commit；message 末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 只 `git add` 各 Task 明列文件；不提交 `.claude/settings.local.json`
- 分支 `reading-experience`（已创建）

---

## File Structure

- `src/app/globals.css` — 新增 `.essay-prose` / `.register-essay` / `.register-explainer` / `.font-serif-sc` 规则（追加，不改既有规则）
- `src/components/essay/EssayChapterRenderer.tsx` — 接收 register/index/total，语域版式、语义块路由、页头、章节条、bridge、sources 锚点
- `src/components/essay/ReadingProgress.tsx` — 新建，2px 顶部阅读进度条
- `src/app/[locale]/courses/[courseSlug]/[slug]/page.tsx` — 调用点传新 props
- `src/app/[locale]/courses/[courseSlug]/page.tsx` — EssayCourseHomePage hero 重排 + arc 顺序
- `src/components/GenerateForm.tsx` — 重试按钮文案 + 说明句

---

### Task 1: 语域版式基础（CSS 类族 + 渲染器接线）

**Files:**
- Modify: `src/app/globals.css`（文件末尾追加）
- Modify: `src/components/essay/EssayChapterRenderer.tsx`
- Modify: `src/app/[locale]/courses/[courseSlug]/[slug]/page.tsx`

**Interfaces:**
- Produces: `EssayChapterRendererProps` 新增 `register: 'essay' | 'explainer'; index: number; total: number;`（Task 3 消费 index/total）
- Produces: CSS 类 `.essay-prose`（块间距基础）、`.register-essay`（衬线 17.5px/1.95）、`.register-explainer`（16px/1.8）、`.font-serif-sc`（Task 4 消费）
- Produces: 渲染器内 `WIDE_BLOCK_TYPES = new Set(['code', 'diagram', 'comparison', 'steps'])` 与按语域的测宽结构（essay 全文 40rem；explainer 外层 52rem、窄块内层 42rem）

- [ ] **Step 1: globals.css 追加类族**

文件末尾追加（不动任何既有规则，尤其 `.prose-custom`）：

```css
/* =====================================================
   Essay reading experience — register-scoped typography
   (essay courses only; legacy uses .prose-custom untouched)
   ===================================================== */

.font-serif-sc {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
}

.essay-prose > * + * {
  margin-top: 1.1em;
}

.register-essay .essay-body {
  font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "SimSun", serif;
  font-size: 1.09375rem; /* 17.5px */
  line-height: 1.95;
}

.register-explainer .essay-body {
  font-size: 1rem; /* 16px */
  line-height: 1.8;
}

/* 章内小标题：三档层级的中档，压过任何继承 */
.essay-body h2.essay-heading {
  font-size: 1.25rem; /* 20px */
  font-weight: 600;
  line-height: 1.5;
  margin-top: 2.5em;
  margin-bottom: 0.9em;
}

@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
```

- [ ] **Step 2: 渲染器接收语域并重构测宽结构**

`EssayChapterRenderer.tsx`：Props 接口与函数签名改为：

```typescript
interface EssayChapterRendererProps {
  chapter: Chapter;
  prev?: Chapter;
  next?: Chapter;
  locale: Locale;
  basePath: string;
  register: 'essay' | 'explainer';
  index: number;
  total: number;
}

export default function EssayChapterRenderer({ chapter, prev, next, locale, basePath, register, index, total }: EssayChapterRendererProps) {
```

（`register` 类型来自 `CourseRegister`——如果 course-schema 导出该类型则 `import type { CourseRegister }` 并用之；否则用字面量联合。）

组件顶部加常量与工具：

```typescript
const WIDE_BLOCK_TYPES = new Set(['code', 'diagram', 'comparison', 'steps']);
```

article 结构改为（替换现 `<article className="mx-auto max-w-[54rem] pb-12">` 与正文容器；header/bridge/sources/nav 本 Task 保持原内容，只包进新结构）：

```tsx
  const isEssay = register === 'essay';
  const articleWidth = isEssay ? 'max-w-[40rem]' : 'max-w-[52rem]';
  const measure = isEssay ? '' : 'mx-auto max-w-[42rem]';

  return (
    <article className={`register-${register} mx-auto ${articleWidth} pb-12`}>
      <header className={`border-b border-[color:var(--color-border)] pb-6 ${measure}`}>
        {/* 本 Task 保持原 header 内容（含 role），Task 3 再改 */}
        ...
      </header>

      <div className="essay-body essay-prose py-8">
        {chapter.narrative.map((block, blockIndex) => {
          const wide = !isEssay && WIDE_BLOCK_TYPES.has(block.type);
          return (
            <div key={`${chapter.id}-${blockIndex}`} className={wide ? '' : measure}>
              <NarrativeBlockRenderer block={toNarrativeBlock(block)} />
              {chapter.highlight && chapter.highlight.afterBlock === blockIndex ? renderHighlight(chapter.highlight) : null}
            </div>
          );
        })}
      </div>
      {/* bridge/sources/nav 原样保留，外层套 ${measure}（explainer 下与正文对齐） */}
```

（bridge、sources、nav 三个既有区块各自包一层 `<div className={measure}>`，essay 下 measure 为空串不影响。原 `prose-custom py-7` 类删除——essay 页不再吃 `.prose-custom` 的 h2 覆盖，CSS 打架就此解决。）

- [ ] **Step 3: 调用点传参**

`[slug]/page.tsx` 的 essay 分支（已有 `index`/`pkg` 变量）：

```tsx
    return (
      <EssayChapterRenderer
        chapter={chapter}
        prev={prev}
        next={next}
        locale={locale}
        basePath={basePath}
        register={pkg.register}
        index={index}
        total={pkg.chapters.length}
      />
    );
```

- [ ] **Step 4: 验证**

Run: `npx tsc --noEmit && npm run check`
Expected: 均通过。

目检（构建或 dev 皆可，报告里描述即可）：essay 课正文为衬线且列宽明显变窄；heading 块因脱离 `.prose-custom` 恢复 `text-xl`（20px）。

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/essay/EssayChapterRenderer.tsx "src/app/[locale]/courses/[courseSlug]/[slug]/page.tsx"
git commit -m "Register-scoped typography for essay chapters"
```

---

### Task 2: 三种语义块分家（quote/callout/bridge + sources 锚点）

**Files:**
- Modify: `src/components/essay/EssayChapterRenderer.tsx`

**Interfaces:**
- Consumes: Task 1 的结构（essay-body、measure、WIDE_BLOCK_TYPES）
- Produces: 本文件内组件 `EssayQuote({ content, cite })`、`EssayCallout({ content })`；sources 区 `id="chapter-sources"`；bridge 章末过渡段样式

- [ ] **Step 1: 块路由**

narrative map 内，quote 与 callout 不再交给 NarrativeBlockRenderer（**不改 NarrativeRenderer.tsx**——它被 legacy 共享）：

```tsx
        {chapter.narrative.map((block, blockIndex) => {
          const wide = !isEssay && WIDE_BLOCK_TYPES.has(block.type);
          let rendered: ReactNode;
          if (block.type === 'quote') {
            rendered = <EssayQuote content={block.content} cite={block.cite} />;
          } else if (block.type === 'callout') {
            rendered = <EssayCallout content={block.content} />;
          } else {
            rendered = <NarrativeBlockRenderer block={toNarrativeBlock(block)} />;
          }
          return (
            <div key={`${chapter.id}-${blockIndex}`} className={wide ? '' : measure}>
              {rendered}
              {chapter.highlight && chapter.highlight.afterBlock === blockIndex ? renderHighlight(chapter.highlight) : null}
            </div>
          );
        })}
```

（顶部 `import type { ReactNode } from 'react';`。）

- [ ] **Step 2: EssayQuote —— 机器担保引文的仪式感**

文件底部加：

```tsx
function EssayQuote({ content, cite }: { content: string; cite?: string }) {
  return (
    <figure className="relative my-2 pl-6">
      <span
        aria-hidden="true"
        className="font-serif-sc absolute -left-1 -top-3 select-none text-5xl leading-none text-[color:var(--color-accent)]/30"
      >
        “
      </span>
      <blockquote className="font-serif-sc text-[1.15em] leading-[1.9] text-[color:var(--color-text)]">
        {content}
      </blockquote>
      {cite ? (
        <figcaption className="mt-2 text-sm text-[color:var(--color-muted)]">
          —— <a href="#chapter-sources" className="underline decoration-dotted underline-offset-4 hover:text-[color:var(--color-text)]">{cite}</a>
        </figcaption>
      ) : null}
    </figure>
  );
}
```

- [ ] **Step 3: EssayCallout —— 浅色卡片，与引文断开血缘**

```tsx
function EssayCallout({ content }: { content: string }) {
  return (
    <aside className="my-2 rounded-xl border border-[color:var(--color-accent)]/15 bg-[color:var(--color-accent)]/[0.06] px-5 py-4">
      <p className="text-[0.95em] font-medium leading-[1.8] text-[color:var(--color-text)]">{content}</p>
    </aside>
  );
}
```

- [ ] **Step 4: bridge 变章末过渡段**

替换现有 bridge 区块（左边线样式删除）：

```tsx
      {chapter.bridge ? (
        <div className={measure}>
          <div className="mt-12 flex justify-center" aria-hidden="true">
            <span className="w-12 border-t border-[color:var(--color-border)]" />
          </div>
          <p className="essay-body mx-auto mt-6 max-w-[36rem] text-center text-[color:var(--color-muted)]">
            {chapter.bridge}
          </p>
        </div>
      ) : null}
```

- [ ] **Step 5: sources 加锚点**

sources `<section>` 加 `id="chapter-sources"` 与 `scroll-mt-20`（避免被 sticky header 遮挡）：

```tsx
        <section id="chapter-sources" className="mt-10 scroll-mt-20 border-t border-[color:var(--color-border)] pt-5">
```

- [ ] **Step 6: 验证 + Commit**

Run: `npx tsc --noEmit && npm run check`
Expected: 通过。目检：引文有悬挂大引号+衬线放大、callout 是背景卡、bridge 居中过渡、点 cite 平滑滚到参考资料。

```bash
git add src/components/essay/EssayChapterRenderer.tsx
git commit -m "Distinct visual treatments for quote, callout, and bridge"
```

---

### Task 3: 章节页头（去 role + 元信息 + 进度条 + 移动章节条）

**Files:**
- Create: `src/components/essay/ReadingProgress.tsx`
- Modify: `src/components/essay/EssayChapterRenderer.tsx`

**Interfaces:**
- Consumes: Task 1 的 `index`/`total` props
- Produces: `ReadingProgress`（无 props，2px 固定顶条）；`estimateMinutes(chapter: Chapter): number`

- [ ] **Step 1: ReadingProgress 组件**

新建 `src/components/essay/ReadingProgress.tsx`：

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      setProgress(scrollable > 0 ? Math.min(100, (doc.scrollTop / scrollable) * 100) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div aria-hidden="true" className="fixed left-0 top-0 z-50 h-[2px] w-full bg-transparent">
      <div
        className="h-full bg-[color:var(--color-accent)] transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 阅读时长估算**

EssayChapterRenderer.tsx 加（模块级函数）：

```typescript
function estimateMinutes(chapter: Chapter): number {
  const chars = chapter.narrative.reduce((sum, block) => sum + (block.content?.length || 0), 0);
  return Math.max(1, Math.ceil(chars / 400));
}
```

- [ ] **Step 3: 页头重写（删 role）+ 移动章节条**

header 区块整体替换（含 Task 1 里暂留的 role）：

```tsx
      <ReadingProgress />

      {/* 移动端章节条：<xl 时侧栏不可见 */}
      <nav className={`mb-4 flex items-center justify-between gap-2 text-sm text-[color:var(--color-muted)] xl:hidden ${measure}`}>
        {prev ? (
          <Link href={`${basePath}/${prev.id}/`} className="shrink-0 hover:text-[color:var(--color-text)]">←</Link>
        ) : <span className="w-4" />}
        <span className="truncate font-mono text-xs uppercase tracking-[0.16em]">
          {chapter.id} · {isZh ? `第 ${index + 1}/${total} 章` : `Ch. ${index + 1}/${total}`}
        </span>
        {next ? (
          <Link href={`${basePath}/${next.id}/`} className="shrink-0 hover:text-[color:var(--color-text)]">→</Link>
        ) : <span className="w-4" />}
      </nav>

      <header className={`border-b border-[color:var(--color-border)] pb-6 ${measure}`}>
        <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {chapter.id} · {isZh ? `第 ${index + 1}/${total} 章` : `Chapter ${index + 1}/${total}`} · {isZh ? `约 ${estimateMinutes(chapter)} 分钟` : `~${estimateMinutes(chapter)} min`}
        </div>
        <h1 className={`mt-3 text-[1.75rem] font-bold leading-snug tracking-tight text-[color:var(--color-text)] sm:text-[2rem] ${isEssay ? 'font-serif-sc' : ''}`}>
          {chapter.title}
        </h1>
      </header>
```

顶部 `import ReadingProgress from '@/components/essay/ReadingProgress';`。

- [ ] **Step 4: 验证 + Commit**

Run: `npx tsc --noEmit && npm run check`
Expected: 通过。目检：页头无 role、显示"第 x/y 章 · 约 N 分钟"；滚动时顶部进度条前进；窄窗口出现 ←/→ 章节条。

```bash
git add src/components/essay/ReadingProgress.tsx src/components/essay/EssayChapterRenderer.tsx
git commit -m "Chapter header meta, reading progress, and mobile chapter bar"
```

---

### Task 4: 课程首页 hero 重排

**Files:**
- Modify: `src/app/[locale]/courses/[courseSlug]/page.tsx`（仅 EssayCourseHomePage 函数）

**Interfaces:**
- Consumes: `.font-serif-sc`（Task 1）；pkg.title / pkg.subtitle / pkg.drivingQuestion / pkg.overview.arc

- [ ] **Step 1: hero 区块替换**

EssayCourseHomePage 的第一个 `<section>` 整体替换：

```tsx
      <section className="border-b border-[color:var(--color-border)] pb-10">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-muted)]">
          {pkg.register === 'essay' ? (isZh ? '叙事随笔课' : 'Narrative essay') : (isZh ? '技术解说课' : 'Explainer course')}
        </div>
        <h1 className="font-serif-sc mt-4 text-3xl font-bold leading-tight tracking-tight text-[color:var(--color-text)] sm:text-4xl">
          {pkg.title}
        </h1>
        {pkg.subtitle ? (
          <p className="mt-3 text-lg text-[color:var(--color-muted)]">{pkg.subtitle}</p>
        ) : null}
        <p className="font-serif-sc mt-7 max-w-[40rem] border-l-2 border-[color:var(--color-accent)]/40 pl-5 text-[1.25rem] leading-[1.9] text-[color:var(--color-text)]">
          {pkg.drivingQuestion}
        </p>
        {firstChapter ? (
          <Link
            href={`${basePath}/${firstChapter.id}/`}
            className="mt-8 inline-flex rounded-lg bg-[color:var(--color-text)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-bg)] transition-opacity hover:opacity-90"
          >
            {isZh ? '开始第一章' : 'Start chapter 1'}
          </Link>
        ) : null}
      </section>
```

（centralTension 原来展示在 hero，信息与 whyExists 高度重叠——从 hero 移除，"为什么存在"栏目已承载它。）

- [ ] **Step 2: 旅程列表 arc 优先**

章节卡片描述行交换回退顺序：

```tsx
                <span className="mt-1 block text-sm leading-6 text-[color:var(--color-muted)]">
                  {pkg.overview.arc[index] || chapter.role || ''}
                </span>
```

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit && npm run check`
Expected: 通过。目检：h1 是课程标题（衬线），驱动问题为 20px 引题块，旅程描述来自 arc。

```bash
git add "src/app/[locale]/courses/[courseSlug]/page.tsx"
git commit -m "Course home hero: title as h1, driving question as standfirst"
```

---

### Task 5: 重试按钮语义 + 文档 + 全量验证

**Files:**
- Modify: `src/components/GenerateForm.tsx`（failed 卡片）
- Modify: `docs/superpowers/specs/2026-07-11-reading-experience-design.md`（状态行）
- 最终验证 + 构建

- [ ] **Step 1: 重试按钮与说明**

failed 卡片（`if (job.status === 'failed')` 分支）：按钮行上方加说明句、按钮文案改：

```tsx
        <p className="text-xs text-[color:var(--color-danger)] line-clamp-3">{message}</p>
        <p className="text-[11px] leading-4 text-[color:var(--color-muted)]">
          {isZh
            ? '重试将从失败阶段继续：已完成的研究、规划与章节不会重跑。'
            : 'Retry resumes from the failed stage; finished research, plan, and chapters are reused.'}
        </p>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onRetry} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重试（复用研究与规划）' : 'Retry (reuse research & plan)'}
          </button>
```

（重新生成/删除按钮不动。）

- [ ] **Step 2: 设计文档状态**

`docs/superpowers/specs/2026-07-11-reading-experience-design.md`：`状态：已获用户批准` → `状态：已实施（2026-07-11）`。

- [ ] **Step 3: 全量验证**

Run: `npx tsc --noEmit && npm run check && npm run build 2>&1 | tail -3`
Expected: 全部通过，`Prerender smoke checks passed`。

- [ ] **Step 4: Commit**

```bash
git add src/components/GenerateForm.tsx docs/superpowers/specs/2026-07-11-reading-experience-design.md
git commit -m "Clarify retry semantics and mark reading spec implemented"
```

- [ ] **Step 5: 目检清单（手动，控制器）**

构建产物或 dev 下检查（光/暗两态各一遍）：
1. `zh/courses/nietzsche-open/c01`：衬线正文、约 36 字/行、引文悬挂引号、callout 背景卡、章末过渡段、页头"c01 · 第 1/5 章 · 约 N 分钟"、进度条、cite 点击滚动到参考资料
2. `zh/courses/nietzsche-open`：标题 h1 + 副题 + 引题块、旅程用 arc 文案
3. 窄窗口（<1280px）：顶部 ←/→ 章节条出现
4. legacy 课程任一模块页：**渲染与改动前一致**（.prose-custom 未动）
5. 暗色下衬线笔画对比度可读

---

## Self-Review 记录

- 规格覆盖：spec 8 节 → Task 1（§1 版式+§3 CSS 打架，脱离 prose-custom 即修复）、Task 2（§2 三块分家+cite 滚动）、Task 3（§4 页头/时长/进度条 + §6 移动条）、Task 4（§5 hero）、Task 5（§7 重试 + 文档）；§8 不做的均未出现
- Legacy 隔离：NarrativeRenderer.tsx 与 `.prose-custom` 全程未列入任何 Task 的 Modify——quote/callout 在 essay 渲染器内用专属组件路由
- 类型一致：`register: 'essay' | 'explainer'` / `index` / `total` 在 Task 1 定义、Task 3 消费；`measure`/`WIDE_BLOCK_TYPES`/`isEssay` 在 Task 1 定义、Task 2/3 使用；`.font-serif-sc` Task 1 定义、Task 2/4 使用
- 占位符扫描：Task 1 Step 2 header 处的 "..." 是"保持原内容"的显式标注（原文在文件里，Task 3 重写它）——补一句明确指令避免歧义 ✅（已写"本 Task 保持原 header 内容（含 role），Task 3 再改"）
- 无测试代码新增：纯视觉层，现有 node/python 套件不受影响；验证靠 tsc/check/build + 目检清单
