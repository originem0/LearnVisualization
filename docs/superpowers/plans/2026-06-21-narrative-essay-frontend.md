# 叙事化重构 · 计划 5：Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重设计前端阅读体验，替代"12-station 流水线"为"prose-first 章节渲染器"，新增全景落地页展示课程脊柱，删除作业本站点（ExerciseSection/RetrievalSection/通用交互），保留 bespoke/trace highlights，新路由结构支持章节独立访问。

**Architecture:** 新建 `src/components/chapter/` 和 `src/components/course/` 组件族，与旧 `src/components/module/` 并存。路由层根据 course.register 判断走新/旧渲染器。旧组件暂保留（llm-fundamentals 等旧课依赖），Plan 6 迁移完成后删除。核心改动：(1) ChapterRenderer 替代 ModuleRenderer，(2) CourseOverview 展示 spine，(3) 删除 ExerciseSection/RetrievalSection/ClassifyInteraction/CompareInteraction 等作业本组件，(4) 路由从 `/courses/[courseSlug]/[moduleId]` 改为 `/courses/[courseSlug]` (overview) + `/[chapterId]` (chapter)。

**Tech Stack:** Next.js 14, React 18, TypeScript 5, Tailwind CSS, essay-course-engine.mjs (Plan 1), seed courses (Plan 3 测试数据)。

## Global Constraints

- 新渲染器**增量并存**：不修改 `src/components/module/*` 现有组件，只新建 `chapter/` 和 `course/` 组件族。
- 路由兼容：`src/app/[locale]/courses/[courseSlug]/page.tsx` 根据 course.register 判断展示 CourseOverview (new) 或 CourseIntroDialog (legacy)。
- 布局原则：中心列宽 65ch (optimal reading length)，narrative blocks 连续流动，highlight 作为 aside 或 fullbleed section。
- 响应式设计：mobile-first，章节阅读在小屏优先（桌面端可选显示 TOC sidebar）。
- 保留 bespoke 组件：LLMVisualizer, PostgresIndexTree 等手工组件通过 `InteractionRenderer` 动态加载，trace 组件保留。
- 删除通用交互：ClassifyInteraction, CompareInteraction, RebuildInteraction, ExerciseSection, RetrievalSection 全部删除（作业本观感）。
- Accessibility: 保持键盘导航、ARIA 标签、语义化 HTML。

---

## File Structure

### New Components
- Create: `src/components/chapter/ChapterRenderer.tsx` — Main chapter layout
- Create: `src/components/chapter/NarrativeFlow.tsx` — Prose blocks renderer
- Create: `src/components/chapter/HighlightAside.tsx` — Highlight positioning (bespoke/trace)
- Create: `src/components/chapter/ChapterNav.tsx` — Prev/Next chapter navigation
- Create: `src/components/course/CourseOverview.tsx` — Landing page with spine
- Create: `src/components/course/ChapterArcList.tsx` — Chapter list with arc preview
- Create: `src/components/course/CourseMeta.tsx` — Metadata display (topic/register/status)

### Modified Routes
- Modify: `src/app/[locale]/courses/[courseSlug]/page.tsx` — Add register check
- Modify: `src/app/[locale]/courses/[courseSlug]/[chapterId]/page.tsx` — Add essay-course rendering path

### Deleted Components (mark for deletion, actual deletion in Plan 6)
- Mark: `src/components/module/ExerciseSection.tsx`
- Mark: `src/components/module/RetrievalSection.tsx`
- Mark: `src/components/interactions/ClassifyInteraction.tsx`
- Mark: `src/components/interactions/CompareInteraction.tsx`
- Mark: `src/components/interactions/RebuildInteraction.tsx`

---

### Task 1: Chapter Renderer (Prose-First Layout)

**Files:**
- Create: `src/components/chapter/ChapterRenderer.tsx`

**Interfaces:**
- Consumes: Chapter data from essay-course-engine.mjs
- Produces: Rendered chapter with prose flow + highlights

- [ ] **Step 1: Create ChapterRenderer skeleton**

```tsx
import { Chapter } from '@/lib/course-schema';
import NarrativeFlow from './NarrativeFlow';
import HighlightAside from './HighlightAside';
import ChapterNav from './ChapterNav';

interface ChapterRendererProps {
  chapter: Chapter;
  courseContext: {
    title: string;
    slug: string;
    totalChapters: number;
  };
}

export default function ChapterRenderer({ chapter, courseContext }: ChapterRendererProps) {
  return (
    <article className="max-w-prose mx-auto px-4 py-12">
      {/* Chapter header */}
      <header className="mb-8">
        <div className="text-sm text-gray-500 mb-2">
          第 {chapter.number} 章
        </div>
        <h1 className="text-3xl font-bold mb-2">{chapter.title}</h1>
        {chapter.role && (
          <div className="text-sm text-gray-600 italic">{chapter.role}</div>
        )}
      </header>

      {/* Narrative content */}
      <NarrativeFlow blocks={chapter.narrative} />

      {/* Highlight (if exists) */}
      {chapter.highlight && (
        <HighlightAside highlight={chapter.highlight} />
      )}

      {/* Bridge to next chapter */}
      {chapter.bridge && (
        <aside className="mt-12 p-6 bg-blue-50 rounded-lg border-l-4 border-blue-500">
          <div className="text-sm font-medium text-blue-900 mb-2">下一章</div>
          <p className="text-gray-700">{chapter.bridge}</p>
        </aside>
      )}

      {/* Navigation */}
      <ChapterNav
        currentChapter={chapter.number}
        totalChapters={courseContext.totalChapters}
        courseSlug={courseContext.slug}
      />
    </article>
  );
}
```

**Styling notes:**
- `max-w-prose` = 65ch
- Line height 1.7 for readability
- Font: system sans-serif (not serif — 中文 sans-serif 更清晰)

---

### Task 2: Narrative Flow Renderer

**Files:**
- Create: `src/components/chapter/NarrativeFlow.tsx`

**Interfaces:**
- Consumes: EssayNarrativeBlock[]
- Produces: Rendered prose blocks

- [ ] **Step 1: Implement block renderers**

```tsx
import { EssayNarrativeBlock } from '@/lib/types';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface NarrativeFlowProps {
  blocks: EssayNarrativeBlock[];
}

export default function NarrativeFlow({ blocks }: NarrativeFlowProps) {
  return (
    <div className="prose prose-lg prose-gray max-w-none">
      {blocks.map((block, index) => (
        <NarrativeBlock key={index} block={block} />
      ))}
    </div>
  );
}

function NarrativeBlock({ block }: { block: EssayNarrativeBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="mb-4 leading-relaxed">{block.content}</p>;
      
    case 'heading':
      return <h2 className="text-2xl font-bold mt-8 mb-4">{block.content}</h2>;
      
    case 'callout':
      return (
        <aside className="my-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded">
          <p className="text-gray-800 italic">{block.content}</p>
        </aside>
      );
      
    case 'code':
      return (
        <div className="my-6">
          <SyntaxHighlighter
            language={block.lang || 'text'}
            style={oneDark}
            customStyle={{ borderRadius: '0.5rem', padding: '1.5rem' }}
          >
            {block.content}
          </SyntaxHighlighter>
        </div>
      );
      
    case 'quote':
      return (
        <blockquote className="my-6 pl-6 border-l-4 border-gray-300 italic text-gray-700">
          <p>{block.content}</p>
          {block.cite && (
            <footer className="mt-2 text-sm text-gray-500">— {block.cite}</footer>
          )}
        </blockquote>
      );
      
    default:
      // Unknown block type, render as text (extensibility)
      return <p className="mb-4 text-gray-600">[Unknown block type: {block.type}]</p>;
  }
}
```

**CSS/Tailwind notes:**
- Use `prose` class from @tailwindcss/typography for sensible defaults
- Override line-height to 1.7 (default prose is 1.75, close enough)
- Callout uses amber (warm attention) not blue (cold info)

---

### Task 3: Highlight Positioning

**Files:**
- Create: `src/components/chapter/HighlightAside.tsx`

**Interfaces:**
- Consumes: Highlight object (bespoke or trace)
- Produces: Rendered highlight positioned after specified block

- [ ] **Step 1: Implement highlight wrapper**

```tsx
import { Highlight } from '@/lib/course-schema';
import InteractionRenderer from '@/components/InteractionRenderer';

interface HighlightAsideProps {
  highlight: Highlight;
}

export default function HighlightAside({ highlight }: HighlightAsideProps) {
  if (highlight.kind === 'bespoke') {
    // Bespoke component (LLMVisualizer, PostgresIndexTree, etc.)
    return (
      <aside className="my-12 p-6 bg-white border rounded-lg shadow-sm">
        <div className="text-sm font-medium text-gray-500 mb-4 uppercase tracking-wide">
          Interactive
        </div>
        <InteractionRenderer
          type={highlight.component!}
          data={highlight.data || {}}
        />
        {highlight.caption && (
          <figcaption className="mt-4 text-sm text-gray-600 text-center">
            {highlight.caption}
          </figcaption>
        )}
      </aside>
    );
  }

  if (highlight.kind === 'trace') {
    // Trace visualization (generic component)
    return (
      <aside className="my-12 bg-gray-50 p-6 rounded-lg">
        <div className="text-sm font-medium text-gray-700 mb-4">
          执行 Trace
        </div>
        <InteractionRenderer
          type="ExecutionTrace"
          data={highlight.data || {}}
        />
        {highlight.caption && (
          <figcaption className="mt-4 text-sm text-gray-600">
            {highlight.caption}
          </figcaption>
        )}
      </aside>
    );
  }

  return null;
}
```

**Note:** `afterBlock` positioning handled by inserting highlight between narrative blocks in parent component (ChapterRenderer will need refactor if precise positioning required).

---

### Task 4: Course Overview Landing Page

**Files:**
- Create: `src/components/course/CourseOverview.tsx`

**Interfaces:**
- Consumes: EssayCourse data
- Produces: Landing page with spine + chapter arc

- [ ] **Step 1: Implement CourseOverview**

```tsx
import { EssayCourse } from '@/lib/course-schema';
import ChapterArcList from './ChapterArcList';
import CourseMeta from './CourseMeta';

interface CourseOverviewProps {
  course: EssayCourse;
  chapters: { id: string; title: string; role?: string }[];
}

export default function CourseOverview({ course, chapters }: CourseOverviewProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero section */}
      <header className="mb-12">
        <CourseMeta
          topic={course.topic}
          register={course.register}
          knowledgeType={course.knowledgeType}
          status={course.status}
        />
        
        <h1 className="text-4xl md:text-5xl font-bold mb-4 mt-6">
          {course.title}
        </h1>
        
        {course.subtitle && (
          <p className="text-xl text-gray-600">{course.subtitle}</p>
        )}
      </header>

      {/* Driving question (hero statement) */}
      <section className="mb-12 p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <h2 className="text-lg font-medium text-blue-900 mb-3">这门课要回答</h2>
        <p className="text-2xl font-semibold text-gray-900 leading-relaxed">
          {course.drivingQuestion}
        </p>
      </section>

      {/* Central tension */}
      <section className="mb-12">
        <h2 className="text-lg font-medium text-gray-700 mb-3">为什么这个问题重要</h2>
        <p className="text-lg text-gray-800 leading-relaxed">
          {course.centralTension}
        </p>
      </section>

      {/* Overview */}
      <section className="mb-12 prose prose-lg">
        <h2 className="text-lg font-medium text-gray-700 mb-3">你会学到什么</h2>
        <p className="text-gray-700 mb-4">{course.overview.whyExists}</p>
        <p className="text-gray-700 mb-4">{course.overview.wherePoints}</p>
      </section>

      {/* Chapter arc */}
      <section>
        <h2 className="text-lg font-medium text-gray-700 mb-6">叙事弧线</h2>
        <ChapterArcList
          arc={course.overview.arc}
          chapters={chapters}
          courseSlug={course.slug}
        />
      </section>
    </div>
  );
}
```

---

### Task 5: Chapter Arc List

**Files:**
- Create: `src/components/course/ChapterArcList.tsx`

**Interfaces:**
- Consumes: arc strings + chapter metadata
- Produces: Interactive chapter list

- [ ] **Step 1: Implement chapter list**

```tsx
import Link from 'next/link';

interface ChapterArcListProps {
  arc: string[];
  chapters: { id: string; title: string; role?: string }[];
  courseSlug: string;
}

export default function ChapterArcList({ arc, chapters, courseSlug }: ChapterArcListProps) {
  return (
    <ol className="space-y-4">
      {chapters.map((chapter, index) => (
        <li key={chapter.id}>
          <Link
            href={`/courses/${courseSlug}/${chapter.id}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-grow">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {chapter.title}
                </h3>
                {chapter.role && (
                  <div className="text-sm text-gray-500 mb-2 italic">
                    {chapter.role}
                  </div>
                )}
                <p className="text-gray-600">
                  {arc[index]}
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

---

### Task 6: Route Integration

**Files:**
- Modify: `src/app/[locale]/courses/[courseSlug]/page.tsx`
- Modify: `src/app/[locale]/courses/[courseSlug]/[chapterId]/page.tsx`

**Interfaces:**
- Consumes: Route params, data from engine
- Produces: Rendered pages

- [ ] **Step 1: Update course landing page**

```tsx
// src/app/[locale]/courses/[courseSlug]/page.tsx
import { loadEssayCoursePackageFromDir } from '@/engine/essay-course-engine.mjs';
import { loadCoursePackageFromDir } from '@/engine/course-package-engine.mjs';
import CourseOverview from '@/components/course/CourseOverview';
import LegacyCoursePage from '@/components/module/LegacyCoursePage'; // Old renderer

export default async function CoursePage({ params }: { params: { courseSlug: string } }) {
  const courseDir = `courses/${params.courseSlug}`;

  // Try loading as essay-course first
  try {
    const pkg = await loadEssayCoursePackageFromDir(courseDir);
    const course = pkg.course;
    
    if (course.register === 'explainer' || course.register === 'essay') {
      // New renderer
      return <CourseOverview course={course} chapters={pkg.chapters} />;
    }
  } catch (e) {
    // Not an essay-course, fall back to legacy
  }

  // Legacy renderer
  const legacyPkg = await loadCoursePackageFromDir(courseDir);
  return <LegacyCoursePage course={legacyPkg.course} modules={legacyPkg.modules} />;
}
```

- [ ] **Step 2: Update chapter page**

```tsx
// src/app/[locale]/courses/[courseSlug]/[chapterId]/page.tsx
import { loadEssayCoursePackageFromDir } from '@/engine/essay-course-engine.mjs';
import ChapterRenderer from '@/components/chapter/ChapterRenderer';
import ModuleRenderer from '@/components/module/ModuleRenderer'; // Old renderer

export default async function ChapterPage({ params }: {
  params: { courseSlug: string; chapterId: string }
}) {
  const courseDir = `courses/${params.courseSlug}`;

  // Try essay-course
  try {
    const pkg = await loadEssayCoursePackageFromDir(courseDir);
    const chapter = pkg.chapters.find(c => c.id === params.chapterId);
    
    if (chapter && pkg.course.register) {
      return (
        <ChapterRenderer
          chapter={chapter}
          courseContext={{
            title: pkg.course.title,
            slug: pkg.course.slug,
            totalChapters: pkg.chapters.length
          }}
        />
      );
    }
  } catch (e) {
    // Fall back to legacy
  }

  // Legacy module rendering
  const legacyPkg = await loadCoursePackageFromDir(courseDir);
  const module = legacyPkg.modules.find(m => m.id === params.chapterId);
  return <ModuleRenderer module={module!} course={legacyPkg.course} />;
}
```

---

### Task 7: Delete作业本组件（标记待删）

**Files:**
- Create: `docs/to-delete-after-migration.md` — List components to delete in Plan 6

**Content:**
```markdown
# Components to Delete After Migration (Plan 6)

These components are part of the old "12-station pedagogical checklist" renderer and will be deleted once all courses are migrated to essay-course model.

## Exercise/Retrieval Sections
- `src/components/module/ExerciseSection.tsx`
- `src/components/module/RetrievalSection.tsx`
- `src/components/module/RetrievalCard.tsx`

## Generic Interactions (作业本观感)
- `src/components/interactions/ClassifyInteraction.tsx`
- `src/components/interactions/CompareInteraction.tsx`
- `src/components/interactions/RebuildInteraction.tsx`

## Module-Specific Stations
- `src/components/module/FocusPanel.tsx` (replaced by CourseOverview drivingQuestion)
- `src/components/module/MisconceptionOpening.tsx` (no equivalent in essay-course)
- `src/components/module/ConceptMapSection.tsx` (optional in Phase 4)

## Keep (Bespoke Highlights)
- `src/components/interactions/bespoke/LLMVisualizer.tsx`
- `src/components/interactions/bespoke/PostgresIndexTree.tsx`
- `src/components/interactions/ExecutionTrace.tsx` (trace kind)
```

---

### Task 8: Responsive & A11y

**Files:**
- Modify: `src/components/chapter/ChapterRenderer.tsx`

- [ ] **Step 1: Add mobile navigation**

```tsx
// Add mobile-friendly chapter nav
<ChapterNav
  currentChapter={chapter.number}
  totalChapters={courseContext.totalChapters}
  courseSlug={courseContext.slug}
  className="md:hidden" // Show on mobile, optional on desktop
/>
```

- [ ] **Step 2: Add ARIA labels**

```tsx
<article aria-labelledby="chapter-title">
  <header>
    <h1 id="chapter-title" className="...">
      {chapter.title}
    </h1>
  </header>
  <nav aria-label="Chapter navigation">
    <ChapterNav ... />
  </nav>
</article>
```

- [ ] **Step 3: Add skip link**

```tsx
// In ChapterRenderer, add skip to content
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded"
>
  跳转到内容
</a>
<main id="main-content">
  {/* Chapter content */}
</main>
```

---

### Task 9: Test with Seed Courses

**Files:**
- Create: `src/__tests__/chapter-renderer.test.tsx`

**Dependencies:** Plan 3 seed courses

- [ ] **Step 1: Visual regression test**

```bash
# Start dev server
npm run dev

# Open seed-explainer
open http://localhost:3000/courses/seed-explainer

# Open seed-essay
open http://localhost:3000/courses/seed-essay
```

**Manual checklist:**
- [ ] CourseOverview 正确展示 drivingQuestion/centralTension/overview
- [ ] ChapterArcList 可点击跳转
- [ ] ChapterRenderer 正确渲染 text/heading/code/callout/quote blocks
- [ ] Highlight (trace/bespoke) 正确定位
- [ ] Bridge 显示在章节底部
- [ ] ChapterNav 导航工作
- [ ] Mobile 布局无横向滚动
- [ ] 键盘可导航（Tab 顺序合理）

- [ ] **Step 2: Snapshot test**

```tsx
// src/__tests__/chapter-renderer.test.tsx
import { render } from '@testing-library/react';
import ChapterRenderer from '@/components/chapter/ChapterRenderer';

test('renders chapter with narrative blocks', () => {
  const chapter = {
    id: 'c01',
    number: 1,
    title: '测试章节',
    role: 'unfold',
    narrative: [
      { type: 'text', content: '第一段' },
      { type: 'heading', content: '小标题' },
      { type: 'text', content: '第二段' }
    ],
    highlight: null,
    bridge: '下一章预告'
  };

  const { container } = render(
    <ChapterRenderer
      chapter={chapter}
      courseContext={{ title: '测试课程', slug: 'test', totalChapters: 5 }}
    />
  );

  expect(container).toMatchSnapshot();
});
```

Run: `npm test`

---

### Task 10: Commit & Mark Complete

- [ ] **Step 1: Run linter & type check**

```bash
npm run lint
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Build test**

```bash
npm run build
```

Expected: Build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/chapter src/components/course src/app/[locale]/courses docs/to-delete-after-migration.md
git commit -m "feat: essay-course frontend renderer

- ChapterRenderer with prose-first layout (65ch, narrative flow)
- CourseOverview landing page (spine + arc)
- NarrativeFlow handles text/heading/code/callout/quote blocks
- HighlightAside positions bespoke/trace interactions
- Route integration: register-based renderer switching
- Mobile-responsive + ARIA labels
- Tested with seed-explainer and seed-essay

Deletes (marked for Plan 6):
- ExerciseSection, RetrievalSection
- ClassifyInteraction, CompareInteraction, RebuildInteraction

Depends on Plan 1 (schema), Plan 3 (seed test data)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 4: Update design spec**

Mark Plan 5 complete in `docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md` §13.

---

## Dependencies

- **Depends on:** Plan 1 (Data Contract) — essay-course-engine.mjs loader
- **Depends on:** Plan 3 (Seeds) — Test data for visual verification
- **Enables:** Plan 6 (Migration) — Frontend ready to render migrated courses

---

## Notes

- **旧组件保留**：`src/components/module/*` 暂不删除，llm-fundamentals 等旧课依赖。Plan 6 迁移完成后一并清理。
- **Highlight 定位**：当前实现 highlight 在章节底部，如需精确定位（afterBlock），需在 NarrativeFlow 中插入 highlight 节点（复杂度增加，暂不实现）。
- **TOC Sidebar**：桌面端可选添加章节内 TOC（根据 heading blocks 生成），列为可选优化。
- **Dark Mode**：当前未实现，可在 Phase 4 打磨阶段添加。
- **Bespoke 组件迁移**：LLMVisualizer 等现有 bespoke 组件无需修改，通过 InteractionRenderer 动态加载即可。
- **性能优化**：如课程章节多（>10），考虑章节列表虚拟滚动；当前 4–6 章无需优化。
