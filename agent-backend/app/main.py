from fastapi import FastAPI

from .models import (
    CurriculumPlanningOutput,
    DraftCoursePackage,
    PlannedModule,
    TopicFramingOutput,
    TopicRequest,
)
from .workflow import WORKFLOW_V1, retry_policy

app = FastAPI(title="Learning Site Agent Backend", version="0.1.0")


def _default_audience(req: TopicRequest) -> str:
    return req.audience or "想系统理解复杂主题的中文学习者"


def _postgresql_modules() -> list[PlannedModule]:
    return [
        PlannedModule(
            id="s01",
            title="Pages, Tuples 与 Heap Storage",
            module_kind="system-overview",
            primary_cognitive_action="trace",
            focus_question="一行数据写进 PostgreSQL 后，到底以什么形状躺在磁盘里？",
            misconception="表就是抽象网格，而不是 page 与 tuple 结构。",
            target_chunk="table -> heap page -> tuple -> tuple header",
        ),
        PlannedModule(
            id="s02",
            title="MVCC 与 Visibility",
            module_kind="mechanism-walkthrough",
            primary_cognitive_action="trace",
            focus_question="PostgreSQL 怎么让并发事务看到各自的真相？",
            misconception="事务隔离主要靠整表锁住。",
            prerequisites=["s01"],
            target_chunk="xmin/xmax + snapshot -> tuple visibility",
        ),
        PlannedModule(
            id="s03",
            title="WAL 与 Crash Recovery",
            module_kind="mechanism-walkthrough",
            primary_cognitive_action="trace",
            focus_question="机器崩了之后，数据库怎么把世界补回一致？",
            misconception="把数据页直接写盘就足够安全。",
            prerequisites=["s01"],
            target_chunk="redo log -> checkpoint -> crash recovery",
        ),
        PlannedModule(
            id="s04",
            title="B-Tree Index Internals",
            module_kind="mechanism-walkthrough",
            primary_cognitive_action="trace",
            focus_question="索引为什么快，又为什么会分裂、膨胀、退化？",
            misconception="索引只是一个逻辑加速开关。",
            prerequisites=["s01"],
            target_chunk="B-Tree node/page -> search path -> split/bloat",
        ),
        PlannedModule(
            id="s05",
            title="Planner / Executor Pipeline",
            module_kind="system-overview",
            primary_cognitive_action="compare",
            focus_question="同一条 SQL，为什么有时用索引、有时顺序扫描？",
            misconception="plan 基本是 SQL 的固定翻译。",
            prerequisites=["s04"],
            target_chunk="SQL -> planner -> plan -> executor",
        ),
        PlannedModule(
            id="s06",
            title="VACUUM / Autovacuum / Freeze",
            module_kind="integration-review",
            primary_cognitive_action="rebuild",
            focus_question="如果 MVCC 不断制造旧版本，PostgreSQL 为什么不会被历史垃圾淹没？",
            misconception="删除就是删掉，系统会自然变干净。",
            prerequisites=["s02", "s04", "s05"],
            target_chunk="MVCC debt -> vacuum / autovacuum / freeze -> long-term health",
        ),
    ]


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "agent-backend",
        "mode": "skeleton",
    }


@app.get("/workflow")
def workflow():
    return {
        "workflow": [stage.model_dump() for stage in WORKFLOW_V1],
        "retry_policy": retry_policy(),
    }


@app.post("/topic-framing/dry-run", response_model=TopicFramingOutput)
def topic_framing_dry_run(req: TopicRequest):
    audience = _default_audience(req)
    return TopicFramingOutput(
        topic=req.topic,
        audience=audience,
        learning_goals=req.goals or [f"建立对 {req.topic} 的结构化理解"],
        non_goals=["不覆盖所有边缘细节", "不直接追求百科式完整性"],
        assumptions=req.constraints or ["需要保留 human review gate"],
        scope_statement=f"围绕 {req.topic} 构建可视化学习路径，优先焦点问题、结构外显和 worked examples。",
    )


@app.post("/curriculum-planning/dry-run", response_model=CurriculumPlanningOutput)
def curriculum_planning_dry_run(req: TopicRequest):
    topic = req.topic.lower()
    if "postgres" in topic:
        modules = _postgresql_modules()
        return CurriculumPlanningOutput(module_ids=[m.id for m in modules], modules=modules)

    modules = [
        PlannedModule(
            id="s01",
            title=f"{req.topic} 的核心概念",
            module_kind="concept-clarification",
            primary_cognitive_action="distinguish",
            focus_question=f"{req.topic} 里最容易被误解的核心概念到底是什么？",
            target_chunk=f"{req.topic} core concepts",
        ),
        PlannedModule(
            id="s02",
            title=f"{req.topic} 的关键机制",
            module_kind="mechanism-walkthrough",
            primary_cognitive_action="trace",
            focus_question=f"{req.topic} 中最关键的因果机制是怎样发生的？",
            prerequisites=["s01"],
            target_chunk=f"{req.topic} key mechanism",
        ),
    ]
    return CurriculumPlanningOutput(module_ids=[m.id for m in modules], modules=modules)


@app.post("/draft-course-package/dry-run", response_model=DraftCoursePackage)
def draft_course_package_dry_run(req: TopicRequest):
    framing = topic_framing_dry_run(req)
    plan = curriculum_planning_dry_run(req)
    return DraftCoursePackage(
        id=req.topic.lower().replace(" ", "-").replace("/", "-"),
        title=req.topic,
        topic=req.topic,
        audience=framing.audience,
        learning_goals=framing.learning_goals,
        module_graph_order=plan.module_ids,
        modules=plan.modules,
    )
