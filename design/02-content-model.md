# 02. 内容模型 — 课程包的数据结构

> 这份文件定义课程、模块、叙事块、练习的数据结构。它是前端渲染、引擎校验、Agent 生成的共同契约。

---

## Essay-Course 模型（新）

从 2026-06 开始，新课程采用 narrative-essay 数据契约。一门课 = course spine + 4–6 chapters。

### 课程层 (EssayCourse)

```typescript
interface EssayCourse {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  topic: string;
  language: 'zh';
  status: 'draft' | 'review' | 'published';
  
  // 语域：决定叙事风格
  register: 'explainer' | 'essay';

  // 写作/评审模式：决定生成和 judge 使用的内部尺子
  writingMode?: 'conceptual-essay' | 'case-narrative' | 'mechanism-explainer';
  
  // 知识类型（单选）
  knowledgeType: string;  // 'factual' | 'conceptual' | 'procedural' | 'strategic' | 'metacognitive'
  
  // Course Spine — 主线结构
  drivingQuestion: string;      // 贯穿全课的主线问题
  centralTension: string;       // 核心张力（为什么这个问题难/重要）
  overview: {
    whyExists: string;          // 这门课为什么存在
    wherePoints: string;        // 学完后指向哪里
    arc: string[];              // 叙事弧线（3-5 句话概括全课走向）
  };
  
  // 章节列表（4-6 章）
  chapters: string[];           // chapter IDs
}
```

### 章节层 (Chapter)

```typescript
interface Chapter {
  id: string;
  number: number;
  title: string;
  role?: string;                // 这一章在全课中的作用（可选）
  
  // 叙事内容
  narrative: EssayNarrativeBlock[];
  
  // 可选交互高光（插入点由 afterBlock 指定）
  highlight?: {
    kind: 'bespoke' | 'trace';
    component?: string;         // bespoke 必填：组件名
    data?: Record<string, unknown>;  // trace 必填：追踪数据
    caption: string;
    afterBlock: number;         // 插入在第几个 block 之后
  } | null;
  
  // 到下一章的过渡（可选）
  bridge?: string | null;
}
```

### 叙事块 (EssayNarrativeBlock)

```typescript
type EssayNarrativeBlockType = 'text' | 'heading' | 'callout' | 'code' | 'quote';

interface EssayNarrativeBlock {
  type: EssayNarrativeBlockType;
  content: string;
  
  // code 块专用
  lang?: string;                // 'typescript' | 'python' | 'go' | 'rust' | ...
  
  // quote 块专用
  cite?: string;                // 引用来源
}
```

### 语域 (Register) 与知识类型映射

- **explainer**（技术博主解说腔）：适用于 procedural / factual knowledge
- **essay**（思想随笔腔）：适用于 conceptual / strategic / metacognitive knowledge

后端根据 `knowledgeType` 自动推断 `register`，也可手动指定。

`register` 只表示大语域，不表示文体任务。尤其是 `register: 'essay'` 不是“记叙文/故事散文”的同义词。

`writingMode` 是生成与评审内部使用的更细尺子：

- **conceptual-essay**：概念论证、价值辨析、策略判断、元认知模型。适用于 conceptual / strategic / metacognitive。尼采这类哲学课属于这里；不要求人物、情节、场景或个人经历。
- **mechanism-explainer**：事实机制、操作过程、系统状态变化。适用于 factual / procedural / 未知类型。
- **case-narrative**：具体情境、真实案例轨迹或事件过程本身承载主线时使用。不自动默认选择。

旧课程缺少 `writingMode` 时，后端按 `knowledgeType` 推断默认值，不做迁移。

---

## 一、层级结构（遗留模型）

```
CoursePackage
├── course.json          — 课程元数据、概念图、学习路径
├── modules/s01.json     — 单个教学模块
│   ├── 元数据层         — 知识类型、认知层级、教学法
│   ├── 教学内容层       — 叙事块序列
│   ├── 练习层           — 检索/应用/生成练习
│   └── 视觉/交互层      — 概念图引用、交互组件需求
├── visuals/             — 概念图数据
├── interactions/        — 交互组件注册
└── review/              — 审批记录
```

---

## 二、课程层 (CoursePackage)

```typescript
interface CoursePackage {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  goal: string;                          // 一句话：学完能做什么
  language: 'zh' | 'en';
  status: 'draft' | 'review' | 'published';

  // 受众
  audience: {
    primaryAudience: string;
    priorKnowledge: string[];
    desiredOutcome: string;
  };

  // 学习目标（Bloom 层级标注）
  learningGoals: LearningGoal[];

  // 知识类型分布
  knowledgeProfile: KnowledgeType[];     // 这门课主要涉及哪些知识类型

  // 分类
  categories: Category[];

  // 模块图（比线性序列更丰富）
  moduleGraph: {
    order: string[];                     // 默认学习顺序
    edges: ModuleEdge[];                 // prerequisite / bridge / recommended
  };

  // 概念图（比模块图更细粒度）
  conceptGraph: {
    concepts: ConceptNode[];
    edges: ConceptEdge[];
  };

  // 学习路径（可多条）
  paths: LearningPath[];

  // 间隔复习策略（不适用于当前公开展示定位，保留 schema 定义供未来参考）
  // spacingDefaults: { ... };

  // 掌握度策略（不适用于当前公开展示定位）
  // masteryPolicy: { ... };
}

interface LearningGoal {
  statement: string;
  bloomLevel: CognitiveLevel;
  knowledgeType: KnowledgeType;
}

interface ConceptNode {
  id: string;
  name: string;
  knowledgeType: KnowledgeType;
  moduleIds: string[];                   // 哪些模块教这个概念
}

interface ConceptEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'reinforces' | 'contrasts-with';
}
```

---

## 三、模块层 (CourseModule) — 遗留模型

> ⚠️ **遗留模型**：12-module pedagogical checklist 模式正在淘汰，仅 llm-fundamentals 等旧课保留。新课使用 Essay-Course 模型。

```typescript
interface CourseModule {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  category: string;

  // ========== 教学元数据 ==========

  // 知识分类（必选）
  knowledgeTypes: KnowledgeType[];
  primaryCognitiveAction: CognitiveAction;
  bloomLevel: CognitiveLevel;

  // 模块类型（决定渲染策略）
  moduleKind: ModuleKind;

  // 领域教学法（可选，覆盖默认 Merrill 基线）
  domainPedagogy?: DomainPedagogy;

  // 元素交互性（决定脚手架强度）
  elementInteractivity: 'low' | 'medium' | 'high';

  // ========== 教学驱动器 ==========

  focusQuestion: string;                 // 驱动整章的核心问题
  misconception?: string;                // 需要击穿的旧直觉（概念性/策略性模块必填）
  keyInsight: string;                    // 学完这章应得到的认知换挡

  // 开场（Merrill 激活阶段）
  opening: string;
  quote?: string;

  // ========== 概念系统 ==========

  concepts: ConceptItem[];
  logicChain: string[];                  // 因果/逻辑推进步骤

  // ========== 教学内容 ==========

  narrative: NarrativeBlock[];           // 叙事块序列（示范阶段）

  // ========== 练习系统 ==========

  exercises: Exercise[];                 // 应用阶段（新增，替代纯 retrievalPrompts）
  retrievalPrompts: RetrievalPrompt[];   // 整合阶段

  // ========== 脚手架配置 ==========

  scaffoldProgression: ScaffoldLevel[];  // 渐退序列

  // ========== 连接 ==========

  examples: string[];
  counterexamples?: string[];
  pitfalls?: PitfallItem[];
  bridgeTo?: string;                     // 导向下一模块的未解问题
  nextModuleId?: string;
  priorKnowledge?: string[];
  targetChunk: string;                   // 帮用户形成什么认知组块

  // ========== 视觉与交互 ==========

  visuals: VisualRef[];
  interactionRequirements: InteractionRequirement[];
}
```

---

## 四、叙事块 (NarrativeBlock)

v3 将叙事块从 7 种扩展到 13 种，增加了语义标记能力。

```typescript
type NarrativeBlockType =
  // 基础结构（v2 保留）
  | 'heading'                // 小节标题
  | 'text'                   // 正文段落
  | 'code'                   // 代码/伪代码
  | 'diagram'                // 结构图/流程图
  | 'comparison'             // 双向对比
  | 'callout'                // 关键提醒/金句
  | 'steps'                  // 分步推导（worked example）

  // 语义扩展（v3 新增）
  | 'annotated-example'      // 带专家标注的完整示例
  | 'trace'                  // 执行追踪 + 状态表（代码/系统）
  | 'reflection'             // 元认知检查点
  | 'expert-thought'         // 专家隐性推理外显化
  | 'generation'             // 开放式生成提示
  | 'analogy'                // 结构化类比映射
  ;

interface NarrativeBlock {
  type: NarrativeBlockType;
  content: string;
  label?: string;

  // 多媒体学习合规
  isEssential?: boolean;                 // false = 可折叠的非核心内容
  spatiallyLinkedTo?: string;            // 关联块 ID（空间邻近原则）

  // steps 块专用
  steps?: StepItem[];

  // analogy 块专用
  source?: string;                       // 类比来源域
  target?: string;                       // 类比目标域
  mapping?: AnalogMapping[];             // 结构映射

  // annotated-example 块专用
  expertAnnotation?: string;             // 专家推理过程

  // trace 块专用
  stateTable?: StateRow[];               // 每步的状态快照

  // reflection 块专用
  ifStuck?: string;                      // 卡住时的引导
  ifReady?: string;                      // 顺畅时的进阶挑战
}
```

---

## 五、类型枚举（遗留模型）

```typescript
type KnowledgeType =
  | 'factual' | 'conceptual' | 'procedural'
  | 'strategic' | 'metacognitive' | 'situational';

type CognitiveLevel =
  | 'remember' | 'understand' | 'apply'
  | 'analyze' | 'evaluate' | 'create';

type CognitiveAction =
  | 'distinguish' | 'trace' | 'compare' | 'simulate'
  | 'rebuild' | 'reflect' | 'classify' | 'generate';

type ModuleKind =
  | 'concept-clarification'      // 概念澄清
  | 'mechanism-walkthrough'      // 机制追踪
  | 'system-overview'            // 系统全景
  | 'case-study'                 // 案例分析
  | 'meta-reflection'            // 元认知反思
  | 'integration-review'         // 系统整合
  | 'code-lab'                   // 代码实验（v3 新增）
  | 'derivation'                 // 推导证明（v3 新增）
  | 'design-critique'            // 设计批评（v3 新增）
  ;

type DomainPedagogy =
  | 'merrill-fpi'                // 默认：Merrill 五原则
  | 'primm'                      // 代码领域
  | 'cra'                        // 数学领域
  | 'layered-abstraction'        // 系统领域
  | 'cognitive-apprenticeship'   // 隐性知识领域
  | 'design-studio'              // 设计领域
  ;
```

---

## 六、向后兼容（遗留模型）

v3 schema 是 v2 的超集。所有 v2 字段保持兼容：

- `moduleKind` 的 v2 值全部保留
- `narrative` 的 v2 block type 全部保留
- `retrievalPrompts` 保留，`exercises` 是新增字段
- `knowledgeTypes`、`bloomLevel`、`elementInteractivity` 是新增必选字段（v2 课程迁移时需补充）
- `conceptGraph`、`spacingDefaults`、`masteryPolicy` 是新增可选字段
- `exercises` 是新增字段，替代纯 `retrievalPrompts`

v2 → v3 迁移策略：引擎在加载 v2 课程包时，对缺失的 v3 字段使用推断默认值（如 `knowledgeTypes` 默认为 `['conceptual']`，`bloomLevel` 默认为 `'understand'`）。

> **当前落地状态（2026-03-22）**：v3 字段已通过 schema 透明化方案落地。normalize 层从白名单模式改为透传+修正模式——LLM 输出的 knowledgeTypes、bloomLevel、elementInteractivity、exercises 等 v3 字段会自动流入最终 JSON，无需为每个新字段编写提取代码。narrative 的 v3 块类型（reflection、analogy、expert-thought、trace、annotated-example、generation）在后端保留原始类型和字段，前端通过 fallback 渲染链映射到已有视觉模式。concepts 新增 relatedTo 字段支持 Novak 概念图命题式连接词。quality checks 已移除（内容质量由 prompt 控制，不由校验阻断）。engine 校验仅保留 title 和 narrative 存在性为 error，其余降级为 warning。
