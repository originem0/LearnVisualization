import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from essay_prompts import build_chapter_prompts, build_judge_prompts  # noqa: E402
from essay_quality import evaluate_chapter_quality  # noqa: E402


def conceptual_contract() -> dict:
    return {
        "drivingQuestion": "尼采为什么把现代人的困境说成价值秩序的危机？",
        "centralTension": "现代人以为自己摆脱了旧权威，却没有自动获得新的价值尺度。",
        "knowledgeType": "conceptual",
        "audience": "想理解尼采但不想读成哲学家生平故事的学习者",
        "desiredOutcome": "能解释价值秩序危机如何组织尼采的问题意识",
        "scope": {
            "include": ["价值秩序", "上帝之死", "虚无主义"],
            "exclude": ["存在主义通史", "萨特专题"],
            "depth": "围绕核心概念关系深挖",
        },
        "problemFraming": {
            "phenomenon": "旧道德权威退场后，人仍然需要判断什么值得追求",
            "contrast": "直觉认为自由就是没有约束；尼采的问题是旧尺度崩塌后新尺度从哪里来",
            "problemNature": "model_mismatch",
            "systemGoal": "建立价值秩序如何约束判断的解释模型",
            "modelGap": "缺少上帝之死、虚无主义和价值重估之间的关系链",
        },
    }


def plan_artifact() -> dict:
    contract = conceptual_contract()
    return {
        "register": "essay",
        "writingMode": "conceptual-essay",
        "drivingQuestion": contract["drivingQuestion"],
        "centralTension": contract["centralTension"],
        "overview": {"whyExists": "解释价值危机", "wherePoints": "走向价值重估", "arc": ["先立危机"]},
        "factSpine": ["《快乐的科学》里疯人宣告上帝已死"],
        "chapterPlans": [
            {"id": "c01", "number": 1, "title": "危机不是情绪", "role": "建立价值秩序危机这个章节主轴"},
            {"id": "c02", "number": 2, "title": "虚无主义如何出现", "role": "追踪危机后果"},
        ],
    }


class WritingModePromptTests(unittest.TestCase):
    def test_conceptual_chapter_prompt_rejects_story_requirement(self):
        _, user_prompt = build_chapter_prompts(
            request_payload={"topic": "尼采", "contract": conceptual_contract()},
            plan_artifact=plan_artifact(),
            chapter_plan=plan_artifact()["chapterPlans"][0],
            prev_chapter_ending=None,
        )

        self.assertIn("writingMode: conceptual-essay", user_prompt)
        self.assertIn("不要求人物、情节、场景、个人经历", user_prompt)
        self.assertIn("narrative 表示章节内容的连续性，不表示必须写成故事体裁", user_prompt)
        self.assertIn("不得成段展开", user_prompt)

    def test_conceptual_judge_prompt_uses_chapter_role_not_story_rubric(self):
        chapter = {
            "id": "c01",
            "number": 1,
            "title": "危机不是情绪",
            "role": "建立价值秩序危机这个章节主轴",
            "narrative": [{"type": "text", "content": "价值秩序危机不是一段人物故事。"}],
        }
        _, user_prompt = build_judge_prompts(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=plan_artifact()["chapterPlans"][0],
            plan_artifact=plan_artifact(),
        )

        self.assertIn("建立价值秩序危机这个章节主轴", user_prompt)
        self.assertIn("禁止因为没有场景、人物、情节、个人经历而判定不合格", user_prompt)
        self.assertIn("比较对象是否受控", user_prompt)

    def test_final_chapter_prompt_requires_closure(self):
        final_plan = {"id": "c02", "number": 2, "title": "虚无主义如何出现", "role": "追踪危机后果"}
        _, user_prompt = build_chapter_prompts(
            request_payload={"topic": "尼采", "contract": conceptual_contract()},
            plan_artifact=plan_artifact(),
            chapter_plan=final_plan,
            prev_chapter_ending="前文已经建立价值秩序危机。",
        )

        self.assertIn("这是最后一章", user_prompt)
        self.assertIn("正文必须完成课程收束", user_prompt)
        self.assertIn("不要写“下一章/接下来/要回答这些/必须深入”", user_prompt)


class ConceptualEssayQualityTests(unittest.TestCase):
    def test_conceptual_quality_accepts_argument_without_story_scene(self):
        chapter = {
            "id": "c01",
            "number": 1,
            "title": "价值秩序危机不是情绪危机",
            "role": "建立价值秩序危机这个章节主轴",
            "narrative": [
                {"type": "text", "content": "尼采说的价值秩序危机，首先不是某个人物遭遇坏情绪。它指向判断尺度失效：人仍在选择，却说不清什么选择值得被承认。"},
                {"type": "heading", "content": "危机发生在尺度上"},
                {"type": "text", "content": "《快乐的科学》里“上帝已死”的喊声，具体锚定的是旧权威失去公共约束力。这个事实不是情节装饰，而是概念关系的入口。"},
                {"type": "text", "content": "因此，虚无主义不是没有目标，而是目标还在运转，价值根据已经松动。危机、尺度、重估三者形成一条关系链。"},
                {"type": "callout", "content": "这一章只立起价值秩序危机，不展开萨特式存在主义比较。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=plan_artifact()["chapterPlans"][0],
        )

        self.assertTrue(result["pass"], result["issues"])

    def test_conceptual_quality_flags_missing_role_and_runaway_comparison(self):
        chapter = {
            "id": "c01",
            "number": 1,
            "title": "存在主义的一般背景",
            "role": "建立价值秩序危机这个章节主轴",
            "narrative": [
                {"type": "text", "content": "萨特谈自由。萨特谈选择。萨特谈责任。萨特谈存在先于本质。"},
                {"type": "heading", "content": "比较对象"},
                {"type": "text", "content": "这里继续讨论萨特，而不是尼采的问题。这个段落有句子。这个段落还有句子。"},
                {"type": "text", "content": "文本长度足够，但方向已经偏走。它没有解释原本该完成的问题。它只在绕旁支。"},
                {"type": "callout", "content": "萨特成为主角。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=plan_artifact()["chapterPlans"][0],
        )

        self.assertFalse(result["pass"])
        self.assertTrue(any("章节 role" in issue for issue in result["issues"]))
        self.assertTrue(any("比较对象喧宾夺主" in issue for issue in result["issues"]))

    def test_conceptual_quality_allows_bounded_comparison_mentions(self):
        chapter_plan = {
            "id": "c03",
            "number": 3,
            "title": "超人与价值重估：创造新尺度的尝试",
            "role": "展示尼采的跨越策略：超人如何通过价值重估克服不自知的虚无主义",
        }
        chapter = {
            "id": "c03",
            "number": 3,
            "title": chapter_plan["title"],
            "role": chapter_plan["role"],
            "narrative": [
                {"type": "heading", "content": "超人不是强者神话"},
                {"type": "text", "content": "超人首先是价值重估的承担者。尼采的问题不是谁更有力量，而是谁能在旧尺度失效后重新刻下尺度。"},
                {"type": "text", "content": "价值重估要求人不再把旧道德残渣误认为常识。这里可以顺手区分萨特：萨特谈自由选择，但本章只用这个差异凸显尼采的尺度创造。"},
                {"type": "heading", "content": "价值重估如何克服虚无"},
                {"type": "text", "content": "具体说，重估不是把偏好改名为价值，而是改变评价发生的根据。超人要创造的不是一个新口号，而是一套能让生命重新排序的度量衡。"},
                {"type": "text", "content": "因此，萨特只作为后文对照的边界：本章主轴仍是尼采如何把虚无主义问题推进到超人与价值重估。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=chapter_plan,
        )

        self.assertTrue(result["pass"], result["issues"])

    def test_conceptual_quality_allows_comparison_role_without_named_role(self):
        chapter_plan = {
            "id": "c05",
            "number": 5,
            "title": "尺度创造与尺度缺席的根本分歧",
            "role": "解决主线张力：判断三人在价值重估问题上的根本分歧，确立面对虚无的判断框架",
        }
        chapter = {
            "id": "c05",
            "number": 5,
            "title": chapter_plan["title"],
            "role": chapter_plan["role"],
            "narrative": [
                {"type": "text", "content": "尼采把问题推向尺度创造：上帝已死后，人不能只沿用旧价值残渣。萨特则把真空转译为自由选择，认为人通过选择承担价值。"},
                {"type": "text", "content": "萨特的强处在于承认没有预设本质，弱处在于选择的尺度仍可能来自旧道德惯性。加缪选择保持荒谬中的反抗，但反抗一旦判断界限，也需要某种尺度。"},
                {"type": "text", "content": "因此，尼采、萨特和加缪的分歧不在口号，而在面对无尺度处境时是否要重新创造尺度。萨特要求真诚选择，加缪要求清醒反抗，尼采要求价值重估。"},
                {"type": "text", "content": "这个判断框架让初学者能回到原问题：不是没有信仰后怎样安慰自己，而是价值根据失效后，人是否还能为自己的生活建立新的度量衡。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=chapter_plan,
        )

        self.assertTrue(result["pass"], result["issues"])

    def test_conceptual_quality_does_not_hard_fail_without_heading(self):
        chapter_plan = {
            "id": "c03",
            "number": 3,
            "title": "超人与价值重估：创造新尺度的尝试",
            "role": "展示尼采的跨越策略：超人如何通过价值重估克服不自知的虚无主义",
        }
        chapter = {
            "id": "c03",
            "number": 3,
            "title": chapter_plan["title"],
            "role": chapter_plan["role"],
            "narrative": [
                {"type": "text", "content": "超人不是英雄故事，而是价值重估的承担者。尼采要解决的是旧尺度崩塌后如何重新刻下尺度。"},
                {"type": "text", "content": "具体锚点在《快乐的科学》的上帝之死：旧的评价根据失效，人却仍然沿用旧价值残渣。"},
                {"type": "text", "content": "价值重估因此不是换一个目标，而是改变评价发生的根据。超人代表能承担这种创造压力的人。"},
                {"type": "text", "content": "这一章完成的主线是：超人如何通过价值重估克服不自知的虚无主义，并把问题推向后续比较。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=chapter_plan,
        )

        self.assertTrue(result["pass"], result["issues"])

    def test_final_chapter_quality_flags_forward_throw(self):
        chapter_plan = {
            "id": "c05",
            "number": 5,
            "title": "尺度创造与尺度缺席的根本分歧",
            "role": "解决主线张力：判断三人在价值重估问题上的根本分歧，确立面对虚无的判断框架",
        }
        chapter = {
            "id": "c05",
            "number": 5,
            "title": chapter_plan["title"],
            "role": chapter_plan["role"],
            "narrative": [
                {"type": "heading", "content": "根本分歧"},
                {"type": "text", "content": "尼采要求价值重估，萨特要求自由选择，加缪要求荒谬反抗。三者分歧在于是否要创造尺度。"},
                {"type": "text", "content": "这个判断框架能解释上帝已死之后的虚无主义处境，也能区分自由、反抗和超人的不同路线。"},
                {"type": "text", "content": "要回答这些，我们必须深入权力意志的内部，继续追问它如何承担永恒重负。"},
            ],
        }

        result = evaluate_chapter_quality(
            chapter,
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan=chapter_plan,
            is_final_chapter=True,
        )

        self.assertFalse(result["pass"])
        self.assertTrue(any("末章" in issue for issue in result["issues"]))


class ContractGroundingResearchPlanTests(unittest.TestCase):
    def _contract(self):
        return {
            "drivingQuestion": "尼采为什么把困境说成价值秩序危机？",
            "centralTension": "摆脱旧权威不等于获得新尺度",
            "knowledgeType": "conceptual",
            "audience": "想理解尼采的学习者",
            "desiredOutcome": "能解释价值秩序危机",
            "scope": {"include": ["价值秩序", "上帝之死"], "exclude": ["萨特专题"], "depth": "深挖"},
            "problemFraming": {
                "phenomenon": "旧道德权威退场后人仍需判断什么值得追求",
                "contrast": "直觉认为自由即无约束；尼采问旧尺度崩塌后新尺度从哪来",
                "problemNature": "model_mismatch",
                "systemGoal": "建立价值秩序约束判断的模型",
                "modelGap": "缺少上帝之死、虚无主义、价值重估之间的关系链",
            },
            "teachingHooks": ["《快乐的科学》125 节狂人宣告", "重估一切价值的晚期计划"],
        }

    def test_chapter_prompt_carries_phenomenon_and_model_gap(self):
        from essay_prompts import build_chapter_prompts
        payload = {"topic": "尼采哲学", "output_slug": "x", "contract": self._contract()}
        plan = {
            "register": "essay", "writingMode": "conceptual-essay",
            "drivingQuestion": self._contract()["drivingQuestion"],
            "centralTension": self._contract()["centralTension"],
            "overview": {"whyExists": "", "wherePoints": "", "arc": []},
            "chapterPlans": [{"id": "c01", "number": 1}],
            "factSpine": [],
        }
        _, user = build_chapter_prompts(
            request_payload=payload, plan_artifact=plan,
            chapter_plan={"id": "c01", "number": 1, "title": "t", "role": "r"},
            prev_chapter_ending=None,
        )
        self.assertIn("旧道德权威退场后人仍需判断什么值得追求", user)  # phenomenon
        self.assertIn("缺少上帝之死、虚无主义、价值重估之间的关系链", user)  # modelGap

    def test_verify_prompt_checks_model_gap_filled(self):
        from essay_prompts import build_course_verify_prompts
        _, user = build_course_verify_prompts(
            plan_artifact={"drivingQuestion": "q", "centralTension": "t", "contract": {"desiredOutcome": "o"}},
            chapters=[{"id": "c01", "title": "x", "role": "r", "narrative": [{"type": "text", "content": "正文"}]}],
            model_gap="缺少某某关系模型",
        )
        self.assertIn("缺少某某关系模型", user)
        self.assertIn("填补", user)

    def test_research_query_prompt_grounds_on_model_gap_and_hooks(self):
        from essay_prompts import build_research_query_prompts
        _, user = build_research_query_prompts("尼采哲学", self._contract())
        self.assertIn("缺少上帝之死、虚无主义、价值重估之间的关系链", user)  # modelGap
        self.assertIn("直觉认为自由即无约束", user)                          # contrast
        self.assertIn("《快乐的科学》125 节狂人宣告", user)                   # teachingHooks 种子

    def test_plan_prompt_requires_filling_model_gap(self):
        from essay_prompts import build_essay_plan_prompts
        payload = {"topic": "尼采哲学", "output_slug": "x", "contract": self._contract()}
        _, user = build_essay_plan_prompts(payload)
        self.assertIn("modelGap", user)      # 指令引用了模型缺口概念
        self.assertIn("填补", user)          # 要求章节弧线服务于填补缺口


if __name__ == "__main__":
    unittest.main()


class FragmentationGateTests(unittest.TestCase):
    def test_fragmented_narrative_fails_local_gate(self):
        blocks = [{"type": "text", "content": f"短句{i}。"} for i in range(30)]
        result = evaluate_chapter_quality(
            {"title": "碎块", "narrative": blocks},
            register="essay",
            writing_mode="conceptual-essay",
            chapter_plan={"role": "短句练习"},
            is_final_chapter=False,
        )
        self.assertFalse(result["pass"])
        self.assertTrue(any("碎块化" in issue for issue in result["issues"]))


class JudgeRoleGroundingTests(unittest.TestCase):
    def _chapter(self):
        return {"id": "c04", "number": 4, "title": "责任", "role": "r",
                "narrative": [{"type": "text", "content": "正文"}]}

    def _plan(self):
        return {"drivingQuestion": "q", "centralTension": "t",
                "chapterPlans": [{"id": "c04", "number": 4}]}

    def test_judge_role_check_is_evidence_scoped_when_evidence_present(self):
        _, user = build_judge_prompts(
            self._chapter(), register="essay", writing_mode="conceptual-essay",
            chapter_plan={"id": "c04", "role": "引入某判例"}, plan_artifact=self._plan(),
            evidence_items=[{"id": "E01", "kind": "quote", "content": "证据全文"}],
        )
        self.assertIn("证据能支撑的范围", user)
        self.assertIn("凭记忆", user)

    def test_judge_without_evidence_keeps_plain_role_check(self):
        _, user = build_judge_prompts(
            self._chapter(), register="essay", writing_mode="conceptual-essay",
            chapter_plan={"id": "c04", "role": "r"}, plan_artifact=self._plan(),
            evidence_items=None,
        )
        self.assertNotIn("证据能支撑的范围", user)


class PlanRoleGroundingTests(unittest.TestCase):
    def _payload(self):
        return {"topic": "AI 就业", "output_slug": "x", "contract": {
            "drivingQuestion": "q", "centralTension": "t", "knowledgeType": "conceptual",
            "audience": "a", "desiredOutcome": "o",
            "scope": {"include": ["x"], "exclude": ["y"], "depth": "d"},
            "problemFraming": {"phenomenon": "p", "contrast": "c", "problemNature": "model_mismatch",
                               "systemGoal": "s", "modelGap": "缺少某关系模型"},
        }}

    def _research(self):
        return {"evidence": [
            {"id": "E01", "kind": "quote", "content": "证据一", "sourceTitle": "维基", "sourceUrl": "https://x"},
            {"id": "E02", "kind": "fact", "content": "证据二", "sourceTitle": "维基", "sourceUrl": "https://y"},
        ]}

    def test_plan_prompt_grounds_role_anchors_on_evidence(self):
        from essay_prompts import build_essay_plan_prompts
        _, user = build_essay_plan_prompts(self._payload(), research_artifact=self._research())
        self.assertIn("具体锚点只能引用本章证据覆盖的内容", user)

    def test_plan_prompt_without_evidence_omits_role_grounding(self):
        from essay_prompts import build_essay_plan_prompts
        _, user = build_essay_plan_prompts(self._payload(), research_artifact=None)
        self.assertNotIn("具体锚点只能引用本章证据覆盖的内容", user)
