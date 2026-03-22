from __future__ import annotations

import hmac
import json
import os
import re
import shutil
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,78}[a-z0-9]$|^[a-z0-9]$")
MAX_REQUEST_BODY = 1 * 1024 * 1024  # 1 MB


def _safe_slug(slug: str, label: str = "slug") -> str:
    """Validate slug is safe for path construction. Raises ValueError."""
    if not _SLUG_RE.match(slug):
        raise ValueError(f"invalid {label}: {slug!r}")
    return slug

try:
    from .common import (
        COURSES_ROOT as DEFAULT_COURSES_ROOT,
        GENERATED_ROOT as DEFAULT_GENERATED_ROOT,
        JOBS_ROOT as DEFAULT_JOBS_ROOT,
        REPO_ROOT as DEFAULT_REPO_ROOT,
        issue_messages,
        load_env_file,
        validate_package_dir,
    )
    from .models import (
        normalize_job_create_request,
        normalize_job_retry_request,
        normalize_promote_request,
        normalize_review_request,
        normalize_validate_request,
    )
    from .pipeline import CourseGenerationPipeline
    from .provider import OpenAICompatibleClient, ProviderConfig
    from .workflow import WORKFLOW_V1, retry_policy
except ImportError:
    from common import (
        COURSES_ROOT as DEFAULT_COURSES_ROOT,
        GENERATED_ROOT as DEFAULT_GENERATED_ROOT,
        JOBS_ROOT as DEFAULT_JOBS_ROOT,
        REPO_ROOT as DEFAULT_REPO_ROOT,
        issue_messages,
        load_env_file,
        validate_package_dir,
    )
    from models import (
        normalize_job_create_request,
        normalize_job_retry_request,
        normalize_promote_request,
        normalize_review_request,
        normalize_validate_request,
    )
    from pipeline import CourseGenerationPipeline
    from provider import OpenAICompatibleClient, ProviderConfig
    from workflow import WORKFLOW_V1, retry_policy

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

load_env_file(REPO_ROOT / "agent-backend" / ".env")

# Module-level singleton — one Pipeline, one thread pool, shared across all requests
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


def list_courses() -> dict:
    courses = []
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
            modules_dir = entry / "modules"
            module_count = len(list(modules_dir.glob("*.json"))) if modules_dir.is_dir() else 0
            courses.append({
                "slug": entry.name,
                "title": meta.get("title", entry.name),
                "topic": meta.get("topic", ""),
                "moduleCount": module_count,
            })
    return {"courses": courses}


def delete_course(slug: str) -> dict:
    _safe_slug(slug)
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
    if course_dir.is_dir():
        shutil.rmtree(course_dir)
    if generated_dir.is_dir():
        shutil.rmtree(generated_dir)
    _rebuild_static_site()
    return {"deleted": True, "slug": slug, "title": title, "topic": topic}


def _rebuild_static_site() -> None:
    """Run npm run build in background to regenerate static pages."""
    import sys, threading

    # Import the shared build lock from pipeline to prevent concurrent builds
    try:
        from pipeline import _build_lock
    except ImportError:
        from .pipeline import _build_lock

    def _build():
        if not _build_lock.acquire(timeout=0):
            print("[rebuild] Build already in progress, skipping", file=sys.stderr)
            return
        try:
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=REPO_ROOT,
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode != 0:
                print(f"[rebuild] Build failed: {result.stderr[-500:]}", file=sys.stderr)
            else:
                print("[rebuild] Build completed", file=sys.stderr)
        except Exception as exc:
            print(f"[rebuild] Build error: {exc}", file=sys.stderr)
        finally:
            _build_lock.release()
            print(f"[rebuild] Build error: {exc}", file=sys.stderr)

    threading.Thread(target=_build, daemon=True).start()


def promote_dry_run(req: dict) -> dict:
    _safe_slug(req["source_slug"], "source_slug")
    _safe_slug(req["target_slug"], "target_slug")
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
    _safe_slug(req["source_slug"], "source_slug")
    _safe_slug(req["target_slug"], "target_slug")
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
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    if old_dir.exists():
        shutil.rmtree(old_dir)
    shutil.copytree(source_dir, tmp_dir)
    if target_dir.exists():
        target_dir.rename(old_dir)
    tmp_dir.rename(target_dir)
    if old_dir.exists():
        shutil.rmtree(old_dir, ignore_errors=True)
    post_validation = validate_package_dir(target_dir, repo_root=REPO_ROOT, require_review_approval=True)
    return {
        "promoted": True,
        "source_dir": str(source_dir.resolve()),
        "target_dir": str(target_dir.resolve()),
        "module_count": validation["summary"]["moduleCount"] if validation.get("summary") else None,
        "module_ids": validation["summary"]["moduleIds"] if validation.get("summary") else [],
        "post_promote_valid": post_validation["ok"],
        "post_promote_ready": post_validation.get("promoteReady", False),
        "post_promote_issues": issue_messages(post_validation),
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

    ProviderConfig.save_runtime_config(current_rt)

    # Rebuild config and hot-swap on the pipeline
    new_config = ProviderConfig.from_env()
    if _pipeline is not None:
        with _pipeline._lock:
            _pipeline.provider_config = new_config
            _pipeline.client = OpenAICompatibleClient(new_config)

    return new_config.masked


def test_provider_connection() -> dict:
    """Send a minimal request to verify provider connectivity, model, and JSON support."""
    config = ProviderConfig.from_env()
    client = OpenAICompatibleClient(config)
    t0 = time.monotonic()
    try:
        response = client.generate_json(
            schema_name="connection_test",
            system_prompt='Reply with exactly: {"ok": true}',
            user_prompt="ping",
            temperature=0,
            max_tokens=20,
        )
        latency_ms = round((time.monotonic() - t0) * 1000)
        return {
            "ok": True,
            "latency_ms": latency_ms,
            "model": response.get("model", config.model),
            "json_ok": isinstance(response.get("content"), dict),
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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

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

            pipeline = get_pipeline()
            parts = [part for part in path.split("/") if part]
            if len(parts) == 1 and parts[0] == "jobs":
                jobs = pipeline.store.list_jobs()
                jobs.sort(key=lambda j: j.get("createdAt", ""), reverse=True)
                return self._send_json({"jobs": jobs})
            if len(parts) == 2 and parts[0] == "jobs":
                return self._send_json(pipeline.get_job(parts[1]))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "artifacts":
                return self._send_json({"job_id": parts[1], "artifacts": pipeline.get_artifacts(parts[1])})
            return self._send_json({"error": f"Unknown route: {path}"}, status=404)
        except FileNotFoundError as exc:
            return self._send_json({"error": str(exc)}, status=404)
        except Exception as exc:
            return self._send_json({"error": f"internal_error: {exc}"}, status=500)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._read_json()

            if path in LEGACY_GENERATION_ENDPOINTS:
                body, status = deprecated_generation_response(path)
                return self._send_json(body, status=status)

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

            if path == "/jobs/course-generation":
                pipeline = get_pipeline()
                return self._send_json(pipeline.create_job(normalize_job_create_request(payload)), status=202)

            if path == "/validate-build/dry-run":
                return self._send_json(validate_build_dry_run(normalize_validate_request(payload)))

            if path == "/promote-course-package/dry-run":
                return self._send_json(promote_dry_run(normalize_promote_request(payload)))

            if path == "/promote-course-package/write":
                return self._send_json(promote_generated_course_package(normalize_promote_request(payload)))

            parts = [part for part in path.split("/") if part]
            if len(parts) == 3 and parts[0] == "courses" and parts[2] == "delete":
                return self._send_json(delete_course(_safe_slug(parts[1])))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "cancel":
                pipeline = get_pipeline()
                return self._send_json(pipeline.cancel_job(parts[1]))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "delete":
                pipeline = get_pipeline()
                return self._send_json(pipeline.delete_job(parts[1]))
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "retry":
                pipeline = get_pipeline()
                return self._send_json(pipeline.retry_job(parts[1], **normalize_job_retry_request(payload)), status=202)
            if len(parts) == 3 and parts[0] == "jobs" and parts[2] == "review":
                pipeline = get_pipeline()
                return self._send_json(pipeline.review_job(parts[1], **normalize_review_request(payload)))

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
    host = os.environ.get("AGENT_BACKEND_HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), AgentBackendHandler)
    print(f"agent-backend listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()
