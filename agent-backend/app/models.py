from typing import Literal
from pydantic import BaseModel, Field

WorkflowStageId = Literal[
    "topic-framing",
    "curriculum-planning",
    "research-synthesis",
    "module-composition",
    "visual-mapping",
    "qa-critique",
    "human-review-gate",
    "export-course-package",
    "validate-build",
]

class TopicRequest(BaseModel):
    topic: str = Field(..., description="What the user wants to learn")
    audience: str | None = None
    goals: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)

class TopicFramingOutput(BaseModel):
    topic: str
    audience: str
    learning_goals: list[str]
    non_goals: list[str]
    assumptions: list[str]
    scope_statement: str

class PlannedModule(BaseModel):
    id: str
    title: str
    module_kind: str
    primary_cognitive_action: str
    focus_question: str
    misconception: str | None = None
    prerequisites: list[str] = Field(default_factory=list)
    target_chunk: str | None = None

class CurriculumPlanningOutput(BaseModel):
    module_ids: list[str]
    modules: list[PlannedModule]

class DraftCoursePackage(BaseModel):
    id: str
    title: str
    topic: str
    audience: str
    learning_goals: list[str]
    module_graph_order: list[str]
    modules: list[PlannedModule]

class WorkflowStage(BaseModel):
    id: WorkflowStageId
    title: str
    review_requirement: Literal["required", "recommended", "optional"]
    output_type: str
