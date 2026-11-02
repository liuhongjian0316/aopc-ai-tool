---
description: 部署域：五阶段流水线部署、状态查询、回滚、健康检查
argument-hint: [status | deploy | rollback | health]
---

按 wudi-deploy 技能处理 `$ARGUMENTS`：

1. 为空或 `status`：读 `.wudi/project.json` 与 `.wudi/deploys.json`（或调 `wudi_status` 工具），汇总「档案 / 最近部署 / 健康状态」；缺档案时引导建档。
2. `deploy`：按五阶段流水线执行（build → package → upload → remote → verify），每阶段结果如实汇报；**远端生效前必须向用户确认目标服务器与版本**。优先使用 `wudi_deploy` MCP 工具（自动留历史），不可用再走 bash 并提醒手动记录。
3. `rollback`：先列出可用历史版本让用户选（或回滚到上一次），执行后**必须做健康检查**并汇报当前线上版本对应的时间戳；有数据库迁移的版本要停下说明风险。
4. `health`：只做健康检查（重试 3 次、间隔 5s），失败时按 wudi-deploy 技能的排查清单逐项查并给出结论。
