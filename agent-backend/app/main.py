from __future__ import annotations

import hmac
import hashlib
import json
import os
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

MAX_REQUEST_BODY = 1 * 1024 * 1024  # 1 MB

try:
    from .common import (
        COURSES_ROOT as DEFAULT_COURSES_ROOT,
        GENERATED_ROOT as DEFAULT_GENERATED_ROOT,
        JOBS_ROOT as DEFAULT_JOBS_ROOT,
        REPO_ROOT as DEFAULT_REPO_ROOT,
        issue_messages,
        load_env_file,
        safe_job_id,
        safe_slug,
        validate_package_dir,
    )
    from .models import (
        normalize_job_create_request,
        normalize_generation_contract,
        normalize_job_retry_request,
        normalize_promote_request,
        normalize_review_request,
        normalize_validate_request,
    )
    from .pipeline import CourseGenerationPipeline, run_static_build
    from .provider import OpenAICompatibleClient, ProviderConfig, model_family
    from .workflow import WORKFLOW_V1, retry_policy
    from .clarification_store import get_store as get_clarification_store
    from .clarification_prompts import (
        build_clarification_system_prompt,
        build_clarification_user_prompt,
        build_contract_review_prompts,
    )
except ImportError:
    from common import (
        COURSES_ROOT as DEFAULT_COURSES_ROOT,
        GENERATED_ROOT as DEFAULT_GENERATED_ROOT,
        JOBS_ROOT as DEFAULT_JOBS_ROOT,
        REPO_ROOT as DEFAULT_REPO_ROOT,
        issue_messages,
        load_env_file,
        safe_job_id,
        safe_slug,
        validate_package_dir,
    )
    from models import (
        normalize_job_create_request,
        normalize_generation_contract,
        normalize_job_retry_request,
        normalize_promote_request,
        normalize_review_request,
        normalize_validate_request,
    )
    from pipeline import CourseGenerationPipeline, run_static_build
    from provider import OpenAICompatibleClient, ProviderConfig, model_family
    from workflow import WORKFLOW_V1, retry_policy
    from clarification_store import get_store as get_clarification_store
    from clarification_prompts import (
        build_clarification_system_prompt,
        build_clarification_user_prompt,
        build_contract_review_prompts,
    )

REPO_ROOT = DEFAULT_REPO_ROOT
COURSES_ROOT = DEFAULT_COURSES_ROOT
GENERATED_ROOT = DEFAULT_GENERATED_ROOT
JOBS_ROOT = DEFAULT_JOBS_ROOT

LEGACY_GENERATION_ENDPOINTS = {
    "/topic-framing/dry-run",
    "/topic-classification/dry-run",
    "/curriculum-planning/dry-run",
    "/draft-course-package/dry-run",
    "/module-composition/dry-run",
    "/export-course-package/dry-run",
    "/export-course-package/write",
}

AUTH_EXEMPT_POST_PATHS = {
    "/api/clarify/start",
    "/api/clarify/respond",
    "/jobs/course-generation",
    "/provider-config/verify",
    "/provider-config",
    "/provider-config/test",
}

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
PUBLIC_LEGACY_COURSES = {"llm-fundamentals", "postgresql-internals", "git-internals", "claude-code"}

load_env_file(REPO_ROOT / "agent-backend" / ".env")

# Module-level singleton -- one Pipeline, one thread pool, shared across all requests
_pipeline: CourseGenerationPipeline | None = None


def get_pipeline() -> CourseGenerationPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = CourseGenerationPipeline(
            provider_config=ProviderConfig.from_env(),
            jobs_root=JOBS_ROOT,
            generated_root=GENERATED_ROOT,
            repo_root=REPO_ROOT,
        )
        _pipeline.store.repair_interrupted_jobs()
        _pipeline.cleanup_stale_data()
        _pipeline.enqueue_pending_jobs()
    return _pipeline


def _unwrap_llm_json_content(response: dict) -> dict:
    """Support the current provider wrapper while keeping older test doubles usable."""
    if not isinstance(response, dict):
        return {}
    content = response.get("content")
    if isinstance(content, dict):
        return content
    return response


def _is_public_job_get(parts: list[str]) -> bool:
    return (len(parts) == 1 and parts[0] == "jobs") or (len(parts) == 2 and parts[0] == "jobs")


def _public_job_view(job: dict) -> dict:
    request = job.get("request") if isinstance(job.get("request"), dict) else None
    public_request = None
    if request is not None:
        public_request = {key: value for key, value in request.items() if not key.startswith("_")}

    stages = []
    for stage in job.get("stages") or []:
        if not isinstance(stage, dict):
            continue
        stages.append(
            {
                "name": stage.get("name"),
                "status": stage.get("status"),
                "summary": stage.get("summary"),
                "error": stage.get("error"),
            }
        )

    return {
        "id": job.get("id"),
        "status": job.get("status"),
        "currentStage": job.get("currentStage"),
        "request": public_request,
        "error": job.get("error"),
        "stages": stages,
        "resultSummary": job.get("resultSummary") or {},
        "createdAt": job.get("createdAt"),
        "updatedAt": job.get("updatedAt"),
    }


def _clarification_gate_question(error: str) -> str:
    if "problemFraming" in error:
        return (
            "我还不能稳定地整理成课程问题。先不用你补术语或框架，"
            "请只说一句：你最想弄明白的是这个概念为什么出现，还是它到底是什么意思？"
        )
    if "scope" in error:
        return "范围还不够清楚。为了让课程有取舍，这门课必须讲什么、明确不讲什么、讲到什么深度？"
    return "我还不能把它收束成课程契约。请用一句话说：你现在最卡住的是哪个词、哪条因果关系，还是哪个判断？"


_DIFFERENCE_MARKERS = (
    "相比", "不同", "差异", "反而", "却", "但是", "同样", "换到", "条件", "场景",
    "A", "B", "vs", "versus", "contrast", "whereas", "but",
)

_BEGINNER_UNCERTAINTY_MARKERS = (
    "不知道", "不了解", "不清楚", "没概念", "听不懂", "不懂", "是什么", "什么意思", "含义"
)


def _has_difference_signal(text: str) -> bool:
    return any(marker in text for marker in _DIFFERENCE_MARKERS)


def _history_shows_beginner_uncertainty(history: list[dict]) -> bool:
    return any(
        turn.get("role") == "user"
        and any(marker in str(turn.get("text") or "") for marker in _BEGINNER_UNCERTAINTY_MARKERS)
        for turn in history
    )


def _clarification_readiness_issue(contract: dict, history: list[dict]) -> str | None:
    bot_turns = len([turn for turn in history if turn.get("role") == "bot"])
    user_turns = len([turn for turn in history if turn.get("role") == "user"])
    if bot_turns < 3 or user_turns < 3:
        return "澄清轮次不足，至少需要 3 轮围绕差异现象的追问"

    framing = contract.get("problemFraming") or {}
    phenomenon = str(framing.get("phenomenon") or "").strip()
    contrast = str(framing.get("contrast") or "").strip()
    system_goal = str(framing.get("systemGoal") or "").strip()
    model_gap = str(framing.get("modelGap") or "").strip()
    driving_question = str(contract.get("drivingQuestion") or "").strip()

    if len(phenomenon) < 12:
        return "problemFraming.phenomenon 还不是具体现象"
    if len(contrast) < 12 or (not _has_difference_signal(contrast) and not _history_shows_beginner_uncertainty(history)):
        return "problemFraming.contrast 必须写出 A/B 差异、条件变化或直觉与现实冲突"
    if len(system_goal) < 12:
        return "problemFraming.systemGoal 还没有写出真实系统目标"
    if len(model_gap) < 12:
        return "problemFraming.modelGap 还没有写出缺少的对象、关系、条件或边界模型"
    if (
        driving_question.startswith(("如何学习", "如何理解", "什么是", "介绍", "学习"))
        and not _has_difference_signal(driving_question + contrast)
    ):
        return "drivingQuestion 仍然是泛化学习题目，不是面向差异现象的问题"
    return None


def _clarification_gate_followup(issue: str, topic: str, history: list[dict]) -> str:
    if _history_shows_beginner_uncertainty(history):
        return (
            f'没关系，这说明你现在是"对 {topic} 有好奇、但核心概念的来龙去脉还没立起来"的初学者位置。'
            '我先这样理解你的学习需求：从你已经听过但没串起来的关键词开始，解释它为什么会被提出、'
            '它要回应什么问题，以及后面的概念为什么会跟着出现。'
            '如果这个方向对，你直接回"对"；如果不对，只要说最想先弄懂的那个词。'
        )
    if "contrast" in issue:
        return (
            "我还缺一条能组织课程的主线。请不用写成 A/B，只说你的直觉和这个主题之间哪里对不上："
            "你原本以为它只是怎么回事，但它好像实际牵出了什么更大的问题？"
        )
    if "drivingQuestion" in issue:
        return '现在的问题还太像泛泛介绍。请说一句：学完这门课后，你最希望能解释哪个"为什么"？'
    if "systemGoal" in issue or "modelGap" in issue or "phenomenon" in issue:
        return "还差一点课程焦点。请说一句：你不是想背定义，而是想看懂这个主题背后的哪条关系或来龙去脉？"
    return (
        "还不能完成澄清。请补一句最朴素的困惑：你以为它应该很简单，但现在发现它复杂在哪里？"
    )


def _clarification_candidate_summary(contract: dict) -> str:
    framing = contract.get("problemFraming") or {}
    return "\n".join([
        "我整理出一版候选学习契约。",
        f"驱动问题：{contract['drivingQuestion']}",
        f"核心张力：{contract['centralTension']}",
        f"差异现象：{framing.get('phenomenon', '')}",
        f"对比关系：{framing.get('contrast', '')}",
        f"模型缺口：{framing.get('modelGap', '')}",
    ])


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



def handle_clarify_start(payload: dict) -> dict:
    """
    Start a new clarification dialogue.

    Expects: {topic: string}
    Returns: {conversationId: string, question: string}
    """
    topic = payload.get("topic", "").strip()
    if not topic or len(topic) < 2:
        raise ValueError("topic must be at least 2 characters")

    # Create conversation
    store = get_clarification_store()
    conversation_id = store.create_conversation(topic)

    # Generate first question using LLM
    try:
        pipeline = get_pipeline()
        client = pipeline.client

        system_prompt = build_clarification_system_prompt()
        user_prompt = build_clarification_user_prompt(topic, [])

        response = client.generate_json(
            schema_name="clarification_start",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=700,
            model=getattr(client.config, "clarify_model", None),
        )
        content = _unwrap_llm_json_content(response)

        question = str(content.get("question") or "").strip()
        if not question:
            raise ValueError("clarification model did not return a question")

        # Store bot question
        store.add_turn(conversation_id, "bot", question)

        return {
            "conversationId": conversation_id,
            "question": question,
            "roundNumber": 1
        }

    except Exception as e:
        import sys
        print(f"[clarify] start fallback: {e}", file=sys.stderr)
        return {
            "conversationId": conversation_id,
            "question": "",
            "roundNumber": 1,
            "fallback": True,
            "error": "AI clarification unavailable"
        }


def handle_clarify_respond(payload: dict) -> dict:
    """
    Respond to a clarification question.

    Expects: {conversationId: string, answer: string}
    Returns: {question: string, roundNumber: int}
          OR {complete: true, contract: {...}}
    """
    conversation_id = payload.get("conversationId", "").strip()
    answer = payload.get("answer", "").strip()

    if not conversation_id:
        raise ValueError("conversationId is required")
    if not answer or len(answer) < 2:
        raise ValueError("answer must be at least 2 characters")

    store = get_clarification_store()
    conv = store.get_conversation(conversation_id)
    if not conv:
        raise ValueError(f"Conversation {conversation_id} not found or expired")

    # Add user answer
    store.add_turn(conversation_id, "user", answer)

    # Get updated history
    conv = store.get_conversation(conversation_id)
    history = conv["history"]

    # Generate next question or synthesis using LLM
    try:
        pipeline = get_pipeline()
        client = pipeline.client

        system_prompt = build_clarification_system_prompt()
        user_prompt = build_clarification_user_prompt(conv["topic"], history)

        response = client.generate_json(
            schema_name="clarification_respond",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.7,
            max_tokens=1200,
            model=getattr(client.config, "clarify_model", None),
        )
        content = _unwrap_llm_json_content(response)

        # Check if complete
        if content.get("complete"):
            raw_contract = content.get("contract")
            if not isinstance(raw_contract, dict):
                raw_contract = {
                    "drivingQuestion": content.get("drivingQuestion", ""),
                    "centralTension": content.get("centralTension", ""),
                    "knowledgeType": content.get("knowledgeType", "conceptual"),
                    "audience": content.get("audience", ""),
                    "desiredOutcome": content.get("desiredOutcome", ""),
                    "scope": content.get("scope") or {},
                }
            try:
                contract = normalize_generation_contract({"topic": conv["topic"], "contract": raw_contract})
            except ValueError as exc:
                question = _clarification_gate_question(str(exc))
                next_round = len([t for t in history if t["role"] == "bot"]) + 1
                store.add_turn(conversation_id, "bot", question)
                return {
                    "question": question,
                    "roundNumber": next_round,
                    "needsMoreEvidence": True
                }

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
            store.add_turn(conversation_id, "bot", candidate_summary)

            return {
                "readyForConfirmation": True,
                "contract": contract,
                "drivingQuestion": contract["drivingQuestion"],
                "centralTension": contract["centralTension"],
                "knowledgeType": contract["knowledgeType"],
                "message": candidate_summary,
                "roundNumber": len([t for t in history if t["role"] == "bot"])
            }

        else:
            # Continue dialogue
            question = str(content.get("question") or "").strip()
            if not question:
                raise ValueError("clarification model did not return a question")

            next_round = len([t for t in history if t["role"] == "bot"]) + 1
            store.add_turn(conversation_id, "bot", question)

            return {
                "question": question,
                "roundNumber": next_round
            }

    except Exception as e:
        import sys
        print(f"[clarify] respond fallback: {e}", file=sys.stderr)
        round_num = len([t for t in history if t["role"] == "bot"])

        return {
            "question": "",
            "roundNumber": round_num + 1,
            "fallback": True,
            "error": "AI clarification unavailable"
        }


def health() -> dict:
    # Use live pipeline config if available, otherwise read fresh from env
    if _pipeline is not None:
        config = _pipeline.provider_config
    else:
        config = ProviderConfig.from_env()
    return {
        "ok": True,
        "service": "agent-backend",
        "mode": "job-first-course-generation",
        "jobs_root": str(JOBS_ROOT),
        "generated_root": str(GENERATED_ROOT),
        "provider": config.masked,
    }


def workflow() -> dict:
    return {
        "workflow": WORKFLOW_V1,
        "retry_policy": retry_policy(),
    }


def deprecated_generation_response(path: str) -> tuple[dict, int]:
    return (
        {
            "error": f"{path} is deprecated",
            "message": "Use POST /jobs/course-generation and poll GET /jobs/{id} instead.",
        },
        410,
    )


def _configured_cors_origins() -> list[str]:
    raw = os.environ.get("AGENT_CORS_ORIGIN") or os.environ.get("AGENT_CORS_ORIGINS") or DEFAULT_CORS_ORIGINS
    return [item.strip() for item in raw.split(",") if item.strip()]


def _expected_admin_token() -> str:
    return os.environ.get("AGENT_ADMIN_TOKEN", "")


def _allow_unauthenticated_admin() -> bool:
    return os.environ.get("AGENT_ALLOW_UNAUTHENTICATED", "").strip().lower() in {"1", "true", "yes", "on"}


def _extract_admin_token(headers) -> str:
    return (
        headers.get("X-Agent-Admin-Token", "")
        or headers.get("Authorization", "").removeprefix("Bearer ").strip()
    )


def list_courses() -> dict:
    courses = []
    filter_public_legacy = COURSES_ROOT == DEFAULT_COURSES_ROOT
    if COURSES_ROOT.is_dir():
        for entry in sorted(COURSES_ROOT.iterdir()):
            if not entry.is_dir():
                continue
            meta_path = entry / "course.json"
            if not meta_path.exists():
                meta_path = entry / "plan.json"
            if not meta_path.exists():
                continue
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            is_essay = (entry / "chapters").is_dir() and isinstance(meta.get("chapters"), list)
            if filter_public_legacy and not is_essay and entry.name not in PUBLIC_LEGACY_COURSES:
                continue
            if is_essay:
                count = len([x for x in meta.get("chapters", []) if isinstance(x, str)])
                kind = "essay"
            else:
                modules_dir = entry / "modules"
                count = len(list(modules_dir.glob("*.json"))) if modules_dir.is_dir() else 0
                kind = "legacy"
            courses.append({
                "slug": entry.name,
                "title": meta.get("title", entry.name),
                "topic": meta.get("topic", ""),
                "moduleCount": count,
                "chapterCount": count,
                "kind": kind,
            })
    return {"courses": courses}


def delete_course(slug: str) -> dict:
    slug = safe_slug(slug)
    course_dir = COURSES_ROOT / slug
    generated_dir = GENERATED_ROOT / slug
    if not course_dir.is_dir() and not generated_dir.is_dir():
        raise FileNotFoundError(f"Course not found: {slug}")
    title = ""
    topic = ""
    # Read metadata before deleting
    for meta_name in ("course.json", "plan.json"):
        meta_path = course_dir / meta_name
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            title = meta.get("title", "")
            topic = meta.get("topic", "")
            break
    course_backup = _move_dir_to_backup(course_dir, ".delete-old")
    generated_backup = _move_dir_to_backup(generated_dir, ".delete-old")
    try:
        build_result = _rebuild_static_site()
    except Exception:
        _restore_backup(course_dir, course_backup)
        _restore_backup(generated_dir, generated_backup)
        raise
    _discard_backup(course_backup)
    _discard_backup(generated_backup)
    return {"deleted": True, "slug": slug, "title": title, "topic": topic, "buildSkipped": bool(build_result.get("skipped"))}


def _move_dir_to_backup(path: Path, suffix: str) -> Path | None:
    if not path.is_dir():
        return None
    backup = path.with_name(path.name + suffix)
    if backup.exists():
        shutil.rmtree(backup)
    path.rename(backup)
    return backup


def _restore_backup(path: Path, backup: Path | None) -> None:
    if not backup or not backup.exists():
        return
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
    backup.rename(path)


def _discard_backup(backup: Path | None) -> None:
    if backup and backup.exists():
        shutil.rmtree(backup, ignore_errors=True)


def _rebuild_static_site() -> dict:
    """Run npm run build synchronously so file-system changes match static output."""
    return run_static_build(REPO_ROOT, log_prefix="[rebuild]")


def promote_dry_run(req: dict) -> dict:
    safe_slug(req["source_slug"], "source_slug")
    safe_slug(req["target_slug"], "target_slug")
    source_dir = GENERATED_ROOT / req["source_slug"]
    target_dir = COURSES_ROOT / req["target_slug"]
    validation = validate_package_dir(source_dir, repo_root=REPO_ROOT, require_review_approval=True)

    conflicts = {}
    if target_dir.exists():
        conflicts["target_exists"] = True
        conflicts["overwrite_required"] = True

    return {
        "source_slug": req["source_slug"],
        "target_slug": req["target_slug"],
        "source_valid": validation["ok"],
        "source_issues": issue_messages(validation),
        "content_issues": issue_messages(validation, category="content"),
        "scaffold_issues": issue_messages(validation, category="scaffold"),
        "review_issues": issue_messages(validation, category="review"),
        "warnings": issue_messages(validation, severity="warning"),
        "target_conflicts": conflicts,
        "summary": validation.get("summary"),
        "review_approval": validation.get("reviewApproval"),
        "promote_ready": validation.get("promoteReady", False),
        "publish_ready": validation.get("publishReady", False),
        "would_promote": validation.get("promoteReady", False) and (not conflicts or req.get("overwrite")),
    }


def promote_generated_course_package(req: dict) -> dict:
    safe_slug(req["source_slug"], "source_slug")
    safe_slug(req["target_slug"], "target_slug")
    source_dir = GENERATED_ROOT / req["source_slug"]
    target_dir = COURSES_ROOT / req["target_slug"]

    validation = validate_package_dir(source_dir, repo_root=REPO_ROOT, require_review_approval=True)
    if not validation.get("promoteReady"):
        raise ValueError(f"source package not promote-ready: {issue_messages(validation)}")

    if target_dir.exists():
        if not req.get("overwrite"):
            raise ValueError(f"target already exists: {target_dir}")

    tmp_dir = target_dir.with_name(target_dir.name + ".tmp")
    old_dir = target_dir.with_name(target_dir.name + ".old")
    old_dir_kept = False
    post_validation = None
    try:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
        if old_dir.exists():
            shutil.rmtree(old_dir)
        shutil.copytree(source_dir, tmp_dir)
        if target_dir.exists():
            target_dir.rename(old_dir)
            old_dir_kept = True
        tmp_dir.rename(target_dir)
        post_validation = validate_package_dir(target_dir, repo_root=REPO_ROOT, require_review_approval=True)
        if not post_validation.get("promoteReady"):
            raise ValueError(f"promoted package failed validation: {issue_messages(post_validation)}")
        build_result = _rebuild_static_site()
    except Exception:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir, ignore_errors=True)
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        if old_dir.exists():
            old_dir.rename(target_dir)
        raise
    if old_dir_kept and old_dir.exists():
        shutil.rmtree(old_dir, ignore_errors=True)
    return {
        "promoted": True,
        "source_dir": str(source_dir.resolve()),
        "target_dir": str(target_dir.resolve()),
        "module_count": validation["summary"]["moduleCount"] if validation.get("summary") else None,
        "module_ids": validation["summary"]["moduleIds"] if validation.get("summary") else [],
        "post_promote_valid": post_validation["ok"],
        "post_promote_ready": post_validation.get("promoteReady", False),
        "post_promote_issues": issue_messages(post_validation),
        "build_skipped": bool(build_result.get("skipped")),
    }


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
    if req["mode"] == "package":
        package_dir = Path(req.get("package_dir") or "")
        if not package_dir:
            raise ValueError("package_dir is required when mode=package")
        resolved = package_dir.resolve()
        if not (resolved.is_relative_to(COURSES_ROOT) or resolved.is_relative_to(GENERATED_ROOT)):
            raise ValueError("package_dir must be inside courses/ or generated/")
        return {
            "mode": "package",
            "result": validate_package_dir(package_dir, repo_root=REPO_ROOT),
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


def _verify_settings_password(password: str) -> tuple[bool, str]:
    """Verify the settings panel password. Returns (ok, error_message)."""
    expected = os.environ.get("AGENT_SETTINGS_PASSWORD", "")
    if not expected:
        return False, "settings panel disabled"
    if not hmac.compare_digest(password.encode(), expected.encode()):
        return False, "invalid password"
    return True, ""


def get_provider_config() -> dict:
    """Return masked provider config (no secrets)."""
    if _pipeline is not None:
        return _pipeline.provider_config.masked
    return ProviderConfig.from_env().masked


def update_provider_config(payload: dict) -> dict:
    """Update provider config at runtime. Returns new masked config."""
    # Build overrides from current runtime config + new values
    current_rt = ProviderConfig._load_runtime_overrides()

    for field in ("base_url", "model", "api_key", "fallback_model"):
        value = payload.get(field, "")
        if value:  # empty string = don't change
            current_rt[field] = value

    # Optional per-stage overrides: empty string explicitly clears the override
    for field in ("research_model", "judge_model", "clarify_model"):
        if field in payload:
            value = str(payload.get(field) or "").strip()
            if value:
                current_rt[field] = value
            else:
                current_rt.pop(field, None)

    ProviderConfig.save_runtime_config(current_rt)

    # Rebuild config and hot-swap on the pipeline
    new_config = ProviderConfig.from_env()
    if _pipeline is not None:
        with _pipeline._lock:
            _pipeline.provider_config = new_config
            _pipeline.client = OpenAICompatibleClient(new_config)

    return new_config.masked


def test_provider_connection() -> dict:
    """Send a realistic request to verify the model can generate structured Chinese JSON."""
    config = ProviderConfig.from_env()
    client = OpenAICompatibleClient(config)
    t0 = time.monotonic()
    try:
        response = client.generate_json(
            schema_name="connection_test",
            system_prompt=(
                "你是课程生成引擎。输出一个包含以下字段的 JSON：\n"
                '{"title": "一句话标题", "focusQuestion": "一个尖锐的问题？", '
                '"concepts": [{"name": "概念A", "note": "为什么重要"}, {"name": "概念B", "note": "为什么重要"}], '
                '"logicChain": ["步骤1导致步骤2", "步骤2导致步骤3"]}\n'
                "主题：缓存系统。内容必须具体，不能用占位符。"
            ),
            user_prompt="生成上述 JSON。",
            temperature=0.2,
            max_tokens=500,
        )
        latency_ms = round((time.monotonic() - t0) * 1000)
        content = response.get("content", {})
        has_required = (
            isinstance(content, dict)
            and bool(content.get("title"))
            and bool(content.get("focusQuestion"))
            and isinstance(content.get("concepts"), list)
            and len(content.get("concepts", [])) >= 2
        )
        return {
            "ok": True,
            "latency_ms": latency_ms,
            "model": response.get("model", config.model),
            "json_ok": isinstance(content, dict),
            "quality_ok": has_required,
        }
    except Exception as exc:
        latency_ms = round((time.monotonic() - t0) * 1000)
        return {
            "ok": False,
            "error": str(exc),
            "latency_ms": latency_ms,
        }


class AgentBackendHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self) -> None:
        origins = _configured_cors_origins()
        request_origin = self.headers.get("Origin")
        if "*" in origins:
            self.send_header("Access-Control-Allow-Origin", "*")
        elif request_origin and request_origin in origins:
            self.send_header("Access-Control-Allow-Origin", request_origin)
            self.send_header("Vary", "Origin")
        elif origins:
            self.send_header("Access-Control-Allow-Origin", origins[0])
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Admin-Token")

    def _send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_REQUEST_BODY:
            raise ValueError(f"request body too large ({length} bytes, max {MAX_REQUEST_BODY})")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def _require_admin(self, payload: dict) -> None:
        expected = _expected_admin_token()
        if not expected:
            if _allow_unauthenticated_admin():
                return
            raise PermissionError("admin token is not configured")

        supplied = _extract_admin_token(self.headers)
        if not supplied or not hmac.compare_digest(supplied.encode(), expected.encode()):
            raise PermissionError("admin token required")

    def _request_identity(self) -> str:
        supplied = _extract_admin_token(self.headers)
        if supplied:
            digest = hashlib.sha256(supplied.encode("utf-8")).hexdigest()[:16]
            return f"admin:{digest}"
        return f"client:{self.client_address[0]}"

    def log_message(self, fmt, *args):
        import sys
        sys.stderr.write(f"[agent-backend] {self.client_address[0]} - {fmt % args}\n")
        sys.stderr.flush()

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == "/health":
                return self._send_json(health())
            if path == "/workflow":
                return self._send_json(workflow())
            if path == "/courses":
                return self._send_json(list_courses())
            if path == "/provider-config":
                return self._send_json(get_provider_config())

            parts = [part for part in path.split("/") if part]
            if parts and parts[0] == "jobs" and not _is_public_job_get(parts):
                self._require_admin({})

            pipeline = get_pipeline()
            if len(parts) == 1 and parts[0] == "jobs":
                jobs = pipeline.store.list_jobs()
                jobs.sort(key=lambda j: j.get("createdAt", ""), reverse=True)
                return self._send_json({"jobs": [_public_job_view(job) for job in jobs]})
            if len(parts) == 2 and parts[0] == "jobs":
                return self._send_json(_public_job_view(pipeline.get_job(safe_job_id(parts[1]))))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "artifacts":
                job_id = safe_job_id(parts[1])
                return self._send_json({"job_id": job_id, "artifacts": pipeline.get_artifacts(job_id)})
            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except PermissionError as exc:
            return self._send_json({"error": str(exc)}, status=401)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._read_json()

            if path in LEGACY_GENERATION_ENDPOINTS:
                body, status = deprecated_generation_response(path)
                return self._send_json(body, status=status)

            if path not in AUTH_EXEMPT_POST_PATHS:
                self._require_admin(payload)

            if path == "/provider-config/verify":
                ok, err = _verify_settings_password(payload.get("password", ""))
                if ok:
                    return self._send_json({"ok": True})
                return self._send_json({"ok": False, "error": err}, status=400)

            if path == "/provider-config":
                ok, err = _verify_settings_password(payload.get("password", ""))
                if not ok:
                    return self._send_json({"ok": False, "error": err}, status=400)
                result = update_provider_config(payload)
                return self._send_json(result)

            if path == "/provider-config/test":
                ok, err = _verify_settings_password(payload.get("password", ""))
                if not ok:
                    return self._send_json({"ok": False, "error": err}, status=400)
                return self._send_json(test_provider_connection())

            if path == "/api/clarify/start":
                return self._send_json(handle_clarify_start(payload))

            if path == "/api/clarify/respond":
                return self._send_json(handle_clarify_respond(payload))

            if path == "/jobs/course-generation":
                pipeline = get_pipeline()
                request_payload = normalize_job_create_request(payload)
                request_payload["_request_identity"] = self._request_identity()
                return self._send_json(_public_job_view(pipeline.create_job(request_payload)), status=202)

            if path == "/validate-build/dry-run":
                return self._send_json(validate_build_dry_run(normalize_validate_request(payload)))

            if path == "/promote-course-package/dry-run":
                return self._send_json(promote_dry_run(normalize_promote_request(payload)))

            if path == "/promote-course-package/write":
                return self._send_json(promote_generated_course_package(normalize_promote_request(payload)))

            parts = [part for part in path.split("/") if part]
            if len(parts) == 3 and parts[0] == "courses" and parts[2] == "delete":
                return self._send_json(delete_course(safe_slug(parts[1])))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "cancel":
                pipeline = get_pipeline()
                return self._send_json(pipeline.cancel_job(safe_job_id(parts[1])))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "delete":
                pipeline = get_pipeline()
                return self._send_json(pipeline.delete_job(safe_job_id(parts[1])))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "retry":
                pipeline = get_pipeline()
                return self._send_json(pipeline.retry_job(safe_job_id(parts[1]), **normalize_job_retry_request(payload)), status=202)
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "review":
                pipeline = get_pipeline()
                return self._send_json(pipeline.review_job(safe_job_id(parts[1]), **normalize_review_request(payload)))

            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except ValueError as exc:
            return self._send_json({"error": str(exc)}, status=400)
        except PermissionError as exc:
            return self._send_json({"error": str(exc)}, status=401)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except subprocess.TimeoutExpired as exc:
            return self._send_json({"error": f"timeout: {exc.cmd}"}, status=504)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)


def serve() -> None:
    port = int(os.environ.get("AGENT_BACKEND_PORT", "8081"))
    host = os.environ.get("AGENT_BACKEND_HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), AgentBackendHandler)
    print(f"agent-backend listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
