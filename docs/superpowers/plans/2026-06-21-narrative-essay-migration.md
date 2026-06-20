# 叙事化重构 · 计划 6：Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 迁移现有课程到新 essay-course 模型，保留唯一高质量课程（llm-fundamentals），重生成其他课程，删除死课（draft/低质量），清理未使用的旧组件和 bespoke 交互。完成后系统只保留新模型，旧引擎可安全删除。

**Architecture:** 三轨并行：(1) llm-fundamentals 手工迁移（保留 LLMVisualizer 等 bespoke 组件），(2) 其他课程用 Plan 4 后端引擎重生成，(3) 死课直接删除目录。迁移完成后，删除 `engine/course-package-engine.mjs`、`src/components/module/*`、`agent-backend/app/models.py` 等旧系统组件。

**Tech Stack:** Plan 4 后端引擎（重生成）、手工内容迁移（llm-fundamentals）、文件系统操作（删除）。

## Global Constraints

- **保留课程标准**：只保留 status: "published" 且有实质内容的课程。
- **llm-fundamentals 特殊处理**：唯一手工迁移课程（已有优质 bespoke 交互），不重生成。
- **重生成课程列表**：Golang, Python, English Grammar 等（需用户确认哪些值得保留）。
- **死课删除标准**：status: "draft"、narrative 质量差、无独特价值的课程。
- **Bespoke 组件保留判断**：LLMVisualizer, PostgresIndexTree 等被 llm-fundamentals 使用的保留；ClassifyInteraction, CompareInteraction 等通用交互删除。
- **迁移后验证**：每门课通过 `scripts/validate-essay-course.mjs`，前端可访问无报错。

---

## File Structure

### Migration Artifacts
- Create: `docs/migration/course-inventory.md` — 现有课程清单 + 处理决策
- Create: `docs/migration/llm-fundamentals-migration-log.md` — llm-fundamentals 迁移日志
- Create: `scripts/regenerate-course.mjs` — 重生成课程自动化脚本

### Modified/Deleted
- Delete: `courses/course-*` (dead courses)
- Migrate: `courses/llm-fundamentals/` → essay-course format
- Regenerate: `courses/golang/`, `courses/python/`, `courses/english-grammar/`
- Delete: `engine/course-package-engine.mjs` (legacy engine)
- Delete: `src/components/module/*` (legacy renderer)
- Delete: `agent-backend/app/models.py` (legacy models, keep essay_models.py)
- Delete: `src/components/interactions/ClassifyInteraction.tsx` (等作业本组件)

---

### Task 1: Course Inventory & Decision Matrix

**Files:**
- Create: `docs/migration/course-inventory.md`

**Interfaces:**
- Produces: Migration decision for each existing course

- [ ] **Step 1: List all existing courses**

```bash
cd courses
for dir in */; do
  course_id=$(basename "$dir")
  status=$(jq -r '.status' "$dir/course.json" 2>/dev/null || echo "unknown")
  title=$(jq -r '.title' "$dir/course.json" 2>/dev/null || echo "unknown")
  module_count=$(ls -1 "$dir/modules/" 2>/dev/null | wc -l)
  echo "$course_id | $status | $title | $module_count modules"
done > ../docs/migration/course-list.txt
```

- [ ] **Step 2: Categorize courses**

在 `docs/migration/course-inventory.md` 记录：

```markdown
# Course Migration Inventory

## Category A: Hand Migrate (保留 bespoke 交互)
| Course ID | Title | Reason | Effort |
|-----------|-------|--------|--------|
| llm-fundamentals | LLM 原理与实践 | 高质量 bespoke 组件（LLMVisualizer 等） | 高 |

## Category B: Regenerate (用新引擎)
| Course ID | Title | Reason | Knowledge Type |
|-----------|-------|--------|----------------|
| golang | Go 并发模型 | 主题有价值，现有内容可替代 | procedural |
| python | Python 装饰器 | 主题有价值 | procedural |
| english-grammar | 英语语法 | 主题有价值 | factual |

## Category C: Delete (死课)
| Course ID | Title | Reason |
|-----------|-------|--------|
| course-dfad545c | (已删除) | Draft, 无内容 |
| course-4d08a644 | 未命名 | Draft, 测试课程 |
| course-6400b055 | 未命名 | Draft |
| course-6aab1538 | 未命名 | Draft |
| course-de4b02ce | 未命名 | Draft |

## Decision Rules
- **Hand migrate:** 有不可替代的 bespoke 交互
- **Regenerate:** 主题有价值，现有内容质量中等
- **Delete:** Draft status OR 无实质内容 OR 主题价值低
```

- [ ] **Step 3: 用户确认**

将 inventory 提交用户审核，确认：
- Category B 列表是否完整（是否有其他课程值得保留）
- Category C 列表是否可以安全删除

---

### Task 2: Delete Dead Courses

**Files:**
- Delete: `courses/course-*` directories

**Interfaces:**
- Consumes: Category C list from Task 1
- Produces: Clean courses/ directory

- [ ] **Step 1: Backup before deletion**

```bash
# Create backup
tar -czf courses-backup-$(date +%Y%m%d).tar.gz courses/
mv courses-backup-*.tar.gz ../backups/
```

- [ ] **Step 2: Delete dead courses**

```bash
cd courses

# Category C courses (from inventory)
rm -rf course-4d08a644
rm -rf course-6400b055
rm -rf course-6aab1538
rm -rf course-de4b02ce

# Any other draft courses identified
for dir in course-*/; do
  status=$(jq -r '.status' "$dir/course.json" 2>/dev/null)
  if [ "$status" = "draft" ]; then
    echo "Deleting draft course: $dir"
    rm -rf "$dir"
  fi
done
```

- [ ] **Step 3: Verify deletions**

```bash
ls -la courses/
# Should only see: llm-fundamentals, golang, python, english-grammar, seed-*
```

- [ ] **Step 4: Commit**

```bash
git add courses/
git commit -m "chore: delete dead courses (draft status, no content)

Deleted:
- course-4d08a644, course-6400b055, course-6aab1538, course-de4b02ce
- All other draft courses

Backup created: courses-backup-YYYYMMDD.tar.gz

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Hand Migrate llm-fundamentals

**Files:**
- Migrate: `courses/llm-fundamentals/` → essay-course format
- Create: `docs/migration/llm-fundamentals-migration-log.md`

**Interfaces:**
- Consumes: Existing llm-fundamentals course.json + 12 modules
- Produces: essay-course format with 5-6 chapters + preserved bespoke components

- [ ] **Step 1: Analyze current structure**

```bash
cd courses/llm-fundamentals
jq '.modules | length' course.json  # Check module count
ls modules/ | wc -l
jq '.modules[].title' course.json  # List all module titles
```

- [ ] **Step 2: Design chapter mapping**

记录在 `docs/migration/llm-fundamentals-migration-log.md`:

```markdown
# llm-fundamentals Migration Log

## Original Structure (12 modules)
1. Transformer 架构
2. Attention 机制
3. ...
12. 实践应用

## New Structure (5 chapters)
| Chapter | Title | Source Modules | Bespoke Component |
|---------|-------|----------------|-------------------|
| c01 | Transformer 如何理解文本 | s01, s02 | LLMVisualizer (attention) |
| c02 | 训练的三个阶段 | s03, s04, s05 | - |
| c03 | Temperature 与采样 | s06, s07 | LLMVisualizer (sampling) |
| c04 | Prompt Engineering | s08, s09 | - |
| c05 | 实践与限制 | s10, s11, s12 | - |

## Narrative Rewrite Strategy
- Merge related modules into prose chapters
- Remove ExerciseSection, RetrievalSection
- Keep LLMVisualizer as bespoke highlights
- Add drivingQuestion: "LLM 如何从海量文本中学会理解和生成语言？"
- Add centralTension: "训练成本高昂，但为什么仍然值得？预训练-微调-RLHF 三阶段如何协同？"
```

- [ ] **Step 3: Write new course.json**

```json
{
  "id": "llm-fundamentals",
  "slug": "llm-fundamentals",
  "title": "LLM 原理与实践",
  "subtitle": "从 Transformer 到 ChatGPT",
  "topic": "machine-learning",
  "language": "zh",
  "status": "published",
  "register": "explainer",
  "knowledgeType": "procedural",
  "drivingQuestion": "LLM 如何从海量文本中学会理解和生成语言？",
  "centralTension": "训练成本高昂，但为什么仍然值得？预训练-微调-RLHF 三阶段如何协同？",
  "overview": {
    "whyExists": "理解 LLM 内部机制，知道如何有效使用 prompt，避免常见误区。",
    "wherePoints": "从 Transformer 架构出发，看 attention 如何工作，理解训练流程，掌握 prompt engineering。",
    "arc": [
      "第1章：Transformer 如何理解文本",
      "第2章：训练的三个阶段",
      "第3章：Temperature 与采样策略",
      "第4章：Prompt Engineering 实践",
      "第5章：能力边界与未来"
    ]
  },
  "chapters": ["c01", "c02", "c03", "c04", "c05"]
}
```

- [ ] **Step 4: Rewrite chapters**

**策略：**
- 手工合并相关模块的 narrative blocks
- 删除 Exercise/Retrieval sections
- 保留 LLMVisualizer 作为 bespoke highlight（c01, c03）
- 重写开场，避免"摆拍式"开头
- 添加 bridge 连接章节

**示例 c01.json:**
```json
{
  "id": "c01",
  "number": 1,
  "title": "Transformer 如何理解文本",
  "role": "unfold",
  "narrative": [
    { "type": "text", "content": "2017 年，Google 发布了一篇论文《Attention Is All You Need》，提出 Transformer 架构。..." },
    { "type": "heading", "content": "Self-Attention 机制" },
    { "type": "text", "content": "..." },
    { "type": "code", "content": "# Attention score 计算\nscores = Q @ K.T / sqrt(d_k)", "lang": "python" }
  ],
  "highlight": {
    "kind": "bespoke",
    "component": "LLMVisualizer",
    "data": { "mode": "attention", "sentence": "The cat sat on the mat" },
    "caption": "交互式 Attention 可视化：观察每个词如何关注其他词",
    "afterBlock": 5
  },
  "bridge": "下一章看训练流程：预训练、微调、RLHF 如何协同。"
}
```

重复 c02-c05。

- [ ] **Step 5: Validate**

```bash
node scripts/validate-essay-course.mjs courses/llm-fundamentals
```

Expected: ✓ Validation passed

- [ ] **Step 6: Manual review**

```bash
npm run dev
open http://localhost:3000/courses/llm-fundamentals
```

Check:
- [ ] CourseOverview 正确展示 spine
- [ ] 5 章可点击访问
- [ ] LLMVisualizer 正常加载（c01, c03）
- [ ] Narrative 连贯，无明显拼接痕迹

- [ ] **Step 7: Commit**

```bash
git add courses/llm-fundamentals docs/migration/llm-fundamentals-migration-log.md
git commit -m "refactor: migrate llm-fundamentals to essay-course format

- Merge 12 modules into 5 chapters
- Preserve LLMVisualizer bespoke components
- Remove Exercise/Retrieval sections
- Add drivingQuestion and centralTension
- Rewrite narrative for continuity

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Regenerate Other Courses

**Files:**
- Create: `scripts/regenerate-course.mjs`
- Regenerate: `courses/golang/`, `courses/python/`, `courses/english-grammar/`

**Interfaces:**
- Consumes: Course topic + knowledge_type
- Produces: New essay-course via Plan 4 backend

- [ ] **Step 1: Create regeneration script**

```javascript
// scripts/regenerate-course.mjs
import fetch from 'node-fetch';

async function regenerateCourse(topic, slug, knowledgeType) {
  console.log(`Regenerating: ${topic}...`);
  
  // Call Plan 4 backend API
  const response = await fetch('http://localhost:8000/api/generate/essay-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, slug, knowledge_type: knowledgeType })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const result = await response.json();
  
  // Write to courses directory
  const fs = await import('fs/promises');
  const courseDir = `courses/${slug}`;
  
  await fs.mkdir(`${courseDir}/chapters`, { recursive: true });
  await fs.mkdir(`${courseDir}/review`, { recursive: true });
  
  await fs.writeFile(
    `${courseDir}/course.json`,
    JSON.stringify(result.course, null, 2)
  );
  
  for (const chapter of result.chapters) {
    await fs.writeFile(
      `${courseDir}/chapters/${chapter.id}.json`,
      JSON.stringify(chapter, null, 2)
    );
  }
  
  await fs.writeFile(
    `${courseDir}/review/approval.json`,
    JSON.stringify({ approved: false, approvedAt: null, approvedBy: null }, null, 2)
  );
  
  console.log(`✓ ${topic} regenerated`);
}

// Main
const courses = [
  { topic: 'Go 并发模型', slug: 'golang', knowledgeType: 'procedural' },
  { topic: 'Python 装饰器原理', slug: 'python', knowledgeType: 'procedural' },
  { topic: '英语语法基础', slug: 'english-grammar', knowledgeType: 'factual' }
];

for (const course of courses) {
  await regenerateCourse(course.topic, course.slug, course.knowledgeType);
}
```

- [ ] **Step 2: Start backend**

```bash
cd agent-backend
uvicorn app.workflow:app --reload
```

- [ ] **Step 3: Run regeneration**

```bash
node scripts/regenerate-course.mjs
```

Expected output:
```
Regenerating: Go 并发模型...
✓ Go 并发模型 regenerated
Regenerating: Python 装饰器原理...
✓ Python 装饰器原理 regenerated
Regenerating: 英语语法基础...
✓ 英语语法基础 regenerated
```

- [ ] **Step 4: Validate all regenerated courses**

```bash
for course in golang python english-grammar; do
  node scripts/validate-essay-course.mjs courses/$course
done
```

Expected: All pass.

- [ ] **Step 5: Manual review**

Open each course in browser, check:
- [ ] Register 正确（golang/python → explainer, grammar → explainer）
- [ ] Narrative 质量（无明显 AI 八股）
- [ ] Chapter 连贯性（bridge 有效）

- [ ] **Step 6: Commit**

```bash
git add courses/golang courses/python courses/english-grammar scripts/regenerate-course.mjs
git commit -m "content: regenerate courses with essay-course engine

- golang: Go 并发模型 (5 chapters, explainer register)
- python: Python 装饰器原理 (4 chapters, explainer register)
- english-grammar: 英语语法基础 (5 chapters, explainer register)

Generated via Plan 4 backend engine

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Delete Legacy Engine & Components

**Files:**
- Delete: `engine/course-package-engine.mjs`
- Delete: `engine/course-package-engine.test.mjs`
- Delete: `src/components/module/*`
- Delete: `agent-backend/app/models.py` (keep essay_models.py)
- Delete: `agent-backend/app/prompt_assets.py` (keep essay_prompts.py)
- Delete: `agent-backend/app/pipeline.py` (keep essay_pipeline.py)

**Interfaces:**
- Produces: Clean codebase with only essay-course system

- [ ] **Step 1: Verify no courses use legacy format**

```bash
# Check all courses are essay-course format
for dir in courses/*/; do
  if [ -f "$dir/course.json" ]; then
    register=$(jq -r '.register // "legacy"' "$dir/course.json")
    if [ "$register" = "legacy" ] || [ "$register" = "null" ]; then
      echo "WARNING: $dir still uses legacy format"
    fi
  fi
done
```

Expected: No warnings (除了 seed courses 和备份).

- [ ] **Step 2: Delete legacy engine**

```bash
rm engine/course-package-engine.mjs
rm engine/course-package-engine.test.mjs
rm scripts/validate-course-package.mjs
```

- [ ] **Step 3: Delete legacy frontend components**

```bash
rm -rf src/components/module/
rm src/components/interactions/ClassifyInteraction.tsx
rm src/components/interactions/CompareInteraction.tsx
rm src/components/interactions/RebuildInteraction.tsx
```

- [ ] **Step 4: Delete legacy backend modules**

```bash
cd agent-backend/app
rm models.py
rm prompt_assets.py
rm pipeline.py
# Keep: essay_models.py, essay_prompts.py, essay_pipeline.py, essay_quality.py
```

- [ ] **Step 5: Update imports**

修改 `agent-backend/app/workflow.py`:

```python
# Old imports (delete)
# from models import PlanRequest, ModuleRequest
# from pipeline import generate_plan, generate_module

# New imports (keep)
from essay_models import EssayPlanRequest, EssayChapterRequest
from essay_pipeline import generate_plan, generate_chapter, generate_full_course
```

- [ ] **Step 6: Run tests**

```bash
# Node tests
npm test

# Python tests
cd agent-backend
python3 -m pytest tests/
```

Expected: All tests pass (legacy tests removed).

- [ ] **Step 7: Build check**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete legacy course-package system

Deleted:
- engine/course-package-engine.mjs (old loader/compiler)
- src/components/module/* (12-station renderer)
- src/components/interactions/{Classify,Compare,Rebuild}Interaction.tsx
- agent-backend/app/{models,prompt_assets,pipeline}.py (old backend)

Kept:
- essay_*.py backend modules
- chapter/* frontend components
- bespoke interactions (LLMVisualizer, etc.)

All courses migrated to essay-course format

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Clean Up Unused Bespoke Components

**Files:**
- Audit: `src/components/interactions/bespoke/*`
- Delete: Unused components

**Interfaces:**
- Produces: Only actively-used bespoke components remain

- [ ] **Step 1: Audit bespoke usage**

```bash
# Find all bespoke components
ls src/components/interactions/bespoke/

# Check which are referenced in courses
for component in src/components/interactions/bespoke/*.tsx; do
  name=$(basename "$component" .tsx)
  usage=$(grep -r "\"$name\"" courses/ | wc -l)
  echo "$name: $usage usages"
done
```

- [ ] **Step 2: Delete unused components**

Example output:
```
LLMVisualizer: 2 usages (llm-fundamentals c01, c03)
PostgresIndexTree: 0 usages
ConceptMapVisualizer: 0 usages
```

Delete unused:
```bash
rm src/components/interactions/bespoke/PostgresIndexTree.tsx
rm src/components/interactions/bespoke/ConceptMapVisualizer.tsx
```

- [ ] **Step 3: Update InteractionRenderer registry**

```tsx
// src/components/InteractionRenderer.tsx
const BESPOKE_COMPONENTS = {
  LLMVisualizer: dynamic(() => import('./interactions/bespoke/LLMVisualizer')),
  // Remove: PostgresIndexTree, ConceptMapVisualizer
};
```

- [ ] **Step 4: Commit**

```bash
git add src/components/interactions/
git commit -m "chore: remove unused bespoke components

Deleted:
- PostgresIndexTree (0 usages)
- ConceptMapVisualizer (0 usages)

Kept:
- LLMVisualizer (used by llm-fundamentals)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Final Verification & Documentation

**Files:**
- Create: `docs/migration/migration-complete.md`
- Update: README.md

**Interfaces:**
- Produces: Migration summary document

- [ ] **Step 1: Run full test suite**

```bash
npm test
npm run build
cd agent-backend && python3 -m pytest tests/
```

Expected: All pass.

- [ ] **Step 2: Verify all courses load**

```bash
npm run dev

# Open each course
for course in llm-fundamentals golang python english-grammar seed-explainer seed-essay; do
  echo "Testing: $course"
  curl -s http://localhost:3000/courses/$course | grep -q "<title>" && echo "✓" || echo "✗ FAILED"
done
```

Expected: All ✓

- [ ] **Step 3: Write migration summary**

```markdown
# Migration Complete

## Summary
- **Migrated:** 1 course (llm-fundamentals, hand-migrated)
- **Regenerated:** 3 courses (golang, python, english-grammar)
- **Deleted:** 5+ dead courses (draft status)
- **Legacy system removed:** course-package-engine, module renderer, old backend

## Remaining Courses (All essay-course format)
1. llm-fundamentals (explainer, 5 chapters, bespoke LLMVisualizer)
2. golang (explainer, 5 chapters)
3. python (explainer, 4 chapters)
4. english-grammar (explainer, 5 chapters)
5. seed-explainer (reference)
6. seed-essay (reference)

## Code Cleanup
- Deleted 12-station module renderer
- Deleted exercise/retrieval sections
- Deleted generic interactions (Classify, Compare, Rebuild)
- Deleted legacy backend models/pipeline
- Kept bespoke LLMVisualizer (used by llm-fundamentals)

## Verification
- All courses pass validation: ✓
- All courses render in frontend: ✓
- Tests pass: ✓
- Build succeeds: ✓

## Next Steps
- Phase 4 打磨（可选）：排版优化、dark mode、课级"领地图"
- 持续内容迭代：基于用户反馈改进 prompt 和评审闸
```

- [ ] **Step 4: Update README**

Add section:
```markdown
## Architecture (After Narrative-Essay Refactor)

### Content Model
- **Essay-Course:** spine (drivingQuestion + centralTension + overview) + 4-6 chapters
- **Dual Register:** explainer (tech blogger) vs essay (philosophical)
- **Prose-First:** Narrative blocks flow, highlights as rare accents

### Generation
- Backend: `agent-backend/app/essay_*.py` (Plan 4)
- Prompts: register-specific templates + anti-pastiche guards
- Quality: LLM judge gate (substance density + hallucination detection)

### Frontend
- Chapter renderer: prose-first layout, 65ch column
- Course overview: spine + arc preview
- Bespoke highlights: LLMVisualizer (llm-fundamentals)
```

- [ ] **Step 5: Commit**

```bash
git add docs/migration/migration-complete.md README.md
git commit -m "docs: migration complete summary

All courses migrated to essay-course format
Legacy system removed
6 active courses + 2 seed courses

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 6: Update design spec**

Mark Plan 6 complete in `docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md` §13:

```markdown
## 13. 实施分期

- [x] Plan 1（数据契约）已完成：新 schema 就位
- [x] Plan 2（设计文档）已完成：narrative principles documented
- [x] Plan 3（种子课程）已完成：seed-explainer + seed-essay
- [x] Plan 4（后端引擎）已完成：generation engine with dual register
- [x] Plan 5（前端渲染）已完成：prose-first chapter renderer
- [x] Plan 6（迁移清理）已完成：all courses migrated, legacy system removed

**Status:** 叙事化重构完成。系统已全面切换到 essay-course 模型。
```

---

## Dependencies

- **Depends on:** Plan 1 (Data Contract) — schema + validator
- **Depends on:** Plan 2 (Design Docs) — narrative principles
- **Depends on:** Plan 3 (Seeds) — reference courses
- **Depends on:** Plan 4 (Backend) — generation engine for regeneration
- **Depends on:** Plan 5 (Frontend) — new renderer for migrated courses
- **Completes:** Narrative-essay refactor (all 6 plans)

---

## Notes

- **llm-fundamentals 迁移难度高**：12 modules → 5 chapters 需要重写 narrative，保持质量标准。预留充足时间。
- **重生成课程质量**：依赖 Plan 4 引擎和评审闸。如生成质量不达标，需调整 prompt 或增加人工审核。
- **Backup 策略**：删除前创建 tar.gz 备份，存放在 backups/ 目录（不提交到 git）。
- **渐进式验证**：每完成一个 Task 立即验证，避免积累问题到最后。
- **用户确认点**：Task 1 (course inventory) 和 Task 4 (regenerated course review) 需用户拍板。
