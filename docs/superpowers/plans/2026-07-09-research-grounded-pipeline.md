# 开卷生成管线（Research-Grounded Pipeline）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把课程生成从"闭卷默写"改为"开卷写作"：新增 Research/Verify 阶段、证据库机器校验、per-stage 模型配置、异族交叉评审，并恢复人工发布门。

**Architecture:** agent-backend（零第三方依赖 Python）在现有 plan→compose→validate→export 管线前后插入 research 和 verify 阶段；证据以 quote 子串校验为机器防线；judge/research 走独立模型配置；发布回到 waiting_review 人工门。前端补 review UI、stage 标签、章末参考资料。

**Tech Stack:** Python 3.10 stdlib（urllib/html.parser/unittest）、Next.js 14 + TypeScript、现有 OpenAI-compatible 中转站。

**设计文档:** `docs/superpowers/specs/2026-07-09-research-grounded-pipeline-design.md`

## Global Constraints

- agent-backend 不引入任何第三方依赖（现状约束，见 README"Python agent-backend（零第三方依赖）"）
- 所有测试命令在仓库根 `/home/ubuntu/learnVisualization` 运行
- Python 测试统一用 `python3 -m unittest discover -s agent-backend/tests -p '<file>.py' -v`
- 前端类型检查 `npx tsc --noEmit`；全量校验 `npm test` + `npm run check`
- 每个 Task 结束必须 commit；commit message 末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 生成内容语言为中文；错误信息面向用户的用中文
- 旧任务（jobs/ 里已存在的 job.json，stages 只有 4 个）在新代码下 retry/读取不得崩溃

---

## 一期（速效）：Tasks 1-4 + 运维切换

### Task 1: Per-stage 模型配置（provider + 设置面板）

**Files:**
- Modify: `agent-backend/app/provider.py`
- Modify: `agent-backend/app/main.py:722-741`（update_provider_config）
- Modify: `src/components/SettingsPanel.tsx`
- Test: `agent-backend/tests/test_provider_models.py`（新建）

**Interfaces:**
- Produces: `ProviderConfig.research_model: str | None`、`ProviderConfig.judge_model: str | None`（dataclass 字段）
- Produces: `OpenAICompatibleClient.generate_json(..., model: str | None = None)` — per-call 模型覆盖，None 沿用 config.model；fallback_model 对任何 chosen model 生效
- Produces: `model_family(model: str | None) -> str` — 模型家族识别（provider.py 模块级函数）
- Produces: `POST /provider-config` 接受 `research_model`/`judge_model` 字段；空字符串=清除覆盖（与 base_url 等"空=不改"语义不同，因为可选覆盖必须能清除）

- [ ] **Step 1: 写失败测试**

创建 `agent-backend/tests/test_provider_models.py`：

```python
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from provider import OpenAICompatibleClient, ProviderConfig, ProviderError, model_family  # noqa: E402


def _ok_payload():
    return {"choices": [{"message": {"content": "{}"}}], "usage": {}, "model": "echo"}


class PerCallModelTests(unittest.TestCase):
    def make_client(self, **kwargs):
        config = ProviderConfig(base_url="http://fake.local/v1", model="writer-a", **kwargs)
        return OpenAICompatibleClient(config)

    def test_generate_json_uses_config_model_by_default(self):
        client = self.make_client()
        captured = []
        with patch.object(client, "_post_json", side_effect=lambda body: (captured.append(body["model"]), _ok_payload())[1]):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u")
        self.assertEqual(captured, ["writer-a"])

    def test_generate_json_per_call_model_override(self):
        client = self.make_client()
        captured = []
        with patch.object(client, "_post_json", side_effect=lambda body: (captured.append(body["model"]), _ok_payload())[1]):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u", model="judge-c")
        self.assertEqual(captured, ["judge-c"])

    def test_fallback_applies_to_overridden_model(self):
        client = self.make_client(fallback_model="backup-b")
        calls = []

        def fake_post(body):
            calls.append(body["model"])
            if len(calls) == 1:
                raise ProviderError("boom")
            return _ok_payload()

        with patch.object(client, "_post_json", side_effect=fake_post):
            client.generate_json(schema_name="x", system_prompt="s", user_prompt="u", model="judge-c")
        self.assertEqual(calls, ["judge-c", "backup-b"])

    def test_model_family(self):
        self.assertEqual(model_family("z-ai/glm-5.1"), "glm")
        self.assertEqual(model_family("claude-sonnet-5"), "claude")
        self.assertEqual(model_family("openai/gpt-5.2"), "gpt")
        self.assertEqual(model_family("gemini-3-pro"), "gemini")
        self.assertEqual(model_family(None), "")

    def test_config_carries_stage_models(self):
        config = ProviderConfig(base_url="http://fake.local/v1", model="a", research_model="r", judge_model="j")
        self.assertEqual(config.research_model, "r")
        self.assertEqual(config.masked["research_model"], "r")
        self.assertEqual(config.masked["judge_model"], "j")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_provider_models.py' -v`
Expected: FAIL（ImportError: cannot import name 'model_family' / TypeError unexpected keyword）

- [ ] **Step 3: 实现 provider.py**

`ProviderConfig` dataclass 增加两个字段（在 `fallback_model` 之后）：

```python
    fallback_model: str | None = None
    research_model: str | None = None
    judge_model: str | None = None
```

`from_env()` 中 `fallback_model = ...` 行后加：

```python
        research_model = os.environ.get("AGENT_LLM_RESEARCH_MODEL") or None
        judge_model = os.environ.get("AGENT_LLM_JUDGE_MODEL") or None
```

runtime overrides 块（`if rt.get("fallback_model")` 后）加：

```python
        if rt.get("research_model"):
            research_model = rt["research_model"]
        if rt.get("judge_model"):
            judge_model = rt["judge_model"]
```

`cls(...)` 构造加 `research_model=research_model, judge_model=judge_model`。

`masked` property 加：

```python
            "research_model": self.research_model,
            "judge_model": self.judge_model,
```

模块级（ProviderError 类之后）加：

```python
_MODEL_FAMILIES = ("claude", "gpt", "gemini", "glm", "deepseek", "qwen", "llama", "mistral", "kimi", "grok")


def model_family(model: str | None) -> str:
    """Crude family detector for cross-family judge warnings."""
    name = (model or "").lower()
    if "/" in name:
        name = name.rsplit("/", 1)[-1]
    for family in _MODEL_FAMILIES:
        if family in name:
            return family
    return name.split("-")[0] if name else ""
```

`generate_json` 签名与 body（`model` 参数 + fallback 用 chosen 比较）：

```python
    def generate_json(
        self,
        *,
        schema_name: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.2,
        max_tokens: int = 8000,
        model: str | None = None,
    ) -> dict[str, Any]:
        chosen_model = model or self.config.model
        body = {
            "model": chosen_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }

        try:
            return self._call_and_parse(body, schema_name)
        except ProviderError:
            if not self.config.fallback_model or self.config.fallback_model == chosen_model:
                raise
            body["model"] = self.config.fallback_model
            return self._call_and_parse(body, schema_name)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_provider_models.py' -v`
Expected: 6 tests PASS

- [ ] **Step 5: main.py 设置端点**

`update_provider_config` 的 for 循环之后（`ProviderConfig.save_runtime_config(current_rt)` 之前）加：

```python
    # Optional per-stage overrides: empty string explicitly clears the override
    for field in ("research_model", "judge_model"):
        if field in payload:
            value = str(payload.get(field) or "").strip()
            if value:
                current_rt[field] = value
            else:
                current_rt.pop(field, None)
```

- [ ] **Step 6: SettingsPanel.tsx**

`ProviderConfigMasked` 接口加：

```typescript
  research_model: string | null;
  judge_model: string | null;
```

state（`fallbackModel` 之后）加：

```typescript
  const [researchModel, setResearchModel] = useState('');
  const [judgeModel, setJudgeModel] = useState('');
```

`loadConfig` 的 set 块加：

```typescript
      setResearchModel(data.research_model || '');
      setJudgeModel(data.judge_model || '');
```

`handleSave` 的 body JSON 加 `research_model: researchModel, judge_model: judgeModel`；成功后的 set 块加同 loadConfig 的两行。

form 里 Fallback Model Field 之后加：

```tsx
                <Field label={isZh ? 'Research Model（可选）' : 'Research Model (optional)'} value={researchModel} onChange={setResearchModel} placeholder={isZh ? '留空 = 用主模型' : 'Empty = main model'} />
                <Field label={isZh ? 'Judge Model（可选，建议异族）' : 'Judge Model (optional, cross-family)'} value={judgeModel} onChange={setJudgeModel} placeholder={isZh ? '留空 = 用主模型' : 'Empty = main model'} />
```

- [ ] **Step 7: 验证**

Run: `npx tsc --noEmit && python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: tsc 无输出；unittest 全部 OK

- [ ] **Step 8: Commit**

```bash
git add agent-backend/app/provider.py agent-backend/app/main.py src/components/SettingsPanel.tsx agent-backend/tests/test_provider_models.py
git commit -m "Add per-stage model config (research/judge) with per-call override"
```

---

### Task 2: factSpine 必填校验 + 修复重试

**Files:**
- Modify: `agent-backend/app/essay_quality.py`（新增 validate_fact_spine）
- Modify: `agent-backend/app/essay_prompts.py:42-79`（build_essay_plan_prompts 加 revision_feedback）
- Modify: `agent-backend/app/pipeline.py:640-671`（_run_plan 重试循环）、`pipeline.py:805-810`（factSpine 归一化为对象）、`pipeline.py:1051-1069`（course record 带 factSpine）
- Test: `agent-backend/tests/test_job_pipeline.py`（新增两个测试）

**Interfaces:**
- Produces: `validate_fact_spine(fact_spine: Any, *, evidence_ids: set[str] | None = None) -> list[str]`（essay_quality.py；一期 evidence_ids=None，二期 Task 8 传集合）
- Produces: `build_essay_plan_prompts(request_payload, *, revision_feedback: str | None = None)`（关键字参数）
- Produces: plan_artifact["factSpine"] 归一化为 `[{"claim": str, "evidenceIds": [str]}]`（一期 evidenceIds 恒为 []；course.json 也带上 factSpine）

- [ ] **Step 1: 写失败测试**

在 `test_job_pipeline.py` 的 `FakeClient` 里给 plan 分支加一个可注入的开关。修改 `FakeClient.__init__`：

```python
    def __init__(self):
        self.config = _FakeConfig()
        self.chapter_prompts: list[str] = []
        self.plan_prompts: list[str] = []
        self.bad_fact_spine_times = 0  # 前 N 次 plan 返回空 factSpine
```

plan 分支（`elif schema_name == "essay_course_plan":`）开头加记录与开关：

```python
        elif schema_name == "essay_course_plan":
            self.plan_prompts.append(user_prompt)
            fact_spine = [
                "LRU 命中后会更新 recency 元数据",
                "TTL 过期即使没有容量压力也不能继续返回旧值",
                "容量满时仍然有效的 entry 也可能被淘汰",
            ]
            if self.bad_fact_spine_times > 0:
                self.bad_fact_spine_times -= 1
                fact_spine = []
            content = {
```

并把原 content 里硬编码的 `"factSpine": [...]` 换成 `"factSpine": fact_spine,`。

测试类里加：

```python
    def test_plan_retries_once_when_fact_spine_missing_then_succeeds(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 1
        slug = f"test-spine-retry-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with patch.object(pipeline, "_run_next_build", return_value={"ok": True, "skipped": True}):
            job = pipeline.run_job(job["id"])

        self.assertEqual(len(client.plan_prompts), 2)
        self.assertIn("factSpine", client.plan_prompts[1])  # 修复反馈进入第二次 prompt
        plan = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
        self.assertEqual(len(plan["factSpine"]), 3)
        self.assertEqual(plan["factSpine"][0]["claim"], "LRU 命中后会更新 recency 元数据")
        self.assertEqual(plan["factSpine"][0]["evidenceIds"], [])

    def test_plan_fails_when_fact_spine_never_valid(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 99
        slug = f"test-spine-fail-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("factSpine", job["error"]["message"])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 两个新测试 FAIL（plan 只被调一次 / job 成功而非失败）

- [ ] **Step 3: essay_quality.py 加校验函数**

文件末尾加：

```python
def validate_fact_spine(fact_spine: Any, *, evidence_ids: set[str] | None = None) -> list[str]:
    """factSpine 硬校验：非空、每条 claim 具体；二期传 evidence_ids 后每条必须挂到有效证据。"""
    issues: list[str] = []
    items = fact_spine if isinstance(fact_spine, list) else []
    if len(items) < 3:
        issues.append(f"factSpine 至少 3 条具体事实锚点，当前只有 {len(items)} 条")
    for index, item in enumerate(items):
        claim = str(item.get("claim") if isinstance(item, dict) else item or "").strip()
        if len(claim) < 10:
            issues.append(f"factSpine[{index}] 过短，不是具体事实/案例/机制锚点")
        if evidence_ids is not None:
            ids = [str(x).strip() for x in (item.get("evidenceIds") or [])] if isinstance(item, dict) else []
            if not any(x in evidence_ids for x in ids):
                issues.append(f"factSpine[{index}] 没有挂到任何有效证据 id")
    return issues
```

- [ ] **Step 4: essay_prompts.py 支持修复反馈**

`build_essay_plan_prompts` 签名改为：

```python
def build_essay_plan_prompts(
    request_payload: dict[str, Any],
    *,
    revision_feedback: str | None = None,
) -> tuple[str, str]:
```

user_prompt 末尾（`"factSpine 必须具体，不能是概念定义。"` 之后）改为拼接：

```python
    user_prompt += (
        "硬约束：chapters 必须 4-6 个；章节标题必须像论证步骤，不要写“基础概念/进阶应用”；"
        "factSpine 必须 3-5 条且每条是具体事实、文本、数字或机制锚点，不能是概念定义，不能为空。"
    )
    if revision_feedback:
        user_prompt += f"\n\n上一版规划未通过校验，必须修正：{revision_feedback}\n"
    return system_prompt, user_prompt
```

（把原 f-string 里最后那段硬约束文字从主体里移出来，保持内容一致。）

- [ ] **Step 5: pipeline.py 改 _run_plan 与归一化**

导入区加 `validate_fact_spine`（两个 try/except 分支都加，与 evaluate_chapter_quality 同行位置）。

`_run_plan` 整体替换为重试循环：

```python
    def _run_plan(self, job_id: str, request_payload: dict[str, Any], *, client: OpenAICompatibleClient | None = None) -> dict[str, Any]:
        client = client or self.client
        revision_feedback: str | None = None
        normalized: dict[str, Any] = {}
        for attempt in range(2):
            system_prompt, user_prompt = build_essay_plan_prompts(request_payload, revision_feedback=revision_feedback)
            response = client.generate_json(
                schema_name="essay_course_plan",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            self.store.write_log(
                job_id,
                "plan",
                json.dumps(
                    {
                        "attempt": attempt + 1,
                        "usage": response["usage"],
                        "model": response.get("model"),
                        "title": (response.get("content") or {}).get("title"),
                        "chapterCount": len((response.get("content") or {}).get("chapters") or []),
                        **(
                            {
                                "systemPrompt": system_prompt,
                                "userPrompt": user_prompt,
                                "response": response["content"],
                            }
                            if os.environ.get("AGENT_DEBUG_LOG_PROMPTS", "").strip().lower() in {"1", "true", "yes", "on"}
                            else {}
                        ),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )
            normalized = self._normalize_essay_plan(response["content"], request_payload)
            issues = validate_fact_spine(normalized["factSpine"])
            if not issues:
                return normalized
            revision_feedback = "；".join(issues)
        raise ValueError(f"课程规划未通过 factSpine 校验: {revision_feedback}")
```

`_normalize_essay_plan` 里 factSpine 块（pipeline.py:805-810）替换为对象归一化：

```python
        raw_fact_spine = (payload.get("factSpine") if isinstance(payload, dict) else []) or []
        normalized_spine: list[dict[str, Any]] = []
        for item in raw_fact_spine[:5]:
            if isinstance(item, dict):
                claim = str(item.get("claim") or "").strip()
                ids = [str(x).strip() for x in (item.get("evidenceIds") or []) if str(x).strip()]
            else:
                claim = str(item).strip()
                ids = []
            if claim:
                normalized_spine.append({"claim": claim, "evidenceIds": ids})
        normalized["factSpine"] = normalized_spine
```

`_build_course_record` 返回 dict 里（`"overview"` 行前）加：

```python
            "factSpine": plan_artifact.get("factSpine") or [],
```

- [ ] **Step 6: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 全部 PASS（含原有测试——原 FakeClient 返回 3 条字符串 factSpine，归一化成对象后校验通过）

- [ ] **Step 7: 全量回归 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

```bash
git add agent-backend/app/essay_quality.py agent-backend/app/essay_prompts.py agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py
git commit -m "Require validated factSpine with one repair retry"
```

---

### Task 3: 拆 auto-publish，恢复 waiting_review 人工门

**Files:**
- Modify: `agent-backend/app/pipeline.py:437-459`（run_job 尾部）、`pipeline.py:740-745`（compose 的 review_approval 注释保持）
- Modify: `agent-backend/tests/test_job_pipeline.py`（改两个测试）
- Modify: `src/components/GenerateForm.tsx`（恢复 approve UI + 驳回）
- Verify: `README.md`（流程描述应与恢复后行为一致，README 从未写过 auto-publish，预期无需改）

**Interfaces:**
- Produces: run_job 终态 = `waiting_review`，`resultSummary = {readyForPromote: true, reviewStatus: "pending", published: false, ...}`
- Consumes: `JobStore.mark_waiting_review(job_id, *, output_dir, summary)`（已存在，job_store.py:142）
- Consumes: `POST /jobs/{id}/review`（已存在，main.py:944-946；`review_job(approved=True)` 走 `_publish_output`）

- [ ] **Step 1: 改测试（TDD：先让测试描述新行为）**

`test_pipeline_exports_and_publishes_essay_package` 整体替换：

```python
    def test_pipeline_waits_for_review_then_publishes_on_approval(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-essay-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])

        # 生成完成后停在人工门，不落地 courses/
        self.assertEqual(job["status"], "waiting_review")
        self.assertFalse(job["resultSummary"].get("published"))
        self.assertTrue(job["resultSummary"]["readyForPromote"])
        self.assertFalse(promoted.exists())
        exported_dir = Path(job["artifacts"]["output"])
        self.assertTrue((exported_dir / "course.json").exists())
        self.assertTrue((exported_dir / "chapters" / "c01.json").exists())
        self.assertFalse((exported_dir / "modules").exists())
        approval = json.loads((exported_dir / "review" / "approval.json").read_text("utf-8"))
        self.assertFalse(approval["approved"])

        # 人工批准后才发布
        with patch.object(pipeline, "_run_next_build", return_value={"ok": True, "skipped": True}):
            job = pipeline.review_job(job["id"], approved=True, reviewed_by="tester", notes="ok")

        self.assertEqual(job["status"], "completed")
        self.assertTrue(job["resultSummary"]["published"])
        self.assertEqual(job["resultSummary"]["reviewStatus"], "approved")
        self.assertTrue(promoted.exists())
        course_record = json.loads((promoted / "course.json").read_text("utf-8"))
        self.assertEqual(course_record["writingMode"], "mechanism-explainer")
        self.assertEqual(course_record["contract"]["problemFraming"]["problemNature"], "model_mismatch")
```

`test_auto_publish_rolls_back_when_build_fails` 整体替换：

```python
    def test_approve_publish_rolls_back_when_build_fails(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-publish-rollback-{uuid.uuid4().hex[:8]}"
        target_dir = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(target_dir, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "waiting_review")

        with patch.object(pipeline, "_run_next_build", side_effect=RuntimeError("build failed")):
            with self.assertRaises(RuntimeError):
                pipeline.review_job(job["id"], approved=True, reviewed_by="tester", notes="")

        self.assertFalse(target_dir.exists())
        failed_job = pipeline.get_job(job["id"])
        self.assertEqual(failed_job["status"], "failed")
        self.assertEqual(failed_job["review"]["status"], "publish_failed")
```

同文件 `test_chapter_prompt_receives_previous_chapter_ending` 与 `test_plan_retries_once_when_fact_spine_missing_then_succeeds`（Task 2 加的）里的 `with patch.object(pipeline, "_run_next_build", ...)` 包裹不再必要（run_job 不再 build），改为直接 `job = pipeline.run_job(job["id"])` / `pipeline.run_job(job["id"])`，断言不变（fact_spine 测试里对 plan 工件的断言保留）。

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 新断言 FAIL（现状 run_job 直接 completed+published）

- [ ] **Step 3: 改 pipeline.run_job 尾部**

把 run_job 里 export 成功之后的整块（`output_dir = Path(export_artifact["outputDir"])` 到 `return self._publish_output(...)` 即 pipeline.py:439-459）替换为：

```python
            output_dir = Path(export_artifact["outputDir"])
            summary = {
                "outputSlug": export_artifact["outputSlug"],
                "chapterCount": export_artifact["chapterCount"],
                "moduleCount": export_artifact["chapterCount"],
                "readyForPromote": True,
                "reviewStatus": "pending",
                "published": False,
                "writingMode": composed_artifact["course"].get("writingMode"),
            }
            return self.store.mark_waiting_review(job_id, output_dir=output_dir, summary=summary)
```

`_publish_output` 保留不动（review_job 批准路径继续用它）。

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（test_promote_gate、test_course_crud 等不受影响）

- [ ] **Step 5: 恢复 GenerateForm review UI**

`src/components/GenerateForm.tsx`：

5a. `handleDismiss` 函数之前恢复 `handleApprove` 并新增 `handleReject`（基于 3b06fcf 删除的代码，agentFetch/fetchJob/isZh 均已在作用域内）：

```typescript
  async function handleApprove(jobId: string) {
    try {
      const res = await agentFetch(`/jobs/${jobId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          reviewedBy: 'site-admin',
          notes: 'Approved from course generation UI.',
        }),
      }, isZh);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const fresh = await fetchJob(jobId);
      if (fresh) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? fresh : j)));
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReject(jobId: string) {
    const notes = window.prompt(isZh ? '驳回原因（可留空）' : 'Rejection notes (optional)') ?? '';
    try {
      const res = await agentFetch(`/jobs/${jobId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, reviewedBy: 'site-admin', notes }),
      }, isZh);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const fresh = await fetchJob(jobId);
      if (fresh) {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? fresh : j)));
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  }
```

5b. `<JobCard ... onRetry={...}` 处加回 `onApprove={() => handleApprove(job.id)}` 和 `onReject={() => handleReject(job.id)}`；JobCard 的 props 解构和类型签名同步加 `onApprove: () => void; onReject: () => void;`。

5c. waiting_review 卡片：状态文案 `'等待发布' : 'Waiting to publish'` 改回 `'待人工审核' : 'Waiting for review'`；按钮区第一个位置恢复：

```tsx
          <button type="button" onClick={onApprove} className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-300">
            {isZh ? '批准并发布' : 'Approve and publish'}
          </button>
          <button type="button" onClick={onReject} className="text-xs font-medium text-[color:var(--color-muted)] hover:underline">
            {isZh ? '驳回' : 'Reject'}
          </button>
```

并删除 `// Legacy jobs may still have this status; new jobs auto-publish after validation.` 注释（改回 `// Waiting for human review before publish`）。

- [ ] **Step 6: 验证 + README 核对**

Run: `npx tsc --noEmit`
Expected: 无输出

核对 `README.md` 课程生成架构段（61-63 行）与"主要端点"里 review 描述——恢复人工门后描述已与实现一致，无需修改；若发现残留 auto-publish 表述则删除。

- [ ] **Step 7: Commit**

```bash
git add agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py src/components/GenerateForm.tsx
git commit -m "Restore human review gate before publish"
```

---

### Task 4: 异族评审——judge 走 judge_model + 同族警告

**Files:**
- Modify: `agent-backend/app/pipeline.py:879-921`（_judge_chapter）
- Modify: `agent-backend/tests/test_job_pipeline.py`（FakeClient 记录 model；新测试）

**Interfaces:**
- Consumes: Task 1 的 `generate_json(model=...)` 与 `model_family`
- Produces: judge LLM 调用携带 `model=client.config.judge_model`（未配置时 None=主模型）；同族时 stderr 警告一行

- [ ] **Step 1: 写失败测试**

FakeClient 改造：`_FakeConfig` 与 `generate_json` 签名：

```python
class _FakeConfig:
    max_retries = 0
    model = "fake-writer-glm"
    judge_model = None
    research_model = None
```

```python
    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=4000, model=None):
        self.calls.append((schema_name, model))
```

`__init__` 加 `self.calls: list[tuple[str, str | None]] = []`。

新测试：

```python
    def test_judge_calls_use_judge_model_when_configured(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.config.judge_model = "fake-judge-gemini"
        slug = f"test-judge-model-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        pipeline.run_job(job["id"])

        judge_calls = [m for (name, m) in client.calls if name.endswith("_quality_judge")]
        chapter_calls = [m for (name, m) in client.calls if name.endswith("_chapter")]
        self.assertTrue(judge_calls)
        self.assertTrue(all(m == "fake-judge-gemini" for m in judge_calls))
        self.assertTrue(all(m is None for m in chapter_calls))
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 新测试 FAIL（judge_calls 里 model 为 None）

- [ ] **Step 3: 实现 _judge_chapter**

pipeline.py 导入区给两个分支加 `model_family`（`from .provider import ... ProviderError` 行追加）。

`_judge_chapter` 的 try 块内 `response = client.generate_json(...)` 之前加：

```python
            judge_model = getattr(client.config, "judge_model", None)
            if judge_model and model_family(judge_model) == model_family(getattr(client.config, "model", "")):
                import sys
                print(
                    f"[pipeline] warning: judge_model '{judge_model}' 与写作模型同族，交叉评审的独立性受限",
                    file=sys.stderr,
                )
```

`generate_json` 调用加参数 `model=judge_model,`。

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

- [ ] **Step 5: Commit**

```bash
git add agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py
git commit -m "Route chapter judge through cross-family judge_model"
```

---

### 一期收尾：运维切换（手动，不进代码）

- [ ] 通过线上 SettingsPanel（或直接编辑 `agent-backend/runtime-config.json` 后 `sudo systemctl restart agent-backend`）：
  - `model` 换为中转站上的前沿写作模型（如 claude 系）
  - `fallback_model` 留一个不同家族的兜底
  - `judge_model` 设为与 `model` 异族的前沿模型（如 gemini/gpt 系）
  - 面板"测试连接"通过
- [ ] 生成一门测试课程走完 waiting_review → 批准 → 发布全流程，确认一期行为符合预期

---

## 二期（根治）：Tasks 5-12

### Task 5: research.py 抓取原语（纯函数，无网络测试）

**Files:**
- Create: `agent-backend/app/research.py`
- Test: `agent-backend/tests/test_research.py`（新建）

**Interfaces:**
- Produces: `http_get(url, *, timeout=20) -> str`
- Produces: `extract_main_text(html: str) -> str`
- Produces: `normalize_for_match(text: str) -> str`、`quote_in_text(quote: str, text: str) -> bool`（引文子串机器校验核心；≥12 归一化字符才算）
- Produces: `wiki_search_titles(topic, lang, limit=2) -> list[str]`、`wiki_page_text(title, lang) -> str`
- Produces: `ddg_search(query, max_results=5) -> list[dict]`（{title, url}）、`unwrap_ddg_href(href) -> str`
- Produces: 常量 `MIN_EVIDENCE = 12`、`MAX_EVIDENCE = 25`、`MAX_WEB_PAGES = 12`、`MAX_PAGE_CHARS = 30_000`

- [ ] **Step 1: 写失败测试**

创建 `agent-backend/tests/test_research.py`：

```python
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from research import extract_main_text, normalize_for_match, quote_in_text, unwrap_ddg_href  # noqa: E402


class TextExtractionTests(unittest.TestCase):
    def test_extract_main_text_keeps_paragraphs_drops_chrome(self):
        html = (
            "<html><head><style>.x{}</style><script>var a=1;</script></head><body>"
            "<nav>首页 导航</nav>"
            "<p>尼采在《快乐的科学》第 125 节借疯子之口宣告上帝已死。</p>"
            "<aside>侧边栏广告</aside>"
            "<h2>价值重估</h2><p>重估一切价值是晚期计划。</p>"
            "<footer>版权信息</footer></body></html>"
        )
        text = extract_main_text(html)
        self.assertIn("第 125 节", text)
        self.assertIn("价值重估", text)
        self.assertNotIn("导航", text)
        self.assertNotIn("广告", text)
        self.assertNotIn("var a=1", text)

    def test_quote_in_text_tolerates_whitespace_and_curly_quotes(self):
        source = "他说：“上帝死了！上帝\n真的死了！是我们杀死了他。”这一段广为流传。"
        quote = '上帝死了！上帝真的死了！是我们杀死了他。'
        self.assertTrue(quote_in_text(quote, source))

    def test_quote_in_text_rejects_paraphrase_and_short(self):
        source = "尼采认为旧的价值坐标已经失效。"
        self.assertFalse(quote_in_text("尼采认为价值坐标失效了", source))  # 改写
        self.assertFalse(quote_in_text("尼采", source))  # 太短

    def test_normalize_strips_ws_and_unifies_punct(self):
        self.assertEqual(normalize_for_match('“A B”—C'), '"ab"-c')


class DdgTests(unittest.TestCase):
    def test_unwrap_ddg_redirect(self):
        href = "//duckduckgo.com/l/?uddg=https%3A%2F%2Fplato.stanford.edu%2Fentries%2Fnietzsche%2F&rut=abc"
        self.assertEqual(unwrap_ddg_href(href), "https://plato.stanford.edu/entries/nietzsche/")

    def test_unwrap_plain_href_passthrough(self):
        self.assertEqual(unwrap_ddg_href("https://example.com/a"), "https://example.com/a")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_research.py' -v`
Expected: FAIL（ModuleNotFoundError: research）

- [ ] **Step 3: 实现 research.py（本 Task 只到抓取原语，编排器在 Task 6 追加到同文件）**

创建 `agent-backend/app/research.py`：

```python
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable
from urllib import parse, request

try:
    from .common import ensure_dir, write_json_atomic, write_text_atomic
except ImportError:
    from common import ensure_dir, write_json_atomic, write_text_atomic

USER_AGENT = "LearnVisualization-Research/1.0 (+https://visualize.sharonzhou.site)"
MAX_PAGE_CHARS = 30_000
MAX_WEB_PAGES = 12
MIN_EVIDENCE = 12
MAX_EVIDENCE = 25
FETCH_TIMEOUT = 20


def http_get(url: str, *, timeout: int = FETCH_TIMEOUT) -> str:
    req = request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "zh,en;q=0.8"})
    with request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(2_000_000)
        charset = resp.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


class _TextExtractor(HTMLParser):
    _SKIP = {"script", "style", "nav", "header", "footer", "aside", "noscript", "form", "svg"}
    _BLOCK = {"p", "li", "h1", "h2", "h3", "h4", "blockquote", "pre", "td"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_depth = 0
        self._chunks: list[str] = []
        self._current: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag in self._BLOCK:
            self._flush()

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth:
            self._skip_depth -= 1
        elif tag in self._BLOCK:
            self._flush()

    def handle_data(self, data):
        if not self._skip_depth and data.strip():
            self._current.append(data)

    def _flush(self):
        text = "".join(self._current).strip()
        if text:
            self._chunks.append(text)
        self._current = []

    def text(self) -> str:
        self._flush()
        return "\n".join(self._chunks)


def extract_main_text(html: str) -> str:
    parser = _TextExtractor()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.text()


_WS_RE = re.compile(r"\s+")
_PUNCT_MAP = str.maketrans({
    "“": '"', "”": '"', "‘": "'", "’": "'",
    "—": "-", "–": "-", "…": "...",
    "​": "", " ": " ",
})


def normalize_for_match(text: str) -> str:
    """Whitespace-free, punctuation-unified, lowercased form used ONLY for substring checks."""
    return _WS_RE.sub("", str(text).translate(_PUNCT_MAP)).lower()


def quote_in_text(quote: str, text: str) -> bool:
    q = normalize_for_match(quote)
    return len(q) >= 12 and q in normalize_for_match(text)


def wiki_search_titles(topic: str, lang: str, limit: int = 2) -> list[str]:
    url = (
        f"https://{lang}.wikipedia.org/w/api.php?action=query&list=search&format=json"
        f"&srlimit={limit}&srsearch={parse.quote(topic)}"
    )
    data = json.loads(http_get(url))
    return [item["title"] for item in data.get("query", {}).get("search", []) if item.get("title")]


def wiki_page_text(title: str, lang: str) -> str:
    url = (
        f"https://{lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1"
        f"&redirects=1&format=json&titles={parse.quote(title)}"
    )
    data = json.loads(http_get(url))
    for page in (data.get("query", {}).get("pages", {}) or {}).values():
        extract = page.get("extract")
        if extract:
            return str(extract)
    return ""


def unwrap_ddg_href(href: str) -> str:
    if href.startswith("//"):
        href = "https:" + href
    parsed = parse.urlparse(href)
    if parsed.path.startswith("/l/"):
        target = (parse.parse_qs(parsed.query).get("uddg") or [""])[0]
        return target
    return href


class _DdgResultParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[dict[str, str]] = []
        self._in_link = False
        self._href = ""
        self._title: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attr = dict(attrs)
            if "result__a" in (attr.get("class") or "") and attr.get("href"):
                self._in_link = True
                self._href = attr["href"]
                self._title = []

    def handle_data(self, data):
        if self._in_link:
            self._title.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._in_link:
            self._in_link = False
            url = unwrap_ddg_href(self._href)
            title = "".join(self._title).strip()
            if url.startswith("http") and title:
                self.results.append({"title": title, "url": url})


def ddg_search(query: str, max_results: int = 5) -> list[dict[str, str]]:
    html = http_get(f"https://html.duckduckgo.com/html/?q={parse.quote(query)}")
    parser = _DdgResultParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.results[:max_results]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_research.py' -v`
Expected: 6 tests PASS

- [ ] **Step 5: 一次真实网络冒烟（手动验证抓取路径可用，不进 CI）**

Run: `cd agent-backend && python3 -c "
from app.research import wiki_search_titles, wiki_page_text, ddg_search
titles = wiki_search_titles('尼采', 'zh')
print('wiki titles:', titles)
print('wiki text head:', wiki_page_text(titles[0], 'zh')[:120])
print('ddg:', ddg_search('Nietzsche genealogy of morals Schuld debt')[:2])
"`
Expected: 三段都有非空输出（DDG 偶发限流可接受，重试一次）

- [ ] **Step 6: Commit**

```bash
git add agent-backend/app/research.py agent-backend/tests/test_research.py
git commit -m "Add research fetching primitives with quote-fidelity matcher"
```

---

### Task 6: research.py 编排器 + 研究 prompts

**Files:**
- Modify: `agent-backend/app/research.py`（追加 run_research）
- Modify: `agent-backend/app/essay_prompts.py`（追加两个 prompt builder）
- Test: `agent-backend/tests/test_research.py`（追加编排器测试）

**Interfaces:**
- Produces: `run_research(*, topic, contract, client, research_model, sources_dir: Path, check_cancelled=lambda: None) -> dict`
  - 返回 `{"topic", "queries": [str], "documents": [{docId,title,url,chars}], "evidence": [Evidence], "stats": {...}}`
  - Evidence = `{"id": "E01", "kind": "quote|fact|example|figure", "content": str, "note": str, "sourceTitle": str, "sourceUrl": str, "docId": str}`
  - kind=quote 未通过 `quote_in_text` 对原文校验 → 丢弃；可用证据 < MIN_EVIDENCE → `raise ValueError`（含中文提示）
  - 抓取原文写入 `sources_dir/DNN.txt` + `sources_dir/index.json`
- Produces: `build_research_query_prompts(topic, contract) -> tuple[str, str]`；`build_evidence_extraction_prompts(*, topic, contract, doc_title, doc_url, doc_text) -> tuple[str, str]`（essay_prompts.py）
- Consumes: client 满足 `generate_json(..., model=...)`（Task 1）

- [ ] **Step 1: 写失败测试**

`test_research.py` 追加：

```python
import tempfile
from unittest.mock import patch

from research import run_research  # noqa: E402

FAKE_DOC = (
    "尼采研究材料正文。" * 40
    + "他说：“上帝死了！上帝真的死了！是我们杀死了他。”这一段出自《快乐的科学》第 125 节。"
)


class _FakeResearchClient:
    def __init__(self, evidence_per_doc=None):
        self.evidence_per_doc = evidence_per_doc
        self.calls = []

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=8000, model=None):
        self.calls.append((schema_name, model))
        if schema_name == "research_queries":
            content = {"queries": ["尼采 上帝已死 快乐的科学", "Nietzsche genealogy Schuld"]}
        elif schema_name.startswith("evidence_"):
            doc_id = schema_name.split("_", 1)[1]
            if self.evidence_per_doc is not None:
                content = {"evidence": self.evidence_per_doc}
            else:
                content = {"evidence": (
                    [{"kind": "quote", "content": "上帝死了！上帝真的死了！是我们杀死了他。", "note": "尺度崩塌宣告"}]
                    + [{"kind": "fact", "content": f"{doc_id} 具体事实{i}：某个可核查的历史/文本细节陈述", "note": "锚点"} for i in range(6)]
                )}
        else:
            raise AssertionError(f"unexpected schema: {schema_name}")
        return {"content": content, "usage": {}, "model": model or "fake"}


def _contract():
    return {"drivingQuestion": "为什么上帝已死意味着尺度崩塌？", "scope": {"include": ["虚无主义"], "exclude": []}}


class RunResearchTests(unittest.TestCase):
    def _patched(self, client):
        return (
            patch("research.wiki_search_titles", side_effect=lambda topic, lang, limit=2: [f"{topic}-{lang}"]),
            patch("research.wiki_page_text", side_effect=lambda title, lang: FAKE_DOC),
            patch("research.ddg_search", return_value=[]),
        )

    def test_happy_path_builds_verified_library(self):
        client = _FakeResearchClient()
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            artifact = run_research(
                topic="尼采哲学", contract=_contract(), client=client,
                research_model="researcher-x", sources_dir=Path(tmp) / "src",
            )
            self.assertGreaterEqual(len(artifact["evidence"]), 12)
            self.assertEqual(artifact["evidence"][0]["id"], "E01")
            quote_items = [e for e in artifact["evidence"] if e["kind"] == "quote"]
            self.assertTrue(quote_items and quote_items[0]["sourceUrl"].startswith("https://"))
            self.assertTrue((Path(tmp) / "src" / "index.json").exists())
            self.assertTrue((Path(tmp) / "src" / "D01.txt").exists())
            # research 调用带 research_model
            self.assertTrue(all(m == "researcher-x" for (_, m) in client.calls))

    def test_fabricated_quote_is_dropped(self):
        client = _FakeResearchClient(evidence_per_doc=(
            [{"kind": "quote", "content": "这句引文并不在原文里，是模型编造的完整句子。", "note": ""}]
            + [{"kind": "fact", "content": f"独立事实{i}：某个可核查的历史/文本细节陈述充分长", "note": ""} for i in range(12)]
        ))
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            artifact = run_research(
                topic="尼采哲学", contract=_contract(), client=client,
                research_model=None, sources_dir=Path(tmp) / "src",
            )
            self.assertFalse([e for e in artifact["evidence"] if e["kind"] == "quote"])
            self.assertGreaterEqual(artifact["stats"]["droppedQuotes"], 1)

    def test_insufficient_evidence_fails_in_chinese(self):
        client = _FakeResearchClient(evidence_per_doc=[
            {"kind": "fact", "content": "唯一一条事实：不足以支撑课程写作的证据量", "note": ""},
        ])
        p1, p2, p3 = self._patched(client)
        with tempfile.TemporaryDirectory() as tmp, p1, p2, p3:
            with self.assertRaises(ValueError) as ctx:
                run_research(topic="尼采哲学", contract=_contract(), client=client,
                             research_model=None, sources_dir=Path(tmp) / "src")
            self.assertIn("研究材料不足", str(ctx.exception))
```

注意：`test_fabricated_quote_is_dropped` 里 12 条 fact 内容相同会被去重——fact 文案带 `{i}` 保证唯一（上面已带）。2 个 doc × 相同 12 条 fact 去重后 = 12 条 ✓。

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_research.py' -v`
Expected: ImportError: cannot import name 'run_research'

- [ ] **Step 3: essay_prompts.py 追加研究 prompts**

文件末尾追加：

```python
def build_research_query_prompts(topic: str, contract: dict[str, Any]) -> tuple[str, str]:
    system_prompt = (
        "你是课程研究员。输出 JSON。"
        "搜索词要能命中一手文本和高质量二手材料（原著章节、标准百科、权威讲义），不要泛泛的科普词。"
    )
    scope = contract.get("scope") or {}
    user_prompt = (
        f"课程主题：{topic}\n"
        f"驱动问题：{contract.get('drivingQuestion')}\n"
        f"必须覆盖：{json.dumps(scope.get('include') or [], ensure_ascii=False)}\n"
        f"不覆盖：{json.dumps(scope.get('exclude') or [], ensure_ascii=False)}\n\n"
        "生成 6-10 个搜索查询，中英混合，具体到概念名、文本名、机制名或争论点。\n"
        '输出 JSON：{"queries": ["...", "..."]}'
    )
    return system_prompt, user_prompt


def build_evidence_extraction_prompts(
    *,
    topic: str,
    contract: dict[str, Any],
    doc_title: str,
    doc_url: str,
    doc_text: str,
) -> tuple[str, str]:
    system_prompt = (
        "你是课程研究员，从给定材料中萃取证据条目。输出 JSON。\n"
        "kind=quote 的 content 必须逐字复制材料原文中的连续片段——程序会做子串校验，任何改写、缩略、拼接都会被丢弃。\n"
        "fact/example/figure 可以用你的话概括，但必须忠实于材料，不得掺入材料之外的知识。"
    )
    user_prompt = (
        f"课程主题：{topic}\n"
        f"驱动问题：{contract.get('drivingQuestion')}\n\n"
        f"材料标题：{doc_title}\n材料地址：{doc_url}\n材料正文：\n{doc_text}\n\n"
        "萃取最多 6 条与课程问题直接相关的证据，优先级：可直接引用的原文论证段（quote）>"
        "具体事实/日期/数字（fact/figure）> 具体案例（example）。与课程问题无关的内容宁可不出。\n"
        '输出 JSON：{"evidence": [{"kind": "quote|fact|example|figure", "content": "...", "note": "与课程哪条论线相关"}]}'
    )
    return system_prompt, user_prompt
```

- [ ] **Step 4: research.py 追加编排器**

`research.py` 末尾追加：

```python
def run_research(
    *,
    topic: str,
    contract: dict[str, Any],
    client: Any,
    research_model: str | None,
    sources_dir: Path,
    check_cancelled: Callable[[], None] = lambda: None,
    log: Callable[[str], None] = lambda msg: print(msg, file=sys.stderr),
) -> dict[str, Any]:
    try:
        from .essay_prompts import build_evidence_extraction_prompts, build_research_query_prompts
    except ImportError:
        from essay_prompts import build_evidence_extraction_prompts, build_research_query_prompts

    ensure_dir(sources_dir)

    # 1. LLM 出题
    sys_p, usr_p = build_research_query_prompts(topic, contract)
    response = client.generate_json(
        schema_name="research_queries", system_prompt=sys_p, user_prompt=usr_p,
        max_tokens=800, model=research_model,
    )
    queries = [str(q).strip() for q in (response.get("content") or {}).get("queries") or [] if str(q).strip()][:10]
    if not queries:
        queries = [topic]

    # 2. 抓取语料：wiki 优先，DDG 补充
    documents: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    def add_document(title: str, url: str, text: str) -> None:
        text = (text or "").strip()
        if len(text) < 500 or url in seen_urls:
            return
        seen_urls.add(url)
        documents.append({
            "docId": f"D{len(documents) + 1:02d}",
            "title": title,
            "url": url,
            "text": text[:MAX_PAGE_CHARS],
        })

    for lang in ("zh", "en"):
        check_cancelled()
        try:
            for title in wiki_search_titles(topic, lang, limit=2):
                add_document(
                    f"Wikipedia({lang}): {title}",
                    f"https://{lang}.wikipedia.org/wiki/{parse.quote(title)}",
                    wiki_page_text(title, lang),
                )
        except Exception as exc:
            log(f"[research] wiki({lang}) failed: {exc}")

    web_candidates: list[dict[str, str]] = []
    for query in queries:
        check_cancelled()
        try:
            web_candidates.extend(ddg_search(query))
        except Exception as exc:
            log(f"[research] ddg '{query}' failed: {exc}")

    fetched = 0
    for item in web_candidates:
        if fetched >= MAX_WEB_PAGES:
            break
        if item["url"] in seen_urls:
            continue
        check_cancelled()
        try:
            text = extract_main_text(http_get(item["url"]))
        except Exception as exc:
            log(f"[research] fetch {item['url']} failed: {exc}")
            continue
        before = len(documents)
        add_document(item["title"], item["url"], text)
        if len(documents) > before:
            fetched += 1

    if not documents:
        raise ValueError("研究阶段没有抓到任何可用材料，请检查网络或换一个更具体的主题")

    # 落盘供审计与后续保真校验
    for doc in documents:
        write_text_atomic(sources_dir / f"{doc['docId']}.txt", doc["text"])
    write_json_atomic(
        sources_dir / "index.json",
        [{"docId": d["docId"], "title": d["title"], "url": d["url"], "chars": len(d["text"])} for d in documents],
    )

    # 3. 逐文档萃取证据；quote 必须通过原文子串校验
    evidence: list[dict[str, Any]] = []
    dropped_quotes = 0
    seen_content: set[str] = set()
    for doc in documents:
        check_cancelled()
        if len(evidence) >= MAX_EVIDENCE:
            break
        sys_p, usr_p = build_evidence_extraction_prompts(
            topic=topic, contract=contract,
            doc_title=doc["title"], doc_url=doc["url"], doc_text=doc["text"],
        )
        try:
            response = client.generate_json(
                schema_name=f"evidence_{doc['docId']}", system_prompt=sys_p, user_prompt=usr_p,
                max_tokens=2500, model=research_model,
            )
        except Exception as exc:
            log(f"[research] extraction failed for {doc['docId']}: {exc}")
            continue
        for raw in (response.get("content") or {}).get("evidence") or []:
            if not isinstance(raw, dict) or len(evidence) >= MAX_EVIDENCE:
                continue
            kind = str(raw.get("kind") or "").strip()
            content = str(raw.get("content") or "").strip()
            if kind not in {"quote", "fact", "example", "figure"} or len(content) < 15:
                continue
            if kind == "quote" and not quote_in_text(content, doc["text"]):
                dropped_quotes += 1
                continue
            key = normalize_for_match(content)[:80]
            if key in seen_content:
                continue
            seen_content.add(key)
            evidence.append({
                "id": f"E{len(evidence) + 1:02d}",
                "kind": kind,
                "content": content,
                "note": str(raw.get("note") or "").strip(),
                "sourceTitle": doc["title"],
                "sourceUrl": doc["url"],
                "docId": doc["docId"],
            })

    if len(evidence) < MIN_EVIDENCE:
        raise ValueError(
            f"研究材料不足：只萃取到 {len(evidence)} 条可用证据"
            f"（其中 {dropped_quotes} 条引文未通过原文校验被丢弃）。建议换一个更具体或材料更丰富的主题。"
        )

    return {
        "topic": topic,
        "queries": queries,
        "documents": [{"docId": d["docId"], "title": d["title"], "url": d["url"], "chars": len(d["text"])} for d in documents],
        "evidence": evidence,
        "stats": {"documentCount": len(documents), "evidenceCount": len(evidence), "droppedQuotes": dropped_quotes},
    }
```

- [ ] **Step 5: 跑测试确认通过**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_research.py' -v`
Expected: 9 tests PASS

- [ ] **Step 6: Commit**

```bash
git add agent-backend/app/research.py agent-backend/app/essay_prompts.py agent-backend/tests/test_research.py
git commit -m "Add research orchestrator with machine-verified evidence library"
```

---

### Task 7: 管线接入 research 阶段（stages 扩展 + 旧任务兼容）

**Files:**
- Modify: `agent-backend/app/job_store.py:15`（PIPELINE_STAGES）、`:211-232`（prepare_retry 按名字映射）、`:272-276`（_find_stage 容忍缺失）
- Modify: `agent-backend/app/pipeline.py`（run_job 加 research 块；新增 _run_research；导入 run_research）
- Modify: `src/components/GenerateForm.tsx:67-79`（STAGE_LABELS 两张表）
- Test: `agent-backend/tests/test_job_pipeline.py`（FakeClient 扩展 + 研究 fetch monkeypatch helper + 新测试）
- Test: `agent-backend/tests/test_clarification_store.py` 等其余测试不涉及（不跑 run_job）

**Interfaces:**
- Produces: `PIPELINE_STAGES = ["research", "plan", "compose", "verify", "validate", "export"]`（verify 阶段本 Task 先注册名字，逻辑 Task 10 实现；在 Task 10 前 verify 阶段在 run_job 里直接标记成功，summary={"deferred": True}）
- Produces: `CourseGenerationPipeline._run_research(job_id, request_payload, *, client) -> dict`（research artifact，见 Task 6 返回结构）
- Produces: run_job 中 `research_artifact` 变量向下游传递（Task 8/9/10 消费）
- Produces: 旧 4-stage job 在 `_find_stage`/`prepare_retry` 下不崩溃

- [ ] **Step 1: 改测试基建（先写失败测试）**

`test_job_pipeline.py` 顶部 import 区加：

```python
from unittest.mock import patch

import research  # noqa: E402  (sys.path 已含 app/)
```

模块级加 fixture 与 helper：

```python
FAKE_DOC_TEXT = (
    "缓存机制研究材料。" * 60
    + "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。"
)


class _ResearchPatches:
    """Context manager: 让 run_research 走假抓取，不出网。"""

    def __enter__(self):
        self._patches = [
            patch.object(research, "wiki_search_titles", side_effect=lambda topic, lang, limit=2: [f"{topic}-{lang}"]),
            patch.object(research, "wiki_page_text", side_effect=lambda title, lang: FAKE_DOC_TEXT),
            patch.object(research, "ddg_search", return_value=[]),
        ]
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in self._patches:
            p.stop()
        return False
```

`FakeClient.generate_json` 加两个分支（在 `else: raise AssertionError` 之前）：

```python
        elif schema_name == "research_queries":
            content = {"queries": ["缓存 LRU 淘汰 机制"]}
        elif schema_name.startswith("evidence_"):
            doc_id = schema_name.split("_", 1)[1]
            content = {"evidence": (
                [{"kind": "quote", "content": "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。", "note": "机制锚点"}]
                + [{"kind": "fact", "content": f"{doc_id} 具体事实{i}：缓存条目在不同状态下的行为差异细节", "note": "锚点"} for i in range(6)]
            )}
```

（2 个 wiki doc × [1 quote + 6 facts]，quote 跨 doc 去重 → 1 + 12 = 13 条 ≥ MIN_EVIDENCE ✓）

所有调用 `pipeline.run_job(...)` 的既有测试，包一层 `with _ResearchPatches():`。

新测试：

```python
    def test_run_job_produces_research_artifact_and_stage(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-research-stage-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "waiting_review")
        stage_status = {s["name"]: s["status"] for s in job["stages"]}
        self.assertEqual(stage_status["research"], "succeeded")
        artifact = json.loads(Path(job["artifacts"]["research"]).read_text("utf-8"))
        self.assertGreaterEqual(artifact["stats"]["evidenceCount"], 12)
        sources = pipeline.store.job_dir(job["id"]) / "research_sources"
        self.assertTrue((sources / "index.json").exists())

    def test_legacy_four_stage_job_survives_find_and_retry(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-legacy-stages-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        # 模拟旧版 job：stages 只有 4 个
        with pipeline.store.job_lock(job["id"]):
            legacy = pipeline.store.load_job(job["id"])
            legacy["stages"] = [s for s in legacy["stages"] if s["name"] in ("plan", "compose", "validate", "export")]
            legacy["status"] = "failed"
            legacy["currentStage"] = "plan"
            pipeline.store.write_job(legacy)

        retried = pipeline.store.prepare_retry(job["id"], None)  # 不崩溃
        self.assertEqual(retried["status"], "queued")
        # _find_stage 对缺失 stage 动态补条目
        pipeline.store.mark_stage_running(job["id"], "research")
        refreshed = pipeline.store.load_job(job["id"])
        self.assertIn("research", [s["name"] for s in refreshed["stages"]])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: FAIL（KeyError 'research' / unknown stage）

- [ ] **Step 3: job_store.py 改造**

`PIPELINE_STAGES = ["research", "plan", "compose", "verify", "validate", "export"]`

`_find_stage` 替换为：

```python
    def _find_stage(self, job: dict[str, Any], stage: str) -> dict[str, Any]:
        for item in job["stages"]:
            if item["name"] == stage:
                return item
        if stage in PIPELINE_STAGES:
            # 旧任务缺少后加的阶段：按需补一个 pending 条目，保持兼容
            item = {
                "name": stage,
                "status": "pending",
                "retryCount": 0,
                "startedAt": None,
                "finishedAt": None,
                "summary": None,
                "artifactPath": None,
                "error": None,
            }
            job["stages"].append(item)
            return item
        raise KeyError(f"unknown stage '{stage}'")
```

`prepare_retry` 的 stage 重置循环替换为按名字映射：

```python
            order = {name: index for index, name in enumerate(PIPELINE_STAGES)}
            start_stage = stage or job.get("currentStage") or PIPELINE_STAGES[0]
            if start_stage not in order:
                start_stage = PIPELINE_STAGES[0]
            start_index = order[start_stage]
            for stage_state in job["stages"]:
                stage_index = order.get(stage_state["name"])
                if stage_index is None or stage_index < start_index:
                    continue
                job["artifacts"].pop(stage_state["name"], None)
                stage_state["status"] = "pending"
                stage_state["startedAt"] = None
                stage_state["finishedAt"] = None
                stage_state["summary"] = None
                stage_state["artifactPath"] = None
                stage_state["error"] = None
                stage_state["retryCount"] = int(stage_state.get("retryCount") or 0) + 1
            if start_index <= order["export"]:
                job["artifacts"].pop("output", None)
```

- [ ] **Step 4: pipeline.py 接入**

导入区（两分支）加 `from .research import run_research` / `from research import run_research`。

run_job 里 PLAN 块之前加：

```python
            # --- RESEARCH ---
            if stage_status.get("research") == "succeeded" and job["artifacts"].get("research"):
                research_artifact = json.loads(Path(job["artifacts"]["research"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "research")
                research_artifact = self._run_research(job_id, request_payload, client=client)
                research_path = self.store.store_stage_artifact(job_id, "research", research_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "research",
                    artifact_path=research_path,
                    summary=research_artifact["stats"],
                )

            self._check_cancelled(job_id)
```

VALIDATE 块之前加 verify 占位（Task 10 替换）：

```python
            # --- VERIFY (course-level checks land in a later change) ---
            if stage_status.get("verify") != "succeeded":
                self.store.mark_stage_running(job_id, "verify")
                self.store.mark_stage_success(job_id, "verify", summary={"deferred": True})

            self._check_cancelled(job_id)
```

类方法区（_run_plan 前）加：

```python
    def _run_research(
        self,
        job_id: str,
        request_payload: dict[str, Any],
        *,
        client: OpenAICompatibleClient | None = None,
    ) -> dict[str, Any]:
        client = client or self.client
        artifact = run_research(
            topic=request_payload["topic"],
            contract=request_payload["contract"],
            client=client,
            research_model=getattr(client.config, "research_model", None),
            sources_dir=self.store.job_dir(job_id) / "research_sources",
            check_cancelled=lambda: self._check_cancelled(job_id),
        )
        self.store.write_log(
            job_id,
            "research",
            json.dumps(
                {"queries": artifact["queries"], "documents": artifact["documents"], "stats": artifact["stats"]},
                ensure_ascii=False,
                indent=2,
            ),
        )
        return artifact
```

- [ ] **Step 5: 前端 stage 标签**

GenerateForm.tsx 两张表补齐：

```typescript
const STAGE_LABELS_ZH: Record<string, string> = {
  research: '搜集源材料',
  plan: '规划课程结构',
  compose: '生成章节内容',
  verify: '终检与溯源',
  validate: '验证内容质量',
  export: '导出课程包',
};

const STAGE_LABELS_EN: Record<string, string> = {
  research: 'Researching sources',
  plan: 'Planning course structure',
  compose: 'Composing chapters',
  verify: 'Verifying against evidence',
  validate: 'Validating content quality',
  export: 'Exporting course package',
};
```

- [ ] **Step 6: 验证 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3 && npx tsc --noEmit`
Expected: OK；tsc 无输出

```bash
git add agent-backend/app/job_store.py agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py src/components/GenerateForm.tsx
git commit -m "Wire research stage into pipeline with legacy-job compatibility"
```

---

### Task 8: Plan 消费证据（factSpine 挂证据 + 章节 evidenceIds）

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_essay_plan_prompts 加 research_artifact）
- Modify: `agent-backend/app/essay_quality.py`（新增 validate_chapter_evidence）
- Modify: `agent-backend/app/pipeline.py`（_run_plan/_normalize_essay_plan 传递与校验）
- Test: `agent-backend/tests/test_job_pipeline.py`

**Interfaces:**
- Produces: `build_essay_plan_prompts(request_payload, *, research_artifact: dict | None = None, revision_feedback: str | None = None)`
- Produces: `validate_chapter_evidence(chapter_plans: list[dict], evidence_ids: set[str]) -> list[str]`（每章 ≥2 条有效证据）
- Produces: `plan_artifact["chapterPlans"][i]["evidenceIds"]: list[str]`（已过滤为有效 id）
- Consumes: research_artifact["evidence"]（Task 6 结构）

- [ ] **Step 1: 写失败测试**

FakeClient plan 分支的 chapters 加 evidenceIds、factSpine 挂证据。把 plan 分支的 `fact_spine` 与 `chapters` 改为：

```python
            fact_spine = [
                {"claim": "LRU 命中后会更新 recency 元数据", "evidenceIds": ["E01"]},
                {"claim": "TTL 过期即使没有容量压力也不能继续返回旧值", "evidenceIds": ["E02"]},
                {"claim": "容量满时仍然有效的 entry 也可能被淘汰", "evidenceIds": ["E03"]},
            ]
            if self.bad_fact_spine_times > 0:
                self.bad_fact_spine_times -= 1
                fact_spine = []
            chapters = [
                {"id": "c01", "number": 1, "title": "缓存不是字典", "role": "立起错误直觉", "evidenceIds": ["E01", "E02"]},
                {"id": "c02", "number": 2, "title": "一次命中经过什么", "role": "追踪机制", "evidenceIds": ["E01", "E04"]},
                {"id": "c03", "number": 3, "title": "过期和淘汰不是一回事", "role": "制造转折", "evidenceIds": ["E02", "E03"]},
                {"id": "c04", "number": 4, "title": "把三条控制线放回系统", "role": "收束判断", "evidenceIds": ["E03", "E05"]},
            ]
```

（content 里 `"chapters": chapters,`。）

新测试：

```python
    def test_plan_prompt_carries_evidence_digest_and_chapters_get_ids(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-plan-evidence-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])

        self.assertIn("[E01]", client.plan_prompts[0])  # 证据摘要进入 plan prompt
        plan = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
        self.assertEqual(plan["chapterPlans"][0]["evidenceIds"], ["E01", "E02"])
        self.assertEqual(plan["factSpine"][0]["evidenceIds"], ["E01"])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 新测试 FAIL（prompt 无 [E01]；chapterPlans 无 evidenceIds）

- [ ] **Step 3: essay_prompts.py**

`build_essay_plan_prompts` 签名加 `research_artifact: dict[str, Any] | None = None`。few-shot 段之后、"输出 JSON 字段"之前插入：

```python
    evidence_digest = ""
    if research_artifact and research_artifact.get("evidence"):
        lines = [
            f"[{item['id']}] ({item['kind']})《{item['sourceTitle']}》: {str(item['content'])[:80]}"
            for item in research_artifact["evidence"]
        ]
        evidence_digest = (
            "研究阶段已建立证据库（写作时每章会拿到全文，这里是摘要）：\n"
            + "\n".join(lines)
            + "\n\n"
        )
    user_prompt += evidence_digest
```

输出 JSON 模板里 factSpine 与 chapters 行改为：

```python
        '  "factSpine": [{"claim": "具体事实/机制断言", "evidenceIds": ["E01"]}],\n'
        '  "chapters": [\n'
        '    {"id": "c01", "number": 1, "title": "章节标题", "role": "这一章在主线里的作用", "evidenceIds": ["E01", "E02"]}\n'
```

硬约束句追加：`"factSpine 每条和每个 chapter 都必须挂到证据库里真实存在的 evidenceIds；每章至少 2 条。"`（仅当 evidence_digest 非空时追加此句：`if evidence_digest: user_prompt += "..."`）

- [ ] **Step 4: essay_quality.py 加章节证据校验**

```python
def validate_chapter_evidence(chapter_plans: list[dict[str, Any]], evidence_ids: set[str]) -> list[str]:
    issues: list[str] = []
    for chapter in chapter_plans or []:
        ids = [x for x in (chapter.get("evidenceIds") or []) if x in evidence_ids]
        if len(ids) < 2:
            issues.append(f"{chapter.get('id')} 只挂到 {len(ids)} 条有效证据（每章至少 2 条）")
    return issues
```

- [ ] **Step 5: pipeline.py**

`_run_plan` 签名加 `research_artifact: dict[str, Any] | None = None`；prompt 调用传 `research_artifact=research_artifact`；`_normalize_essay_plan` 调用改为 `self._normalize_essay_plan(response["content"], request_payload, research_artifact=research_artifact)`；校验块改为：

```python
            evidence_ids = {e["id"] for e in (research_artifact or {}).get("evidence") or []} or None
            issues = validate_fact_spine(normalized["factSpine"], evidence_ids=evidence_ids)
            if evidence_ids:
                issues += validate_chapter_evidence(normalized["chapterPlans"], evidence_ids)
```

（导入区加 `validate_chapter_evidence`。）

`_normalize_essay_plan` 签名加 `research_artifact=None`；chapter_plans 构造循环里 dict 分支加：

```python
                    raw_ids = item.get("evidenceIds") or []
```

并在 append 的 dict 里加：

```python
                    "evidenceIds": [str(x).strip() for x in raw_ids if str(x).strip()],
```

（非 dict 分支 `raw_ids = []`；默认补章循环里 append 的 dict 也加 `"evidenceIds": []`。）
方法末尾（`normalized["chapterPlans"] = chapter_plans` 之前）加有效性过滤：

```python
        valid_ids = {e["id"] for e in (research_artifact or {}).get("evidence") or []}
        if valid_ids:
            for chapter in chapter_plans:
                chapter["evidenceIds"] = [x for x in chapter.get("evidenceIds") or [] if x in valid_ids]
```

run_job 的 plan 调用改为 `self._run_plan(job_id, request_payload, client=client, research_artifact=research_artifact)`。

- [ ] **Step 6: 验证 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

```bash
git add agent-backend/app/essay_prompts.py agent-backend/app/essay_quality.py agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py
git commit -m "Anchor plan factSpine and chapters to evidence ids"
```

---

### Task 9: Compose 开卷写作 + quote 保真 + chapter.sources + judge 证据感知

**Files:**
- Modify: `agent-backend/app/essay_prompts.py`（build_chapter_prompts / build_judge_prompts 加 evidence）
- Modify: `agent-backend/app/essay_quality.py`（新增 check_quote_fidelity）
- Modify: `agent-backend/app/pipeline.py`（_run_compose/_compose_chapter_with_rewrites/_judge_chapter 传证据；sources 组装）
- Test: `agent-backend/tests/test_job_pipeline.py`

**Interfaces:**
- Produces: `build_chapter_prompts(..., evidence_items: list[dict] | None = None)`；prompt 含证据全文；要求输出字段 `usedEvidence: ["E01", ...]`
- Produces: `build_judge_prompts(..., evidence_items: list[dict] | None = None)`；评审含四项证据检查
- Produces: `check_quote_fidelity(chapter: dict, evidence: list[dict]) -> list[str]`（essay_quality.py；quote block 必须是某条证据 content 的归一化子串）
- Produces: chapter dict 新增 `"sources": [{"id", "title", "url"}]`（写入 chapters/cNN.json）
- Consumes: `quote_in_text`（research.py）、chapterPlans[].evidenceIds（Task 8）

- [ ] **Step 1: 写失败测试**

FakeClient chapter 分支 narrative 里加一个 quote block 和 usedEvidence（替换现 content dict）：

```python
            content = {
                "title": f"第 {number} 章",
                "role": "沿着主线推进一段论证",
                "narrative": [
                    {"type": "text", "content": f"{chapter_id} 直接进入缓存机制问题。它先说明一个具体状态。然后把这个状态放回命中路径里。"},
                    {"type": "heading", "content": "状态为什么重要"},
                    {"type": "quote", "content": "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。", "cite": "研究材料"},
                    {"type": "text", "content": "命中不是单步查表。系统要先定位 entry。接着检查有效性。然后返回 value。最后更新访问元数据。"},
                    {"type": "callout", "content": "如果命中后不更新元数据，后面的淘汰策略就会拿到错误信号。"},
                    {"type": "text", "content": "这一章的结尾保留一个问题：当 value 还存在时，它到底是可信、过期，还是应该因为容量压力被移走？"},
                ],
                "usedEvidence": ["E01"],
                "highlight": None,
                "bridge": "下一章继续追问这个状态为什么会改变。",
            }
```

新测试：

```python
    def test_chapter_prompt_embeds_evidence_and_output_carries_sources(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-compose-evidence-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])

        # 章节 prompt 内嵌本章证据全文
        self.assertIn("命中后系统会更新 recency 元数据", client.chapter_prompts[0])
        self.assertIn("[E01]", client.chapter_prompts[0])
        # 导出的章节带 sources
        exported_dir = Path(job["artifacts"]["output"])
        c01 = json.loads((exported_dir / "chapters" / "c01.json").read_text("utf-8"))
        self.assertTrue(c01["sources"])
        self.assertEqual(c01["sources"][0]["id"], "E01")
        self.assertTrue(c01["sources"][0]["url"].startswith("https://"))

    def test_fabricated_quote_block_triggers_rewrite_then_fails(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.fabricate_quotes = True
        slug = f"test-quote-fidelity-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("quote", job["error"]["message"])
```

FakeClient `__init__` 加 `self.fabricate_quotes = False`；chapter 分支 quote block content 改为条件：

```python
                    {"type": "quote", "content": (
                        "这句引文是模型编造的，不在任何证据里，长度足够触发校验。"
                        if self.fabricate_quotes
                        else "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。"
                    ), "cite": "研究材料"},
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 两个新测试 FAIL

- [ ] **Step 3: essay_quality.py 加 quote 保真检查**

导入区加：

```python
try:
    from .research import quote_in_text
except ImportError:
    from research import quote_in_text
```

文件末尾加：

```python
def check_quote_fidelity(chapter: dict[str, Any], evidence: list[dict[str, Any]]) -> list[str]:
    """quote block 必须逐字来自证据库（归一化子串）；这是机器防线，不走 LLM。"""
    issues: list[str] = []
    for block in chapter.get("narrative") or []:
        if isinstance(block, dict) and block.get("type") == "quote":
            content = str(block.get("content") or "")
            if not any(quote_in_text(content, str(e.get("content") or "")) for e in evidence):
                issues.append(f"quote 块不是证据库原文，必须逐字引用证据或改为 text：{content[:40]}…")
    return issues
```

- [ ] **Step 4: essay_prompts.py**

`build_chapter_prompts` 签名加 `evidence_items: list[dict[str, Any]] | None = None`。`prev_chapter_ending` 段之后插入：

```python
    evidence_block = ""
    if evidence_items:
        rendered = "\n\n".join(
            f"[{item['id']}] ({item['kind']})《{item['sourceTitle']}》 {item['sourceUrl']}\n{item['content']}"
            for item in evidence_items
        )
        evidence_block = (
            "本章证据库（写作必须建立在这些材料上）：\n"
            f"{rendered}\n\n"
            "证据使用规则：\n"
            "- 具体事实断言必须有上面证据支撑；证据覆盖不到的地方，要么不写，要么明示为作者立场。\n"
            "- quote 类型的 narrative block 必须逐字复制某条证据的 content（程序校验），cite 写来源标题。\n"
            "- 证据要进入论证（解释、对照、推进），不要点名式背书。\n"
            '- 在输出 JSON 里加 "usedEvidence": ["E01", ...]，列出实际使用的证据 id。\n\n'
        )
```

user_prompt 组装中把 evidence_block 插在 register_rules 之前；输出 JSON 模板加一行 `'  "usedEvidence": ["E01"],\n'`。

`build_judge_prompts` 签名加 `evidence_items: list[dict[str, Any]] | None = None`；user_prompt 的"标准："行前插入：

```python
    if evidence_items:
        digest = "\n".join(
            f"[{item['id']}] ({item['kind']}) {str(item['content'])[:120]}"
            for item in evidence_items
        )
        user_prompt += (
            f"本章证据库：\n{digest}\n\n"
            "证据评审（任一不过即 pass=false）：\n"
            "(a) 列出没有证据支撑、又没有明示为立场的具体事实断言；\n"
            "(b) quote 块是否逐字来自证据；\n"
            "(c) 证据是否真正进入论证，而不是点名背书；\n"
            "(d) 章节是否完成 chapterPlan.role。\n"
        )
```

- [ ] **Step 5: pipeline.py**

`_run_compose` 签名加 `research_artifact: dict[str, Any] | None = None`（run_job 调用处传入）。循环内为每章切证据：

```python
            evidence_library = (research_artifact or {}).get("evidence") or []
            chapter_evidence = [
                e for e in evidence_library if e["id"] in set(chapter_plan.get("evidenceIds") or [])
            ] or evidence_library[:8]
```

（放在 `chapter, local_logs = self._compose_chapter_with_rewrites(...)` 之前，作为参数 `chapter_evidence=chapter_evidence, evidence_library=evidence_library` 传入。）

`_compose_chapter_with_rewrites` 签名加 `chapter_evidence: list[dict[str, Any]] | None = None, evidence_library: list[dict[str, Any]] | None = None`：

- `build_chapter_prompts(...)` 调用加 `evidence_items=chapter_evidence`
- normalize 之后、judge 之前插入机器校验与 sources 组装：

```python
            used_ids = [str(x).strip() for x in (response["content"] or {}).get("usedEvidence") or [] if str(x).strip()]
            library = evidence_library or []
            by_id = {e["id"]: e for e in library}
            quoted_ids = [
                e["id"] for e in library
                if any(
                    isinstance(block, dict) and block.get("type") == "quote"
                    and quote_in_text(str(block.get("content") or ""), str(e.get("content") or ""))
                    for block in chapter["narrative"]
                )
            ]
            source_ids = list(dict.fromkeys([x for x in used_ids if x in by_id] + quoted_ids))
            chapter["sources"] = [
                {"id": x, "title": by_id[x]["sourceTitle"], "url": by_id[x]["sourceUrl"]}
                for x in source_ids
            ]

            fidelity_issues = check_quote_fidelity(chapter, library) if library else []
            if fidelity_issues:
                judgement = {"pass": False, "score": 40, "issues": fidelity_issues, "rewriteHint": "；".join(fidelity_issues)}
            else:
                judgement = self._judge_chapter(chapter, plan_artifact, chapter_plan, client=client, evidence_items=chapter_evidence)
```

（原 `judgement = self._judge_chapter(...)` 行被上面替换；重写失败的 raise 信息把 issues 带上，现有逻辑已如此。）

- 导入区加 `check_quote_fidelity`（essay_quality）与 `quote_in_text`（research）。

`_judge_chapter` 签名加 `evidence_items: list[dict[str, Any]] | None = None`，`build_judge_prompts(...)` 调用加 `evidence_items=evidence_items`。

- [ ] **Step 6: 验证 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（test_essay_writing_mode.py 用默认 evidence_items=None，不受影响）

```bash
git add agent-backend/app/essay_prompts.py agent-backend/app/essay_quality.py agent-backend/app/pipeline.py agent-backend/tests/test_job_pipeline.py
git commit -m "Compose chapters open-book with quote fidelity and sources"
```

---

### Task 10: Verify 阶段（全课终检）

**Files:**
- Modify: `agent-backend/app/pipeline.py`（替换 Task 7 的 verify 占位为 _run_verify）
- Modify: `agent-backend/app/essay_prompts.py`（build_course_verify_prompts）
- Test: `agent-backend/tests/test_job_pipeline.py`

**Interfaces:**
- Produces: `build_course_verify_prompts(*, plan_artifact, chapters) -> tuple[str, str]`（课程级评审：drivingQuestion 是否被回答、末章收束、跨章连续性；输出 `{"pass", "issues": []}`）
- Produces: `CourseGenerationPipeline._run_verify(job_id, composed_artifact, research_artifact, *, client) -> dict`
  - 返回 `{"pass": bool, "issues": [str], "mechanical": {...}, "courseJudge": {...}}`
  - 机械检查：全部 quote 保真、sources id 存在于证据库、factSpine id 存在
  - 不过 → 工件照存，然后 raise ValueError（run_job 通用异常处理标记 verify 失败）；人工决定 retry
- Consumes: FakeClient 需支持 schema `course_verify`

- [ ] **Step 1: 写失败测试**

FakeClient 加分支（`_quality_judge` 分支之前）：

```python
        elif schema_name == "course_verify":
            content = {"pass": not getattr(self, "fail_course_verify", False),
                       "issues": ["末章没有回扣 drivingQuestion"] if getattr(self, "fail_course_verify", False) else []}
```

新测试：

```python
    def test_verify_stage_records_artifact(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-verify-ok-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "waiting_review")
        verify = json.loads(Path(job["artifacts"]["verify"]).read_text("utf-8"))
        self.assertTrue(verify["pass"])
        self.assertTrue(verify["mechanical"]["quoteFidelityOk"])
        judge_models = [m for (name, m) in client.calls if name == "course_verify"]
        self.assertEqual(len(judge_models), 1)

    def test_verify_failure_fails_job_with_stored_details(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.fail_course_verify = True
        slug = f"test-verify-fail-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("verify", job["error"]["stage"])
        verify = json.loads(Path(pipeline.store.stage_artifact_path(job["id"], "verify")).read_text("utf-8"))
        self.assertFalse(verify["pass"])
        self.assertIn("末章没有回扣 drivingQuestion", verify["issues"])
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: FAIL（无 verify 工件 / fail_course_verify 不生效）

- [ ] **Step 3: essay_prompts.py 加课程级评审 prompt**

```python
def build_course_verify_prompts(
    *,
    plan_artifact: dict[str, Any],
    chapters: list[dict[str, Any]],
) -> tuple[str, str]:
    system_prompt = "你是课程终审评审。只输出 JSON。"

    def _chapter_digest(chapter: dict[str, Any], full: bool) -> str:
        blocks = [b for b in chapter.get("narrative") or [] if isinstance(b, dict) and b.get("type") == "text"]
        if full:
            body = "\n".join(str(b.get("content") or "") for b in blocks)
        else:
            head = str(blocks[0].get("content") or "") if blocks else ""
            tail = str(blocks[-1].get("content") or "") if len(blocks) > 1 else ""
            body = f"{head}\n……\n{tail}"
        return f"## {chapter['id']} {chapter.get('title')}\nrole: {chapter.get('role')}\n{body}"

    digests = [
        _chapter_digest(chapter, full=(index == len(chapters) - 1))
        for index, chapter in enumerate(chapters)
    ]
    user_prompt = (
        "对整门课做终检（章节已逐章通过评审，这里只看课程级问题）。\n"
        f"drivingQuestion: {plan_artifact.get('drivingQuestion')}\n"
        f"centralTension: {plan_artifact.get('centralTension')}\n"
        f"desiredOutcome: {(plan_artifact.get('contract') or {}).get('desiredOutcome')}\n\n"
        + "\n\n".join(digests)
        + "\n\n检查：\n"
        "1. 全课读完，drivingQuestion 是否被实际回答（不是被绕开或替换）。\n"
        "2. 末章（全文已给出）是否完成收束，给出可迁移的判断框架，而不是继续抛问题。\n"
        "3. 章节之间的论证是否连续，有没有断裂或重复空转。\n"
        '输出 JSON：{"pass": true/false, "issues": ["具体问题"]}'
    )
    return system_prompt, user_prompt
```

- [ ] **Step 4: pipeline.py 实现 _run_verify 并替换占位**

pipeline.py 导入区（两个 try/except 分支）的 essay_prompts 导入行追加 `build_course_verify_prompts`。

run_job 里 Task 7 的 verify 占位块替换为：

```python
            # --- VERIFY (course-level final check) ---
            if stage_status.get("verify") == "succeeded" and job["artifacts"].get("verify"):
                pass
            else:
                self.store.mark_stage_running(job_id, "verify")
                verify_artifact = self._run_verify(job_id, composed_artifact, research_artifact, client=client)
                verify_path = self.store.store_stage_artifact(job_id, "verify", verify_artifact)
                if not verify_artifact["pass"]:
                    raise ValueError(f"课程终检未通过: {verify_artifact['issues'][:5]}")
                self.store.mark_stage_success(
                    job_id,
                    "verify",
                    artifact_path=verify_path,
                    summary={"pass": True, "issueCount": 0},
                )
```

类方法区加：

```python
    def _run_verify(
        self,
        job_id: str,
        composed_artifact: dict[str, Any],
        research_artifact: dict[str, Any] | None,
        *,
        client: OpenAICompatibleClient | None = None,
    ) -> dict[str, Any]:
        client = client or self.client
        chapters = composed_artifact["chapters"]
        evidence = (research_artifact or {}).get("evidence") or []
        evidence_ids = {e["id"] for e in evidence}
        issues: list[str] = []

        fidelity: list[str] = []
        for chapter in chapters:
            fidelity.extend(f"{chapter['id']}: {issue}" for issue in check_quote_fidelity(chapter, evidence))
        issues.extend(fidelity)

        bad_sources = [
            f"{chapter['id']} sources 含未知证据 id: {source.get('id')}"
            for chapter in chapters
            for source in chapter.get("sources") or []
            if source.get("id") not in evidence_ids
        ]
        issues.extend(bad_sources)

        plan_artifact = composed_artifact.get("plan") or {}
        spine = plan_artifact.get("factSpine") or composed_artifact["course"].get("factSpine") or []
        bad_spine = [
            f"factSpine[{index}] 挂到不存在的证据 id"
            for index, item in enumerate(spine)
            if evidence_ids and not any(x in evidence_ids for x in (item.get("evidenceIds") or []))
        ]
        issues.extend(bad_spine)

        mechanical = {
            "quoteFidelityOk": not fidelity,
            "sourcesOk": not bad_sources,
            "factSpineOk": not bad_spine,
        }

        judge_model = getattr(client.config, "judge_model", None)
        system_prompt, user_prompt = build_course_verify_prompts(
            plan_artifact={**plan_artifact, "drivingQuestion": composed_artifact["course"].get("drivingQuestion"),
                           "centralTension": composed_artifact["course"].get("centralTension"),
                           "contract": composed_artifact["course"].get("contract")},
            chapters=chapters,
        )
        response = client.generate_json(
            schema_name="course_verify",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_tokens=1200,
            model=judge_model,
        )
        course_judge = {
            "pass": bool((response.get("content") or {}).get("pass")),
            "issues": (response.get("content") or {}).get("issues") or [],
        }
        issues.extend(str(x) for x in course_judge["issues"])

        return {
            "pass": not issues,
            "issues": issues,
            "mechanical": mechanical,
            "courseJudge": course_judge,
        }
```

注意：`composed_artifact` 目前不带 plan——`_run_compose` 返回 dict 加一行 `"plan": {"factSpine": plan_artifact.get("factSpine") or []},`（在 `"course": course,` 之前），供 verify 复查 spine。

- [ ] **Step 5: 验证 + Commit**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

```bash
git add agent-backend/app/pipeline.py agent-backend/app/essay_prompts.py agent-backend/tests/test_job_pipeline.py
git commit -m "Add course-level verify stage with mechanical evidence checks"
```

---

### Task 11: 前端参考资料渲染

**Files:**
- Modify: `src/lib/course-schema.ts:175-183`（Chapter 接口）
- Modify: `src/components/essay/EssayChapterRenderer.tsx`（章末 sources 区块）

**Interfaces:**
- Produces: `Chapter.sources?: { id: string; title: string; url: string }[]`
- Consumes: chapters/cNN.json 的 `sources` 字段（Task 9；引擎按 `c.data` 整体传递，已确认不剥字段）

- [ ] **Step 1: Chapter 类型**

```typescript
export interface ChapterSource {
  id: string;
  title: string;
  url: string;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  role?: string;
  narrative: EssayNarrativeBlock[];
  highlight?: Highlight | null;
  bridge?: string | null;
  sources?: ChapterSource[];
}
```

- [ ] **Step 2: 渲染（bridge 区块之后、nav 之前）**

```tsx
      {chapter.sources && chapter.sources.length > 0 ? (
        <section className="mt-10 border-t border-[color:var(--color-border)] pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-muted)]">
            {isZh ? '参考资料' : 'Sources'}
          </h2>
          <ul className="mt-3 space-y-1.5">
            {chapter.sources.map((source) => (
              <li key={source.id} className="text-sm leading-6">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
```

- [ ] **Step 3: 验证**

Run: `npx tsc --noEmit && npm run check`
Expected: 均通过（现有课程无 sources 字段 → 可选字段不渲染）

给一个现有 essay 课程手工加临时 sources 验证渲染：`courses/course-2cf51423/chapters/c01.json` 临时加 `"sources": [{"id": "E01", "title": "测试来源", "url": "https://example.com"}]` → `npm run dev` 打开该章确认"参考资料"出现 → **撤销该临时修改**（`git checkout -- courses/course-2cf51423/chapters/c01.json`）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/course-schema.ts src/components/essay/EssayChapterRenderer.tsx
git commit -m "Render chapter sources as reference list"
```

---

### Task 12: 文档同步 + 全链路冒烟

**Files:**
- Modify: `README.md`（课程生成架构图加 Research/Verify；Agent Backend 段补 research_sources 与新模型配置）
- Modify: `docs/superpowers/specs/2026-07-09-research-grounded-pipeline-design.md`（状态改"已实施"）
- 冒烟为手动步骤，不改代码

- [ ] **Step 1: README 管线图**

"课程生成架构"代码块中 `[输入门控]` 与 `[Plan]` 之间插入：

```txt
[Research] 搜索+抓取源材料（wiki zh/en + DuckDuckGo），萃取证据库
    ├─ quote 逐字子串机器校验，编造引文直接丢弃
    └─ 可用证据 < 12 条则任务失败（宁缺毋滥）
    ↓
```

`[Plan]` 行补充"factSpine/每章 evidenceIds 必须挂到证据库"；`[Compose]` 行补充"章节携带本章证据全文，quote 保真机器校验，judge 走异族 judge_model"；`[Validate]` 之前插入：

```txt
[Verify] 全课终检：quote/sources/factSpine 机械复查 + 课程级收束评审
    ↓
```

"核心设计"段落末尾追加一句：`生成是开卷的：research 阶段建立带出处的证据库，写作与评审都对着证据进行，发布前必须人工审核。`

"Agent Backend"段落追加：

```markdown
LLM 配置支持 per-stage 模型：`model`（写作）、`fallback_model`（兜底）、`research_model`（研究，可选）、`judge_model`（评审，建议与写作模型异族）。每个 job 的抓取原文保存在 `agent-backend/jobs/<id>/research_sources/` 供审计。
```

- [ ] **Step 2: 设计文档状态**

`docs/superpowers/specs/2026-07-09-research-grounded-pipeline-design.md` 头部"状态：已获用户批准"改为"状态：已实施（2026-07-XX，填实际日期）"。

- [ ] **Step 3: 全量验证**

Run: `npm test && npm run check && npx tsc --noEmit`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-09-research-grounded-pipeline-design.md
git commit -m "Document research-grounded pipeline"
```

- [ ] **Step 5: 真实冒烟（手动，生产后端）**

1. `sudo systemctl restart agent-backend`（加载新代码）
2. 确认 runtime-config：`model`=前沿写作模型、`judge_model`=异族评审模型（一期收尾已配）
3. 走前端完整流程：澄清"尼采哲学"→ 确认 contract → 生成（新 slug，不覆盖 course-2cf51423）
4. 观察 stages：research → plan → compose → verify → validate → export → waiting_review
5. Review 时打开 job 工件（`GET /jobs/{id}/artifacts`）核对 research.json 证据库、章节 sources
6. 与 course-2cf51423 对读：新课是否有真实引文、具体锚点、论证密度
7. 批准 → 确认构建发布成功、线上章末显示参考资料
8. 满意后把对比结论记录进 job review notes

---

## Self-Review 记录

- 规格覆盖：设计文档 10 节逐条对到 Task 1-12；"分两期"边界与设计一致（一期 1-4 不动拓扑，二期 5-12）
- 类型一致性：`generate_json(model=...)` 在 Task 1 定义、4/6/7/10 消费；Evidence 结构在 Task 6 定义、8/9/10 消费；factSpine 对象形在 Task 2 定义、8/10 消费；FakeClient 签名在 Task 4 扩 model、Task 7 扩 research 分支，全程一份
- 占位符扫描：无 TBD/TODO；所有代码步骤给出完整代码
- 旧任务兼容：Task 7 专设 `_find_stage` 补条目 + `prepare_retry` 按名映射 + 回归测试
