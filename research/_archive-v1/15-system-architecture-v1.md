# 15. System Architecture v1

> 目的：把 Learning Site Engine 从“网站 + 想法”进一步推进成一个**分层明确、可持续演化**的系统架构。  
> 核心原则：**前端负责展示，engine 负责编译与校验，agent backend 负责生成与研究。**

---

## 一、结论先行

现在这个项目最需要的，不是“换更高性能的语言”，而是：

> **把 Frontend、Engine、Agent Backend 三层边界彻底分开。**

换语言解决不了当前的关键问题。

当前的关键问题是：
- 课程如何被建模
- 生成流程如何被约束
- 页面如何只承担展示职责
- AI 工作流如何从站点 runtime 中抽离
- 课程包如何成为稳定契约

也就是说，这个阶段的核心不是 CPU 性能，而是：

- 系统边界
- 数据流
- 校验链
- 教学质量控制

---

## 二、推荐的三层架构

```txt
[ Agent Backend ]
  主题输入 / research / 生成 / critique / review workflow
          ↓
[ Course Package ]
  course.json / modules / visuals / interactions
          ↓
[ Engine / Build Layer ]
  validate / transform / compile / export
          ↓
[ Frontend ]
  render / interact / learn
```

---

## 三、每一层到底负责什么

## 3.1 Frontend / Presentation Layer

### 职责
- 渲染课程内容
- 渲染概念图 / narrative blocks / 交互组件
- 响应用户操作
- 呈现学习路径、导航、页面状态

### 明确不负责
- 不做 research
- 不做 agent orchestration
- 不持有 secrets / provider keys
- 不进行长链内容生成
- 不直接承担课程生产逻辑

### 输入
Frontend 不该直接吃“原始生成结果”，而应该只吃编译后的课程包或其投影。

### 输出
- 页面
- 轻交互反馈
- 用户学习行为（如果未来需要 analytics）

### 当前技术栈
- Next.js
- React
- TypeScript

### 结论
这一层继续用当前栈就对了。  
没有任何迫切理由为了“性能”重写。

---

## 3.2 Engine / Build Layer

### 职责
- 定义 schema
- 读取课程包
- 做 validation
- 将课程包转换成前端可消费结构
- 校验 visual / interaction / graph consistency
- build / export / smoke test

### 它更像什么
它更像：
- 编译器
- 装配线
- 课程包验证器

而不是网站页面层。

### 输入
- course packages
- visual schemas
- interaction registry
- design rules

### 输出
- frontend-ready data
- validation reports
- static export assets

### 当前技术栈建议
继续 **TypeScript**。

原因：
- 现有站点全在 TS
- schema / json / types 最顺手
- 和 frontend 共享类型方便
- 当前不是性能瓶颈层

### 结论
Engine 是当前最适合继续 TS 化的层。

---

## 3.3 Agent Backend / Research Backend

### 职责
- topic framing
- curriculum planning
- research search / fetch / synthesis
- lesson composition
- visual mapping
- critique / revision
- review workflow
- queue / state / versioning

### 它不应该属于哪里
- 不应该在浏览器里
- 不应该和页面 runtime 混成一锅
- 不应该和静态站 build 过程死耦合

### 为什么必须独立
因为它涉及：
- provider secrets
- 模型调用成本控制
- 多阶段任务状态
- 长流程失败恢复
- 审核与批准闸门
- research / fetch / retry / caching

这天然就是后端系统，不是前端功能。

---

## 四、课程包为什么是整个系统的稳定边界

Course Package 是三层之间最重要的契约。

### 它解决的问题
#### 对 Frontend
- 不必知道内容怎么生产出来
- 只负责渲染

#### 对 Engine
- 有稳定输入可以校验与编译

#### 对 Agent Backend
- 有明确输出目标，而不是自由散文

### 它应该包含
- course metadata
- audience
- learning goals
- paths
- module graph
- modules
- visuals
- interactions
- retrieval prompts

### 一句话
Course Package 是这个系统的“中间语言”。

---

## 五、为什么不能把所有代码都打包到前端

## 原因 1：安全
模型 key、搜索 key、review workflow 都不该暴露给浏览器。

## 原因 2：复杂流程不属于浏览器
课程生成不是一次点击完成的动作，而是长流程、多阶段任务。

## 原因 3：前端不该背教学生产逻辑
前端只负责“播放”，不是“制造工厂”。

## 原因 4：可维护性会崩
如果前端既是页面层，又承担 research、agent、生成、审核，你后面根本没法稳步演化。

---

## 六、技术栈建议（现在阶段）

## 6.1 Frontend
**继续 TypeScript / Next.js**

没有争议。

## 6.2 Engine / Build Layer
**继续 TypeScript**

没有争议。

## 6.3 Agent Backend
这里有两个现实选项。

### 方案 A：TypeScript Backend
#### 优点
- 技术栈统一
- 和现有项目集成快
- 共享 types 方便
- 适合先快速跑通

#### 缺点
- 后续 AI / data / experiment 生态不如 Python 顺

### 方案 B：Python Backend
#### 优点
- AI 生态强
- research / embeddings / parsing / evaluation 工具多
- 更适合后面扩 agent 工作流

#### 缺点
- 引入双栈复杂度
- 初期接线成本更高

### 当前建议
#### 如果目标是：先尽快跑通
用 **TypeScript backend**。

#### 如果目标是：给中长期 AI 工作流留空间
Agent Backend 可以考虑 **Python 独立服务**。

### 明确不建议
现在为了所谓“性能”重写成 Rust / Go。

原因：
- 当前瓶颈不在性能
- 在架构边界
- 在 workflow 与质量控制

换 Rust/Go 在这个阶段属于工程高潮，不属于产品推进。

---

## 七、推荐的进程边界

## 7.1 现在的最小可行形态（MVP）

```txt
repo/
  frontend + engine + course packages
separate agent service/
  topic framing / research / generation / critique
```

### 数据流
1. 用户在某个入口输入主题
2. Agent service 生成结构化中间产物
3. 经过人审
4. 写入 course package
5. engine 校验 / build
6. frontend 渲染

---

## 7.2 未来演化形态

```txt
frontend app
engine/build service
agent/research service
course package storage
review/admin interface
```

这时：
- frontend 只管展示
- engine 只管编译与校验
- agent 只管生成与研究
- admin 界面负责 review gate

---

## 八、现在最值得做的不是换语言，而是这 4 件事

### 1. 保持 Frontend 纯净
不把生成逻辑塞进去。

### 2. 巩固 Course Package 契约
现在已经开始成形，要继续强化。

### 3. 让 Engine 成为真正的中间编译层
目前已经有过渡读取层，方向对了。

### 4. 提前把 Agent 设计成独立后端
哪怕一开始很薄，也不要塞前端。

---

## 九、一句话结论

> **现在不需要换更高性能的语言，真正需要的是把前端、engine、agent backend 三层彻底分开。**

技术栈可以暂时保守，架构边界不能再糊。  
只要边界清楚，未来用 TS 还是 Python 继续演化都不晚。
