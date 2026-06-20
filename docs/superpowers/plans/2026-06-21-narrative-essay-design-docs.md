# 叙事化重构 · 计划 2：Design Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改写 DESIGN.md 及 design/01–05 设计文档，移除教学脚手架约束（Bloom/Merrill/scaffold/retrieval），注入叙事原则（先见轮廓、活的结构、双语域、防八股），使其成为新生成引擎的哲学基础。

**Architecture:** 设计文档通过 `agent-backend/app/prompt_assets.py:load_design_prompt_principles()` 注入生成 prompt。当前文档强制教学脚手架（12-station 流水线、练习配额、概念图）并明文"不做纯文章站"——这些约束必须删除。新文档需明确"叙事为主、交互为稀有高光"的产品定位，给出双语域切换规则，解释防八股策略。

**Tech Stack:** 纯文档改写，无代码变更。Plan 3（Seeds）和 Plan 4（Backend）依赖本计划输出。

## Global Constraints

- 保留学习科学的**底层依据**（记忆机制、认知负荷、必要难度），但删除其**教学脚手架应用**（Bloom 分类驱动的 exercise、scaffold progression、retrieval practice）。
- 新增内容采用中英混排：哲学陈述用中文，技术术语保持英文。
- 文档结构保持 5 份独立（01–05），便于按需注入 prompt。
- DESIGN.md 保持"入口 + 导航"角色，不堆细节。

---

## File Structure

- Modify: `DESIGN.md` — 重写"核心约束""非目标""学习科学基础"三节
- Modify: `design/01-learning-principles.md` — 删除 Bloom/Merrill 应用，保留记忆机制
- Modify: `design/02-content-model.md` — 新增 essay-course 模型说明
- Modify: `design/03-rendering-contract.md` — 删除 12-station 流水线，新增 prose-first 章节渲染
- Modify: `design/04-agent-contract.md` — 重写为叙事生成规则 + 双语域 + 防八股
- Keep: `design/05-platform-architecture.md` — 基本不变（前后端分离架构仍成立）

---

### Task 1: 重写 DESIGN.md 核心约束与非目标

**Files:**
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: Plan 1 输出的 essay-course schema
- Produces: 新的产品定位陈述，注入 prompt_assets.py

- [ ] **Step 1: 改写"这个系统在做什么"节**

原文："不是内容工厂，不是好看的文章站，不是交互游乐场。"

新文："把复杂知识转化成连贯叙事——一条主线回答一个问题，先见全景轮廓，散文为主。不是教学脚手架集合，不是练习题库，不是交互游乐场。"

- [ ] **Step 2: 改写"核心约束"**

原文："AI 辅助生成，人类把关质量，学习科学定规矩。"

新文："AI 生成主线叙事，事实脊柱防八股，人类审核实质密度。"

- [ ] **Step 3: 重写"非目标"列表**

删除：
- ~~"不做纯文章站 — 不把'写得不错的长文'误当学习产品"~~（这条正是当前问题的根源）

新增：
- "不做教学检查表 — 不为每章强制配齐练习/概念图/检索"
- "不做 AI 八股文 — 不接受装深刻的金句堆砌和无根比喻"
- "不做万能交互 — 通用数据驱动交互观感作业本，仅保留 bespoke 高光"

- [ ] **Step 4: 改写"学习科学基础"节**

保留依据来源（Sweller, Bjork），但删除"Bloom 分类学""Merrill 教学首要原则"作为设计驱动因素。

新增："叙事连贯性 — drivingQuestion 贯穿全课，章节通过 bridge 过渡，保持一致声音（register）"

---

### Task 2: 重写 design/01-learning-principles.md

**Files:**
- Modify: `design/01-learning-principles.md`

**Interfaces:**
- Consumes: 无（独立哲学文档）
- Produces: 注入 plan 阶段 prompt 的学习原则

- [ ] **Step 1: 删除 Bloom/Merrill 驱动的教学设计节**

删除：
- "根据 Bloom 层级选择认知动词"
- "Merrill 的激活-示范-应用-整合四步"
- "Scaffold progression: full → faded → free"

这些是 12-station 流水线的理论支撑，与叙事模型冲突。

- [ ] **Step 2: 保留并强化"认知负荷"与"必要难度"**

保留：
- worked example 效应（但不强制 steps block）
- 内在负荷 vs 外在负荷（复杂概念用 callout 分段）
- 检索练习促进记忆（但不强制 retrieval section）

新增：
- "散文展开自带间隔效应 — 概念随论证自然复现，不需显式 flashcard"

- [ ] **Step 3: 新增"叙事作为认知组织器"节**

内容：
- drivingQuestion 提供检索线索（记忆研究：有意义编码 > 机械重复）
- centralTension 制造必要难度（desirable difficulty）
- overview.arc 给出预期轮廓（advance organizer, Ausubel 1960）

---

### Task 3: 重写 design/02-content-model.md

**Files:**
- Modify: `design/02-content-model.md`

**Interfaces:**
- Consumes: Plan 1 的 TS schema（EssayCourse, Chapter, EssayNarrativeBlock）
- Produces: 前端与后端共享的数据契约说明

- [ ] **Step 1: 新增"Essay-Course 模型"节**

内容：
```markdown
## Essay-Course 模型（新）

一门课 = spine (drivingQuestion + centralTension + overview) + 4–6 chapters

### Course Spine
- `drivingQuestion`: 主线问题，贯穿全课
- `centralTension`: 核心张力（为什么这个问题难/重要）
- `overview`: { whyExists, wherePoints, arc[] }

### Chapter
- `narrative`: EssayNarrativeBlock[] — 散文块序列（text/heading/code/callout/quote）
- `highlight`: Highlight | null — 可选交互高光（bespoke 或 trace）
- `bridge`: string | null — 到下一章的过渡

### Register（语域）
- `explainer`: 技术博主解说腔（procedural/factual knowledge）
- `essay`: 思想随笔腔（conceptual/strategic knowledge）
```

- [ ] **Step 2: 标记旧 CourseModule 模型为"遗留"**

在 CourseModule 节添加：
> ⚠️ **遗留模型**：12-module pedagogical checklist 模式正在淘汰，仅 llm-fundamentals 等旧课保留。新课使用 Essay-Course 模型。

- [ ] **Step 3: 删除"练习类型详解"节**

删除 Exercise、RetrievalPractice、ScaffoldProgression 的详细说明——这些是作业本站点的遗留，新模型不强制。

---

### Task 4: 重写 design/03-rendering-contract.md

**Files:**
- Modify: `design/03-rendering-contract.md`

**Interfaces:**
- Consumes: Plan 5（Frontend）将实现的新渲染器
- Produces: 前端渲染规则

- [ ] **Step 1: 删除"12-Station 流水线"节**

删除：
- ModuleRenderer 的 Header → FocusPanel → MisconceptionOpening → ... → ModuleNav 流程图

这是"结构生硬"的根源。

- [ ] **Step 2: 新增"Prose-First 章节渲染"节**

内容：
```markdown
## 章节渲染（Essay-Course）

### 布局原则
- 中心列宽 65ch（optimal line length）
- narrative blocks 连续流动，无硬分段
- highlight 作为 float aside 或 fullbleed section

### Block 类型
- `text`: 段落，直接渲染
- `heading`: h2/h3，自动生成锚点
- `code`: syntax highlighted，支持 `lang` 属性
- `callout`: 侧边注或高亮框
- `quote`: blockquote + cite

### Highlight 渲染
- `bespoke`: 手工组件（LLMVisualizer, PostgresIndexTree 等）
- `trace`: 代码执行 trace 可视化（通用组件）
```

- [ ] **Step 3: 删除"教学模式矩阵"**

删除：knowledge type × cognitive action → 渲染策略的映射表（这是 Bloom 驱动设计的遗留）。

---

### Task 5: 重写 design/04-agent-contract.md（核心）

**Files:**
- Modify: `design/04-agent-contract.md`

**Interfaces:**
- Consumes: Plan 3（Seeds）的参照样本
- Produces: Plan 4（Backend）的 prompt 设计依据

- [ ] **Step 1: 删除旧 Agent 规则**

删除：
- "每模块必须有 focusQuestion、misconception、keyInsight"
- "concepts 数组必须 3–6 个"
- "logicChain 必须体现因果"
- "examples 必须包含 worked example"
- "练习必须覆盖 Bloom 多层级"

这些是 12-module checklist 的强制约束。

- [ ] **Step 2: 新增"叙事生成规则"节**

内容：
```markdown
## 叙事生成规则

### Plan 阶段输出
- drivingQuestion: 一个真实的、值得回答的问题
- centralTension: 为什么这个问题难/重要（不是装饰性陈述）
- overview.arc: 4–6 个章节标题，体现论证弧线

### Chapter 生成输入
- 上一章结尾（prev_chapter_ending）— 保持连续性
- 本章在 arc 中的角色（intro/build/pivot/conclude）

### Narrative 要求
- 100+ 段连续散文，一条主线
- 概念随论证出现，不预先列表
- 零 bullet points（除非是代码示例或对比表）
- 开头直接进入问题，不做"场景摆拍"（避免"晚上七点…"式开场）
```

- [ ] **Step 3: 新增"双语域切换"节**

内容：
```markdown
## Register（语域）

根据 knowledgeType 自动选择：

### Explainer（解说腔）
- **适用**：procedural, factual, situational
- **风格**：技术博主（3Blue1Brown, Fireship）
- **特征**：
  - 用"你"而非"我们"
  - 直接动词（"看这个例子""运行这段代码"）
  - 可视化类比（"想象一个队列…"）
  - 代码 trace 为主

### Essay（随笔腔）
- **适用**：conceptual, strategic
- **风格**：思想随笔（script_background）
- **特征**：
  - 允许"我"的立场声音
  - 哲学追问（"为什么需要…""这意味着什么"）
  - 抽象概念对比
  - 少代码，多推理
```

- [ ] **Step 4: 新增"防八股策略"节**

内容：
```markdown
## 防八股（四道闸）

### 1. 事实脊柱
- Plan 阶段要求列出 3–5 个可验证事实/案例
- Chapter 生成时每段必须锚定事实，不空转概念

### 2. Register 护栏
- Explainer: 禁止"深刻金句""哲学家背书""为比喻而比喻"
- Essay: 禁止"技术细节堆砌""代码示例充数"

### 3. Negative 样本
- Prompt 注入反例："不要写成'你有没有想过…这就像…其实…'"
- 明文禁止的开场模式

### 4. LLM 评审闸
- 生成后用 judge LLM 评估：
  - 实质密度（substance density）：具体事实 vs 空洞陈述比例
  - 疑似杜撰（hallucination detection）：不可验证的"研究表明"
- 不通过 → 重写（最多 2 次）
```

---

### Task 6: 保持 design/05-platform-architecture.md 基本不变

**Files:**
- Modify: `design/05-platform-architecture.md`（微调）

**Interfaces:**
- Produces: 架构决策依据

- [ ] **Step 1: 新增"双引擎并存"节**

内容：
```markdown
## 双引擎并存（迁移期）

- `engine/course-package-engine.mjs` — 旧 12-module 模型（遗留）
- `engine/essay-course-engine.mjs` — 新 essay-course 模型
- 前端通过 `course.register` 字段判断走哪条渲染路径
- 迁移完成后删除旧引擎
```

- [ ] **Step 2: 更新"后端生成流程图"**

修改：
1. Plan → ~~12 module outlines~~ → **spine + 4–6 chapter titles**
2. Generate modules → **Generate chapters (串上一章)**
3. ~~Normalize (quality.py)~~ → **Normalize (essay_schema.py + LLM judge)**

---

## Verification

- [ ] **Task 7: 校验文档注入**

- [ ] **Step 1: 修改 prompt_assets.py 测试加载**

运行：
```bash
cd agent-backend
python3 -c "from app.prompt_assets import load_design_prompt_principles; print(load_design_prompt_principles())"
```

预期：输出包含"叙事为主""双语域""防八股"关键词，不包含"Bloom""Merrill""scaffold"。

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md design/
git commit -m "docs: rewrite design docs for narrative-essay model

- Remove teaching scaffolding (Bloom/Merrill/retrieval)
- Add narrative principles (spine/register/anti-pastiche)
- Update content model with essay-course schema
- Replace 12-station rendering with prose-first layout

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Dependencies

- **Depends on:** Plan 1 (Data Contract) — schema 已就位
- **Enables:** Plan 3 (Seeds) — 种子课程按新设计文档的原则手写
- **Enables:** Plan 4 (Backend) — 生成 prompt 从新文档注入规则

---

## Notes

- 这是"哲学改写"任务，不涉及代码逻辑
- 改写时保持文档的"为什么"（原则）清晰，"怎么做"（步骤）留给 Plan 4
- 双语域与防八股是核心——必须写清楚判断规则，不能含糊
