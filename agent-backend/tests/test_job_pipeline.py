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
from provider import ProviderConfig  # noqa: E402


class _FakeConfig:
    max_retries = 0


class FakeClient:
    def __init__(self):
        self.config = _FakeConfig()
        self.chapter_prompts: list[str] = []
        self.plan_prompts: list[str] = []
        self.bad_fact_spine_times = 0  # 前 N 次 plan 返回空 factSpine

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=4000):
        if schema_name == "topic_validation":
            content = {"canonicalTopic": "", "narrowSuggestions": []}
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
                "title": "缓存为什么不是快一点的字典",
                "subtitle": "从命中路径到淘汰策略",
                "overview": {
                    "whyExists": "缓存的难点不在 API，而在它同时处理正确性和资源约束。",
                    "wherePoints": "读完能解释一次命中、一次过期和一次淘汰分别在回答什么问题。",
                    "arc": ["先拆掉字典直觉", "追踪命中路径", "区分过期和淘汰", "回到工程取舍"],
                },
                "factSpine": fact_spine,
                "chapters": [
                    {"id": "c01", "number": 1, "title": "缓存不是字典", "role": "立起错误直觉"},
                    {"id": "c02", "number": 2, "title": "一次命中经过什么", "role": "追踪机制"},
                    {"id": "c03", "number": 3, "title": "过期和淘汰不是一回事", "role": "制造转折"},
                    {"id": "c04", "number": 4, "title": "把三条控制线放回系统", "role": "收束判断"},
                ],
            }
        elif schema_name.endswith("_quality_judge"):
            content = {"pass": True, "score": 90, "issues": [], "rewriteHint": ""}
        elif schema_name.endswith("_chapter"):
            chapter_id = schema_name.split("_", 1)[0]
            self.chapter_prompts.append(user_prompt)
            number = int(chapter_id[1:])
            content = {
                "title": f"第 {number} 章",
                "role": "沿着主线推进一段论证",
                "narrative": [
                    {"type": "text", "content": f"{chapter_id} 直接进入缓存机制问题。它先说明一个具体状态。然后把这个状态放回命中路径里。"},
                    {"type": "heading", "content": "状态为什么重要"},
                    {"type": "text", "content": "命中不是单步查表。系统要先定位 entry。接着检查有效性。然后返回 value。最后更新访问元数据。"},
                    {"type": "callout", "content": "如果命中后不更新元数据，后面的淘汰策略就会拿到错误信号。"},
                    {"type": "text", "content": "这一章的结尾保留一个问题：当 value 还存在时，它到底是可信、过期，还是应该因为容量压力被移走？"},
                ],
                "highlight": None,
                "bridge": "下一章继续追问这个状态为什么会改变。",
            }
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

    def test_chapter_prompt_receives_previous_chapter_ending(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-continuity-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        pipeline.run_job(job["id"])

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
        job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "waiting_review")

        with patch.object(pipeline, "_run_next_build", side_effect=RuntimeError("build failed")):
            with self.assertRaises(RuntimeError):
                pipeline.review_job(job["id"], approved=True, reviewed_by="tester", notes="")

        self.assertFalse(target_dir.exists())
        failed_job = pipeline.get_job(job["id"])
        self.assertEqual(failed_job["status"], "failed")
        self.assertEqual(failed_job["review"]["status"], "publish_failed")

    def test_plan_retries_once_when_fact_spine_missing_then_succeeds(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 1
        slug = f"test-spine-retry-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])

        self.assertEqual(len(client.plan_prompts), 2)
        self.assertIn("上一版规划未通过校验", client.plan_prompts[1])  # 修复反馈进入第二次 prompt
        plan = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
        self.assertEqual(len(plan["factSpine"]), 3)
        self.assertEqual(plan["factSpine"][0]["claim"], "LRU 命中后会更新 recency 元数据")
        self.assertEqual(plan["factSpine"][0]["evidenceIds"], [])

    def test_plan_fails_when_fact_spine_never_valid(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        client.bad_fact_spine_times = 99
        slug = f"test-spine-fail-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))
        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])
        self.assertEqual(job["status"], "failed")
        self.assertIn("factSpine", job["error"]["message"])


if __name__ == "__main__":
    unittest.main()

