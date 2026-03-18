# Courses

这个目录现在是 **主内容源** 的目标位置，并已经开始承载默认 runtime 数据。

每个专题课程应逐步收敛成独立包，例如：

```txt
courses/
  llm-fundamentals/
    course.json
    modules/
    visuals/
    interactions/
```

当前状态：
- `llm-fundamentals` 已作为默认 runtime 路径接入
- `src/content/zh` 仍保留为 legacy fallback
- 新内容不应再默认写入旧源
