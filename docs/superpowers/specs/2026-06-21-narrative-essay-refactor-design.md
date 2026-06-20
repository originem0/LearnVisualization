# 叙事化重构设计 (Narrative-Essay Refactor)

> 日期：2026-06-21
> 状态：设计已与用户逐节确认，待 spec 复核后进入 writing-plans
> 分支：`refactor/narrative-essay`

## 1. 背景与问题

LearnVisualization 现在能根据主题自动生成"课程包"（12–14 个模块，每模块带叙事块、练习、检索、概念图、互动组件）。用户的核心反馈：

- **"既要又要"**：系统同时追求叙事沉浸、worked-example 细节、互动练习、概念图、检索练习——每个模块都想五样全占，结果是缝合怪。
- **结构太生硬**：每个模块按同一张"必填块清单"拼出来，读起来是检查表不是论证。
- **开头生拉硬凑**：prompt 明文要求"第一段必须是有触感的具体场景 + 一个不对劲的细节"（`agent-backend/app/prompt_assets.py:424`），于是每篇开头都成了摆拍小品（如 golang 课 "晚上七点…最不对劲的细节是…"）。
- **互动组件硬加**：除手工打造的 llm-fundamentals 外，其余课程的通用数据驱动互动（compare 优劣表 / classify / rebuild 拖拽）是"作业本"观感。
- **没有代入感**：缺一个有立场的声音和一条贯穿的主线。

用户给出的北极星参照：`github.com/originem0/script_background`（两篇思想随笔）。其 DNA：**一条主线回答一个问题；先见全景轮廓（为什么存在、指向哪里）；概念作为论证工具随用随引；零 bullet、零练习；靠一个有立场的"我"把复杂的东西串成活的故事。**

### 1.1 两个根因（比表面反馈更深）

- **根因 A — 前端"12 站流水线"**：`src/components/module/ModuleRenderer.tsx` 对**每一个**模块固定渲染 Header → FocusPanel → MisconceptionOpening → CourseIntroDialog → 核心交互 → 概念图 → NarrativeStream → ExerciseSection → RetrievalSection → BridgeSection → ReferencePanel → ModuleNav。读者每章都撞见同一套教学装置——这是"结构生硬"肉眼可见的来源。
- **根因 B — 哲学写死在文档里再注入 prompt**：`prompt_assets.py:load_design_prompt_principles()` 直接从 `DESIGN.md`、`design/01`、`design/04` 抽取 Merrill/Bloom/认知负荷 段落注入生成 prompt。而 `DESIGN.md:37` 明文"不做纯文章站——不把写得不错的长文误当学习产品"。不改这层文档，prompt 会持续把要删的约束注回去。

### 1.2 关键风险（用户最怕的）

把"像油管博主那样写"直接塞给模型，大概率得到**装深刻的 AI 味八股**——硬凑金句、为比喻而比喻、点名哲学家充门面，比现在"干但诚实"的输出更糟。**对策必须是给叙事一根真实的"事实脊柱"**（真问题 + 真张力 + 具体实例），而非只调措辞。

## 2. 已确认的方向决策

| 决策点 | 选择 |
|--------|------|
| 产品形态 | **叙事为主，交互作稀有高光**（砍掉每模块的交互/练习/检索配额） |
| 一门课的形状 | **一条主线 + 4–6 章 essay**，开篇先给"全景轮廓" |
| 叙事语域 | **两种语域，按知识类型分**：技术博主解说腔 / 思想随笔腔 |
| 重构深度 | **C（一步到位）**：含交互精选、全量重生成、阅读体验重设计、设计文档改写 |

## 3. 目标与非目标

**目标**
1. 生成读起来像优秀视频脚本/长文的"活的结构"：一条主线、先见轮廓、散文为主。
2. 让主线真正连贯——章节之间有过渡、有复现的 motif、一致的声音。
3. 按知识类型自动选叙事语域；技术主题用解说腔，思辨主题用随笔腔。
4. 把交互降级为稀有高光：默认纯文字，仅在确有价值时出现。
5. 用"事实脊柱 + 防八股闸"压住 AI 味。

**非目标**
1. 不为每个新主题自动生成 bespoke 可视化组件（做不到且会出劣质交互）。
2. 不保留 Bloom/Merrill/scaffold/retrieval 那套教学脚手架机制。
3. 不追求每课都有炫酷交互。
4. 不保留旧 12-station 渲染流水线。

## 4. 内容模型

### 4.1 `course.json`（脊柱中心）

```jsonc
{
  "id": "...", "slug": "...", "title": "...", "subtitle": "...",
  "topic": "...", "language": "zh", "status": "published",
  "register": "explainer | essay",        // 由主导知识类型决定，见 §6
  "knowledgeType": "<主导知识类型>",        // 仅用于决定 register
  "drivingQuestion": "整门课只回答的那一个问题",   // 脊柱
  "centralTension":  "贯穿全篇的张力 / 反直觉",
  "overview": {                            // "全景轮廓"，前端落地页主角
    "whyExists":   "这东西为什么存在、解决什么",
    "wherePoints": "学完指向哪里",
    "arc": ["第1章在主线里的角色", "第2章…", "…"]   // 4–6 条，旅程轮廓
  },
  "chapters": ["c01", "c02", "c03", "c04", "c05"]    // 4–6 章
}
```

**从 course 中删除**：5 层 `categories`、`paths`、`moduleGraph`（先修边）、`philosophy`（promise/corePrinciples/shiftStatement）、以及作为强制项的 `learningGoals` / `nonGoals` / `assumptions`。

### 4.2 章节 `chapters/cNN.json`（砍到只剩叙事）

```jsonc
{
  "id": "c01", "number": 1, "title": "...",
  "role": "这一章在主线里承担什么",
  "narrative": [                          // 散文优先
    { "type": "text", "content": "..." }, // 主体；开场就是头几段，无独立 opening 字段
    { "type": "heading", "content": "..." },
    { "type": "code", "content": "...", "lang": "go" },   // 讲代码时
    { "type": "callout", "content": "..." },              // 罕见：真正的关键洞见
    { "type": "quote", "content": "...", "cite": "..." }  // 罕见：随笔腔引文
  ],
  "highlight": null,                      // 或见 §4.3，全章 0–1 个
  "bridge": "自然过渡到下一章（末章为 null）"
}
```

**narrative 允许的 block 类型**：`text`（主体）、`heading`、`callout`（罕见）、`code`、`quote`（罕见）。
**从 narrative 中移除**：`steps`、`diagram`、`comparison`、`reflection`——顺序过程改写成散文；交互式分步留给 `highlight`。

**章节中彻底删除的字段**：`focusQuestion`、`misconception`、`keyInsight`、`opening`、`quote`(字段)、`concepts`/`relatedTo`、`logicChain`、`examples`、`counterexamples`、`pitfalls`、`visuals`、`interactionRequirements`、`retrievalPrompts`、`exercises`、`scaffoldProgression`、`bloomLevel`、`elementInteractivity`、`primaryCognitiveAction`、`moduleKind`、`targetChunk`、`chunkDependencies`、`nextModuleId`。

### 4.3 `highlight`（稀有高光交互）

```jsonc
"highlight": {
  "kind": "bespoke | trace",
  "component": "TokenizerPlayground",     // kind=bespoke 时，引用白名单组件
  "data": { ... },                        // kind=trace 时，代码追踪数据
  "caption": "一句话说明这个高光在讲什么",
  "afterBlock": 4                         // 渲染在 narrative 第几个 block 之后
}
```

`highlight` 是章节级可选字段，用 `afterBlock` 指明插入位置，避免特殊 narrative block 类型。

## 5. 生成流程

复用现有 `plan → compose → validate → export → promote → build` 编排（`agent-backend/app/pipeline.py`、`workflow.py`），改的是各阶段产出：

1. **plan 阶段产出"叙事主线"而非"模块目录"**：输出 `drivingQuestion`、`centralTension`、`overview`、4–6 章的 `arc`。**plan 必须基于 research 真实素材**（具体机制、真实例子、真实数字/代码、真张力），形成"事实脊柱"。register 在此阶段按主导知识类型确定。
2. **章节顺序生成、串上一章结尾**：现在 `build_module_prompts` 每模块只拿到压缩课纲，各章互不知情。新流程每章生成时**额外传入「主线 + 上一章结尾段落」**，过渡才接得上、motif 才能复现、声音才一致。（根治"各自独立生成"。）
3. **交互数据按需生成**：不再每模块跑互动数据 LLM 调用；仅当某章 `highlight` 被规划为 `trace` 时才生成其数据。

## 6. 双语域

知识类型从此**只**决定语域（与适不适合放 trace 高光），不再决定任何教学脚手架。

| register | 知识类型 | DNA |
|----------|----------|-----|
| **explainer 解说腔** | procedural / factual / situational | 3Blue1Brown/Fireship 式。冷开场用具体钩子或反直觉断言（**非**摆拍场景）；早立利害；一个驱动问题贯穿；概念随用随引、立刻作用到具体例子；"但问题来了"式张力转折；比喻服务机制；收在"啊哈"。**扎在技术实质里**。 |
| **essay 随笔腔** | conceptual / strategic / metacognitive | script_background 式。允许向哲学/社会/人延伸、引经据典、追求穿透。但**强制**：每处抽象都落到具体实例，否则视为空转。 |

**课内调制**：技术课的 overview / 第一章可借一点 essay 腔讲"为什么存在"，进入机制章回到 explainer 腔。register 字段定主调，章节内允许微调。

## 7. 防八股（四道闸）

1. **事实落地**：章节 prose 被约束必须建立在 plan 给的具体材料上（机制/例子/数字/代码），不得脱离材料自由抒情。
2. **语域护栏**：explainer 腔禁止滑向格言/哲学点名；essay 腔允许伸展但每个抽象必须锚定具体。
3. **每语域负面样本**：明令禁止——硬凑金句、"正如XX所言"式无功能掉书袋、"这不仅仅是X，更是Y"句式、空洞反问、摆拍式感官开场。
4. **LLM 评审闸**（取代格式检查）：每章打分——实质密度、AI 味/装深刻、主线连贯、语域吻合。低于阈值则重写（限 N 次）或转人工审核。

## 8. 质量门改写（`agent-backend/app/quality.py`）

**移除**：强制 steps 块、examples 字数下限（blocking）、概念图节点/边数下限、simulate scenarios 数量、focusQuestion 形态规则（字段已删）、componentHint 白名单（迁移到 highlight 校验）。
**保留并演化**：文本套话黑名单（扩充为 §7.3 负面样本）。
**新增**：bullet 碎片化检测（prose 不应是 bullet）、主线连贯检测、§7.4 的 LLM 评审闸。

## 9. 前端阅读体验

### 9.1 章节阅读器（4 站，取代 12 站）

章标题（号 + 标题 + 一句 `role`）→ **正文**（`NarrativeStream`，散文优先，开场即正文头几段，**无** FocusPanel / MisconceptionOpening 前置面板）→ 行内至多一个 `highlight`（按 `afterBlock` 插入）→ `bridge` → 上/下章导航。

**删除的站点组件**：`FocusPanel`、`MisconceptionOpening`、`CourseIntroDialog`、每模块概念图（`ConceptMapRenderer` 在阅读流中）、`ConceptSidebar`、`ExerciseSection`、`RetrievalSection`、`ReferencePanel`。

### 9.2 课程落地页 = "全景轮廓"

大字 `drivingQuestion`，亮出 `centralTension`，讲清 `whyExists` / `wherePoints`，把 4–6 章作为一条**旅程**铺开（每章带 `role`）。读者先见整体再"开始阅读"进第一章。废弃现有 5 层 category band + 模块目录。

### 9.3 保留 / 简化

`NarrativeStream` 排版保留（54rem、1.78 行高），撤掉外围面板/标签 chrome 让阅读连续。`FloatingTOC` 保留（章内略读）。`Sidebar` 简化为"按章列"，不再 5 层分类。

## 10. 交互高光的诚实边界

- 现存 24 个 bespoke 组件（`src/components/interactive/`）**几乎全为 LLM 专属** + 3 个 Postgres。任意新主题**无对应组件**，且不在生成时让 LLM 现写 React 组件。
- **已有组件的主题（LLM/Postgres）**：`highlight.kind=bespoke` 可挂这些精品组件，保留。
- **任意新主题**：默认 `highlight=null`（纯 essay）；仅当某章适合"看代码一步步执行"时放 `highlight.kind=trace`。
- **通用渲染器**（`src/components/InteractionRenderer.tsx`）：只留干净重做的 `trace`/`step-through`；**砍掉** compare(优劣表)、classify、rebuild、simulate(滑块)、retrieve。
- 结论：**多数新课纯文字，少数技术课一个代码追踪，极少数（LLM/PG）有精品可视化。**

## 11. 设计文档改写与种子（关键杠杆）

### 11.1 改写设计文档（因 prompt 从中读取）
- `DESIGN.md`：把"不做纯文章站"翻转为"**活的结构：一条主线、先见轮廓、叙事为主、交互作稀有高光、真实素材防空转**"；移除/降级 5 对学习科学张力为治理框架。
- `design/01-learning-principles.md`：用叙事解说原则替换 Bloom/Merrill 那套。
- `design/02-content-model.md`：换成 §4 新 schema。
- `design/03-rendering-contract.md`：换成 §9 散文优先阅读器。
- `design/04-agent-contract.md`：换成 §5–7 新生成契约（脊柱 + 双语域 + 防八股负面样本）。
- `design/05-platform-architecture.md`：编排不变，更新数据模型段。
- 同步更新 `prompt_assets.py:load_design_prompt_principles()` 与 `load_few_shot_examples()` 去读新内容。

### 11.2 手写 2 个种子（linchpin）
手工调到位 1 个 explainer 种子 + 1 个 essay 种子（新模型、新语域），作为 few-shot 与质量标杆。教训：项目里唯一好的就是手调的 llm-fundamentals。其 s01 开场"你以为模型读一句话…不是。"即完美解说腔冷开场。**没有好种子，生成必然漂移。** 此步需用户参与确认。

## 12. 迁移

- **llm-fundamentals**：转新模型，作**旗舰 explainer 种子**，保留 TokenizerPlayground 等做高光。
- **差的生成课**（golang / python / english-grammar / course-4d08a644 / course-6400b055 / course-6aab1538 / course-de4b02ce）：删除，用新流程重生成若干做验证。
- **有手工组件的**（postgresql-internals / git-internals / claude-code）：转新模型、保住组件。
- **成本**：新课 ≈ plan(1) + 章节(4–6) + 少量高光 + 评审(每章 1) ≈ 8–12 次调用，与现有 ~15 次持平或更省。
- **策略与风险**：大爆炸式切换——一次性把所有课转新 schema、移除旧渲染器。切换前打 git tag 以便回滚。过渡期**不**维护双 schema。

## 13. 实施分期

0. **地基**：手写 2 个种子 + 改写设计文档。
1. **后端**：新 schema/models + plan 出脊柱 + 章节串上一章 + 双语域 + 防八股 prompt + LLM 评审闸 + 重写 `quality.py`。
2. **前端**：章节阅读器 + 全景落地页 + 拆站点 + 砍作业本交互（留 bespoke + trace）。
3. **迁移**：转 llm-fundamentals、重生成、删死课。
4. **打磨**：排版、可选的课级"领地图"、清理未用到的 bespoke 组件。

## 14. 受影响文件（概览）

**后端**：`agent-backend/app/models.py`、`prompt_assets.py`、`quality.py`、`pipeline.py`、`workflow.py`。
**设计文档**：`DESIGN.md`、`design/01–05`。
**前端**：`src/components/module/*`（ModuleRenderer / NarrativeStream / 及待删站点）、`NarrativeRenderer.tsx`、`InteractionRenderer.tsx`、课程落地页 `src/app/[locale]/courses/[courseSlug]/page.tsx` 与章节页 `[slug]/page.tsx`、`Sidebar.tsx`、`src/lib/course-package-adapter.ts`、`course-schema.ts`、`data.ts`、`types.ts`、`module-registry.ts`。
**课程数据**：`courses/*`（迁移）。

## 15. 待定 / 开放问题

1. 章节数固定区间 4–6，具体由 plan 按主题判断。
2. 课级"领地图"（替代 12 个 per-module 概念图）列为 phase 4 可选。
3. LLM 评审闸的阈值与重写次数上限，实现时定。
4. 种子需要用户投入时间共同打磨——是 phase 0 的前置依赖。
5. `situational` 知识类型暂归 explainer，如有反例再调。
6. **"事实脊柱"的素材来源（防八股成败关键）**：现有 plan 的 `researchSummary` 是 LLM 自产、非真实外部研究。对模型熟悉的主题（LLM、Go、Python）其参数知识够用；对冷门主题，自产"事实"可能是幻觉，比空转更糟。**决定（2026-06-21）：模型知识优先 + 评审闸兜底，不默认接研究。** plan 阶段让模型自评主题熟悉度/置信度；LLM 评审闸在"实质密度"之外增设"疑似杜撰"检测；仅对低置信度主题触发 crawl4ai/firecrawl 研究作为 fallback，不作默认路径——以保住常见路径的速度与稳定（项目本就受中转站波动困扰，不宜对每次生成都加外部调用）。
