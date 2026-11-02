---
description: UI 设计域：设计稿生成 → 截图自检迭代 → design tokens → 转组件代码（Figma 可选）
argument-hint: <需求 | tokens | to-code | figma>
---

按 wudi-ui 技能的闭环处理 `$ARGUMENTS`：

1. 为空：提示用法，并检查 `.wudi/design/` 现状（有 tokens 就报告规范已存在，有设计稿列最新版本）。
2. 需求描述：走「定调 → 单文件 HTML 设计稿 → 截图自检（逐项清单，不合格改稿重截）→ 迭代到用户满意」。
3. `tokens`：无参数则展示当前 `.wudi/design/tokens.json`；带修改意图（如 "主色改成蓝"）则更新 tokens 与 tokens.css，并列出受影响的既有设计稿。
4. `to-code`：按 wudi-ui 技能第 5 步转组件代码——先对齐项目现有组件风格，样式值全部来自 tokens，完成后实现截图与设计稿并排对比。
5. `figma`：检查 `wudi_figma_fetch` 工具可用性；可用则询问 Figma 文件链接与节点，拉取后提取结构/tokens；不可用（未配置 token）时如实说明并建议走本地生成路线。
