# 11. Agent Workflow v1

> 目的：定义 Learning Site Engine 的第一版 Agent 工作流。  
> 这不是“自动建站流程”，而是**结构化课程生产流水线**。

---

## 一、总原则

Agent Workflow v1 必须遵守一句话：

> **Workflow-first, Agent-assisted, Human-gated**

翻译成人话：

- 流程先固定
- AI 在局部节点发挥
- 关键关口必须人审

这意味着我们不要一开始就追求 fully autonomous multi-agent system。  
那会很快把项目带偏成一个昂贵、难调、质量飘忽的内容工厂。

---

## 二、Workflow v1 的目标

Agent Workflow v1 要解决的问题不是：

- 输入主题 -> 一键输出网站

而是：

- 输入主题 -> 输出一套可校验、可审核、可发布的课程结构与页面素材

也就是说，Agent 在这里的角色是：

- 课程规划辅助器
- 研究提炼器
- 结构化写作器
- 视觉映射器
- QA 批评器

不是“神秘的自动老师”。

---

## 三、v1 流程总览

```txt
1. Topic Framing
2. Curriculum Planning
3. Research Synthesis
4. Module Composition
5. Visual Mapping
6. QA / Critique
7. Human Review Gate
8. Export to Course Package
9. Validate + Build
```

---

## 四、各阶段说明

## Stage 1 — Topic Framing

### 目标
把用户的主题从“一个名词”收缩成一个可设计课程的问题空间。

### 输入
- 用户主题
- 受众描述（可选）
- 学习目标（可选）

### 输出（结构化）

```ts
interface TopicFramingOutput {
  topic: string;
  audience: string;
  learningGoals: string[];
  nonGoals: string[];
  assumptions: string[];
  scopeStatement: string;
}
```

### 关键问题
- 这个主题到底讲什么？
- 不讲什么？
- 面向谁？
- 学完之后用户应获得什么变化？

### 风险
- scope 太大
- audience 模糊
- 把用户原问题照单全收，没有重构

### 是否必须人审
**必须。**

---

## Stage 2 — Curriculum Planning

### 目标
把主题拆成模块与依赖图。

### 输入
- Topic Framing 输出
- 初始背景材料（可选）

### 输出（结构化）

```ts
interface CurriculumPlanningOutput {
  moduleIds: string[];
  modules: {
    id: string;
    title: string;
    focusQuestion: string;
    misconception?: string;
    prerequisites?: string[];
    targetChunk?: string;
  }[];
  learningPaths?: {
    id: string;
    title: string;
    moduleIds: string[];
  }[];
}
```

### 关键问题
- 什么顺序最合理？
- 哪些概念是前置？
- 哪些模块属于“核心路径”？

### 风险
- 只列目录，不做依赖图
- focusQuestion 不够尖锐
- 模块切分过粗或过细

### 是否必须人审
**必须。**

---

## Stage 3 — Research Synthesis

### 目标
把检索到的资料转成课程可用素材，而不是一堆链接。

### 输入
- curriculum plan
- 外部检索结果
- 抓取正文
- 现有 research folder 内容

### 输出（结构化）

```ts
interface ResearchSynthesisOutput {
  moduleId: string;
  coreConcepts: string[];
  commonMisconceptions: string[];
  workedExamples: string[];
  usefulComparisons: string[];
  bridgeHints: string[];
  sources: {
    title: string;
    url: string;
    note?: string;
  }[];
}
```

### 关键问题
- 这章最关键的概念是什么？
- 哪些误区最值得打掉？
- 哪个 worked example 最能说明问题？

### 风险
- 变成摘要堆积
- 来源不可靠
- 资料与模块脱节

### 是否必须人审
建议半自动，关键模块要人审。

---

## Stage 4 — Module Composition

### 目标
生成模块级结构化内容对象。

### 输入
- module brief
- research synthesis
- DESIGN.md principles
- Course Schema v1

### 输出（结构化）

```ts
interface ModuleCompositionOutput {
  id: string;
  title: string;
  subtitle?: string;
  moduleKind: ModuleKind;
  primaryCognitiveAction: CognitiveAction;
  focusQuestion: string;
  misconception?: string;
  quote?: string;
  keyInsight: string;
  opening?: string;
  concepts: { name: string; note?: string }[];
  logicChain: string[];
  examples: string[];
  counterexamples?: string[];
  pitfalls?: { point: string; rootCause: string }[];
  narrative: NarrativeBlock[];
  bridgeTo?: string;
}
```

### 核心要求
- 输出必须是 schema-compatible
- 不允许只给 prose
- 必须围绕单一焦点问题展开
- 必须包含 steps / worked example 候选

### 风险
- prose 太多，结构太弱
- 内容正确但教学很烂
- 重复解释，没有节奏

### 是否必须人审
**必须。**

---

## Stage 5 — Visual Mapping

### 目标
把模块内容转成视觉表达与交互需求。

### 输入
- module composition output
- concept relations
- current engine capabilities

### 输出（结构化）

```ts
interface VisualMappingOutput {
  moduleId: string;
  visuals: {
    id: string;
    type: 'conceptMap' | 'processFlow' | 'comparisonFrame' | 'stepSequence';
    purpose: string;
  }[];
  interactionRequirements: {
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
  }[];
}
```

### 关键问题
- 这章最适合哪种图？
- 该不该做交互？
- 做交互是为了什么认知动作？

### 风险
- 视觉变装饰
- 交互变玩具
- capability 判断错误

### 是否必须人审
建议人审。

---

## Stage 6 — QA / Critique

### 目标
对生成结果做结构化批评，而不是只做语法检查。

### 输入
- module content
- visual mapping
- DESIGN.md v2

### 输出（结构化）

```ts
interface CritiqueOutput {
  moduleId: string;
  scores: {
    focusQuestionSharpness: number;
    pedagogicalClarity: number;
    visualFit: number;
    interactionRelevance: number;
    bridgeQuality: number;
  };
  issues: {
    severity: 'low' | 'medium' | 'high';
    message: string;
    fixHint?: string;
  }[];
}
```

### 检查重点
- 焦点问题是否尖
- 开场是否有认知冲突
- steps 是否跳步
- concept map 是否服务重点
- 交互是否真的有必要
- 有无“好看文章化”倾向

### 是否必须人审
不一定，但结果必须对人可见。

---

## Stage 7 — Human Review Gate

### 目标
最终决定是否进入课程包。

### 原则
下面这些必须由人判断：

- 这章值不值得存在
- 这章有没有换挡感
- 这章会不会让人想继续读
- 图和交互是否真的帮助理解
- 内容是否有“味道”和“力度”

### 说明
这是整个工作流里最不能被拿掉的一环。

---

## Stage 8 — Export to Course Package

### 目标
把通过审核的内容导出为 engine 可用课程包。

### 输出
- course json
- modules json
- visual schemas
- registry hints
- validation report

### 说明
到这一步，Agent 的“写作”工作已经结束，剩下进入工程链。

---

## Stage 9 — Validate + Build

### 目标
进入现有工程护栏。

### 执行
- content checks
- structure checks
- schema / registry checks
- authoring checks
- prerender smoke

### 原则
任何 Agent 输出，只要通不过工程护栏，都不算可发布资产。

---

## 五、MVP 实现建议

## 不要一开始就做 multi-agent runtime

v1 最现实的实现方式：

- 一个 orchestrated workflow
- 多个 prompt stage
- 每一 stage 输出结构化 JSON
- 中间结果写文件
- 人审后继续下一步

也就是说：

> **先做清晰生产线，再做自治社会。**

---

## 六、每一阶段该输出什么类型

| Stage | 输出类型 | 是否结构化 | 是否人审 |
|---|---|---|---|
| Topic Framing | topic brief | 是 | 是 |
| Curriculum Planning | module graph | 是 | 是 |
| Research Synthesis | module notes | 是 | 关键处是 |
| Module Composition | module json | 是 | 是 |
| Visual Mapping | visual + interaction requirements | 是 | 建议是 |
| QA / Critique | critique report | 是 | 可选 |
| Review Gate | approval / revision | 半结构化 | 是 |

---

## 七、v1 的非目标

1. 不追求 end-to-end 全自动发布
2. 不追求复杂 agent society
3. 不追求所有阶段都 autonomous
4. 不追求一次生成完整课程就完美
5. 不追求先解决所有主题的通用性

---

## 八、未来升级方向

Workflow v1 稳定后，再考虑：

- second-topic stress test
- richer visual schema generation
- retrieval prompt auto-design
- research memory integration
- registry auto-suggestion
- critique-based rewrite loops

---

## 九、一句话结论

Agent Workflow v1 的本质不是“自动写站”，而是：

> **把课程生产过程拆成一条可生成、可批评、可审核、可校验的流水线。**

只有这样，AI 才能真正服务 Learning Site Engine，而不是把它拖成内容工厂。
