# llm-fundamentals

这是当前 LearnVisualization 样板课程的**第一版镜像课程包**。

当前状态：
- `course.json`：课程元信息、路径、模块图
- `modules/`：12 章模块内容（已按未来 schema 形状转换一版）
- `visuals/concept-maps.json`：概念图 schema 镜像
- `interactions/registry.json`：交互需求与组件提示镜像

说明：
- 当前运行中的网站仍然使用 `src/content/zh` + `src/data/*` + `src/lib/module-registry.ts`
- 这里的内容是为 future engine / course-package 分层做的第一版镜像
- 下一步如果继续推进，应做“读取层”过渡，而不是立刻替换当前 runtime
