"""Tests for normalize_module_payload, normalize_plan_payload, validate_narrative_block, build_concept_map."""

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "agent-backend" / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from quality import (
    build_concept_map,
    normalize_module_payload,
    normalize_plan_payload,
    validate_narrative_block,
)

# -- Minimal valid fixtures --

MINIMAL_OUTLINE = {
    "id": "s01",
    "number": 1,
    "title": "Test Module",
    "subtitle": "Sub",
    "category": "core",
    "moduleKind": "concept-clarification",
    "primaryCognitiveAction": "distinguish",
    "focusQuestion": "Why?",
    "misconception": "Wrong assumption",
    "targetChunk": "chunk1",
}

MINIMAL_MODULE_PAYLOAD = {
    "title": "Test Module",
    "subtitle": "Sub",
    "focusQuestion": "Why does X happen?",
    "misconception": "People think X is Y",
    "keyInsight": "X is actually Z",
    "opening": "You probably assumed...",
    "concepts": [{"name": "ConceptA", "note": "important"}, {"name": "ConceptB", "note": "also important"}],
    "logicChain": ["step 1 leads to step 2", "step 2 causes step 3"],
    "examples": ["A concrete example of X in action"],
    "narrative": [
        {"type": "heading", "content": "Section Title"},
        {"type": "text", "content": "Body paragraph explaining the concept."},
        {"type": "callout", "content": "Key takeaway here."},
    ],
    "bridgeTo": "Next chapter explores Y",
}

MINIMAL_PLAN_PAYLOAD = {
    "title": "Test Course",
    "subtitle": "A course",
    "goal": "Learn X",
    "audience": {"primaryAudience": "beginners", "priorKnowledge": [], "constraints": []},
    "learningGoals": ["Understand X"],
    "categories": [{"id": "core", "name": "Core", "color": "blue"}],
    "moduleOutlines": [
        {
            "id": "s01",
            "title": "Module 1",
            "subtitle": "First",
            "category": "core",
            "moduleKind": "concept-clarification",
            "primaryCognitiveAction": "distinguish",
            "focusQuestion": "Why?",
            "misconception": "Wrong",
            "targetChunk": "chunk1",
        }
    ],
}


class TestNormalizePassthrough(unittest.TestCase):
    """Scenario 1: v3 and unknown fields are preserved through normalization."""

    def test_module_v3_fields_preserved(self):
        payload = {
            **MINIMAL_MODULE_PAYLOAD,
            "knowledgeTypes": ["conceptual"],
            "bloomLevel": "analyze",
            "exercises": [{"id": "ex1", "type": "explain", "prompt": "Why?"}],
            "scaffoldProgression": ["full", "faded-1", "free"],
            "elementInteractivity": "high",
        }
        result = normalize_module_payload(payload, module_outline=MINIMAL_OUTLINE, next_module_id="s02")
        self.assertEqual(result["knowledgeTypes"], ["conceptual"])
        self.assertEqual(result["bloomLevel"], "analyze")
        self.assertEqual(len(result["exercises"]), 1)
        self.assertEqual(result["scaffoldProgression"], ["full", "faded-1", "free"])
        self.assertEqual(result["elementInteractivity"], "high")

    def test_module_unknown_fields_preserved(self):
        payload = {**MINIMAL_MODULE_PAYLOAD, "customField": "hello", "domainPedagogy": "primm"}
        result = normalize_module_payload(payload, module_outline=MINIMAL_OUTLINE, next_module_id=None)
        self.assertEqual(result["customField"], "hello")
        self.assertEqual(result["domainPedagogy"], "primm")

    def test_plan_outline_v3_fields_preserved(self):
        plan = {
            **MINIMAL_PLAN_PAYLOAD,
            "moduleOutlines": [
                {
                    **MINIMAL_PLAN_PAYLOAD["moduleOutlines"][0],
                    "knowledgeTypes": ["procedural"],
                    "bloomLevel": "apply",
                    "elementInteractivity": "high",
                }
            ],
        }
        result = normalize_plan_payload(plan, topic="test", slug="test-course")
        outline = result["moduleOutlines"][0]
        self.assertEqual(outline["knowledgeTypes"], ["procedural"])
        self.assertEqual(outline["bloomLevel"], "apply")


class TestNormalizeFallbacks(unittest.TestCase):
    """Scenario 2: missing non-critical fields get fallbacks, not exceptions."""

    def test_plan_missing_subtitle_goal_audience(self):
        plan = {
            "title": "Minimal Course",
            "categories": [{"id": "core", "name": "Core", "color": "blue"}],
            "moduleOutlines": [{"title": "M1"}],
        }
        result = normalize_plan_payload(plan, topic="哲学", slug="philosophy")
        self.assertTrue(len(result["subtitle"]) > 0)
        self.assertTrue(len(result["goal"]) > 0)
        self.assertIsInstance(result["audience"], dict)
        self.assertIsInstance(result["learningGoals"], list)

    def test_plan_outline_missing_optional_fields(self):
        plan = {
            "title": "Course",
            "categories": [{"id": "core", "name": "Core", "color": "blue"}],
            "moduleOutlines": [{"title": "Only Title"}],
        }
        result = normalize_plan_payload(plan, topic="test", slug="test")
        outline = result["moduleOutlines"][0]
        self.assertTrue(len(outline["moduleKind"]) > 0)
        self.assertTrue(len(outline["primaryCognitiveAction"]) > 0)
        self.assertTrue(len(outline["targetChunk"]) > 0)
        self.assertEqual(outline["category"], "core")

    def test_module_missing_misconception_concepts_logicchain(self):
        payload = {
            "title": "Minimal",
            "subtitle": "Sub",
            "focusQuestion": "Why?",
            "keyInsight": "Because",
            "opening": "Imagine...",
            "narrative": [{"type": "text", "content": "Body"}],
        }
        result = normalize_module_payload(payload, module_outline=MINIMAL_OUTLINE, next_module_id=None)
        self.assertIsInstance(result["misconception"], str)
        self.assertIsInstance(result["concepts"], list)
        self.assertIsInstance(result["logicChain"], list)
        self.assertIsInstance(result["examples"], list)


class TestNarrativeBlockPassthrough(unittest.TestCase):
    """Scenario 4: unknown narrative block types preserve original data."""

    def test_v3_reflection_block_preserved(self):
        block = {"type": "reflection", "content": "Think about it", "ifStuck": "Re-read section 1", "ifReady": "Try the advanced version"}
        result = validate_narrative_block(block, 0)
        self.assertEqual(result["type"], "reflection")
        self.assertEqual(result["content"], "Think about it")
        self.assertEqual(result["ifStuck"], "Re-read section 1")
        self.assertEqual(result["ifReady"], "Try the advanced version")

    def test_completely_unknown_type_preserved(self):
        block = {"type": "totally-custom", "content": "hello", "foo": "bar", "nested": {"a": 1}}
        result = validate_narrative_block(block, 0)
        self.assertEqual(result["type"], "totally-custom")
        self.assertEqual(result["foo"], "bar")
        self.assertEqual(result["nested"], {"a": 1})

    def test_known_type_still_validated(self):
        block = {"type": "text", "content": "Normal text"}
        result = validate_narrative_block(block, 0)
        self.assertEqual(result["type"], "text")
        self.assertEqual(result["content"], "Normal text")

    def test_alias_still_works(self):
        block = {"type": "quote", "content": "A wise saying"}
        result = validate_narrative_block(block, 0)
        self.assertEqual(result["type"], "callout")


class TestConceptMapLLMEdges(unittest.TestCase):
    """Scenario 6: concept map uses LLM-provided relatedTo link words."""

    def test_llm_link_words_used(self):
        module = {
            "title": "Freedom and Anxiety",
            "concepts": [
                {"name": "Free Choice", "note": "core", "relatedTo": {"concept": "Anxiety", "link": "inevitably causes"}},
                {"name": "Anxiety", "note": "consequence"},
            ],
            "logicChain": ["Freedom implies choice", "Choice creates anxiety"],
        }
        result = build_concept_map(module)
        edge_labels = [e["label"] for e in result["edges"]]
        self.assertIn("inevitably causes", edge_labels)

    def test_fallback_without_related_to(self):
        module = {
            "title": "Basic Concepts",
            "concepts": [
                {"name": "A", "note": "first"},
                {"name": "B", "note": "second"},
            ],
            "logicChain": ["A leads to B"],
        }
        result = build_concept_map(module)
        self.assertTrue(len(result["edges"]) > 0, "Should still generate edges without relatedTo")
        self.assertTrue(len(result["nodes"]) >= 3, "Should have core + concept nodes")

    def test_empty_concepts(self):
        module = {"title": "Empty", "concepts": [], "logicChain": []}
        result = build_concept_map(module)
        self.assertTrue(len(result["nodes"]) > 0, "Fallback map should have nodes")


if __name__ == "__main__":
    unittest.main()
