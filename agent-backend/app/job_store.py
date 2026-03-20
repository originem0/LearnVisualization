from __future__ import annotations

import os
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

try:
    from .common import ensure_dir, now_iso, read_json, write_json_atomic, write_text_atomic
except ImportError:
    from common import ensure_dir, now_iso, read_json, write_json_atomic, write_text_atomic

PIPELINE_STAGES = ["plan", "compose", "validate", "export"]


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
        return self.root / job_id

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

    def mark_stage_failed(self, job_id: str, stage: str, error_message: str) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            job["status"] = "failed"
            job["currentStage"] = stage
            job["error"] = {"stage": stage, "message": error_message, "failedAt": now_iso()}
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
            job["status"] = "completed" if approved else "waiting_review"
            return self.write_job(job)

    def prepare_retry(self, job_id: str, stage: str | None = None) -> dict[str, Any]:
        with self.job_lock(job_id):
            job = self.load_job(job_id)
            start_stage = stage or job.get("currentStage") or PIPELINE_STAGES[0]
            start_index = PIPELINE_STAGES.index(start_stage)
            for index, stage_state in enumerate(job["stages"]):
                if index < start_index:
                    continue
                job["artifacts"].pop(stage_state["name"], None)
                stage_state["status"] = "pending"
                stage_state["startedAt"] = None
                stage_state["finishedAt"] = None
                stage_state["summary"] = None
                stage_state["artifactPath"] = None
                stage_state["error"] = None
                stage_state["retryCount"] = int(stage_state.get("retryCount") or 0) + 1
            if start_index <= PIPELINE_STAGES.index("export"):
                job["artifacts"].pop("output", None)
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
