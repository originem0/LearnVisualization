# Engine Architecture v1

这份文档是对 `Learning Site Engine` 当前推荐系统边界的简明说明。

## 核心分层

```txt
[ Agent Backend ]
  主题输入 / research / 生成 / critique / review workflow
          ↓
[ Course Package ]
  course.json / modules / visuals / interactions
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

### Agent Backend
- 负责 research / planning / generation / critique
- 必须独立于 frontend runtime

## 当前建议技术栈
- Frontend：TypeScript / Next.js
- Engine：TypeScript
- Agent Backend：TypeScript 或 Python（取决于你优先要统一栈还是优先要 AI 生态）

## 当前重点

不是换语言，而是巩固边界：

- 前端不要继续背生产逻辑
- engine 要继续成为中间编译层
- agent 必须被设计成独立后端
