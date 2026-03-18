# 14. Runtime Transition Plan v1

> 目的：说明如何把当前运行层从 `src/content/zh` 逐步过渡到 `courses/llm-fundamentals/`，同时不打断现有站点。

---

## 当前状态

项目现在已经同时拥有两套内容形态：

1. **运行源**：`src/content/zh`
2. **镜像课程包**：`courses/llm-fundamentals/`

二者当前并存，站点实际运行仍然依赖第一套。

---

## 新增的过渡能力

本轮新增了：

- `src/lib/course-package-adapter.ts`
- `getMirroredCoursePackage()`
- `getMirroredStateData()`
- `getMirroredData()`

这意味着代码层已经具备：

> **从镜像课程包读取，并转换成当前 `StateData` 形状的能力。**

但当前还没有切换默认读取源。

---

## 为什么先不直接切换

因为当前系统里还有几个关键点仍然绑定旧结构：

- `src/content/zh/index.ts`
- 现有内容校验脚本
- module registry 与 concept map schema 的路径约定
- 部分工程护栏默认围绕旧目录设计

如果现在直接切换默认读取源，很容易把当前稳定站点打断。

---

## 推荐的过渡顺序

### Phase 1（已完成）
- 建立课程包镜像
- 建立读取适配层
- 保持站点继续跑旧源

### Phase 2（下一步）
- 增加 `USE_MIRRORED_COURSE_PACKAGE` 这种显式开关（或内部 helper）
- 在本地验证从镜像源读取是否能完整渲染当前站点

### Phase 3
- 让校验脚本同时检查：
  - 旧源
  - 镜像课程包

### Phase 4
- 当镜像课程包与运行站点完全一致时，切换默认读取源
- 旧 `src/content/zh` 进入兼容期，最终下线

---

## 关键原则

1. **绝不为了抽象而破坏现有站点稳定性**
2. **先适配，再切换；先并存，再替换**
3. **任何迁移都必须保留 build/check/smoke 全绿**

---

## 一句话结论

运行时迁移的关键不是“尽快换源”，而是：

> **先证明镜像课程包已经能完整承载当前站点，再让 runtime 慢慢把它接进来。**
