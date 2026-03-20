# 03 — AI / Agent 架构

## 研究目标

要回答的问题不是“AI 能不能写页面”，而是：

> **怎样的 Agent 架构，才能把主题输入可靠地转成高质量、可校验、可审核的学习站内容？**

如果这个问题答错，系统会沦为：

- 结构看起来完整
- 语言看起来流畅
- 教学上却非常空心

---

## 核心判断

### 1. 不应该做 one-shot site generation
最危险的路径是：

> 主题输入 → LLM 一次性吐出整站 JSON → 发布

这几乎肯定会生成：

- 模块顺序乱
- 焦点问题不尖
- 概念图关系假装存在
- 交互组件只是贴图
- narrative 只有 prose，没有教学节奏

所以 Agent 必须是一个 **pipeline**，不是一个大 prompt。

### 2. Anthropic 的判断是对的：能用 workflow 就别先上 agent
Anthropic 那篇 *Building Effective Agents* 最值钱的点，不是“agent 很强”，而是：

- workflows 和 agents 要区分
- 能用简单 workflow 解决的，别先上高自治 agent
- 复杂度只有在结果显著提升时才值得引入

这对你这个项目特别关键。

Learning Site Engine 其实非常适合先走：

- workflow first
- structured output first
- human review first

而不是一开始就做高自治 multi-agent 炫技系统。

### 3. 这个场景最适合 planner → composer → critic → reviewer 结构
从当前任务分解看，最自然的最小系统不是 10 个 agent，而是 4 个角色：

#### 1) Topic Framer / Planner
负责：
- 确定目标用户
- 确定 learning goals
- 划定 topic boundary
- 拆模块
- 生成 dependency graph
- 给每章定义 focus question

#### 2) Lesson Composer
负责：
- 生成 module schema 内容
- 写 opening / key insight / narrative blocks / pitfalls / bridge

#### 3) Visual Mapper
负责：
- 概念图 schema
- comparison / steps / diagram 建议
- interaction capability 建议

#### 4) Critic / QA
负责：
- 结构完整性检查
- 叙事跳跃检查
- 模块顺序合理性检查
- “像不像学习产品”检查

然后进入：

#### 5) Human Review Gate
这是必须的人类关卡，不是 optional enhancement。

---

## 为什么必须 structured outputs
这一类系统里，LLM 最不该直接输出的就是“大段漂亮 prose”。

正确方式应该是：

- Planner 输出 `course schema`
- Composer 输出 `module schema`
- Visual Mapper 输出 `concept map schema` + `interaction spec`
- Critic 输出结构化 rubric / issues list

这样系统才能：

- 自动校验
- 自动 build
- 自动比较版本
- 强制人审重点

JSON Schema / typed schema 在这里不是工程洁癖，而是防止 agent 变成瞎写机器的硬约束。

### 对当前项目的直接启示
未来 agent 的每一阶段都应该定义：

- input schema
- output schema
- allowed failure
- review gate

没有这层，所有“agentic”都会很快烂掉。

---

## 推荐的 MVP Agent Pipeline

### Stage 1 — Topic framing
输入：主题描述
输出：
- audience
- goals
- boundary
- success criteria

必须人审：**是**

因为这个阶段一错，后面全错。

### Stage 2 — Curriculum planning
输入：topic frame
输出：
- module list
- ordering
- prerequisite graph
- focus question per module

必须人审：**强烈建议是**

这是课程质量的根。

### Stage 3 — Module drafting
输入：一个模块定义
输出：
- opening
- quote
- keyInsight
- narrative blocks
- logicChain
- examples / counterexamples / pitfalls
- bridgeTo

必须人审：**抽样 + 重点模块全审**

### Stage 4 — Visual / interaction planning
输入：模块内容
输出：
- concept map schema
- recommended interaction capabilities
- block-level visualization hints

必须人审：**是**

因为“视觉是否真的帮助理解”目前模型很容易自嗨。

### Stage 5 — QA / Critique
输入：完整 course package
输出：issues list：
- factuality risks
- ordering problems
- weak focus questions
- missing worked examples
- bad bridges
- mismatched visuals

必须人审：**否，但必须阅读结果**

### Stage 6 — Build / publish gate
输入：通过 review 的结构化内容
输出：
- check
- build
- smoke
- deploy candidate

必须人审：**发布前 yes**

---

## 评价标准（rubric）

如果没有 rubric，你根本不知道 agent 生成得好不好。

最低限度要评这 7 条：

1. **事实准确性**
2. **课程顺序是否合理**
3. **焦点问题是否尖锐**
4. **有没有真正的 worked example / step-by-step**
5. **概念图是否匹配内容结构**
6. **交互是否真的服务理解**
7. **模块桥接是否自然**

这比单纯的“语言通顺吗”重要得多。

---

## 单 Agent vs Multi-Agent

### 当前最现实的建议
**不要一开始就做重型 multi-agent。**

先做：

- one orchestrator
- 3–4 个明确阶段
- 每阶段结构化输出
- 中间插入 critic / review gate

### 为什么
因为你现在真正难的不是 orchestration，而是：

- schema 还在演化
- pedagogy rules 还在凝固
- 第二主题还没压测

现在过早做复杂 agent 编排，只会把问题从“产品结构不清”伪装成“系统很高级”。

---

## 反面模式

### Anti-pattern 1 — 让 agent 直接写“完整页面 prose”
这样会失去结构化校验能力。

### Anti-pattern 2 — 没有 human gate 就发布
教学产品不是随便写写的内容工厂。

### Anti-pattern 3 — 用 agent 代替课程设计
agent 可以提议，不该单独决定课程顺序。

### Anti-pattern 4 — 评价指标只看 factuality
教学质量、叙事结构、概念图匹配度同样关键。

---

## 暂定结论

Learning Site Engine 的 AI 入口应该被定义为：

> **结构化课程生成工作流**

而不是：

> **自动写站机器人**

当前 MVP 最合理的形态是：

- planner workflow
- structured generation
- critic pass
- human review gate
- build/publish gate

Agent 不是替代设计，而是把设计流程结构化、提速、并可追踪。

---

## 本轮主要来源

- Anthropic: *Building Effective Agents*
- LangChain: *Plan-and-Execute Agents*
- JSON Schema official docs
- 人审 / approval gate 方向的工程实践资料线索（详见 `99-sources.md`）
