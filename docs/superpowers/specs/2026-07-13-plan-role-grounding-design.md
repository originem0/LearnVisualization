# 根治 plan role 借名（Role Grounding）设计

日期：2026-07-13
状态：已实施（2026-07-13）
分支：fix-plan-role-grounding

## 背景

监督生成"人工智能与就业替代"课程时定位到一个结构性缺陷：plan 阶段 `chapterPlan.role`（自由散文，描述章节要做什么）可以点名证据库不存在的具体案例（实例：role 要求"引入聊天机器人误导用户、组织仍需负责的判例"即加拿大航空 Moffatt 案，但研究阶段没抽到该案证据）。下游 `build_judge_prompts` 的 role 完成度检查 (d) 拿 role 全文当铁律要求章节，而 writer 只收到本章 `evidenceIds` 对应的证据切片——借名的案例既无证据可引、又不许凭记忆杜撰，该章永久失败，重试无解。

这是开卷改造在 compose 侧堵死的"借名"问题，从 plan 阶段的 role 散文漏了进来。

## 用例约束（已与用户确认）

- 准绳取向：judge 评 role 完成度以"本章证据切片能支撑的范围"为界（治本），plan 侧 role 约束作为减少发生率的前置。
- 精确边界防矫枉过正：role 的**意图**仍是铁律（证据支撑得了却没写到 → 未完成、否决）；只豁免 role 里"证据切片支撑不了的具体点名"，且不许 writer 凭记忆补写该锚点（那正是要防的杜撰）。
- 不做 NER 硬拦：明确不在 plan 校验里提取 role 专名要求证据存在（中文自由散文专名提取脆、plan 重规划成本高且大概率再借名）。

## 设计

### 1. judge 以证据切片为准绳（治本）

`build_judge_prompts`：当 `evidence_items` 存在时，把 role 完成度检查项 (d) 由单句改为两层判断：

- role 的意图（要论证什么、把价值/机制推进到哪一步）以本章证据能支撑的范围为准：证据支撑得了却没写到 → 未完成，pass=false。
- role 里点名了具体案例/文本/判例，但它在本章证据全文中找不到 → 这一条不作为未完成的理由，也不得要求作者凭记忆补写该案例。

`evidence_items` 为空时（开卷管线理论上不发生，保守留旧路径）保持原单句 (d)，回归兼容。

这是双保险里最可靠的一道：即便 plan 侧漏了借名，judge 也不再被它卡死。

### 2. plan 侧约束 role 只点名证据覆盖的锚点（前置减发生）

`build_essay_plan_prompts`：在 `evidence_digest` 存在（证据库已建立）时，给 role 生成加一条硬指令——role 若点名具体案例/文本/判例/数字，该锚点必须来自本章挂的 evidenceIds 对应证据；不要凭记忆点名证据库没有的著名案例；role 可描述论证意图，但具体锚点只能引用本章证据覆盖的内容。

这减少借名发生率，不作硬防线——真防线在 judge。

### 3. 明确不做（记录决定）

不在 `validate_chapter_evidence`（essay_quality.py）加"提取 role 专名并要求证据存在"的校验。校验层维持现状（每章 ≥2 条有效证据）。此节写入设计是为固定这个"不做"的决定，防止实施时误加脆方案。

## 数据结构变更

无。改动集中在 `agent-backend/app/essay_prompts.py` 两个函数（build_judge_prompts、build_essay_plan_prompts）。不动 pipeline、schema、前端。

## 测试

- 单测（test_essay_writing_mode.py）：
  - `build_judge_prompts` 带 evidence_items 时 user_prompt 含"以本章证据能支撑的范围为准"与"不得凭记忆补写"双层表述；不带 evidence_items 时保持原 (d) 单句（回归）。
  - `build_essay_plan_prompts` 在 evidence_digest 存在时含"具体锚点只能引用本章证据覆盖的内容"指令；无证据时不注入该句（向后兼容）。
- 全量 `test_*.py` 绿（现有 judge/plan 断言不破坏）。
- 冒烟：重生成一门证据偏薄的时事主题，观察是否还会因 role 借名在某章死循环。
