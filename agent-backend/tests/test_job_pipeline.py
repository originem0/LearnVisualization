import json
import shutil
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from pipeline import CourseGenerationPipeline  # noqa: E402
from provider import ProviderConfig, ProviderError  # noqa: E402
import research  # noqa: E402


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


class _FakeConfig:
    max_retries = 0
    model = "fake-writer-glm"
    judge_model = None
    research_model = None


class FakeClient:
    def __init__(self):
        self.config = _FakeConfig()
        self.chapter_prompts: list[str] = []
        self.plan_prompts: list[str] = []
        self.bad_fact_spine_times = 0  # 前 N 次 plan 返回空 factSpine
        self.fabricate_quotes = False
        self.fail_course_verify = False
        self.course_verify_advisory = False
        self.fail_judge_times = 0   # 前 N 次章节评审返回不通过
        self.raise_provider_error_on_chapter = False
        self.judge_provider_error_times = 0
        self.calls: list[tuple[str, str | None]] = []

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=4000, model=None):
        self.calls.append((schema_name, model))
        if schema_name == "topic_validation":
            content = {"canonicalTopic": "", "narrowSuggestions": []}
        elif schema_name == "essay_course_plan":
            self.plan_prompts.append(user_prompt)
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
            content = {
                "title": "缓存为什么不是快一点的字典",
                "subtitle": "从命中路径到淘汰策略",
                "overview": {
                    "whyExists": "缓存的难点不在 API，而在它同时处理正确性和资源约束。",
                    "wherePoints": "读完能解释一次命中、一次过期和一次淘汰分别在回答什么问题。",
                    "arc": ["先拆掉字典直觉", "追踪命中路径", "区分过期和淘汰", "回到工程取舍"],
                },
                "factSpine": fact_spine,
                "chapters": chapters,
            }
        elif schema_name == "course_verify":
            if getattr(self, "fail_course_verify", False):
                content = {"pass": False, "issues": ["末章没有回扣 drivingQuestion"]}
            elif getattr(self, "course_verify_advisory", False):
                # 评审判通过，但附带非阻断旁注
                content = {"pass": True, "issues": ["个别段落略有重复感，但不影响收束"]}
            else:
                content = {"pass": True, "issues": []}
        elif schema_name.endswith("_quality_judge"):
            if self.judge_provider_error_times > 0:
                self.judge_provider_error_times -= 1
                raise ProviderError("c01_quality_judge: model returned invalid JSON")
            if self.fail_judge_times > 0:
                self.fail_judge_times -= 1
                content = {"pass": False, "score": 40, "issues": ["论证密度不足"], "rewriteHint": "补充证据锚点"}
            else:
                content = {"pass": True, "score": 90, "issues": [], "rewriteHint": ""}
        elif schema_name.endswith("_chapter"):
            if self.raise_provider_error_on_chapter:
                raise ProviderError("HTTP 503（No active API keys available for this group）")
            chapter_id = schema_name.split("_", 1)[0]
            self.chapter_prompts.append(user_prompt)
            number = int(chapter_id[1:])
            content = {
                "title": f"第 {number} 章",
                "role": "沿着主线推进一段论证",
                "narrative": [
                    {"type": "text", "content": f"{chapter_id} 直接进入缓存机制问题。它先说明一个具体状态。然后把这个状态放回命中路径里。"},
                    {"type": "heading", "content": "状态为什么重要"},
                    {"type": "quote", "content": (
                        "这句引文是模型编造的，不在任何证据里，长度足够触发校验。"
                        if self.fabricate_quotes
                        else "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。"
                    ), "cite": "研究材料"},
                    {"type": "text", "content": "命中不是单步查表。系统要先定位 entry。接着检查有效性。然后返回 value。最后更新访问元数据。"},
                    {"type": "callout", "content": "如果命中后不更新元数据，后面的淘汰策略就会拿到错误信号。"},
                    {"type": "text", "content": "这一章的结尾保留一个问题：当 value 还存在时，它到底是可信、过期，还是应该因为容量压力被移走？"},
                ],
                "usedEvidence": ["E01", "E02"],
                "highlight": None,
                "bridge": "下一章继续追问这个状态为什么会改变。",
            }
        elif schema_name == "research_queries":
            content = {"queries": ["缓存 LRU 淘汰 机制"]}
        elif schema_name.startswith("evidence_"):
            doc_id = schema_name.split("_", 1)[1]
            content = {"evidence": (
                [{"kind": "quote", "content": "命中后系统会更新 recency 元数据，这是淘汰策略的信号来源。", "note": "机制锚点"}]
                + [{"kind": "fact", "content": f"{doc_id} 具体事实{i}：缓存条目在不同状态下的行为差异细节", "note": "锚点"} for i in range(6)]
            )}
        else:
            raise AssertionError(f"unexpected schema: {schema_name}")

        return {
            "schema_name": schema_name,
            "content": content,
            "raw_text": json.dumps(content, ensure_ascii=False),
            "usage": {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300},
            "model": "fake-model",
        }


def contract() -> dict:
    return {
        "drivingQuestion": "为什么缓存不是一个快一点的字典？",
        "centralTension": "直觉说缓存只是 key-value 查表，但真实系统还要处理有效性、容量和访问信号。",
        "knowledgeType": "procedural",
        "audience": "会写应用代码但没系统理解缓存内部机制的软件工程师",
        "desiredOutcome": "能解释命中、过期、淘汰三条控制线",
        "scope": {
            "include": ["命中路径", "TTL 过期", "LRU 淘汰"],
            "exclude": ["分布式一致性", "缓存集群运维"],
            "depth": "围绕关键机制深挖，4-6章",
        },
        "problemFraming": {
            "phenomenon": "同样是 key-value 读取，普通字典命中后状态不变，但缓存命中会更新 recency，过期或容量压力也会改变结果",
            "contrast": "直觉把缓存当快字典；真实缓存会因为时间、容量和访问历史让同一个 key 得到不同命运",
            "problemNature": "model_mismatch",
            "systemGoal": "建立缓存系统如何同时维护有效性、容量和访问价值的运行模型",
            "modelGap": "缺少命中路径、TTL、淘汰策略和元数据更新之间的关系模型",
        },
    }


class CourseGenerationPipelineTests(unittest.TestCase):
    def create_pipeline(self) -> tuple[CourseGenerationPipeline, tempfile.TemporaryDirectory, FakeClient]:
        temp_dir = tempfile.TemporaryDirectory()
        provider_config = ProviderConfig(
            base_url="http://fake-provider.local/v1",
            model="mock-model",
            api_key="test-key",
            timeout_seconds=5,
            max_retries=0,
        )
        client = FakeClient()
        pipeline = CourseGenerationPipeline(
            provider_config=provider_config,
            jobs_root=Path(temp_dir.name) / "jobs",
            generated_root=Path(temp_dir.name) / "generated",
            repo_root=REPO_ROOT,
            client=client,
        )
        return pipeline, temp_dir, client

    def run_job_published(self, pipeline, job_id):
        with _ResearchPatches(), patch.object(pipeline, "_run_next_build", return_value={"ok": True, "skipped": True}):
            return pipeline.run_job(job_id)

    def test_pipeline_auto_publishes_after_machine_gates(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-essay-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])

        # 机器防线全过后直接发布；人工判断是发布后的策展（删除/重生成）
        self.assertEqual(job["status"], "completed")
        self.assertTrue(job["resultSummary"]["published"])
        self.assertEqual(job["resultSummary"]["reviewStatus"], "approved")
        self.assertTrue(promoted.exists())
        exported_dir = Path(job["artifacts"]["reviewedOutput"])
        self.assertTrue((exported_dir / "course.json").exists())
        self.assertTrue((exported_dir / "chapters" / "c01.json").exists())
        self.assertFalse((exported_dir / "modules").exists())
        approval = json.loads((exported_dir / "review" / "approval.json").read_text("utf-8"))
        self.assertTrue(approval["approved"])
        self.assertEqual(approval["reviewedBy"], "system")
        course_record = json.loads((promoted / "course.json").read_text("utf-8"))
        self.assertEqual(course_record["writingMode"], "mechanism-explainer")
        self.assertEqual(course_record["contract"]["problemFraming"]["problemNature"], "model_mismatch")

    def test_chapter_prompt_receives_previous_chapter_ending(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-continuity-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        self.run_job_published(pipeline, job["id"])

        self.assertGreaterEqual(len(client.chapter_prompts), 2)
        self.assertIn("上一章结尾", client.chapter_prompts[1])
        self.assertIn("这一章的结尾保留一个问题", client.chapter_prompts[1])

    def test_create_job_requires_contract(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        with self.assertRaises(ValueError):
            pipeline.create_job({"topic": "缓存系统 internals"}, run_async=False)

        legacy_payload = {
            "topic": "缓存系统 internals",
            "drivingQuestion": "为什么缓存不是一个快一点的字典？",
            "centralTension": "直觉说缓存只是 key-value 查表，但真实系统还要处理有效性、容量和访问信号。",
            "knowledgeType": "procedural",
            "audience": "会写应用代码但没系统理解缓存内部机制的软件工程师",
            "desiredOutcome": "能解释命中、过期、淘汰三条控制线",
            "scope": {
                "include": ["命中路径"],
                "exclude": ["分布式一致性"],
                "depth": "围绕关键机制深挖，4-6章",
            },
        }
        with self.assertRaises(ValueError):
            pipeline.create_job(legacy_payload, run_async=False)

        incomplete_contract = contract()
        incomplete_contract.pop("problemFraming")
        with self.assertRaises(ValueError):
            pipeline.create_job({"topic": "缓存系统 internals", "contract": incomplete_contract}, run_async=False)

    def test_rejects_unsafe_output_slug(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        with self.assertRaises(ValueError):
            pipeline.create_job({"topic": "缓存系统 internals", "output_slug": "../escape", "contract": contract()}, run_async=False)

    def test_overwrite_allows_existing_published_slug(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-overwrite-{uuid.uuid4().hex[:8]}"
        target_dir = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(target_dir, ignore_errors=True))
        target_dir.mkdir(parents=True)
        (target_dir / "course.json").write_text(json.dumps({"title": "旧课程"}, ensure_ascii=False), encoding="utf-8")

        job = pipeline.create_job(
            {"topic": "缓存系统 internals", "output_slug": slug, "overwrite": True, "contract": contract()},
            run_async=False,
        )

        self.assertEqual(job["request"]["output_slug"], slug)
        self.assertTrue(job["request"]["overwrite"])

    def test_cleanup_keeps_waiting_review_output(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-waiting-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        output_dir = pipeline.generated_root / slug
        output_dir.mkdir(parents=True)
        (output_dir / "course.json").write_text("{}", encoding="utf-8")
        pipeline.store.mark_waiting_review(job["id"], output_dir=output_dir, summary={"outputSlug": slug})

        pipeline.cleanup_stale_data()

        self.assertTrue(output_dir.exists())

    def test_approve_publish_rolls_back_when_build_fails(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-publish-rollback-{uuid.uuid4().hex[:8]}"
        target_dir = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(target_dir, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches(), patch.object(pipeline, "_run_next_build", side_effect=RuntimeError("build failed")):
            job = pipeline.run_job(job["id"])

        self.assertFalse(target_dir.exists())
        failed_job = pipeline.get_job(job["id"])
        self.assertEqual(failed_job["status"], "failed")
        self.assertEqual(failed_job["review"]["status"], "publish_failed")

    def test_prepare_retry_from_plan_discards_compose_checkpoint(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-checkpoint-reset-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        checkpoint = pipeline.store.job_dir(job["id"]) / "stages" / "compose_checkpoint.json"
        checkpoint.write_text('{"chapters": [], "compose_logs": []}', encoding="utf-8")
        with pipeline.store.job_lock(job["id"]):
            failed = pipeline.store.load_job(job["id"])
            failed["currentStage"] = "plan"
            pipeline.store.write_job(failed)

        pipeline.store.prepare_retry(job["id"], None)

        self.assertFalse(checkpoint.exists())

    def test_prepare_retry_from_plan_discards_stale_failure_seed(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-seed-reset-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        seed = pipeline.store.job_dir(job["id"]) / "stages" / "compose_failure.json"
        seed.write_text('{"chapterId": "c01", "feedback": "旧大纲的否决意见", "draft": {}, "attempts": 4}', encoding="utf-8")
        with pipeline.store.job_lock(job["id"]):
            failed = pipeline.store.load_job(job["id"])
            failed["status"] = "failed"
            failed["currentStage"] = "plan"
            pipeline.store.write_job(failed)

        pipeline.store.prepare_retry(job["id"], None)

        # 重新规划后章节 id 可能复用（c01…），旧种子必须作废，否则会把旧大纲的
        # 否决意见注入新章节的首轮 prompt
        self.assertFalse(seed.exists())

    def test_prepare_retry_from_compose_keeps_checkpoint(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-checkpoint-keep-{uuid.uuid4().hex[:8]}"
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        checkpoint = pipeline.store.job_dir(job["id"]) / "stages" / "compose_checkpoint.json"
        checkpoint.write_text('{"chapters": [], "compose_logs": []}', encoding="utf-8")

        pipeline.store.prepare_retry(job["id"], "compose")

        # 从 compose 本身重试保留检查点：已通过的章节不重写
        self.assertTrue(checkpoint.exists())

    def test_plan_retries_once_when_fact_spine_missing_then_succeeds(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 1
        slug = f"test-spine-retry-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])

        self.assertEqual(len(client.plan_prompts), 2)
        self.assertNotIn("上一版规划未通过校验", client.plan_prompts[0])
        self.assertIn("上一版规划未通过校验", client.plan_prompts[1])  # 修复反馈进入第二次 prompt
        plan = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
        self.assertEqual(len(plan["factSpine"]), 3)
        self.assertEqual(plan["factSpine"][0]["claim"], "LRU 命中后会更新 recency 元数据")
        self.assertEqual(plan["factSpine"][0]["evidenceIds"], ["E01"])

    def test_plan_fails_when_fact_spine_never_valid(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 99
        slug = f"test-spine-fail-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        with _ResearchPatches():
            job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("factSpine", job["error"]["message"])

    def test_judge_calls_use_judge_model_when_configured(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.config.judge_model = "fake-judge-gemini"
        slug = f"test-judge-model-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        self.run_job_published(pipeline, job["id"])

        judge_calls = [m for (name, m) in client.calls if name.endswith("_quality_judge")]
        chapter_calls = [m for (name, m) in client.calls if name.endswith("_chapter")]
        self.assertTrue(judge_calls)
        self.assertTrue(all(m == "fake-judge-gemini" for m in judge_calls))
        self.assertTrue(all(m is None for m in chapter_calls))

    def test_run_job_produces_research_artifact_and_stage(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-research-stage-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])

        self.assertEqual(job["status"], "completed")
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

    def test_plan_prompt_carries_evidence_digest_and_chapters_get_ids(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-plan-evidence-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])

        self.assertIn("[E01]", client.plan_prompts[0])  # 证据摘要进入 plan prompt
        plan = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
        self.assertEqual(plan["chapterPlans"][0]["evidenceIds"], ["E01", "E02"])
        self.assertEqual(plan["factSpine"][0]["evidenceIds"], ["E01"])

    def test_chapter_prompt_embeds_evidence_and_output_carries_sources(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-compose-evidence-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])

        # 章节 prompt 内嵌本章证据全文
        self.assertIn("命中后系统会更新 recency 元数据", client.chapter_prompts[0])
        self.assertIn("[E01]", client.chapter_prompts[0])
        # 导出的章节带 sources
        exported_dir = Path(job["artifacts"]["reviewedOutput"])
        c01 = json.loads((exported_dir / "chapters" / "c01.json").read_text("utf-8"))
        self.assertTrue(c01["sources"])
        self.assertEqual(c01["sources"][0]["id"], "E01")
        self.assertTrue(c01["sources"][0]["url"].startswith("https://"))
        # E01/E02 同属一份文档，参考资料按来源去重后不重复
        source_keys = [(s["title"], s["url"]) for s in c01["sources"]]
        self.assertEqual(len(source_keys), len(set(source_keys)))
        self.assertEqual(len(c01["sources"]), 1)

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

    def test_transient_judge_error_retries_not_crashes(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.judge_provider_error_times = 2  # 前两轮评审抛坏 JSON，第三轮放行
        slug = f"test-judge-transient-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])
        self.assertEqual(job["status"], "completed")

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

    def test_verify_stage_records_artifact(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-verify-ok-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])
        self.assertEqual(job["status"], "completed")
        verify = json.loads(Path(job["artifacts"]["verify"]).read_text("utf-8"))
        self.assertTrue(verify["pass"])
        self.assertTrue(verify["mechanical"]["quoteFidelityOk"])
        judge_models = [m for (name, m) in client.calls if name == "course_verify"]
        self.assertEqual(len(judge_models), 1)

    def test_verify_passes_when_course_judge_passes_with_advisory_notes(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.course_verify_advisory = True
        slug = f"test-verify-advisory-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = self.run_job_published(pipeline, job["id"])
        # 课程级评审 pass=true 时的旁注不该让整课失败
        self.assertEqual(job["status"], "completed")
        verify = json.loads(Path(job["artifacts"]["verify"]).read_text("utf-8"))
        self.assertTrue(verify["pass"])
        self.assertTrue(verify["advisory"])  # 旁注被保留但不阻断

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


if __name__ == "__main__":
    unittest.main()



class CleanupCutoffTests(unittest.TestCase):
    def test_recent_failed_job_survives_cleanup(self):
        import tempfile as _tf
        from datetime import datetime as _dt, timedelta as _td, timezone as _tz
        temp_dir = _tf.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        provider_config = ProviderConfig(base_url="http://fake.local/v1", model="m", api_key="k", max_retries=0)
        pipeline = CourseGenerationPipeline(
            provider_config=provider_config,
            jobs_root=Path(temp_dir.name) / "jobs",
            generated_root=Path(temp_dir.name) / "generated",
            repo_root=REPO_ROOT,
            client=FakeClient(),
        )
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": f"t-{uuid.uuid4().hex[:6]}", "contract": contract()}, run_async=False)
        with pipeline.store.job_lock(job["id"]):
            j = pipeline.store.load_job(job["id"])
            j["status"] = "failed"
            # 昨天 UTC 创建：在 7 天窗口内，必须保留（旧代码会在本地过午夜后删掉它）
            j["createdAt"] = (_dt.now(_tz.utc) - _td(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
            pipeline.store.write_job(j)

        pipeline.cleanup_stale_data()
        self.assertTrue(pipeline.store.job_dir(job["id"]).exists())

    def test_ancient_failed_job_is_cleaned(self):
        import tempfile as _tf
        from datetime import datetime as _dt, timedelta as _td, timezone as _tz
        temp_dir = _tf.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        provider_config = ProviderConfig(base_url="http://fake.local/v1", model="m", api_key="k", max_retries=0)
        pipeline = CourseGenerationPipeline(
            provider_config=provider_config,
            jobs_root=Path(temp_dir.name) / "jobs",
            generated_root=Path(temp_dir.name) / "generated",
            repo_root=REPO_ROOT,
            client=FakeClient(),
        )
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": f"t-{uuid.uuid4().hex[:6]}", "contract": contract()}, run_async=False)
        with pipeline.store.job_lock(job["id"]):
            j = pipeline.store.load_job(job["id"])
            j["status"] = "failed"
            j["createdAt"] = (_dt.now(_tz.utc) - _td(days=8)).strftime("%Y-%m-%dT%H:%M:%SZ")
            pipeline.store.write_job(j)

        pipeline.cleanup_stale_data()
        self.assertFalse(pipeline.store.job_dir(job["id"]).exists())
