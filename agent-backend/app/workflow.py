WORKFLOW_V1: list[dict[str, str]] = [
    {"id": "plan", "title": "Course Planning", "review_requirement": "internal", "output_type": "course-plan"},
    {"id": "compose", "title": "Module Composition", "review_requirement": "internal", "output_type": "course-package-draft"},
    {"id": "validate", "title": "Validation + QA", "review_requirement": "internal", "output_type": "validation-report"},
    {"id": "export", "title": "Export Waiting Review", "review_requirement": "required", "output_type": "course-package"},
]

TOPIC_TYPE_SEEDS: dict[str, dict[str, object]] = {
    "internals": {
        "description": "系统内部机制（数据库、编译器、运行时）",
        "recommended_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("integration-review", "rebuild"),
        ],
    },
    "theory": {
        "description": "理论框架（ML、统计、算法）",
        "recommended_sequence": [
            ("concept-clarification", "distinguish"),
            ("concept-clarification", "distinguish"),
            ("mechanism-walkthrough", "trace"),
            ("meta-reflection", "reflect"),
        ],
    },
    "workflow": {
        "description": "流程与方法论（CI/CD、设计思维、事件响应）",
        "recommended_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("case-study", "simulate"),
        ],
    },
    "system-overview": {
        "description": "系统架构全景（分布式系统、网络协议栈）",
        "recommended_sequence": [
            ("system-overview", "compare"),
            ("mechanism-walkthrough", "trace"),
            ("mechanism-walkthrough", "trace"),
            ("integration-review", "rebuild"),
        ],
    },
    "case-study": {
        "description": "案例分析与权衡（安全事件、架构决策）",
        "recommended_sequence": [
            ("concept-clarification", "distinguish"),
            ("case-study", "simulate"),
            ("meta-reflection", "reflect"),
        ],
    },
}

DEFAULT_TOPIC_TYPE = "system-overview"


def classify_topic_type(topic: str) -> str:
    lowered = topic.lower()
    for signal in ["internal", "核心原理", "引擎", "kernel", "runtime", "compiler", "数据库内部", "internals"]:
        if signal in lowered:
            return "internals"
    for signal in ["theory", "理论", "数学", "统计", "算法基础", "foundations"]:
        if signal in lowered:
            return "theory"
    for signal in ["workflow", "流程", "pipeline", "ci/cd", "方法论", "实践指南"]:
        if signal in lowered:
            return "workflow"
    for signal in ["case", "案例", "事件", "事故", "tradeoff", "权衡", "incident", "postmortem"]:
        if signal in lowered:
            return "case-study"
    return DEFAULT_TOPIC_TYPE


def planning_seed_for_topic(topic: str) -> dict[str, object]:
    topic_type = classify_topic_type(topic)
    seed = TOPIC_TYPE_SEEDS[topic_type]
    return {
        "topic_type": topic_type,
        "type_description": seed["description"],
        "recommended_sequence": seed["recommended_sequence"],
    }


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
