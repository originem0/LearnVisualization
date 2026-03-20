import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from pipeline import CourseGenerationPipeline  # noqa: E402
from provider import ProviderConfig  # noqa: E402


class FakeClient:
    def __init__(self, response_builder):
        self.response_builder = response_builder

    def generate_json(self, *, schema_name, system_prompt, user_prompt, temperature=0.2, max_tokens=4000):
        return {
            "schema_name": schema_name,
            "content": self.response_builder(user_prompt),
            "raw_text": "",
            "usage": {"prompt_tokens": 100, "completion_tokens": 200, "total_tokens": 300},
            "model": "fake-model",
        }


def response_builder_success(user_prompt: str):
    if "module_outline" in user_prompt and '"id": "s01"' in user_prompt:
        return {
            "title": "一次缓存命中到底经过了什么",
            "subtitle": "从 key 查询到 value 返回",
            "focusQuestion": "一次命中路径里，到底有哪些状态在被读取和确认？",
            "misconception": "缓存命中只是查一个 map，没有真正的机制链。",
            "quote": "命中不是一个点，而是一条确认链。",
            "keyInsight": "一次缓存命中至少同时确认 key 存在、entry 仍有效、value 可返回，以及访问元数据需要被更新。",
            "opening": "很多人把缓存命中想成一次瞬时查表，但系统真正做的是一连串状态确认：这个 key 在不在、这份值还算不算有效、这次访问要不要改写 recency 记录。",
            "concepts": [
                {"name": "lookup path", "note": "命中前先沿数据结构找到 entry。"},
                {"name": "metadata check", "note": "命中不是只看 key，还要确认有效性和状态。"},
                {"name": "access bookkeeping", "note": "命中后往往要更新 recency 或频率统计。"},
            ],
            "logicChain": [
                "收到 key 后先定位 entry",
                "确认 entry 仍然有效且未过期",
                "读取 value 并返回结果",
                "同步更新访问元数据，为后续淘汰决策提供依据",
            ],
            "examples": [
                "读取 user:42 时，系统先命中哈希桶，再检查 TTL，最后更新最近访问时间。",
                "某些 LRU 实现会在命中后把 entry 挪到链表头部，这一步不是附带动作，而是后续淘汰策略的输入。",
            ],
            "counterexamples": ["如果 entry 已存在但 TTL 已过，就不是命中而是命中失败后的回源路径。"],
            "pitfalls": [
                {"point": "把命中理解成单步查表", "rootCause": "忽略了有效性检查和访问元数据更新。"}
            ],
            "narrative": [
                {"type": "text", "content": "缓存命中真正解决的是“这份值此刻能不能被当作答案返回”。因此系统先找 entry，再确认它没有失效，最后才把 value 交给调用方。"},
                {"type": "heading", "content": "命中路径先确认什么"},
                {
                    "type": "steps",
                    "label": "命中路径四步",
                    "content": "",
                    "steps": [
                        {"title": "定位 entry", "description": "沿内部数据结构找到候选项", "visual": "key -> bucket -> entry", "highlight": "entry"},
                        {"title": "检查有效性", "description": "确认 TTL 或状态位允许返回", "visual": "entry -> ttl/status check", "highlight": "ttl"},
                        {"title": "返回 value", "description": "把 payload 交给调用方", "visual": "entry -> value", "highlight": "value"},
                        {"title": "更新访问记录", "description": "写回 recency/frequency 元数据", "visual": "touch lru/frequency metadata", "highlight": "metadata"},
                    ],
                },
                {"type": "callout", "content": "命中路径里最容易被忽略的不是查找，而是“命中后还要改写什么状态”。"},
                {"type": "heading", "content": "为什么这会影响后续淘汰"},
                {"type": "text", "content": "因为很多缓存策略不是看 key 有没有被访问过，而是看最近访问顺序或访问频率。命中后更新的那一步，直接塑造了后面谁会被淘汰。"},
            ],
            "visuals": [{"id": "s01-map", "type": "processFlow", "required": True}],
            "interactionRequirements": [
                {"capability": "trace", "purpose": "追踪一次命中路径中的状态变化", "priority": "core", "componentHint": "FullPipelineTracer"}
            ],
            "retrievalPrompts": [
                {"type": "predict-next-step", "prompt": "如果 key 已找到但 TTL 已过，命中路径接下来最关键的状态变化是什么？", "answerShape": "回答应区分存在、有效和回源三个层次。"}
            ],
            "bridgeTo": "现在你知道命中不是单步查表了。接下来要问的是：如果 value 不再有效，系统是把它判成“过期”，还是因为容量压力把它“淘汰”？两者为什么不能混成一个词？",
        }

    if "module_outline" in user_prompt and '"id": "s02"' in user_prompt:
        return {
            "title": "失效与淘汰为什么不是一回事",
            "subtitle": "TTL、容量压力与替换策略",
            "focusQuestion": "为什么缓存会同时需要失效机制和淘汰策略？",
            "misconception": "TTL 到了等于数据被淘汰，两个词只是不同说法。",
            "quote": "过期回答的是“这份值还算不算真”，淘汰回答的是“内存够不够继续留它”。",
            "keyInsight": "expiration 关注数据有效性，eviction 关注容量与保留策略；一个回答真假，一个回答空间。",
            "opening": "很多人会把 TTL 和 eviction 混成一个动作，因为它们最后都让数据离开缓存。但它们其实在回答两类完全不同的问题：这份值是不是还可信，以及这份值值不值得继续占着内存。",
            "concepts": [
                {"name": "expiration", "note": "基于时间或版本判断值是否仍有效。"},
                {"name": "eviction", "note": "在容量压力下决定谁先离开缓存。"},
                {"name": "replacement signal", "note": "recency、frequency 等信号决定被谁挤掉。"},
            ],
            "logicChain": [
                "失效先判断值还能不能被信任",
                "淘汰再判断有限内存里谁该被保留",
                "同一个 entry 可能既过期又在淘汰候选集合里",
                "把两个机制分开，系统才能同时处理正确性和容量压力",
            ],
            "examples": [
                "一个 TTL 已过的商品价格即使当前内存不紧张，也不该继续当真值返回。",
                "一个仍然有效但长期没人访问的 entry，可能在容量压力下被 LRU 先踢出去。",
            ],
            "counterexamples": ["内存有空位时，过期条目仍可能被立即清理；这不是淘汰策略在起作用，而是有效性判定。"],
            "pitfalls": [
                {"point": "把 expiration 和 eviction 混成同一条控制线", "rootCause": "没区分正确性问题和容量问题。"}
            ],
            "narrative": [
                {"type": "text", "content": "expiration 和 eviction 的结果都可能表现为“这个值不见了”，但它们服务的是两套完全不同的控制逻辑：一个管真假，一个管空间。"},
                {"type": "heading", "content": "两个机制分别在回答什么"},
                {
                    "type": "steps",
                    "label": "expiration vs eviction",
                    "content": "",
                    "steps": [
                        {"title": "先问有效性", "description": "值是否还在可信时间窗里", "visual": "now vs ttl/version", "highlight": "validity"},
                        {"title": "再问容量", "description": "有限内存里谁该留下", "visual": "capacity pressure -> candidate set", "highlight": "capacity"},
                        {"title": "读取替换信号", "description": "看 recency/frequency 等保留依据", "visual": "lru/lfu metadata", "highlight": "signal"},
                        {"title": "执行清理", "description": "按原因决定删除或回源路径", "visual": "expire or evict", "highlight": "reason"},
                    ],
                },
                {"type": "callout", "content": "过期先回答真假，淘汰再回答空间；把这两问混成一问，系统行为就解释不清了。"},
                {"type": "heading", "content": "为什么工程上必须拆开"},
                {"type": "text", "content": "因为你可能在没有容量压力时遇到过期值，也可能在值仍然有效时因为内存紧张而淘汰它。只有把两个控制面拆开，缓存系统才能同时保证正确性和资源约束。"},
            ],
            "visuals": [{"id": "s02-map", "type": "comparisonFrame", "required": True}],
            "interactionRequirements": [
                {"capability": "compare", "purpose": "并置比较 expiration 和 eviction 的控制逻辑", "priority": "core", "componentHint": "AlignmentCompare"}
            ],
            "retrievalPrompts": [
                {"type": "compare-variants", "prompt": "一个 value 仍然有效，但缓存容量已满。此时最该触发的是哪条控制线？", "answerShape": "需要先指出这是容量问题，再解释为什么不属于 expiration。"}
            ],
            "bridgeTo": None,
        }

    if "moduleOutlines" in user_prompt and "researchSummary" in user_prompt:
        return {
            "title": "缓存系统内部原理",
            "subtitle": "从 key 到 eviction 的机制链",
            "goal": "理解缓存系统如何在命中、失效、淘汰之间维持性能和一致性。",
            "projectType": "mixed",
            "language": "zh",
            "audience": {
                "primaryAudience": "已经会写应用代码，但对缓存内部机制理解不深的软件工程师",
                "priorKnowledge": ["知道 key-value 缓存的基本用途"],
                "constraints": ["需要用中文学习"],
                "desiredOutcome": "能从命中路径和淘汰策略解释缓存系统行为",
            },
            "learningGoals": [
                "理解缓存命中路径中的关键状态变化",
                "理解失效与淘汰如何共同影响系统行为",
            ],
            "nonGoals": ["不覆盖分布式缓存的全部实现细节"],
            "assumptions": ["学习者更需要机制链而不是 API 罗列"],
            "philosophy": {
                "promise": "先看机制链，再看工程权衡",
                "corePrinciples": ["焦点问题驱动", "误解先行", "worked example 必须服务理解"],
                "shiftStatement": "从“缓存就是快一点的字典”升级为“能解释缓存内部因果链”。",
            },
            "categories": [
                {"id": "flow", "name": "命中路径", "color": "blue"},
                {"id": "control", "name": "控制机制", "color": "amber"},
            ],
            "paths": [
                {
                    "id": "core-path",
                    "title": "核心路径",
                    "description": "先命中，再失效与淘汰",
                    "moduleIds": ["s01", "s02"],
                }
            ],
            "moduleOutlines": [
                {
                    "id": "s01",
                    "number": 1,
                    "title": "一次缓存命中到底经过了什么",
                    "subtitle": "从 key 查询到 value 返回",
                    "category": "flow",
                    "moduleKind": "mechanism-walkthrough",
                    "primaryCognitiveAction": "trace",
                    "focusQuestion": "一次命中路径里，到底有哪些状态在被读取和确认？",
                    "misconception": "缓存命中只是查一个 map，没有真正的机制链。",
                    "targetChunk": "lookup path -> metadata check -> value return",
                    "priorKnowledge": [],
                },
                {
                    "id": "s02",
                    "number": 2,
                    "title": "失效与淘汰为什么不是一回事",
                    "subtitle": "TTL、容量压力与替换策略",
                    "category": "control",
                    "moduleKind": "concept-clarification",
                    "primaryCognitiveAction": "distinguish",
                    "focusQuestion": "为什么缓存会同时需要失效机制和淘汰策略？",
                    "misconception": "TTL 到了等于数据被淘汰，两个词只是不同说法。",
                    "targetChunk": "expiration vs eviction vs recency/frequency tradeoff",
                    "priorKnowledge": ["s01"],
                },
            ],
            "moduleGraph": {
                "order": ["s01", "s02"],
                "edges": [{"from": "s01", "to": "s02", "type": "prerequisite", "note": "先懂命中路径，再懂为什么要清掉数据"}],
            },
            "researchSummary": {
                "keyQuestions": ["缓存如何判断命中", "为什么需要 eviction"],
                "commonMisconceptions": ["命中只是字典查询", "过期和淘汰没有区别"],
                "workedExamples": ["一个 key 从读到删的完整路径"],
                "visualTargets": ["命中路径", "过期与淘汰对比"],
            },
        }

    raise AssertionError(f"unexpected prompt: {user_prompt[:160]}")


def response_builder_generic_failure(user_prompt: str):
    if "module_outline" not in user_prompt:
        return response_builder_success(user_prompt)
    return {
        "title": "缓存模块",
        "subtitle": "模板化副标题",
        "focusQuestion": "这个主题最关键的问题是什么？",
        "misconception": "认为 这个主题 只需要背定义，不需要理解因果机制。",
        "quote": "模板句",
        "keyInsight": "这一章的目标不是堆信息，而是把这个主题的一个关键结构讲到可复述。",
        "opening": "这一章围绕这个主题的一个核心问题展开。",
        "concepts": [{"name": "缓存核心概念", "note": "需要先建立最小概念边界。"}],
        "logicChain": ["先定义这个主题的局部对象", "再追踪其关键机制", "最后重新连起来"],
        "examples": ["用一个最小 worked example 解释这个主题的关键过程。"],
        "counterexamples": [],
        "pitfalls": [{"point": "把模块写成资料堆砌", "rootCause": "没有围绕焦点问题组织认知动作"}],
        "narrative": [
            {"type": "text", "content": "先用一个最小冲突把这个主题的问题拎出来。"},
            {"type": "heading", "content": "模板小节"},
            {
                "type": "steps",
                "label": "最小机制链",
                "content": "",
                "steps": [
                    {"title": "建立对象", "description": "明确最小对象", "visual": "object boundary", "highlight": "object"}
                ],
            },
            {"type": "callout", "content": "如果一章不能被重建，它就还只是材料，不是课程。"},
            {"type": "text", "content": "这一步仍然只是结构化理解。"},
            {"type": "text", "content": "这一步仍然只是结构化理解。"},
        ],
        "visuals": [{"id": "s01-map", "type": "conceptMap", "required": True}],
        "interactionRequirements": [{"capability": "trace", "purpose": "核心交互", "priority": "core", "componentHint": None}],
        "retrievalPrompts": [{"type": "rebuild-map", "prompt": "请重建这个主题", "answerShape": "结构化理解"}],
        "bridgeTo": "下一章应该接着解释这个机制如何影响更大系统。",
    }


class CourseGenerationPipelineTests(unittest.TestCase):
    def create_pipeline(self, response_builder) -> tuple[CourseGenerationPipeline, tempfile.TemporaryDirectory]:
        temp_dir = tempfile.TemporaryDirectory()
        provider_config = ProviderConfig(
            base_url="http://fake-provider.local/v1",
            model="mock-model",
            api_key="test-key",
            timeout_seconds=5,
            max_retries=0,
        )
        pipeline = CourseGenerationPipeline(
            provider_config=provider_config,
            jobs_root=Path(temp_dir.name) / "jobs",
            generated_root=Path(temp_dir.name) / "generated",
            repo_root=REPO_ROOT,
            client=FakeClient(response_builder),
        )
        return pipeline, temp_dir

    def test_pipeline_exports_waiting_review_package(self):
        pipeline, temp_dir = self.create_pipeline(response_builder_success)
        self.addCleanup(temp_dir.cleanup)

        job = pipeline.create_job({"topic": "缓存系统 internals"}, run_async=False)
        job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "waiting_review")
        output_dir = Path(job["artifacts"]["output"])
        self.assertTrue((output_dir / "course.json").exists())
        self.assertTrue((output_dir / "review" / "approval.json").exists())

        reviewed = pipeline.review_job(job["id"], approved=True, reviewed_by="reviewer", notes="Looks solid.")
        self.assertEqual(reviewed["status"], "completed")

        approval = json.loads((output_dir / "review" / "approval.json").read_text(encoding="utf-8"))
        self.assertEqual(approval["approved"], True)
        self.assertEqual(approval["reviewedBy"], "reviewer")

    def test_pipeline_blocks_generic_template_output(self):
        pipeline, temp_dir = self.create_pipeline(response_builder_generic_failure)
        self.addCleanup(temp_dir.cleanup)

        job = pipeline.create_job({"topic": "缓存系统 internals"}, run_async=False)
        job = pipeline.run_job(job["id"])

        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["currentStage"], "validate")
        self.assertIn("validation blocked export", json.dumps(job["error"], ensure_ascii=False) if job.get("error") else "")


if __name__ == "__main__":
    unittest.main()
