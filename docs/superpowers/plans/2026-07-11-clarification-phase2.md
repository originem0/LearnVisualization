# 澄清二期（Dialogue Options & Contract Editing）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每轮澄清提问带可点选项降低回答阻力，评审打回的追问反映评审实际发现，候选契约卡片支持字段级实编辑（用户即权威）。

**Architecture:** 澄清对话输出 schema 扩展 `options`（后端清洗透传，前端渲染按钮）；评审 fail 分支改为用 clarify_model 基于 issues 生成针对性追问（异常回落硬编码话术）；契约卡片重做为可编辑表单（本地副本 + 客户端必填预检，确认提交编辑后契约走既有生成通道）。

**Tech Stack:** Python 3.10 stdlib、Next.js 14 + TypeScript + Tailwind、OpenAI-compatible 中转站。

**设计文档:** `docs/superpowers/specs/2026-07-11-clarification-phase2-design.md`

## Global Constraints

- agent-backend 不引入任何第三方依赖
- 测试命令在仓库根运行：`python3 -m unittest discover -s agent-backend/tests -p '<file>.py' -v`；全量 `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py'`；前端 `npx tsc --noEmit`
- 每个 Task 结束 commit；message 末尾带 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 只 `git add` 各 Task 明列文件；不提交 `.claude/settings.local.json`
- 用户可见文案中文，追问不得暴露内部字段名（modelGap/problemFraming/schema）
- options 语义：list[str]、str 化+strip+去空、截断 4 个、缺失 → 空列表；规则闸 fail 的追问 options 恒为空列表
- 分支 `clarification-phase2`（已创建）

---

### Task 1: options——prompt schema 扩展 + 后端清洗透传

**Files:**
- Modify: `agent-backend/app/clarification_prompts.py`
- Modify: `agent-backend/app/main.py`
- Test: `agent-backend/tests/test_clarification_mock.py`

**Interfaces:**
- Produces: 澄清 LLM 继续对话输出 `{"question": str, "options": [str]}`（options 可选）
- Produces: `_clean_options(content: dict) -> list[str]`（main.py 模块级；清洗规则见 Global Constraints）
- Produces: `handle_clarify_start` 返回新增 `"options": [...]`；`handle_clarify_respond` 的继续对话分支、规则闸分支（恒 `[]`）、评审 fail 分支（本 Task 先 `[]`，Task 2 接 LLM）、候选契约分支（`[]`）都带 `options` 键

- [ ] **Step 1: 写失败测试**

在 `agent-backend/tests/test_clarification_mock.py` 末尾（函数式测试区，`if __name__` 之前若有测试注册类则同步注册）追加：

```python
def test_options_passthrough_and_cleaning():
    """继续对话时 options 被清洗透传；缺失时为空列表。"""
    store = get_store()
    conv_id = store.create_conversation("Rust 所有权")
    store.add_turn(conv_id, "bot", "问题1")

    with_options = {
        "content": {"question": "你卡在哪一类场景？", "options": [" 借用检查报错 ", "", "生命周期标注看不懂", 123, "move 语义", "第五个应被截断"]},
        "usage": {}, "model": "mock",
    }
    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = with_options
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client
        result = handle_clarify_respond({"conversationId": conv_id, "answer": "我写 Rust 总被编译器骂"})

    assert result["options"] == ["借用检查报错", "生命周期标注看不懂", "123", "move 语义"]
    assert result["question"] == "你卡在哪一类场景？"


def test_options_absent_defaults_empty():
    store = get_store()
    conv_id = store.create_conversation("Rust 所有权")
    store.add_turn(conv_id, "bot", "问题1")

    no_options = {"content": {"question": "继续问"}, "usage": {}, "model": "mock"}
    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.return_value = no_options
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client
        result = handle_clarify_respond({"conversationId": conv_id, "answer": "随便答一句够长的话"})

    assert result["options"] == []
```

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_clarification_mock.py' -v`
Expected: 两个新测试 FAIL（KeyError 'options'）

- [ ] **Step 3: clarification_prompts.py——schema 与提问纪律**

3a. system prompt（`build_clarification_system_prompt`）的输出格式段，把：

```
**输出格式：**
- 如果需要继续：{"question": "下一个问题的文本"}
```

改为：

```
**输出格式：**
- 如果需要继续：{"question": "下一个问题的文本", "options": ["候选回答A", "候选回答B"]}
  - options 可选，0-4 个：每个是用户可能的真实处境或回答（≤25 字），不是"是/否"，不是新问题。
  - 用户暴露初学者信号（不知道/不懂/是什么）后，必须给 options——把"让用户确认你的整理"变成可点选项。
```

3b. system prompt 的"## 规则"段（**提问策略：**列表末尾）追加一条提问纪律：

```
- 提问纪律：每轮问题正文最多 2 句铺垫 + 1 句问句。不要先讲一段课再提问；背景解释压缩进 options 或留给课程本身。
```

3c. user prompt（`build_clarification_user_prompt`）的输出行，把：

```python
- 如果继续对话：{{"question": "你的问题"}}
```

改为：

```python
- 如果继续对话：{{"question": "你的问题", "options": ["候选回答A", "候选回答B"]}}（options 可选，0-4 个，每个 ≤25 字）
```

3d. `_get_round_guidance` 修 W5：函数开头的粗估块整体替换为精确计数（保留 int 兼容分支用于历史调用安全）：

```python
def _get_round_guidance(history: list | int) -> str:
    """Provide round-specific guidance to the LLM."""
    if isinstance(history, int):
        history_items: list = []
        bot_turns = history
    else:
        history_items = history
        bot_turns = len([t for t in history_items if isinstance(t, dict) and t.get("role") == "bot"])
```

（其后的 if/elif 分支不变。）

- [ ] **Step 4: main.py——_clean_options 与四处返回**

4a. 在 `_unwrap_llm_json_content` 之后加模块级函数：

```python
def _clean_options(content: dict) -> list[str]:
    """清洗澄清模型给出的候选回答：str 化、strip、去空、最多 4 个。"""
    raw = content.get("options") if isinstance(content, dict) else None
    if not isinstance(raw, list):
        return []
    cleaned = [str(item).strip() for item in raw if str(item).strip()]
    return cleaned[:4]
```

4b. `handle_clarify_start` 的成功返回加 options：

```python
        return {
            "conversationId": conversation_id,
            "question": question,
            "roundNumber": 1,
            "options": _clean_options(content),
        }
```

4c. `handle_clarify_respond` 四个分支：

- 继续对话分支返回加 `"options": _clean_options(content),`
- 规则闸 fail 分支返回加 `"options": [],`
- 评审 fail 分支返回加 `"options": [],`（Task 2 会改为 LLM 生成）
- 候选契约分支返回加 `"options": [],`

- [ ] **Step 5: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK（现有测试不断言 options 键，新增键不破坏）

- [ ] **Step 6: Commit**

```bash
git add agent-backend/app/clarification_prompts.py agent-backend/app/main.py agent-backend/tests/test_clarification_mock.py
git commit -m "Add clickable answer options to clarification dialogue schema"
```

---

### Task 2: 评审打回的追问带评审发现（W3）

**Files:**
- Modify: `agent-backend/app/clarification_prompts.py`（新增 build_review_followup_prompts）
- Modify: `agent-backend/app/main.py`（评审 fail 分支）
- Test: `agent-backend/tests/test_clarification_mock.py`、`agent-backend/tests/test_contract_review.py`

**Interfaces:**
- Produces: `build_review_followup_prompts(issues: list[str], recent_history: list[dict]) -> tuple[str, str]`——输出 schema `{"question": str, "options": [str]}`
- Produces: main.py `_review_followup_question(client, issues, history) -> dict`（返回 `{"question": str, "options": [str]}`；LLM 异常时回落 `{"question": _clarification_gate_followup("contrast", ...), "options": []}`——注意回落需要 topic/history 参数，见实现）
- Consumes: `_clean_options`（Task 1）、`clarify_model` per-call 覆盖

- [ ] **Step 1: 写失败测试**

`test_contract_review.py` 末尾追加：

```python
from clarification_prompts import build_review_followup_prompts  # noqa: E402


class ReviewFollowupPromptTests(unittest.TestCase):
    def test_prompt_carries_issues_and_forbids_fieldnames(self):
        system, user = build_review_followup_prompts(
            ["modelGap 只是重复了问题，没有指出缺失的具体关系"],
            [{"role": "bot", "text": "上一问"}, {"role": "user", "text": "上一答"}],
        )
        self.assertIn("只是重复了问题", user)          # 评审发现进入 prompt
        self.assertIn("上一答", user)                  # 近期对话进入 prompt
        combined = system + user
        self.assertIn("不要出现", combined)            # 明令禁止内部字段名出现在追问里
        self.assertIn("options", user)                 # 要求给可点选项
```

`test_clarification_mock.py` 末尾追加（复用已有 `_mock_config`；evaluation 顺序：合成 → 评审 fail → followup 生成）：

```python
def test_review_fail_followup_generated_from_issues():
    """评审打回时，追问由 LLM 基于 issues 生成并带 options。"""
    store = get_store()
    conv_id = store.create_conversation("尼采哲学")
    for i in range(3):
        store.add_turn(conv_id, "bot", f"问题{i}")
        store.add_turn(conv_id, "user", f"这是我第{i}个足够长的具体回答，描述了差异现象和困惑")

    synthesis = {
        "content": {"complete": True, "contract": {
            "drivingQuestion": "为什么上帝已死意味着尺度崩塌而不仅是信仰缺失？",
            "centralTension": "直觉以为少个指南，实则衡量价值的尺度整体失效",
            "knowledgeType": "conceptual",
            "audience": "对存在主义有零散直觉的初学者",
            "desiredOutcome": "能解释尺度崩塌的机制",
            "scope": {"include": ["上帝已死"], "exclude": ["海德格尔"], "depth": "机制深挖"},
            "problemFraming": {
                "phenomenon": "现代人没有明确信仰也能凭常识活得好好的",
                "contrast": "直觉当少个旧指南；尼采说是评价尺度整体失效",
                "problemNature": "model_mismatch",
                "systemGoal": "理解尺度崩塌后的真实生存处境",
                "modelGap": "缺少价值尺度这一对象模型",
            },
        }}, "usage": {}, "model": "mock-clarify",
    }
    review_fail = {"content": {"pass": False, "issues": ["缺口表述只是重复问题"], "teachingHooks": []}, "usage": {}, "model": "mock-judge"}
    followup = {"content": {"question": "你觉得自己缺的是哪一块拼图：概念之间的关系，还是概念本身？", "options": ["概念之间怎么连不知道", "某个概念本身没懂"]}, "usage": {}, "model": "mock-clarify"}

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.side_effect = [synthesis, review_fail, followup]
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client
        result = handle_clarify_respond({"conversationId": conv_id, "answer": "我想弄懂尺度崩塌"})

    assert result["needsMoreEvidence"] is True
    assert result["question"] == "你觉得自己缺的是哪一块拼图：概念之间的关系，还是概念本身？"
    assert result["options"] == ["概念之间怎么连不知道", "某个概念本身没懂"]
    assert "modelGap" not in result["question"] and "problemFraming" not in result["question"]


def test_review_fail_followup_falls_back_on_llm_error():
    """followup 生成失败时回落硬编码话术，不卡死对话。"""
    store = get_store()
    conv_id = store.create_conversation("尼采哲学")
    for i in range(3):
        store.add_turn(conv_id, "bot", f"问题{i}")
        store.add_turn(conv_id, "user", f"这是我第{i}个足够长的具体回答，描述了差异现象和困惑")

    synthesis_content = {
        "complete": True, "contract": {
            "drivingQuestion": "为什么上帝已死意味着尺度崩塌而不仅是信仰缺失？",
            "centralTension": "直觉以为少个指南，实则衡量价值的尺度整体失效",
            "knowledgeType": "conceptual",
            "audience": "对存在主义有零散直觉的初学者",
            "desiredOutcome": "能解释尺度崩塌的机制",
            "scope": {"include": ["上帝已死"], "exclude": ["海德格尔"], "depth": "机制深挖"},
            "problemFraming": {
                "phenomenon": "现代人没有明确信仰也能凭常识活得好好的",
                "contrast": "直觉当少个旧指南；尼采说是评价尺度整体失效",
                "problemNature": "model_mismatch",
                "systemGoal": "理解尺度崩塌后的真实生存处境",
                "modelGap": "缺少价值尺度这一对象模型",
            },
        }}
    synthesis = {"content": synthesis_content, "usage": {}, "model": "mock-clarify"}
    review_fail = {"content": {"pass": False, "issues": ["缺口空洞"], "teachingHooks": []}, "usage": {}, "model": "mock-judge"}

    def gen(*args, **kwargs):
        responses = [synthesis, review_fail]
        if gen.calls < len(responses):
            r = responses[gen.calls]; gen.calls += 1; return r
        gen.calls += 1
        raise RuntimeError("followup model down")
    gen.calls = 0

    with patch('main.get_pipeline') as mock_pipeline:
        mock_client = Mock()
        mock_client.generate_json.side_effect = gen
        mock_client.config = _mock_config()
        mock_pipeline.return_value.client = mock_client
        result = handle_clarify_respond({"conversationId": conv_id, "answer": "我想弄懂尺度崩塌"})

    assert result["needsMoreEvidence"] is True
    assert result["question"]          # 回落话术非空
    assert result["options"] == []
```

同时更新既有 `test_handle_clarify_respond_rejects_hollow_contract_via_review`：其 side_effect 现在需要第三个响应（followup）——在 `side_effect = [synthesis, review_fail]` 后追加一个 followup 响应（内容任意合法 question），断言不变（原断言只检查 needsMoreEvidence 与字段名不泄漏，仍然成立）。

- [ ] **Step 2: 跑测试确认失败**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_contract_review.py' -v`
Expected: ImportError build_review_followup_prompts

- [ ] **Step 3: clarification_prompts.py 实现 followup prompt**

文件末尾追加：

```python
def build_review_followup_prompts(issues: list[str], recent_history: list[dict]) -> tuple[str, str]:
    """评审判定契约空洞后，把评审发现转成一个对用户友好的针对性追问。"""
    history_text = "\n".join(
        f"{'Bot' if t.get('role') == 'bot' else 'User'}: {t.get('text', '')}"
        for t in (recent_history or [])[-2:]
    )
    issues_text = "\n".join(f"- {i}" for i in issues or [])
    system_prompt = (
        "你是澄清助手。独立评审刚才判定：从对话合成的学习契约还不够实质。"
        "你的任务是把评审发现转成**一个**对用户友好的追问，帮用户把缺的那块补出来。只输出 JSON。\n"
        "硬规则：追问里不要出现任何内部字段名或术语（例如 modelGap、problemFraming、contrast、schema、契约字段），"
        "用普通人的话问；不要提到存在评审这回事。"
    )
    user_prompt = (
        f"评审发现的问题：\n{issues_text}\n\n"
        f"最近的对话：\n{history_text}\n\n"
        "生成一个针对上述问题的追问（≤2 句），并给 2-4 个用户可能的回答作为 options（每个 ≤25 字）。\n"
        '输出 JSON：{"question": "...", "options": ["...", "..."]}'
    )
    return system_prompt, user_prompt
```

- [ ] **Step 4: main.py 评审 fail 分支接 LLM followup**

4a. import 区两处 clarification_prompts 导入加 `build_review_followup_prompts`。

4b. `_review_contract` 之后加辅助函数：

```python
def _review_followup_question(client, issues: list[str], topic: str, history: list[dict]) -> dict:
    """把评审 issues 转成针对性追问；LLM 失败时回落硬编码话术。"""
    system_prompt, user_prompt = build_review_followup_prompts(issues, history)
    try:
        response = client.generate_json(
            schema_name="review_followup",
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.5,
            max_tokens=400,
            model=getattr(client.config, "clarify_model", None),
        )
        content = _unwrap_llm_json_content(response) or {}
        question = str(content.get("question") or "").strip()
        if question:
            return {"question": question, "options": _clean_options(content)}
    except Exception as exc:
        import sys
        print(f"[clarify] review followup failed, falling back: {exc}", file=sys.stderr)
    return {"question": _clarification_gate_followup("contrast", topic, history), "options": []}
```

4c. 评审 fail 分支替换为：

```python
            review = _review_contract(client, contract)
            if not review["pass"]:
                # 评审判定契约空洞：把评审发现转成针对性的友好追问，对话继续
                followup = _review_followup_question(client, review["issues"], conv["topic"], history)
                next_round = len([t for t in history if t["role"] == "bot"]) + 1
                store.add_turn(conversation_id, "bot", followup["question"])
                return {
                    "question": followup["question"],
                    "roundNumber": next_round,
                    "needsMoreEvidence": True,
                    "reviewIssue": (review["issues"] or [""])[0],
                    "options": followup["options"],
                }
```

- [ ] **Step 5: 跑测试确认通过 + 全量**

Run: `python3 -m unittest discover -s agent-backend/tests -p 'test_*.py' 2>&1 | tail -3`
Expected: OK

- [ ] **Step 6: Commit**

```bash
git add agent-backend/app/clarification_prompts.py agent-backend/app/main.py agent-backend/tests/test_clarification_mock.py agent-backend/tests/test_contract_review.py
git commit -m "Generate review-fail followup from actual review issues"
```

---

### Task 3: 前端——对话选项按钮

**Files:**
- Modify: `src/components/ClarificationDialogue.tsx`

**Interfaces:**
- Consumes: start/respond 响应的 `options: string[]`（Task 1/2）
- Produces: 点击选项 = 以该文本作为用户回答发送（与手输同一路径）

- [ ] **Step 1: 抽出发送逻辑**

现有 `handleSubmit(e: FormEvent)` 从 `answer` state 读文本。重构为共享函数（保持行为不变）：

```typescript
  async function sendAnswer(userAnswer: string) {
    if (!userAnswer || !conversationId) return;

    setMessages((prev) => [...prev, { role: 'user', text: userAnswer }]);
    setAnswer('');
    setCurrentOptions([]);
    setCandidateResult(null);
    setAnswerMode('answer');
    setIsLoading(true);
    setError('');

    try {
      const res = await agentFetch('/api/clarify/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, answer: userAnswer }),
      }, isZh);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.fallback) {
        throw new Error(isZh
          ? 'AI 澄清暂时不可用，不能用固定模板继续。请稍后重试或检查模型配置。'
          : 'AI clarification is unavailable. Fixed templates cannot continue the contract dialogue.');
      }

      if (data.readyForConfirmation || data.complete) {
        const result = toClarificationResult(data);
        setCandidateResult(result);
        setCurrentQuestion('');
        setCurrentOptions([]);
        setRoundNumber(data.roundNumber || roundNumber);
        setMessages((prev) => [...prev, {
          role: 'bot',
          text: data.message || (isZh ? '我整理出一版候选学习契约。' : 'I drafted a candidate learning contract.'),
        }]);
      } else {
        setCurrentQuestion(data.question);
        setCurrentOptions(Array.isArray(data.options) ? data.options : []);
        setRoundNumber(data.roundNumber);
        setCandidateResult(null);
        setMessages((prev) => [...prev, { role: 'bot', text: data.question }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await sendAnswer(answer.trim());
  }
```

新增 state（`candidateResult` 附近）：

```typescript
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
```

`startConversation` 成功分支加 `setCurrentOptions(Array.isArray(data.options) ? data.options : []);`。

- [ ] **Step 2: 渲染选项按钮**

Messages 容器之后、CandidateContractCard 之前插入：

```tsx
      {currentOptions.length > 0 && !isLoading && !candidateResult && (
        <div className="flex flex-wrap gap-2">
          {currentOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => sendAnswer(opt)}
              className="rounded-full border border-[color:var(--color-accent)]/40 bg-[color:var(--color-accent)]/5 px-3 py-1.5 text-sm text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-accent)]/15"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
```

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit`
Expected: 无输出

```bash
git add src/components/ClarificationDialogue.tsx
git commit -m "Render clickable answer options in clarification dialogue"
```

---

### Task 4: 前端——契约卡片字段级实编辑

**Files:**
- Modify: `src/components/ClarificationDialogue.tsx`（CandidateContractCard 重做 + 父组件编辑状态）

**Interfaces:**
- Produces: 用户编辑后的 contract 通过既有 `onComplete(result)` 原样上抛（GenerateForm 原样 POST，服务端 normalize 校验不变）
- 语义：编辑不过语义评审（用户即权威）；必填字段客户端预检（空 → 红标 + 禁用确认）；点"继续澄清"丢弃本地编辑

- [ ] **Step 1: 父组件持有可编辑副本**

`candidateResult` 保持为 AI 原始产出；新增编辑副本 state：

```typescript
  const [editedContract, setEditedContract] = useState<CourseContract | null>(null);
```

收到候选契约时初始化副本（sendAnswer 的 readyForConfirmation 分支里，`setCandidateResult(result)` 之后）：

```typescript
        setEditedContract(JSON.parse(JSON.stringify(result.contract)));
```

`confirmCandidate` 改为提交编辑副本：

```typescript
  function confirmCandidate() {
    if (!candidateResult || !editedContract) return;
    onComplete({
      drivingQuestion: editedContract.drivingQuestion,
      centralTension: editedContract.centralTension,
      knowledgeType: editedContract.knowledgeType,
      contract: editedContract,
    });
  }
```

`focusForContinue` 里加 `setEditedContract(null);`（继续澄清 = 丢弃编辑）。删除 `focusForAdjustment` 函数与 `answerMode==='adjust'` 相关逻辑（inputPlaceholder 的 adjust 分支一并删）。

`CourseContract` 接口补上 `teachingHooks?: string[];`（一期已有该运行时字段，前端类型未声明）。

- [ ] **Step 2: 重做 CandidateContractCard**

整体替换 CandidateContractCard 与 ContractLine（删除 adjustFields/onAdjust/onAdjustField props）：

```tsx
function CandidateContractCard({
  contract,
  isZh,
  onChange,
  onConfirm,
  onContinue,
}: {
  contract: CourseContract;
  isZh: boolean;
  onChange: (next: CourseContract) => void;
  onConfirm: () => void;
  onContinue: () => void;
}) {
  const framing = contract.problemFraming;
  const requiredMissing =
    !contract.drivingQuestion.trim() ||
    !contract.centralTension.trim() ||
    !contract.audience.trim() ||
    !contract.desiredOutcome.trim() ||
    contract.scope.include.length === 0 ||
    contract.scope.exclude.length === 0 ||
    !contract.scope.depth.trim();

  const setField = (path: string, value: string) => {
    const next = JSON.parse(JSON.stringify(contract)) as CourseContract;
    if (path.startsWith('problemFraming.') && next.problemFraming) {
      (next.problemFraming as any)[path.split('.')[1]] = value;
    } else if (path === 'scope.include' || path === 'scope.exclude') {
      (next.scope as any)[path.split('.')[1]] = value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    } else if (path === 'scope.depth') {
      next.scope.depth = value;
    } else if (path === 'teachingHooks') {
      next.teachingHooks = value.split('\n').map(s => s.trim()).filter(Boolean);
    } else {
      (next as any)[path] = value;
    }
    onChange(next);
  };

  return (
    <div className="rounded-lg border border-[color:var(--color-accent)]/25 bg-[color:var(--color-accent)]/5 p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium text-[color:var(--color-text)]">
          {isZh ? '候选学习契约（可直接修改）' : 'Candidate Learning Contract (editable)'}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={requiredMissing}
            className="rounded-md bg-[color:var(--color-text)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isZh ? '确认，用这个生成' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {isZh ? '继续澄清' : 'Continue'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-[color:var(--color-muted)]">
        {isZh ? '你改的就是最终契约；继续澄清会丢弃这里的修改。' : 'Your edits are final; continuing the dialogue discards them.'}
      </p>

      <div className="space-y-2.5">
        <EditableField label={isZh ? '驱动问题' : 'Driving question'} value={contract.drivingQuestion} required onSave={(v) => setField('drivingQuestion', v)} />
        <EditableField label={isZh ? '核心张力' : 'Central tension'} value={contract.centralTension} required onSave={(v) => setField('centralTension', v)} />
        {framing && (
          <>
            <EditableField label={isZh ? '学习困惑' : 'Learning confusion'} value={framing.phenomenon} onSave={(v) => setField('problemFraming.phenomenon', v)} />
            <EditableField label={isZh ? '核心冲突' : 'Core tension'} value={framing.contrast} onSave={(v) => setField('problemFraming.contrast', v)} />
            <EditableField label={isZh ? '模型缺口' : 'Model gap'} value={framing.modelGap} onSave={(v) => setField('problemFraming.modelGap', v)} />
          </>
        )}
        <EditableField label={isZh ? '受众' : 'Audience'} value={contract.audience} required onSave={(v) => setField('audience', v)} />
        <EditableField label={isZh ? '学完能做什么' : 'Desired outcome'} value={contract.desiredOutcome} required onSave={(v) => setField('desiredOutcome', v)} />
        <EditableField label={isZh ? '必须讲（逗号分隔）' : 'Include (comma-separated)'} value={contract.scope.include.join('、')} required onSave={(v) => setField('scope.include', v)} />
        <EditableField label={isZh ? '不讲（逗号分隔）' : 'Exclude (comma-separated)'} value={contract.scope.exclude.join('、')} required onSave={(v) => setField('scope.exclude', v)} />
        <EditableField label={isZh ? '深度取舍' : 'Depth'} value={contract.scope.depth} required onSave={(v) => setField('scope.depth', v)} />
        <EditableField
          label={isZh ? '教学抓手（每行一条）' : 'Teaching hooks (one per line)'}
          value={(contract.teachingHooks || []).join('\n')}
          multiline
          onSave={(v) => setField('teachingHooks', v)}
        />
      </div>
      {requiredMissing && (
        <p className="mt-2 text-xs text-[color:var(--color-danger)]">
          {isZh ? '标 * 的字段不能为空。' : 'Fields marked * cannot be empty.'}
        </p>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onSave,
  required,
  multiline,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const empty = required && !value.trim();

  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className={`cursor-text rounded px-1 -mx-1 transition-colors hover:bg-[color:var(--color-accent)]/10 ${empty ? 'ring-1 ring-[color:var(--color-danger)]/60' : ''}`}
        title="点击编辑"
      >
        <span className="font-medium text-[color:var(--color-text)]">{label}{required ? ' *' : ''}：</span>
        <span className={`whitespace-pre-wrap ${empty ? 'text-[color:var(--color-danger)]' : 'text-[color:var(--color-muted)]'}`}>
          {value || '（空）'}
        </span>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-0.5 block text-xs font-medium text-[color:var(--color-text)]">{label}{required ? ' *' : ''}</label>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        rows={multiline ? Math.max(2, draft.split('\n').length) : 2}
        className="w-full rounded-lg border border-[color:var(--color-accent)]/50 bg-[color:var(--color-bg)] px-2 py-1.5 text-sm text-[color:var(--color-text)] outline-none focus:border-[color:var(--color-accent)]"
      />
    </div>
  );
}
```

调用点同步改（原 `<CandidateContractCard result={candidateResult} ... onAdjust ... onAdjustField ...>` 替换）：

```tsx
      {candidateResult && editedContract && (
        <CandidateContractCard
          contract={editedContract}
          isZh={isZh}
          onChange={setEditedContract}
          onConfirm={confirmCandidate}
          onContinue={focusForContinue}
        />
      )}
```

确认顶部 import 有 `useEffect`（文件现有 import 已含）。删除不再使用的 `ContractLine`、`inputPlaceholder` 的 adjust 分支与 `answerMode` 中 'adjust' 值（保留 'answer'|'continue'）。

- [ ] **Step 3: 验证 + Commit**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -3`
Expected: tsc 无输出；build 通过（prerender smoke checks passed）

```bash
git add src/components/ClarificationDialogue.tsx
git commit -m "Make candidate contract card field-editable with user authority"
```

---

### Task 5: 文档同步 + 冒烟

**Files:**
- Modify: `README.md`、`docs/superpowers/specs/2026-07-11-clarification-phase2-design.md`
- 冒烟为手动步骤（控制器执行）

- [ ] **Step 1: README**

澄清段两条子行之后再加一行（保持树形风格）：

```txt
    ├─ 每轮提问附可点选的候选回答，评审打回的追问基于评审发现生成
```

（插在现有 `├─ 异族 LLM 评审契约实质…` 之前或之后均可，保持 ├─/└─ 结构正确。）

- [ ] **Step 2: 设计文档状态**

`docs/superpowers/specs/2026-07-11-clarification-phase2-design.md` 的 `状态：已获用户批准` → `状态：已实施（2026-07-11）`。

- [ ] **Step 3: 全量验证 + Commit**

Run: `npm test && npm run check && npx tsc --noEmit`
Expected: 全绿

```bash
git add README.md docs/superpowers/specs/2026-07-11-clarification-phase2-design.md
git commit -m "Document clarification phase-2 dialogue options and contract editing"
```

- [ ] **Step 4: 冒烟（手动，控制器）**

1. `sudo systemctl restart agent-backend`
2. API 脚本对话：确认 respond 返回 options 且可作为回答回传；初学者信号回答（"不知道"）必须拿到 options
3. 故意空洞对话触发评审打回：确认追问语义对应评审 issue 且无字段名泄漏
4. 前端 `npm run dev` 或构建后：候选卡片字段可点击编辑、必填空时确认按钮禁用、编辑 modelGap 后确认生成，检查 job 的 request.contract 是编辑后的值

---

## Self-Review 记录

- 规格覆盖：设计 3 节 → Task 1（options schema+透传）、Task 2（W3 评审追问）、Task 3（前端按钮）、Task 4（卡片实编辑，含 teachingHooks 显示编辑、继续澄清丢弃语义、删除假编辑）、Task 5（文档+冒烟）
- 类型一致：options 恒 list[str]（四分支）；`_review_followup_question(client, issues, topic, history)->{question,options}`；前端 `sendAnswer(text)` 为按钮与表单共享路径；`editedContract: CourseContract`（补 teachingHooks 可选类型）
- 关键测试联动：既有 hollow-contract 测试的 side_effect 需追加第三个响应（Task 2 Step 1 已明确）
- 占位符扫描：无 TBD；前端两个组件给出完整代码
