# 02. Learning Site Engine Architecture

> 目标：回答一个问题——**当前 LearnVisualization 要怎样从“LLM 专题网站”变成“可复用的可视化学习站引擎”。**

---

## 一、结论先行

当前代码库已经有“引擎雏形”，但还不是完整 engine。

最准确的判断是：

> **它已经是一个高质量的 vertical prototype，但还没完成从作品到系统的抽象。**

它之所以值得继续做，不是因为页面好看，而是因为已经长出了引擎必须具备的几个关键特征：

- 内容结构化（不是散乱文章）
- narrative blocks 形成可渲染语法
- concept map 逐渐 schema 化
- registry 驱动模块能力挂接
- check / build / smoke 构成发布护栏

这说明它不是普通内容站，而是已经接近：

- content as data
- schema-driven rendering
- validation-first publishing

---

## 二、这一轮 research 对引擎设计的启示

## 1. 课程内容必须是分层对象，不是单一文档

Hygraph 那篇 learning platform schema 虽然是普通内容平台视角，但有一个判断很对：

**不要把课程建模成单一 rich text 文档。**

因为一旦这样做：

- 内容难以重组
- 无法挂接模块级 gating / rendering / 交互
- 不利于后续 agent 生成
- 不利于 schema 校验

### 对我们系统的启示

最少要有这几层：

1. `Course`
2. `Module`
3. `Lesson / Narrative Block`
4. `Visual / Interaction Assets`

而你现在其实已经有：

- 项目级元信息
- 模块级内容
- narrative blocks
- concept map schema
- registry-interaction mapping

这就是为什么它值得抽象，而不是推倒重做。

---

## 2. Engine 和 Course Package 必须分离

现在 repo 里，engine 与课程实例还揉在一起。

但如果你真的想做成可复用学习站引擎，必须尽快在概念上切开：

### Engine 层
负责：
- page layout
- narrative block renderer
- concept map renderer
- interaction capability system
- validation scripts
- build / deploy pipeline
- design system

### Course Package 层
负责：
- 课程元信息
- 目标用户 / 学习目标
- 模块图
- 每章内容
- 每章图示 schema
- 每章交互配置

这是未来多专题支持的分水岭。

---

## 3. 课程不是目录树，而应该是依赖图

研究里最有启发的一点不是 CMS，而是 curriculum graph / standards alignment / GraphRAG 那类系统思路：

**教学内容不是平面列表，而是带依赖关系的图。**

AWS 那篇教育 standards alignment 虽然场景不同，但它有两点非常重要：

1. 结构关系要显式建模，不能全丢给 LLM 现场推断
2. 图结构 + 语义检索结合，比只靠文本序列更稳

### 对我们系统的启示

未来的 engine 不该只知道“s01 到 s12 的顺序”，还应该知道：

- prerequisite edges
- concept dependencies
- optional branches
- fast-track path
- application path

这会直接影响：

- 首页学习路径
- layers 页面
- 课程推荐
- agent 自动生成课程结构

---

## 4. Visual schema 不能只停留在一个 concept-map renderer

当前 concept map schema 化是对的，但还不够。

因为可视化学习站未来不只会有一种图：

- 概念关系图
- 流程图
- 对比图
- 时间演化图
- 系统结构图
- 参数影响图

### 对我们系统的启示

未来 schema 至少要分成：

- `conceptMap`
- `processFlow`
- `comparisonFrame`
- `stepSequence`
- `metricVisualization`

否则后面所有视觉表达都会硬塞进一种图语法里，最后很难看也很难维护。

---

## 5. Interaction 不能按“组件名”建模，要按“认知能力”建模

你现在 registry 做到模块 → 交互组件映射，这已经很好了。 
但要变 engine，下一步不能继续按：

- s03 -> QKVStepper
- s08 -> PromptWorkshop

而应该抽象成：

- 这个模块需要什么认知动作？
  - compare
  - step-through
  - simulate
  - trace
  - classify
  - retrieve
  - manipulate parameter

然后再决定用哪种组件去承载。

这一步非常关键。

因为引擎复用的不是具体组件名，而是：

**交互能力类型（interaction capabilities）**

---

## 三、建议的引擎分层模型

## Layer 1 — Engine Core

- routing / layouts
- visual block renderer
- tabs / nav / theme / metadata
- deploy pipeline

## Layer 2 — Pedagogical Rendering System

- narrative block types
- visual block types
- interaction capability types
- spacing / typography / emphasis rules

## Layer 3 — Course Schema Layer

- course metadata
- audience
- learning goals
- module graph
- module content
- concept schemas
- interaction requirements

## Layer 4 — Validation Layer

- content completeness
- schema integrity
- graph integrity
- block validity
- publishability checks

## Layer 5 — Authoring / Generation Layer

- manual authoring
- scaffold generation
- agent output
- review workflow

---

## 四、建议的 Schema Families

## 1. Course schema
最少应包含：

- id
- title
- topic
- audience
- learning goals
- prerequisites
- module graph
- learning paths
- glossary / cross-cutting concepts

## 2. Module schema
最少应包含：

- id / slug
- title / subtitle
- focus question
- quote
- key insight
- logic chain
- examples / counterexamples / pitfalls
- bridge to next
- narrative blocks
- concept map reference
- required interaction capabilities

## 3. Visual schema
最少应包含：

- visual type
- nodes / edges / labels
- emphasis points
- animation / step metadata
- complexity level

## 4. Interaction capability schema
不要写死组件名，而应定义：

- capability: `compare | step | simulate | trace | retrieve | classify | compose`
- input shape
- output shape
- pedagogical purpose
- optional concrete component binding

## 5. Validation schema

- required fields
- allowed block types
- bridge consistency
- graph completeness
- concept/interaction references existence

---

## 五、当前系统哪里已经够好，哪里还不够

## 已经够好的部分

1. split content source
2. narrative blocks
3. concept map schema 化方向
4. module registry
5. build / check / smoke pipeline
6. zh-only reality check（不假装支持没做完的语言）

## 还不够的部分

1. engine 与 course 未分离
2. 课程图仍偏线性，不是真 graph-first
3. visual schema 不够多态
4. interaction schema 还不是 capability-first
5. authoring / generation pipeline 尚未系统化

---

## 六、对下一步设计最重要的建议

1. **先定义 Course Schema v1，而不是先写更多页面。**
2. **先把 interaction 从组件表提升为 capability system。**
3. **把 module graph 显式化。**
4. **保持 validation-first，不要为了 agent 而放松约束。**
5. **下一次通用性验证，必须拿第二主题做压力测试。**

---

## 七、一句话结论

LearnVisualization 值得抽象成引擎，不是因为它已经足够通用，
而是因为它已经具备了：

**结构化内容 + 渲染语法 + 视觉 schema + 发布护栏**

这四件事一旦齐了，就已经不是普通网站，而是可以继续长成系统的底盘。

---

## Sources

- Hygraph, *Building a learning platform: The schema*  
  https://hygraph.com/blog/building-learning-platform-schema
- AWS Public Sector Blog, *Aligning education state standards to content for K12 with GraphRAG on AWS*  
  https://aws.amazon.com/blogs/publicsector/aligning-education-state-standards-to-content-for-k12-with-graphrag-on-aws/
- ddg-search results on curriculum graph / structured content / schema-driven UI (first-pass source pool)
