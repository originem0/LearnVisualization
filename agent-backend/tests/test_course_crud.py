"""Tests for course list API and course deletion."""

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


class TestListCourses(unittest.TestCase):
    """Scenario 5: course list API finds courses with course.json or plan.json."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.courses_root = Path(self.temp_dir.name)
        self.original_courses_root = MAIN.COURSES_ROOT
        MAIN.COURSES_ROOT = self.courses_root

    def tearDown(self):
        MAIN.COURSES_ROOT = self.original_courses_root
        self.temp_dir.cleanup()

    def test_finds_course_json(self):
        write_json(self.courses_root / "course-a" / "course.json", {"title": "Course A", "topic": "Topic A"})
        (self.courses_root / "course-a" / "modules").mkdir(parents=True)
        result = MAIN.list_courses()
        self.assertEqual(len(result["courses"]), 1)
        self.assertEqual(result["courses"][0]["slug"], "course-a")
        self.assertEqual(result["courses"][0]["title"], "Course A")

    def test_finds_plan_json(self):
        write_json(self.courses_root / "course-b" / "plan.json", {"title": "Course B", "topic": "Topic B"})
        result = MAIN.list_courses()
        self.assertEqual(len(result["courses"]), 1)
        self.assertEqual(result["courses"][0]["title"], "Course B")

    def test_prefers_course_json_over_plan_json(self):
        write_json(self.courses_root / "course-c" / "course.json", {"title": "From Course"})
        write_json(self.courses_root / "course-c" / "plan.json", {"title": "From Plan"})
        result = MAIN.list_courses()
        self.assertEqual(result["courses"][0]["title"], "From Course")

    def test_ignores_empty_directories(self):
        (self.courses_root / "empty-dir").mkdir()
        write_json(self.courses_root / "real-course" / "course.json", {"title": "Real"})
        result = MAIN.list_courses()
        self.assertEqual(len(result["courses"]), 1)
        self.assertEqual(result["courses"][0]["slug"], "real-course")

    def test_counts_modules(self):
        write_json(self.courses_root / "course-d" / "course.json", {"title": "D"})
        modules_dir = self.courses_root / "course-d" / "modules"
        modules_dir.mkdir(parents=True)
        write_json(modules_dir / "s01.json", {"id": "s01"})
        write_json(modules_dir / "s02.json", {"id": "s02"})
        result = MAIN.list_courses()
        self.assertEqual(result["courses"][0]["moduleCount"], 2)


class TestDeleteCourse(unittest.TestCase):
    """Scenario 8: deleting a course removes it from disk and list."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.courses_root = Path(self.temp_dir.name)
        self.original_courses_root = MAIN.COURSES_ROOT
        self.original_repo_root = MAIN.REPO_ROOT
        MAIN.COURSES_ROOT = self.courses_root
        MAIN.REPO_ROOT = Path(self.temp_dir.name)  # prevent real rebuild

    def tearDown(self):
        MAIN.COURSES_ROOT = self.original_courses_root
        MAIN.REPO_ROOT = self.original_repo_root
        self.temp_dir.cleanup()

    def test_delete_removes_directory(self):
        write_json(self.courses_root / "to-delete" / "course.json", {"title": "Delete Me"})
        result = MAIN.delete_course("to-delete")
        self.assertTrue(result["deleted"])
        self.assertFalse((self.courses_root / "to-delete").exists())

    def test_delete_then_list_excludes_it(self):
        write_json(self.courses_root / "keep" / "course.json", {"title": "Keep"})
        write_json(self.courses_root / "remove" / "course.json", {"title": "Remove"})
        MAIN.delete_course("remove")
        result = MAIN.list_courses()
        slugs = [c["slug"] for c in result["courses"]]
        self.assertIn("keep", slugs)
        self.assertNotIn("remove", slugs)

    def test_delete_nonexistent_raises(self):
        with self.assertRaises(FileNotFoundError):
            MAIN.delete_course("nonexistent")


if __name__ == "__main__":
    unittest.main()
