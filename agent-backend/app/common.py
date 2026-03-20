from __future__ import annotations

import json
import hashlib
import os
import re
import subprocess
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
COURSES_ROOT = REPO_ROOT / "courses"
GENERATED_ROOT = REPO_ROOT / "agent-backend" / "generated"
JOBS_ROOT = REPO_ROOT / "agent-backend" / "jobs"
DESIGN_PATH = REPO_ROOT / "DESIGN.md"
NARRATIVE_BLOCK_SPEC_PATH = REPO_ROOT / "src" / "data" / "narrative-block-spec.json"
MODULE_REGISTRY_PATH = REPO_ROOT / "src" / "lib" / "module-registry.ts"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(text: str) -> str:
    original = text
    # Full-width → half-width, decompose accented chars
    text = unicodedata.normalize("NFKD", text)
    # Drop anything that isn't ASCII
    text = text.encode("ascii", "ignore").decode("ascii")
    # Only keep alphanumeric, replace everything else with space
    text = re.sub(r"[^a-z0-9]+", " ", text.lower())
    slug = "-".join(text.split())
    if not slug:
        # Pure non-ASCII input (CJK etc.) — use a short hash
        slug = "course-" + hashlib.md5(original.strip().encode("utf-8")).hexdigest()[:8]
    return slug


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return read_json(path)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    temp_path.replace(path)


def write_json_atomic(path: Path, payload: dict[str, Any] | list[Any]) -> None:
    write_text_atomic(path, json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def issue_messages(validation: dict[str, Any], category: str | None = None, severity: str = "error") -> list[str]:
    if category is None:
        return [issue.get("message", "") for issue in validation.get(f"{severity}s", []) if issue.get("message")]
    bucket = validation.get("issuesByCategory", {}).get(category, {})
    return [issue.get("message", "") for issue in bucket.get(f"{severity}s", []) if issue.get("message")]


def validate_package_dir(
    package_dir: Path,
    *,
    repo_root: Path = REPO_ROOT,
    require_review_approval: bool = False,
) -> dict[str, Any]:
    command = [
        "node",
        "scripts/validate-course-package.mjs",
        "--dir",
        str(package_dir),
        "--json",
    ]
    if require_review_approval:
        command.append("--require-review-approval")

    completed = subprocess.run(
        command,
        cwd=repo_root,
        capture_output=True,
        text=True,
        timeout=120,
    )

    stdout = (completed.stdout or "").strip()
    stderr = (completed.stderr or "").strip()
    parsed = None

    if stdout:
        try:
            parsed = json.loads(stdout)
        except json.JSONDecodeError:
            parsed = None

    if parsed is None:
        error_message = stderr or stdout or f"validator exited with code {completed.returncode}"
        return {
            "ok": False,
            "promoteReady": False,
            "publishReady": False,
            "errors": [
                {
                    "category": "structure",
                    "severity": "error",
                    "message": error_message,
                }
            ],
            "warnings": [],
            "issuesByCategory": {
                "structure": {
                    "errors": [
                        {
                            "category": "structure",
                            "severity": "error",
                            "message": error_message,
                        }
                    ],
                    "warnings": [],
                },
                "content": {"errors": [], "warnings": []},
                "registry": {"errors": [], "warnings": []},
                "scaffold": {"errors": [], "warnings": []},
                "review": {"errors": [], "warnings": []},
            },
            "summary": None,
            "reviewApproval": {
                "exists": False,
                "approved": False,
                "reviewedBy": None,
                "reviewedAt": None,
                "notes": None,
            },
        }

    return parsed


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())
