# 根治 plan role 借名（Role Grounding）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** judge 评 role 完成度以本章证据切片能支撑的范围为界（豁免证据缺失的具体点名，但不豁免 role 意图，也不许凭记忆补写），并在 plan 生成时约束 role 只点名证据覆盖的锚点。

**Architecture:** 纯 prompt 改动，集中在 `agent-backend/app/essay_prompts.py` 两个函数：`build_judge_prompts`（有证据切片时把 role 完成度检查项拆成意图/点名两层）、`build_essay_plan_prompts`（有证据库时加 role 锚点接地指令）。零数据结构、零 pipeline、零前端改动。

**Tech Stack:** Python stdlib、unittest。

**设计文档:** `docs/superpowers/specs/2026-07-13-plan-role-grounding-design.md`

## Global Constraints

- agent-backend 零第三方依赖
- 测试：`python3 -m unittest discover -s agent-backend/tests -p 'test_essay_writing_mode.py' -v`；全量 `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py'`
- 每 Task 结束 commit；message 末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 只 `git add` 各 Task 明列文件；不提交 `.claude/settings.local.json`
- 精确边界：role 的**意图**仍是铁律（证据支撑得了却没写到 → 未完成、否决）；只豁免"证据切片支撑不了的具体点名"，且不许 writer 凭记忆补写该锚点
- 不做 NER 硬拦（validate_chapter_evidence 维持现状，不在本计划改动）
- 分支 `fix-plan-role-grounding`（已创建，设计文档已提交）

---

### Task 1: judge role 完成度以证据切片为准绳

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_judge_prompts 的 evidence_items 分支）
- Test: `agent-backend/tests/test_essay_writing_mode.py`

**Interfaces:**
- Produces: `build_judge_prompts(..., evidence_items=[...])` 的 user_prompt 中，证据评审的 (d) 项由单句"章节是否完成 chapterPlan.role"改为意图/点名两层判断；`evidence_items=None` 时不含证据评审段（保持原样，回归）

- [ ] **Step 1: 写失败测试**

`test_essay_writing_mode.py` 末尾追加：

```python
class JudgeRoleGroundingTests(unittest.TestCase):
    def _chapter(self):
        return {"id": "c04", "number": 4, "title": "责任", "role": "r",
                "narrative": [{"type": "text", "content": "正文"}]}

    def _plan(self):
        return {"drivingQuestion": "q", "centralTension": "t",
                "chapterPlans": [{"id": "c04", "number": 4}]}

    def test_judge_role_check_is_evidence_scoped_when_evidence_present(self):
        _, user = build_judge_prompts(
            self._chapter(), register="essay", writing_mode="conceptual-essay",
            chapter_plan={"id": "c04", "role": "引入某判例"}, plan_artifact=self._plan(),
            evidence_items=[{"id": "E01", "kind": "quote", "content": "证据全文"}],
        )
        # role 意图以证据能支撑的范围为准
        self.assertIn("证据能支撑的范围", user)
        # 证据缺失的点名豁免且不许凭记忆补写
        self.assertIn("凭记忆", user)

    def test_judge_without_evidence_keeps_plain_role_check(self):
        _, user = build_judge_prompts(
            self._chapter(), register="essay", writing_mode="conceptual-essay",
            chapter_plan={"id": "c04", "role": "r"}, plan_artifact=self._plan(),
            evidence_items=None,
        )
        # 无证据切片时不注入证据评审段
        self.assertNotIn("证据能支撑的范围", user)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_essay_writing_mode.py' -v`
Expected: `test_judge_role_check_is_evidence_scoped_when_evidence_present` FAIL（无"证据能支撑的范围"字样）

- [ ] **Step 3: 改 build_judge_prompts 的 (d) 项**

把 evidence_items 分支里这一句：

```python
            "(d) 章节是否完成 chapterPlan.role。\n\n"
```

替换为：

```python
            "(d) 章节是否完成 chapterPlan.role 的核心意图，分两层判断：\n"
            "    - role 的意图（要论证什么、把价值/机制推进到哪一步）以本章证据能支撑的范围为准：\n"
            "      证据支撑得了却没写到 → 未完成，pass=false；\n"
            "    - role 里点名了具体案例/文本/判例，但它在上面证据全文中找不到 → 这一条不作为未完成的\n"
            "      理由，也不得要求作者凭记忆补写该案例（凭记忆补写正是要防的杜撰）。\n\n"
```

（其余 (a)(b)(c) 不动；mode_standard 里"章节是否完成原始 chapterPlan.role"那句是无证据时也生效的意图铁律，保持不动。）

- [ ] **Step 4: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（现有 judge 断言不被破坏——原断言不检查 (d) 具体文案）

- [ ] **Step 5: Commit**

```bash
git add agent-backend/app/essay_prompts.py agent-backend/tests/test_essay_writing_mode.py
git commit -m "Scope judge role-completion check to the chapter's evidence slice"
```

---

### Task 2: plan 生成约束 role 只点名证据覆盖的锚点

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_essay_plan_prompts 的 evidence_digest 分支）
- Test: `agent-backend/tests/test_essay_writing_mode.py`

**Interfaces:**
- Consumes: Task 1 的测试文件（同文件追加，不冲突）
- Produces: `build_essay_plan_prompts(..., research_artifact=有证据)` 的 user_prompt 含 role 锚点接地指令；无证据时不注入

- [ ] **Step 1: 写失败测试**

在 `JudgeRoleGroundingTests` 之后追加：

```python
class PlanRoleGroundingTests(unittest.TestCase):
    def _payload(self):
        return {"topic": "AI 就业", "output_slug": "x", "contract": {
            "drivingQuestion": "q", "centralTension": "t", "knowledgeType": "conceptual",
            "audience": "a", "desiredOutcome": "o",
            "scope": {"include": ["x"], "exclude": ["y"], "depth": "d"},
            "problemFraming": {"phenomenon": "p", "contrast": "c", "problemNature": "model_mismatch",
                               "systemGoal": "s", "modelGap": "缺少某关系模型"},
        }}

    def _research(self):
        return {"evidence": [
            {"id": "E01", "kind": "quote", "content": "证据一", "sourceTitle": "维基", "sourceUrl": "https://x"},
            {"id": "E02", "kind": "fact", "content": "证据二", "sourceTitle": "维基", "sourceUrl": "https://y"},
        ]}

    def test_plan_prompt_grounds_role_anchors_on_evidence(self):
        from essay_prompts import build_essay_plan_prompts
        _, user = build_essay_plan_prompts(self._payload(), research_artifact=self._research())
        self.assertIn("具体锚点只能引用本章证据覆盖的内容", user)

    def test_plan_prompt_without_evidence_omits_role_grounding(self):
        from essay_prompts import build_essay_plan_prompts
        _, user = build_essay_plan_prompts(self._payload(), research_artifact=None)
        self.assertNotIn("具体锚点只能引用本章证据覆盖的内容", user)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_essay_writing_mode.py' -v`
Expected: `test_plan_prompt_grounds_role_anchors_on_evidence` FAIL

- [ ] **Step 3: 改 build_essay_plan_prompts 的 evidence_digest 分支**

把这一句：

```python
    if evidence_digest:
        user_prompt += "factSpine 每条和每个 chapter 都必须挂到证据库里真实存在的 evidenceIds；每章至少 2 条。"
```

替换为：

```python
    if evidence_digest:
        user_prompt += (
            "factSpine 每条和每个 chapter 都必须挂到证据库里真实存在的 evidenceIds；每章至少 2 条。"
            "每个 chapter 的 role 若点名具体案例、文本、判例或数字，该锚点必须来自你为这一章挂的 "
            "evidenceIds 对应证据；不要凭记忆点名证据库里没有的著名案例。role 可以描述要达成的论证意图，"
            "但具体锚点只能引用本章证据覆盖的内容。"
        )
```

- [ ] **Step 4: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

- [ ] **Step 5: 设计文档状态 + Commit**

`docs/superpowers/specs/2026-07-13-plan-role-grounding-design.md` 的 `状态：已获用户批准` → `状态：已实施（2026-07-13）`。

```bash
git add agent-backend/app/essay_prompts.py agent-backend/tests/test_essay_writing_mode.py docs/superpowers/specs/2026-07-13-plan-role-grounding-design.md
git commit -m "Constrain plan role anchors to evidence-backed content"
```

- [ ] **Step 6: 冒烟（手动，控制器）**

`sudo systemctl restart agent-backend`，重生成一门证据偏薄的时事主题课程，观察是否还会因 role 借名在某章死循环失败。

---

## Self-Review 记录

- 规格覆盖：设计三节 → Task 1（§1 judge 治本）、Task 2（§2 plan 前置 + 文档）；§3"不做 NER"由计划 Global Constraints 显式固定，无对应改动 Task（正确——它是"不做"）
- 类型一致：两个 Task 改同一文件不同函数、同一测试文件不同测试类，无冲突；judge 的 evidence_items 分支与 plan 的 evidence_digest 分支互不重叠
- 边界正确：mode_standard 里的"完成原始 chapterPlan.role"（意图铁律，无证据时也生效）保持不动，只改 evidence_items 分支的 (d)——符合"意图铁律 vs 点名豁免"
- 占位符扫描：无
