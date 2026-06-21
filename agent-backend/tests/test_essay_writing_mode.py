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
        self.assertIn("不要提前扩写萨特", user_prompt)

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


if __name__ == "__main__":
    unittest.main()
