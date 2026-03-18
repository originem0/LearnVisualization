# 17. Legacy Source Retirement Plan

> 目的：明确 `src/content/zh` 从“当前主内容源”退场的路径。  
> 当前状态：runtime 默认已切到 `courses/llm-fundamentals/`，但脚本层和文档层仍有大量旧源依赖。

---

## 一、结论先行

`src/content/zh` 现在已经不再是 runtime 默认内容源，
但它仍然是：

- 多个校验脚本的主输入
- `new-module.mjs` 的默认输出位置
- 若干 README / research 文档里的默认说明对象

所以它当前的真实状态不是“已废弃”，而是：

> **兼容期中的 legacy source**

这意味着不能直接删，但已经可以开始计划退场。

---

## 二、当前仍然依赖旧源的地方

### A. runtime / adapter
- `src/lib/data.ts` 仍然 import 了 `@/content/zh`
- 但这部分已经降级为 fallback / legacy 路径

### B. 校验脚本
下面这些脚本仍然直接读 `src/content/zh`：

- `scripts/check-content.mjs`
- `scripts/check-structure.mjs`
- `scripts/check-authoring.mjs`
- `scripts/check-registry.mjs`
- `scripts/check-course-package.mjs`（把旧源当对照项）
- `scripts/compare-course-sources.mjs`（显式对照旧源与镜像源）

### C. 脚手架
- `scripts/new-module.mjs` 仍然往 `src/content/zh/modules` 写入

### D. 文档说明
以下文档仍默认把 `src/content/zh` 当当前主源：

- `README.md`
- `src/content/README.md`
- `courses/README.md`
- `courses/llm-fundamentals/README.md`
- 若干 research 文档中的过渡期表述

---

## 三、退场分阶段建议

## Phase 4（当前）
已完成：
- runtime 默认切换到 mirrored course package
- `legacy` 仍可显式回退
- mirrored package 已进入 build guardrails

## Phase 5（下一步）
目标：**让脚本层不再把旧源当唯一真相**

需要做：
1. 给校验脚本增加“主检查课程包、可选检查旧源”能力
2. `new-module.mjs` 改为默认向 `courses/llm-fundamentals/modules` 输出
3. README 改写为：`courses/` 是主内容源，`src/content/zh` 是兼容层

## Phase 6
目标：**旧源降级为镜像 / fallback**

需要做：
1. 如果保留旧源，就把它改成由课程包生成，而不是手写主源
2. compare script 继续保留一段时间，确保镜像与兼容层一致

## Phase 7
目标：**彻底下线旧源**

前提：
- runtime 不再依赖旧源
- 校验脚本已切到课程包主路径
- 新模块脚手架已切换
- 文档已全部更新

届时可删除：
- `src/content/zh/*`
- 与其强耦合的旧检查逻辑

---

## 四、最优先的三个动作

### 动作 1
先改 `scripts/new-module.mjs`，让新模块默认进 `courses/llm-fundamentals/modules`。

原因：
- 不要再让新内容继续流入 legacy 路径
- 这是最重要的“行为切换点”

### 动作 2（已完成）
`check-content.mjs` / `check-structure.mjs` / `check-authoring.mjs` / `check-registry.mjs` 已切到课程包主检查路径。

这意味着：
- 校验脚本层已经承认课程包是主源
- 旧源开始真正退居兼容对照层

### 动作 3
更新 `README.md` 与 `src/content/README.md`。

原因：
- 文档是行为暗示
- 现在它们还在鼓励未来的你继续往旧源里写东西

---

## 五、风险提醒

### 风险 1：过早删除旧源
会丢失 fallback，且会让 compare / migration 失去参照物。

### 风险 2：runtime 已切，但 authoring 还在旧源
这会制造双主源混乱，是最危险状态之一。

### 风险 3：文档不改
未来的你或 agent 会继续往错误位置写内容。

---

## 六、一句话结论

`src/content/zh` 现在最准确的身份是：

> **正在退场的兼容层，而不是未来主内容源。**

接下来最关键的，不是删它，而是：

> **阻止新的内容继续流向它。**
