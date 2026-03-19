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
