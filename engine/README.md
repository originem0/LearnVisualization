# Engine

这个目录是 `LearnVisualization` 未来抽象为 **Learning Site Engine** 后的目标位置。

当前阶段：
- `course-package-engine.mjs` 负责 legacy module-course 包
- `essay-course-engine.mjs` 负责新 narrative essay 包
- 前端运行时代码仍主要在 `src/` 下，读取层通过 `src/lib/course-package-adapter.ts` 选择引擎

原则：
- 不先搬一堆代码进来制造混乱
- 先明确 engine 与 course package 的职责边界
- 新生成课程只走 essay-course 引擎
- legacy 引擎只服务精选旧课和历史包校验
