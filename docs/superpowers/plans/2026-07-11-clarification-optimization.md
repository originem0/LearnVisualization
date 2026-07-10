# 澄清环节优化一期（Clarification Grounding & Semantic Gate）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让澄清产出的每个契约字段在成品里都有落点，并用异族语义评审挡住空洞契约，同时把澄清洞察转成具体教学抓手（teachingHooks）约束下游生成。

**Architecture:** 沿用已落地的 per-stage 模型机制新增 `clarify_model`；在 `handle_clarify_respond` 的规则前置闸之后插入一次异族 LLM 契约评审，通过则把 teachingHooks 写进 contract；契约的 problemFraming 字段与 teachingHooks 被指令化地喂进 research/plan/compose/verify 四个下游阶段。

**Tech Stack:** Python 3.10 stdlib（urllib/unittest/unittest.mock）、Next.js 14 + TypeScript、OpenAI-compatible 中转站。

**设计文档:** `docs/superpowers/specs/2026-07-11-clarification-optimization-design.md`

## Global Constraints

- agent-backend 不引入任何第三方依赖（纯 Python stdlib）
- 所有测试命令在仓库根 `/home/ubuntu/learnVisualization` 运行
- Python 测试统一用 `python3 -m unittest discover -s agent-backend/tests -p '<file>.py' -v`；全量 `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py'`
- 前端类型检查 `npx tsc --noEmit` 必须干净
- 每个 Task 结束必须 commit；commit message 末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 只 `git add` 每个 Task 明列的文件；工作区有一个无关的 `.claude/settings.local.json`，绝不提交它
- 面向用户的错误/追问文案为中文，且**不得暴露内部字段名、schema、评审规则**给用户
- 澄清评审模型 = judge_model（要求与 clarify_model 异族；同族日志警告），复用 provider.py 的 `model_family`
- 分支 `clarification-optimization`（已创建，设计文档已提交在此分支）

---

## File Structure

- `agent-backend/app/provider.py` — 加 `clarify_model` 配置字段（与 research_model/judge_model 同形）
- `agent-backend/app/main.py` — `update_provider_config` 加 clarify_model；澄清两处 LLM 调用走 clarify_model；`handle_clarify_respond` 插入契约评审 gate
- `agent-backend/app/clarification_prompts.py` — 新增 `build_contract_review_prompts`
- `agent-backend/app/models.py` — `normalize_generation_contract` 容忍并规范化 `teachingHooks`
- `agent-backend/app/essay_prompts.py` — research/plan/compose/verify 四个 prompt builder 接入 problemFraming + teachingHooks
- `agent-backend/app/research.py` — 出题时把 teachingHooks 传给 query prompt
- `src/components/SettingsPanel.tsx` — 加 clarify_model 字段
- 测试：`test_provider_models.py`、`test_clarification_mock.py`、`test_contract_review.py`(新)、`test_essay_writing_mode.py`、`test_job_pipeline.py`

---

### Task 1: 新增 clarify_model 配置并接线澄清调用

**Files:**
- Modify: `agent-backend/app/provider.py`
- Modify: `agent-backend/app/main.py`（update_provider_config + handle_clarify_start + handle_clarify_respond 的 generate_json 调用）
- Modify: `src/components/SettingsPanel.tsx`
- Test: `agent-backend/tests/test_provider_models.py`

**Interfaces:**
- Produces: `ProviderConfig.clarify_model: str | None`（env `AGENT_LLM_CLARIFY_MODEL` + runtime-config 覆盖 + masked 暴露）
- Produces: `POST /provider-config` 接受 `clarify_model`（空字符串清除覆盖，与 research/judge 同语义）
- Consumes: 已存在的 `generate_json(..., model=None)` per-call 覆盖（Task 已在主线落地）

- [ ] **Step 1: 写失败测试**

在 `agent-backend/tests/test_provider_models.py` 末尾追加：

```python
class ClarifyModelConfigTests(unittest.TestCase):
    def test_config_carries_clarify_model(self):
        config = ProviderConfig(base_url="http://fake.local/v1", model="a", clarify_model="c")
        self.assertEqual(config.clarify_model, "c")
        self.assertEqual(config.masked["clarify_model"], "c")

    def test_clarify_model_defaults_none(self):
        config = ProviderConfig(base_url="http://fake.local/v1", model="a")
        self.assertIsNone(config.clarify_model)
        self.assertIsNone(config.masked["clarify_model"])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_provider_models.py' -v`
Expected: FAIL（TypeError: unexpected keyword 'clarify_model' / KeyError 'clarify_model'）

- [ ] **Step 3: 实现 provider.py**

`ProviderConfig` dataclass 在 `judge_model: str | None = None` 之后加：

```python
    clarify_model: str | None = None
```

`from_env()` 中 `judge_model = os.environ.get("AGENT_LLM_JUDGE_MODEL") or None` 之后加：

```python
        clarify_model = os.environ.get("AGENT_LLM_CLARIFY_MODEL") or None
```

runtime overrides 块 `if rt.get("judge_model"): judge_model = rt["judge_model"]` 之后加：

```python
        if rt.get("clarify_model"):
            clarify_model = rt["clarify_model"]
```

`cls(...)` 构造在 `judge_model=judge_model,` 之后加 `clarify_model=clarify_model,`。

`masked` property 在 `"judge_model": self.judge_model,` 之后加：

```python
            "clarify_model": self.clarify_model,
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_provider_models.py' -v`
Expected: 全部 PASS（含原有 6 个 + 2 新）

- [ ] **Step 5: main.py — update_provider_config**

把 `for field in ("research_model", "judge_model"):` 这行改为：

```python
    for field in ("research_model", "judge_model", "clarify_model"):
```

- [ ] **Step 6: main.py — 澄清调用走 clarify_model**

`handle_clarify_start` 里的调用（当前无 model 参数）：

```python
        response = client.generate_json(
            schema_name="clarification_start",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=700
        )
```

改为在 `max_tokens=700` 后加一行 `model=getattr(client.config, "clarify_model", None),`（注意补逗号）：

```python
        response = client.generate_json(
            schema_name="clarification_start",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=700,
            model=getattr(client.config, "clarify_model", None),
        )
```

`handle_clarify_respond` 里的 `clarification_respond` 调用同样处理（`max_tokens=1200` 后加 `model=getattr(client.config, "clarify_model", None),`）：

```python
        response = client.generate_json(
            schema_name="clarification_respond",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=1200,
            model=getattr(client.config, "clarify_model", None),
        )
```

- [ ] **Step 7: SettingsPanel.tsx**

`ProviderConfigMasked` 接口在 `judge_model: string | null;` 之后加：

```typescript
  clarify_model: string | null;
```

state（`judgeModel` 之后）加：

```typescript
  const [clarifyModel, setClarifyModel] = useState('');
```

`loadConfig` 的 `setJudgeModel(data.judge_model || '');` 之后加：

```typescript
      setClarifyModel(data.clarify_model || '');
```

`handleSave` 的 body JSON 在 `judge_model: judgeModel,` 之后加 `clarify_model: clarifyModel,`；成功后的 set 块在 `setJudgeModel(data.judge_model || '');` 之后加 `setClarifyModel(data.clarify_model || '');`。

form 里 Judge Model Field 之后加：

```tsx
                <Field label={isZh ? 'Clarify Model（可选，建议强推理）' : 'Clarify Model (optional, strong reasoning)'} value={clarifyModel} onChange={setClarifyModel} placeholder={isZh ? '留空 = 用主模型' : 'Empty = main model'} />
```

- [ ] **Step 8: 验证 + Commit**

Run: `npx tsc --noEmit && python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: tsc 无输出；unittest OK

```bash
git add agent-backend/app/provider.py agent-backend/app/main.py src/components/SettingsPanel.tsx agent-backend/tests/test_provider_models.py
git commit -m "Add clarify_model per-stage config and wire clarification calls"
```

---

### Task 2: contract 容忍并规范化 teachingHooks

**Files:**
- Modify: `agent-backend/app/models.py`（normalize_generation_contract）
- Test: `agent-backend/tests/test_normalize.py`

**Interfaces:**
- Produces: `normalize_generation_contract` 返回的 contract 含 `teachingHooks: list[str]`（缺失/非法 → 空列表，不 raise；每条 strip，去空）

- [ ] **Step 1: 写失败测试**

在 `agent-backend/tests/test_normalize.py` 末尾追加（先确认文件顶部已能 import `normalize_generation_contract`；若无则加 `from models import normalize_generation_contract`，与该文件现有 import 风格一致）：

```python
class TeachingHooksNormalizationTests(unittest.TestCase):
    def _base_contract(self):
        return {
            "drivingQuestion": "为什么缓存不是快字典？",
            "centralTension": "查表直觉忽略了有效性和容量",
            "knowledgeType": "conceptual",
            "audience": "写应用但不懂缓存内部的工程师",
            "desiredOutcome": "能解释命中/过期/淘汰",
            "scope": {"include": ["命中路径"], "exclude": ["分布式"], "depth": "机制深挖"},
            "problemFraming": {
                "phenomenon": "同样 key-value，缓存命中会改状态",
                "contrast": "字典命中不变，缓存命中更新 recency",
                "problemNature": "model_mismatch",
                "systemGoal": "理解缓存如何同时维护有效性和容量",
                "modelGap": "缺少命中路径与淘汰策略的关系模型",
            },
        }

    def test_teaching_hooks_normalized_to_str_list(self):
        raw = self._base_contract()
        raw["teachingHooks"] = ["LRU 淘汰更新 recency", "  ", "TTL 过期不返回旧值", 123]
        contract = normalize_generation_contract({"contract": raw})
        self.assertEqual(contract["teachingHooks"], ["LRU 淘汰更新 recency", "TTL 过期不返回旧值", "123"])

    def test_missing_teaching_hooks_is_empty_list(self):
        contract = normalize_generation_contract({"contract": self._base_contract()})
        self.assertEqual(contract["teachingHooks"], [])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_normalize.py' -v`
Expected: FAIL（KeyError 'teachingHooks'）

- [ ] **Step 3: 实现 models.py**

`normalize_generation_contract` 的 `contract = {...}` 字典里，在 `"problemFraming": _to_problem_framing(raw.get("problemFraming")),` 之后加一行：

```python
        "teachingHooks": _to_str_list(raw.get("teachingHooks")),
```

（`_to_str_list` 已存在于本文件，会把非字符串项 str 化、strip、去空。teachingHooks 是可选字段，不加入 `missing` 必填校验。）

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（现有 contract 测试不受影响——多一个默认空列表字段）

- [ ] **Step 5: Commit**

```bash
git add agent-backend/app/models.py agent-backend/tests/test_normalize.py
git commit -m "Normalize optional teachingHooks on the generation contract"
```

---

### Task 3: 异族契约语义评审 gate + teachingHooks 产出

**Files:**
- Modify: `agent-backend/app/clarification_prompts.py`（新增 build_contract_review_prompts）
- Modify: `agent-backend/app/main.py`（handle_clarify_respond 插入评审 gate）
- Test: `agent-backend/tests/test_contract_review.py`（新）
- Test: `agent-backend/tests/test_clarification_mock.py`（更新 mock 为 side_effect 序列）

**Interfaces:**
- Produces: `build_contract_review_prompts(contract: dict) -> tuple[str, str]`（system, user）——评审四点，输出 `{"pass": bool, "issues": [str], "teachingHooks": [str]}`
- Produces: `handle_clarify_respond` 在规则前置闸通过后调用契约评审；不过 → 返回 `{"question", "roundNumber", "needsMoreEvidence": True, "reviewIssue": <首条issue原文供日志>}`（question 是**不含内部字段名**的友好追问）；过 → `contract["teachingHooks"] = hooks` 后返回候选契约
- Consumes: `client.generate_json(..., model=judge_model)`；`model_family`（provider.py）；`_clarification_gate_followup`（复用友好话术）

- [ ] **Step 1: 写失败测试（新文件 test_contract_review.py）**

创建 `agent-backend/tests/test_contract_review.py`：

```python
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from clarification_prompts import build_contract_review_prompts  # noqa: E402


def _contract():
    return {
        "drivingQuestion": "为什么上帝已死是尺度崩塌？",
        "centralTension": "失去信仰不只少一个指南",
        "problemFraming": {
            "phenomenon": "现代人没信仰也活得好好的",
            "contrast": "直觉当少个指南；尼采说是尺度整体失效",
            "modelGap": "缺少价值尺度这个对象模型",
        },
        "scope": {"include": ["上帝已死", "虚无主义"], "exclude": ["海德格尔阐释"]},
    }


class ContractReviewPromptTests(unittest.TestCase):
    def test_prompt_carries_contract_fields_and_output_schema(self):
        system, user = build_contract_review_prompts(_contract())
        self.assertIn("phenomenon", system + user)  # 评审需针对 problemFraming 字段
        self.assertIn("现代人没信仰也活得好好的", user)  # 具体现象进入 prompt
        self.assertIn("缺少价值尺度这个对象模型", user)   # modelGap 进入 prompt
        self.assertIn("teachingHooks", user)             # 要求产出教学抓手
        self.assertIn("pass", user)                      # 要求输出裁决

    def test_prompt_asks_for_specificity_not_wordcount(self):
        _, user = build_contract_review_prompts(_contract())
        # 评审标准必须包含"是否具体现象/是否同义反复/是否可教"这类语义检查
        self.assertTrue(any(k in user for k in ("同义反复", "泛化", "可教", "伪问题")))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_contract_review.py' -v`
Expected: FAIL（ImportError: cannot import name 'build_contract_review_prompts'）

- [ ] **Step 3: 实现 build_contract_review_prompts**

在 `agent-backend/app/clarification_prompts.py` 末尾（`_history_shows_beginner_uncertainty` 之后）追加：

```python
def build_contract_review_prompts(contract: dict) -> tuple[str, str]:
    """异族评审：判断合成出的学习契约是否实质合格，并产出具体教学抓手。

    只做语义判断，不做字数检查——字数闸由服务端规则前置。
    """
    import json

    framing = contract.get("problemFraming") or {}
    scope = contract.get("scope") or {}
    system_prompt = (
        "你是课程契约的独立评审。给你一份从用户澄清对话里合成出来的学习契约，"
        "你要判断它是否足以驱动出一门有实质的课程，而不是看似填满、实则空洞。只输出 JSON。\n"
        "评审四点，任一不合格即 pass=false：\n"
        "(a) phenomenon 是具体、可观察的现象，还是泛化的困惑经验（如“我不太懂X”）；\n"
        "(b) contrast 是真实的差异/冲突，还是把 drivingQuestion 换个说法的同义反复；\n"
        "(c) modelGap 指出了缺失的具体对象、关系、条件或边界，还是只重复了问题本身；\n"
        "(d) 这门课可教吗——不是大到无法收束，也不是伪问题或纯查定义。\n"
        "若合格，产出 2-3 个 teachingHooks：这门课必须讲到的**具体**文本、机制、案例或数字锚点"
        "（像“《谱系》里 Schuld 源于 Schulden 的词源论证”这种具体，不要写概念名）。"
    )
    user_prompt = (
        "待评审契约：\n"
        f"drivingQuestion: {contract.get('drivingQuestion')}\n"
        f"centralTension: {contract.get('centralTension')}\n"
        f"problemFraming.phenomenon: {framing.get('phenomenon')}\n"
        f"problemFraming.contrast: {framing.get('contrast')}\n"
        f"problemFraming.modelGap: {framing.get('modelGap')}\n"
        f"scope.include: {json.dumps(scope.get('include') or [], ensure_ascii=False)}\n\n"
        "输出 JSON：\n"
        '{"pass": true/false, '
        '"issues": ["若不合格，逐条写清哪一点空洞、为什么"], '
        '"teachingHooks": ["若合格，2-3 个具体教学抓手"]}'
    )
    return system_prompt, user_prompt
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_contract_review.py' -v`
Expected: 2 tests PASS

- [ ] **Step 5: main.py — 导入 build_contract_review_prompts 与 model_family**

`main.py` 顶部 import 区，两处 `from clarification_prompts import (...)` / `from .clarification_prompts import (...)` 把 `build_contract_review_prompts` 加进去。同时在 provider 的 import（`from .provider import OpenAICompatibleClient, ProviderConfig` / `from provider import ...`）两处加 `model_family`：

```python
    from .provider import OpenAICompatibleClient, ProviderConfig, model_family
```
```python
    from provider import OpenAICompatibleClient, ProviderConfig, model_family
```

- [ ] **Step 6: main.py — 新增契约评审辅助函数**

在 `handle_clarify_respond` 函数**之前**（`_clarification_candidate_summary` 之后）加一个纯函数，方便单测：

```python
def _review_contract(client, contract: dict) -> dict:
    """异族评审契约。返回 {'pass': bool, 'issues': [str], 'teachingHooks': [str]}。

    评审模型用 judge_model（要求与 clarify_model 异族）；评审调用本身失败时，
    降级为通过（不因评审模型抖动卡死用户），但不产出 teachingHooks。
    """
    judge_model = getattr(client.config, "judge_model", None)
    clarify_model = getattr(client.config, "clarify_model", None) or getattr(client.config, "model", "")
    if judge_model and model_family(judge_model) == model_family(clarify_model):
        import sys
        print(
            f"[clarify] warning: judge_model '{judge_model}' 与 clarify 模型同族，契约评审独立性受限",
            file=sys.stderr,
        )
    system_prompt, user_prompt = build_contract_review_prompts(contract)
    try:
        response = client.generate_json(
            schema_name="contract_review",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_tokens=800,
            model=judge_model,
        )
    except Exception as exc:
        import sys
        print(f"[clarify] contract review failed, passing through: {exc}", file=sys.stderr)
        return {"pass": True, "issues": [], "teachingHooks": []}
    content = _unwrap_llm_json_content(response) or {}
    hooks = [str(h).strip() for h in (content.get("teachingHooks") or []) if str(h).strip()][:3]
    issues = [str(i).strip() for i in (content.get("issues") or []) if str(i).strip()]
    return {"pass": bool(content.get("pass")), "issues": issues, "teachingHooks": hooks}
```

- [ ] **Step 7: main.py — 把评审插进 handle_clarify_respond**

当前规则闸通过后直接返回候选契约。把这段：

```python
            readiness_issue = _clarification_readiness_issue(contract, history)
            if readiness_issue:
                question = _clarification_gate_followup(readiness_issue, conv["topic"], history)
                next_round = len([t for t in history if t["role"] == "bot"]) + 1
                store.add_turn(conversation_id, "bot", question)
                return {
                    "question": question,
                    "roundNumber": next_round,
                    "needsMoreEvidence": True,
                    "gateIssue": readiness_issue,
                }

            candidate_summary = _clarification_candidate_summary(contract)
```

改为在规则闸之后、candidate_summary 之前插入异族评审：

```python
            readiness_issue = _clarification_readiness_issue(contract, history)
            if readiness_issue:
                question = _clarification_gate_followup(readiness_issue, conv["topic"], history)
                next_round = len([t for t in history if t["role"] == "bot"]) + 1
                store.add_turn(conversation_id, "bot", question)
                return {
                    "question": question,
                    "roundNumber": next_round,
                    "needsMoreEvidence": True,
                    "gateIssue": readiness_issue,
                }

            review = _review_contract(client, contract)
            if not review["pass"]:
                # 评审判定契约空洞：转成不暴露内部字段的友好追问，对话继续
                question = _clarification_gate_followup("contrast", conv["topic"], history)
                next_round = len([t for t in history if t["role"] == "bot"]) + 1
                store.add_turn(conversation_id, "bot", question)
                return {
                    "question": question,
                    "roundNumber": next_round,
                    "needsMoreEvidence": True,
                    "reviewIssue": (review["issues"] or [""])[0],
                }
            contract["teachingHooks"] = review["teachingHooks"]

            candidate_summary = _clarification_candidate_summary(contract)
```

注意：`contract` 此处已是 `normalize_generation_contract` 的返回值（Task 2 后含 teachingHooks 键），这里用评审产出的 hooks 覆盖它。返回的 `result["contract"]` 会带上 teachingHooks，前端 onComplete 原样透传，生成时进入 request_payload。

- [ ] **Step 8: 更新 test_clarification_mock.py 的候选契约测试**

现在 `handle_clarify_respond` 在合成后**多一次** `generate_json`（契约评审）。用 `.return_value` 的 mock 会把同一个合成响应返回给评审调用，导致 `pass` 缺失→判失败。改用 `side_effect` 序列。

`test_handle_clarify_respond_returns_candidate_contract` 里：

把
```python
        mock_client = Mock()
        mock_client.generate_json.return_value = mock_response
        mock_pipeline.return_value.client = mock_client
```
改为（评审响应作为第二个返回值）：
```python
        review_response = {
            "content": {"pass": True, "issues": [], "teachingHooks": ["装饰器调用时机决定闭包捕获", "cell 变量在赋值时被判定为局部"]},
            "usage": {},
            "model": "mock-judge",
        }
        mock_client = Mock()
        mock_client.generate_json.side_effect = [mock_response, review_response]
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client
```

并在断言区加：
```python
        assert result["contract"]["teachingHooks"] == ["装饰器调用时机决定闭包捕获", "cell 变量在赋值时被判定为局部"]
```

在该测试文件顶部（import 之后）加一个共享的 mock config helper（供本测试和新增测试用）：
```python
class _MockConfig:
    model = "mock-clarify"
    clarify_model = "mock-clarify"
    judge_model = "mock-judge"
    research_model = None


def _mock_config():
    return _MockConfig()
```

`test_handle_clarify_respond_rejects_weak_synthesis`（已有的规则闸测试）：它的 mock 走的是规则闸失败路径（合成前就被 readiness gate 挡下，不会走到评审），确认它仍只需一次 generate_json——若该测试用 `.return_value` 且断言 needsMoreEvidence，则**不需要改**（规则闸在评审之前）。运行后按实际结果处理：若因 side_effect 缺失报错，则同样补 `mock_client.config = _mock_config()` 并保持 `.return_value`（规则闸路径只调用一次合成）。

- [ ] **Step 9: 为评审失败路径加一个新测试**

在 `test_clarification_mock.py` 末尾（函数式测试区）加：

```python
def test_handle_clarify_respond_rejects_hollow_contract_via_review():
    """规则闸通过但异族评审判定契约空洞时，继续追问而非给候选契约。"""
    store = get_store()
    conv_id = store.create_conversation("尼采哲学")
    for i in range(3):
        store.add_turn(conv_id, "bot", f"问题{i}")
        store.add_turn(conv_id, "user", f"这是我第{i}个足够长的具体回答，描述了差异现象和困惑")

    synthesis = {
        "content": {
            "complete": True,
            "contract": {
                "drivingQuestion": "为什么上帝已死意味着尺度崩塌而不仅是信仰缺失？",
                "centralTension": "直觉以为少个指南，实则衡量价值的尺度整体失效",
                "knowledgeType": "conceptual",
                "audience": "对存在主义有零散直觉的初学者",
                "desiredOutcome": "能解释尺度崩塌的机制",
                "scope": {"include": ["上帝已死", "虚无主义"], "exclude": ["海德格尔阐释"], "depth": "机制深挖"},
                "problemFraming": {
                    "phenomenon": "现代人没有明确信仰也能凭常识活得好好的",
                    "contrast": "直觉当少个旧指南；尼采说是评价尺度整体失效",
                    "problemNature": "model_mismatch",
                    "systemGoal": "理解尺度崩塌后的真实生存处境",
                    "modelGap": "缺少价值尺度这一对象模型",
                },
            },
        },
        "usage": {}, "model": "mock-clarify",
    }
    review_fail = {
        "content": {"pass": False, "issues": ["modelGap 只是重复了问题，没有指出缺失的具体关系"], "teachingHooks": []},
        "usage": {}, "model": "mock-judge",
    }

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.side_effect = [synthesis, review_fail]
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client

        result = handle_clarify_respond({"conversationId": conv_id, "answer": "我想弄懂尺度崩塌"})

        assert result.get("needsMoreEvidence") is True
        assert "readyForConfirmation" not in result
        assert "contract" not in result
        # 追问不得暴露内部字段名
        assert "modelGap" not in result["question"]
        assert "problemFraming" not in result["question"]
```

- [ ] **Step 10: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_clarification_mock.py' -v && python3 -m unittest discover -s agent-backend/tests -p 'test_contract_review.py' -v`
Expected: 全部 PASS

- [ ] **Step 11: 全量回归 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

```bash
git add agent-backend/app/clarification_prompts.py agent-backend/app/main.py agent-backend/tests/test_contract_review.py agent-backend/tests/test_clarification_mock.py
git commit -m "Add cross-family contract review gate producing teachingHooks"
```

---

### Task 4: 契约接地——research 出题 + plan 规划

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_research_query_prompts、build_essay_plan_prompts）
- Modify: `agent-backend/app/research.py`（run_research 把 teachingHooks 传给 query prompt）
- Test: `agent-backend/tests/test_essay_writing_mode.py`

**Interfaces:**
- Produces: `build_research_query_prompts(topic, contract)` 的 user_prompt 含 `problemFraming.modelGap`、`problemFraming.contrast`、`teachingHooks`
- Produces: `build_essay_plan_prompts` 的 user_prompt 含"每章弧线必须服务于填补 modelGap"的硬指令
- Consumes: contract 的 `problemFraming`、`teachingHooks`（Task 2 保证 teachingHooks 存在）

- [ ] **Step 1: 写失败测试**

在 `agent-backend/tests/test_essay_writing_mode.py` 末尾追加：

```python
class ContractGroundingResearchPlanTests(unittest.TestCase):
    def _contract(self):
        return {
            "drivingQuestion": "尼采为什么把困境说成价值秩序危机？",
            "centralTension": "摆脱旧权威不等于获得新尺度",
            "knowledgeType": "conceptual",
            "audience": "想理解尼采的学习者",
            "desiredOutcome": "能解释价值秩序危机",
            "scope": {"include": ["价值秩序", "上帝之死"], "exclude": ["萨特专题"], "depth": "深挖"},
            "problemFraming": {
                "phenomenon": "旧道德权威退场后人仍需判断什么值得追求",
                "contrast": "直觉认为自由即无约束；尼采问旧尺度崩塌后新尺度从哪来",
                "problemNature": "model_mismatch",
                "systemGoal": "建立价值秩序约束判断的模型",
                "modelGap": "缺少上帝之死、虚无主义、价值重估之间的关系链",
            },
            "teachingHooks": ["《快乐的科学》125 节狂人宣告", "重估一切价值的晚期计划"],
        }

    def test_research_query_prompt_grounds_on_model_gap_and_hooks(self):
        from essay_prompts import build_research_query_prompts
        _, user = build_research_query_prompts("尼采哲学", self._contract())
        self.assertIn("缺少上帝之死、虚无主义、价值重估之间的关系链", user)  # modelGap
        self.assertIn("直觉认为自由即无约束", user)                          # contrast
        self.assertIn("《快乐的科学》125 节狂人宣告", user)                   # teachingHooks 种子

    def test_plan_prompt_requires_filling_model_gap(self):
        from essay_prompts import build_essay_plan_prompts
        payload = {"topic": "尼采哲学", "output_slug": "x", "contract": self._contract()}
        _, user = build_essay_plan_prompts(payload)
        self.assertIn("modelGap", user)      # 指令引用了模型缺口概念
        self.assertIn("填补", user)          # 要求章节弧线服务于填补缺口
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_essay_writing_mode.py' -v`
Expected: 两个新测试 FAIL

- [ ] **Step 3: 实现 build_research_query_prompts 接地**

把 `build_research_query_prompts` 的 user_prompt 整体替换为（在 scope 之后加入 framing 与 hooks）：

```python
    scope = contract.get("scope") or {}
    framing = contract.get("problemFraming") or {}
    hooks = contract.get("teachingHooks") or []
    user_prompt = (
        f"课程主题：{topic}\n"
        f"驱动问题：{contract.get('drivingQuestion')}\n"
        f"必须覆盖：{json.dumps(scope.get('include') or [], ensure_ascii=False)}\n"
        f"不覆盖：{json.dumps(scope.get('exclude') or [], ensure_ascii=False)}\n"
        f"读者的模型缺口（搜索要能补上它）：{framing.get('modelGap')}\n"
        f"直觉与现实的冲突（搜索要能照亮它）：{framing.get('contrast')}\n"
        f"必须讲到的具体锚点：{json.dumps(hooks, ensure_ascii=False)}\n\n"
        "生成 6-10 个搜索查询，中英混合，具体到概念名、文本名、机制名或争论点；"
        "查询要优先命中能补上『模型缺口』和覆盖『具体锚点』的一手/权威材料。\n"
        "另外给出 wikiTopics：3-6 个维基百科条目名（人名、著作名、概念名），"
        "必须覆盖『必须覆盖』清单和『具体锚点』里出现的每一个思想家和核心概念，不要只围绕主主题。\n"
        '输出 JSON：{"queries": ["...", "..."], "wikiTopics": ["条目名", "..."]}'
    )
    return system_prompt, user_prompt
```

- [ ] **Step 4: 实现 build_essay_plan_prompts 接地指令**

在 build_essay_plan_prompts 的硬约束段之后（`if evidence_digest:` 追加句之前）加一段 modelGap 指令。把这段：

```python
    user_prompt += (
        "硬约束：chapters 必须 4-6 个；章节标题必须像论证步骤，不要写'基础概念/进阶应用'；"
        "factSpine 必须 3-5 条且每条是具体事实、文本、数字或机制锚点，不能是概念定义，不能为空。"
    )
    if evidence_digest:
```

改为：

```python
    framing = contract.get("problemFraming") or {}
    hooks = contract.get("teachingHooks") or []
    user_prompt += (
        "硬约束：chapters 必须 4-6 个；章节标题必须像论证步骤，不要写'基础概念/进阶应用'；"
        "factSpine 必须 3-5 条且每条是具体事实、文本、数字或机制锚点，不能是概念定义，不能为空。\n"
        f"这门课要填补的读者模型缺口：{framing.get('modelGap')}。"
        "drivingQuestion 必须是全课真正回答的问题；每一章的弧线都要服务于填补上述 modelGap，"
        "不要写成与缺口无关的百科罗列。"
    )
    if hooks:
        user_prompt += f"以下具体锚点必须在课程中被讲到，factSpine 要优先回应它们：{json.dumps(hooks, ensure_ascii=False)}。"
    if evidence_digest:
```

- [ ] **Step 5: research.py 把 teachingHooks 传给出题**

`build_research_query_prompts(topic, contract)` 已直接读 contract，无需改签名——`run_research` 收到的 `contract` 就是 request_payload["contract"]，Task 2 后已含 teachingHooks。**确认** research.py 第 197 行 `sys_p, usr_p = build_research_query_prompts(topic, contract)` 的 `contract` 变量确实是完整契约（是 run_research 的入参）。无代码改动，仅在本步骤 grep 确认：

Run: `grep -n "def run_research\|build_research_query_prompts(topic, contract)" agent-backend/app/research.py`
Expected: run_research 的 contract 参数直达 query prompt，teachingHooks 自然透传。

- [ ] **Step 6: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（test_job_pipeline 的 FakeClient 契约无 teachingHooks 键 → `contract.get("teachingHooks")` 返回 None → hooks 为空列表，不影响现有断言）

- [ ] **Step 7: Commit**

```bash
git add agent-backend/app/essay_prompts.py agent-backend/tests/test_essay_writing_mode.py
git commit -m "Ground research queries and plan on modelGap and teachingHooks"
```

---

### Task 5: 契约接地——compose 章节 + verify 终检

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_chapter_prompts、build_course_verify_prompts）
- Modify: `agent-backend/app/pipeline.py`（_run_verify 传 contract 给 verify prompt——已传，确认 modelGap 可达）
- Test: `agent-backend/tests/test_essay_writing_mode.py`、`agent-backend/tests/test_job_pipeline.py`

**Interfaces:**
- Produces: `build_chapter_prompts` 的 user_prompt 含 `problemFraming.phenomenon` 与 `problemFraming.modelGap`
- Produces: `build_course_verify_prompts` 的 user_prompt 含"modelGap 是否被填补"的检查项，签名加 `model_gap: str | None = None`
- Consumes: `_run_verify` 已把 `composed_artifact["course"].get("contract")` 传给 verify prompt 的 plan_artifact

- [ ] **Step 1: 写失败测试**

在 `test_essay_writing_mode.py` 的 `ContractGroundingResearchPlanTests` 类里加两个方法（复用其 `_contract`）：

```python
    def test_chapter_prompt_carries_phenomenon_and_model_gap(self):
        from essay_prompts import build_chapter_prompts
        payload = {"topic": "尼采哲学", "output_slug": "x", "contract": self._contract()}
        plan = {
            "register": "essay", "writingMode": "conceptual-essay",
            "drivingQuestion": self._contract()["drivingQuestion"],
            "centralTension": self._contract()["centralTension"],
            "overview": {"whyExists": "", "wherePoints": "", "arc": []},
            "chapterPlans": [{"id": "c01", "number": 1}],
            "factSpine": [],
        }
        _, user = build_chapter_prompts(
            request_payload=payload, plan_artifact=plan,
            chapter_plan={"id": "c01", "number": 1, "title": "t", "role": "r"},
            prev_chapter_ending=None,
        )
        self.assertIn("旧道德权威退场后人仍需判断什么值得追求", user)  # phenomenon
        self.assertIn("缺少上帝之死、虚无主义、价值重估之间的关系链", user)  # modelGap

    def test_verify_prompt_checks_model_gap_filled(self):
        from essay_prompts import build_course_verify_prompts
        _, user = build_course_verify_prompts(
            plan_artifact={"drivingQuestion": "q", "centralTension": "t", "contract": {"desiredOutcome": "o"}},
            chapters=[{"id": "c01", "title": "x", "role": "r", "narrative": [{"type": "text", "content": "正文"}]}],
            model_gap="缺少某某关系模型",
        )
        self.assertIn("缺少某某关系模型", user)
        self.assertIn("填补", user)
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_essay_writing_mode.py' -v`
Expected: 两个新测试 FAIL（build_course_verify_prompts 无 model_gap 参数 → TypeError；chapter prompt 无 phenomenon）

- [ ] **Step 3: build_chapter_prompts 接地**

在 build_chapter_prompts 的 user_prompt 初始块里，`上一章结尾` 那一行之前加入 problemFraming。把：

```python
        f"- factSpine: {json.dumps(plan_artifact.get('factSpine') or [], ensure_ascii=False, indent=2)}\n\n"
        f"上一章结尾（用于承接声音和过渡）：\n{prev_chapter_ending or '(第一章，无上一章)'}\n\n"
```

改为：

```python
        f"- factSpine: {json.dumps(plan_artifact.get('factSpine') or [], ensure_ascii=False, indent=2)}\n"
        f"- 读者观察到的现象（写作要回应它）: {(contract.get('problemFraming') or {}).get('phenomenon')}\n"
        f"- 读者缺失的模型（本章要帮着补）: {(contract.get('problemFraming') or {}).get('modelGap')}\n\n"
        f"上一章结尾（用于承接声音和过渡）：\n{prev_chapter_ending or '(第一章，无上一章)'}\n\n"
```

- [ ] **Step 4: build_course_verify_prompts 接地**

签名加 `model_gap`：

```python
def build_course_verify_prompts(
    *,
    plan_artifact: dict[str, Any],
    chapters: list[dict[str, Any]],
    model_gap: str | None = None,
) -> tuple[str, str]:
```

user_prompt 的检查清单加一条。把：

```python
        + "\n\n检查：\n"
        "1. 全课读完，drivingQuestion 是否被实际回答（不是被绕开或替换）。\n"
        "2. 末章（全文已给出）是否完成收束，给出可迁移的判断框架，而不是继续抛问题。\n"
        "3. 章节之间的论证是否连续，有没有断裂或重复空转。\n"
        '输出 JSON：{"pass": true/false, "issues": ["具体问题"]}'
```

改为：

```python
        + "\n\n检查：\n"
        "1. 全课读完，drivingQuestion 是否被实际回答（不是被绕开或替换）。\n"
        f"2. 读者原本缺失的模型是否被填补：{model_gap or '(未提供)'}。全课是否真的建立了这个模型，而不是绕开。\n"
        "3. 末章（全文已给出）是否完成收束，给出可迁移的判断框架，而不是继续抛问题。\n"
        "4. 章节之间的论证是否连续，有没有断裂或重复空转。\n"
        '输出 JSON：{"pass": true/false, "issues": ["具体问题"]}'
```

- [ ] **Step 5: pipeline.py 把 model_gap 传给 verify prompt**

`_run_verify` 里的 `build_course_verify_prompts(...)` 调用加 `model_gap`。把：

```python
        system_prompt, user_prompt = build_course_verify_prompts(
            plan_artifact={**plan_artifact, "drivingQuestion": composed_artifact["course"].get("drivingQuestion"),
                           "centralTension": composed_artifact["course"].get("centralTension"),
                           "contract": composed_artifact["course"].get("contract")},
            chapters=chapters,
        )
```

改为：

```python
        course_contract = composed_artifact["course"].get("contract") or {}
        model_gap = (course_contract.get("problemFraming") or {}).get("modelGap")
        system_prompt, user_prompt = build_course_verify_prompts(
            plan_artifact={**plan_artifact, "drivingQuestion": composed_artifact["course"].get("drivingQuestion"),
                           "centralTension": composed_artifact["course"].get("centralTension"),
                           "contract": course_contract},
            chapters=chapters,
            model_gap=model_gap,
        )
```

- [ ] **Step 6: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（test_job_pipeline 的 verify 测试：course.contract 存在，modelGap 从 problemFraming 取，FakeClient contract 有 problemFraming.modelGap → 正常；course_verify 调用签名兼容）

- [ ] **Step 7: 验证 verify 测试仍绿**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v 2>&1 | grep -E "verify|Ran|OK|FAIL"`
Expected: verify 相关测试 PASS

- [ ] **Step 8: Commit**

```bash
git add agent-backend/app/essay_prompts.py agent-backend/app/pipeline.py agent-backend/tests/test_essay_writing_mode.py
git commit -m "Ground chapter composition and verify on phenomenon and modelGap"
```

---

### Task 6: 文档同步 + 真实冒烟

**Files:**
- Modify: `README.md`（澄清环节描述补 clarify_model + 语义评审 + teachingHooks）
- Modify: `docs/superpowers/specs/2026-07-11-clarification-optimization-design.md`（状态改已实施）
- 冒烟为手动步骤

- [ ] **Step 1: README**

在 README 的"课程生成架构"澄清段落（`[Clarification]` 附近），把澄清描述补充为包含语义评审门。找到：

```txt
[Clarification] LLM 多轮澄清，提出候选 contract（固定问卷不能替代）
```

在其后加两行：

```txt
    ├─ 异族 LLM 评审契约实质（挡空洞契约），不过则继续追问
    └─ 通过时产出 teachingHooks（具体教学抓手），约束下游生成
```

"Agent Backend"段的 per-stage 模型清单（`research_model`、`judge_model`）加上 `clarify_model`（澄清对话，建议强推理模型）。

- [ ] **Step 2: 设计文档状态**

`docs/superpowers/specs/2026-07-11-clarification-optimization-design.md` 头部 `状态：已获用户批准` 改为 `状态：已实施（2026-07-11）`。

- [ ] **Step 3: 全量验证**

Run: `npm test && npm run check && npx tsc --noEmit`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-11-clarification-optimization-design.md
git commit -m "Document clarification grounding and semantic gate"
```

- [ ] **Step 5: 真实冒烟（手动）**

1. `sudo systemctl restart agent-backend`
2. 设置面板配 `clarify_model`（现有池里选强推理的，如 glm-5.2；judge_model 已配异族则评审生效）
3. 前端走澄清：故意先给一个空洞回答，确认评审能挡下并追问；再给实质回答，确认通过并出候选契约
4. 确认候选契约里 teachingHooks 有具体锚点
5. 生成课程，检查 job 的 request.contract.teachingHooks 是否透传，research.json 的 queries/wikiTopics 是否覆盖了 hooks，成品章节是否回应了 phenomenon/modelGap
6. 与既有 nietzsche-open 对读，判断接地是否让课程更贴合用户真实缺口

---

## Self-Review 记录

- 规格覆盖：设计 5 节 → Task 1（clarify_model）、Task 2（teachingHooks 规范化）、Task 3（评审 gate + teachingHooks 产出）、Task 4（research+plan 接地）、Task 5（compose+verify 接地）、Task 6（文档+冒烟）逐条对齐
- 关键集成风险已处理：Task 3 Step 8 明确把现有 mock 从 `.return_value` 改为 `.side_effect` 序列（评审是第二次 generate_json 调用），并加 `mock_client.config`；否则现有澄清测试必挂
- 类型一致：`build_contract_review_prompts(contract)->tuple[str,str]`、评审输出 `{pass,issues,teachingHooks}`、`_review_contract` 返回同结构、contract["teachingHooks"] 为 str 列表——全程一致
- 向后兼容：teachingHooks 是可选字段，FakeClient/旧 contract 无此键时 `.get` 返回 None→空列表，下游 prompt 不注入 hooks 段，现有 test_job_pipeline 断言不受影响
- 占位符扫描：无 TBD/TODO，所有代码步骤给出完整代码
