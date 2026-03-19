import json
import os
import subprocess
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

try:
    from .models import (
        normalize_export_request,
        normalize_module_request,
        normalize_topic_request,
        normalize_validate_request,
    )
    from .workflow import WORKFLOW_V1, retry_policy
except ImportError:
    from models import (
        normalize_export_request,
        normalize_module_request,
        normalize_topic_request,
        normalize_validate_request,
    )
    from workflow import WORKFLOW_V1, retry_policy

REPO_ROOT = Path(__file__).resolve().parents[2]
COURSES_ROOT = REPO_ROOT / "courses"
POSTGRESQL_ROOT = COURSES_ROOT / "postgresql-internals"
POSTGRESQL_MODULES_DIR = POSTGRESQL_ROOT / "modules"
GENERATED_ROOT = REPO_ROOT / "agent-backend" / "generated"


def _slugify(text: str) -> str:
    return "-".join(text.strip().lower().replace("/", " ").replace("_", " ").split())


def _default_audience(req: dict) -> str:
    return req.get("audience") or "想系统理解复杂主题的中文学习者"


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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
    return _read_json(module_path)


def _load_postgresql_course_package() -> dict:
    modules = []
    for module_id in _read_json(POSTGRESQL_ROOT / "course.json")["moduleGraph"]["order"]:
        modules.append(_load_postgresql_module(module_id))
    return {
        "course": _read_json(POSTGRESQL_ROOT / "course.json"),
        "modules": modules,
        "concept_maps": _read_json(POSTGRESQL_ROOT / "visuals" / "concept-maps.json"),
        "interaction_registry": _read_json(POSTGRESQL_ROOT / "interactions" / "registry.json"),
    }


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
        "id": _slugify(req["topic"]),
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
        "number": None,
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


def _build_generic_course_package(req: dict) -> dict:
    framing = topic_framing_dry_run(req)
    plan = curriculum_planning_dry_run(req)
    order = plan["module_ids"]
    modules = []
    for index, planned in enumerate(plan["modules"], start=1):
        module = module_composition_dry_run(
            {
                "topic": req["topic"],
                "audience": req.get("audience"),
                "goals": req.get("goals", []),
                "constraints": req.get("constraints", []),
                "module_id": planned["id"],
                "title": planned.get("title"),
                "module_kind": planned.get("module_kind"),
                "primary_cognitive_action": planned.get("primary_cognitive_action"),
                "focus_question": planned.get("focus_question"),
                "prerequisites": planned.get("prerequisites", []),
            }
        )
        module["number"] = index
        module["nextModuleId"] = order[index] if index < len(order) else None
        modules.append(module)

    slug = _slugify(req["topic"])
    concept_maps = {
        module["id"]: {
            "type": (module.get("visuals") or [{"type": "stepSequence"}])[0].get("type", "stepSequence"),
            "title": module["title"],
        }
        for module in modules
    }
    interaction_registry = {
        module["id"]: {
            "heroInteractive": (module.get("interactionRequirements") or [{"capability": "trace", "purpose": "追踪关键机制", "priority": "core"}])[0]
        }
        for module in modules
    }
    edges = []
    for module in modules:
        for prerequisite in module.get("priorKnowledge", []):
            edges.append(
                {
                    "from": prerequisite,
                    "to": module["id"],
                    "type": "prerequisite",
                    "note": f"{prerequisite} -> {module['id']}",
                }
            )
    course = {
        "id": slug,
        "slug": slug,
        "title": req["topic"],
        "subtitle": f"由 agent-backend 导出的 {req['topic']} 课程包",
        "goal": framing["learning_goals"][0] if framing["learning_goals"] else f"建立对 {req['topic']} 的结构化理解",
        "projectType": "mixed",
        "startDate": date.today().isoformat(),
        "topic": slug,
        "language": "zh",
        "status": "draft",
        "categories": [{"id": "generated", "name": "生成课程", "color": "slate"}],
        "audience": {
            "primaryAudience": framing["audience"],
            "priorKnowledge": [],
            "desiredOutcome": framing["scope_statement"],
        },
        "learningGoals": framing["learning_goals"],
        "nonGoals": framing["non_goals"],
        "assumptions": framing["assumptions"],
        "philosophy": {
            "promise": framing["scope_statement"],
            "corePrinciples": [
                "先组织认知动作，再组织文本材料",
                "先输出结构化对象，再考虑最终渲染",
                "每个阶段都允许失败重试",
            ],
            "shiftStatement": f"从零散理解升级为对 {req['topic']} 的结构化掌握。",
        },
        "paths": [
            {
                "id": "core-path",
                "title": "核心路径",
                "description": f"围绕 {req['topic']} 的最小学习闭环",
                "moduleIds": order,
            }
        ],
        "moduleGraph": {"order": order, "edges": edges},
        "modules": order,
    }
    return {
        "course": course,
        "modules": modules,
        "concept_maps": concept_maps,
        "interaction_registry": interaction_registry,
    }


def export_course_package_dry_run(req: dict) -> dict:
    topic = req["topic"].lower()
    output_slug = req.get("output_slug") or _slugify(req["topic"])
    if "postgres" in topic:
        package = _load_postgresql_course_package()
    else:
        package = _build_generic_course_package(req)
    return {
        "output_slug": output_slug,
        "target_dir": str((GENERATED_ROOT / output_slug).resolve()),
        "files": [
            "course.json",
            "modules/*.json",
            "visuals/concept-maps.json",
            "interactions/registry.json",
        ],
        "module_count": len(package["modules"]),
        "module_ids": [m["id"] for m in package["modules"]],
        "course_title": package["course"]["title"],
    }


def export_course_package_write(req: dict) -> dict:
    topic = req["topic"].lower()
    output_slug = req.get("output_slug") or _slugify(req["topic"])
    output_root = Path(req.get("output_root") or GENERATED_ROOT)
    output_dir = output_root / output_slug
    if "postgres" in topic:
        package = _load_postgresql_course_package()
    else:
        package = _build_generic_course_package(req)

    _write_json(output_dir / "course.json", package["course"])
    for module in package["modules"]:
        _write_json(output_dir / "modules" / f"{module['id']}.json", module)
    _write_json(output_dir / "visuals" / "concept-maps.json", package["concept_maps"])
    _write_json(output_dir / "interactions" / "registry.json", package["interaction_registry"])
    return {
        "written": True,
        "output_dir": str(output_dir.resolve()),
        "module_count": len(package["modules"]),
        "module_ids": [m["id"] for m in package["modules"]],
    }


def _validate_package_dir(package_dir: Path) -> dict:
    required_files = [
        package_dir / "course.json",
        package_dir / "visuals" / "concept-maps.json",
        package_dir / "interactions" / "registry.json",
    ]
    missing = [str(path) for path in required_files if not path.exists()]
    modules_dir = package_dir / "modules"
    module_files = sorted([p.name for p in modules_dir.glob("s*.json")]) if modules_dir.exists() else []
    if not module_files:
        missing.append(str(modules_dir / "s*.json"))
    ok = not missing
    summary = None
    if ok:
        course = _read_json(package_dir / "course.json")
        summary = {
            "course_id": course.get("id"),
            "module_count": len(module_files),
            "module_ids": course.get("modules", []),
        }
    return {"ok": ok, "missing": missing, "summary": summary}


def _run_command(command: list[str], cwd: Path, timeout: int = 1200) -> dict:
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    return {
        "command": " ".join(command),
        "returncode": completed.returncode,
        "stdout": completed.stdout[-8000:],
        "stderr": completed.stderr[-8000:],
        "ok": completed.returncode == 0,
    }


def validate_build_dry_run(req: dict) -> dict:
    mode = req["mode"]
    if mode == "package":
        package_dir = Path(req.get("package_dir") or "")
        if not package_dir:
            raise ValueError("package_dir is required when mode=package")
        return {
            "mode": "package",
            "result": _validate_package_dir(package_dir),
        }

    check_result = _run_command(["npm", "run", "check"], REPO_ROOT)
    build_result = _run_command(["npm", "run", "build"], REPO_ROOT) if req.get("run_build", True) else None
    ok = check_result["ok"] and (build_result is None or build_result["ok"])
    return {
        "mode": "repo",
        "ok": ok,
        "check": check_result,
        "build": build_result,
    }


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
            if path == "/export-course-package/dry-run":
                return self._send_json(export_course_package_dry_run(normalize_export_request(payload)))
            if path == "/export-course-package/write":
                return self._send_json(export_course_package_write(normalize_export_request(payload)))
            if path == "/validate-build/dry-run":
                return self._send_json(validate_build_dry_run(normalize_validate_request(payload)))
            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, status=400)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except subprocess.TimeoutExpired as exc:
            return self._send_json({"error": f"timeout: {exc.cmd}"}, status=504)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)


def serve() -> None:
    port = int(os.environ.get("AGENT_BACKEND_PORT", "8081"))
    server = ThreadingHTTPServer(("127.0.0.1", port), AgentBackendHandler)
    print(f"agent-backend listening on http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
