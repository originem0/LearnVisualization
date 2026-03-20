# 18. PostgreSQL Internals — 第二专题压力测试（Course Schema v1）

> 目的：用一个「非 LLM」且结构高度工程化的主题，检验 `Course Schema v1` 是否真的能承载未来的 Learning Site Engine。
> 
> 默认决策：第二专题选择 **PostgreSQL Internals**。

---

## 1. 为什么 PostgreSQL Internals 是合适的压力测试

PostgreSQL Internals 的难点并不是“概念多”，而是：

- **概念与实现强耦合**：很多关键结论来自 on-disk/in-memory 结构与并发协议，不是抽象理论。
- **“因果链条”比“定义列表”重要**：理解 MVCC/WAL/VACUUM 的关键不是背术语，而是看到它们互相制约。
- **学习结果可被验证**：用 SQL / `EXPLAIN` / `pg_visibility` / `pg_waldump` / `pgbench` 等可以对“是否理解”做更客观的检验。
- **需要可视化与交互**：很多机制在文本里很难直观（tuple header / visibility / page layout / index traversal / snapshot timeline）。

这使它天然适合验证 v1 schema 的两个目标：

1) 课程是否能建模为 **“认知升级路径 + 模块图”**；
2) 单章是否能表达 **“核心问题 → 关键洞见 → 逻辑链 → 可视化/交互需求 → retrieval”**。

---

## 2. 用 v1 schema 建模的可行性结论（结论先行）

**结论：v1 schema 足够承载 PostgreSQL Internals 的首版课程包**，但会暴露 3 个“下一版必须补齐”的点：

1. **实验/动手任务（Lab）** 的结构化表达（环境、步骤、验证方式）
2. **可观测性/工具链** 的显式引用（例如 `EXPLAIN (ANALYZE, BUFFERS)` 的输出形状）
3. **跨章节的“持久对象”**（例如同一个 demo table/index 在多章反复演进）

好消息是：这 3 点都可以在 v1 里先“保守落地” —— 暂时塞进 `narrative` 的 `code/text/steps` blocks + `retrievalPrompts`，不需要推翻 schema；坏消息是：如果不尽快抽象 `LabSpec`，未来课程包会变成“很多章各自塞步骤”，难以复用与自动校验。

---

## 3. v1 schema 在本专题中最关键的承载方式

### 3.1 模块图（ModuleGraph）不是装饰品

Postgres 内核的理解不是线性目录，而是一个强依赖网络：

- MVCC（可见性） ↔ VACUUM（清理/冻结） ↔ 索引（dead tuples 带来的膨胀与性能）
- WAL（redo） ↔ checkpoint ↔ crash recovery ↔ full page write
- planner/executor ↔ statistics ↔ buffer cache/page fetch

因此 **moduleGraph.edges** 必须被当成“显式依赖声明”，而不是仅保留 order。

### 3.2 章节类型（moduleKind）要覆盖“机制讲解 + 案例拆解 + 系统综述”

Postgres 适配当前 allowlist：

- `mechanism-walkthrough`：MVCC、WAL、B-Tree traversal
- `case-study`：一次 UPDATE/DELETE 的生命周期、一次 crash recovery 的 replay
- `system-overview`：存储层 + buffer 管理 + WAL + vacuum 的总体拼图
- `integration-review`：把 query pipeline 与存储一致性合起来回看

### 3.3 交互需求（interactionRequirements）可以先按“能力系统”描述

Postgres 的交互更像：

- `trace`：跟踪一条 tuple 从插入到可见性的状态变化
- `simulate`：模拟 snapshot、xmin/xmax、事务提交顺序
- `step-through`：一步步走 B-Tree 查找/分裂
- `compare`：对比有无索引/不同 join 策略的执行计划

即便前端还没实现这些组件，**能力声明先存在**，就能指导 engine 的演进（从“页面渲染器”走向“学习能力渲染器”）。

---

## 4. 课程边界（防止 scope creep）

本专题的首版（v0.1）只承诺：

- 解释清楚 **MVCC / WAL / Index / Planner / Vacuum** 五大支柱如何互相制约
- 给出可复现的最小实验（可以在本地/容器跑），用于验证理解

明确不做：

- 不讲 C 源码级细节（函数名/宏/锁实现细节）
- 不做“运维最佳实践大全”（那是 DBA 课程，不是 internals）
- 不覆盖所有索引类型（先 B-Tree；GIN/GiST 作为扩展）

---

## 5. v1 schema 暴露出的缺口（建议在 v1.1 或 v2 解决）

### 缺口 1：Lab / 实验步骤缺少结构化对象

v1 目前只能用 narrative 的 `steps` + `code` 表达。
建议 v1.1 增加：

- `lab?: LabSpec[]`（可选）
- `LabSpec` 内含 `environment`（docker image/pg version）、`setupSteps`、`tasks`、`verification`、`expectedArtifacts`

### 缺口 2：工具输出缺少“机器可解析的引用”

例如：

- `EXPLAIN` 的 plan tree
- `pg_waldump` 的 record types

建议在 visuals 里扩展 `type: 'outputShape' | 'planTree'`，或者新增 `ArtifactsRef`。

### 缺口 3：跨章共享的“示例世界（DemoWorld）”

Postgres 很适合用一个贯穿的 demo schema：

- `accounts` 表
- 一个 btree index
- 一组事务脚本

建议 v2 引入：

- `course.demoWorld`（可选）
- module 通过引用它的版本（v1 可以先在 narrative 里约定）。

---

## 6. 推荐的首版模块切分（用于落地 course package）

> 目标：4–6 章即可形成“能跑通的理解闭环”，不追求百科。

建议 6 章：

1. **s01 Storage & Pages**：表/heap、page、tuple header、HOT 的直觉
2. **s02 MVCC & Visibility**：xmin/xmax、snapshot、可见性判断的因果
3. **s03 WAL & Crash Recovery**：redo、checkpoint、full page write、为什么能恢复
4. **s04 B-Tree Index Internals**：查找/分裂/回收、为什么会膨胀
5. **s05 Query Planner/Executor Pipeline**：从 SQL 到 plan 到执行、统计信息的作用
6. **s06 VACUUM / Autovacuum / Freeze**：dead tuple、visibility map、freeze、与 MVCC 的闭环

依赖图核心边：

- s01 → s02（没有 page/tuple 就谈不清可见性）
- s02 → s06（MVCC 的债务由 vacuum 清理）
- s01 → s03（WAL 记录对象落在 page/tuple 语义上）
- s01 → s04（索引最终也是 page/tuple）
- s04 → s05（planner 如何利用索引）
- s05 → s06（性能问题最终回到膨胀/清理）

---

## 7. 本压力测试对 Learning Site Engine 的“验证点清单”

如果我们能用这个专题跑通，则说明 engine 分层真的有效：

- Course package 能独立存在（`courses/postgresql-internals/*`）
- engine 未来能“加载并渲染”这些模块，而不依赖 legacy `src/content/zh`
- interaction 能先以 capability 声明存在，等组件实现后再逐步对接
- retrieval prompts 能被 agent-backend 复用（生成自测题/卡片/复盘）

---

## 8. 当前状态标记

- 本文件：**成品（可读、可评估）**
- course package：在 `courses/postgresql-internals/` 落地（见后续提交）
- schema 改动：**草案**（仅提出缺口，不在本次直接改 v1）
