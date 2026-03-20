#!/usr/bin/env python3
"""Unit tests for the pure (non-LLM) functions in generate.py."""
import unittest
import sys
sys.path.insert(0, '.')
from generate import slugify, _norm_plan, _norm_module, _norm_nar, build_cmap, build_ireg


class TestSlugify(unittest.TestCase):
    def test_ascii(self):
        self.assertEqual(slugify("Git Internals"), "git-internals")

    def test_chinese_produces_hash_slug(self):
        slug = slugify("操作系统内核")
        self.assertTrue(slug.startswith("course-"))
        self.assertEqual(len(slug), len("course-") + 8)

    def test_special_chars_stripped(self):
        # + and / are not \w so they get removed
        self.assertEqual(slugify("C++ / Templates"), "c-templates")

    def test_empty_string(self):
        slug = slugify("")
        self.assertTrue(slug.startswith("course-"))

    def test_whitespace_collapsing(self):
        self.assertEqual(slugify("  hello   world  "), "hello-world")

    def test_hyphens_preserved(self):
        self.assertEqual(slugify("already-slug"), "already-slug")


class TestNormNar(unittest.TestCase):
    def test_valid_type(self):
        result = _norm_nar({"type": "text", "content": "hello"})
        self.assertEqual(result["type"], "text")
        self.assertEqual(result["content"], "hello")

    def test_alias_comparisonframe(self):
        result = _norm_nar({"type": "comparisonFrame", "content": "a vs b"})
        self.assertEqual(result["type"], "comparison")

    def test_alias_concept_map(self):
        result = _norm_nar({"type": "concept-map", "content": "map"})
        self.assertEqual(result["type"], "diagram")

    def test_unknown_type_becomes_text(self):
        result = _norm_nar({"type": "unknownBlock", "content": "stuff"})
        self.assertEqual(result["type"], "text")

    def test_steps_with_valid_data(self):
        result = _norm_nar({
            "type": "steps", "content": "",
            "steps": [{"title": "Step 1", "description": "Do X", "visual": "code", "highlight": ""}]
        })
        self.assertIsNotNone(result)
        self.assertEqual(result["type"], "steps")
        self.assertEqual(len(result["steps"]), 1)

    def test_steps_without_steps_returns_none(self):
        result = _norm_nar({"type": "steps", "content": ""})
        self.assertIsNone(result)

    def test_steps_with_empty_list_returns_none(self):
        result = _norm_nar({"type": "steps", "content": "", "steps": []})
        self.assertIsNone(result)

    def test_label_preserved(self):
        result = _norm_nar({"type": "diagram", "content": "x", "label": "My diagram"})
        self.assertEqual(result["label"], "My diagram")

    def test_comparison_gets_default_label(self):
        result = _norm_nar({"type": "comparison", "content": "x"})
        self.assertEqual(result["label"], "")


class TestBuildCmap(unittest.TestCase):
    def test_basic(self):
        module = {
            "title": "Test Module",
            "concepts": [{"name": "A", "note": "a"}, {"name": "B", "note": "b"}],
            "logicChain": ["step1", "step2"]
        }
        cmap = build_cmap(module)
        self.assertIn("nodes", cmap)
        self.assertIn("edges", cmap)
        # core node + 2 concept nodes
        self.assertEqual(len(cmap["nodes"]), 3)
        self.assertEqual(len(cmap["edges"]), 2)
        self.assertEqual(cmap["title"], "Test Module")

    def test_few_concepts_adds_fallback_nodes(self):
        module = {
            "title": "Tiny",
            "concepts": [{"name": "Only", "note": "one"}],
            "logicChain": []
        }
        cmap = build_cmap(module)
        # 1 concept + core = 2, which is < 3, so fallback adds nX, nY
        self.assertTrue(len(cmap["nodes"]) >= 3)

    def test_no_concepts(self):
        module = {"title": "Empty", "concepts": [], "logicChain": []}
        cmap = build_cmap(module)
        # core only = 1 node < 3, so fallback adds 2 more
        self.assertEqual(len(cmap["nodes"]), 3)

    def test_aria_label(self):
        module = {"title": "Foo", "concepts": [], "logicChain": []}
        cmap = build_cmap(module)
        self.assertEqual(cmap["ariaLabel"], "Foo 概念关系图")


class TestBuildIreg(unittest.TestCase):
    def test_core_priority(self):
        mod = {"interactionRequirements": [
            {"capability": "compare", "purpose": "test", "priority": "core"}
        ]}
        reg = build_ireg(mod)
        self.assertIn("heroInteractive", reg)
        self.assertEqual(reg["heroInteractive"]["capability"], "compare")

    def test_secondary_priority(self):
        mod = {"interactionRequirements": [
            {"capability": "trace", "purpose": "test", "priority": "secondary"}
        ]}
        reg = build_ireg(mod)
        self.assertIn("secondaryInteractive", reg)

    def test_empty_requirements(self):
        mod = {"interactionRequirements": []}
        reg = build_ireg(mod)
        self.assertEqual(reg, {})

    def test_no_requirements_key(self):
        mod = {}
        reg = build_ireg(mod)
        self.assertEqual(reg, {})


class TestNormPlan(unittest.TestCase):
    def test_minimal_plan(self):
        raw = {
            "title": "My Course", "subtitle": "Sub", "goal": "Learn stuff",
            "categories": [{"id": "core", "name": "Core", "color": "blue"}],
            "audience": {"primaryAudience": "devs", "priorKnowledge": ["python"], "desiredOutcome": "understand"},
            "learningGoals": ["goal1"],
            "moduleOutlines": [
                {"title": "M1", "subtitle": "First", "category": "core",
                 "moduleKind": "concept-clarification", "primaryCognitiveAction": "distinguish",
                 "focusQuestion": "Why?", "misconception": "Wrong", "targetChunk": "chunk1"}
            ]
        }
        plan = _norm_plan(raw, "My Course", "my-course")
        self.assertEqual(plan["slug"], "my-course")
        self.assertEqual(len(plan["_outlines"]), 1)
        self.assertEqual(plan["_outlines"][0]["id"], "s01")

    def test_invalid_category_falls_back(self):
        raw = {
            "title": "X", "categories": [{"id": "core", "name": "Core", "color": "blue"}],
            "moduleOutlines": [
                {"title": "M1", "subtitle": "", "category": "nonexistent",
                 "moduleKind": "", "primaryCognitiveAction": "", "focusQuestion": "",
                 "misconception": "", "targetChunk": ""}
            ]
        }
        plan = _norm_plan(raw, "X", "x")
        self.assertEqual(plan["_outlines"][0]["category"], "core")

    def test_invalid_color_defaults_to_blue(self):
        raw = {
            "title": "X",
            "categories": [{"id": "c1", "name": "C1", "color": "pink"}],
            "moduleOutlines": []
        }
        plan = _norm_plan(raw, "X", "x")
        self.assertEqual(plan["categories"][0]["color"], "blue")


class TestNormModule(unittest.TestCase):
    def test_basic_module(self):
        raw = {
            "title": "Mod", "subtitle": "Sub", "focusQuestion": "Q?",
            "misconception": "M", "keyInsight": "K", "opening": "O",
            "quote": "Quote", "concepts": [{"name": "C1", "note": "N1"}],
            "logicChain": ["L1"], "examples": ["E1"], "counterexamples": [],
            "pitfalls": [{"point": "P", "rootCause": "R"}],
            "narrative": [{"type": "text", "content": "Hello"}],
            "interactionRequirements": [{"capability": "compare", "purpose": "test", "priority": "core"}],
            "retrievalPrompts": [{"type": "fill-gap", "prompt": "Fill this", "answerShape": "shape"}],
            "bridgeTo": "Next question"
        }
        outline = {"id": "s01", "number": 1, "title": "Mod", "subtitle": "Sub",
                   "category": "core", "moduleKind": "concept-clarification",
                   "primaryCognitiveAction": "distinguish"}
        result = _norm_module(raw, outline, "s02")
        self.assertEqual(result["id"], "s01")
        self.assertEqual(result["nextModuleId"], "s02")
        self.assertEqual(result["bridgeTo"], "Next question")
        self.assertEqual(len(result["narrative"]), 1)
        self.assertEqual(len(result["pitfalls"]), 1)

    def test_last_module_no_bridge(self):
        raw = {
            "title": "Last", "subtitle": "", "focusQuestion": "",
            "misconception": "", "keyInsight": "", "opening": "",
            "concepts": [], "logicChain": [], "examples": [],
            "counterexamples": [], "pitfalls": [], "narrative": [],
            "interactionRequirements": [], "retrievalPrompts": [],
            "bridgeTo": "ignored"
        }
        outline = {"id": "s12", "number": 12, "title": "Last", "subtitle": "",
                   "category": "core", "moduleKind": "meta-reflection",
                   "primaryCognitiveAction": "reflect",
                   "focusQuestion": "", "misconception": ""}
        result = _norm_module(raw, outline, None)
        self.assertIsNone(result["nextModuleId"])
        self.assertIsNone(result["bridgeTo"])


if __name__ == '__main__':
    unittest.main()
