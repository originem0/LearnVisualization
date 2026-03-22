#!/usr/bin/env python3
"""Course generator for LearnVisualization.  Replaces the agent-backend pipeline.
Zero external dependencies — stdlib only.

Usage:
    python3 generate.py "Git Internals"
    python3 generate.py "Git Internals" --slug git-internals --overwrite
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, subprocess, sys, time
from pathlib import Path
from typing import Any
from urllib import error, request

REPO = Path(__file__).resolve().parent
COURSES = REPO / "courses"

# ── Config ──────────────────────────────────────────────────────────────────

def load_dotenv() -> None:
    p = REPO / ".env"
    if not p.is_file():
        return
    for line in p.read_text("utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())

def get_cfg() -> dict[str, Any]:
    load_dotenv()
    return {
        "base_url": (os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1").rstrip("/"),
        "api_key": os.environ.get("LLM_API_KEY") or "",
        "model":   os.environ.get("LLM_MODEL") or "gpt-4o",
        "timeout":     int(os.environ.get("LLM_TIMEOUT") or "180"),
        "max_retries": int(os.environ.get("LLM_MAX_RETRIES") or "3"),
    }

# ── LLM client ─────────────────────────────────────────────────────────────

def llm_call(cfg: dict, system: str, user: str, *, max_tokens: int = 8000) -> dict:
    ep = cfg["base_url"]
    if not ep.endswith("/chat/completions"):
        ep += "/chat/completions"
    hdrs = {"Content-Type": "application/json", "User-Agent": "LearnVis-CourseGen/1.0"}
    if cfg["api_key"]:
        hdrs["Authorization"] = f"Bearer {cfg['api_key']}"
    body = json.dumps({"model": cfg["model"], "temperature": 0.25, "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }).encode()

    last: Exception | None = None
    for attempt in range(cfg["max_retries"] + 1):
        req = request.Request(ep, data=body, headers=hdrs, method="POST")
        try:
            with request.urlopen(req, timeout=cfg["timeout"]) as r:
                payload = json.loads(r.read())
                return json.loads(_extract(payload))
        except error.HTTPError as e:
            last = e
            if attempt >= cfg["max_retries"] or e.code not in {429, 500, 502, 503, 504}:
                raise RuntimeError(f"LLM HTTP {e.code}: {e.read().decode('utf-8','ignore')[:400]}") from e
        except (error.URLError, json.JSONDecodeError) as e:
            last = e
            if attempt >= cfg["max_retries"]:
                raise RuntimeError(f"LLM error: {e}") from e
        wait = 2.0 * (2 ** attempt)
        print(f"  [retry {attempt+1}/{cfg['max_retries']}] waiting {wait:.0f}s …")
        time.sleep(wait)
    raise RuntimeError(f"LLM failed: {last}")

def _extract(payload: dict) -> str:
    choices = payload.get("choices") or []
    if not choices: raise RuntimeError("LLM returned no choices")
    msg = choices[0].get("message") or {}
    if isinstance(msg.get("content"), str): return msg["content"]
    if isinstance(msg.get("content"), list):
        t = "".join(p.get("text","") for p in msg["content"] if isinstance(p, dict)).strip()
        if t: return t
    if isinstance(msg.get("parsed"), dict): return json.dumps(msg["parsed"], ensure_ascii=False)
    raise RuntimeError("LLM returned no extractable content")

# ── System prompt ───────────────────────────────────────────────────────────

SYS = """你是一个学习平台的课程设计引擎。你为一个技术可视化学习站点生成课程内容。

## 教学原则（必须严格遵守）

1. **焦点问题驱动**：每个模块的 focusQuestion 必须制造认知冲突——不是"X 是什么"，而是"为什么 X 和直觉相反"或"没有 X 系统会怎样崩溃"。

2. **误解先行**：先呈现一个具体的常见误解（misconception），再用证据拆解。不要写"很多人以为……"，要写出具体的错误心智模型。

3. **worked example 必须有 steps 块**：narrative 中必须包含至少一个 type="steps" 的叙事块。每个 step 只改变一个变量，让学习者看到因果链的每一环。steps 的 visual 字段用 ASCII/伪代码展示该步骤的状态。

4. **桥接是悬念不是预告**：bridgeTo 不是"下一章我们将学习 Y"，而是用未解决的问题把学习者拉向下一模块。

5. **检索提示要求综合不是回忆**：retrievalPrompts 要求填空、预测、重建结构或对比变体。

6. **场景引入式开场**：opening 的第一段必须是一个具体的日常场景或类比——不是概念定义，不要以"你可能以为"开头。让读者在技术内容前先有一个可感知的心理图像。例如："想象你走进一家图书馆，管理员告诉你：这里每本书都没有书名，只有一串数字……"。第二段起再揭示与直觉的冲突，引出技术问题。

## 反面例子

不要写：focusQuestion="什么是 Attention？" / misconception="很多人对 Attention 有误解" / opening="Attention 是深度学习中一个重要的概念" / bridgeTo="下一章我们将学习 Transformer"
应该写：focusQuestion="为什么模型不能只靠 RNN 隐藏状态记住整个句子？" / misconception="认为 Attention 是给重要的词加粗——实际上它是让每个位置重新组合信息来源" / bridgeTo="单头 Attention 只能学到一种关注模式。但语言里同一句话需要同时关注语法和语义——一个头怎么够用？"

## JSON 输出

所有输出必须是合法 JSON 对象，不要 markdown 包裹。

narrative 数组支持的 block 类型（只用这些）：
- text: {"type":"text","content":"..."}
- heading: {"type":"heading","content":"..."}
- comparison: {"type":"comparison","label":"...","content":"..."}
- steps: {"type":"steps","label":"...","content":"","steps":[{"title":"...","description":"...","visual":"...","highlight":"..."}]}
- callout: {"type":"callout","content":"..."}
- diagram: {"type":"diagram","label":"...","content":"..."}
- code: {"type":"code","content":"..."}

字段约束：
- moduleKind: concept-clarification|mechanism-walkthrough|system-overview|case-study|meta-reflection|integration-review
- primaryCognitiveAction: distinguish|trace|compare|simulate|rebuild|reflect|analyze
- interactionRequirements.capability: compare|step-through|simulate|trace|classify|rebuild|retrieve|parameter-play
- interactionRequirements.priority: core|secondary
- retrievalPrompts.type: fill-gap|rebuild-map|compare-variants|predict-next-step
- categories.color: blue|emerald|purple|amber|red

语言：中文。"""

# ── Plan prompt & generation ────────────────────────────────────────────────

def gen_plan(cfg: dict, topic: str, slug: str, *, level: str = "", goal: str = "", depth: str = "") -> dict:
    level_map = {
        "beginner": "完全没接触过该主题",
        "used-not-understood": "用过但不懂原理",
        "intermediate": "有一定基础想深入",
    }
    goal_map = {
        "framework": "建立整体理解框架",
        "understand-mechanism": "理解底层机制/原理",
        "hands-on": "能实际动手操作",
    }
    depth_map = {
        "overview": "入门概览，5-6个模块",
        "systematic": "系统理解，8-10个模块",
        "deep-dive": "深度钻研，12+个模块",
    }

    audience_hint = ""
    if level or goal or depth:
        parts = []
        if level: parts.append(f"学习者水平：{level_map.get(level, level)}")
        if goal: parts.append(f"学习目标：{goal_map.get(goal, goal)}")
        if depth: parts.append(f"期望深度：{depth_map.get(depth, depth)}")
        audience_hint = "\n\n学习者画像：\n" + "\n".join(parts)

    module_count_hint = depth_map.get(depth, "8-14") if depth else "8-14"

    user = f"""请为主题「{topic}」设计课程。面向想系统理解该主题的中文学习者。slug="{slug}"{audience_hint}

输出 JSON：
- title, subtitle, goal（中文）
- audience: {{ primaryAudience, priorKnowledge:[], desiredOutcome }}
- learningGoals: [3-5个]
- categories: [{{ id, name, color }}]（2-5个）
- moduleOutlines: 数组（{module_count_hint}个模块），每个含 title, subtitle, category, moduleKind, primaryCognitiveAction, focusQuestion, misconception, targetChunk

模块之间要形成认知冲突升级链条，不是知识点罗列。"""
    return _norm_plan(llm_call(cfg, SYS, user, max_tokens=6000), topic, slug)

# ── Module prompt & generation ──────────────────────────────────────────────

def gen_module(cfg: dict, title: str, outlines: list[dict], i: int, n: int) -> dict:
    o = outlines[i]
    prev = outlines[i-1]["title"] if i > 0 else "(无)"
    nxt  = outlines[i+1]["title"] if i < n-1 else "(末尾模块)"
    is_last = i == n - 1
    is_first = i == 0
    intro_dialog_prompt = ""
    if is_first:
        intro_dialog_prompt = """

额外输出 introDialog 字段——一个 JSON 数组，4-6 轮交替对话：
[{"role":"learner","text":"..."}, {"role":"guide","text":"..."}, ...]
规则：
- learner 的话来自日常经验和困惑，不使用技术术语
- guide 不直接给答案，用反问或类比把问题推深
- 最后一轮 guide 的话自然过渡到本章的 focusQuestion"""

    user = f"""课程「{title}」共 {n} 模块。当前第 {i+1} 个：{o['title']} — {o['subtitle']}
上一模块：{prev}　下一模块：{nxt}
焦点：{o['focusQuestion']}　知识单元：{o['targetChunk']}　误解：{o['misconception']}
类别={o['category']} 模块类型={o['moduleKind']} 认知动作={o['primaryCognitiveAction']}

输出完整模块 JSON：title, subtitle, focusQuestion, misconception, keyInsight, opening(2-3段：第一段是日常场景/类比引入,不以"你可能以为"开头；第二段起揭示认知冲突), quote,
concepts:[{{name,note}}](3-5), logicChain:[5-7步], examples:[2-4个具体例子], counterexamples, pitfalls:[{{point,rootCause}}],
narrative(8-15块,必须含steps块), visuals:[{{"id":"s{i+1:02d}-map","type":"conceptMap","required":true}}],
interactionRequirements:[1-2个,{{capability,purpose,priority,componentHint:null}}],
retrievalPrompts:[1-3个,{{type,prompt,answerShape}}],
bridgeTo: {"null（最后一个模块）" if is_last else "悬念文字引向下一模块"}{intro_dialog_prompt}"""
    next_id = f"s{i+2:02d}" if not is_last else None
    return _norm_module(llm_call(cfg, SYS, user, max_tokens=12000), o, next_id)

# ── Normalization ───────────────────────────────────────────────────────────

_NAR_ALIAS = {
    "comparisonframe":"comparison","comparison-frame":"comparison",
    "concept-map":"diagram","conceptmap":"diagram","processflow":"diagram","process-flow":"diagram",
    "stepsequence":"steps","step-sequence":"steps","step_sequence":"steps",
    "quote":"callout","warning":"callout","note":"callout","tip":"callout",
    "example":"text","paragraph":"text","subheading":"heading","h2":"heading","h3":"heading",
}
_NAR_TYPES = {"text","heading","comparison","steps","callout","diagram","code"}
_RET_TYPES = {"fill-gap","rebuild-map","compare-variants","predict-next-step"}
_CAPS = {"compare","step-through","simulate","trace","classify","rebuild","retrieve","parameter-play"}

def _s(v: Any) -> str: return str(v or "").strip()
def _opt(v: Any) -> str|None: s=_s(v); return s or None
def _sl(v: Any) -> list[str]: return [_s(x) for x in (v or []) if _s(x)] if isinstance(v,list) else []

def _norm_plan(raw: dict, topic: str, slug: str) -> dict:
    outlines = []
    for i, o in enumerate(raw.get("moduleOutlines") or [], 1):
        mid = f"s{i:02d}"
        outlines.append({"id":mid,"number":i,"title":_s(o.get("title")),"subtitle":_s(o.get("subtitle")),
            "category":_s(o.get("category")) or "core",
            "moduleKind":_s(o.get("moduleKind")) or "concept-clarification",
            "primaryCognitiveAction":_s(o.get("primaryCognitiveAction")) or "distinguish",
            "focusQuestion":_s(o.get("focusQuestion")),"misconception":_s(o.get("misconception")),
            "targetChunk":_s(o.get("targetChunk"))})
    ids = [o["id"] for o in outlines]
    edges = [{"from":ids[i],"to":ids[i+1],"type":"prerequisite","note":"线性主路径"} for i in range(len(ids)-1)]
    cats = []
    valid_colors = {"blue","emerald","purple","amber","red"}
    for c in raw.get("categories") or []:
        if isinstance(c,dict) and c.get("id"):
            col = c.get("color","blue"); col = col if col in valid_colors else "blue"
            cats.append({"id":c["id"],"name":_s(c.get("name")) or c["id"],"color":col})
    if not cats: cats=[{"id":"core","name":"核心","color":"blue"}]
    cat_ids = {c["id"] for c in cats}
    for o in outlines:
        if o["category"] not in cat_ids:
            o["category"] = cats[0]["id"]
    aud = raw.get("audience") or {}
    return {"id":slug,"slug":slug,"title":_s(raw.get("title")) or topic,"subtitle":_s(raw.get("subtitle")),
        "goal":_s(raw.get("goal")),"projectType":"mixed","startDate":time.strftime("%Y-%m-%d"),
        "topic":slug,"language":"zh","status":"draft","categories":cats,
        "audience":{"primaryAudience":_s(aud.get("primaryAudience")),
            "priorKnowledge":_sl(aud.get("priorKnowledge")),"desiredOutcome":_s(aud.get("desiredOutcome"))},
        "learningGoals":_sl(raw.get("learningGoals")),
        "paths":[{"id":"core-path","title":"核心路径","description":"完整学习路径","moduleIds":ids}],
        "moduleGraph":{"order":ids,"edges":edges},"modules":ids,"_outlines":outlines}

def _norm_module(raw: dict, outline: dict, next_id: str|None) -> dict:
    narrative = [b for b in (_norm_nar(b) for b in (raw.get("narrative") or []) if isinstance(b,dict)) if b]
    interactions = []
    fuzzy_caps = {c.lower().replace("-",""):c for c in _CAPS}
    for r in raw.get("interactionRequirements") or []:
        if not isinstance(r,dict): continue
        cap = fuzzy_caps.get(_s(r.get("capability")).lower().replace("-","").replace("_",""), _s(r.get("capability")))
        if cap not in _CAPS: continue
        pri = _s(r.get("priority")) or "core"
        if pri in {"primary","main","hero","essential"}: pri="core"
        elif pri not in {"core","secondary"}: pri="secondary"
        interactions.append({"capability":cap,"purpose":_s(r.get("purpose")),"priority":pri,"componentHint":_opt(r.get("componentHint"))})
    retrieval = []
    for p in raw.get("retrievalPrompts") or []:
        if not isinstance(p,dict): continue
        pt = _s(p.get("type")).lower().replace("_","-"); pt = pt if pt in _RET_TYPES else "fill-gap"
        retrieval.append({"type":pt,"prompt":_s(p.get("prompt")),"answerShape":_opt(p.get("answerShape"))})
    pitfalls = [{"point":_s(x.get("point")),"rootCause":_s(x.get("rootCause"))}
                for x in (raw.get("pitfalls") or []) if isinstance(x,dict) and _s(x.get("point")) and _s(x.get("rootCause"))]
    # Normalize introDialog (only for first module)
    intro_dialog = None
    raw_dialog = raw.get("introDialog")
    if isinstance(raw_dialog, list) and raw_dialog:
        turns = []
        for t in raw_dialog:
            if not isinstance(t, dict): continue
            role = _s(t.get("role"))
            text = _s(t.get("text"))
            if role in ("learner", "guide") and text:
                turns.append({"role": role, "text": text})
        if turns:
            intro_dialog = turns
    return {
        "id":outline["id"],"number":outline["number"],
        "title":_s(raw.get("title")) or outline["title"],
        "subtitle":_s(raw.get("subtitle")) or outline["subtitle"],
        "category":outline["category"],"moduleKind":outline["moduleKind"],
        "primaryCognitiveAction":outline["primaryCognitiveAction"],
        "focusQuestion":_s(raw.get("focusQuestion")) or outline["focusQuestion"],
        "misconception":_s(raw.get("misconception")) or outline["misconception"],
        "keyInsight":_s(raw.get("keyInsight")),"opening":_s(raw.get("opening")),
        "quote":_opt(raw.get("quote")),
        "concepts":[{"name":_s(c.get("name")),"note":_s(c.get("note"))} for c in (raw.get("concepts") or []) if isinstance(c,dict)],
        "logicChain":_sl(raw.get("logicChain")),"examples":_sl(raw.get("examples")),
        "counterexamples":_sl(raw.get("counterexamples")),"pitfalls":pitfalls,"narrative":narrative,
        "visuals":[{"id":f"{outline['id']}-map","type":"conceptMap","required":True}],
        "interactionRequirements":interactions,"retrievalPrompts":retrieval,
        "bridgeTo":_s(raw["bridgeTo"]) if next_id and raw.get("bridgeTo") else None,
        "nextModuleId":next_id,
        **({"introDialog": intro_dialog} if intro_dialog else {})}

def _norm_nar(b: dict) -> dict|None:
    t = _NAR_ALIAS.get(_s(b.get("type")).lower(), _s(b.get("type")))
    if t not in _NAR_TYPES: t = "text"
    out: dict[str,Any] = {"type":t,"content":_s(b.get("content"))}
    if b.get("label") is not None: out["label"] = _s(b["label"])
    if t == "steps":
        raw_steps = b.get("steps")
        if not isinstance(raw_steps, list) or not raw_steps: return None
        ns = [{"title":_s(s.get("title")),"description":_s(s.get("description")),
               "visual":_s(s.get("visual")),"highlight":_s(s.get("highlight"))}
              for s in raw_steps if isinstance(s, dict)]
        if not ns: return None
        out["steps"] = ns; out.setdefault("content","")
    if t in {"comparison","diagram"} and "label" not in out: out["label"]=""
    return out

# ── Artifact builders ───────────────────────────────────────────────────────

def build_cmap(mod: dict) -> dict:
    concepts = mod.get("concepts") or []
    title = mod["title"]

    # ── Text width estimation (CJK ~14px, ASCII ~8px at font-size 14) ──
    def text_w(s: str) -> int:
        return sum(14 if ord(c) > 0x7f else 8 for c in s)

    def node_w(label: str, min_w: int = 120, pad: int = 32) -> int:
        return max(min_w, text_w(label) + pad)

    # ── Core node (use short title, not focusQuestion) ──
    core_w = node_w(title, min_w=140)
    core = {"id": "core", "label": [title], "x": 0, "y": 50, "w": core_w, "h": 52, "accent": True}

    # ── Child nodes — compute widths ──
    children = []
    for i, c in enumerate(concepts[:4]):
        nid = f"n{i+1}"
        w = node_w(c["name"], min_w=100)
        children.append({"id": nid, "label": [c["name"]], "w": w, "h": 48})

    # Fallback: if fewer than 2 concepts, add placeholders
    if len(children) < 2:
        children = [
            {"id": "nX", "label": ["机制"], "w": 100, "h": 48},
            {"id": "nY", "label": ["结果"], "w": 100, "h": 48},
        ]

    # ── Auto-layout: arrange children in rows ──
    gap = 28
    max_canvas_w = 600

    # Try single row first
    total_w = sum(c["w"] for c in children) + gap * (len(children) - 1)

    if total_w <= max_canvas_w:
        # Single row layout
        rows = [children]
    elif len(children) == 4:
        # Split 4 into 2+2 or 3+1
        row1 = children[:3]
        row2 = children[3:]
        rows = [row1, row2]
    else:
        # Split roughly in half
        mid = (len(children) + 1) // 2
        rows = [children[:mid], children[mid:]]

    # Position each row centered horizontally
    canvas_w = max(core_w + 40, max(
        sum(c["w"] for c in row) + gap * (len(row) - 1)
        for row in rows
    ) + 40)  # 20px margin each side
    canvas_w = min(canvas_w, max_canvas_w)

    core["x"] = canvas_w // 2

    y_offset = 130  # first row y
    row_gap = 80

    for row in rows:
        row_w = sum(c["w"] for c in row) + gap * (len(row) - 1)
        start_x = (canvas_w - row_w) // 2
        cx = start_x
        for child in row:
            child["x"] = cx + child["w"] // 2
            child["y"] = y_offset
            cx += child["w"] + gap
        y_offset += row_gap

    canvas_h = y_offset + 20

    # ── Build nodes and edges ──
    nodes = [core]
    edges: list[dict] = []
    lc = mod.get("logicChain") or []

    all_children = [c for row in rows for c in row]
    for i, child in enumerate(all_children):
        nodes.append(child)
        if child["id"] in ("nX", "nY"):
            # Fallback nodes
            label = "拆解" if child["id"] == "nX" else "推导"
            src = "core" if child["id"] == "nX" else "nX"
            edges.append({"from": src, "to": child["id"], "label": label})
        else:
            edge_label = (lc[min(i, len(lc) - 1)] if lc else "关联")[:20]
            edges.append({"from": "core", "to": child["id"], "label": edge_label})

    return {
        "title": title, "type": "conceptMap",
        "nodes": nodes, "edges": edges,
        "svgW": canvas_w, "svgH": canvas_h,
        "ariaLabel": f"{title} 概念关系图",
    }

def build_ireg(mod: dict) -> dict:
    reg: dict[str,Any] = {}; si = 1
    for r in mod.get("interactionRequirements") or []:
        if r["priority"]=="core": key="heroInteractive"
        else: key = f"secondaryInteractive{si}" if si>1 else "secondaryInteractive"; si+=1
        e: dict[str,Any] = {"capability":r["capability"],"purpose":r["purpose"],"priority":r["priority"]}
        if r.get("componentHint"): e["componentHint"]=r["componentHint"]
        reg[key]=e
    return reg

# ── File I/O ────────────────────────────────────────────────────────────────

def _wj(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+"\n", "utf-8")

def write_course(d: Path, plan: dict) -> None:
    _wj(d/"course.json", {k:v for k,v in plan.items() if not k.startswith("_")})

def write_approval(d: Path) -> None:
    _wj(d/"review"/"approval.json", {"approved":False,"reviewedBy":"","reviewedAt":"",
        "notes":"Generated. Human review required."})

def checkpoint(d: Path, mod: dict, cmaps: dict, reg: dict) -> None:
    mid = mod["id"]
    _wj(d/"modules"/f"{mid}.json", mod)
    cmaps[mid] = build_cmap(mod)
    _wj(d/"visuals"/"concept-maps.json", cmaps)
    entry = build_ireg(mod)
    if entry: reg[mid] = entry
    _wj(d/"interactions"/"registry.json", reg)

# ── Validation ──────────────────────────────────────────────────────────────

def validate(slug: str) -> bool:
    script = REPO/"scripts"/"validate-course-package.mjs"
    if not script.exists():
        print("  [skip] validator not found"); return True
    try:
        r = subprocess.run(["node",str(script),"--slug",slug,"--json"],
                           capture_output=True, text=True, timeout=30, cwd=str(REPO))
        try: data = json.loads(r.stdout)
        except json.JSONDecodeError:
            print(f"  stdout: {r.stdout[:200]}"); return r.returncode==0
        errs, warns, ok = data.get("errors",[]), data.get("warnings",[]), data.get("ok",False)
        print(f"  validation: {'PASS' if ok else 'FAIL'} — {len(errs)} error(s), {len(warns)} warning(s)")
        for e in errs[:10]: print(f"    ERROR: {e.get('message',e)}")
        for w in warns[:5]:  print(f"    WARN:  {w.get('message',w)}")
        return ok
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("  [skip] validation skipped"); return True

# ── CLI ─────────────────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text.lower().strip())
    s = re.sub(r"[\s_]+", "-", s).strip("-")
    return s if s and s.isascii() else "course-"+hashlib.md5(text.encode()).hexdigest()[:8]

def generate_course(topic: str, slug: str|None = None, overwrite: bool = False,
                    level: str = "", goal: str = "", depth: str = "") -> dict:
    """Run the full generation pipeline.  Returns a result dict.
    Raises RuntimeError (LLM/config) or ValueError (conflict) on failure."""
    cfg = get_cfg()
    if not cfg["api_key"]:
        raise RuntimeError("LLM_API_KEY not set (env or .env)")
    slug = slug or slugify(topic)
    pkg = COURSES / slug

    if pkg.exists() and not overwrite:
        raise ValueError(f"{pkg} already exists. Pass overwrite=true to replace.")

    print(f"model:  {cfg['model']}\ntopic:  {topic}\nslug:   {slug}\noutput: {pkg}\n")

    # Phase 1: plan
    print("[1/2] Generating course plan …")
    plan = gen_plan(cfg, topic, slug, level=level, goal=goal, depth=depth)
    outlines = plan["_outlines"]; n = len(outlines)
    print(f"  → {plan['title']} — {n} modules\n")
    write_course(pkg, plan); write_approval(pkg)

    # Phase 2: modules with checkpoint
    print(f"[2/2] Generating {n} modules …\n")
    cmaps: dict[str,Any] = {}; reg: dict[str,Any] = {}
    for i, o in enumerate(outlines):
        print(f"  [{o['id']}] {o['title']} …", end=" ", flush=True)
        t0 = time.time()
        mod = gen_module(cfg, plan["title"], outlines, i, n)
        checkpoint(pkg, mod, cmaps, reg)
        print(f"OK ({time.time()-t0:.1f}s)")

    print(f"\nValidating …")
    ok = validate(slug)
    status = "Done." if ok else "Done with issues."
    print(f"\n{status} Package: {pkg}")
    return {"slug": slug, "moduleCount": n, "path": str(pkg), "title": plan["title"], "valid": ok}

# ── HTTP server mode ───────────────────────────────────────────────────────

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

class GenerateHandler(BaseHTTPRequestHandler):
    server_version = "LearnVis-GenerateServer/1.0"

    # ── helpers ──

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("User-Agent", self.server_version)
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    # ── routes ──

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            port = self.server.server_address[1]
            return self._json({"ok": True, "mode": "generate-server", "port": port})
        self._json({"ok": False, "error": f"Not found: {self.path}"}, 404)

    def do_POST(self) -> None:
        if self.path != "/generate":
            return self._json({"ok": False, "error": f"Not found: {self.path}"}, 404)

        try:
            req = self._read_body()
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return self._json({"ok": False, "error": f"Bad JSON: {exc}"}, 400)

        topic = (req.get("topic") or "").strip()
        if not topic:
            return self._json({"ok": False, "error": "\"topic\" is required"}, 400)

        slug = (req.get("slug") or "").strip() or None
        overwrite = bool(req.get("overwrite", False))
        level = (req.get("level") or "").strip()
        goal = (req.get("goal") or "").strip()
        depth = (req.get("depth") or "").strip()

        try:
            result = generate_course(topic, slug=slug, overwrite=overwrite,
                                     level=level, goal=goal, depth=depth)
            return self._json({"ok": True, **result})
        except RuntimeError as exc:
            # LLM_API_KEY missing or LLM call failure
            stage = "plan" if "LLM_API_KEY" in str(exc) else "compose"
            return self._json({"ok": False, "error": str(exc), "stage": stage}, 500)
        except ValueError as exc:
            # Directory already exists
            return self._json({"ok": False, "error": str(exc), "stage": "plan"}, 409)
        except Exception as exc:
            return self._json({"ok": False, "error": str(exc), "stage": "compose"}, 500)

def start_server(port: int = 8090) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), GenerateHandler)
    print(f"generate-server listening on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()

# ── main ───────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(description="Generate a course package")
    ap.add_argument("topic", nargs="?", default=None, help="Course topic, e.g. 'Git Internals'")
    ap.add_argument("--slug", help="Course slug (derived from topic if omitted)")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing dir")
    ap.add_argument("--serve", action="store_true", help="Start HTTP server mode")
    ap.add_argument("--port", type=int, default=8090, help="HTTP server port (default: 8090)")
    args = ap.parse_args()

    if args.serve:
        start_server(args.port)
        return

    # CLI mode — topic is required
    if not args.topic:
        ap.error("topic is required (or use --serve for HTTP server mode)")

    try:
        result = generate_course(args.topic, slug=args.slug, overwrite=args.overwrite)
    except (RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}"); sys.exit(1)

    if not result["valid"]:
        print(f"  node scripts/validate-course-package.mjs --slug {result['slug']}")

if __name__ == "__main__":
    main()
