from __future__ import annotations

import atexit
import json
import os
import shutil
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Any

try:
    from .common import ensure_dir, issue_messages, now_iso, safe_job_id, safe_slug, slugify, validate_package_dir, write_json_atomic
    from .essay_prompts import build_chapter_prompts, build_essay_plan_prompts, build_judge_prompts, build_course_verify_prompts
    from .essay_quality import evaluate_chapter_quality, validate_fact_spine, validate_chapter_evidence, check_quote_fidelity
    from .essay_schema import normalize_chapter_payload, normalize_essay_plan_payload, register_for_knowledge_type
    from .job_store import JobStore
    from .models import normalize_generation_contract
    from .prompt_assets import PROMPT_VERSION, build_topic_validation_prompt
    from .provider import OpenAICompatibleClient, ProviderConfig, ProviderError, model_family
    from .research import run_research, quote_in_text
except ImportError:
    from common import ensure_dir, issue_messages, now_iso, safe_job_id, safe_slug, slugify, validate_package_dir, write_json_atomic
    from essay_prompts import build_chapter_prompts, build_essay_plan_prompts, build_judge_prompts, build_course_verify_prompts
    from essay_quality import evaluate_chapter_quality, validate_fact_spine, validate_chapter_evidence, check_quote_fidelity
    from essay_schema import normalize_chapter_payload, normalize_essay_plan_payload, register_for_knowledge_type
    from job_store import JobStore
    from models import normalize_generation_contract
    from prompt_assets import PROMPT_VERSION, build_topic_validation_prompt
    from provider import OpenAICompatibleClient, ProviderConfig, ProviderError, model_family
    from research import run_research, quote_in_text

MAX_CONCURRENT_JOBS = 3
COMPOSE_CONCURRENCY = 1
DAILY_JOB_LIMIT = 10
DAILY_IDENTITY_JOB_LIMIT = 5
MAX_TOTAL_COURSES = 50

# Serialize all npm builds — concurrent builds corrupt the output directory
_build_lock = threading.Lock()


class CancelledError(Exception):
    """Raised when a job is cancelled via cooperative cancellation."""


class StaticBuildError(RuntimeError):
    """Raised when static site publication cannot be made consistent."""


def run_static_build(repo_root: Path, *, log_prefix: str = "[pipeline]", timeout: int = 600) -> dict[str, Any]:
    """Run the static build synchronously; success is required before publication is complete."""
    import sys

    if not (repo_root / "package.json").exists():
        print(f"{log_prefix} Skipping build; package.json not found in {repo_root}", file=sys.stderr)
        return {"ok": True, "skipped": True, "reason": "package.json not found"}

    if not _build_lock.acquire(timeout=0):
        raise StaticBuildError("static build already in progress")
    try:
        print(f"{log_prefix} Running npm run build...", file=sys.stderr)
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()[-1200:]
            raise StaticBuildError(f"static build failed: {detail}")
        print(f"{log_prefix} Build completed successfully", file=sys.stderr)
        return {
            "ok": True,
            "skipped": False,
            "stdout": (result.stdout or "")[-4000:],
            "stderr": (result.stderr or "")[-4000:],
        }
    finally:
        _build_lock.release()


class CourseGenerationPipeline:
    def __init__(
        self,
        *,
        provider_config: ProviderConfig,
        jobs_root: Path,
        generated_root: Path,
        repo_root: Path,
        client: OpenAICompatibleClient | None = None,
    ) -> None:
        self.provider_config = provider_config
        self.client = client or OpenAICompatibleClient(provider_config)
        self.store = JobStore(jobs_root)
        self.generated_root = ensure_dir(generated_root)
        self.repo_root = repo_root
        self._executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS, thread_name_prefix="course-job")
        atexit.register(self._executor.shutdown, wait=False)
        # Cooperative cancellation: job_id -> Event (set = cancelled)
        self._cancel_events: dict[str, threading.Event] = {}
        self._lock = threading.Lock()

    def _check_cancelled(self, job_id: str) -> None:
        """Raise CancelledError if the job has been cancelled."""
        event = self._cancel_events.get(job_id)
        if event and event.is_set():
            raise CancelledError("job cancelled by user")

    def enqueue_pending_jobs(self) -> None:
        """Re-enqueue any jobs left in queued status (e.g. after restart)."""
        jobs = self.store.list_jobs()
        queued = [j for j in jobs if j.get("status") == "queued"]
        queued.sort(key=lambda j: j.get("createdAt", ""))
        for j in queued:
            self._submit_job(j["id"])

    def cleanup_stale_data(self) -> None:
        """Remove garbage data: staging dirs, old failed/cancelled jobs, orphaned generated dirs."""
        import sys

        # 1. Clean staging dirs from all jobs
        for job in self.store.list_jobs():
            job_dir = self.store.job_dir(job["id"])
            staging = job_dir / "staging"
            if staging.exists():
                shutil.rmtree(staging, ignore_errors=True)

        # 2. Remove job dirs for failed/cancelled jobs older than 7 days
        cutoff = (date.today().isoformat())  # keep today's jobs for debugging
        removed_jobs = 0
        for job in self.store.list_jobs():
            if job.get("status") in ("failed", "cancelled"):
                created = job.get("createdAt", "")[:10]
                if created and created < cutoff:
                    try:
                        self.store.delete_job(job["id"])
                        removed_jobs += 1
                    except Exception:
                        pass

        # 3. Remove orphaned generated dirs — keep anything referenced by any job for audit/retry
        referenced_slugs = set()
        for job in self.store.list_jobs():
            req = job.get("request") or {}
            slug = req.get("output_slug")
            if slug:
                try:
                    referenced_slugs.add(safe_slug(slug, "output_slug"))
                except ValueError:
                    pass
            for artifact_path in (job.get("artifacts") or {}).values():
                try:
                    path = Path(str(artifact_path)).resolve()
                    generated_root = self.generated_root.resolve()
                    if path == generated_root or generated_root in path.parents:
                        referenced_slugs.add(path.relative_to(generated_root).parts[0])
                except (OSError, ValueError, IndexError):
                    continue

        removed_generated = 0
        if self.generated_root.is_dir():
            for d in list(self.generated_root.iterdir()):
                if not d.is_dir():
                    continue
                if d.name in referenced_slugs:
                    continue
                shutil.rmtree(d, ignore_errors=True)
                removed_generated += 1

        if removed_jobs or removed_generated:
            print(f"[cleanup] Removed {removed_jobs} stale jobs, {removed_generated} orphaned generated dirs", file=sys.stderr)

    def _submit_job(self, job_id: str) -> None:
        """Submit a job to the thread pool."""
        with self._lock:
            self._cancel_events[job_id] = threading.Event()
        self._executor.submit(self._run_job_wrapper, job_id)

    def _run_job_wrapper(self, job_id: str) -> None:
        """Wrapper that runs in the thread pool and cleans up cancel events."""
        try:
            self.run_job(job_id)
        except Exception as exc:
            # run_job should mark the job as failed, but if it didn't, mark it here
            import sys
            print(f"[pipeline] Job {job_id} uncaught exception: {exc}", file=sys.stderr)
            try:
                job = self.store.load_job(job_id)
                if job.get("status") not in ("failed", "cancelled", "completed", "waiting_review"):
                    stage = job.get("currentStage") or "plan"
                    self.store.mark_stage_failed(job_id, stage, str(exc))
            except Exception:
                pass
        finally:
            with self._lock:
                self._cancel_events.pop(job_id, None)

    def create_job(self, request_payload: dict[str, Any], *, run_async: bool = True) -> dict[str, Any]:
        if not request_payload.get("topic"):
            raise ValueError("topic is required")
        request_payload["contract"] = normalize_generation_contract(request_payload)

        # --- Rate limiting ---
        today = date.today().isoformat()
        # Count all jobs created today regardless of status (failed attempts still count)
        today_count = sum(
            1 for j in self.store.list_jobs()
            if j.get("createdAt", "")[:10] == today
        )
        if today_count >= DAILY_JOB_LIMIT:
            raise ValueError(f"今日生成次数已达上限（{DAILY_JOB_LIMIT} 次），请明天再试")
        request_identity = str(request_payload.get("_request_identity") or "direct").strip()
        identity_count = sum(
            1 for j in self.store.list_jobs()
            if j.get("createdAt", "")[:10] == today
            and ((j.get("request") or {}).get("_request_identity") or "direct") == request_identity
        )
        if identity_count >= DAILY_IDENTITY_JOB_LIMIT:
            raise ValueError(f"当前调用方今日生成次数已达上限（{DAILY_IDENTITY_JOB_LIMIT} 次），请明天再试")

        courses_root = self.repo_root / "courses"
        course_count = sum(
            1 for d in courses_root.iterdir()
            if d.is_dir() and ((d / "course.json").exists() or (d / "plan.json").exists())
        ) if courses_root.is_dir() else 0
        generated_count = sum(
            1 for d in self.generated_root.iterdir()
            if d.is_dir() and (d / "course.json").exists()
        ) if self.generated_root.is_dir() else 0
        if course_count + generated_count >= MAX_TOTAL_COURSES:
            raise ValueError(f"课程总数已达上限（{MAX_TOTAL_COURSES} 门），请删除旧课程后再生成")

        # --- LLM topic normalization (graceful degradation, no rejection) ---
        topic_validation = None
        try:
            sys_prompt, usr_prompt = build_topic_validation_prompt(request_payload["topic"])
            val_response = self.client.generate_json(
                schema_name="topic_validation",
                system_prompt=sys_prompt,
                user_prompt=usr_prompt,
                max_tokens=300,
            )
            topic_validation = val_response["content"]
            # Use canonical topic if available (normalization only, no rejection)
            canonical = str(topic_validation.get("canonicalTopic") or "").strip()
            if canonical:
                request_payload["topic"] = canonical
        except Exception as exc:
            raise ValueError(f"主题验证暂时不可用，不能跳过输入门控: {exc}") from exc

        output_slug = safe_slug(request_payload.get("output_slug") or slugify(request_payload["topic"]), "output_slug")
        request_payload = {
            **request_payload,
            "output_slug": output_slug,
            "overwrite": bool(request_payload.get("overwrite", False)),
        }
        output_slug = request_payload["output_slug"]

        # --- Duplicate detection (slug-based + semantic) ---
        courses_root = self.repo_root / "courses"

        # Slug-based
        if (courses_root / output_slug / "course.json").exists() and not request_payload["overwrite"]:
            raise ValueError(f"课程 '{output_slug}' 已存在于 courses/ 中，如需重新生成请先删除")
        if (self.generated_root / output_slug).exists() and request_payload["overwrite"]:
            shutil.rmtree(self.generated_root / output_slug)
        if (self.generated_root / output_slug).exists():
            raise ValueError(f"课程 '{output_slug}' 已生成，如需重新生成请先删除")

        # Semantic dedup: check if canonical topic matches any existing course title
        canonical_topic = request_payload["topic"]
        if courses_root.is_dir() and not request_payload["overwrite"]:
            for course_dir in courses_root.iterdir():
                course_json = course_dir / "course.json"
                if course_dir.is_dir() and course_json.exists():
                    try:
                        existing = json.loads(course_json.read_text(encoding="utf-8"))
                        existing_title = existing.get("title", "")
                        if (canonical_topic in existing_title or existing_title in canonical_topic) and len(canonical_topic) >= 4:
                            raise ValueError(f"已有相似课程: {existing_title}")
                    except (json.JSONDecodeError, OSError):
                        continue
        # 3. Queued or running job with same slug
        for existing in self.store.list_jobs():
            if existing.get("status") in ("queued", "running"):
                existing_slug = (existing.get("request") or {}).get("output_slug")
                if existing_slug == output_slug:
                    raise ValueError(f"已有相同主题 '{output_slug}' 的任务在队列中")

        job = self.store.create_job(
            request_payload,
            provider=self.provider_config.masked,
            prompt_version=PROMPT_VERSION,
        )
        if run_async:
            self._submit_job(job["id"])
        result = self.store.load_job(job["id"])
        # Attach narrow suggestions if topic was broad
        if topic_validation and topic_validation.get("narrowSuggestions"):
            result["suggestions"] = topic_validation["narrowSuggestions"]
        return result

    def cancel_job(self, job_id: str) -> dict[str, Any]:
        """Cancel a queued or running job."""
        job_id = safe_job_id(job_id)
        job = self.store.load_job(job_id)
        status = job.get("status")
        if status not in ("queued", "running"):
            raise ValueError(f"cannot cancel job in '{status}' status")

        # Signal the cancel event so the worker thread stops
        with self._lock:
            event = self._cancel_events.get(job_id)
            if event:
                event.set()

        self.store.mark_cancelled(job_id)

        # Clean up staging directory
        staging_dir = self.store.job_dir(job_id) / "staging"
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)

        return self.store.load_job(job_id)

    def delete_job(self, job_id: str) -> dict[str, Any]:
        """Delete a job and its generated output."""
        job_id = safe_job_id(job_id)
        job = self.store.load_job(job_id)
        status = job.get("status")
        if status in ("queued", "running"):
            raise ValueError("cannot delete a queued/running job — cancel it first")

        # Remove generated output directory
        output_slug = (job.get("request") or {}).get("output_slug")
        if output_slug:
            output_dir = self.generated_root / safe_slug(output_slug, "output_slug")
            if output_dir.exists():
                shutil.rmtree(output_dir)

        # Remove job directory
        self.store.delete_job(job_id)
        return {"deleted": True, "id": job_id}

    def run_job(self, job_id: str) -> dict[str, Any]:
        job_id = safe_job_id(job_id)
        # Snapshot client at job start — config changes during this job won't affect it
        with self._lock:
            client = self.client
        job = self.store.load_job(job_id)
        request_payload = job["request"]

        # Determine which stages to skip (already succeeded from prior run)
        stage_status = {s["name"]: s["status"] for s in job["stages"]}

        try:
            self._check_cancelled(job_id)

            # --- RESEARCH ---
            if stage_status.get("research") == "succeeded" and job["artifacts"].get("research"):
                research_artifact = json.loads(Path(job["artifacts"]["research"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "research")
                research_artifact = self._run_research(job_id, request_payload, client=client)
                research_path = self.store.store_stage_artifact(job_id, "research", research_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "research",
                    artifact_path=research_path,
                    summary=research_artifact["stats"],
                )

            self._check_cancelled(job_id)

            # --- PLAN ---
            if stage_status.get("plan") == "succeeded" and job["artifacts"].get("plan"):
                plan_artifact = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "plan")
                plan_artifact = self._run_plan(job_id, request_payload, client=client, research_artifact=research_artifact)
                plan_path = self.store.store_stage_artifact(job_id, "plan", plan_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "plan",
                    artifact_path=plan_path,
                    summary={
                        "chapterCount": len(plan_artifact["chapters"]),
                        "moduleCount": len(plan_artifact["chapters"]),
                        "register": plan_artifact["register"],
                        "writingMode": plan_artifact.get("writingMode"),
                    },
                )

            self._check_cancelled(job_id)

            # --- COMPOSE (with per-module checkpointing) ---
            if stage_status.get("compose") == "succeeded" and job["artifacts"].get("compose"):
                composed_artifact = json.loads(Path(job["artifacts"]["compose"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "compose")
                composed_artifact = self._run_compose(job_id, request_payload, plan_artifact, research_artifact=research_artifact, client=client)
                compose_path = self.store.store_stage_artifact(job_id, "compose", composed_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "compose",
                    artifact_path=compose_path,
                    summary={
                        "chapterCount": len(composed_artifact["chapters"]),
                        "moduleCount": len(composed_artifact["chapters"]),
                        "outputSlug": composed_artifact["course"]["slug"],
                    },
                )

            self._check_cancelled(job_id)

            # --- VERIFY (course-level final check) ---
            if stage_status.get("verify") == "succeeded" and job["artifacts"].get("verify"):
                pass
            else:
                self.store.mark_stage_running(job_id, "verify")
                verify_artifact = self._run_verify(job_id, composed_artifact, research_artifact, client=client)
                verify_path = self.store.store_stage_artifact(job_id, "verify", verify_artifact)
                if not verify_artifact["pass"]:
                    raise ValueError(f"课程终检未通过: {verify_artifact['issues'][:5]}")
                self.store.mark_stage_success(
                    job_id,
                    "verify",
                    artifact_path=verify_path,
                    summary={"pass": True, "issueCount": 0},
                )

            self._check_cancelled(job_id)

            # --- VALIDATE ---
            self.store.mark_stage_running(job_id, "validate")
            validation_artifact = self._run_validate(job_id, composed_artifact)
            validate_path = self.store.store_stage_artifact(job_id, "validate", validation_artifact)
            self.store.mark_stage_success(
                job_id,
                "validate",
                artifact_path=validate_path,
                summary={
                    "engineOk": validation_artifact["engineValidation"]["ok"],
                    "qualityIssueCount": len(validation_artifact["qualityIssues"]),
                    "blockingIssueCount": len(validation_artifact["blockingIssues"]),
                    "qualityIssues": [
                        {"severity": i["severity"], "code": i.get("code"), "moduleId": i.get("moduleId"), "message": i["message"]}
                        for i in validation_artifact["qualityIssues"]
                    ],
                },
            )
            if validation_artifact["blockingIssues"]:
                messages = [item["message"] for item in validation_artifact["blockingIssues"]]
                raise ValueError(f"validation blocked export: {messages}")

            self._check_cancelled(job_id)

            # --- EXPORT ---
            self.store.mark_stage_running(job_id, "export")
            export_artifact = self._run_export(job_id, request_payload, composed_artifact, validation_artifact)
            export_path = self.store.store_stage_artifact(job_id, "export", export_artifact)
            self.store.mark_stage_success(
                job_id,
                "export",
                artifact_path=export_path,
                summary=export_artifact,
            )

            self._check_cancelled(job_id)

            output_dir = Path(export_artifact["outputDir"])
            summary = {
                "outputSlug": export_artifact["outputSlug"],
                "chapterCount": export_artifact["chapterCount"],
                "moduleCount": export_artifact["chapterCount"],
                "readyForPromote": True,
                "reviewStatus": "pending",
                "published": False,
                "writingMode": composed_artifact["course"].get("writingMode"),
            }
            return self.store.mark_waiting_review(job_id, output_dir=output_dir, summary=summary)
        except CancelledError:
            # Already marked as cancelled by cancel_job(); just clean up staging
            staging_dir = self.store.job_dir(job_id) / "staging"
            if staging_dir.exists():
                shutil.rmtree(staging_dir, ignore_errors=True)
            return self.store.load_job(job_id)
        except Exception as exc:
            current_job = self.store.load_job(job_id)
            stage = current_job.get("currentStage") or "plan"
            self.store.mark_stage_failed(job_id, stage, str(exc))
            return self.store.load_job(job_id)

    def get_job(self, job_id: str) -> dict[str, Any]:
        return self.store.load_job(safe_job_id(job_id))

    def get_artifacts(self, job_id: str) -> dict[str, str]:
        return self.store.artifact_index(safe_job_id(job_id))

    def retry_job(self, job_id: str, *, stage: str | None = None) -> dict[str, Any]:
        job_id = safe_job_id(job_id)
        job = self.store.prepare_retry(job_id, stage)
        self._submit_job(job_id)
        return job

    def review_job(
        self,
        job_id: str,
        *,
        approved: bool,
        reviewed_by: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        job_id = safe_job_id(job_id)
        job = self.store.load_job(job_id)
        output_dir = Path((job.get("artifacts") or {}).get("output") or "")
        if not output_dir or not output_dir.exists():
            raise ValueError("job has no exported output to review")
        approval_path = output_dir / "review" / "approval.json"
        approval_payload = {
            "approved": approved,
            "reviewedBy": reviewed_by or "",
            "reviewedAt": now_iso() if approved else "",
            "notes": notes or "",
        }
        write_json_atomic(approval_path, approval_payload)
        updated_job = self.store.update_review(job_id, approved=approved, reviewed_by=reviewed_by, notes=notes)
        if approved:
            updated_job = self._publish_output(
                job_id,
                output_dir=output_dir,
                reviewed_by=reviewed_by,
                notes=notes,
            )
        return updated_job

    def _publish_output(
        self,
        job_id: str,
        *,
        output_dir: Path,
        reviewed_by: str | None,
        notes: str | None,
    ) -> dict[str, Any]:
        job = self.store.load_job(job_id)
        approval_payload = {
            "approved": True,
            "reviewedBy": reviewed_by or "system",
            "reviewedAt": now_iso(),
            "notes": notes or "",
        }
        write_json_atomic(output_dir / "review" / "approval.json", approval_payload)
        self.store.update_review(job_id, approved=True, reviewed_by=reviewed_by or "system", notes=notes)

        promote_result: dict[str, str] | None = None
        try:
            promote_result = self._promote_reviewed_output(
                job_id,
                source_dir=output_dir,
                target_slug=safe_slug((job.get("request") or {}).get("output_slug") or output_dir.name, "target_slug"),
                overwrite=bool((job.get("request") or {}).get("overwrite", False)),
            )
            build_result = self._run_next_build(job_id)
            self._finalize_promote_backup(promote_result)
        except Exception as exc:
            if promote_result:
                self._rollback_promote(promote_result)
            self.store.mark_publish_failed(job_id, str(exc))
            raise RuntimeError(f"publish failed: {exc}") from exc

        with self.store.job_lock(job_id):
            promoted_job = self.store.load_job(job_id)
            promoted_job["artifacts"]["output"] = promote_result["targetDir"]
            promoted_job["artifacts"]["reviewedOutput"] = str(output_dir)
            promoted_job["resultSummary"] = {
                **(promoted_job.get("resultSummary") or {}),
                "published": True,
                "reviewStatus": "approved",
                "promotedTo": promote_result["targetDir"],
                "buildSkipped": bool(build_result.get("skipped")),
                "readyForPromote": False,
            }
            self.store.write_job(promoted_job)
        self.store.mark_completed(job_id)
        return self.store.load_job(job_id)

    def _promote_reviewed_output(
        self,
        job_id: str,
        *,
        source_dir: Path,
        target_slug: str,
        overwrite: bool,
    ) -> dict[str, str]:
        target_slug = safe_slug(target_slug, "target_slug")
        validation = validate_package_dir(source_dir, repo_root=self.repo_root, require_review_approval=True)
        if not validation.get("promoteReady"):
            raise ValueError(f"reviewed package is not promote-ready: {issue_messages(validation)}")

        courses_dir = self.repo_root / "courses" / target_slug
        tmp_dir = courses_dir.with_name(courses_dir.name + ".tmp")
        old_dir = courses_dir.with_name(courses_dir.name + ".old")
        if courses_dir.exists() and not overwrite:
            raise ValueError(f"target course already exists: {courses_dir}")
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)
        if old_dir.exists():
            shutil.rmtree(old_dir)
        old_dir_kept = False
        try:
            shutil.copytree(source_dir, tmp_dir)
            if courses_dir.exists():
                courses_dir.rename(old_dir)
                old_dir_kept = True
            tmp_dir.rename(courses_dir)

            post_validation = validate_package_dir(courses_dir, repo_root=self.repo_root, require_review_approval=True)
            if not post_validation.get("promoteReady"):
                raise ValueError(f"promoted package failed validation: {issue_messages(post_validation)}")
        except Exception:
            if tmp_dir.exists():
                shutil.rmtree(tmp_dir, ignore_errors=True)
            if courses_dir.exists():
                shutil.rmtree(courses_dir, ignore_errors=True)
            if old_dir.exists():
                old_dir.rename(courses_dir)
            raise

        self.store.write_log(
            job_id,
            "promote",
            json.dumps(
                {
                    "sourceDir": str(source_dir),
                    "targetDir": str(courses_dir),
                    "oldDir": str(old_dir) if old_dir_kept else "",
                    "validation": post_validation,
                },
                ensure_ascii=False,
                indent=2,
            ),
        )
        return {"sourceDir": str(source_dir), "targetDir": str(courses_dir), "oldDir": str(old_dir) if old_dir_kept else ""}

    def _rollback_promote(self, promote_result: dict[str, str]) -> None:
        target_dir = Path(promote_result["targetDir"])
        old_dir_value = promote_result.get("oldDir") or ""
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        if old_dir_value:
            old_dir = Path(old_dir_value)
            if old_dir.exists():
                old_dir.rename(target_dir)

    def _finalize_promote_backup(self, promote_result: dict[str, str]) -> None:
        old_dir_value = promote_result.get("oldDir") or ""
        if old_dir_value:
            old_dir = Path(old_dir_value)
            if old_dir.exists():
                shutil.rmtree(old_dir, ignore_errors=True)

    def _run_research(
        self,
        job_id: str,
        request_payload: dict[str, Any],
        *,
        client: OpenAICompatibleClient | None = None,
    ) -> dict[str, Any]:
        client = client or self.client
        artifact = run_research(
            topic=request_payload["topic"],
            contract=request_payload["contract"],
            client=client,
            research_model=getattr(client.config, "research_model", None),
            sources_dir=self.store.job_dir(job_id) / "research_sources",
            check_cancelled=lambda: self._check_cancelled(job_id),
        )
        self.store.write_log(
            job_id,
            "research",
            json.dumps(
                {"queries": artifact["queries"], "documents": artifact["documents"], "stats": artifact["stats"]},
                ensure_ascii=False,
                indent=2,
            ),
        )
        return artifact

    def _run_plan(self, job_id: str, request_payload: dict[str, Any], *, client: OpenAICompatibleClient | None = None, research_artifact: dict[str, Any] | None = None) -> dict[str, Any]:
        client = client or self.client
        revision_feedback: str | None = None
        normalized: dict[str, Any] = {}
        for attempt in range(2):
            system_prompt, user_prompt = build_essay_plan_prompts(request_payload, research_artifact=research_artifact, revision_feedback=revision_feedback)
            response = client.generate_json(
                schema_name="essay_course_plan",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            self.store.write_log(
                job_id,
                "plan",
                json.dumps(
                    {
                        "attempt": attempt + 1,
                        "usage": response["usage"],
                        "model": response.get("model"),
                        "title": (response.get("content") or {}).get("title"),
                        "chapterCount": len((response.get("content") or {}).get("chapters") or []),
                        **(
                            {
                                "systemPrompt": system_prompt,
                                "userPrompt": user_prompt,
                                "response": response["content"],
                            }
                            if os.environ.get("AGENT_DEBUG_LOG_PROMPTS", "").strip().lower() in {"1", "true", "yes", "on"}
                            else {}
                        ),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
            )
            normalized = self._normalize_essay_plan(response["content"], request_payload, research_artifact=research_artifact)
            evidence_ids = {e["id"] for e in (research_artifact or {}).get("evidence") or []} or None
            issues = validate_fact_spine(normalized["factSpine"], evidence_ids=evidence_ids)
            if evidence_ids:
                issues += validate_chapter_evidence(normalized["chapterPlans"], evidence_ids)
            if not issues:
                return normalized
            revision_feedback = "；".join(issues)
        raise ValueError(f"课程规划未通过 factSpine 校验: {revision_feedback}")

    def _run_compose(
        self,
        job_id: str,
        request_payload: dict[str, Any],
        plan_artifact: dict[str, Any],
        *,
        research_artifact: dict[str, Any] | None = None,
        client: OpenAICompatibleClient | None = None,
    ) -> dict[str, Any]:
        client = client or self.client
        chapters: list[dict[str, Any]] = []
        compose_logs: list[dict[str, Any]] = []
        chapter_plans = plan_artifact["chapterPlans"]

        # Load checkpoint if previous compose attempt partially completed
        checkpoint_path = self.store.job_dir(job_id) / "stages" / "compose_checkpoint.json"
        if checkpoint_path.exists():
            try:
                from .common import read_json
            except ImportError:
                from common import read_json
            checkpoint = read_json(checkpoint_path)
            chapters = checkpoint.get("chapters", [])
            compose_logs = checkpoint.get("compose_logs", [])

        completed_ids = {chapter["id"] for chapter in chapters}
        prev_chapter_ending = self._last_chapter_ending(chapters[-1]) if chapters else None

        for index, chapter_plan in enumerate(chapter_plans, start=1):
            self._check_cancelled(job_id)
            if chapter_plan["id"] in completed_ids:
                continue

            evidence_library = (research_artifact or {}).get("evidence") or []
            chapter_evidence = [
                e for e in evidence_library if e["id"] in set(chapter_plan.get("evidenceIds") or [])
            ] or evidence_library[:8]

            chapter, local_logs = self._compose_chapter_with_rewrites(
                job_id=job_id,
                request_payload=request_payload,
                plan_artifact=plan_artifact,
                chapter_plan=chapter_plan,
                chapter_index=index,
                client=client,
                prev_chapter_ending=prev_chapter_ending,
                chapter_evidence=chapter_evidence,
                evidence_library=evidence_library,
            )
            chapters.append(chapter)
            prev_chapter_ending = self._last_chapter_ending(chapter)
            compose_logs.extend(local_logs)

            write_json_atomic(checkpoint_path, {
                "chapters": chapters,
                "compose_logs": compose_logs,
            })

            job = self.store.load_job(job_id)
            compose_stage = next(s for s in job["stages"] if s["name"] == "compose")
            compose_stage["summary"] = {
                "chaptersCompleted": len(chapters),
                "chaptersTotal": len(chapter_plans),
                "modulesCompleted": len(chapters),
                "modulesTotal": len(chapter_plans),
                "currentChapter": chapter["id"],
            }
            self.store.write_job(job)

        chapters.sort(key=lambda chapter: chapter["number"])
        self.store.write_log(job_id, "compose", json.dumps(compose_logs, ensure_ascii=False, indent=2))
        course = self._build_course_record(plan_artifact, chapters)
        return {
            "plan": {"factSpine": plan_artifact.get("factSpine") or []},
            "course": course,
            "chapters": chapters,
            "review_approval": {
                "approved": False,
                "reviewedBy": "",
                "reviewedAt": "",
                "notes": "Generated by essay-course pipeline. Human review approval is required before promote.",
            },
        }

    def _normalize_essay_plan(self, payload: dict[str, Any], request_payload: dict[str, Any], research_artifact: dict[str, Any] | None = None) -> dict[str, Any]:
        contract = request_payload["contract"]
        raw_chapters = payload.get("chapters") if isinstance(payload, dict) else []
        chapter_plans: list[dict[str, Any]] = []
        if isinstance(raw_chapters, list):
            for index, item in enumerate(raw_chapters[:6], start=1):
                if isinstance(item, dict):
                    chapter_id = str(item.get("id") or f"c{index:02d}").strip()
                    title = str(item.get("title") or f"第 {index} 章").strip()
                    role = str(item.get("role") or item.get("arc") or "").strip()
                    raw_ids = item.get("evidenceIds") or []
                else:
                    chapter_id = f"c{index:02d}"
                    title = str(item).strip() or f"第 {index} 章"
                    role = ""
                    raw_ids = []
                if not chapter_id.startswith("c"):
                    chapter_id = f"c{index:02d}"
                chapter_plans.append({
                    "id": f"c{index:02d}",
                    "number": index,
                    "title": title,
                    "role": role or title,
                    "evidenceIds": [str(x).strip() for x in raw_ids if str(x).strip()],
                })
        if len(chapter_plans) < 4:
            defaults = [
                "立题：为什么这个问题值得回答",
                "展开：先建立能工作的解释模型",
                "转折：旧直觉在哪里失效",
                "收束：回到问题给出可迁移判断",
            ]
            for index in range(len(chapter_plans) + 1, 5):
                chapter_plans.append({
                    "id": f"c{index:02d}",
                    "number": index,
                    "title": defaults[index - 1],
                    "role": defaults[index - 1],
                    "evidenceIds": [],
                })

        register = register_for_knowledge_type(contract["knowledgeType"])
        normalized = normalize_essay_plan_payload(
            {
                **(payload if isinstance(payload, dict) else {}),
                "register": register,
                "writingMode": (payload if isinstance(payload, dict) else {}).get("writingMode"),
                "knowledgeType": contract["knowledgeType"],
                "drivingQuestion": contract["drivingQuestion"],
                "centralTension": contract["centralTension"],
                "chapters": [chapter["id"] for chapter in chapter_plans],
            },
            topic=request_payload["topic"],
            slug=request_payload["output_slug"],
        )
        if not normalized["overview"]["arc"]:
            normalized["overview"]["arc"] = [chapter["role"] for chapter in chapter_plans]
        if not normalized["overview"]["whyExists"]:
            normalized["overview"]["whyExists"] = contract["centralTension"]
        if not normalized["overview"]["wherePoints"]:
            normalized["overview"]["wherePoints"] = contract["desiredOutcome"]
        raw_fact_spine = (payload.get("factSpine") if isinstance(payload, dict) else []) or []
        normalized_spine: list[dict[str, Any]] = []
        for item in raw_fact_spine[:5]:
            if isinstance(item, dict):
                claim = str(item.get("claim") or "").strip()
                ids = [str(x).strip() for x in (item.get("evidenceIds") or []) if str(x).strip()]
            else:
                claim = str(item).strip()
                ids = []
            if claim:
                normalized_spine.append({"claim": claim, "evidenceIds": ids})
        normalized["factSpine"] = normalized_spine
        normalized["contract"] = contract

        valid_ids = {e["id"] for e in (research_artifact or {}).get("evidence") or []}
        if valid_ids:
            for chapter in chapter_plans:
                chapter["evidenceIds"] = [x for x in chapter.get("evidenceIds") or [] if x in valid_ids]

        normalized["chapterPlans"] = chapter_plans
        return normalized

    def _compose_chapter_with_rewrites(
        self,
        *,
        job_id: str,
        request_payload: dict[str, Any],
        plan_artifact: dict[str, Any],
        chapter_plan: dict[str, Any],
        chapter_index: int,
        client: OpenAICompatibleClient,
        prev_chapter_ending: str | None,
        chapter_evidence: list[dict[str, Any]] | None = None,
        evidence_library: list[dict[str, Any]] | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        local_logs: list[dict[str, Any]] = []
        revision_feedback: str | None = None
        attempts = 4
        last_chapter: dict[str, Any] | None = None
        last_judgement: dict[str, Any] | None = None
        for attempt in range(attempts):
            self._check_cancelled(job_id)
            system_prompt, user_prompt = build_chapter_prompts(
                request_payload=request_payload,
                plan_artifact=plan_artifact,
                chapter_plan=chapter_plan,
                prev_chapter_ending=prev_chapter_ending,
                revision_feedback=revision_feedback,
                evidence_items=chapter_evidence,
            )
            response = client.generate_json(
                schema_name=f"{chapter_plan['id']}_chapter",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            )
            chapter = normalize_chapter_payload(
                response["content"],
                chapter_id=chapter_plan["id"],
                number=chapter_index,
            )
            if not chapter["role"]:
                chapter["role"] = chapter_plan["role"]
            if chapter_index == len(plan_artifact["chapterPlans"]):
                chapter["bridge"] = None

            used_ids = [str(x).strip() for x in (response["content"] or {}).get("usedEvidence") or [] if str(x).strip()]
            library = evidence_library or []
            by_id = {e["id"]: e for e in library}
            quoted_ids = [
                e["id"] for e in library
                if any(
                    isinstance(block, dict) and block.get("type") == "quote"
                    and quote_in_text(str(block.get("content") or ""), str(e.get("content") or ""))
                    for block in chapter["narrative"]
                )
            ]
            source_ids = list(dict.fromkeys([x for x in used_ids if x in by_id] + quoted_ids))
            chapter["sources"] = [
                {"id": x, "title": by_id[x]["sourceTitle"], "url": by_id[x]["sourceUrl"]}
                for x in source_ids
            ]

            fidelity_issues = check_quote_fidelity(chapter, library) if library else []
            if fidelity_issues:
                judgement = {"pass": False, "score": 40, "issues": fidelity_issues, "rewriteHint": "；".join(fidelity_issues)}
            else:
                judgement = self._judge_chapter(chapter, plan_artifact, chapter_plan, client=client, evidence_items=chapter_evidence)
            log_entry = {
                "chapterId": chapter["id"],
                "usage": response["usage"],
                "attempt": attempt + 1,
                "judgement": judgement,
                "model": response.get("model"),
            }
            if os.environ.get("AGENT_DEBUG_LOG_PROMPTS", "").strip().lower() in {"1", "true", "yes", "on"}:
                log_entry.update({
                    "systemPrompt": system_prompt,
                    "userPrompt": user_prompt,
                    "response": response["content"],
                })
            local_logs.append(log_entry)
            last_chapter = chapter
            last_judgement = judgement
            if judgement.get("pass"):
                return chapter, local_logs
            revision_feedback = str(judgement.get("rewriteHint") or "; ".join(judgement.get("issues") or []))
        raise ValueError(
            f"章节 {chapter_plan['id']} 质量评审未通过: "
            f"{(last_judgement or {}).get('issues') or (last_chapter or {}).get('title')}"
        )

    def _judge_chapter(
        self,
        chapter: dict[str, Any],
        plan_artifact: dict[str, Any],
        chapter_plan: dict[str, Any],
        *,
        client: OpenAICompatibleClient,
        evidence_items: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        register = plan_artifact["register"]
        writing_mode = plan_artifact.get("writingMode") or "mechanism-explainer"
        local = evaluate_chapter_quality(
            chapter,
            register=register,
            writing_mode=writing_mode,
            chapter_plan=chapter_plan,
            is_final_chapter=chapter.get("number") == len(plan_artifact.get("chapterPlans") or []),
        )
        if not local.get("pass"):
            return local
        try:
            system_prompt, user_prompt = build_judge_prompts(
                chapter,
                register=register,
                writing_mode=writing_mode,
                chapter_plan=chapter_plan,
                plan_artifact=plan_artifact,
                evidence_items=evidence_items,
            )
            judge_model = getattr(client.config, "judge_model", None)
            if judge_model and model_family(judge_model) == model_family(getattr(client.config, "model", "")):
                import sys
                print(
                    f"[pipeline] warning: judge_model '{judge_model}' 与写作模型同族，交叉评审的独立性受限",
                    file=sys.stderr,
                )
            response = client.generate_json(
                schema_name=f"{chapter['id']}_quality_judge",
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1,
                max_tokens=800,
                model=judge_model,
            )
            content = response.get("content") or {}
            return {
                "pass": bool(content.get("pass")),
                "score": int(content.get("score") or 0),
                "issues": content.get("issues") if isinstance(content.get("issues"), list) else [],
                "rewriteHint": str(content.get("rewriteHint") or ""),
            }
        except Exception as exc:
            raise ProviderError(f"chapter quality judge failed for {chapter.get('id')}: {exc}") from exc

    def _last_chapter_ending(self, chapter: dict[str, Any] | None) -> str | None:
        if not chapter:
            return None
        text_blocks = [
            str(block.get("content") or "").strip()
            for block in chapter.get("narrative", [])
            if isinstance(block, dict) and block.get("type") == "text" and str(block.get("content") or "").strip()
        ]
        return "\n\n".join(text_blocks[-2:]) or None

    def _run_verify(
        self,
        job_id: str,
        composed_artifact: dict[str, Any],
        research_artifact: dict[str, Any] | None,
        *,
        client: OpenAICompatibleClient | None = None,
    ) -> dict[str, Any]:
        client = client or self.client
        chapters = composed_artifact["chapters"]
        evidence = (research_artifact or {}).get("evidence") or []
        evidence_ids = {e["id"] for e in evidence}
        issues: list[str] = []

        fidelity: list[str] = []
        for chapter in chapters:
            fidelity.extend(f"{chapter['id']}: {issue}" for issue in check_quote_fidelity(chapter, evidence))
        issues.extend(fidelity)

        bad_sources = [
            f"{chapter['id']} sources 含未知证据 id: {source.get('id')}"
            for chapter in chapters
            for source in chapter.get("sources") or []
            if source.get("id") not in evidence_ids
        ]
        issues.extend(bad_sources)

        plan_artifact = composed_artifact.get("plan") or {}
        spine = plan_artifact.get("factSpine") or composed_artifact["course"].get("factSpine") or []
        bad_spine = [
            f"factSpine[{index}] 挂到不存在的证据 id"
            for index, item in enumerate(spine)
            if evidence_ids and not any(x in evidence_ids for x in (item.get("evidenceIds") or []))
        ]
        issues.extend(bad_spine)

        mechanical = {
            "quoteFidelityOk": not fidelity,
            "sourcesOk": not bad_sources,
            "factSpineOk": not bad_spine,
        }

        judge_model = getattr(client.config, "judge_model", None)
        system_prompt, user_prompt = build_course_verify_prompts(
            plan_artifact={**plan_artifact, "drivingQuestion": composed_artifact["course"].get("drivingQuestion"),
                           "centralTension": composed_artifact["course"].get("centralTension"),
                           "contract": composed_artifact["course"].get("contract")},
            chapters=chapters,
        )
        response = client.generate_json(
            schema_name="course_verify",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
            max_tokens=1200,
            model=judge_model,
        )
        course_judge = {
            "pass": bool((response.get("content") or {}).get("pass")),
            "issues": (response.get("content") or {}).get("issues") or [],
        }
        issues.extend(str(x) for x in course_judge["issues"])

        return {
            "pass": not issues,
            "issues": issues,
            "mechanical": mechanical,
            "courseJudge": course_judge,
        }

    def _run_next_build(self, job_id: str) -> dict[str, Any]:
        """Run npm run build to regenerate static pages with the new course."""
        return run_static_build(self.repo_root, log_prefix=f"[pipeline:{job_id}]")

    def _generate_interaction_data(
        self,
        module: dict[str, Any],
        job_id: str,
        compose_logs: list[dict[str, Any]],
        *,
        client: OpenAICompatibleClient | None = None,
    ) -> None:
        """Generate structured interaction data for core + first secondary interaction."""
        import sys
        client = client or self.client

        generated_count = 0
        max_generations = 2  # core + first secondary

        for idx, req in enumerate(module.get("interactionRequirements") or []):
            if generated_count >= max_generations:
                break

            try:
                sys_prompt, usr_prompt = build_interaction_data_prompt(
                    module=module,
                    interaction=req,
                )
                response = client.generate_json(                    schema_name=f"{module['id']}_interaction_{idx}",
                    system_prompt=sys_prompt,
                    user_prompt=usr_prompt,
                    temperature=0.3,
                )
                req["interactionData"] = response["content"]
                compose_logs.append({
                    "type": "interaction_data",
                    "moduleId": module["id"],
                    "capability": req["capability"],
                    "usage": response["usage"],
                })
                print(f"[interaction-data] {module['id']}/{req['capability']} generated", file=sys.stderr)
                generated_count += 1
            except Exception as exc:
                print(f"[interaction-data] {module['id']}/{req['capability']} failed: {exc}", file=sys.stderr)

    def _run_validate(self, job_id: str, composed_artifact: dict[str, Any]) -> dict[str, Any]:
        staging_dir = self.store.job_dir(job_id) / "staging" / composed_artifact["course"]["slug"]
        if staging_dir.exists():
            shutil.rmtree(staging_dir)
        self._write_course_package(staging_dir, composed_artifact)

        try:
            engine_validation = validate_package_dir(staging_dir, repo_root=self.repo_root)
        except Exception:
            shutil.rmtree(staging_dir, ignore_errors=True)
            raise
        blocking_issues: list[dict[str, Any]] = []

        if not engine_validation.get("ok"):
            blocking_issues.extend(
                {
                    "severity": "error",
                    "category": issue.get("category"),
                    "moduleId": issue.get("moduleId"),
                    "code": "engine-validation",
                    "message": issue.get("message"),
                    "suggestedFix": "Fix the generated package before export.",
                }
                for issue in engine_validation.get("errors", [])
            )

        report = {
            "ok": engine_validation.get("ok") and not blocking_issues,
            "engineValidation": engine_validation,
            "qualityIssues": [],
            "blockingIssues": blocking_issues,
            "stagingDir": str(staging_dir),
        }
        self.store.write_log(job_id, "validate", json.dumps(report, ensure_ascii=False, indent=2))
        return report

    def _run_export(
        self,
        job_id: str,
        request_payload: dict[str, Any],
        composed_artifact: dict[str, Any],
        validation_artifact: dict[str, Any],
    ) -> dict[str, Any]:
        if validation_artifact["blockingIssues"]:
            messages = [item["message"] for item in validation_artifact["blockingIssues"]]
            raise ValueError(f"validation blocked export: {messages}")

        output_dir = self.generated_root / request_payload["output_slug"]
        if output_dir.exists():
            if not request_payload.get("overwrite"):
                raise ValueError(f"output already exists: {output_dir}")
            shutil.rmtree(output_dir)

        self._write_course_package(output_dir, composed_artifact)
        post_export_validation = validate_package_dir(output_dir, repo_root=self.repo_root)
        if not post_export_validation.get("ok"):
            raise ValueError(f"post-export validation failed: {issue_messages(post_export_validation)}")

        export_artifact = {
            "outputSlug": request_payload["output_slug"],
            "outputDir": str(output_dir),
            "chapterCount": len(composed_artifact["chapters"]),
            "chapterIds": [chapter["id"] for chapter in composed_artifact["chapters"]],
            "moduleCount": len(composed_artifact["chapters"]),
            "moduleIds": [chapter["id"] for chapter in composed_artifact["chapters"]],
            "postExportValidation": {
                "ok": post_export_validation["ok"],
                "warningCount": len(post_export_validation.get("warnings", [])),
            },
        }
        self.store.write_log(job_id, "export", json.dumps(export_artifact, ensure_ascii=False, indent=2))
        return export_artifact

    def _build_course_record(self, plan_artifact: dict[str, Any], chapters: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "id": plan_artifact["id"],
            "slug": plan_artifact["slug"],
            "title": plan_artifact["title"],
            "subtitle": plan_artifact["subtitle"],
            "topic": plan_artifact["topic"],
            "language": plan_artifact.get("language") or "zh",
            "status": "draft",
            "register": plan_artifact["register"],
            "writingMode": plan_artifact.get("writingMode"),
            "knowledgeType": plan_artifact["knowledgeType"],
            "drivingQuestion": plan_artifact["drivingQuestion"],
            "centralTension": plan_artifact["centralTension"],
            "contract": plan_artifact.get("contract"),
            "problemFraming": (plan_artifact.get("contract") or {}).get("problemFraming"),
            "factSpine": plan_artifact.get("factSpine") or [],
            "overview": plan_artifact["overview"],
            "chapters": [chapter["id"] for chapter in chapters],
        }

    def _write_course_package(self, output_dir: Path, artifact: dict[str, Any]) -> None:
        ensure_dir(output_dir / "chapters")
        ensure_dir(output_dir / "review")
        write_json_atomic(output_dir / "course.json", artifact["course"])
        for chapter in artifact["chapters"]:
            write_json_atomic(output_dir / "chapters" / f"{chapter['id']}.json", chapter)
        write_json_atomic(output_dir / "review" / "approval.json", artifact["review_approval"])
