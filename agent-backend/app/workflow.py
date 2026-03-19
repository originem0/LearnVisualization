from .models import WorkflowStage

WORKFLOW_V1: list[WorkflowStage] = [
    WorkflowStage(id="topic-framing", title="Topic Framing", review_requirement="required", output_type="TopicFramingOutput"),
    WorkflowStage(id="curriculum-planning", title="Curriculum Planning", review_requirement="required", output_type="CurriculumPlanningOutput"),
    WorkflowStage(id="research-synthesis", title="Research Synthesis", review_requirement="recommended", output_type="ResearchSynthesisOutput"),
    WorkflowStage(id="module-composition", title="Module Composition", review_requirement="required", output_type="ModuleCompositionOutput"),
    WorkflowStage(id="visual-mapping", title="Visual Mapping", review_requirement="recommended", output_type="VisualMappingOutput"),
    WorkflowStage(id="qa-critique", title="QA / Critique", review_requirement="optional", output_type="CritiqueOutput"),
    WorkflowStage(id="human-review-gate", title="Human Review Gate", review_requirement="required", output_type="approval-decision"),
    WorkflowStage(id="export-course-package", title="Export to Course Package", review_requirement="optional", output_type="CoursePackage"),
    WorkflowStage(id="validate-build", title="Validate + Build", review_requirement="optional", output_type="validation-report"),
]


def retry_policy() -> dict:
    return {
        "max_retries": 3,
        "strategy": "exponential_backoff",
        "retryable_failures": [
            "provider_timeout",
            "network_error",
            "transient_fetch_error",
        ],
    }
