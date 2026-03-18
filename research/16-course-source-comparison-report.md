# 16. Course Source Comparison Report

> 目的：对比当前运行源 `src/content/zh` 与镜像课程包 `courses/llm-fundamentals/` 的一致性，评估 runtime 默认切换前的风险。  
> 生成方式：基于 `scripts/compare-course-sources.mjs` 的首轮结果人工整理。

---

## 一、结论先行

当前镜像课程包整体健康，已经足以进入：

- 双轨读取
- build 护栏
- 本地镜像源验证

但还**不建议直接切为默认源**，因为仍存在少量结构差异需要明确确认。

---

## 二、对比结果摘要

### Top-level
- Legacy title: `LLM 原理与实践`
- Mirrored title: `LLM 原理与实践`
- Legacy categories: `5`
- Mirrored categories: `5`
- Legacy modules: `12`
- Mirrored modules: `12`

### 初步结论
顶层课程信息已经基本对齐。

---

## 三、模块级对比结果

首轮自动比较结果：

- `s01`: narrative length drift
- `s02`: OK
- `s03`: narrative length drift
- `s04`: narrative length drift
- `s05`: OK
- `s06`: OK
- `s07`: OK
- `s08`: narrative length drift
- `s09`: OK
- `s10`: OK
- `s11`: OK
- `s12`: OK

### 汇总
- 出现差异的模块：`4 / 12`
- 差异类型目前集中在：`narrative length drift`

---

## 四、差异的可能原因

当前最可能的原因不是内容真丢失，而是：

> 在镜像课程包生成时，原始 narrative 中的第一条“焦点问题 heading”被提升为独立字段 `focusQuestion`，因此不再保留为 narrative block。

这会导致：
- legacy narrative block 数量更大
- mirrored narrative block 数量略少

如果确认这一点属实，那么这类差异是：

- **设计性差异**
- 不是内容缺失
- 不会阻止未来默认切换

但仍需要显式记录，避免后面误判为镜像不一致。

---

## 五、当前迁移成熟度判断

### 已完成
- 镜像课程包已生成
- runtime 双轨读取已可用
- `LEARNING_SITE_DATA_SOURCE=mirrored` 已验证可 build
- course package 已进入 build guardrails

### 未完成
- 模块级差异需要更细粒度说明（是否属于设计性差异）
- 尚未将镜像课程包设为默认读取源
- 旧源与镜像源还未建立更细的字段级 diff 说明

---

## 六、建议的下一步

### 建议 1
把“设计性差异”从“危险差异”里分离出来。  
例如：
- focusQuestion 从 narrative 中提升为显式字段，不应被视为坏漂移。

### 建议 2
在 compare 脚本中增加“可接受差异 allowlist”。

### 建议 3
当 4 个模块的差异被确认只是“焦点问题 heading 被提升”后，可以进入：

- 默认读取源切换预演
- 或至少在非生产环境下优先读镜像源

---

## 七、一句话结论

镜像课程包已经不是“影子副本”，而是：

> **一个被 runtime、build、guardrails 共同验证过的第二内容源。**

现在距离真正默认切换，只差把剩下的少量结构差异解释清楚。
