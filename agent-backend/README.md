# Agent Backend

`Learning Site Engine` 的课程生成后端。Python 标准库零依赖 dev server。

当前版本已经切到 job-first 主链：

- `plan`：生成课程计划
- `compose`：生成模块内容与可渲染概念图
- `validate`：共享 schema 校验 + 内容质量检查
- `export`：导出待审课程包

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/workflow` | 当前真实工作流定义 |
| POST | `/jobs/course-generation` | 创建课程生成 job |
| GET | `/jobs/{id}` | 查看 job 状态 |
| GET | `/jobs/{id}/artifacts` | 查看阶段产物 |
| POST | `/jobs/{id}/retry` | 从失败阶段重试 |
| POST | `/jobs/{id}/review` | 人工批准 / 拒绝导出包 |
| POST | `/validate-build/dry-run` | 运行仓库校验 / 构建 |
| POST | `/promote-course-package/dry-run` | 晋升预检 |
| POST | `/promote-course-package/write` | 晋升到 `courses/` |

## 完整闭环

1. 输入 topic，创建课程生成 job
2. `plan -> compose -> validate -> export` 串行执行
3. 导出到 `agent-backend/generated/{slug}/`，默认写 `approved: false`
4. 人工 review 通过后，才能 `promote`
5. `npm run check` + `npm run build` 验证主站识别

## 运行

```bash
cd agent-backend
python3 -m app.main    # 127.0.0.1:8081
```

## 设计原则

1. Workflow-first, human-gated
2. 优先输出结构化对象
3. 每一阶段都允许失败重试
4. 严格区分“已导出待审”与“已批准可 promote”

## 还没有

- 外部检索 / research RAG
- 多 provider profile
- 队列 / 数据库 / review UI
- 自动生成前端交互组件代码
