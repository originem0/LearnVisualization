# 10. Course Schema v1

> 目的：定义 Learning Site Engine 的第一版课程数据模型。  
> 这不是最终 TypeScript implementation，而是**系统设计层的 schema 规范**，用于指导后续：
>
> - engine / course 分层
> - 内容文件结构
> - agent structured output
> - validation rules

---

## 一、设计目标

Course Schema v1 需要同时满足 4 件事：

1. **足够结构化**：让 Agent 和校验脚本能处理
2. **足够可写**：人类作者不会被 schema 折磨死
3. **足够教学化**：能表达课程顺序、焦点问题、前知识、图示、交互
4. **足够保守**：先支持当前 LLM 样板，再为第二专题做压力测试

所以 v1 的原则不是追求完美通用，而是：

> **围绕“复杂知识可视化学习站”这一核心场景做稳定抽象。**

---

## 二、分层模型

v1 先固定 5 层：

1. `Course`
2. `ModuleGraph`
3. `Module`
4. `VisualSpec`
5. `InteractionRequirement`

另外，v1 明确加入两个比当前 LLM 样板更高阶的字段：

- `moduleKind`：这一章属于哪种教学模式
- `primaryCognitiveAction`：这一章主要训练什么认知动作

补充说明：
- narrative blocks 仍然属于 Module 内部
- visual / interaction 先独立成引用层，而不是全部塞进 module 主体

---

## 三、Course 顶层 Schema

## 3.1 Course

```ts
interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  topic: string;
  language: 'zh';
  status: 'draft' | 'review' | 'published';

  audience: AudienceProfile;
  learningGoals: string[];
  nonGoals?: string[];
  assumptions?: string[];

  philosophy?: CoursePhilosophy;
  paths?: LearningPath[];
  moduleGraph: ModuleGraph;
  modules: Module[];
}
```

### 字段说明

- `id`：稳定内部 ID
- `slug`：URL / package key
- `topic`：主题标签，例如 `llm-fundamentals`
- `language`：v1 先按 zh-only
- `status`：发布状态
- `audience`：目标用户画像
- `learningGoals`：课程完成后应获得什么
- `nonGoals`：明确不讲什么，防止 scope creep
- `assumptions`：对用户预设的前置条件
- `philosophy`：可选，描述课程的教学取向
- `paths`：学习路径（系统学习 / 快速路径 / 应用路径）
- `moduleGraph`：模块依赖图
- `modules`：模块集合

---

## 3.2 AudienceProfile

```ts
interface AudienceProfile {
  primaryAudience: string;
  priorKnowledge?: string[];
  constraints?: string[];
  desiredOutcome?: string;
}
```

### 为什么必须有这一层

因为前知识是最重要变量。  
同一个主题面对不同前知识的用户，结构顺序会不同。

---

## 3.3 CoursePhilosophy

```ts
interface CoursePhilosophy {
  promise?: string;
  corePrinciples?: string[];
  shiftStatement?: string;
}
```

### 用途

不是给页面直接渲染，而是给 Agent / 设计系统提供上位约束。  
例如：
- 认知升级
- 分解复杂，呈现复杂，穿透复杂
- 不是术语堆砌，而是换挡式理解

---

## 3.4 LearningPath

```ts
interface LearningPath {
  id: string;
  title: string;
  description?: string;
  moduleIds: string[];
}
```

### 用途

支持：
- 全路径
- 核心机制路径
- 应用导向路径

v1 先用静态路径即可。

---

## 四、ModuleGraph Schema

```ts
interface ModuleGraph {
  order: string[];
  edges: ModuleEdge[];
}

interface ModuleEdge {
  from: string;
  to: string;
  type: 'prerequisite' | 'bridge' | 'recommended';
  note?: string;
}
```

### 为什么不能只靠线性顺序

因为未来课程不该只是目录树。  
我们需要显式表达：
- 前置依赖
- 推荐路径
- 章节桥接

v1 可以仍然线性展示，但 graph 必须先存在。

---

## 五、Module Schema

## 5.1 Module

```ts
interface Module {
  id: string;          // e.g. s01
  number: number;      // e.g. 1
  title: string;
  subtitle?: string;
  category: string;
  moduleKind: ModuleKind;
  primaryCognitiveAction: CognitiveAction;

  focusQuestion: string;
  misconception?: string;
  quote?: string;
  keyInsight: string;
  opening?: string;

  priorKnowledge?: string[];
  targetChunk?: string;
  chunkDependencies?: string[];

  concepts: ConceptItem[];
  logicChain: string[];
  examples: string[];
  counterexamples?: string[];
  pitfalls?: PitfallItem[];

  narrative: NarrativeBlock[];
  visuals?: VisualRef[];
  interactionRequirements?: InteractionRequirement[];

  retrievalPrompts?: RetrievalPrompt[];
  bridgeTo?: string | null;
  nextModuleId?: string;
}
```

### 新增的关键字段

相对当前代码库，v1 schema 需要显式新增：

- `moduleKind`
- `primaryCognitiveAction`
- `focusQuestion`
- `misconception`
- `priorKnowledge`
- `targetChunk`
- `chunkDependencies`
- `visuals`
- `interactionRequirements`
- `retrievalPrompts`
- `nextModuleId`

### 为什么加这些

因为模块不只是内容单元，还必须显式表达：

- 这一章在打掉什么旧成见
- 依赖什么前知识
- 试图形成哪个组块
- 需要哪些视觉和交互手段
- 下一章是谁

---

## 5.2 ConceptItem / PitfallItem

沿用现有结构即可：

```ts
interface ConceptItem {
  name: string;
  note?: string;
}

interface PitfallItem {
  point: string;
  rootCause: string;
}
```

---

## 5.3 NarrativeBlock v1

当前 block 类型已经够好，v1 先不激进扩展，只做可控增强。

```ts
interface NarrativeBlock {
  type:
    | 'heading'
    | 'text'
    | 'code'
    | 'diagram'
    | 'comparison'
    | 'callout'
    | 'steps';
  content: string;
  label?: string;
  steps?: StepItem[];
}
```

### 原则

- narrative blocks 是页面语法树，不是富文本替代品
- v1 不急着把一切都抽象成 block
- 先保持 block 类型少而稳

---

## 六、Visual Schema

v1 不直接把所有 visual 内联在 module 里，而是用引用结构。

```ts
interface VisualRef {
  id: string;
  type: 'conceptMap' | 'processFlow' | 'comparisonFrame' | 'stepSequence';
  required: boolean;
}
```

### 6.1 conceptMap v1

当前已有 `concept-map-schemas.json`，可以视为第一版 `conceptMap` 子 schema。  
后续可逐步扩成多种 visual 类型。

### 原则

- v1 不推翻现有 concept map schema
- 只是在 Course Schema 层给它一个正式位置

---

## 七、Interaction Requirement Schema

重点：不要先绑死组件名，而要先描述认知能力需求。

```ts
interface InteractionRequirement {
  capability:
    | 'compare'
    | 'step-through'
    | 'simulate'
    | 'trace'
    | 'classify'
    | 'retrieve'
    | 'parameter-play';
  purpose: string;
  priority: 'core' | 'secondary';
  componentHint?: string;
}
```

### 为什么这样设计

因为未来复用的不是 `QKVStepper` 这个名字，  
而是“这章需要一个 step-through 交互”。

这会让 engine 从“组件表”升级成“能力系统”。

---

## 八、Retrieval Prompt Schema

```ts
interface RetrievalPrompt {
  type: 'predict-next-step' | 'fill-gap' | 'rebuild-map' | 'compare-variants';
  prompt: string;
  answerShape?: string;
}
```

### 原则

v1 先允许 retrieval 作为结构化提示存在，  
不要求当前站点已经全部实现对应交互。

先把“学习设计意图”显式化。

---

## 九、最小 JSON 示例

```json
{
  "id": "llm-fundamentals",
  "slug": "llm-fundamentals",
  "title": "LLM 原理与实践",
  "topic": "llm",
  "language": "zh",
  "status": "published",
  "audience": {
    "primaryAudience": "想系统理解大模型的中文学习者",
    "priorKnowledge": ["基础互联网使用能力"]
  },
  "learningGoals": [
    "理解 LLM 从 token 到生成的完整链路",
    "建立对训练、对齐、prompt、上下文窗口的系统认识"
  ],
  "moduleGraph": {
    "order": ["s01", "s02", "s03"],
    "edges": [
      { "from": "s01", "to": "s02", "type": "prerequisite" },
      { "from": "s02", "to": "s03", "type": "prerequisite" }
    ]
  },
  "modules": [
    {
      "id": "s01",
      "number": 1,
      "title": "Token 与词表",
      "category": "foundations",
      "focusQuestion": "模型为什么不能直接读文本？",
      "misconception": "模型看到的是完整自然语言",
      "keyInsight": "分词器的任务不是切得像人，而是平衡表达能力与计算代价。",
      "targetChunk": "文本 -> token -> 词表 -> ID",
      "concepts": [
        { "name": "BPE", "note": "高频片段合并" }
      ],
      "logicChain": [
        "原始文本不能直接参与矩阵计算",
        "模型必须先把文本切成离散 token"
      ],
      "examples": ["unhappiness -> un + happi + ness"],
      "narrative": [],
      "visuals": [
        { "id": "s01-map", "type": "conceptMap", "required": true }
      ],
      "interactionRequirements": [
        {
          "capability": "simulate",
          "purpose": "让用户亲手观察 tokenization 结果",
          "priority": "core",
          "componentHint": "TokenizerPlayground"
        }
      ],
      "retrievalPrompts": [
        {
          "type": "compare-variants",
          "prompt": "字符级与词级为什么都不理想？"
        }
      ],
      "bridgeTo": "编号本身没有语义，下一章进入 embedding。",
      "nextModuleId": "s02"
    }
  ]
}
```

---

## 十、Validation Rules v1

Schema 进入工程前，至少要有这些校验：

1. `course.id / slug / title / moduleGraph / modules` 必填
2. 每个 module 必须有 `focusQuestion / keyInsight / narrative / logicChain`
3. `moduleGraph.order` 与 `modules[].id` 必须一致
4. `nextModuleId` 必须存在或为空
5. `interactionRequirements.componentHint` 若存在，必须在 registry 可解析
6. `visuals.id` 若存在，必须能解析到 visual schema
7. `retrievalPrompts` 的 `type` 必须在 allowlist 中

---

## 十一、v1 的边界

Course Schema v1 故意**不**做这些：

- 不支持多语言复杂回退
- 不支持动态权限 / 付费门控
- 不支持无限 visual 类型
- 不支持多课程互链图谱
- 不试图覆盖一切教育产品场景

原因：

> 先把“复杂知识可视化学习站”这个核心场景做稳。通用性要通过第二专题压力测试来验证，而不是靠想象。

---

## 十二、一句话结论

Course Schema v1 的本质不是“把内容换个 JSON 形状”，  
而是把课程正式建模为：

> **认知升级路径 + 模块图 + 视觉表达 + 交互需求 + 可校验内容对象。**
