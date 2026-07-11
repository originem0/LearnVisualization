# 失败体验三件套（Failure Experience）设计

日期：2026-07-12
状态：已获用户批准
分支：reading-experience（承接未合并的阅读体验工作与时区清理修复）

## 背景

用户生成课程连续失败并重试三次无果，暴露三层问题：中转站瘫痪（已切换存活模型）、时区清理缺陷吞掉重试所依赖的缓存工件（已修，UTC 7 天保留）、以及本设计要解决的产品层缺陷——失败后的体验是黑箱抽奖：

1. **重试无记忆**：章节 4 轮带反馈重写用尽后任务失败；手动重试从零开始，上一轮的评审意见与失败草稿全部丢弃。
2. **失败不可见**：失败章节草稿被直接丢弃，评审发现只在错误消息里截断展示，用户无从判断"内容真差"还是"闸门太严"。
3. **错误不分类**：基础设施故障（中转 503/超时/无 key）与质量否决在 UI 里同样呈现，用户在服务商瘫痪时也以为是内容被否。

## 设计

### 1. 重试带记忆（compose 失败持久化 + 重试播种）

- `_compose_chapter_with_rewrites` 在第 4 轮仍失败、抛错**之前**，把失败上下文写入 `stages/compose_failure.json`：
  `{"chapterId", "feedback"（最后一轮评审意见）, "draft"（最后一版章节完整 JSON）, "attempts"}`
- compose 启动时（进入某章的重写循环前）读该文件：若 chapterId 匹配，则以持久化的 feedback 作为首轮 `revision_feedback` 种子，并在反馈文本中附上一版草稿的正文摘录（各 text 块拼接，截断 3000 字符），指令"上一版全文已被否决，针对以下问题修正，不要重蹈"；**消费后删除该文件**（一次性种子）。
- `prepare_retry` 不动：从 compose 重试时检查点保留已过章节（既有行为），compose_failure.json 天然幸存（它不在 artifacts 索引里）。
- 效果：手动重试从"重新抽奖"变成"第 5-8 轮迭代"。

### 2. 失败草稿可见

- 失败持久化的同时，把轻量版失败详情写进 job.json：`job["failureDetail"] = {"chapterId", "feedback", "draftText"}`，其中 draftText 为 narrative 各块 content 拼接的纯文本（heading 前后换行），截断 6000 字符。
- `_public_job_view` 透传 `failureDetail`（公开 GET /jobs/{id} 即可读，无需 admin）。
- 前端失败卡片加"查看失败章节与评审意见"展开区：评审 feedback 原文 + 草稿正文（等宽小字 pre-wrap），用户亲眼判断内容质量。
- 生命周期：failureDetail 在每次写入时覆盖前值；compose 阶段全部章节通过时置 None（写 compose 工件的同一处清除）。

### 3. 错误分类展示

- `run_job` 的异常处理按异常类型分类：`ProviderError` → `kind="infra"`；`ValueError` → `kind="quality"`；其余 → `kind="other"`。`mark_stage_failed` 增加可选 `kind` 参数写入 `job["error"]["kind"]`；`_public_job_view` 透传。
- 前端失败卡片按 kind 分流：
  - `infra`：中性色提示"服务商故障，内容未被评审否决——稍后点重试即可（复用已完成阶段）"，不显示草稿展开（没有草稿）
  - `quality`：显示第 2 条的展开区
  - `other`/缺失：现状展示

## 数据结构变更

- 新工件：`stages/compose_failure.json`（job 目录内，gitignore 覆盖）
- job.json 新增可选字段：`failureDetail`、`error.kind`（旧任务缺失时前端按现状降级）

## 测试

- 后端（test_job_pipeline.py）：
  - 章节 4 轮失败 → compose_failure.json 存在且含 draft/feedback；job.failureDetail 含 draftText 与 feedback；error.kind == "quality"
  - 重试后首个章节 prompt 含种子反馈标记（"上一版全文已被否决"）且 compose_failure.json 被消费删除
  - FakeClient 抛 ProviderError → error.kind == "infra"，无 failureDetail
- 前端 `npx tsc --noEmit`；`npm run check`
- 冒烟：真实失败任务上核对展开区与分类提示（依赖中转状态，手动）

## 不做什么

- 不做失败草稿的富渲染（纯文本足够判断质量）
- 不做自动无限重试（成本失控；记忆化的手动重试已把单次重试价值最大化）
- 不做评审阈值调节 UI
