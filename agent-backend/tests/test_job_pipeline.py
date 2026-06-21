import json
import shutil
import sys
import tempfile
import unittest
import uuid
from pathlib import Path


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

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=4000):
        if schema_name == "topic_validation":
            content = {"canonicalTopic": "", "narrowSuggestions": []}
        elif schema_name == "essay_course_plan":
            content = {
                "title": "缓存为什么不是快一点的字典",
                "subtitle": "从命中路径到淘汰策略",
                "overview": {
                    "whyExists": "缓存的难点不在 API，而在它同时处理正确性和资源约束。",
                    "wherePoints": "读完能解释一次命中、一次过期和一次淘汰分别在回答什么问题。",
                    "arc": ["先拆掉字典直觉", "追踪命中路径", "区分过期和淘汰", "回到工程取舍"],
                },
                "factSpine": [
                    "LRU 命中后会更新 recency 元数据",
                    "TTL 过期即使没有容量压力也不能继续返回旧值",
                    "容量满时仍然有效的 entry 也可能被淘汰",
                ],
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

    def test_pipeline_exports_essay_package_waiting_review(self):
        pipeline, temp_dir, _ = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-essay-{uuid.uuid4().hex[:8]}"
        promoted = REPO_ROOT / "courses" / slug
        self.addCleanup(lambda: shutil.rmtree(promoted, ignore_errors=True))

        job = pipeline.create_job({"topic": "缓存系统 internals", "output_slug": slug, "contract": contract()}, run_async=False)
        job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "waiting_review")
        exported_dir = Path(job["artifacts"]["output"])
        self.assertTrue((exported_dir / "course.json").exists())
        self.assertTrue((exported_dir / "chapters" / "c01.json").exists())
        self.assertFalse((exported_dir / "modules").exists())
        self.assertEqual(job["resultSummary"]["chapterCount"], 4)

    def test_chapter_prompt_receives_previous_chapter_ending(self):
        pipeline, temp_dir, client = self.create_pipeline()
        self.addCleanup(temp_dir.cleanup)
        slug = f"test-cache-continuity-{uuid.uuid4().hex[:8]}"

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


if __name__ == "__main__":
    unittest.main()
