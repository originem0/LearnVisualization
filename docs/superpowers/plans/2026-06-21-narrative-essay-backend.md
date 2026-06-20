# 叙事化重构 · 计划 4：Backend Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写后端生成引擎，从旧的"12-module pedagogical checklist"模式切换到"spine + 4–6 chapters narrative"模式。核心改动：Plan 阶段输出课程脊柱（drivingQuestion + centralTension + overview），章节生成串上一章结尾保持连续性，双语域 prompt 切换，四道防八股闸，LLM 评审闸。

**Architecture:** 新建 `agent-backend/app/essay_*` 模块族（`essay_models.py`, `essay_prompts.py`, `essay_pipeline.py`），与旧 `models.py`/`prompt_assets.py`/`pipeline.py` 并存。路由层（`workflow.py`）根据 `knowledge_type` 分发到旧/新引擎。旧引擎暂时保留（llm-fundamentals 等旧课依赖），Plan 6 完成迁移后删除。

**Tech Stack:** Python 3.10, FastAPI, OpenAI SDK (via 中转站), `essay_schema.py` (Plan 1 normalizers), 种子课程 JSON (Plan 3 few-shot examples), 设计文档 (Plan 2 原则注入)。

## Global Constraints

- 新引擎**增量并存**：不修改 `models.py`/`prompt_assets.py`/`pipeline.py` 现有逻辑，只新增 `essay_*` 模块。
- API 路由兼容：`POST /api/generate/plan` 根据 `knowledge_type` 自动选择引擎（`conceptual`/`strategic` → essay engine，其余 → legacy engine）。
- 章节生成必须**串联**：生成 Chapter N 时，传入 Chapter N-1 的最后 2 段 narrative 作为 `prev_chapter_ending`，保持 voice 连续。
- 双语域切换：根据 `register_for_knowledge_type(knowledge_type)` 返回值，加载不同的 prompt template（explainer.txt vs essay.txt）。
- 防八股四道闸：(1) Plan 阶段强制提供 3–5 个事实锚点，(2) prompt 注入 register 护栏，(3) prompt 注入 negative examples，(4) 生成后用 judge LLM 评估。
- LLM 评审闸：judge 检查"实质密度"和"疑似杜撰"，不通过 → 重写（最多 2 次）。
- `quality.py` 的旧 normalizers（`normalize_module_payload`/`normalize_plan_payload`）保持不变，新增 `essay_quality.py` 封装 Plan 1 的 `essay_schema.py`。

---

## File Structure

- Create: `agent-backend/app/essay_models.py` — Pydantic models for essay-course requests
- Create: `agent-backend/app/essay_prompts.py` — Prompt builders with register switching
- Create: `agent-backend/app/essay_pipeline.py` — Orchestration: plan → chapters (with continuity)
- Create: `agent-backend/app/essay_quality.py` — Wrapper around essay_schema.py + LLM judge
- Create: `agent-backend/prompts/explainer.txt` — Explainer register prompt template
- Create: `agent-backend/prompts/essay.txt` — Essay register prompt template
- Create: `agent-backend/prompts/judge.txt` — LLM judge evaluation prompt
- Create: `agent-backend/tests/test_essay_pipeline.py` — Pipeline integration tests
- Modify: `agent-backend/app/workflow.py` — Add `/api/generate/essay-plan` and `/api/generate/essay-chapter` endpoints

---

### Task 1: Essay-Course Pydantic Models

**Files:**
- Create: `agent-backend/app/essay_models.py`

**Interfaces:**
- Consumes: API requests
- Produces: Validated request objects for pipeline

- [ ] **Step 1: Define EssayPlanRequest**

```python
from pydantic import BaseModel, Field
from typing import List, Literal

class EssayPlanRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., pattern=r'^[a-z0-9-]+$')
    knowledge_type: Literal['conceptual', 'strategic', 'procedural', 'factual', 'situational']
    language: Literal['zh', 'en'] = 'zh'
    
class EssayPlanResponse(BaseModel):
    id: str
    slug: str
    title: str
    subtitle: str
    topic: str
    language: str
    register: Literal['explainer', 'essay']
    knowledge_type: str
    driving_question: str
    central_tension: str
    overview: dict  # {whyExists, wherePoints, arc}
    chapters: List[str]  # ["c01", "c02", ...]
    fact_spine: List[str]  # 3-5 verifiable facts
```

- [ ] **Step 2: Define EssayChapterRequest**

```python
class EssayChapterRequest(BaseModel):
    course_id: str
    chapter_id: str = Field(..., pattern=r'^c\d{2}$')
    chapter_number: int = Field(..., ge=1, le=10)
    chapter_title: str
    chapter_role: str  # unfold/deepen/pivot/converge
    prev_chapter_ending: str | None = None  # last 2 paragraphs of prev chapter
    course_context: dict  # {drivingQuestion, centralTension, register, arc}
    
class EssayChapterResponse(BaseModel):
    id: str
    number: int
    title: str
    role: str
    narrative: List[dict]  # EssayNarrativeBlock[]
    highlight: dict | None
    bridge: str | None
```

- [ ] **Step 3: Write tests**

```python
# agent-backend/tests/test_essay_models.py
def test_essay_plan_request_valid():
    req = EssayPlanRequest(
        topic="分布式一致性",
        slug="distributed-consistency",
        knowledge_type="conceptual"
    )
    assert req.language == "zh"
    
def test_essay_chapter_request_validates_chapter_id():
    with pytest.raises(ValidationError):
        EssayChapterRequest(
            course_id="test",
            chapter_id="ch01",  # Invalid: should be c01
            chapter_number=1,
            chapter_title="Title",
            chapter_role="unfold",
            course_context={}
        )
```

Run: `python3 -m pytest agent-backend/tests/test_essay_models.py`

---

### Task 2: Prompt Builders with Register Switching

**Files:**
- Create: `agent-backend/app/essay_prompts.py`
- Create: `agent-backend/prompts/explainer.txt`
- Create: `agent-backend/prompts/essay.txt`
- Create: `agent-backend/prompts/judge.txt`

**Interfaces:**
- Consumes: EssayPlanRequest, EssayChapterRequest, seed courses JSON (Plan 3)
- Produces: Formatted prompts for LLM

- [ ] **Step 1: Write `build_plan_prompt()`**

```python
from pathlib import Path
from essay_schema import register_for_knowledge_type

def load_design_principles() -> str:
    """Load narrative principles from Plan 2 design docs."""
    design_dir = Path(__file__).parents[2] / "design"
    # Read design/04-agent-contract.md sections on narrative
    ...
    
def load_seed_example(register: str) -> dict:
    """Load seed course as few-shot example."""
    seed_dir = Path(__file__).parents[2] / "courses" / f"seed-{register}"
    with open(seed_dir / "course.json") as f:
        return json.load(f)

def build_plan_prompt(request: EssayPlanRequest) -> str:
    register = register_for_knowledge_type(request.knowledge_type)
    principles = load_design_principles()
    seed = load_seed_example(register)
    
    return f"""You are planning a course on: {request.topic}

## Knowledge Type & Register
- Knowledge type: {request.knowledge_type}
- Register: {register}

## Narrative Principles
{principles}

## Example Course (same register)
{json.dumps(seed, indent=2, ensure_ascii=False)}

## Your Task
Generate a course plan following the essay-course schema:
1. drivingQuestion: One real question worth answering
2. centralTension: Why this question is hard/important (not decorative)
3. overview.arc: 4-6 chapter titles showing narrative arc
4. fact_spine: 3-5 verifiable facts/cases to anchor the narrative

Output JSON matching EssayPlanResponse schema."""
```

- [ ] **Step 2: Write register-specific chapter prompts**

**explainer.txt:**
```
You are writing Chapter {number}: {title}

## Context
Course: {drivingQuestion}
Your role in arc: {role}
Previous chapter ending:
{prev_chapter_ending}

## Register: Explainer
Style: Tech blogger (3Blue1Brown, Fireship)
Voice: "你" (direct address)
Focus: How things work, step-by-step traces

## Anti-Pastiche Guards
DON'T:
- "你有没有想过..." opening
- Philosophical name-dropping
- Metaphors for metaphor's sake
- "其实" / "实际上" filler

DO:
- Start with code/example
- Trace execution step-by-step
- Use concrete numbers (not "很多")
- Visual analogies anchored to mechanism

## Output
JSON with narrative blocks (text/heading/code/callout). 15-25 blocks, ~2000 words.
```

**essay.txt:**
```
You are writing Chapter {number}: {title}

## Context
Course: {drivingQuestion}
Your role in arc: {role}
Previous chapter ending:
{prev_chapter_ending}

## Register: Essay
Style: Philosophical essay (script_background reference)
Voice: Stance allowed ("我认为"), inquiry-driven
Focus: Why concepts matter, trade-offs, tensions

## Anti-Pastiche Guards
DON'T:
- Fake profundity ("深刻金句")
- Tech jargon pile-up
- Code examples as filler
- "让我们思考..." empty prompts

DO:
- Contrast concepts (X vs Y)
- Question assumptions ("为什么需要X")
- Anchor to real trade-offs
- Minimal code, maximum reasoning

## Output
JSON with narrative blocks. 15-25 blocks, ~2500 words.
```

- [ ] **Step 3: Write judge prompt**

**judge.txt:**
```
You are evaluating generated chapter content for quality.

## Chapter to evaluate:
{chapter_json}

## Evaluation criteria:
1. Substance density: Ratio of concrete facts/examples to abstract statements
   - PASS: ≥60% sentences have verifiable claims
   - FAIL: Mostly空转概念 ("很重要", "需要注意")
   
2. Hallucination detection: Check for unverifiable claims
   - RED FLAGS: "研究表明", "据统计", specific numbers without source
   - OK: Mechanism descriptions, code behavior, well-known facts
   
3. Register adherence:
   - Explainer should have code/traces, NOT philosophy
   - Essay should have reasoning, NOT code pile-up

## Output JSON:
{
  "pass": true/false,
  "substance_score": 0-100,
  "hallucination_flags": ["具体句子"],
  "register_violations": ["具体问题"],
  "rewrite_suggestion": "如果 fail，说明需要改什么"
}
```

- [ ] **Step 4: Implement `build_chapter_prompt()`**

```python
def build_chapter_prompt(request: EssayChapterRequest) -> str:
    register = request.course_context['register']
    template_file = f"prompts/{register}.txt"
    template = Path(__file__).parent / template_file
    
    return template.read_text().format(
        number=request.chapter_number,
        title=request.chapter_title,
        role=request.chapter_role,
        drivingQuestion=request.course_context['drivingQuestion'],
        prev_chapter_ending=request.prev_chapter_ending or "(First chapter)"
    )

def build_judge_prompt(chapter_json: str, register: str) -> str:
    template = Path(__file__).parent / "prompts/judge.txt"
    return template.read_text().format(
        chapter_json=chapter_json
    )
```

- [ ] **Step 5: Test prompt building**

```python
# agent-backend/tests/test_essay_prompts.py
def test_build_plan_prompt_loads_seed():
    req = EssayPlanRequest(topic="测试", slug="test", knowledge_type="conceptual")
    prompt = build_plan_prompt(req)
    assert "register: essay" in prompt
    assert "seed-essay" in prompt or "分布式一致性" in prompt
    
def test_build_chapter_prompt_uses_correct_template():
    req = EssayChapterRequest(
        course_id="test",
        chapter_id="c01",
        chapter_number=1,
        chapter_title="测试",
        chapter_role="unfold",
        course_context={"register": "explainer", "drivingQuestion": "Q?"}
    )
    prompt = build_chapter_prompt(req)
    assert "## Register: Explainer" in prompt
```

Run: `python3 -m pytest agent-backend/tests/test_essay_prompts.py`

---

### Task 3: Pipeline Orchestration with Continuity

**Files:**
- Create: `agent-backend/app/essay_pipeline.py`

**Interfaces:**
- Consumes: EssayPlanRequest, LLM API
- Produces: EssayCourse + Chapters with continuity

- [ ] **Step 1: Implement `generate_plan()`**

```python
import openai
from essay_prompts import build_plan_prompt
from essay_schema import normalize_essay_plan_payload

async def generate_plan(request: EssayPlanRequest) -> EssayPlanResponse:
    prompt = build_plan_prompt(request)
    
    # Call LLM (via 中转站)
    response = await openai.ChatCompletion.acreate(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )
    
    raw_payload = json.loads(response.choices[0].message.content)
    
    # Normalize with essay_schema
    normalized = normalize_essay_plan_payload(
        raw_payload,
        topic=request.topic,
        slug=request.slug
    )
    
    return EssayPlanResponse(**normalized)
```

- [ ] **Step 2: Implement `generate_chapter()` with continuity**

```python
from essay_quality import judge_chapter

async def generate_chapter(
    request: EssayChapterRequest,
    max_retries: int = 2
) -> EssayChapterResponse:
    prompt = build_chapter_prompt(request)
    
    for attempt in range(max_retries + 1):
        response = await openai.ChatCompletion.acreate(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8
        )
        
        raw_payload = json.loads(response.choices[0].message.content)
        
        # Normalize
        normalized = normalize_chapter_payload(
            raw_payload,
            chapter_id=request.chapter_id,
            number=request.chapter_number
        )
        
        # Judge gate
        judgment = await judge_chapter(normalized, request.course_context['register'])
        
        if judgment['pass']:
            return EssayChapterResponse(**normalized)
        
        # Retry with feedback
        prompt += f"\n\n## Previous attempt failed:\n{judgment['rewrite_suggestion']}"
    
    # Max retries exhausted, return best effort with warning
    normalized['_quality_warning'] = "Failed judge after 2 retries"
    return EssayChapterResponse(**normalized)
```

- [ ] **Step 3: Implement `generate_full_course()`**

```python
async def generate_full_course(request: EssayPlanRequest) -> dict:
    # Step 1: Generate plan
    plan = await generate_plan(request)
    
    # Step 2: Generate chapters sequentially with continuity
    chapters = []
    prev_ending = None
    
    for i, chapter_id in enumerate(plan.chapters, 1):
        chapter_req = EssayChapterRequest(
            course_id=plan.id,
            chapter_id=chapter_id,
            chapter_number=i,
            chapter_title=plan.overview['arc'][i-1],
            chapter_role=_infer_role(i, len(plan.chapters)),
            prev_chapter_ending=prev_ending,
            course_context={
                'drivingQuestion': plan.driving_question,
                'centralTension': plan.central_tension,
                'register': plan.register,
                'arc': plan.overview['arc']
            }
        )
        
        chapter = await generate_chapter(chapter_req)
        chapters.append(chapter)
        
        # Extract last 2 paragraphs for next chapter
        text_blocks = [b for b in chapter.narrative if b['type'] == 'text']
        prev_ending = '\n\n'.join([b['content'] for b in text_blocks[-2:]])
    
    return {'course': plan.dict(), 'chapters': [c.dict() for c in chapters]}

def _infer_role(number: int, total: int) -> str:
    if number == 1:
        return "unfold"
    elif number == total:
        return "converge"
    elif number > total // 2:
        return "pivot"
    else:
        return "deepen"
```

- [ ] **Step 4: Test pipeline with mocked LLM**

```python
# agent-backend/tests/test_essay_pipeline.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_generate_plan_calls_llm():
    with patch('essay_pipeline.openai.ChatCompletion.acreate', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockResponse(content='{"title": "测试", ...}')
        
        req = EssayPlanRequest(topic="测试", slug="test", knowledge_type="conceptual")
        plan = await generate_plan(req)
        
        assert mock_llm.call_count == 1
        assert plan.register == "essay"

@pytest.mark.asyncio
async def test_generate_chapter_retries_on_judge_fail():
    with patch('essay_pipeline.openai.ChatCompletion.acreate', new_callable=AsyncMock) as mock_llm, \
         patch('essay_quality.judge_chapter', new_callable=AsyncMock) as mock_judge:
        
        # First attempt fails, second passes
        mock_judge.side_effect = [
            {'pass': False, 'rewrite_suggestion': '缺乏事实'},
            {'pass': True}
        ]
        mock_llm.return_value = MockResponse(content='{"narrative": [...]}')
        
        req = EssayChapterRequest(...)
        chapter = await generate_chapter(req)
        
        assert mock_llm.call_count == 2  # Retry happened
```

Run: `python3 -m pytest agent-backend/tests/test_essay_pipeline.py`

---

### Task 4: LLM Judge Wrapper

**Files:**
- Create: `agent-backend/app/essay_quality.py`

**Interfaces:**
- Consumes: Generated chapter JSON, register
- Produces: Judge verdict (pass/fail + feedback)

- [ ] **Step 1: Implement `judge_chapter()`**

```python
import openai
from essay_prompts import build_judge_prompt

async def judge_chapter(chapter: dict, register: str) -> dict:
    prompt = build_judge_prompt(json.dumps(chapter, ensure_ascii=False), register)
    
    response = await openai.ChatCompletion.acreate(
        model="gpt-4",  # Or cheaper model for judging
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3  # Lower temp for consistent evaluation
    )
    
    judgment = json.loads(response.choices[0].message.content)
    
    # Validate judgment structure
    assert 'pass' in judgment and 'substance_score' in judgment
    
    return judgment
```

- [ ] **Step 2: Wrap essay_schema normalizers**

```python
from essay_schema import (
    register_for_knowledge_type,
    normalize_essay_plan_payload,
    normalize_chapter_payload
)

# Re-export for convenience
__all__ = [
    'register_for_knowledge_type',
    'normalize_essay_plan_payload',
    'normalize_chapter_payload',
    'judge_chapter'
]
```

- [ ] **Step 3: Test judge integration**

```python
# agent-backend/tests/test_essay_quality.py
@pytest.mark.asyncio
async def test_judge_chapter_detects_hallucination():
    chapter = {
        'narrative': [
            {'type': 'text', 'content': '研究表明 95% 的开发者不知道这个。'}
        ]
    }
    
    with patch('openai.ChatCompletion.acreate', new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = MockResponse(content='{"pass": false, "hallucination_flags": ["研究表明 95%"]}')
        
        judgment = await judge_chapter(chapter, "explainer")
        
        assert not judgment['pass']
        assert len(judgment['hallucination_flags']) > 0
```

Run: `python3 -m pytest agent-backend/tests/test_essay_quality.py`

---

### Task 5: API Endpoints

**Files:**
- Modify: `agent-backend/app/workflow.py`

**Interfaces:**
- Consumes: HTTP POST requests
- Produces: JSON responses

- [ ] **Step 1: Add essay-plan endpoint**

```python
from fastapi import APIRouter
from essay_models import EssayPlanRequest, EssayPlanResponse
from essay_pipeline import generate_plan

router = APIRouter(prefix="/api/generate")

@router.post("/essay-plan", response_model=EssayPlanResponse)
async def create_essay_plan(request: EssayPlanRequest):
    return await generate_plan(request)
```

- [ ] **Step 2: Add essay-chapter endpoint**

```python
from essay_models import EssayChapterRequest, EssayChapterResponse
from essay_pipeline import generate_chapter

@router.post("/essay-chapter", response_model=EssayChapterResponse)
async def create_essay_chapter(request: EssayChapterRequest):
    return await generate_chapter(request)
```

- [ ] **Step 3: Add full-course endpoint**

```python
@router.post("/essay-course")
async def create_full_essay_course(request: EssayPlanRequest):
    result = await generate_full_course(request)
    return result
```

- [ ] **Step 4: Add engine routing in main workflow**

```python
@router.post("/plan")  # Existing unified endpoint
async def create_plan(request: dict):
    knowledge_type = request.get('knowledge_type')
    
    # Route to new engine for conceptual/strategic
    if knowledge_type in ['conceptual', 'strategic']:
        essay_req = EssayPlanRequest(**request)
        return await generate_plan(essay_req)
    else:
        # Legacy engine for procedural/factual/situational
        return await legacy_generate_plan(request)
```

- [ ] **Step 5: Test endpoints with curl**

```bash
# Test plan generation
curl -X POST http://localhost:8000/api/generate/essay-plan \
  -H "Content-Type: application/json" \
  -d '{"topic": "测试主题", "slug": "test", "knowledge_type": "conceptual"}'

# Test chapter generation
curl -X POST http://localhost:8000/api/generate/essay-chapter \
  -H "Content-Type: application/json" \
  -d '{"course_id": "test", "chapter_id": "c01", ...}'
```

Expected: JSON responses matching schema.

---

### Task 6: Integration Test with Real LLM

**Files:**
- Create: `agent-backend/tests/test_integration_essay.py`

**Dependencies:** 中转站可用

- [ ] **Step 1: End-to-end plan generation**

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_generate_plan_real_llm():
    req = EssayPlanRequest(
        topic="Git 的对象模型",
        slug="git-internals",
        knowledge_type="procedural"
    )
    
    plan = await generate_plan(req)
    
    assert plan.register == "explainer"
    assert len(plan.chapters) >= 4
    assert len(plan.overview['arc']) == len(plan.chapters)
    assert len(plan.fact_spine) >= 3
```

- [ ] **Step 2: End-to-end chapter generation with continuity**

```python
@pytest.mark.integration
@pytest.mark.asyncio
async def test_generate_two_chapters_with_continuity():
    # First generate plan
    plan_req = EssayPlanRequest(...)
    plan = await generate_plan(plan_req)
    
    # Generate c01
    c01_req = EssayChapterRequest(
        course_id=plan.id,
        chapter_id="c01",
        chapter_number=1,
        chapter_title=plan.overview['arc'][0],
        chapter_role="unfold",
        prev_chapter_ending=None,
        course_context={...}
    )
    c01 = await generate_chapter(c01_req)
    
    # Extract ending for c02
    c01_ending = extract_ending(c01.narrative)
    
    # Generate c02 with continuity
    c02_req = EssayChapterRequest(
        ...
        prev_chapter_ending=c01_ending
    )
    c02 = await generate_chapter(c02_req)
    
    # Verify continuity (manual inspection or keyword overlap check)
    assert len(c02.narrative) > 10
    assert c02.bridge is not None
```

Run: `python3 -m pytest agent-backend/tests/test_integration_essay.py -m integration`

---

### Task 7: Commit & Mark Complete

- [ ] **Step 1: Run full test suite**

```bash
cd agent-backend
python3 -m pytest tests/test_essay_*.py
python3 -m pytest tests/test_integration_essay.py -m integration
```

Expected: All tests pass (integration tests may be slow due to real LLM calls).

- [ ] **Step 2: Commit**

```bash
git add agent-backend/app/essay_*.py agent-backend/prompts/*.txt agent-backend/tests/test_essay_*.py
git commit -m "feat: essay-course generation engine

- Plan generation with drivingQuestion/centralTension/overview
- Chapter generation with continuity (串上一章)
- Dual register prompts (explainer vs essay)
- Four anti-pastiche guards (fact spine + guardrails + negatives + judge)
- LLM judge gate (substance density + hallucination detection)
- API endpoints: /api/generate/essay-plan, /essay-chapter, /essay-course
- Integration tests with real LLM

Depends on Plan 1 (schema), Plan 2 (design docs), Plan 3 (seeds)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 3: Update design spec**

Mark Plan 4 complete in `docs/superpowers/specs/2026-06-21-narrative-essay-refactor-design.md` §13.

---

## Dependencies

- **Depends on:** Plan 1 (Data Contract) — essay_schema.py normalizers
- **Depends on:** Plan 2 (Design Docs) — narrative principles injected into prompts
- **Depends on:** Plan 3 (Seeds) — few-shot examples loaded by build_plan_prompt()
- **Enables:** Plan 5 (Frontend) — API ready for frontend consumption
- **Enables:** Plan 6 (Migration) — generation engine ready to regenerate courses

---

## Notes

- **中转站稳定性**：集成测试依赖真实 LLM 调用，可能遇到 504 超时。如频繁失败，考虑增加重试逻辑或本地缓存。
- **Judge 模型选择**：judge LLM 可用更便宜的模型（如 gpt-3.5-turbo）以降低成本，因为评估任务比生成任务简单。
- **Continuity 实现细节**：`prev_chapter_ending` 只传最后 2 段文字，不包含 code/callout blocks——避免 prompt 过长且保持散文连贯性。
- **Register 切换测试**：手动验证 explainer 生成的章节确实有代码 trace，essay 生成的章节确实无代码堆砌。
- **旧引擎保留**：`models.py`/`prompt_assets.py`/`pipeline.py` 暂不删除，Plan 6 迁移完成后一并清理。
