# 00. Research Overview

这个目录服务一个明确目标：

> 把 `LearnVisualization` 从一个 LLM 专题网站，抽象成一个 **Learning Site Engine**，并设计一个 **Agent 作为内容生成入口**。

---

## 这套 research 试图回答的 3 个问题

### 1. 为什么这种网站形式对复杂知识有效？
对应文件：
- `01-learning-science-and-cognition.md`

核心关注：
- Cognitive Load Theory
- Worked Example Effect
- Multimedia Learning
- Concept Maps
- Retrieval Practice
- Threshold Concepts

产出目标：
- 提炼出未来产品必须遵守的教学原则

---

### 2. 这种网站怎样抽象成引擎，而不是继续做成单专题站？
对应文件：
- `02-learning-site-engine-architecture.md`

核心关注：
- structured content
- schema-driven rendering
- engine vs course package 分层
- curriculum graph
- visual / interaction schema
- validation-first publishing

产出目标：
- 为后续 schema 和系统边界设计提供基础

---

### 3. AI / Agent 应该怎么接进来？
对应文件：
- `03-ai-agent-architecture.md`

核心关注：
- workflow vs autonomous agents
- planner / composer / critic / review gate
- structured outputs
- source-grounded generation
- human-in-the-loop

产出目标：
- 为 agent MVP 路线和 workflow 设计提供基础

---

## 目前最重要的统一结论

### 结论 1
这个项目不该变成“知识集合站”。

更合理的方向是：

- 当前站点作为第一个专题实例
- 往上抽象成 Learning Site Engine
- 未来支持多个专题课程包

### 结论 2
这个项目的核心价值不是“内容很多”，而是：

- 焦点问题驱动
- 概念关系外显
- 分步推导
- 交互验证
- 模块桥接

也就是：

**复杂知识的可学习表达系统**

### 结论 3
Agent 不应该是一键自动建站器。

更合理的定义是：

**结构化课程生产系统**

它负责：
- topic framing
- curriculum planning
- research synthesis
- lesson composition
- visual mapping
- critique / QA

最终仍保留 human review gate。

---

## 下一步建议

基于这轮 research，后续应该做的事情不是继续大聊概念，而是：

1. 从 research 里抽出硬约束
2. 写新的 engine-oriented `DESIGN.md`
3. 定义 Course Schema v1
4. 定义 Interaction Capability Schema v1
5. 定义 Agent Workflow v1
6. 用第二专题做压力测试

---

## 这份目录后续可能新增的文件

- `04-product-principles.md`
- `05-course-schema-v1.md`
- `06-agent-workflow-v1.md`
- `07-second-topic-stress-test.md`

也就是说，这个目录会逐渐从“研究资料夹”长成“系统设计输入层”。
