from __future__ import annotations

import json
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from typing import Any

try:
    from .common import ensure_dir, issue_messages, now_iso, slugify, validate_package_dir, write_json_atomic
    from .job_store import JobStore
    from .prompt_assets import PROMPT_VERSION, build_module_prompts, build_plan_prompts, build_interaction_component_prompt
    from .provider import OpenAICompatibleClient, ProviderConfig, ProviderError
    from .component_writer import (
        extract_code_from_response,
        generate_component_name,
        register_component_in_whitelist,
        validate_component_code,
        write_interactive_component,
    )
    from .quality import (
        build_concept_map,
        build_interaction_registry,
        normalize_module_payload,
        normalize_plan_payload,
        run_quality_checks,
    )
    from .workflow import planning_seed_for_topic
except ImportError:
    from common import ensure_dir, issue_messages, now_iso, slugify, validate_package_dir, write_json_atomic
    from job_store import JobStore
    from prompt_assets import PROMPT_VERSION, build_module_prompts, build_plan_prompts, build_interaction_component_prompt
    from provider import OpenAICompatibleClient, ProviderConfig, ProviderError
    from component_writer import (
        extract_code_from_response,
        generate_component_name,
        register_component_in_whitelist,
        validate_component_code,
        write_interactive_component,
    )
    from quality import (
        build_concept_map,
        build_interaction_registry,
        normalize_module_payload,
        normalize_plan_payload,
        run_quality_checks,
    )
    from workflow import planning_seed_for_topic

MAX_CONCURRENT_JOBS = 3


class CancelledError(Exception):
    """Raised when a job is cancelled via cooperative cancellation."""


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

    def _submit_job(self, job_id: str) -> None:
        """Submit a job to the thread pool."""
        with self._lock:
            self._cancel_events[job_id] = threading.Event()
        self._executor.submit(self._run_job_wrapper, job_id)

    def _run_job_wrapper(self, job_id: str) -> None:
        """Wrapper that runs in the thread pool and cleans up cancel events."""
        try:
            self.run_job(job_id)
        except Exception:
            pass  # run_job already marks the job as failed
        finally:
            with self._lock:
                self._cancel_events.pop(job_id, None)

    def create_job(self, request_payload: dict[str, Any], *, run_async: bool = True) -> dict[str, Any]:
        if not request_payload.get("topic"):
            raise ValueError("topic is required")

        request_payload = {
            **request_payload,
            "output_slug": request_payload.get("output_slug") or slugify(request_payload["topic"]),
            "overwrite": bool(request_payload.get("overwrite", False)),
        }
        output_slug = request_payload["output_slug"]

        # --- Duplicate detection ---
        # 1. Already-published course
        courses_root = self.repo_root / "courses"
        if (courses_root / output_slug / "course.json").exists():
            raise ValueError(f"课程 '{output_slug}' 已存在于 courses/ 中，如需重新生成请先删除")
        # 2. Already-generated output
        if (self.generated_root / output_slug).exists():
            raise ValueError(f"课程 '{output_slug}' 已生成，如需重新生成请先删除")
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
        return self.store.load_job(job["id"])

    def cancel_job(self, job_id: str) -> dict[str, Any]:
        """Cancel a queued or running job."""
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
        job = self.store.load_job(job_id)
        status = job.get("status")
        if status in ("queued", "running"):
            raise ValueError("cannot delete a queued/running job — cancel it first")

        # Remove generated output directory
        output_slug = (job.get("request") or {}).get("output_slug")
        if output_slug:
            output_dir = self.generated_root / output_slug
            if output_dir.exists():
                shutil.rmtree(output_dir)

        # Remove job directory
        self.store.delete_job(job_id)
        return {"deleted": True, "id": job_id}

    def run_job(self, job_id: str) -> dict[str, Any]:
        job = self.store.load_job(job_id)
        request_payload = job["request"]

        # Determine which stages to skip (already succeeded from prior run)
        stage_status = {s["name"]: s["status"] for s in job["stages"]}

        try:
            self._check_cancelled(job_id)

            # --- PLAN ---
            if stage_status.get("plan") == "succeeded" and job["artifacts"].get("plan"):
                plan_artifact = json.loads(Path(job["artifacts"]["plan"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "plan")
                plan_artifact = self._run_plan(job_id, request_payload)
                plan_path = self.store.store_stage_artifact(job_id, "plan", plan_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "plan",
                    artifact_path=plan_path,
                    summary={"moduleCount": len(plan_artifact["moduleOutlines"]), "categoryCount": len(plan_artifact["categories"])},
                )

            self._check_cancelled(job_id)

            # --- COMPOSE (with per-module checkpointing) ---
            if stage_status.get("compose") == "succeeded" and job["artifacts"].get("compose"):
                composed_artifact = json.loads(Path(job["artifacts"]["compose"]).read_text("utf-8"))
            else:
                self.store.mark_stage_running(job_id, "compose")
                composed_artifact = self._run_compose(job_id, request_payload, plan_artifact)
                compose_path = self.store.store_stage_artifact(job_id, "compose", composed_artifact)
                self.store.mark_stage_success(
                    job_id,
                    "compose",
                    artifact_path=compose_path,
                    summary={"moduleCount": len(composed_artifact["modules"]), "outputSlug": composed_artifact["course"]["slug"]},
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
            self.store.mark_waiting_review(
                job_id,
                output_dir=Path(export_artifact["outputDir"]),
                summary={
                    "outputSlug": export_artifact["outputSlug"],
                    "moduleCount": export_artifact["moduleCount"],
                    "readyForPromote": False,
                    "reviewStatus": "pending",
                },
            )
            return self.store.load_job(job_id)
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
        return self.store.load_job(job_id)

    def get_artifacts(self, job_id: str) -> dict[str, str]:
        return self.store.artifact_index(job_id)

    def retry_job(self, job_id: str, *, stage: str | None = None) -> dict[str, Any]:
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
        job = self.store.load_job(job_id)
        output_dir = Path((job.get("artifacts") or {}).get("output") or "")
        if not output_dir:
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
            self.store.mark_completed(job_id)
            updated_job = self.store.load_job(job_id)
        return updated_job

    def _run_plan(self, job_id: str, request_payload: dict[str, Any]) -> dict[str, Any]:
        seed = planning_seed_for_topic(request_payload["topic"])
        system_prompt, user_prompt = build_plan_prompts(request_payload, seed)
        response = self.client.generate_json(
            schema_name="course_plan",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )
        self.store.write_log(
            job_id,
            "plan",
            json.dumps(
                {
                    "systemPrompt": system_prompt,
                    "userPrompt": user_prompt,
                    "response": response["content"],
                    "usage": response["usage"],
                },
                ensure_ascii=False,
                indent=2,
            ),
        )
        return normalize_plan_payload(
            response["content"],
            topic=request_payload["topic"],
            slug=request_payload["output_slug"],
        )

    def _run_compose(
        self,
        job_id: str,
        request_payload: dict[str, Any],
        plan_artifact: dict[str, Any],
    ) -> dict[str, Any]:
        modules: list[dict[str, Any]] = []
        concept_maps: dict[str, Any] = {}
        interaction_registry: dict[str, Any] = {}
        compose_logs: list[dict[str, Any]] = []
        outlines = plan_artifact["moduleOutlines"]

        # Load checkpoint if previous compose attempt partially completed
        checkpoint_path = self.store.job_dir(job_id) / "stages" / "compose_checkpoint.json"
        if checkpoint_path.exists():
            try:
                from .common import read_json
            except ImportError:
                from common import read_json
            checkpoint = read_json(checkpoint_path)
            modules = checkpoint.get("modules", [])
            concept_maps = checkpoint.get("concept_maps", {})
            interaction_registry = checkpoint.get("interaction_registry", {})
            compose_logs = checkpoint.get("compose_logs", [])

        completed_ids = {m["id"] for m in modules}
        module_retries = int(self.client.config.max_retries) + 1

        for index, outline in enumerate(outlines, start=1):
            if outline["id"] in completed_ids:
                continue  # skip already-completed modules from checkpoint

            # Check cancellation before each module
            self._check_cancelled(job_id)

            next_module_id = outlines[index]["id"] if index < len(outlines) else None
            system_prompt, user_prompt = build_module_prompts(
                request_payload=request_payload,
                course_plan=plan_artifact,
                module_outline=outline,
                module_index=index,
                module_count=len(outlines),
            )

            # Per-module retry loop
            last_error: Exception | None = None
            for attempt in range(module_retries):
                try:
                    response = self.client.generate_json(
                        schema_name=f"{outline['id']}_module",
                        system_prompt=system_prompt,
                        user_prompt=user_prompt,
                    )
                    module = normalize_module_payload(
                        response["content"],
                        module_outline=outline,
                        next_module_id=next_module_id,
                    )
                    modules.append(module)
                    concept_maps[module["id"]] = build_concept_map(module)
                    interaction_registry[module["id"]] = build_interaction_registry(module)

                    # Generate interactive components for core interactions
                    self._generate_interaction_components(
                        module, request_payload["output_slug"], job_id, compose_logs
                    )

                    compose_logs.append(
                        {
                            "moduleId": module["id"],
                            "systemPrompt": system_prompt,
                            "userPrompt": user_prompt,
                            "response": response["content"],
                            "usage": response["usage"],
                            "attempt": attempt + 1,
                        }
                    )
                    last_error = None
                    break  # success, move to next module
                except Exception as exc:
                    last_error = exc
                    import time
                    time.sleep(1.0 * (2 ** attempt))  # backoff between module retries

            # Save checkpoint after each module (success or final failure)
            write_json_atomic(checkpoint_path, {
                "modules": modules,
                "concept_maps": concept_maps,
                "interaction_registry": interaction_registry,
                "compose_logs": compose_logs,
            })

            # Update compose stage summary so polling clients can see progress
            job = self.store.load_job(job_id)
            compose_stage = next(s for s in job["stages"] if s["name"] == "compose")
            compose_stage["summary"] = {
                "modulesCompleted": len(modules),
                "modulesTotal": len(outlines),
                "currentModule": outlines[index]["title"] if index < len(outlines) else None,
            }
            self.store.write_job(job)

            if last_error is not None:
                raise last_error  # propagate after checkpoint saved

        self.store.write_log(job_id, "compose", json.dumps(compose_logs, ensure_ascii=False, indent=2))
        course = self._build_course_record(plan_artifact, modules)
        return {
            "course": course,
            "modules": modules,
            "concept_maps": concept_maps,
            "interaction_registry": interaction_registry,
            "review_approval": {
                "approved": False,
                "reviewedBy": "",
                "reviewedAt": "",
                "notes": "Generated by course pipeline. Human review approval is required before promote.",
            },
        }

    def _generate_interaction_components(
        self,
        module: dict[str, Any],
        course_slug: str,
        job_id: str,
        compose_logs: list[dict[str, Any]],
    ) -> None:
        """Generate React interactive components for core interaction requirements."""
        import sys

        for idx, req in enumerate(module.get("interactionRequirements") or []):
            if req.get("priority") != "core":
                continue
            if req.get("componentHint"):
                continue  # already has a component

            component_name = generate_component_name(course_slug, module["id"], req["capability"], idx)

            try:
                sys_prompt, usr_prompt = build_interaction_component_prompt(
                    component_name=component_name,
                    module=module,
                    interaction=req,
                )

                # Try up to 2 attempts
                code = ""
                for gen_attempt in range(2):
                    response = self.client.generate_text(
                        system_prompt=sys_prompt,
                        user_prompt=usr_prompt,
                        temperature=0.3,
                        max_tokens=12000,
                    )
                    code = extract_code_from_response(response["content"])
                    issues = validate_component_code(code, component_name)
                    if not issues:
                        break
                    print(f"[component-gen] {component_name} attempt {gen_attempt + 1} issues: {issues}", file=sys.stderr)

                if validate_component_code(code, component_name):
                    print(f"[component-gen] {component_name} failed validation after retries, skipping", file=sys.stderr)
                    continue

                write_interactive_component(component_name, code, self.repo_root)
                register_component_in_whitelist(component_name, self.repo_root)
                req["componentHint"] = component_name

                compose_logs.append({
                    "type": "component_generation",
                    "moduleId": module["id"],
                    "componentName": component_name,
                    "capability": req["capability"],
                    "codeLength": len(code),
                })
                print(f"[component-gen] {component_name} generated ({len(code)} chars)", file=sys.stderr)

            except Exception as exc:
                print(f"[component-gen] {component_name} failed: {exc}", file=sys.stderr)
                # Don't block course generation
                continue

    def _run_validate(self, job_id: str, composed_artifact: dict[str, Any]) -> dict[str, Any]:
        staging_dir = self.store.job_dir(job_id) / "staging" / composed_artifact["course"]["slug"]
        if staging_dir.exists():
            shutil.rmtree(staging_dir)
        self._write_course_package(staging_dir, composed_artifact)

        engine_validation = validate_package_dir(staging_dir, repo_root=self.repo_root)
        quality_issues = run_quality_checks(composed_artifact)
        blocking_issues = [issue for issue in quality_issues if issue["severity"] == "error"]

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
            "qualityIssues": quality_issues,
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
            "moduleCount": len(composed_artifact["modules"]),
            "moduleIds": [module["id"] for module in composed_artifact["modules"]],
            "postExportValidation": {
                "ok": post_export_validation["ok"],
                "warningCount": len(post_export_validation.get("warnings", [])),
            },
        }
        self.store.write_log(job_id, "export", json.dumps(export_artifact, ensure_ascii=False, indent=2))
        return export_artifact

    def _build_course_record(self, plan_artifact: dict[str, Any], modules: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "id": plan_artifact["id"],
            "slug": plan_artifact["slug"],
            "title": plan_artifact["title"],
            "subtitle": plan_artifact["subtitle"],
            "goal": plan_artifact["goal"],
            "projectType": plan_artifact.get("projectType") or "mixed",
            "startDate": plan_artifact.get("startDate") or date.today().isoformat(),
            "topic": plan_artifact["topic"],
            "language": plan_artifact.get("language") or "zh",
            "status": "draft",
            "categories": plan_artifact["categories"],
            "audience": plan_artifact["audience"],
            "learningGoals": plan_artifact["learningGoals"],
            "nonGoals": plan_artifact.get("nonGoals") or [],
            "assumptions": plan_artifact.get("assumptions") or [],
            "philosophy": plan_artifact.get("philosophy") or {},
            "paths": plan_artifact.get("paths") or [],
            "moduleGraph": plan_artifact["moduleGraph"],
            "modules": [module["id"] for module in modules],
        }

    def _write_course_package(self, output_dir: Path, artifact: dict[str, Any]) -> None:
        ensure_dir(output_dir / "modules")
        ensure_dir(output_dir / "visuals")
        ensure_dir(output_dir / "interactions")
        ensure_dir(output_dir / "review")
        write_json_atomic(output_dir / "course.json", artifact["course"])
        for module in artifact["modules"]:
            write_json_atomic(output_dir / "modules" / f"{module['id']}.json", module)
        write_json_atomic(output_dir / "visuals" / "concept-maps.json", artifact["concept_maps"])
        write_json_atomic(output_dir / "interactions" / "registry.json", artifact["interaction_registry"])
        write_json_atomic(output_dir / "review" / "approval.json", artifact["review_approval"])
