# wudi-coding 无敌编程

覆盖程序员全生命周期的 AOPC 插件：**开发 → UI 设计 → 部署 → 文档**，一个插件装下四个域。

## 能力总览

| 域 | 入口 | 技能 | 说明 |
| --- | --- | --- | --- |
| 总调度 | `/wudi` | — | 项目全景（档案/最近部署/下一步建议），按参数转发到四个域 |
| 开发 | `/wudi-dev` | `wudi-dev` | 需求澄清 → 方案对比 → 任务拆解 → 实现 → 自检 → 评审 |
| UI 设计 | `/wudi-ui` | `wudi-ui` | 单文件 HTML 设计稿 → 截图自检迭代 → design tokens 沉淀 → 转组件代码；Figma 可选 |
| 部署 | `/wudi-deploy` | `wudi-deploy` | build → package → upload → remote → verify 五阶段流水线，软链回滚，健康检查 |
| 文档 | `/wudi-docs` | `wudi-docs` | README / API / PRD / 部署手册 / CHANGELOG，从真实代码提取，不编造 |

子代理：`wudi-architect`（方案与拆解）、`wudi-ui-designer`（设计稿迭代）、`wudi-reviewer`(代码评审)、`wudi-deployer`(部署执行)。

## 工作台面板

会话侧边栏提供「无敌编程工作台」面板（ui.surfaces，MCP App 规范，自包含单文件 panel.html）：

- **总览**：项目档案卡片、SSH 目标连通测试、最近部署状态；
- **部署**：部署历史时间线（每阶段状态与耗时）、健康检查、回滚上一版（面板内先出预检计划，确认后经宿主审批执行）；
- **文档**：`.wudi/docs.json` 登记的文档库。

面板基于官方 `@modelcontextprotocol/ext-apps` SDK（vendor 内联，零构建：`node scripts/build-panel.mjs` 组装），主题跟随宿主亮暗色，视图状态经 widgetState 会话内保持。

## Figma 接入（可选）

在插件设置里填入 Figma Personal Access Token（只读）后，`wudi_figma_fetch` 可拉取设计稿的结构提炼（尺寸/颜色/字号/文本/flex），供建立 design tokens 与设计转代码。未配置时所有其他功能不受影响。

## 部署通知与体检（v0.6）

- **通知**：档案 `notifyWebhook` + `notifyFormat`（`feishu` / `wecom` / `generic`），部署与回滚的终态（成功/带警告/失败）自动推送到群机器人；环境级可覆盖，推送失败不影响部署结果。
- **体检**：`wudi_doctor` 一键检查档案完整性、SSH 连通、远端磁盘/内存、版本数量、current 软链、健康快测、通知配置，每项独立判 PASS/WARN/FAIL。
- **Gen UI**：`wudi_status` / `wudi_deploy_history` / `wudi_design_tokens_get` / `wudi_design_list` 的结果绑定工作台面板（`_meta.ui`），会话里调用即内联渲染，面板实时消费工具数据。

## 面板一键部署与团队模式（v0.7）

- **面板部署审批流**：部署页新增「部署新版本…」按钮 —— 预检计划 → 对话框确认 → 执行（走宿主审批），与回滚同款两步流。
- **团队并行模式**：大型任务（>8 步且无共享文件依赖）用 `/wudi-team` —— architect 拆解 → 接口契约冻结 → 并行实现子代理（≤4，文件白名单制）→ 逐片验证 → 集成评审。
- **一键自测**：`node scripts/smoke.mjs` —— 44 项回归（协议层 + 全工具面 + notify/figma/store 纯函数），每次改动的安全网。

## 周报、设计稿渲染与确认词（v0.8）

- **周报**：`wudi_docs_weekly`（或说"生成周报"）从 git log 生成草稿到 `docs/weekly/`（概览统计 + 逐日 commit + 人工补充骨架），自动登记文档库。
- **设计稿渲染**：`wudi_figma_images`（需 figmaToken）把 Figma 节点渲染为 PNG 下载到 `.wudi/design/figma/`，供与实现截图视觉比对。
- **部署确认词**：档案/环境配 `confirmWord`（如给 prod 配 "go-prod"）后，`wudi_deploy` 必须带匹配的 `confirmWord` 才执行 —— Agent 直调与面板部署对话框（带输入框）双重拦截。

## 面板建档与运维体验（v0.9）

- **快速建档表单**：未建档项目在面板总览页直接填表建档（名称/技术栈/构建/打包/部署根目录/健康检查），建档即开通部署流水线。
- **健康快照**：每次部署/回滚的健康检查结果随记录存档，面板时间线显示 HTTP 状态徽章（成功绿 / 失败红 / 未验证灰）。
- **文档页**：「生成周报」一键按钮；点任意文档唤起主对话 Agent 打开并简介（需宿主 message 能力）。
- **通知测试**：`wudi_notify_test` 发一条测试通知验证 webhook 配置（未配置返回设置指引）。

## 项目档案

插件以项目根的 `.wudi/` 目录为状态中心：

```
.wudi/
├── project.json   # 项目档案：技术栈、构建命令、端口、部署目标、部署脚本、健康检查 URL
├── deploys.json   # 部署历史（每次部署的阶段记录与结果）
└── design/        # 设计产物：tokens.json、设计稿 HTML、组件映射
```

建议将 `.wudi/` 加入 `.gitignore`（部署历史属于本机状态；`design/tokens.json` 如需入库可按团队习惯调整）。

## 部署模型

目标是自有服务器 + Docker：

- 远端采用 **releases/<时间戳> + current 软链** 模式：每次部署上传到新目录，原子切换软链，失败不污染线上；
- 每次部署前自动保留回滚点，`/wudi-deploy rollback` 一条命令切回上一版；
- 凭据只走插件 userConfig → 环境变量注入，不进日志、不进包。

## 安装

在 AOPC 中添加本 marketplace 源后安装 `wudi-coding`：

```
aopc plugin marketplace add <本仓库地址>
aopc plugin install wudi-coding
```

## 部署策略与设计规范同步（v0.10）

- **部署审批策略**：档案/环境 `deployPolicy` —— `confirm`（两步流，默认）或 `direct`（面板一键直发，宿主审批兜底；建议只给 staging 配）。配了 `confirmWord` 的环境永远走确认对话框，策略无法绕过。
- **tokens 比对**：`wudi_figma_tokens_diff`（需 figmaToken）拉取画板样式与本地 `tokens.json` 自动比对，报告缺失色值/字号与未用 tokens，只出报告不改规范。

## 项目管理工作台（v0.11）

- **项目 landing**：面板首页即项目网格——每个项目一张卡片（技术栈/环境 chip、健康状态点、最近部署、文档与设计产物统计、当前工作区标记），支持登记任意多个项目、下钻只读总览、移除登记。
- **视觉升级**：品牌头部、渐变横幅、卡片悬停、组件化设计系统（8pt 节奏 / WCAG AA / 亮暗双主题），面板本身按 wudi-ui 标准设计。
- **设计展示板**：设计页呈现 tokens 色板（色块卡片）+ spacing/radius/typography 分组 + 设计稿版本时间线。
- **demo 模式**：浏览器打开 panel.html#demo 可用模拟数据渲染完整 UI（视觉迭代与演示用，不影响宿主行为）。

## 设计图库（v0.12）

- **设计稿预览**：设计页的「UI 设计稿」卡片点击即在 iframe 中预览完整设计稿（HTML 经 MCP 动态资源管线读取，文件名白名单防路径穿越）。
- **设计图墙**：`wudi_figma_images` 下载的 PNG 以图片墙展示，点击灯箱放大。
- **完整级别面板**：总览页统计卡片行（部署数/成功率/文档/设计产物）、导航图标化、品牌横幅、项目卡片网格、健康徽章时间线 —— 面板本身按 wudi-ui 设计标准打造。

## 版本

见 `.claude-plugin/marketplace.json` 中本插件条目的 changelog。

## License

MIT
