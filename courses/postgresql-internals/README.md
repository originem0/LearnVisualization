# postgresql-internals

这是 Learning Site Engine 的第二专题候选：**PostgreSQL Internals**。

定位：
- 不是 DBA 运维课
- 不是源码逐行阅读
- 是把 MVCC / WAL / Index / Planner / Vacuum 这条“内核因果链”建模为可视化学习对象

当前状态（v0.1）：
- `course.json`：课程元信息 + module graph + path
- `modules/`：6 章内容（其中 s02/s03 为高质量样板，其余为骨架但可读）
- `visuals/concept-maps.json`：最小 concept-map 镜像（只覆盖部分章节，允许后续补齐）
- `interactions/registry.json`：按 capability 描述的交互需求（组件未实现也可先声明）

关联设计：
- 压力测试报告见 `research/18-postgresql-internals-stress-test.md`
