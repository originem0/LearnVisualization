WORKFLOW_V1: list[dict[str, str]] = [
    {"id": "topic-framing", "title": "Topic Framing", "review_requirement": "required", "output_type": "topic-framing"},
    {"id": "curriculum-planning", "title": "Curriculum Planning", "review_requirement": "required", "output_type": "curriculum-plan"},
    {"id": "research-synthesis", "title": "Research Synthesis", "review_requirement": "recommended", "output_type": "research-synthesis"},
    {"id": "module-composition", "title": "Module Composition", "review_requirement": "required", "output_type": "module-draft"},
    {"id": "visual-mapping", "title": "Visual Mapping", "review_requirement": "recommended", "output_type": "visual-spec"},
    {"id": "qa-critique", "title": "QA / Critique", "review_requirement": "optional", "output_type": "critique-report"},
    {"id": "human-review-gate", "title": "Human Review Gate", "review_requirement": "required", "output_type": "approval-decision"},
    {"id": "export-course-package", "title": "Export to Course Package", "review_requirement": "optional", "output_type": "course-package"},
    {"id": "validate-build", "title": "Validate + Build", "review_requirement": "optional", "output_type": "validation-report"},
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
