# 12. Engine Directory Structure v1

> 目的：给 Learning Site Engine 一个现实可执行的目录重构方案。  
> 原则：**先分层、后迁移；先保运行、后抽离；先建立边界，再逐步移动代码。**

---

## 一、问题定义

当前仓库已经具备了 engine 雏形，但结构上仍然是：

- 站点代码
- 课程内容
- 交互组件
- 研究文档
- 引擎抽象草案

全部混在一个 repo 里、且大都挂在 `src/` 下。

这在“单专题网站”阶段没问题，但一旦目标变成：

- 复用为 Learning Site Engine
- 支持多个专题
- 接入 Agent 结构化生成

那现在这种目录结构就会开始拖后腿。

所以这一步的目标不是立刻大搬家，而是：

> **先定义清楚哪些东西属于 engine，哪些属于 course package，哪些属于 research / planning。**

---

## 二、目录重构的总原则

### 1. 运行路径不能先被打断

当前网站已经在线上运行，build 与部署链稳定，所以重构时不能先破坏：

- `src/app`
- `src/components`
- `src/content/zh`
- `src/lib`
- `scripts/*`

### 2. 先做“边界抽离”，再做“代码迁移”

先定义未来目录，不代表今天就要把所有代码搬进去。

v1 阶段最重要的是：

- 明确目标目录
- 让新内容先按未来结构落
- 旧内容通过过渡层继续工作

### 3. repo 先维持单仓库

暂时不拆成多 repo。

原因：
- 当前还在高频设计与验证阶段
- 过早拆仓库只会增加摩擦
- 在第二专题压力测试前，没必要上多仓库复杂度

---

## 三、目标目录结构（Target Layout v1)

建议未来逐步收敛到下面这个结构：

```txt
engine/                    # 引擎级文档与未来可抽离代码的目标位置
courses/                   # 课程包目录（未来支持多专题）
  llm-fundamentals/
    course.json
    modules/
    visuals/
    interactions/
examples/                  # schema / workflow / course package examples
research/                  # research syntheses / design input
scripts/                   # 校验、构建、脚手架
src/
  app/                     # 当前 Next.js 运行入口（暂不动）
  components/              # 当前渲染组件（逐步抽象）
  lib/                     # 当前 types / registry / schema 草案
  content/                 # 现运行中的课程内容（过渡层）
```

---

## 四、各目录的职责边界

## 4.1 `engine/`

### 作用
放置未来真正属于 engine 的抽象层说明，逐步成为可抽离代码的目标位置。

### 现在应该放什么
- engine 设计说明
- engine / course 边界说明
- 未来 renderer / capability / validation 分层说明

### 现在不建议放什么
- 直接把 `src/components` 整坨搬过去
- 当前还在高频变化的运行时代码

---

## 4.2 `courses/`

### 作用
成为未来课程包的正式宿主。

### 每个课程包建议结构

```txt
courses/
  llm-fundamentals/
    course.json
    modules/
      s01.json
      s02.json
    visuals/
      concept-maps.json
    interactions/
      registry.json
```

### 为什么要这样拆

因为课程包真正要承载的是：
- 课程元信息
- 模块内容
- 可视化数据
- 交互需求

而不是 Next.js 页面代码。

---

## 4.3 `examples/`

### 作用
作为 schema / workflow / package 的对照样例层。

### 现在已经有
- course package example
- topic framing example
- curriculum planning example
- workflow example

### 后续可继续放
- module composition example
- critique output example
- visual mapping example

---

## 4.4 `research/`

### 作用
作为设计输入层，不是资料坟场。

### 它的职责
- 沉淀 research synthesis
- 吸收 Sharon 提供的思想材料
- 提炼产品哲学
- 为 DESIGN / schema / workflow 提供依据

### 原则
只放“可设计输入”，不放原始资料 dump。

---

## 4.5 `src/`

### 作用
当前运行层。

短期内继续保留：
- `src/app` 作为 Next.js 入口
- `src/components` 作为运行时组件集合
- `src/content/zh` 作为现课程内容源
- `src/lib` 作为现有 schema / registry / types 过渡层

### 关键判断
`src/` 暂时不代表“引擎本体”，只代表“当前运行实现”。

---

## 五、推荐迁移顺序

## Phase 0 — 文档与边界已建立（当前）

已经完成：
- research 层
- DESIGN.md v2
- course schema 草案
- agent workflow 草案
- examples 层

## Phase 1 — 建立目录壳（现在可以做）

需要做：
- 建 `engine/README.md`
- 建 `courses/README.md`
- 建 `courses/llm-fundamentals/README.md`

目的：
- 占位
- 让 repo 边界开始清晰
- 后续新内容优先往新目录落

## Phase 2 — 让课程包有一份正式镜像

需要做：
- 把当前 LLM 课程按未来结构在 `courses/llm-fundamentals/` 下镜像一份
- 暂时不改运行时入口

目的：
- 验证 schema 能否承载当前课程
- 为后续内容迁移做准备

## Phase 3 — 加过渡读取层

需要做：
- 在 `src/lib/data.ts` 增加从课程包读取的能力
- 让当前运行层可以选择：
  - 旧 `src/content/zh`
  - 新 `courses/llm-fundamentals/`

目的：
- 运行时不被打断
- 逐步从旧内容源过渡到课程包

## Phase 4 — 抽离 capability / visual registry

需要做：
- 逐步把 interaction requirement 与 componentHint 分离
- 从“模块绑定组件”过渡到“模块声明能力，registry 决定实现”

## Phase 5 — 第二专题压力测试

在真正重构更多代码之前，必须先拿第二个主题验证：
- schema 是否足够
- visual 类型是否够用
- workflow 是否成立

---

## 六、当前最推荐的下一步

不是马上移动大堆代码，
而是先做一个非常稳的动作：

### 推荐动作
1. 建立 `engine/` 与 `courses/` 目录占位
2. 在 `courses/llm-fundamentals/` 下放一份 README 与未来结构说明
3. 下一步再做“LLM 课程包镜像”

理由：
- 风险低
- 路径清晰
- 不影响当前运行
- 可以立即让 repo 结构长出引擎感

---

## 七、一句话结论

目录重构的关键不是“把文件搬来搬去”，而是：

> **先让 engine、course、research、runtime 四层边界变清楚。**

只要边界对了，迁移只是时间问题；边界不清，搬得越快死得越快。
