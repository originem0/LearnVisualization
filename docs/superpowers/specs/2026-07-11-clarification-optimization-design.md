# 澄清环节优化（Clarification Grounding & Semantic Gate）设计

日期：2026-07-11
状态：已获用户批准
分支：待创建（clarification-optimization）

## 背景与诊断

课程生成前有一个多轮 AI 澄清环节，把用户的模糊主题收束成 `contract`（drivingQuestion / centralTension / knowledgeType / audience / desiredOutcome / scope / problemFraming）。用户判断"这个前置环节非常重要"，要求优化。实地读三块实现（`clarification_prompts.py` 对话 prompt、`main.py` 的 `_clarification_readiness_issue` 规则 gate、`ClarificationDialogue.tsx` 前端候选契约卡片）后，确认两个结构性缺陷：

1. **契约与成品脱节（根因）**。澄清辛苦逼出的 `problemFraming`（phenomenon / contrast / systemGoal / modelGap）在下游几乎不被消费：
   - `build_research_query_prompts`（essay_prompts.py）出题只看 `drivingQuestion` + `scope.include`
   - `build_essay_plan_prompts` 虽然 `json.dumps` 了整个 contract，但没有任何指令要求 factSpine / 章节弧线去回应 problemFraming
   - `build_chapter_prompts` 只喂 drivingQuestion / centralTension，完全看不到 problemFraming
   - Verify 终检只查"末章收束 + 跨章连续"，不查 modelGap 是否被填补

   结果：用户花五轮对话产出的"模型缺口""系统悖论"，生成时基本被丢掉。这是投入产出最不匹配的地方。

2. **gate 是字数检查，挡不住空洞契约**。`_clarification_readiness_issue` 用 `len(phenomenon) < 12`、轮次 ≥ 3、差异信号关键词匹配来把关。这能挡住空字段，但挡不住"看似填满、实则空洞"——LLM 很容易写 12 个字的正确废话，glm 尤其会钻这种空子（已在章节评审中见过）。

## 用例约束（已与用户确认）

- 澄清是纯推理任务（理解言外之意 + 结构化思维），对模型要求与写作不同。用户同意在 LLM 配置里**单独配一个 `clarify_model`**，走现有 per-stage 机制。
- gate 升级采用**异族 LLM 评审契约**（与整条管线"机器/异族把关代替自评"的哲学一致），规则 gate 保留为便宜前置闸。
- 一期只做接地 + 把关，不动前端对话交互（那是二期）。

## 目标

让澄清产出的每个契约字段在成品里都有落点，并用异族语义评审挡住空洞契约——把"澄清阶段的洞察"真正转成"生成阶段的约束"。

## 非目标（一期）

- 不改前端对话交互（字段级实质编辑是二期第 4 点）
- 不改多轮对话的提问策略（对话智能优化是二期第 1 点）
- 不引第三方依赖，不动 legacy 课程链路

## 优化因果链与分期

四个优化点是一条因果链，不是并列：契约脱节（3）是根，gate 空洞（2）是把关，对话智能（1）和掌控交互（4）是体验层。地基不修，体验层的优化都是给漏桶接水。

- **一期（本设计，接地 + 把关）**：契约全字段接入下游（3）+ gate 升级为异族语义评审（2）+ 新增 teachingHooks 字段。
- **二期（体验）**：对话策略优化让 AI 提问更精准（1）+ 候选契约卡片支持字段级实质编辑（4）。

## 一期设计

### 1. 新增 `clarify_model` 配置

沿用 per-stage 机制（与 research_model / judge_model 同形）：

- `ProviderConfig` 加 `clarify_model: str | None`（env `AGENT_LLM_CLARIFY_MODEL` + runtime-config 覆盖 + masked 暴露）
- `handle_clarify_start` / `handle_clarify_respond` 的 LLM 调用，以及新增的契约评审调用，都走 `clarify_model`（未配置回落 `config.model`）
- SettingsPanel 加一个 `clarify_model` 字段
- 改动集中在 provider.py + main.py + SettingsPanel，形状与已落地的 per-stage model 任务一致

### 2. 契约全字段接入下游（根）

让每个下游阶段拿到并被**指令要求使用**契约的实质字段：

- **Research 出题**（`build_research_query_prompts`）：现在只看 drivingQuestion + scope。加入 `problemFraming.modelGap` 和 `problemFraming.contrast`——research_model 针对"用户缺失的对象/关系"和"直觉与现实的冲突"去搜材料，而非只搜主题词。缓解冷门对照对象漏搜。
- **Plan**（`build_essay_plan_prompts`）：contract 已在 prompt 里，但缺指令。加硬要求：drivingQuestion 必须是本课要回答的问题；每章弧线必须服务于填补 modelGap；centralTension 要贯穿全课。
- **Compose**（`build_chapter_prompts`）：把 `problemFraming.phenomenon`（用户观察到的具体现象）和 `problemFraming.modelGap` 喂进章节 prompt——作者知道"读者卡在哪、缺什么模型"，写作有的放矢。
- **Verify**（`build_course_verify_prompts`）：课程级终检加一条——drivingQuestion 是否被实际回答、modelGap 是否被填补（不只现有的末章收束 + 连续性）。

效果：澄清里说的每个字段，都在成品里有落点。这是"契约与成品脱节"的正解。

### 3. 契约语义评审（gate 升级）

在 `handle_clarify_respond` 里，当 AI 提出 `complete` 且**规则前置闸通过后**（`_clarification_readiness_issue` 保留：轮次 ≥ 3、字数、差异信号——先跑，挡明显不合格，省 LLM 调用），新增一次**异族评审调用**：

- 模型 = judge_model（要求与 clarify_model 异族；同族日志警告，复用 `model_family`）
- 新 prompt `build_contract_review_prompts(contract)`，独立检查四点：
  - (a) `phenomenon` 是具体现象还是泛化困惑？
  - (b) `contrast` 是真差异还是同义反复？
  - (c) `modelGap` 指出了缺失的对象/关系/条件，还是只重复了 drivingQuestion？
  - (d) 这门课可教吗（不是太大、也不是伪问题）？
- 输出 `{"pass": bool, "issues": [str], "teachingHooks": [str]}`（teachingHooks 见第 4 节）
- 不过 → 把 issues 转成一句对用户友好的追问（**不暴露内部字段名/schema**，复用 `_clarification_gate_followup` 的话术风格），对话继续，返回 `needsMoreEvidence: true`
- 过 → 把 teachingHooks 写进 contract，候选契约卡片给用户

服务端流程（`handle_clarify_respond` 内，contract 规范化成功后）：
```
规则前置闸 _clarification_readiness_issue(contract, history)
  ├─ 有 issue → 追问，continue（现有行为，不变）
  └─ 无 issue → 异族契约评审 build_contract_review_prompts
       ├─ pass=false → 追问（issues 转友好话术），continue
       └─ pass=true  → contract["teachingHooks"] = hooks；返回候选契约
```

### 4. 新字段 `teachingHooks`

契约评审通过时，让评审模型顺带产出 2-3 个**具体教学抓手**：这门课必须讲到的具体文本 / 机制 / 案例锚点（类似 factSpine，但来自**意图分析**而非事后生成）。写进 contract：

- `contract["teachingHooks"]: list[str]`
- `normalize_generation_contract`（models.py）容忍该可选字段，规范化为字符串列表（缺失时空列表，不 raise）
- 下游 research 出题把 teachingHooks 当"必须覆盖"的种子（和 wikiTopics 同类作用）；plan 的 factSpine 优先回应这些抓手

这是把"澄清阶段的洞察"直接转成"生成阶段的约束"的桥——不做，problemFraming 的接地就只到"氛围"层面；做了，才有具体锚点强制下游覆盖。

## 数据结构变更

- contract 新增：`teachingHooks: [str]`（2-3 条具体教学抓手）
- 契约评审输出：`{"pass": bool, "issues": [str], "teachingHooks": [str]}`
- runtime-config / ProviderConfig 新增：`clarify_model`

## 测试

- 单测（agent-backend/tests/）：
  - provider：clarify_model 配置读取 + masked（扩展 test_provider_models.py）
  - 契约评审失败路径：评审返回 pass=false 时 respond 返回 needsMoreEvidence 而非候选契约（扩展 test_clarification_*）
  - 契约评审通过：teachingHooks 写进 contract
  - 下游 prompt 接地：build_research_query_prompts 含 modelGap；build_chapter_prompts 含 phenomenon；build_essay_plan_prompts 含填补 modelGap 的指令（扩展 test_essay_writing_mode / 新增断言）
  - normalize_generation_contract 容忍并规范化 teachingHooks
- 现有 test_clarification_mock / test_clarification_api / test_clarification_store 跟随 gate 变化更新
- 前端只加 SettingsPanel 字段，`npx tsc --noEmit` 通过
- 一次真实澄清 → 生成：验证契约字段（尤其 modelGap / teachingHooks）在成品里兑现

## 二期预告（不在本设计范围）

- 对话策略优化：提问更精准、更少绕圈（改 clarification_prompts 的提问优先级与初学者定位逻辑）
- 候选契约卡片字段级实质编辑：用户能改动契约实质而非只"确认/继续/调整"
