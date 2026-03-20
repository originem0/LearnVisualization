"""Patch existing course JSON data in-place:
1. Rebuild concept maps with Novak-style short link words
2. Validate componentHint against frontend whitelist, null out invalid ones
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running from repo root or agent-backend/
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from app.quality import build_concept_map, load_frontend_component_whitelist, build_interaction_registry
    from app.common import COURSES_ROOT
except ImportError:
    from quality import build_concept_map, load_frontend_component_whitelist, build_interaction_registry
    from common import COURSES_ROOT


def patch_course(course_dir: Path, whitelist: set[str], dry_run: bool = False) -> dict:
    stats = {"slug": course_dir.name, "modules_patched": 0, "concept_maps_rebuilt": 0, "hints_nulled": 0}
    modules_dir = course_dir / "modules"
    if not modules_dir.is_dir():
        return stats

    # Courses with hand-written components — preserve their componentHints
    KEEP_HINTS_COURSES = {"llm-fundamentals", "postgresql-internals"}
    should_clear_all_hints = course_dir.name not in KEEP_HINTS_COURSES

    # Load and patch each module
    for module_path in sorted(modules_dir.glob("*.json")):
        data = json.loads(module_path.read_text(encoding="utf-8"))
        changed = False

        # 1. Validate/clear componentHint in interactionRequirements
        for req in data.get("interactionRequirements") or []:
            hint = req.get("componentHint")
            if hint and (should_clear_all_hints or hint not in whitelist):
                req["componentHint"] = None
                stats["hints_nulled"] += 1
                changed = True

        if changed:
            stats["modules_patched"] += 1
        if not dry_run and changed:
            module_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 2. Rebuild concept maps (visuals/concept-maps.json)
    concept_maps_path = course_dir / "visuals" / "concept-maps.json"
    if concept_maps_path.exists():
        new_maps = {}
        for module_path in sorted(modules_dir.glob("*.json")):
            data = json.loads(module_path.read_text(encoding="utf-8"))
            module_id = data.get("id", module_path.stem)
            new_maps[module_id] = build_concept_map(data)
            stats["concept_maps_rebuilt"] += 1
        if not dry_run:
            concept_maps_path.write_text(json.dumps(new_maps, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 3. Rebuild interaction registry (interactions/registry.json)
    registry_path = course_dir / "interactions" / "registry.json"
    if registry_path.exists():
        new_registry = {}
        for module_path in sorted(modules_dir.glob("*.json")):
            data = json.loads(module_path.read_text(encoding="utf-8"))
            module_id = data.get("id", module_path.stem)
            reg = build_interaction_registry(data)
            if reg:
                new_registry[module_id] = reg
        if not dry_run:
            registry_path.write_text(json.dumps(new_registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return stats


def main():
    dry_run = "--dry-run" in sys.argv
    whitelist = load_frontend_component_whitelist()
    print(f"Frontend component whitelist: {len(whitelist)} components")
    print(f"Courses root: {COURSES_ROOT}")
    if dry_run:
        print("DRY RUN — no files will be modified\n")

    for course_dir in sorted(COURSES_ROOT.iterdir()):
        if not course_dir.is_dir() or not (course_dir / "course.json").exists():
            continue
        stats = patch_course(course_dir, whitelist, dry_run=dry_run)
        print(f"  {stats['slug']}: {stats['concept_maps_rebuilt']} maps rebuilt, {stats['hints_nulled']} hints nulled")

    print("\nDone." if not dry_run else "\nDry run complete. Re-run without --dry-run to apply.")


if __name__ == "__main__":
    main()
