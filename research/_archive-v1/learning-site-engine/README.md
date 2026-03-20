# Learning Site Engine Research

这是针对 **LearnVisualization → Learning Site Engine** 的第一轮 deep research 沉淀。

目标不是做学术综述，而是回答三个更硬的问题：

1. **复杂知识为什么难学？什么表达结构更有效？**
2. **如何把当前网站抽象成一个可复用的学习站引擎？**
3. **AI / Agent 应该怎样接入，才能生成高质量课程，而不是生成垃圾页面？**

## 文件说明

- `01-learning-science.md`  —— 学习科学 / 认知机制底盘
- `02-engine-architecture.md` —— 学习站引擎架构抽象
- `03-agent-architecture.md` —— AI / Agent 工作流与架构
- `04-design-implications.md` —— 对后续项目设计的直接启示
- `99-sources.md` —— 第一轮研究来源与访问情况
- `DESIGN.md` —— 当前设计规范快照

## 当前状态

这是 **v0.1 first-pass research**：已经足够支撑下一轮产品设计，但还不是最终研究归档版。

约束说明：

- 当前 Brave / `web_search` 不可用
- 本轮实际使用 `ddg-search` + `web_fetch` 做研究
- 部分论文 / PDF /站点存在抓取限制，所以这轮报告是“可访问资料 + 可验证工程判断”的结合

## 这轮研究最核心的结论

### 1. 你做的不是普通内容站
LearnVisualization 的价值不在“把知识写出来”，而在于把复杂知识转成：

- 焦点问题
- 关系图
- worked examples
- 分步推导
- 轻交互验证
- 模块桥接

这是一种 **pedagogy-aware rendering system**，不是博客主题皮肤。

### 2. 当前网站值得抽象成引擎
但它现在更像：

> 一个高质量的 LLM 专题模板

而不是：

> 一个经过压力测试的通用学习站引擎

所以接下来要做的不是继续“修页面”，而是把：

- engine 层
- course package 层
- agent 层
- human review 层

拆清楚。

### 3. Agent 必须是结构化生产入口，不是自动写站器
最合理的方向不是：

> 用户输入主题 → AI 一次性生成整站

而是：

> 用户输入主题 → Agent 生成课程结构 / 模块 / 概念图 schema / narrative 初稿 / 交互建议 → 自动校验 → 人审 → 发布

没有 human review，这个方向几乎必翻车。
