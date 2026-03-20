"""Write LLM-generated interactive components and register them in the frontend whitelist."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any


def generate_component_name(course_slug: str, module_id: str, capability: str, index: int = 0) -> str:
    """Generate a PascalCase component name from course/module/capability."""
    parts = []
    # Course slug → PascalCase segments
    for segment in re.split(r"[-_]", course_slug):
        if segment:
            parts.append(segment.capitalize())
    # Module id (e.g. s01)
    parts.append(module_id.upper())
    # Capability → PascalCase
    for segment in re.split(r"[-_]", capability):
        if segment:
            parts.append(segment.capitalize())
    name = "".join(parts)
    if index > 0:
        name += str(index)
    return name


def extract_code_from_response(response_text: str) -> str:
    """Extract TypeScript code from LLM response, stripping markdown fences if present."""
    text = response_text.strip()
    # Strip ```tsx or ```typescript fences
    fence_match = re.search(r"```(?:tsx|typescript|ts|jsx|react)?\s*\n(.*?)```", text, re.S)
    if fence_match:
        text = fence_match.group(1).strip()
    # Strip leading/trailing ``` without language tag
    if text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()
    return text


def validate_component_code(code: str, component_name: str) -> list[str]:
    """Basic syntax validation. Returns list of issues (empty = valid)."""
    issues = []
    if "'use client'" not in code and '"use client"' not in code:
        issues.append("missing 'use client' directive")
    if "export default function" not in code:
        issues.append("missing 'export default function'")
    if "import" not in code:
        issues.append("missing imports")
    return issues


def write_interactive_component(component_name: str, code: str, repo_root: Path) -> Path:
    """Write component code to src/components/interactive/{name}.tsx."""
    target = repo_root / "src" / "components" / "interactive" / f"{component_name}.tsx"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(code, encoding="utf-8")
    return target


def register_component_in_whitelist(component_name: str, repo_root: Path) -> None:
    """Add a dynamic import and whitelist entry to src/lib/module-registry.ts."""
    registry_path = repo_root / "src" / "lib" / "module-registry.ts"
    content = registry_path.read_text(encoding="utf-8")

    # Check if already registered
    if component_name in content:
        return

    # Insert dynamic import before the componentWhitelist declaration
    import_line = f"const {component_name} = dynamic(() => import('@/components/interactive/{component_name}'), {{ ssr: false }});\n"
    whitelist_marker = "const componentWhitelist: Record<string, ComponentType> = {"

    # Add import line just before the whitelist declaration
    if whitelist_marker in content:
        content = content.replace(whitelist_marker, import_line + "\n" + whitelist_marker)

    # Add to whitelist object — insert before the closing };
    # Find the closing }; of componentWhitelist
    whitelist_start = content.find(whitelist_marker)
    if whitelist_start >= 0:
        # Find the closing }; after the whitelist start
        brace_depth = 0
        i = content.index("{", whitelist_start)
        for j in range(i, len(content)):
            if content[j] == "{":
                brace_depth += 1
            elif content[j] == "}":
                brace_depth -= 1
                if brace_depth == 0:
                    # Insert before this closing brace
                    content = content[:j] + f"  {component_name},\n" + content[j:]
                    break

    registry_path.write_text(content, encoding="utf-8")
