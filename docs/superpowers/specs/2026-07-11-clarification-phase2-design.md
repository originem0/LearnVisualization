# 澄清环节优化二期（Dialogue Friction & Contract Editing）设计

日期：2026-07-11
状态：已获用户批准
分支：clarification-phase2

## 背景

一期（已合并 main，9fffbff）完成了契约接地与异族语义评审：澄清产出的每个契约字段在成品里有落点，空洞契约被评审打回。二期做体验层——降低对话交互阻力，把契约的最终控制权真正交给用户。

## 现状诊断（基于代码 + 一期冒烟实录）

- **W1 提问偏长**：冒烟第 4 轮 AI 先讲了一段"理性主义 vs 经验主义"的小课才提问——用户还没上课，先被迫读课。
- **W2 回答全靠打字**：每轮要求用户写一段话，对初学者（最需要澄清的人群）是最重的交互负担；prompt 里"5 轮后给候选方向"只是把选项写进问题文本，点不了。
- **W3 评审打回的追问是哑的**（一期遗留 Minor）：契约评审发现"modelGap 空洞"，用户收到的却是硬编码的 contrast 话术（main.py 评审 fail 分支硬编码 `_clarification_gate_followup("contrast", ...)`），答非所指。
- **W4 "调整契约"是假编辑**：点"调整"只是往输入框塞前缀，用户描述想改什么 → LLM 重新合成整个契约——改一个字段要赌整张牌重洗。
- **W5 轮次估计粗糙**：`_get_round_guidance` 用 `(history_length+1)//2` 粗算 bot 轮次。

## 已确认的设计取向（与用户确认）

- 每轮提问**带可点选的候选回答**（options），保留自由输入。
- 契约字段编辑后**不过语义评审——用户即权威**。评审 gate 挡的是 AI 合成的空洞，不审查用户意图；只做机械校验（normalize_generation_contract 已有）。

## 二期设计

### 1. 每轮提问带可点选项（W1+W2+W5）

**clarification_prompts.py：**

- 继续对话的输出 schema 从 `{"question": "..."}` 扩展为 `{"question": "...", "options": ["候选A", "候选B"]}`（options 可选，0-4 个）
- 提问纪律写进 system prompt：**问题正文 ≤2 句铺垫 + 1 句问句**，不许先讲课再提问；每个 option 是一条用户可能的真实处境/回答（≤25 字），不是"是/否"
- 初学者规则升级：用户暴露"不知道"信号时，**必须**给 options（把"你先确认我的整理"变成可点选）
- `_get_round_guidance` 的粗轮次估计改为精确计数 history 里 role=="bot" 的条数（修 W5）

**main.py：** `handle_clarify_start` / `handle_clarify_respond` 的返回透传 `options`（list[str]；清洗：str 化、strip、去空、截断 4 个；缺失 → 空列表）。评审 fail 的追问由 LLM 生成、可带 options（见第 2 节）；规则闸 fail 的追问是硬编码文案，不带 options（options 为空列表）。

**ClarificationDialogue.tsx：** 问题气泡下渲染 option 按钮，点击即作为用户回答发送（复用 handleSubmit 路径）；自由输入框保留；发送后本轮选项消失（下一轮以新问题的 options 为准）。

### 2. 评审打回的追问带上评审发现（W3）

`handle_clarify_respond` 里评审 fail 分支，不再用硬编码 followup，改为再调一次 clarify_model：

- 新 prompt `build_review_followup_prompts(issues, recent_history)`（clarification_prompts.py）：输入 = 评审 issues + 对话末两轮，输出 = `{"question": "...", "options": [...]}`——一个不暴露内部字段名/schema 的针对性追问
- LLM 调用失败（异常）→ 回落现有硬编码 `_clarification_gate_followup("contrast", ...)`，不卡死对话
- 单测：追问包含与 issue 对应的语义、无 "modelGap"/"problemFraming"/"schema" 字样泄漏、回落路径可用

### 3. 契约卡片字段级实编辑（W4）

**ClarificationDialogue.tsx 的 CandidateContractCard 重做：**

- 显示并**可直接编辑**全部实质字段：drivingQuestion、centralTension、phenomenon、contrast、modelGap、scope.include / scope.exclude（逗号分隔编辑）、depth、audience、desiredOutcome、**teachingHooks**（一期新增字段，现卡片未显示——补上，每条一行可增删）
- 交互：点字段变 textarea（hooks 为可增删行列表），失焦保存到本地契约副本；已编辑字段有视觉标记（如左侧色条）
- **用户即权威**：编辑不过语义评审；"确认，用这个生成"提交编辑后契约，服务端 `normalize_generation_contract` 机械校验（已存在），校验失败的错误信息显示在卡片上
- 边界语义：编辑后点"继续澄清"，本地编辑**丢弃**（新候选契约覆盖）；按钮附近一句提示说明
- 删除现有"调整契约"按钮及 `focusForAdjustment` / adjustFields 逻辑（被真编辑取代）；"继续澄清"保留

### 4. 不做什么（YAGNI）

- 不做编辑历史/撤销（刷新重来）
- 不做对话中途修改已答内容
- 不做 options 多选
- 后端不加新端点（编辑是纯前端状态，confirm 时随契约提交，走既有 POST /jobs/course-generation）

## 数据结构变更

- 澄清继续对话输出：`{"question": str, "options": [str] (可选, ≤4)}`
- respond/start 响应：新增 `options: [str]`（可为空）
- 契约本身无 schema 变化（编辑复用现有字段）

## 测试

- 单测（agent-backend/tests/）：
  - options 清洗与透传（start/respond/规则闸追问/评审追问四条路径）
  - build_review_followup_prompts：prompt 含 issues 语义、输出 schema
  - 评审 fail → followup LLM 调用 → 追问无内部字段名；followup LLM 异常 → 回落硬编码话术
  - 现有 test_clarification_* 跟随更新（旧 mock 不带 options 应照常工作——options 可选）
- 前端 `npx tsc --noEmit`
- 冒烟：真实对话验证 options 出现且可点；故意给空洞回答看评审追问是否针对发现；卡片编辑 modelGap 后生成，确认编辑值进入 job 的 request.contract

## 与一期的衔接

- 评审 gate 流程不变（规则闸 → 异族评审 → 候选契约），本期只改"打回时说什么"和"通过后用户能改什么"
- teachingHooks 在卡片上可见可编辑后，用户可以增删 AI 给的教学抓手——这是"澄清洞察 → 生成约束"链条上用户的最后一道手动控制
