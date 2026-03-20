import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def load_main_module():
    repo_root = Path(__file__).resolve().parents[2]
    app_dir = repo_root / "agent-backend" / "app"
    if str(app_dir) not in sys.path:
        sys.path.insert(0, str(app_dir))

    spec = importlib.util.spec_from_file_location("agent_backend_main", app_dir / "main.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


MAIN = load_main_module()


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_package(base_dir: Path, slug: str, *, approved: bool, status: str, scaffold: bool) -> Path:
    package_dir = base_dir / slug

    course = {
        "id": slug,
        "slug": slug,
        "title": "Fixture Course",
        "subtitle": "Validation fixture",
        "goal": "Verify promote gating.",
        "projectType": "mixed",
        "startDate": "2026-03-19",
        "topic": slug,
        "language": "zh",
        "status": status,
        "categories": [
            {
                "id": "core",
                "name": "Core",
                "color": "blue",
            }
        ],
        "audience": {
            "primaryAudience": "Test audience",
        },
        "learningGoals": ["One clear learning goal"],
        "moduleGraph": {
            "order": ["s01"],
            "edges": [],
        },
        "modules": ["s01"],
    }
    if scaffold:
        course["_scaffold"] = True

    module = {
        "id": "s01",
        "number": 1,
        "title": "Fixture Module",
        "subtitle": "Module subtitle",
        "category": "core",
        "moduleKind": "concept-clarification",
        "primaryCognitiveAction": "distinguish",
        "focusQuestion": "What blocks promote?",
        "keyInsight": "Promotion must be gated by real validation.",
        "concepts": [
            {
                "name": "promote gate",
                "note": "A hard release boundary.",
            }
        ],
        "logicChain": ["validate", "review", "promote"],
        "examples": ["A reviewed package can be promoted."],
        "narrative": [
            {
                "type": "text",
                "content": "Promotion should not accept unchecked scaffold output.",
            },
            {
                "type": "heading",
                "content": "Why gate promotion?",
            },
            {
                "type": "callout",
                "content": "If scaffold output can enter courses/, your workflow is lying.",
            },
        ],
        "interactionRequirements": [
            {
                "capability": "compare",
                "purpose": "Minimal fixture interaction",
                "priority": "core",
                "componentHint": "FixtureInteractive",
            }
        ],
        "retrievalPrompts": [
            {
                "type": "fill-gap",
                "prompt": "State the promote gate requirement.",
            }
        ],
        "bridgeTo": None,
        "nextModuleId": None,
    }
    if scaffold:
        module["_scaffold"] = True

    concept_maps = {
        "1": {
            "title": "Fixture map",
            "nodes": [
                {"id": "a", "label": ["A"], "x": 0, "y": 0, "w": 80, "h": 40},
                {"id": "b", "label": ["B"], "x": 120, "y": 0, "w": 80, "h": 40},
            ],
            "edges": [
                {"from": "a", "to": "b", "label": "guards"},
            ],
            "svgW": 240,
            "svgH": 120,
            "ariaLabel": "Fixture concept map",
        }
    }
    if scaffold:
        concept_maps["1"]["_scaffold"] = True

    interactions = {
        "s01": {
            "heroInteractive": {
                "capability": "compare",
                "purpose": "Minimal fixture interaction",
                "priority": "core",
                "componentHint": "FixtureInteractive",
            }
        }
    }
    if scaffold:
        interactions["s01"]["_scaffold"] = True

    approval = {
        "approved": approved,
        "reviewedBy": "reviewer" if approved else "",
        "reviewedAt": "2026-03-19T00:00:00Z" if approved else "",
        "notes": "Fixture approval",
    }

    write_json(package_dir / "course.json", course)
    write_json(package_dir / "modules" / "s01.json", module)
    write_json(package_dir / "visuals" / "concept-maps.json", concept_maps)
    write_json(package_dir / "interactions" / "registry.json", interactions)
    write_json(package_dir / "review" / "approval.json", approval)
    return package_dir


class PromoteGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.generated_root = Path(self.temp_dir.name) / "generated"
        self.courses_root = Path(self.temp_dir.name) / "courses"
        self.generated_root.mkdir(parents=True, exist_ok=True)
        self.courses_root.mkdir(parents=True, exist_ok=True)

        self.original_generated_root = MAIN.GENERATED_ROOT
        self.original_courses_root = MAIN.COURSES_ROOT

        MAIN.GENERATED_ROOT = self.generated_root
        MAIN.COURSES_ROOT = self.courses_root

    def tearDown(self) -> None:
        MAIN.GENERATED_ROOT = self.original_generated_root
        MAIN.COURSES_ROOT = self.original_courses_root
        self.temp_dir.cleanup()

    def test_promote_write_rejects_scaffold_without_real_approval(self) -> None:
        create_package(self.generated_root, "blocked-course", approved=False, status="scaffold", scaffold=True)

        with self.assertRaises(ValueError):
            MAIN.promote_generated_course_package(
                {
                    "source_slug": "blocked-course",
                    "target_slug": "blocked-course",
                    "overwrite": False,
                }
            )

    def test_promote_write_accepts_reviewed_draft_package(self) -> None:
        create_package(self.generated_root, "reviewed-course", approved=True, status="draft", scaffold=False)

        result = MAIN.promote_generated_course_package(
            {
                "source_slug": "reviewed-course",
                "target_slug": "reviewed-course",
                "overwrite": False,
            }
        )

        self.assertTrue(result["promoted"])
        self.assertTrue(result["post_promote_ready"])
        self.assertEqual(result["module_count"], 1)
        self.assertEqual(result["module_ids"], ["s01"])
        self.assertTrue((self.courses_root / "reviewed-course" / "course.json").exists())


if __name__ == "__main__":
    unittest.main()
