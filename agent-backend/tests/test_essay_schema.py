import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from essay_schema import (
    normalize_chapter_payload,
    normalize_essay_plan_payload,
    normalize_writing_mode,
    register_for_knowledge_type,
    validate_essay_narrative_block,
    writing_mode_for_knowledge_type,
)


class TestRegisterMapping(unittest.TestCase):
    def test_conceptual_is_essay(self):
        self.assertEqual(register_for_knowledge_type("conceptual"), "essay")
        self.assertEqual(register_for_knowledge_type("strategic"), "essay")

    def test_procedural_is_explainer(self):
        self.assertEqual(register_for_knowledge_type("procedural"), "explainer")
        self.assertEqual(register_for_knowledge_type("factual"), "explainer")
        self.assertEqual(register_for_knowledge_type("anything-else"), "explainer")

    def test_writing_mode_defaults(self):
        self.assertEqual(writing_mode_for_knowledge_type("conceptual"), "conceptual-essay")
        self.assertEqual(writing_mode_for_knowledge_type("strategic"), "conceptual-essay")
        self.assertEqual(writing_mode_for_knowledge_type("metacognitive"), "conceptual-essay")
        self.assertEqual(writing_mode_for_knowledge_type("procedural"), "mechanism-explainer")
        self.assertEqual(writing_mode_for_knowledge_type("factual"), "mechanism-explainer")
        self.assertEqual(writing_mode_for_knowledge_type("unknown"), "mechanism-explainer")

    def test_valid_case_narrative_is_preserved(self):
        self.assertEqual(normalize_writing_mode("case-narrative", "conceptual"), "case-narrative")
        self.assertEqual(normalize_writing_mode("story", "conceptual"), "conceptual-essay")


class TestPlanNormalization(unittest.TestCase):
    def test_fills_register_from_knowledge_type(self):
        plan = {"title": "T", "knowledgeType": "conceptual", "drivingQuestion": "Q?",
                "centralTension": "X", "chapters": ["c01", "c02", "c03", "c04"]}
        result = normalize_essay_plan_payload(plan, topic="哲学", slug="phil")
        self.assertEqual(result["register"], "essay")
        self.assertEqual(result["writingMode"], "conceptual-essay")
        self.assertEqual(result["slug"], "phil")
        self.assertEqual(result["language"], "zh")
        self.assertEqual(result["chapters"], ["c01", "c02", "c03", "c04"])
        self.assertIn("whyExists", result["overview"])

    def test_explicit_register_wins(self):
        plan = {"title": "T", "register": "explainer", "knowledgeType": "conceptual",
                "drivingQuestion": "Q?", "centralTension": "X"}
        result = normalize_essay_plan_payload(plan, topic="t", slug="s")
        self.assertEqual(result["register"], "explainer")
        self.assertEqual(result["writingMode"], "conceptual-essay")


class TestChapterNormalization(unittest.TestCase):
    def test_basic_chapter(self):
        ch = {"title": "立题", "role": "抛问题",
              "narrative": [{"type": "text", "content": "正文"}],
              "bridge": "下一章"}
        result = normalize_chapter_payload(ch, chapter_id="c01", number=1)
        self.assertEqual(result["id"], "c01")
        self.assertEqual(result["number"], 1)
        self.assertEqual(len(result["narrative"]), 1)
        self.assertIsNone(result["highlight"])
        self.assertEqual(result["bridge"], "下一章")

    def test_invalid_block_type_coerced_to_text(self):
        block = validate_essay_narrative_block({"type": "steps", "content": "x"}, 0)
        self.assertEqual(block["type"], "text")

    def test_heading_aliases_are_preserved_as_headings(self):
        for alias in ("section", "subheading", "h2", "h3"):
            block = validate_essay_narrative_block({"type": alias, "content": "小节标题"}, 0)
            self.assertEqual(block["type"], "heading")

    def test_code_block_keeps_lang(self):
        block = validate_essay_narrative_block({"type": "code", "content": "print(1)", "lang": "python"}, 0)
        self.assertEqual(block["lang"], "python")

    def test_bespoke_highlight_needs_component(self):
        ch = {"title": "t", "narrative": [{"type": "text", "content": "a"}],
              "highlight": {"kind": "bespoke", "caption": "c", "afterBlock": 0}}
        result = normalize_chapter_payload(ch, chapter_id="c02", number=2)
        self.assertIsNone(result["highlight"])  # 缺 component -> 丢弃

    def test_trace_highlight_kept(self):
        ch = {"title": "t", "narrative": [{"type": "text", "content": "a"}],
              "highlight": {"kind": "trace", "data": {"steps": []}, "caption": "c", "afterBlock": 0}}
        result = normalize_chapter_payload(ch, chapter_id="c02", number=2)
        self.assertEqual(result["highlight"]["kind"], "trace")


class EmptyBlockDropTests(unittest.TestCase):
    def test_normalize_chapter_drops_empty_content_blocks(self):
        chapter = normalize_chapter_payload(
            {"narrative": [
                {"type": "text", "content": "正文一段。"},
                {"type": "text", "content": "   "},
                {"type": "heading", "content": ""},
                {"type": "callout", "content": "提示"},
            ]},
            chapter_id="c01",
            number=1,
        )
        self.assertEqual([b["content"] for b in chapter["narrative"]], ["正文一段。", "提示"])
