# Content Authoring

This project now uses split content sources for Chinese modules:

```txt
src/content/zh/
  project.json
  categories.json
  modules/
    s01.json
    ...
    s12.json
```

## Narrative blocks

Block spec source of truth:

- `src/data/narrative-block-spec.json`

Validated in `npm run check`.

## Create a new module scaffold

```bash
node scripts/new-module.mjs --id 13 --category frontier --title "你的标题" --subtitle "你的副标题"
```

This creates:

- `src/content/zh/modules/s13.json`

Then you still need to:

1. Fill real content
2. Add concept-map schema entry in `src/data/concept-map-schemas.json`
3. Add interactive mappings in `src/lib/module-registry.ts`
4. Re-run `npm run check`

## Validation layers

`npm run check` now validates:

1. content completeness
2. concept-map schema integrity
3. split-content structure integrity
4. authoring rules for narrative blocks
