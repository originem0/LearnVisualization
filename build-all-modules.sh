#!/bin/bash
# Sequential module builder — runs Claude Code for each batch
set -e
cd /home/ubuntu/pero-viz-next

LOG="/home/ubuntu/pero-viz-next/build-progress.log"
echo "=== Module build started $(date) ===" > "$LOG"

# ─── Batch 1: s02, s03, s04 ───
echo "[$(date)] Starting Batch 1: s02, s03, s04" >> "$LOG"

claude --permission-mode bypassPermissions --print --max-turns 80 "
Read DESIGN.md and MODULE_SPECS.md first. Then build modules s02, s03, s04.

For EACH module you must:
1. Create interactive components in src/components/interactive/ (\"use client\", zero npm deps)
2. Add narrative content + opening + bridgeTo to src/data/state.zh.json
3. Create a concept map SVG component in src/components/ (like ConceptMapS01.tsx)
4. Integrate everything in ModuleDetail.tsx (dynamic import with ssr:false, render for correct module id)
5. Run npm run build to verify

IMPORTANT RULES:
- Each module MUST have at least 2 interactive components
- Interactive components use \"use client\" and are dynamically imported with ssr:false
- All interactive components go in src/components/interactive/
- Concept maps go in src/components/ConceptMapS{id}.tsx
- Zero new npm dependencies
- Dark mode must work (use CSS variables)
- Mobile responsive
- Do NOT break existing s01 or other pages
- Each module needs full narrative content (opening, narrative blocks, bridgeTo) in state.zh.json
- Follow the NarrativeBlock types defined in types.ts
- For module detection in ModuleDetail.tsx, use module.id === N

Refer to MODULE_SPECS.md for the content and interactive design of each module.
Refer to DESIGN.md for the overall design principles.
Look at the existing s01 implementation (ConceptMapS01.tsx, TokenizerPlayground.tsx, BPESimulator.tsx) as reference for code style and patterns.

BUILD s02, s03, s04 NOW. Run npm run build at the end.
" >> "$LOG" 2>&1

echo "[$(date)] Batch 1 complete" >> "$LOG"

# ─── Batch 2: s05, s06, s07, s08 ───
echo "[$(date)] Starting Batch 2: s05, s06, s07, s08" >> "$LOG"

claude --permission-mode bypassPermissions --print --max-turns 80 "
Read DESIGN.md and MODULE_SPECS.md. Then build modules s05, s06, s07, s08.

Same rules as before — read the existing code for patterns. Each module needs:
1. Interactive components in src/components/interactive/
2. Concept map SVG in src/components/
3. Full narrative content in state.zh.json
4. Integration in ModuleDetail.tsx

Refer to MODULE_SPECS.md for each module's specific content and interactive design.
Do NOT break existing modules (s01-s04).
Run npm run build at the end.
" >> "$LOG" 2>&1

echo "[$(date)] Batch 2 complete" >> "$LOG"

# ─── Batch 3: s09, s10, s11, s12 ───
echo "[$(date)] Starting Batch 3: s09, s10, s11, s12" >> "$LOG"

claude --permission-mode bypassPermissions --print --max-turns 80 "
Read DESIGN.md and MODULE_SPECS.md. Then build modules s09, s10, s11, s12.

Same rules — read existing code for patterns. Each module needs:
1. Interactive components in src/components/interactive/
2. Concept map SVG in src/components/
3. Full narrative content in state.zh.json
4. Integration in ModuleDetail.tsx

s12 is special — it's a review module. Its interactive component is a full-pipeline tracer that links all 11 previous modules together.

Refer to MODULE_SPECS.md for each module's specific content and interactive design.
Do NOT break existing modules (s01-s08).
Run npm run build at the end.
" >> "$LOG" 2>&1

echo "[$(date)] Batch 3 complete" >> "$LOG"
echo "=== ALL BATCHES DONE $(date) ===" >> "$LOG"
