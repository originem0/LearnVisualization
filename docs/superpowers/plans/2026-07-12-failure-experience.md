# 失败体验三件套（Failure Experience）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章节失败上下文持久化并在重试时播种（重试=继续迭代而非重新抽奖）、失败草稿与评审意见在 UI 可见、基础设施故障与质量否决分类展示。

**Architecture:** `_compose_chapter_with_rewrites` 抛错前写 `stages/compose_failure.json` 并把轻量 `failureDetail` 写进 job.json；`_run_compose` 开局读种子、逐章匹配消费；`run_job` 异常按类型分类写 `error.kind`；`_public_job_view` 透传；前端失败卡片按 kind 分流并提供草稿/评审展开区。

**Tech Stack:** Python stdlib、Next.js 14 + TypeScript。零新依赖、零数据结构破坏（新增可选字段）。

**设计文档:** `docs/superpowers/specs/2026-07-12-failure-experience-design.md`

## Global Constraints

- agent-backend 零第三方依赖
- 测试：`python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`；全量 `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py'`；前端 `npx tsc --noEmit && npm run check`
- 每 Task 结束 commit；message 末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 只 `git add` 各 Task 明列文件；不提交 `.claude/settings.local.json`
- 旧任务缺 `failureDetail`/`error.kind` 时前端按现状降级（不得因缺字段崩）
- 分支 `reading-experience`（继续）

---

### Task 1: 后端——失败持久化、重试播种、错误分类

**Files:**
- Modify: `agent-backend/app/pipeline.py`（_compose_chapter_with_rewrites / _run_compose / run_job 的 compose 成功清除与 except 分类）
- Modify: `agent-backend/app/job_store.py`（mark_stage_failed 加 kind）
- Modify: `agent-backend/app/main.py`（_public_job_view 透传 failureDetail）
- Test: `agent-backend/tests/test_job_pipeline.py`

**Interfaces:**
- Produces: 工件 `stages/compose_failure.json` = `{"chapterId": str, "feedback": str, "draft": dict, "attempts": int}`
- Produces: `job["failureDetail"] = {"chapterId": str, "feedback": str, "draftText": str}`（draftText ≤6000 字符）；compose 全章通过后置 None
- Produces: `job["error"]["kind"]`：ProviderError→"infra"、ValueError→"quality"、其余→"other"；`mark_stage_failed(job_id, stage, error_message, *, kind="other")`
- Produces: `_flatten_chapter_text(chapter: dict) -> str`（pipeline.py 模块级；heading 块前后加空行，其余 content 直拼，双换行分隔）
- Produces: `_compose_chapter_with_rewrites(..., initial_feedback: str | None = None)`；`_run_compose` 读取/消费种子文件
- Produces: `_public_job_view` 返回含 `"failureDetail"`

- [ ] **Step 1: 写失败测试（三个）**

`test_job_pipeline.py` 的 FakeClient：`__init__` 加

```python
        self.fail_judge_times = 0   # 前 N 次章节评审返回不通过
        self.raise_provider_error_on_chapter = False
```

judge 分支（`elif schema_name.endswith("_quality_judge"):`）改为：

```python
        elif schema_name.endswith("_quality_judge"):
            if self.fail_judge_times > 0:
                self.fail_judge_times -= 1
                content = {"pass": False, "score": 40, "issues": ["论证密度不足"], "rewriteHint": "补充证据锚点"}
            else:
                content = {"pass": True, "score": 90, "issues": [], "rewriteHint": ""}
```

chapter 分支开头（`self.chapter_prompts.append(user_prompt)` 之前）加：

```python
            if self.raise_provider_error_on_chapter:
                raise ProviderError("HTTP 503（No active API keys available for this group）")
```

test 文件 import 区 `from provider import ProviderConfig` 行改为 `from provider import ProviderConfig, ProviderError`。

测试类内追加三个测试：

```python
    def test_chapter_failure_persists_context_and_detail(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.fail_judge_times = 99
        slug = f"test-fail-detail-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["error"]["kind"], "quality")
        failure_path = pipeline.store.job_dir(job["id"]) / "stages" / "compose_failure.json"
        self.assertTrue(failure_path.exists())
        ctx = json.loads(failure_path.read_text("utf-8"))
        self.assertEqual(ctx["chapterId"], "c01")
        self.assertIn("补充证据锚点", ctx["feedback"])
        self.assertTrue(ctx["draft"]["narrative"])
        detail = job.get("failureDetail") or {}
        self.assertEqual(detail["chapterId"], "c01")
        self.assertIn("补充证据锚点", detail["feedback"])
        self.assertIn("直接进入缓存机制问题", detail["draftText"])

    def test_retry_seeds_feedback_and_consumes_failure_file(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.fail_judge_times = 4  # 恰好烧完第一轮 4 次尝试
        slug = f"test-fail-seed-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        prompts_before = len(client.chapter_prompts)

        pipeline.store.prepare_retry(job["id"], "compose")
        job = self.run_job_published(pipeline, job["id"])

        self.assertEqual(job["status"], "completed")
        # 重试后的第一个章节 prompt 带种子反馈与上一版摘录
        seeded_prompt = client.chapter_prompts[prompts_before]
        self.assertIn("上一版全文已被否决", seeded_prompt)
        self.assertIn("补充证据锚点", seeded_prompt)
        failure_path = pipeline.store.job_dir(job["id"]) / "stages" / "compose_failure.json"
        self.assertFalse(failure_path.exists())  # 一次性种子已消费
        self.assertIsNone(pipeline.store.load_job(job["id"]).get("failureDetail"))  # 成功后清除

    def test_provider_outage_classified_as_infra(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.raise_provider_error_on_chapter = True
        slug = f"test-fail-infra-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["error"]["kind"], "infra")
        self.assertIsNone(job.get("failureDetail"))
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_job_pipeline.py' -v`
Expected: 三个新测试 FAIL（KeyError 'kind' / 文件不存在 / 无种子标记）

- [ ] **Step 3: job_store.mark_stage_failed 加 kind**

```python
    def mark_stage_failed(self, job_id: str, stage: str, error_message: str, *, kind: str = "other") -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "failed"
            job["currentStage"] = stage
            job["error"] = {"stage": stage, "message": error_message, "kind": kind, "failedAt": now_iso()}
            stage_state = self._find_stage(job, stage)
            stage_state["status"] = "failed"
            stage_state["finishedAt"] = now_iso()
            stage_state["error"] = error_message
            return self.write_job(job)
```

- [ ] **Step 4: pipeline.py — 持久化、播种、清除、分类**

4a. 模块级函数（`run_static_build` 之前）：

```python
def _flatten_chapter_text(chapter: dict[str, Any], limit: int = 6000) -> str:
    parts: list[str] = []
    for block in chapter.get("narrative") or []:
        if not isinstance(block, dict):
            continue
        content = str(block.get("content") or "").strip()
        if not content:
            continue
        if block.get("type") == "heading":
            parts.append(f"\n## {content}\n")
        else:
            parts.append(content)
    return "\n\n".join(parts)[:limit]
```

4b. `_compose_chapter_with_rewrites`：签名加 `initial_feedback: str | None = None`；`revision_feedback: str | None = None` 改为 `revision_feedback: str | None = initial_feedback`。最终 `raise ValueError(...)` 之前插入持久化：

```python
        failure_feedback = revision_feedback or "；".join((last_judgement or {}).get("issues") or [])
        if last_chapter is not None:
            write_json_atomic(
                self.store.job_dir(job_id) / "stages" / "compose_failure.json",
                {
                    "chapterId": chapter_plan["id"],
                    "feedback": failure_feedback,
                    "draft": last_chapter,
                    "attempts": attempts,
                },
            )
            with self.store.job_lock(job_id):
                job = self.store.load_job(job_id)
                job["failureDetail"] = {
                    "chapterId": chapter_plan["id"],
                    "feedback": failure_feedback,
                    "draftText": _flatten_chapter_text(last_chapter),
                }
                self.store.write_job(job)
        raise ValueError(
```

（注意：ProviderError 在最后一轮 re-raise 的路径不经过这里——last_chapter 为 None 或直接 raise——基础设施故障不产生 failureDetail，符合设计。）

4c. `_run_compose`：checkpoint 读取之后、章节循环之前加种子读取：

```python
        failure_seed: dict[str, Any] | None = None
        failure_path = self.store.job_dir(job_id) / "stages" / "compose_failure.json"
        if failure_path.exists():
            try:
                failure_seed = json.loads(failure_path.read_text("utf-8"))
            except (json.JSONDecodeError, OSError):
                failure_seed = None
```

循环内 `_compose_chapter_with_rewrites(` 调用前加：

```python
            initial_feedback: str | None = None
            if failure_seed and failure_seed.get("chapterId") == chapter_plan["id"]:
                draft_excerpt = _flatten_chapter_text(failure_seed.get("draft") or {}, limit=3000)
                initial_feedback = (
                    f"上一版全文已被否决。评审否决原因：{failure_seed.get('feedback')}\n"
                    f"上一版正文摘录（针对否决原因重写，不要重蹈覆辙）：\n{draft_excerpt}"
                )
                failure_path.unlink(missing_ok=True)
                failure_seed = None
```

并把 `initial_feedback=initial_feedback,` 加进调用参数。

4d. run_job 的 compose 成功分支（`mark_stage_success(job_id, "compose", ...)` 之后）加清除：

```python
                with self.store.job_lock(job_id):
                    cleared = self.store.load_job(job_id)
                    if cleared.get("failureDetail"):
                        cleared["failureDetail"] = None
                        self.store.write_job(cleared)
```

4e. run_job 底部通用异常分类。把：

```python
        except Exception as exc:
            current_job = self.store.load_job(job_id)
            stage = current_job.get("currentStage") or "plan"
            self.store.mark_stage_failed(job_id, stage, str(exc))
            return self.store.load_job(job_id)
```

改为：

```python
        except Exception as exc:
            current_job = self.store.load_job(job_id)
            stage = current_job.get("currentStage") or "plan"
            if isinstance(exc, ProviderError):
                kind = "infra"
            elif isinstance(exc, ValueError):
                kind = "quality"
            else:
                kind = "other"
            self.store.mark_stage_failed(job_id, stage, str(exc), kind=kind)
            return self.store.load_job(job_id)
```

- [ ] **Step 5: main.py — 透传**

`_public_job_view` 返回 dict 的 `"error": job.get("error"),` 之后加：

```python
        "failureDetail": job.get("failureDetail"),
```

- [ ] **Step 6: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

- [ ] **Step 7: Commit**

```bash
git add agent-backend/app/pipeline.py agent-backend/app/job_store.py agent-backend/app/main.py agent-backend/tests/test_job_pipeline.py
git commit -m "Persist chapter failure context, seed retries, classify errors"
```

---

### Task 2: 前端——失败卡片分类展示 + 草稿展开区

**Files:**
- Modify: `src/components/GenerateForm.tsx`

**Interfaces:**
- Consumes: `job.error.kind`（'infra' | 'quality' | 'other' | undefined）、`job.failureDetail`（{chapterId, feedback, draftText} | null | undefined）——JobState 接口补这两个可选字段
- Produces: failed 卡片三分支展示

- [ ] **Step 1: 类型补充**

`JobState` 接口的 `error?: ...` 行改为：

```typescript
  error?: { stage?: string; message?: string; kind?: string } | null;
  failureDetail?: { chapterId: string; feedback: string; draftText: string } | null;
```

- [ ] **Step 2: failed 卡片改造**

`if (job.status === 'failed')` 分支整体替换为：

```tsx
  if (job.status === 'failed') {
    const failedStage = job.stages.find((s) => s.status === 'failed');
    const message = job.error?.message || failedStage?.error || (isZh ? '生成失败' : 'Generation failed');
    const kind = job.error?.kind;
    const detail = job.failureDetail;
    return (
      <div className="rounded-lg border border-[color:var(--color-danger)]/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[color:var(--color-text)]">{topicName}</span>
          <button type="button" onClick={onDismiss} className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">&times;</button>
        </div>
        {kind === 'infra' ? (
          <p className="text-xs leading-5 text-[color:var(--color-warn)]">
            {isZh
              ? '服务商故障，内容未被评审否决——稍后点重试即可，已完成的阶段会被复用。'
              : 'Provider outage — the content was not rejected by review. Retry later; finished stages are reused.'}
          </p>
        ) : null}
        <p className="text-xs text-[color:var(--color-danger)] line-clamp-3">{message}</p>
        {kind !== 'infra' ? (
          <p className="text-[11px] leading-4 text-[color:var(--color-muted)]">
            {isZh
              ? '重试将从失败阶段继续：已完成的研究、规划与章节不会重跑，且会带着评审意见迭代上一版。'
              : 'Retry resumes from the failed stage with prior review feedback carried into the rewrite.'}
          </p>
        ) : null}
        {detail && kind !== 'infra' ? (
          <details className="rounded-md border border-[color:var(--color-border)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-[color:var(--color-text)]">
              {isZh ? `查看失败章节（${detail.chapterId}）与评审意见` : `View failed chapter (${detail.chapterId}) & review notes`}
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-xs leading-5 text-[color:var(--color-warn)] whitespace-pre-wrap">{detail.feedback}</p>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-zinc-50 p-2 font-mono text-[11px] leading-5 text-[color:var(--color-muted)] dark:bg-[#073642]">{detail.draftText}</pre>
            </div>
          </details>
        ) : null}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onRetry} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重试（复用研究与规划）' : 'Retry (reuse research & plan)'}
          </button>
          <button type="button" onClick={onRegenerate} className="text-xs font-medium text-[color:var(--color-accent)] hover:underline">
            {isZh ? '重新生成' : 'Regenerate'}
          </button>
          <button type="button" onClick={onDelete} className="text-xs font-medium text-[color:var(--color-danger)] hover:underline">
            {isZh ? '删除' : 'Delete'}
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit && npm run check`
Expected: 通过。

```bash
git add src/components/GenerateForm.tsx
git commit -m "Classify failures and expose failed-chapter draft in the UI"
```

---

### Task 3: 文档 + 冒烟

**Files:**
- Modify: `docs/superpowers/specs/2026-07-12-failure-experience-design.md`（状态 → 已实施（2026-07-12））
- Modify: `README.md`（Agent Backend 段补一句失败语义）

- [ ] **Step 1: README**

Agent Backend 段（per-stage 模型清单句之后）加：

```markdown
章节 4 轮评审失败后任务失败，但失败草稿与评审意见会持久化：手动重试会带着上一版与否决原因继续迭代，前端失败卡片可展开查看失败章节全文；基础设施故障（服务商 5xx）与质量否决在 UI 分类展示。
```

- [ ] **Step 2: 设计文档状态**

`状态：已获用户批准` → `状态：已实施（2026-07-12）`。

- [ ] **Step 3: 全量验证 + Commit**

Run: `npm test && npm run check && npx tsc --noEmit`
Expected: 全绿。

```bash
git add README.md docs/superpowers/specs/2026-07-12-failure-experience-design.md
git commit -m "Document failure-experience semantics"
```

- [ ] **Step 4: 冒烟（手动，控制器）**

1. `sudo systemctl restart agent-backend`
2. 生成一门课；若中转仍瘫，观察失败卡片显示"服务商故障"分类提示（infra 路径天然可测）
3. 中转恢复后：完整生成或人为触发质量失败，核对展开区草稿与反馈、重试后日志含"上一版全文已被否决"

---

## Self-Review 记录

- 规格覆盖：spec 三节 → Task 1（持久化+播种+清除+分类+透传）、Task 2（分类展示+展开区）、Task 3（文档+冒烟）；"不做什么"未越界
- 类型一致：compose_failure.json 与 failureDetail 的字段名在写入/读取/前端接口三处一致；`initial_feedback` 参数与 `_run_compose` 传参一致；kind 三值前后端一致
- 关键边界已在计划中显式处理：ProviderError 最后一轮 re-raise 不写 failureDetail（infra 无草稿）；种子文件消费后删除；compose 成功清 failureDetail；旧任务缺字段前端可选链降级
- 测试联动：FakeClient 新增两个开关不影响既有分支；`fail_judge_times=4` 恰好耗尽首轮、重试轮判过——与 attempts=4 对齐
- 占位符扫描：无
