---
description: 无敌编程总入口：项目全景状态与四域调度（开发/UI/部署/文档）
argument-hint: [dev | ui | deploy | docs] 或直接描述需求
---

本命令是 wudi-coding（无敌编程）插件的总入口，覆盖程序员全生命周期。按以下规则处理 `$ARGUMENTS`：

1. **为空时**：输出项目全景，然后给下一步建议：
   - 读项目根 `.wudi/project.json`（没有 → 建议先做一次项目建档：询问技术栈/构建命令/部署目标，按 wudi-deploy 技能中的档案结构生成）；
   - 读 `.wudi/deploys.json`（有则列出最近 3 次部署的结果与时间）；
   - 检查 `docs/` 与 `.wudi/docs.json`（有文档清单则报告覆盖情况）；
   - 汇总为「档案 / 部署 / 文档」三段，末尾给出一句下一步建议（如：档案缺部署目标 → 建议补全后用 /wudi-deploy）。
2. **`dev ...`**：按 wudi-dev 技能处理后续需求；参数是需求描述直接进入「澄清 → 方案」流程，是 `review`/`test`/`refactor` 则执行对应专项（评审交给 wudi-reviewer 子代理）。
3. **`ui ...`**：按 wudi-ui 技能处理；`tokens` 查看/更新 design tokens，`to-code` 设计转组件，`figma` 走 Figma 分支（工具未配置时说明）。
4. **`deploy ...`**：按 wudi-deploy 技能处理；`status` 汇报最近部署与健康状态，`deploy` 走五阶段流水线（上线前必须确认），`rollback` 回滚并做健康检查，`health` 只做健康检查。
5. **`docs ...`**：按 wudi-docs 技能处理；`readme`/`api`/`prd`/`runbook`/`changelog` 生成对应文档，`export` 转交付格式。
6. **其他自由文本**：判断最贴近的域，按该域技能处理并在开头说明「已路由到 XX 域」。

规范：只汇报真实读到的状态，文件不存在就说不存在；不要为了显得完整而编造部署历史或文档清单。
