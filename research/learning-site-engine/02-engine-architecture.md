# 02 — Learning Site Engine / 模板引擎架构

## 研究目标

这里要回答的是：

> **如何把当前的 LLM 可视化学习网站，抽象成一个可复用的“学习站引擎”？**

不是做 CMS，不是做博客模板，也不是做文档主题。目标是：

- 结构化课程内容
- 结构化视觉表达
- 结构化交互能力
- 自动校验
- 可由 agent 生成
- 可由人审核发布

---

## 核心判断

### 1. 当前系统已经接近引擎雏形，但还没完全平台化
现在 repo 里已经有几件非常值钱的东西：

- module-level schema
- narrative blocks
- concept map schema + renderer
- module registry
- 校验脚本链
- 静态导出发布链

这说明它已经不是“页面堆砌”，而是开始有：

- 内容模型
- 渲染系统
- 能力映射
- 护栏

但它仍然偏向一个 **LLM 专题样板工程**。要成为 engine，还得把 topic-specific 的部分再抽象一层。

### 2. 引擎和课程内容必须拆层
第一原则：

> **Engine 不应该知道“LLM 是什么”；Engine 只应该知道“课程、模块、叙事块、关系图、交互能力、校验规则”是什么。**

所以至少要拆成两层：

#### Engine layer
负责：
- 路由与页面骨架
- 内容渲染器
- concept map renderer
- interaction capability renderer
- design system
- validation pipeline
- build / export / publish

#### Course package layer
负责：
- course metadata
- audience / goals
- module graph
- module content
- concept schemas
- interaction requirements
- topic-specific assets

这一步做成后，LLM 课程只是第一个 course package。

### 3. 内容应该继续“as data”，不要退回文章式 authoring
从 Hygraph 那类 schema-first 内容建模思路看，真正可扩展的学习产品都依赖明确的内容结构，而不是把内容糊在富文本里。

对你这个系统来说，这意味着：

- narrative block 继续结构化
- 概念关系继续结构化
- interaction 需求也要结构化
- 课程依赖关系必须结构化

不能因为 Markdown 好写，就回退成大段 prose。那样 agent 无法稳定生成，校验也无从做起。

### 4. 下一个关键抽象不是 module，而是 course graph
现在的最小内容单位基本是 module，这没错；但如果要进入多专题阶段，必须再引入 **course-level graph**。

也就是说，至少要有：

- `Course`
- `Module`
- `NarrativeBlock`
- `ConceptMapSchema`
- `InteractionSpec`

而 `Course` 里必须有：

- audience
- learning goals
- module ordering
- prerequisite / dependency graph
- topic boundary

否则一旦进入第二个主题，首页、路径推荐、知识地图都会开始失去结构依据。

### 5. 交互层需要从“组件映射”升级成“能力映射”
现在 registry 更像：

- s01 → 用 A 组件
- s03 → 用 B 组件

这对单专题够用，但不够 engine。

更好的抽象应该是：

- 这个模块需要什么认知动作？
  - compare
  - step-through
  - variable manipulation
  - graph exploration
  - pipeline trace
  - scenario testing
- 再由 engine 去匹配合适的组件模板

也就是从：

> `module -> component`

升级成：

> `pedagogical need -> interaction capability -> concrete component`

这一步非常关键，因为它决定未来 agent 是“挑组件”，还是“理解教学目标后选能力”。

### 6. 校验系统是 engine 的核心，不是附属脚本
现在的校验链已经证明方向正确。

未来应该继续升级为三层：

#### 内容有效性
- schema 完整
- 字段存在
- 关系合法

#### 教学有效性
- 每章是否有 focus question
- 是否有 worked example / steps
- bridge 是否存在
- concept map 是否覆盖核心概念

#### 发布有效性
- render 是否成功
- prerender smoke 是否通过
- 关键路由是否存在

也就是说，引擎不仅校验“能不能 build”，还应该逐步校验“像不像一个学习产品”。

---

## 建议的引擎分层（v1）

### Layer 1 — Rendering Engine
- App shell
- module page shell
- tabs
- concept map renderer
- narrative block renderer
- interaction renderer
- theme / typography / density system

### Layer 2 — Content Model
- course schema
- module schema
- narrative block spec
- concept graph spec
- interaction spec
- labels / metadata

### Layer 3 — Validation Layer
- schema checks
- structural checks
- pedagogical checks
- prerender checks

### Layer 4 — Course Package Layer
- `courses/llm/`
- future `courses/postgresql/`
- future `courses/causal-inference/`

### Layer 5 — Authoring / Agent Layer
- scaffold generation
- structured draft generation
- review queue
- publish workflow

---

## 建议的数据模型（最小集合）

### Course schema
应该至少包含：
- `id`
- `title`
- `subtitle`
- `audience`
- `learningGoals[]`
- `topicBoundary`
- `modules[]`
- `dependencyGraph`
- `visualTheme?`

### Module schema
应该至少包含：
- `id`
- `title`
- `subtitle`
- `category`
- `focusQuestion`
- `opening`
- `quote`
- `keyInsight`
- `narrative[]`
- `logicChain[]`
- `examples[]`
- `counterexamples[]`
- `pitfalls[]`
- `bridgeTo`
- `conceptRefs[]`
- `interactionNeeds[]`

### Interaction capability schema
建议引入：
- `type`: compare / stepper / simulator / graph / tracer / calculator / quiz
- `goal`: what cognitive job this interaction serves
- `requiredInputs`
- `expectedFeedback`
- `complexity`
- `fallbackRenderer`

这比直接把某个 React 组件绑死在某章上更通用。

---

## 反面模式

### Anti-pattern 1 — 做成大而全知识集合站
这样会把专题化深度学习体验稀释成内容仓库。

### Anti-pattern 2 — 退回富文本中心
这会让结构、校验、agent 生成全部失去抓手。

### Anti-pattern 3 — 过度抽象，一开始就做万能引擎
如果第二主题都还没压测过，就开始抽象一套庞大平台，大概率会抽象错。

### Anti-pattern 4 — 把交互当 UI 装饰件
交互必须有认知任务，否则只会增加噪音和维护成本。

---

## 暂定结论

Learning Site Engine 的正确方向不是：

> 一个能装很多知识页面的网站

而是：

> 一个能承载复杂知识学习体验的结构化引擎

当前最应该做的不是继续修样式，而是：

1. 拆清 engine / course package
2. 引入 course-level schema
3. 引入 interaction capability schema
4. 升级 validation 为 pedagogy-aware
5. 选第二个主题做压力测试

---

## 本轮主要来源

- Hygraph: *Building a learning platform: The schema*
- JSON Schema official getting started docs
- 教育知识图谱 / curriculum graph 方向的系统综述与 EduKG 相关论文线索（详见 `99-sources.md`）
