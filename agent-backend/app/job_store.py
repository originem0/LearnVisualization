from __future__ import annotations

import os
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

try:
    from .common import ensure_dir, now_iso, read_json, safe_job_id, write_json_atomic, write_text_atomic
except ImportError:
    from common import ensure_dir, now_iso, read_json, safe_job_id, write_json_atomic, write_text_atomic

PIPELINE_STAGES = ["research", "plan", "compose", "verify", "validate", "export"]


class JobStore:
    def __init__(self, root: Path) -> None:
        self.root = ensure_dir(root)

    def create_job(self, request_payload: dict[str, Any], *, provider: dict[str, Any], prompt_version: str) -> dict[str, Any]:
        job_id = uuid.uuid4().hex[:12]
        job = {
            "id": job_id,
            "status": "queued",
            "currentStage": None,
            "request": request_payload,
            "provider": provider,
            "promptVersion": prompt_version,
            "resultSummary": {},
            "error": None,
            "artifacts": {},
            "review": {
                "status": "pending",
                "approved": False,
                "reviewedBy": None,
                "reviewedAt": None,
                "notes": None,
            },
            "stages": [
                {
                    "name": name,
                    "status": "pending",
                    "retryCount": 0,
                    "startedAt": None,
                    "finishedAt": None,
                    "summary": None,
                    "artifactPath": None,
                    "error": None,
                }
                for name in PIPELINE_STAGES
            ],
            "createdAt": now_iso(),
            "updatedAt": now_iso(),
        }
        ensure_dir(self.job_dir(job_id))
        ensure_dir(self.job_dir(job_id) / "stages")
        ensure_dir(self.job_dir(job_id) / "reports")
        ensure_dir(self.job_dir(job_id) / "logs")
        write_json_atomic(self.job_file(job_id), job)
        return job

    def load_job(self, job_id: str) -> dict[str, Any]:
        return read_json(self.job_file(job_id))

    def write_job(self, job: dict[str, Any]) -> dict[str, Any]:
        job["updatedAt"] = now_iso()
        write_json_atomic(self.job_file(job["id"]), job)
        return job

    def job_dir(self, job_id: str) -> Path:
        return self.root / safe_job_id(job_id)

    def job_file(self, job_id: str) -> Path:
        return self.job_dir(job_id) / "job.json"

    def stage_artifact_path(self, job_id: str, stage: str) -> Path:
        return self.job_dir(job_id) / "stages" / f"{stage}.json"

    def report_path(self, job_id: str, name: str) -> Path:
        return self.job_dir(job_id) / "reports" / f"{name}.json"

    def log_path(self, job_id: str, stage: str) -> Path:
        return self.job_dir(job_id) / "logs" / f"{stage}.log"

    def write_log(self, job_id: str, stage: str, content: str) -> Path:
        path = self.log_path(job_id, stage)
        write_text_atomic(path, content)
        return path

    def store_stage_artifact(self, job_id: str, stage: str, payload: dict[str, Any] | list[Any]) -> Path:
        path = self.stage_artifact_path(job_id, stage)
        write_json_atomic(path, payload)
        return path

    def mark_stage_running(self, job_id: str, stage: str) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "running"
            job["currentStage"] = stage
            job["error"] = None
            stage_state = self._find_stage(job, stage)
            stage_state["status"] = "running"
            stage_state["startedAt"] = now_iso()
            stage_state["finishedAt"] = None
            stage_state["error"] = None
            return self.write_job(job)

    def mark_stage_success(
        self,
        job_id: str,
        stage: str,
        *,
        artifact_path: Path | None = None,
        summary: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            stage_state = self._find_stage(job, stage)
            stage_state["status"] = "succeeded"
            stage_state["finishedAt"] = now_iso()
            stage_state["summary"] = summary
            stage_state["artifactPath"] = str(artifact_path) if artifact_path else None
            stage_state["error"] = None
            if artifact_path:
                job["artifacts"][stage] = str(artifact_path)
            return self.write_job(job)

    def mark_stage_failed(self, job_id: str, stage: str, error_message: str, *, kind: str = "other") -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "failed"
            job["currentStage"] = stage
            job["error"] = {"stage": stage, "message": error_message, "kind": kind, "failedAt": now_iso()}
            stage_state = self._find_stage(job, stage)
            stage_state["status"] = "failed"
            stage_state["finishedAt"] = now_iso()
            stage_state["error"] = error_message
            return self.write_job(job)

    def mark_waiting_review(self, job_id: str, *, output_dir: Path, summary: dict[str, Any]) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "waiting_review"
            job["currentStage"] = "export"
            job["resultSummary"] = summary
            job["artifacts"]["output"] = str(output_dir)
            job["review"]["status"] = "pending"
            return self.write_job(job)

    def mark_completed(self, job_id: str) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "completed"
            job["currentStage"] = None
            job["error"] = None
            return self.write_job(job)

    def mark_publish_failed(self, job_id: str, error_message: str) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "failed"
            job["currentStage"] = "export"
            job["error"] = {"stage": "publish", "message": error_message, "failedAt": now_iso()}
            job["review"]["status"] = "publish_failed"
            job["resultSummary"] = {
                **(job.get("resultSummary") or {}),
                "published": False,
                "reviewStatus": "publish_failed",
                "readyForPromote": False,
            }
            return self.write_job(job)

    def mark_cancelled(self, job_id: str) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "cancelled"
            job["currentStage"] = None
            job["error"] = {"stage": job.get("currentStage"), "message": "cancelled by user", "failedAt": now_iso()}
            return self.write_job(job)

    def delete_job(self, job_id: str) -> None:
        """Remove all on-disk state for a job."""
        import shutil
        job_dir = self.job_dir(job_id)
        if job_dir.exists():
            shutil.rmtree(job_dir)

    def update_review(
        self,
        job_id: str,
        *,
        approved: bool,
        reviewed_by: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["review"] = {
                "status": "approved" if approved else "rejected",
                "approved": approved,
                "reviewedBy": reviewed_by,
                "reviewedAt": now_iso(),
                "notes": notes,
            }
            if not approved:
                job["status"] = "waiting_review"
            return self.write_job(job)

    def prepare_retry(self, job_id: str, stage: str | None = None) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            order = {name: index for index, name in enumerate(PIPELINE_STAGES)}
            start_stage = stage or job.get("currentStage") or PIPELINE_STAGES[0]
            if start_stage not in order:
                start_stage = PIPELINE_STAGES[0]
            start_index = order[start_stage]
            for stage_state in job["stages"]:
                stage_index = order.get(stage_state["name"])
                if stage_index is None or stage_index < start_index:
                    continue
                job["artifacts"].pop(stage_state["name"], None)
                stage_state["status"] = "pending"
                stage_state["startedAt"] = None
                stage_state["finishedAt"] = None
                stage_state["summary"] = None
                stage_state["artifactPath"] = None
                stage_state["error"] = None
                stage_state["retryCount"] = int(stage_state.get("retryCount") or 0) + 1
            if start_index <= order["export"]:
                job["artifacts"].pop("output", None)
            # 只有 research/plan 被重置时章节缓存才作废；从 compose 本身重试要保留
            # 已通过的章节，做到"只重写失败的章"
            if start_index < order["compose"]:
                checkpoint = self.job_dir(job_id) / "stages" / "compose_checkpoint.json"
                checkpoint.unlink(missing_ok=True)
            job["status"] = "queued"
            job["currentStage"] = None
            job["error"] = None
            return self.write_job(job)

    def artifact_index(self, job_id: str) -> dict[str, str]:
        job = self.load_job(job_id)
        return dict(job.get("artifacts") or {})

    @contextmanager
    def job_lock(self, job_id: str, *, timeout_seconds: float = 10.0) -> Iterator[None]:
        lock_path = self.job_dir(job_id) / ".lock"
        start = time.time()
        fd: int | None = None
        while fd is None:
            try:
                fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                # Check for stale lock (process that created it is gone)
                try:
                    pid_str = lock_path.read_text().strip()
                    if pid_str.isdigit():
                        try:
                            os.kill(int(pid_str), 0)
                        except OSError:
                            # Process is dead — remove stale lock
                            lock_path.unlink(missing_ok=True)
                            continue
                except (OSError, ValueError):
                    pass
                if time.time() - start > timeout_seconds:
                    raise TimeoutError(f"timed out acquiring job lock for {job_id}")
                time.sleep(0.05)
        try:
            os.write(fd, str(os.getpid()).encode("utf-8"))
            yield
        finally:
            os.close(fd)
            try:
                lock_path.unlink()
            except FileNotFoundError:
                pass

    def _find_stage(self, job: dict[str, Any], stage: str) -> dict[str, Any]:
        for item in job["stages"]:
            if item["name"] == stage:
                return item
        if stage in PIPELINE_STAGES:
            # 旧任务缺少后加的阶段：按需补一个 pending 条目，保持兼容
            item = {
                "name": stage,
                "status": "pending",
                "retryCount": 0,
                "startedAt": None,
                "finishedAt": None,
                "summary": None,
                "artifactPath": None,
                "error": None,
            }
            job["stages"].append(item)
            return item
        raise KeyError(f"unknown stage '{stage}'")

    def list_jobs(self) -> list[dict[str, Any]]:
        jobs: list[dict[str, Any]] = []
        if not self.root.exists():
            return jobs
        for job_file in self.root.glob("*/job.json"):
            try:
                jobs.append(read_json(job_file))
            except Exception:
                continue
        return jobs

    def repair_interrupted_jobs(self) -> None:
        if not self.root.exists():
            return
        for job_file in self.root.glob("*/job.json"):
            try:
                job = read_json(job_file)
            except Exception:
                continue
            if job.get("status") == "running":
                job["status"] = "failed"
                job["error"] = {
                    "stage": job.get("currentStage"),
                    "message": "job interrupted before completion; retry is required",
                    "failedAt": now_iso(),
                }
                write_json_atomic(job_file, job)
