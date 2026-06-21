# Content Authoring

## Source of truth

所有课程内容以 **course package** 格式存放：

Essay-course（新生成课程）：

```txt
courses/<slug>/
  course.json
  chapters/
    c01.json
    ...
  review/approval.json
```

Legacy module-course（精选旧课）：

```txt
courses/<slug>/
  course.json
  modules/
    s01.json
    ...
  visuals/
  interactions/
```

Legacy `src/content/zh/` 已移除。

## Narrative blocks

Essay block source of truth:

- `src/lib/types.ts` 的 `EssayNarrativeBlock`
- `engine/essay-course-engine.mjs`

Validated in `npm run check`.

## Create a new module scaffold

模块脚手架只适用于 legacy module-course。新课程应通过 agent-backend 的 AI clarification → contract → essay generation 链路创建。

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

`npm run check` 验证所有 `courses/` 下的课程包：

1. content completeness（字段齐全）
2. essay 或 legacy 结构完整性
3. legacy concept-map + interaction registry integrity
4. authoring rules（narrative block 类型规范）
