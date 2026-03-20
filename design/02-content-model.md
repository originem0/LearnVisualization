# 02. 内容模型 — 课程包的数据结构

> 这份文件定义课程、模块、叙事块、练习的数据结构。它是前端渲染、引擎校验、Agent 生成的共同契约。

---

## 一、层级结构

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

  // 间隔复习策略
  spacingDefaults: {
    initialDelayModules: number;         // 首次复习间隔（模块数）
    expansionFactor: number;             // 间隔扩展系数
    interleavingPolicy: 'none' | 'within-unit' | 'across-units';
  };

  // 掌握度策略
  masteryPolicy: {
    defaultThreshold: number;            // 0-1，达标分数
    decayEnabled: boolean;               // 是否允许技能衰减
  };
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

## 三、模块层 (CourseModule)

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

## 五、练习系统 (Exercise)

v3 新增独立的练习层，超越原来的 retrievalPrompts。

```typescript
interface Exercise {
  id: string;
  type: ExerciseType;
  bloomLevel: CognitiveLevel;
  knowledgeType: KnowledgeType;
  scaffoldLevel: ScaffoldLevel;

  prompt: string;
  responseType: ResponseType;

  // 渐退元数据
  workedStepsShown?: number;
  workedStepsOmitted?: number;

  // 反馈
  hints?: string[];                      // 递进提示（教练阶段）
  expertAnnotation?: string;             // 专家思路

  // 间隔复习
  spacingRecommendation?: {
    initialDelayModules: number;
    expansionFactor: number;
  };
}

type ExerciseType =
  // 通用
  | 'fill-blank' | 'rebuild-map' | 'compare-variants' | 'predict-next-step'
  | 'classify' | 'explain' | 'free-response' | 'self-explanation'
  // 代码专用 (PRIMM)
  | 'predict-output' | 'trace-execution' | 'parsons-problem'
  | 'modify-program' | 'write-program' | 'debug'
  // 数学专用 (CRA)
  | 'concrete-manipulation' | 'abstract-symbolic'
  // 系统专用
  | 'trace-through-layers'
  // 设计专用
  | 'critique' | 'exemplar-analysis'
  ;

type ResponseType = 'select' | 'generate' | 'arrange' | 'code' | 'explain' | 'draw';

type ScaffoldLevel = 'full' | 'faded-1' | 'faded-2' | 'free';
```

---

## 六、类型枚举

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

## 七、向后兼容

v3 schema 是 v2 的超集。所有 v2 字段保持兼容：

- `moduleKind` 的 v2 值全部保留
- `narrative` 的 v2 block type 全部保留
- `retrievalPrompts` 保留，`exercises` 是新增字段
- `knowledgeTypes`、`bloomLevel`、`elementInteractivity` 是新增必选字段（v2 课程迁移时需补充）
- `conceptGraph`、`spacingDefaults`、`masteryPolicy` 是新增可选字段

v2 → v3 迁移策略：引擎在加载 v2 课程包时，对缺失的 v3 字段使用推断默认值（如 `knowledgeTypes` 默认为 `['conceptual']`，`bloomLevel` 默认为 `'understand'`）。
