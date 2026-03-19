import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from .models import normalize_module_request, normalize_topic_request
    from .workflow import WORKFLOW_V1, retry_policy
except ImportError:
    from models import normalize_module_request, normalize_topic_request
    from workflow import WORKFLOW_V1, retry_policy

REPO_ROOT = Path(__file__).resolve().parents[2]
POSTGRESQL_MODULES_DIR = REPO_ROOT / "courses" / "postgresql-internals" / "modules"


def _default_audience(req: dict) -> str:
    return req.get("audience") or "想系统理解复杂主题的中文学习者"


def _postgresql_modules() -> list[dict]:
    return [
        {
            "id": "s01",
            "title": "Pages, Tuples 与 Heap Storage",
            "module_kind": "system-overview",
            "primary_cognitive_action": "trace",
            "focus_question": "一行数据写进 PostgreSQL 后，到底以什么形状躺在磁盘里？",
            "misconception": "表就是抽象网格，而不是 page 与 tuple 结构。",
            "target_chunk": "table -> heap page -> tuple -> tuple header",
        },
        {
            "id": "s02",
            "title": "MVCC 与 Visibility",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "PostgreSQL 怎么让并发事务看到各自的真相？",
            "misconception": "事务隔离主要靠整表锁住。",
            "prerequisites": ["s01"],
            "target_chunk": "xmin/xmax + snapshot -> tuple visibility",
        },
        {
            "id": "s03",
            "title": "WAL 与 Crash Recovery",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "机器崩了之后，数据库怎么把世界补回一致？",
            "misconception": "把数据页直接写盘就足够安全。",
            "prerequisites": ["s01"],
            "target_chunk": "redo log -> checkpoint -> crash recovery",
        },
        {
            "id": "s04",
            "title": "B-Tree Index Internals",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": "索引为什么快，又为什么会分裂、膨胀、退化？",
            "misconception": "索引只是一个逻辑加速开关。",
            "prerequisites": ["s01"],
            "target_chunk": "B-Tree node/page -> search path -> split/bloat",
        },
        {
            "id": "s05",
            "title": "Planner / Executor Pipeline",
            "module_kind": "system-overview",
            "primary_cognitive_action": "compare",
            "focus_question": "同一条 SQL，为什么有时用索引、有时顺序扫描？",
            "misconception": "plan 基本是 SQL 的固定翻译。",
            "prerequisites": ["s04"],
            "target_chunk": "SQL -> planner -> plan -> executor",
        },
        {
            "id": "s06",
            "title": "VACUUM / Autovacuum / Freeze",
            "module_kind": "integration-review",
            "primary_cognitive_action": "rebuild",
            "focus_question": "如果 MVCC 不断制造旧版本，PostgreSQL 为什么不会被历史垃圾淹没？",
            "misconception": "删除就是删掉，系统会自然变干净。",
            "prerequisites": ["s02", "s04", "s05"],
            "target_chunk": "MVCC debt -> vacuum / autovacuum / freeze -> long-term health",
        },
    ]


def _load_postgresql_module(module_id: str) -> dict | None:
    module_path = POSTGRESQL_MODULES_DIR / f"{module_id}.json"
    if not module_path.exists():
        return None
    return json.loads(module_path.read_text(encoding="utf-8"))


def health() -> dict:
    return {
        "ok": True,
        "service": "agent-backend",
        "mode": "zero-dependency-dev-server",
    }


def workflow() -> dict:
    return {
        "workflow": WORKFLOW_V1,
        "retry_policy": retry_policy(),
    }


def topic_framing_dry_run(req: dict) -> dict:
    audience = _default_audience(req)
    return {
        "topic": req["topic"],
        "audience": audience,
        "learning_goals": req["goals"] or [f"建立对 {req['topic']} 的结构化理解"],
        "non_goals": ["不覆盖所有边缘细节", "不直接追求百科式完整性"],
        "assumptions": req["constraints"] or ["需要保留 human review gate"],
        "scope_statement": f"围绕 {req['topic']} 构建可视化学习路径，优先焦点问题、结构外显和 worked examples。",
    }


def curriculum_planning_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    if "postgres" in topic:
        modules = _postgresql_modules()
        return {"module_ids": [m["id"] for m in modules], "modules": modules}

    modules = [
        {
            "id": "s01",
            "title": f"{req['topic']} 的核心概念",
            "module_kind": "concept-clarification",
            "primary_cognitive_action": "distinguish",
            "focus_question": f"{req['topic']} 里最容易被误解的核心概念到底是什么？",
            "target_chunk": f"{req['topic']} core concepts",
        },
        {
            "id": "s02",
            "title": f"{req['topic']} 的关键机制",
            "module_kind": "mechanism-walkthrough",
            "primary_cognitive_action": "trace",
            "focus_question": f"{req['topic']} 中最关键的因果机制是怎样发生的？",
            "prerequisites": ["s01"],
            "target_chunk": f"{req['topic']} key mechanism",
        },
    ]
    return {"module_ids": [m["id"] for m in modules], "modules": modules}


def draft_course_package_dry_run(req: dict) -> dict:
    framing = topic_framing_dry_run(req)
    plan = curriculum_planning_dry_run(req)
    return {
        "id": req["topic"].lower().replace(" ", "-").replace("/", "-"),
        "title": req["topic"],
        "topic": req["topic"],
        "audience": framing["audience"],
        "learning_goals": framing["learning_goals"],
        "module_graph_order": plan["module_ids"],
        "modules": plan["modules"],
    }


def _generic_module_draft(req: dict) -> dict:
    title = req.get("title") or f"{req['topic']} 模块 {req['module_id']}"
    focus_question = req.get("focus_question") or f"{req['topic']} 在这一章最关键的问题到底是什么？"
    module_kind = req.get("module_kind") or "mechanism-walkthrough"
    primary_cognitive_action = req.get("primary_cognitive_action") or "trace"
    return {
        "id": req["module_id"],
        "title": title,
        "subtitle": "由 agent-backend dry-run 生成的模块草案",
        "category": "generated",
        "moduleKind": module_kind,
        "primaryCognitiveAction": primary_cognitive_action,
        "focusQuestion": focus_question,
        "misconception": f"{req['topic']} 只需要背定义，不需要理解因果机制。",
        "quote": f"{req['topic']} 不该被写成百科，而该被组织成可追踪的认知动作。",
        "keyInsight": f"这一章的目标不是堆信息，而是把 {req['topic']} 的一个关键机制讲到可复述、可区分、可重建。",
        "opening": f"这一章围绕 {req['topic']} 的一个核心问题展开：{focus_question}",
        "priorKnowledge": req.get("prerequisites", []),
        "targetChunk": f"{req['topic']} -> core mechanism -> worked explanation",
        "chunkDependencies": req.get("prerequisites", []),
        "concepts": [
            {"name": f"{req['topic']} core concept", "note": "需要先建立最小概念边界。"},
            {"name": f"{req['topic']} mechanism", "note": "理解它如何一步步发生。"},
        ],
        "logicChain": [
            f"先定义 {req['topic']} 的局部对象",
            "再追踪其关键机制与约束",
            "最后把机制结果与系统层影响重新连起来",
        ],
        "examples": [f"用一个最小 worked example 解释 {req['topic']} 的关键过程。"],
        "counterexamples": [f"{req['topic']} 不是只靠术语记忆就能掌握的主题。"],
        "pitfalls": [
            {
                "point": "把模块写成资料堆砌",
                "rootCause": "没有围绕焦点问题组织认知动作",
            }
        ],
        "narrative": [
            {"type": "text", "content": f"先用一个最小冲突把 {req['topic']} 的问题拎出来。"},
            {
                "type": "steps",
                "label": "最小机制链",
                "content": "",
                "steps": [
                    {
                        "title": "建立对象",
                        "description": "明确这一章操作的最小对象是什么",
                        "visual": "object boundary",
                        "highlight": "object",
                    },
                    {
                        "title": "追踪机制",
                        "description": "按因果顺序解释关键变化",
                        "visual": "mechanism trace",
                        "highlight": "trace",
                    },
                ],
            },
            {"type": "callout", "content": "如果一章不能被重建，它就还只是材料，不是课程。"},
        ],
        "visuals": [{"id": f"{req['module_id']}-draft-visual", "type": "stepSequence", "required": True}],
        "interactionRequirements": [{"capability": "trace", "purpose": "追踪关键机制", "priority": "core"}],
        "retrievalPrompts": [{"type": "rebuild-map", "prompt": f"请重建 {req['topic']} 这一章的核心机制链。"}],
        "bridgeTo": "下一章应该接着解释这个机制如何影响更大系统。",
        "nextModuleId": None,
    }


def module_composition_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    if "postgres" in topic:
        module = _load_postgresql_module(req["module_id"])
        if module is None:
            raise FileNotFoundError(f"Unknown PostgreSQL module: {req['module_id']}")
        return module
    return _generic_module_draft(req)


class AgentBackendHandler(BaseHTTPRequestHandler):
    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def log_message(self, format, *args):
        return

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send_json(health())
        if path == "/workflow":
            return self._send_json(workflow())
        return self._send_json({"error": f"Unknown route: {path}"}, status=404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._read_json()
            if path == "/topic-framing/dry-run":
                return self._send_json(topic_framing_dry_run(normalize_topic_request(payload)))
            if path == "/curriculum-planning/dry-run":
                return self._send_json(curriculum_planning_dry_run(normalize_topic_request(payload)))
            if path == "/draft-course-package/dry-run":
                return self._send_json(draft_course_package_dry_run(normalize_topic_request(payload)))
            if path == "/module-composition/dry-run":
                return self._send_json(module_composition_dry_run(normalize_module_request(payload)))
            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, status=400)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)


def serve() -> None:
    port = int(os.environ.get("AGENT_BACKEND_PORT", "8081"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AgentBackendHandler)
    print(f"agent-backend listening on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
