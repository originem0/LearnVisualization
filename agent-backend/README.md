# Agent Backend

`Learning Site Engine` 的课程生成后端。Python 标准库零依赖 dev server。

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/workflow` | 工作流定义 |
| POST | `/topic-framing/dry-run` | 主题范围分析 |
| POST | `/topic-classification/dry-run` | 主题类型分类（支持 explicit override） |
| POST | `/curriculum-planning/dry-run` | 按主题类型生成课程骨架 |
| POST | `/draft-course-package/dry-run` | 完整课程包预览 |
| POST | `/module-composition/dry-run` | 单模块内容生成 |
| POST | `/export-course-package/dry-run` | 导出预览 |
| POST | `/export-course-package/write` | 导出到 `generated/` |
| POST | `/validate-build/dry-run` | 运行校验 / 构建 |
| POST | `/promote-course-package/dry-run` | 晋升预检（含 scaffold 警告） |
| POST | `/promote-course-package/write` | 晋升到 `courses/`（含 post-promote 验证） |

## 完整闭环

1. 输入 topic → 自动分类主题类型（internals / theory / workflow / system-overview / case-study）
2. 按类型生成不同 archetype 序列的课程骨架
3. 导出到 `agent-backend/generated/{slug}/`
4. promote dry-run 预检（结构校验 + scaffold 警告）
5. promote write 晋升到 `courses/{slug}/`
6. `npm run check` + `npm run build` 验证主站识别

## 运行

```bash
cd agent-backend
python3 -m app.main    # 127.0.0.1:8081
```

## 设计原则

1. Workflow-first, agent-assisted, human-gated
2. 优先输出结构化对象
3. 每一阶段都允许失败重试
4. 生成内容标记 `_scaffold: true`，诚实标注质量上限

## 还没有

- 真实模型调用（当前全是模板 / dry-run）
- provider secrets 管理
- 队列 / 数据库 / review UI
- 与前端 runtime 的自动接线
