# Engine Architecture v1

这份文档是对 `Learning Site Engine` 当前推荐系统边界的简明说明。

## 核心分层

```txt
[ Agent Backend ]
  AI clarification / contract / generation / critique / review workflow
          ↓
[ Course Package ]
  essay: course.json / chapters / review
  legacy: course.json / modules / visuals / interactions
          ↓
[ Engine / Build Layer ]
  validate / transform / compile / export
          ↓
[ Frontend ]
  render / interact / learn
```

## 分层原则

### Frontend
- 只负责展示与交互
- 不负责生成
- 不持有 secrets

### Engine
- 负责编译、校验、转换
- 负责 course package → runtime data 的适配
- 根据包形状选择 essay-course 或 legacy module-course 引擎

### Agent Backend
- 负责 AI 澄清 / contract gate / planning / generation / critique
- 必须独立于 frontend runtime

## 当前主链

新课程只走 essay-course：

```txt
topic
  → AI clarification contract
  → essay spine plan
  → chapters/cNN.json
  → review/approval.json
```

legacy module-course 仍可读取和校验，但不是新的生成目标。

## 当前建议技术栈
- Frontend：TypeScript / Next.js
- Engine：TypeScript
- Agent Backend：TypeScript 或 Python（取决于你优先要统一栈还是优先要 AI 生态）

## 当前重点

不是换语言，而是巩固边界：

- 前端不要继续背生产逻辑
- engine 要继续成为中间编译层
- agent 必须被设计成独立后端
