# Content Authoring

## Current source of truth

当前运行中的课程主内容源已经切到 **course package** 路径：

```txt
courses/llm-fundamentals/
  course.json
  modules/
    s01.json
    ...
  visuals/
  interactions/
```

`src/content/zh/` 目前仍然保留，但已经处于 **legacy compatibility** 状态，
不应再作为新增内容的主写入位置。

## Narrative blocks

Block spec source of truth:

- `src/data/narrative-block-spec.json`

Validated in `npm run check`.

## Create a new module scaffold

```bash
node scripts/new-module.mjs --id 13 --category frontier --title "你的标题" --subtitle "你的副标题"
```

默认会创建到：

- `courses/llm-fundamentals/modules/s13.json`

可选参数：

- `--course llm-fundamentals`
- `--moduleKind mechanism-walkthrough`
- `--cognitiveAction trace`

## After scaffolding

你仍然需要：

1. 填真实内容
2. 补 concept-map schema（`courses/<course>/visuals/`）
3. 补 interaction hints（`courses/<course>/interactions/registry.json`）
4. 重新运行 `npm run check`

## Validation layers

`npm run check` 现在会同时验证：

1. legacy content completeness
2. concept-map schema integrity
3. split-content structure integrity
4. authoring rules for narrative blocks
5. mirrored course package integrity
