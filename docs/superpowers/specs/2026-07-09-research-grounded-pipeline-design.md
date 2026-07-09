# 开卷生成管线（Research-Grounded Essay Pipeline）设计

日期：2026-07-09
状态：已获用户批准
分支：refactor/narrative-essay

## 背景与诊断

用户对生成课程质量不满（"生成的文章质量实在不行"）。对旗舰生成课程 course-2cf51423（尼采哲学）的实地诊断确认了三个结构性根因，均不可通过继续调 prompt 解决：

1. **闭卷生成**。管线没有任何环节把源材料放进上下文，模型全凭参数记忆写作。DESIGN.md 的核心防线"事实脊柱防八股"实现为"请模型自己发明 factSpine"（essay_prompts.py:71），且 factSpine 生成后从不校验（pipeline.py:805 只做 normalize）——旗舰课程的 factSpine 为 `null`，无任何环节报警。产出形态：一章六段只有一个论点，五个比喻反复涂抹，引《谱系》却不进入文本（Schuld/Schulden 论证缺席），恰是 essay_prompts.py:97 明令禁止的"哲学家点名式背书"。
2. **模型天花板**。生成模型为中转站上的 glm-5.1（runtime-config.json）。有论证密度的思想随笔超出中端模型能力；prompt 已精确禁止的错误输出照犯，说明是能力问题而非指令问题。
3. **评审测不出实质**。judge 与 composer 同模型（自评虚高）；本地门槛为正则级检查——引用书名即可匹配锚点正则（essay_quality.py:101）通过"概念空转"检测。最近提交在持续放宽门槛（信号弱的症状）。同时 commit 3b06fcf 引入 auto-publish，在机器门槛最弱时拆掉了唯一真实的门（人工 review），与 DESIGN.md 非目标 7"人类判断不可取消"直接冲突。

### 用例约束（已与用户确认）

- 读者 = 正在学该主题的用户本人（A）+ 希望达到公开可读水准（B）。推论：**人工审核实质密度这道防线天然失效**——审核者恰是主题新手，只能感到"空"，无法判断"漏了什么、编了什么"。源材料接地是唯一能替代专家审核的机制：引用真实文本的课程错误可追溯。
- 模型：继续走中转站，但换前沿模型（claude/gpt/gemini），接受不稳定，热切换兜底（B 选项）。
- 服务器在新加坡，网络无墙：zh/en 维基、Google、Bing、DuckDuckGo、GitHub 全部可达（已实测）。研究阶段无基础设施障碍。
- 成本：前沿模型每门课约 20-30 万 token（$1-3），相对实际生成频率可忽略。

## 目标

把生成任务从"无中生有"改为"组织给定材料"：搜索并抓取真实源材料 → 机器校验的证据库 → 证据在上下文中写作 → 异族模型对照证据交叉评审 → 恢复人工发布门。

## 非目标

- 不做向量库 / RAG 索引（每课一次性研究，证据直接进上下文）
- 不做通用爬虫框架（维基 API + DuckDuckGo + 直接抓取足够）
- 不做人机合写编辑器（先看开卷质量）
- 不引第三方依赖（保持 agent-backend 零依赖约束）
- 不动 legacy 课程链路

## 管线总体

```
Clarify → Contract → Research → Plan → Compose → Verify → Validate → Export
                                                          → waiting_review（人工门，恢复）
                                                          → Review approved → Promote + Build
```

`PIPELINE_STAGES`（job_store.py:15）从 `["plan", "compose", "validate", "export"]` 改为 `["research", "plan", "compose", "verify", "validate", "export"]`。

迁移处理：旧任务的 job.json 存有自己的 stages 数组；`mark_stage_running` / `_find_stage` 需容忍缺失阶段（缺失时追加条目），避免旧任务 retry 时崩溃。

## 各阶段设计

### Research（新模块 `agent-backend/app/research.py`）

零第三方依赖，urllib + html.parser。四步：

1. **出题**：LLM（research_model）从 contract（topic + drivingQuestion + scope.include）生成 6-10 个中英混合搜索查询，偏向一手文本与高质量二手材料。
2. **抓取**：
   - 维基百科搜索 API 解析主题实体（zh + en 各取最匹配的 1-2 个条目），REST API 取条目全文（无需 key）
   - DuckDuckGo HTML 搜索（`html.duckduckgo.com/html/?q=`，无需 key），每查询取前 5 个结果，合并去重后抓取
   - 抓取页面总数上限 12（维基条目之外），stdlib html.parser 抽正文，单页截断约 30k 字符
   - 抓取原文存入 job 目录 `research_sources/`（jobs/ 已 gitignore），供审计与后续校验
3. **萃取**：LLM 逐文档萃取证据条目：

   ```json
   {"id": "E01", "kind": "quote|fact|example|figure",
    "content": "原文或事实陈述", "sourceTitle": "…", "sourceUrl": "…", "note": "与哪条论线相关"}
   ```

   **机器防线：kind=quote 的 content 必须是抓取文本的子串，由代码校验**（归一化空白后匹配，避免抽取噪声造成误杀）。不通过的条目丢弃。不信任模型自述。
4. **成库**：去重排序后存为 stage 工件 `research.json`，目标 15-25 条。**可用证据少于 12 条 → 任务失败**，错误信息："材料不足，建议换更具体的主题"。宁可不生成，不生成空转文。

Retry 语义与现有阶段一致：research 成功后其工件被缓存复用（同 run_job 中 plan 的 stage_status 跳过模式）。

### Plan（改造 `essay_prompts.py` / `pipeline.py`）

- Plan prompt 附证据库摘要（id + 一行概要）
- 输出硬要求：`factSpine` 必填 3-5 条且每条挂证据 id；每个 chapter 新增 `evidenceIds`（≥2 条）
- 代码校验（\_normalize_essay_plan 之后）：引用 id 必须存在于证据库、每章覆盖达标、factSpine 非空。不达标 → 带具体缺陷一次修复重试 → 仍不达标任务失败。堵死"factSpine: null 静默通过"。

### Compose（改造 chapter prompt 与校验）

- 章节 prompt 嵌入**本章 evidenceIds 对应证据条目的全文**（引文逐字在场）
- 写作规则新增：具体事实断言须有证据支撑；作者立场须明示为立场；quote block 必须逐字复制证据内容并带 cite
- 代码校验：quote block 内容必须是证据库某条 content 的子串（引文保真链条第二环：页面 → 证据 → 章节）
- 章节输出新增 `sources` 字段：本章实际使用证据的出处列表 `[{id, title, url}]`

### 逐章交叉评审（发生在 Compose 循环内）与 Verify 阶段

**逐章证据评审必须发生在写下一章之前**——串行叙事里后章接收前章结尾，事后重写某一章会撕裂连续性。因此：

- `_judge_chapter` 升级：本地门槛之后，LLM 评审改用 judge_model（**要求与 composer 异族**，如 claude 写、gemini/gpt 审；配置成同族时日志警告），输入为章节全文 + 本章证据条目，检查 (a) 无支撑事实断言清单 (b) 引文保真 (c) 证据是否真正进入论证（vs 点名背书）(d) chapterPlan.role 完成度
- 不过 → 带具体反馈重写，沿用现有 3 次重写循环（pipeline.py `_compose_chapter_with_rewrites`）

**Verify 阶段（compose 之后的全课终检）**，产出人工 review 要读的审计工件：

- 机械复查：全部 quote block 对证据库的子串校验、各章 sources 完整性
- 一次课程级 LLM 评审（judge_model）：drivingQuestion 是否被回答、末章收束、跨章连续性
- 发现问题 → 任务失败并留明细（不做跨章自动重写，人工决定重试或放弃）
- 工件 `verify.json`：逐章 verdict 汇总 + 课程级 verdict 与问题清单

### 模型配置扩展（`provider.py` / `main.py` / SettingsPanel）

- `runtime-config.json` 新增 `research_model`、`judge_model`；composer 沿用 `model` + `fallback_model`
- `OpenAICompatibleClient.generate_json` 增加 per-call 模型覆盖参数（默认 None = 沿用 config.model；fallback 逻辑不变）
- SettingsPanel 增加两个字段；热切换机制原样保留

### 发布门恢复

- 删除 run_job 中的 auto-publish 直通（pipeline.py:454-459 调用 `_publish_output(reviewed_by="system")` 的路径），任务终态回 `waiting_review`，`resultSummary.readyForPromote = true`
- 恢复 GenerateForm 的 review UI（commit 3b06fcf 删除的 approve/reject + notes 交互）；`POST /jobs/{id}/review` 端点未动过，直接可用
- Review 体验升级：证据库（research.json）与逐章 sources 在工件中可见，审核者核对"引文是否存在、断言是否有据"不需要是主题专家
- DESIGN.md / README 的流程描述同步改回与实现一致

### 前端引用渲染

- EssayChapterRenderer 在章末渲染"参考资料"（chapter.sources）
- quote block 的 `cite` 引擎已支持（essay_schema.py:82），直接沿用
- 不做行内上标引用，保持散文干净
- essay-course-engine 对额外字段宽容（已确认），`sources` 不会被校验拒绝

## 数据结构汇总

- 证据条目：`{id, kind: quote|fact|example|figure, content, sourceTitle, sourceUrl, note}`
- plan 新增：`factSpine: [{"claim": str, "evidenceIds": [str]}]`；`chapterPlans[].evidenceIds: [str]`
- chapter 新增：`sources: [{id, title, url}]`
- 新工件：`stages/research.json`、`stages/verify.json`、`research_sources/`（抓取原文）

## 测试

- 单测（agent-backend/tests/）：引文子串校验（含归一化边界）、证据不足失败路径、plan 校验失败与修复重试、异族评审反馈重写循环（compose 内）、verify 全课终检失败路径、发布门恢复（test_job_pipeline.py 更新：终态 waiting_review 而非 auto-publish）
- 引擎测试不变；`npm run check` / `npm run build` 全链路照跑
- 一次真实冒烟：用新管线重生成尼采课程，与 course-2cf51423 对比密度

## 分两期落地

- **一期（速效）**：per-stage 模型配置 + 换前沿模型 + factSpine 必填校验（此期证据库尚不存在，先要求非空且具体，不校验 evidence id）+ 现有 `_judge_chapter` 的 LLM 评审改走异族 judge_model + 拆 auto-publish 恢复人工门。不动管线拓扑。
- **二期（根治）**：Research 阶段 + Verify 阶段 + 引文机器校验链 + chapter.sources + 前端参考资料渲染。

已发布的两门旧生成课程保留；之后可用新管线重生成对比。
