# 03. AI / Agent Architecture

> 目标：回答一个问题——**如果要让 AI 成为 Learning Site Engine 的内容生成入口，它应该怎么设计，才不会生成一堆看起来像文章、实际上很烂的课程页面。**

---

## 一、结论先行

Agent 在这个项目里应该被定义成：

> **课程结构化生产系统**

而不是：

> **一键自动建站工具**

这两个方向差别巨大。

如果你把它理解成一键建站，它很快会生成：

- 模块顺序错乱
- 焦点问题不尖
- prose 太多、结构太弱
- 概念图是装饰品
- 交互只是玩具
- 桥接和依赖关系全靠胡编

所以这里最重要的判断是：

**Agent 的任务不是替代教学设计，而是把教学设计流程结构化、半自动化。**

---

## 二、Anthropic 那篇对我们最有价值的点

Anthropic 的《Building Effective Agents》有三个判断，对这个项目非常关键：

### 1. 能不用 agent 就别用 agent

这句话对你尤其重要。

因为很多所谓 agent 系统，其实只是：

- 把一个 prompt 拆成五个 prompt
- 再加一层框架包装
- 结果成本更高、调试更难、质量没变好

### 对我们的启示

Learning Site Engine 里，不是所有环节都要 agent 化。

应该优先把：

- schema
- validation
- workflow
- review gates

先定住，再决定哪部分适合 agent。

---

### 2. Workflows 和 Agents 要分开想

Anthropic 的区分很重要：

- **Workflow**：预定义步骤，流程可控
- **Agent**：模型动态决定下一步做什么

### 对我们的启示

这个项目的大部分阶段，其实更适合 workflow，而不是 fully autonomous agent。

因为课程生产是高质量要求任务，最怕的就是“自由发挥”。

所以理想结构是：

- **大框架是 workflow**
- **局部节点才用 LLM agent 能力**

也就是：

1. 主题界定
2. 课程规划
3. 资料提炼
4. 章节生成
5. 图示建议
6. QA 批评
7. 人工审核
8. 发布

整体流程应该是固定的。只有每个阶段内部，LLM 才做生成或判断。

---

### 3. 简单、透明、可审计 比“智能感”重要

Anthropic 一直强调：

- simplicity
- transparency
- clear tool interface

### 对我们的启示

这个项目最不该做的是“神秘 agent”。

最该做的是：

- 每一步输入输出都清楚
- 每一步尽量结构化
- 每一步失败都能定位
- 每一步都知道是谁负责

否则后面调试会地狱化。

---

## 三、建议的 Agent 总体架构

## 总原则

### Workflow-first, Agent-assisted, Human-gated

翻译成人话就是：

- **流程先固定**
- **生成由 AI 辅助**
- **关键节点必须人审**

---

## 建议的 7 阶段架构

## Stage 1 — Topic Framer

### 任务
把用户输入的主题收紧为可设计课程的问题空间。

### 输入
- 用户主题
- 目标受众
- 学习目标
- 边界要求

### 输出
- topic definition
- audience profile
- learning goals
- non-goals
- course scope

### 说明
这一步如果错，后面全错。

### 是否必须人审
**必须。**

---

## Stage 2 — Curriculum Planner

### 任务
把主题拆成模块图，不是只列目录。

### 输入
- topic framing 结果
- 初始研究材料 / 大纲

### 输出
- module list
- prerequisite graph
- recommended sequence
- module-level focus questions

### 说明
这里应该更像“课程规划器”，不是写手。

### 是否必须人审
**必须。**

---

## Stage 3 — Research Synthesizer

### 任务
把外部资料提炼成课程可用的结构。

### 输入
- 检索结果
- 抓取正文
- 课程模块图

### 输出
- 核心概念
- 常见误区
- worked examples
- 关键比较项
- 桥接关系
- source-grounded notes

### 说明
这一步一定要 source-grounded。

### 是否必须人审
建议人审关键模块，但可部分自动。

---

## Stage 4 — Lesson Composer

### 任务
生成每章结构化内容，而不是单段长文。

### 输入
- module brief
- research notes
- pedagogy rules
- block schema

### 输出
- opening
- quote
- keyInsight
- narrative blocks
- logicChain
- examples
- counterexamples
- pitfalls
- bridgeTo

### 说明
这里的输出必须结构化，不能是自由 prose。

### 是否必须人审
**必须。**

---

## Stage 5 — Visual Mapper

### 任务
把章节内容映射成视觉表达与交互需求。

### 输入
- module content
- concept relationships
- interaction capabilities

### 输出
- concept map schema
- comparison blocks
- steps blocks
- suggested interaction capability

### 说明
不要让 AI 直接发明炫酷图形。要让它产出可校验 schema。

### 是否必须人审
建议人审。

---

## Stage 6 — Critic / QA Agent

### 任务
站在“教学质量审核”的角度批评生成结果。

### 检查项
- 焦点问题是否尖锐
- 是否有重复叙述
- steps 是否跳步
- concept map 是否服务本章重点
- 交互是否真的帮助理解
- bridge 是否自然
- 有没有退化成漂亮文章

### 输出
- critique report
- severity tags
- revision suggestions

### 是否必须人审
不一定，但必须在最终发布前可见。

---

## Stage 7 — Human Review Gate

### 任务
最后决定发不发布。

### 为什么不能去掉
因为教学产品质量不是纯事实校验，很多是：

- 顺序对不对
- 节奏对不对
- 比喻准不准
- 哪一句最该砍
- 哪个交互根本没认知价值

这些今天还不该全交给模型。

---

## 四、哪些必须结构化，哪些可以自由生成

## 必须结构化的

- topic framing output
- module graph
- focus questions
- module schema
- narrative blocks
- concept map schema
- interaction requirements
- QA rubric results

## 可以适度自由生成的

- opening prose
- quote 候选
- example 候选
- bridgeTo 初稿
- critique 解释文字

一句话：

**结构必须稳定，文风可以灵活。**

---

## 五、最重要的质量 rubric

这个项目不能只做 factuality review。

最少应该有这 7 个维度：

1. **事实准确性**
2. **课程顺序合理性**
3. **焦点问题尖锐度**
4. **教学清晰度**
5. **视觉表达匹配度**
6. **交互必要性**
7. **模块桥接质量**

如果只查事实，不查教学结构，最后出来的会是“正确但很烂”的页面。

---

## 六、MVP 应该怎么做，别一口吃成胖子

## MVP 版本不要做 fully autonomous multi-agent

最现实的 MVP：

### Workflow
1. 用户输入主题
2. Topic Framer 输出课程边界
3. Curriculum Planner 输出模块图
4. Research Synthesizer 提炼每章素材
5. Lesson Composer 生成结构化章节 JSON
6. Visual Mapper 生成图示 schema
7. Critic 输出 QA 报告
8. 人工审核
9. 写入 repo，运行 check/build

### 技术实现上
- 先用单 orchestrator workflow + 多个 prompt stage
- 不急着上复杂 multi-agent runtime
- 先把 schema 和审核关卡建稳

也就是说：

**先像一条清晰的生产线，不要先像一个“自治社会”。**

---

## 七、最大的风险

## 风险 1：把 agent 当成自动写手
后果：生成很多 prose，结构崩。

## 风险 2：没有 source-grounding
后果：教学材料胡说八道但看起来有逻辑。

## 风险 3：没有 human gate
后果：产品质量不可控。

## 风险 4：schema 不够硬
后果：agent 输出无法校验，也无法稳定渲染。

## 风险 5：一开始就搞复杂 multi-agent
后果：调试困难，收益不成比例。

---

## 八、一句话建议

这个项目的 agent 不应该被设计成：

> “输入主题，自动生成网站。”

而应该被设计成：

> “输入主题，生成一套可校验、可审核、可发布的课程结构与页面素材。”

这才是靠谱的工程方向。

---

## Sources

- Anthropic, *Building Effective Agents*  
  https://www.anthropic.com/engineering/building-effective-agents
- LangChain Blog, *Plan-and-Execute Agents*  
  https://blog.langchain.com/planning-agents/
- Google ADK docs, *LLM agents*  
  https://google.github.io/adk-docs/agents/llm-agents/
- IBM, *LLM Agent Orchestration*  
  https://www.ibm.com/think/tutorials/llm-agent-orchestration-with-langchain-and-granite
- Additional first-pass search pool collected through ddg-search
