from fastapi import FastAPI

from .models import TopicFramingOutput, TopicRequest
from .workflow import WORKFLOW_V1, retry_policy

app = FastAPI(title="Learning Site Agent Backend", version="0.1.0")


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
    audience = req.audience or "想系统理解复杂主题的中文学习者"
    return TopicFramingOutput(
        topic=req.topic,
        audience=audience,
        learning_goals=req.goals or [f"建立对 {req.topic} 的结构化理解"],
        non_goals=["不覆盖所有边缘细节", "不直接追求百科式完整性"],
        assumptions=req.constraints or ["需要保留 human review gate"],
        scope_statement=f"围绕 {req.topic} 构建可视化学习路径，优先焦点问题、结构外显和 worked examples。",
    )
