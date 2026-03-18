# 04 — 对后续项目设计的直接启示

这份文件不是研究摘要，而是把前 3 份研究直接转成下一轮项目设计输入。

---

## A. 对 `DESIGN.md` 的启示

当前 `DESIGN.md` 已经抓住了几件重要的事：

- 焦点问题
- 反直觉开场
- 概念图
- 对比图
- 分步图示
- 自己动手试
- 控制节奏
- 即时反馈

这是非常好的第一代教学设计约束。

但如果要进入 **Learning Site Engine** 阶段，`DESIGN.md` 还应该补上 3 组规则。

### 1. 学习科学规则
建议补进 `DESIGN.md` 的新增原则：

- 每章至少包含一个 worked example 或 step-by-step derivation
- 图与文必须分工，不允许重复复述同一信息
- 连续过程必须可分段控制
- 交互必须服务变量操控 / 回忆 / 验证，不允许装饰性交互
- 教材设计要区分理解阶段与检索阶段

### 2. 引擎化规则
建议补进 `DESIGN.md` 的系统约束：

- 模块不是文章，而是结构化课程对象
- 视觉表达必须可被 schema 化
- 交互能力要先于具体组件定义
- 课程必须允许 graph / prerequisite 表达，不应只假设线性顺序

### 3. Agent-ready 规则
建议补进 `DESIGN.md` 的 authoring 约束：

- 每个模块必须有机器可提取的 focus question
- 每个模块必须有可校验的 key insight
- 概念图和 steps 必须可结构化生成
- 允许人工写 prose，但最终要落到 schema 中

---

## B. 对代码层的启示

### 1. 先拆 engine / course package
下一轮技术设计最优先的，不是再修视觉，而是重构 repo 边界：

- `engine/` or engine-like core
- `courses/llm/`

### 2. 引入 course-level schema
现在 module-level 已经不错，但还缺：

- audience
- goals
- topic boundary
- prerequisite graph
- path recommendations

### 3. 引入 interaction capability schema
现在 registry 还是偏 topic-bound。下一轮应该定义：

- compare
- stepper
- simulator
- graph explorer
- pipeline tracer
- self-check

这样 agent 才能推荐“交互能力”，不是硬绑具体组件。

### 4. validation 要逐渐从 structural 进化到 pedagogical
未来 check 不只检查：

- 字段在不在
- schema 对不对

还应该检查：

- 是否存在 focus question
- 是否存在 worked example / steps
- 是否存在 bridge
- 概念图是否覆盖关键概念

---

## C. 对 Agent MVP 的启示

最小可做版本不是“输入主题生成全站”，而是：

1. Topic framing
2. Curriculum planning
3. Module drafting
4. Concept-map drafting
5. Critique
6. Human review
7. Build

如果这个 MVP 做成，已经很强了。

---

## D. 建议的下一步顺序

### Phase 1 — 抽象系统边界
- 拆 engine / course package
- 定义 course schema v1
- 定义 interaction capability schema v1

### Phase 2 — 用第二主题做压力测试
推荐主题：
- PostgreSQL internals
- causal inference
- operating systems

### Phase 3 — 再做 Agent MVP
等 schema 稳一点再做，不然 agent 只会追着漂移的接口跑。

---

## 一句话总结

后面真正应该做的不是：

> 再把这个 LLM 网站润色得更像成品

而是：

> 把它从“作品”推进成“系统”
