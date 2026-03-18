# 13. Module Archetypes v1

> 目的：防止 Learning Site Engine 被当前 LLM 样板页面结构绑死。
> 我们复用的不是“页面长相”，而是“教学模式”。

---

## 一、为什么需要 Module Archetypes

当前 LLM 网站已经形成了一套好用的页面习惯，但那只是**一个专题样板**。

如果直接把这种页面形状固化成未来模板，就会出现三个问题：

1. 把当前专题的表达习惯误当成通用骨架
2. 让不同类型的章节被迫穿同一件衣服
3. 让 schema 退化成“当前页面有哪些块”的镜像

所以未来真正应该稳定下来的，不是某一页的长相，而是：

> **这一章属于哪种教学模式，它主要想训练用户做什么认知动作。**

---

## 二、v1 建议的 ModuleKind

### 1. `concept-clarification`

#### 适用场景
- 某个概念经常被误用
- 用户“会说但不真懂”
- 需要区分相邻概念边界

#### 核心任务
- 打掉旧概念
- 澄清边界
- 给出真正有用的定义

#### 常见 block / visual
- comparison
- callout
- concept neighborhood map

#### 示例
- token 是什么
- prompt 是什么 / 不是什么

---

### 2. `mechanism-walkthrough`

#### 适用场景
- 要解释一个“怎么发生”的过程
- 有清晰步骤链路

#### 核心任务
- 让用户跟随机制流动
- 降低高元素交互性的瞬时负荷

#### 常见 block / visual
- steps
- process flow
- trace / step-through interaction

#### 示例
- BPE 合并
- 注意力计算
- 反向传播

---

### 3. `system-overview`

#### 适用场景
- 主题需要整体鸟瞰
- 章节作用是定锚，而不是展开细节

#### 核心任务
- 给全貌
- 建立坐标感
- 说明每部分在系统里的位置

#### 常见 block / visual
- concept map
- route panel
- global comparison

#### 示例
- 首页路径页
- Transformer 全局结构

---

### 4. `case-study`

#### 适用场景
- 用一个具体案例反推抽象原理
- 强调“知识如何进入现实”

#### 核心任务
- 从案例中抽出模型
- 让用户看到迁移

#### 常见 block / visual
- worked example
- comparison
- trace

#### 示例
- 烂 prompt -> 强 prompt
- 一个训练预算如何反推模型规模

---

### 5. `meta-reflection`

#### 适用场景
- 主题讨论的不是对象知识本身，而是学习、理解、认知、问题意识

#### 核心任务
- 提升元层理解
- 改写学习方式或问题框架

#### 常见 block / visual
- comparison
- callout
- relationship map

#### 示例
- 什么是理解
- 为什么有些问题是伪问题

---

### 6. `integration-review`

#### 适用场景
- 需要把前面各章拼回一个系统
- 课程回顾 / 统整章节

#### 核心任务
- 从零件回到机器
- 强化模块间依赖图
- 帮用户获得连续播放整条链的能力

#### 常见 block / visual
- global pipeline
- rebuild prompt
- review map

#### 示例
- s12 系统化回顾

---

## 三、v1 建议的 Primary Cognitive Action

每章除了属于一种 `moduleKind`，还应该有一个主要认知动作。

### `distinguish`
帮助用户分辨概念边界。

### `trace`
帮助用户沿着机制链路追踪信息流。

### `compare`
帮助用户并列看见差异。

### `simulate`
帮助用户通过操作验证规律。

### `rebuild`
帮助用户从部分重建整体。

### `reflect`
帮助用户改写问题框架或学习框架。

---

## 四、为什么这比“固定页面模板”更重要

因为同样是模块页，不同章节的第一任务不同：

- 有的重点是区分概念
- 有的重点是走完整个机制
- 有的重点是给全局地图
- 有的重点是用案例反推规律
- 有的重点是元层反思

如果所有章节都按一种页面模板硬套，最后会得到：

- 有些页太轻
- 有些页太重
- 有些交互只是摆设
- 有些 visual 不承担核心任务

所以：

> **未来 schema 应该先表达“教学模式”和“认知动作”，再决定页面如何排布。**

---

## 五、对后续工程的直接要求

### 1. Course Schema
在 `CourseModule` 中加入：
- `moduleKind`
- `primaryCognitiveAction`

### 2. Agent Workflow
在 Curriculum Planning / Module Composition 阶段输出这两个字段。

### 3. 页面渲染层
未来不要只按固定顺序渲染所有 block，而应根据 archetype 决定默认重心。

---

## 六、一句话结论

我们要复用的不是当前 LLM 样板页的长相，
而是：

> **不同类型知识章节各自对应的教学模式与认知动作。**
