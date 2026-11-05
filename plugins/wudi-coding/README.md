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

## 设计生成闭环（v0.13）

- **内置设计模板库**：`skills/wudi-ui/templates/` 三套完整级模板（dashboard / landing / mobile），`/wudi-ui` 从模板起步生成，不再从白板开始。
- **面板生成闭环**：设计页选模板类型 + 填页面名 → 唤起 Agent 生成 → 自动进图库。
- **tokens 导出**：`wudi_design_tokens_export`（css / tailwind / json），面板一键导出 tokens.css。

## 无敌画布（v0.14）

- **Agent 可操作的设计画布**：面板「画布」页（选择/矩形/圆/菱形/箭头/文本、tokens 填色、拖拽缩放、双击改字）与 Agent（`wudi_canvas_get/edit/clear/export`）共享同一份 `.wudi/design/canvas.json`。
- **线框→设计稿闭环**：`wudi_canvas_export` 把画布线框内联为 SVG 设计稿 HTML，自动进图库与设计稿预览。
- 使用节奏：布局探索用画布（Agent 铺线框 + 你拖拽微调），定稿导出后按模板精修。

## Excalidraw 桥接（v0.15）

- 无敌画布（快速线框）与**官方 Excalidraw 插件**（完整级白板，已装即用）打通：`wudi_canvas_export {format: "excalidraw"}` 生成 .excalidraw 场景，面板「在 Excalidraw 打开 ↗」一键唤起 Agent 导入；Excalidraw 的 create_diagram/apply_operations 也可供 Agent 继续操作。
- 节奏：线框在无敌画布 → 完整级编辑在 Excalidraw → 设计稿在图库 → 精修按模板。

## Figma 式画布（v0.16）

- **无限画布 + 多画板**：滚轮平移、⌘/Ctrl+滚轮缩放、适应视图；每个 UI 设计一个画板（预设 桌面1440 / 移动375 / 平板768），拖画板标签整帧联动，图层面板管理。
- **Agent 帧操作**：`wudi_canvas_edit` 支持 add_frame / update_frame / delete_frame，形状挂 frameId；旧画布自动迁移。
- **按画板导出**：设计稿 HTML 每画板一份进图库；excalidraw 场景带 frame 元素，在官方 Excalidraw 无限画布继续编辑。

## Figma 与画布策略（v0.17）

- **Figma 完整编辑器在浏览器**：设计页保存文件链接后一键打开（画布/图层/属性面板全功能）；面板可链接管理。边界：Figma API 只读 —— Agent 读设计 ✅、写 Figma ❌（官方 MCP 同为只读）。
- **需要 Agent 读写的设计走 Excalidraw**（Agent 可完整读写），面板画布页一键新建/转入。
- 无敌快速线框画布保留为实验入口（面板与 Agent 共享数据）。

## DesignCraft 完整编辑器（v0.18）

- 官方 **designcraft** 插件（面板内完整设计编辑器）+ **Agent 25 工具读写**（new_document/place_image/pointer/drag/type_text/render_page/export_png）。设计页一键新建文档、渲染 PNG 回图库（.wudi/design/renders/ 自动进设计图墙）。
- 画布矩阵：**DesignCraft**（完整编辑器 + Agent 读写，主推）/ **Excalidraw**（白板 + Agent 读写）/ **Figma**（浏览器完整编辑器，Agent 只读）/ 无敌线框（实验）。
- OpenPencil（.fig 设计稿 + Agent 读写）为官方示例插件，市场发布后即可接入。

## OpenPencil · Figma 设计稿编辑器（v0.19，vendor 官方插件）

- 从官方插件仓库（zai-org/zcode-plugins，MIT/Apache-2.0）构建并 vendor 进本插件：**直接编辑工作区里的 .fig 设计稿（Figma 同款格式）**，侧栏完整编辑器 + **Agent 117 个工具协同**（JSX 渲染、auto-layout、组件/实例、设计变量、Iconify 图标、布尔运算、design_to_tokens、analyze 色板/排版、export SVG/PDF/PNG、XPath 查询）。
- 面板设计页一键「新建 Figma 设计稿」（designs/<名>.fig），侧栏「OpenPencil 设计稿」面板打开即可编辑，Agent 与你实时协同。
- 归属：OpenPencil © 上游作者（MIT）；运行时闭包含 css-tree/canvaskit-wasm 等（见 vendor/openpencil/dist/THIRD_PARTY_NOTICES.txt）。

## tokens 双向闭环与线框转换（v0.21）

- **tokens 比对**：`wudi_tokens_compare`（Gen UI 绑定）——外部 tokens（OpenPencil `design_to_tokens`、Figma 变量导出）与本地 tokens 按扁平键路径比对，新增/变更/移除三清单；确认后 `wudi_design_tokens_set` 整体写入。
- **线框 → .fig**：设计页「把无敌线框转入 .fig」——唤起 Agent 双工具集转换（`wudi_canvas_get` 读线框 → OpenPencil `new_design` + `create_shape` 按坐标重建 → `export_image` 渲染进图墙）。
- **版本守卫**：smoke 断言 plugin.json / panel.js / server.mjs 三处版本一致。

## 打开即工作台（v0.29，已被 v0.31 调整）

- ~~面板默认直接进入当前项目的 总览~~ → v0.31 起打开先见项目选择页，选中项目后才进入内容（见下）。

## 工作台操作中枢（v0.22）

- **下一步建议**：总览页按项目缺口自动给出可执行动作（补配置 / 首次部署 / 失败排查 / tokens 沉淀 / 文档生成），点按钮直达对应页。
- **设计页资产统计条**：设计稿 HTML / 渲染 PNG / tokens 色值 / 基准状态四格。
- **刷新联动**：总览刷新同时拉取设计资产与画布数据。

## 画布手感与导出（v0.23）

- **键盘操作**：Delete 删除选中、方向键微调（Shift=10px，箭头联动尾点）、⌘/Ctrl+D 复制偏移。
- **导出 PNG**：按形状包围盒自动取景，2x 渲染下载（宿主 downloadFile，兜底灯箱预览）。
- **图墙分组**：渲染 PNG 按设计名归组（组头计数）。

## 画布多选与对齐（v0.24）

- **框选多选**：选择工具空拖出虚线框圈选；**Shift+点击**加选/去选；多选整体拖动、批量删除/填色。
- **六向对齐**：≥2 选中时工具条出现 左/水平中/右/上/垂直中/下 对齐按钮。
- **中键拖动**平移画布（与滚轮平移并存）。

## 撤销重做与分布（v0.25）

- **撤销/重做**：⌘Z / ⌘⇧Z + 工具条 ↶↷，快照历史栈 50 步（服务端 replace 全量替换算子承载数据回放）。
- **等距分布**：≥3 选中时 均分横/均分纵（首尾锚定等分中间空隙）。
- **复制粘贴**：⌘C / ⌘V（偏移 24px）。

## 组件形状库（v0.26）

- 画布工具条新增组件下拉：**按钮 / 输入框 / 卡片 / 标题 / 正文 / 分割线** 六种组件戳 —— 选中后点击画布成组放置（卡片=容器+标题+正文，按钮=主色矩形+白字），形状自动挂当前画板、进撤销栈。

## 组件库与层级（v0.27）

- **12 种组件戳**：按钮/输入框/卡片/标题/正文/分割线 + 开关/复选框/头像/图片占位/图表占位/进度条。
- **层级调整**：单选形状出现 置顶/置底 按钮（Agent 侧 reorder 算子同步可用）。

## 数据安全与编辑补全（v0.28）

- **画布自动备份**：每次写入前自动备份上一版到 canvas.backup.json —— 误操作可让 Agent 读备份后用 replace 算子恢复。
- **画布快捷键补全**：⌘/Ctrl+A 全选当前画板形状、Esc 取消选择。
- **tokens 面板编辑**：色板卡「编辑 JSON」弹窗直接改 tokens 并同步 tokens.css。

## Agent↔面板实时协同（v0.30）

- **实时协同桥**：wudi server 内置 SSE 端点（127.0.0.1 随机端口），画布变更实时广播；面板 EventSource 订阅 —— Agent 的 `wudi_canvas_edit`/`clear` 操作**实时出现在用户眼前的画布上**（拖拽中自动避让），OpenPencil 同款活协同。

## OpenPencil 按钮直连修复（v0.30.1）\n\n- 「新建 Figma 设计稿」「打开」「渲染到图墙」从 sendMessage（宿主 message 能力，连接不稳）改为 callTool 直连（经 wudi server 代理到 OpenPencil 子进程）\n\n## 项目选择优先（v0.31）

- **打开即选项目**：面板打开先见「项目选择/创建页」——项目卡片网格（技术栈/环境 chip、健康状态点、文档与设计产物统计、当前工作区标记）+「＋ 登记项目」虚线卡；选中项目（点卡片）后才进入项目内容（总览/部署/设计/画布/文档），导航页签也只在选中后出现。
- **创建入口前置**：没有项目时登记表单直接展开；有项目时收进网格尾部的「＋ 登记项目」卡，点开即填路径登记。当前工作区项目在打开面板时自动登记并置顶标记，一键进入。
- 下钻只读总览不变；内容导航里的「项目」页签随时回到选择页。

## AOPC 设计语言与 OpenPencil 内嵌编辑器（v0.32）

- **返回按钮**：项目内容页顶部新增「← 项目列表」，随时回到项目选择页（与只读下钻的返回一致）。
- **UI 对齐 AOPC**：整套设计系统按宿主 DESIGN.md 重做——Zai Light/Zai Dark 同款 tokens（背景 #f8f8f8/#161616、品牌黑/白、hairline 边框、可交互蓝 #0066dd、语义成功/警告/错误色），移除装饰性渐变与整面品牌色填充，横幅改 accent surface，按钮/焦点/徽章/chip 全部走宿主语义。
- **OpenPencil 编辑器内嵌工作台**（不再依赖宿主 openpencil 环境）：官方插件程序已 vendor 进本插件——wudi server 内嵌子进程 + 本机协同桥新增 `/openpencil/frame` 端点，设计页「打开编辑器」/ 设计稿行「编辑」把**完整编辑器 iframe 直接开在工作台面板里**；面板按 MCP App 协议扮演宿主（ui/initialize 握手 + tools/call、resources/read 转发），文档操作由编辑器拿 token 直连 WS 桥，**与 Agent 的 117 个 openpencil 工具双向实时协同**。面板资源 CSP 声明 frameDomains（宿主 frame-src 白名单），overlay 挂 body 不参与 render 循环，编辑会话不被面板刷新打断。

## 设计页 = 画布（v0.33）

- **设计页只有一个主角：项目画布**。画布（designs/&lt;名称&gt;.fig）里放这个项目的全部 UI 设计——网站 1440 / 移动端 375 / 平板 768 各建画板，所有界面在同一个无限画布上设计。
- **没有画布 → 创建画布**：设计页直接呈现创建空态（输入名称或留空自动为 `ui`），创建后自动进入内嵌编辑器，无需任何额外配置。
- **只有一个画布 → 直接进入**：从项目导航点「设计」即落进画布编辑器（设计页就是画布）；多个画布时显示画布卡选择器，点卡进入。
- **杂项全部收纳**：HTML 设计稿 / 渲染图墙 / tokens / 全部产物收进「设计资产」折叠区；线框转 .fig / HTML 稿生成 / DesignCraft / Figma 收进「更多工具」折叠区。主页面不再是一堆卡片。
- 编辑器会话走 overlay 层（不参与 render 循环），关闭后回到画布页；Agent 的 openpencil 工具与画布实时双向协同。

## 资源级 CSP 修复：画布白屏（v0.33.1）

- **白屏根因**：面板资源 CSP 此前只写在 `resources/read` 的**结果层 `_meta`**，而 AOPC 宿主按规范从**内容项 `contents[*]._meta.ui.csp`** 读取（`resources/list` 项兜底）——读不到 → `frame-src 'none'` → 内嵌编辑器 iframe 被整帧拦截（SSE 协同桥的 `connect-src` 同样一直未生效）。
- 修复：CSP 同时写入内容项级 + 结果级 + `resources/list` 项级三处；宿主任一路径都能拿到 `connectDomains`/`frameDomains`。
- **加载看门狗**：编辑器 overlay 顶栏新增状态位——「正在加载编辑器…」→「已连接」；12 秒不握手会明确提示 CSP/桥不可达原因并建议重载/重启会话，不再无声白屏。

## 内嵌编辑器 srcdoc 加载与握手修复（v0.33.2）

- **iframe 白屏根因二连**：①编辑器 iframe 依赖宿主放行 `frame-src`（声明路径一旦未生效即整帧被拦）；②面板扮演宿主时 `ui/initialize` 应答缺 **`protocolVersion`**（SDK 结果 schema 四字段必填），验证失败 → 编辑器启动即抛错。
- 修复：编辑器 loader 改走 MCP 资源管线（`ui://openpencil/panel.html`）取回、以 **srcdoc** 注入 iframe（按宿主契约不受 frame-src 限制）；`ui/initialize` 应答补齐 `protocolVersion` + hostInfo/hostCapabilities/hostContext。
- 面板资源同时声明 openpencil WS 桥 origin 到 `connectDomains`（srcdoc 继承父文档 CSP，编辑器需直连随机端口的 WS 桥）与 `aopc/csp: {wasmUnsafeEval, unsafeEval}`（CanvasKit / kiwi schema）。
- 已用浏览器探针实测：srcdoc 载入 loader → 握手通过 → 资源读取（assets.json / panel.css）全链路 OK。

## 画布渲染自检与适应视图（v0.33.3）

- **渲染自检**：编辑器握手后 5s，面板自动检查 iframe 内 canvas 是否创建、是否拿到 WebGL/2D 上下文，并把 iframe 内注入采集的运行时错误显示在 overlay 顶栏——「画布未初始化渲染上下文（CanvasKit/wasm 可能被拦截）」/「已连接 · 看不到内容时按 Shift+1 适应视图」，无需开 Console 即可判断空画布原因。
- **适应视图**：overlay 顶栏新增按钮，向编辑器窗口派发 Shift+1（缩放到全部内容），用于视口漂移/内容在视野外的一键自救。

## 版本

见 `.claude-plugin/marketplace.json` 中本插件条目的 changelog。

## License

MIT
