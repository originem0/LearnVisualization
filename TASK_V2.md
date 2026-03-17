# Task V2: Visualize.sharonzhou.site — Full Reference Parity

## Goal
Upgrade the existing Next.js project to match https://learn.shareai.run/zh/timeline/ **as closely as possible**, and deploy as a standalone site at https://visualize.sharonzhou.site.

## Must-Have Requirements
1. **Multi-language**: Chinese + English.
   - URL structure: `/zh/` and `/en/`
   - Timeline page: `/zh/timeline/` and `/en/timeline/`
   - Module detail pages: `/zh/s01/` ... `/zh/s12/` and `/en/s01/` ... `/en/s12/`
   - Top language switcher toggles locale and keeps current page when possible.
2. **Structure parity** with reference:
   - Home pages `/zh/` and `/en/` should match the reference landing for Learn Claude Code (same layout structure).
   - `timeline` page is the main timeline view (like reference).
   - `compare` and `layers` pages exist and are styled (do not leave placeholders).
3. **Design parity**:
   - Use the same layout patterns: sticky header, sidebar navigation, colored category groups, cards, progress bars, icon buttons.
   - Scroll-triggered fade-in animation (opacity 0 + translateX(30px) → visible).
   - Typography, spacing, hover states visually close to reference.
4. **Data-driven**: content in `src/data/state.zh.json` and `src/data/state.en.json`.
5. **Static export**: `output: 'export'`, `trailingSlash: true`, **no basePath** (site root).

## Page Map
- `/[locale]/` → landing page (like reference homepage, not timeline)
- `/[locale]/timeline/`
- `/[locale]/compare/`
- `/[locale]/layers/`
- `/[locale]/s01/` ... `/[locale]/s12/`

## Content Notes
- Use existing module data but map to `s01`..`s12` for modules.
- Provide rich detail pages: concept list, logic chain, key examples, counterexamples, feynman tests, weaknesses, references.
- Compare page: show module summaries in a visually rich comparison grid.
- Layers page: show the category layers with explanations and the colored legend.

## Technical Guidance
- Use App Router with `[locale]` segment.
- Implement `generateStaticParams` for locales and each `s01..s12`.
- Provide a `LocaleLayout` with header + sidebar consistent with reference.
- Implement `usePathname` in language switcher to maintain current path.
- Use `next/link` for navigation; ensure trailing slashes.
- Use CSS variables and Tailwind as in V1.

## Deployment Note
Do NOT handle nginx or certs. Focus only on code + build output. We'll deploy manually.

## Build
Run `npm run build` and ensure `out/` is generated with locale paths.
