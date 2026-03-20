import re
from typing import Any


def _to_str_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _to_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False
    return default


def validate_topic_text(topic: str) -> str | None:
    """Validate topic text. Returns error message or None if valid."""
    if len(topic) < 2:
        return "主题太短，请输入至少 2 个字符"
    if len(topic) > 80:
        return "主题太长，请控制在 80 字符以内"
    # All punctuation/digits/whitespace
    if re.fullmatch(r"[\s\d\W]+", topic):
        return "请输入有效的学习主题"
    # Chat-like sentences (ends with 吗/呢/啊/？ and shorter than 15 chars)
    if len(topic) < 15 and re.search(r"[吗呢啊哦嘛？]$", topic):
        return "请输入一个知识主题，而不是一个问题"
    return None


def normalize_topic_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic = str(payload.get("topic") or "").strip()
    if not topic:
        raise ValueError("topic is required")
    return {
        "topic": topic,
        "audience": str(payload.get("audience") or "").strip() or None,
        "goals": _to_str_list(payload.get("goals")),
        "constraints": _to_str_list(payload.get("constraints")),
        "topic_type": str(payload.get("topic_type") or "").strip() or None,
    }


def normalize_module_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic_req = normalize_topic_request(payload)
    module_id = str(payload.get("module_id") or "").strip()
    if not module_id:
        raise ValueError("module_id is required")
    return {
        **topic_req,
        "module_id": module_id,
        "title": str(payload.get("title") or "").strip() or None,
        "module_kind": str(payload.get("module_kind") or "").strip() or None,
        "primary_cognitive_action": str(payload.get("primary_cognitive_action") or "").strip() or None,
        "focus_question": str(payload.get("focus_question") or "").strip() or None,
        "prerequisites": _to_str_list(payload.get("prerequisites")),
    }


def normalize_export_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic_req = normalize_topic_request(payload)
    return {
        **topic_req,
        "output_slug": str(payload.get("output_slug") or "").strip() or None,
        "output_root": str(payload.get("output_root") or "").strip() or None,
    }


def normalize_validate_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    return {
        "mode": str(payload.get("mode") or "repo").strip() or "repo",
        "package_dir": str(payload.get("package_dir") or "").strip() or None,
        "run_build": _to_bool(payload.get("run_build"), default=True),
    }


def normalize_promote_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    source_slug = str(payload.get("source_slug") or "").strip()
    if not source_slug:
        raise ValueError("source_slug is required")
    return {
        "source_slug": source_slug,
        "target_slug": str(payload.get("target_slug") or "").strip() or source_slug,
        "overwrite": _to_bool(payload.get("overwrite"), default=False),
    }


def normalize_job_create_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    topic_req = normalize_topic_request(payload)
    topic_error = validate_topic_text(topic_req["topic"])
    if topic_error:
        raise ValueError(topic_error)
    return {
        **topic_req,
        "output_slug": str(payload.get("output_slug") or "").strip() or None,
        "overwrite": _to_bool(payload.get("overwrite"), default=False),
        "background": str(payload.get("background") or "").strip() or None,
        "learning_style": _to_str_list(payload.get("learning_style")),
    }


def normalize_job_retry_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    stage = str(payload.get("stage") or "").strip() or None
    if stage and stage not in {"plan", "compose", "validate", "export"}:
        raise ValueError("stage must be one of: plan, compose, validate, export")
    return {"stage": stage}


def normalize_review_request(payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = payload or {}
    return {
        "approved": _to_bool(payload.get("approved"), default=False),
        "reviewed_by": str(payload.get("reviewed_by") or payload.get("reviewedBy") or "").strip() or None,
        "notes": str(payload.get("notes") or "").strip() or None,
    }
