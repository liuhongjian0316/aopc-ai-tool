---
description: 文档域：README / API / PRD / 部署手册 / CHANGELOG 生成与导出
argument-hint: [readme | api | prd | runbook | changelog | export <格式>]
---

按 wudi-docs 技能处理 `$ARGUMENTS`：

1. 为空：盘点项目文档现状（根 README、`docs/`、`.wudi/docs.json`），输出「已有 / 缺失 / 建议补」三段。
2. `readme` / `api` / `prd` / `runbook` / `changelog`：生成或更新对应文档——先看已有文档更新优先，信息一律从真实代码与项目状态提取，写完登记到 `.wudi/docs.json`（或调 `wudi_status` 的登记能力）。
   - `prd` 缺需求上下文时先收集（背景/用户故事/范围/验收标准），不凭空编。
   - `changelog` 从 git log 与近期改动提取，按 Keep a Changelog 分组。
3. `export <格式>`：将指定 md（缺省最近生成的）用宿主 `docx` / `pptx` / `xlsx` / `pdf` 技能转换，如实报告产物路径；宿主技能不可用时说明。
