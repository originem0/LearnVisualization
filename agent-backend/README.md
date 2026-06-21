# Agent Backend

`Learning Site Engine` 的课程生成后端。Python 标准库零依赖 dev server。

当前版本是 contract-first essay 生成链：

- `clarify`：多轮澄清，提出候选生成契约 `contract`，由用户确认是否结束澄清
- `plan`：生成 essay spine、register、4-6 章章节弧线
- `compose`：串行生成章节，后章接收前章结尾，质量评审不过则重写
- `validate`：essay-course schema 校验 + 本地质量检查
- `export`：导出待审课程包

`POST /jobs/course-generation` 必须提交用户确认过的 `contract`。旧的顶层 `drivingQuestion` / `centralTension` 等字段不能绕过门禁。澄清必须由 LLM 参与生成下一问和候选 contract；固定问题不能替代 contract。

澄清完成的标准不是“问够几轮”，但服务端至少要求 3 轮围绕差异现象的追问，并且最终 contract 必须形成问题框定：

- `phenomenon`：用户观察到的具体现象
- `contrast`：A/B 差异、条件变化或直觉与现实的冲突
- `problemNature`：`gap`、`model_mismatch`、`system_paradox` 三选一
- `systemGoal`：真正要理解或改善的系统状态，不是指标
- `modelGap`：用户当前缺少的对象、关系、条件或边界模型

## 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/workflow` | 当前真实工作流定义 |
| POST | `/api/clarify/start` | 开始澄清对话 |
| POST | `/api/clarify/respond` | 继续澄清；服务端 gate 通过后返回候选 `contract`，等待用户确认 |
| POST | `/jobs/course-generation` | 用 `{topic, contract}` 创建课程生成 job |
| GET | `/jobs/{id}` | 查看 job 状态 |
| GET | `/jobs/{id}/artifacts` | 查看阶段产物 |
| POST | `/jobs/{id}/retry` | 从失败阶段重试 |
| POST | `/jobs/{id}/review` | 人工批准 / 拒绝导出包 |
| POST | `/validate-build/dry-run` | 运行仓库校验 / 构建 |
| POST | `/promote-course-package/dry-run` | 晋升预检 |
| POST | `/promote-course-package/write` | 晋升到 `courses/` |

## 完整闭环

1. 输入 topic，先走 clarification dialogue
2. AI 给出候选 `contract` 后，用户确认、继续澄清或要求调整
3. 用户确认后，用 `{topic, contract}` 创建课程生成 job
4. `plan -> compose -> validate -> export` 串行执行
5. 导出到 `agent-backend/generated/{slug}/`，默认写 `approved: false`
6. 人工 review 通过后，才会 `promote` 到 `courses/`
7. 审核批准路径会同步运行 `npm run build`；构建成功后 job 才会完成，构建失败会回滚 promote 并保留待审输出

导出的 essay-course 结构固定为：

```txt
{slug}/
  course.json
  chapters/
    c01.json
    c02.json
  review/
    approval.json
```

新生成课程不再写 `modules/`、`visuals/`、`interactions/`。这些目录只属于 legacy 课程。

## 运行

```bash
cd agent-backend
python3 -m app.main    # 127.0.0.1:8081
```

默认监听 `127.0.0.1`。危险 POST 接口需要独立管理员 token：

```bash
export AGENT_ADMIN_TOKEN='change-me'
python3 -m app.main
```

请求时通过 `X-Agent-Admin-Token` 发送。仅本地临时开发可设置 `AGENT_ALLOW_UNAUTHENTICATED=1` 放开。
`AGENT_SETTINGS_PASSWORD` 只用于 provider 设置面板，不能作为管理员 token。运行时写入的 `runtime-config.json` 会保存为 `0600` 权限。

默认 job 日志只保存模型、usage、评审结果和摘要，不落完整 prompt / response。排障时可临时设置 `AGENT_DEBUG_LOG_PROMPTS=1` 打开完整日志，结束后应关闭并清理本地 job 目录。

## 设计原则

1. Contract-first：不澄清，不生成
2. Workflow-first, human-gated
3. 优先输出结构化对象
4. 每一阶段都允许失败重试
5. 严格区分“已导出待审”“已批准”与“已发布且构建成功”

## 还没有

- 外部检索 / research RAG
- 多 provider profile
- 队列 / 数据库 / review UI
- 自动生成前端交互组件代码（当前只允许少量 trace/bespoke 高光）
