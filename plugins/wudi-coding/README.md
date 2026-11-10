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

面板基于官方 `@modelcontextprotocol/ext-apps` SDK（vendor 内联，零构建：`node scripts/build.mjs` 组装），主题跟随宿主亮暗色，视图状态经 widgetState 会话内保持。

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

## 空画布根因：真实 origin 加载（v0.33.4）

- **空画布根因**：编辑器 bundle 内部资产拦截器用 `location.origin` 做同源判断（`/canvaskit.wasm`、字体等），srcdoc 的**不透明源（origin=null）**使这些 fetch 全部 `Failed to fetch` → CanvasKit 起不来 → 中间的画布空白（DOM 编辑器正常、WS 已连接）。
- **修复**：改回经协同桥 **`/openpencil/frame` 以真实 http origin** 加载（0.33.1 的白屏其实是 `protocolVersion` 握手缺陷，已修；frame-src 放行由资源 `_meta` 声明且实测生效）。
- 真实 origin 探针实测：`canvaskit.wasm`/字体全部经资源管线读取、canvas 拿到 WebGL 上下文（819×860）、零错误；srcdoc 模式同指标为 300×150 + 无上下文 + Failed to fetch。

## srcdoc + 资产 fetch 补丁：画布最终通（v0.33.5）

- **确证**：宿主里 http src 的 iframe 会被拦（无握手、白屏）；srcdoc 能握手但 uration 为不透明源，编辑器 bundle 的同源资产拦截器失效（`/canvaskit.wasm`/字体 `Failed to fetch`，CanvasKit 起不来）。
- **最终形态**：srcdoc 加载（不受 frame-src 限制）+ **prelude 补丁**——在 loader 之前接管 `fetch`，把 `canvaskit.wasm`、`*.ttf` 经 postMessage 转回 MCP 资源管线；错误采集 `__wudiErrs` 一并注入。
- 探针实测（srcdoc + prelude）：握手 ✔、`canvaskit.wasm`/字体读取 ✔、canvas WebGL 上下文 ✔（819×860）、零错误。

## vendor 官方源码与构建环境（v0.33.6）

- `vendor/openpencil/` 现为**官方 monorepo 1:1 布局**：`ui-plugins/openpencil`（源码：`src/` MCP server、`ui/` Vue 编辑器、`scripts/` 构建脚本、package.json/tsconfig/vitest）+ `external_plugins/openpencil`（LICENSE/licenses/官方清单/design 技能）+ 预构建 `dist/`（运行时）。
- **构建环境已实测可用**：`cd vendor/openpencil/ui-plugins/openpencil && npm install && npm run build` 完整产出 `dist/server.mjs`（9.5MB）与编辑器资产（7.09MB JS + 154KB CSS + 字体/worker），与入库 dist 字节一致。
- 详见 `vendor/openpencil/VENDOR.md`（上游 commit `0cc58d6`、版本 0.3.2、MIT）。

## 项目结构（对齐官方 openpencil 工程形态）

```
plugins/wudi-coding/
├── package.json            # 标准 npm 项目：build / start / typecheck / test 脚本
├── tsconfig.json           # TS 工程（src/ 类型检查）
├── scripts/
│   ├── build.mjs           # esbuild：src/server.ts → dist/server.mjs；面板内联 → dist/ui/panel.html
│   └── smoke.mjs           # 103 项回归（协议 + 工具面 + 内嵌编辑器 + 版本一致性）
├── src/                    # MCP server 源码（TypeScript）
│   ├── server.ts           # 入口：initialize / tools / resources（唯一全量类型检查文件）
│   ├── tools.ts            # 工具定义与分发（含协同桥 HTTP / openpencil 代理）
│   ├── store.ts            # .wudi/ 状态中心（档案/部署/文档/画布/注册表）
│   ├── ssh.ts              # 系统 ssh/scp（仅密钥认证）
│   ├── figma.ts            # Figma API（只读）
│   ├── notify.ts           # 部署通知（飞书/企微/generic）
│   └── openpencil.ts       # openpencil 子进程代理（117 工具/资源）
├── ui/                     # 工作台面板源码
│   ├── panel.js            # 面板逻辑（vanilla JS，MCP App SDK）
│   ├── panel.css           # 设计系统（AOPC Zai Light/Dark）
│   └── vendor/             # ext-apps 官方 SDK 自包含产物
├── dist/                   # 构建产物（入库，marketplace 安装即用）
│   ├── server.mjs          # esbuild 打包的单文件 server（158KB）
│   ├── lib/                # 纯函数模块（notify/figma/store，供 smoke 单测）
│   └── ui/panel.html       # 单文件面板（SDK + panel.js + panel.css 内联，530KB）
├── commands/ skills/ agents/
├── vendor/openpencil/      # 官方 openPencil：源码 + 构建环境 + 预构建 dist
├── .aopc-plugin/plugin.json   # mcpServers.wudi → ${AOPC_PLUGIN_ROOT}/dist/server.mjs
└── .zcode-plugin/plugin.json
```

| 命令 | 作用 |
| --- | --- |
| `npm install` | 安装构建依赖（esbuild / typescript，仅开发期） |
| `npm run build` | `src/` → `dist/server.mjs`；`ui/` → `dist/ui/panel.html`（含产物自检） |
| `npm run typecheck` | tsc 检查 `src/`（迁移中的工具实现暂标 `@ts-nocheck`，入口全量检查） |
| `npm test` / `npm run smoke` | 103 项回归（起真实 `dist/server.mjs`） |
| `npm start` | 本地起 MCP server（stdio，调试用） |
| `npm run vendor:install` / `npm run vendor:build` | 重建 vendor 内 openPencil（官方源码构建） |

版本号由 smoke 守卫强制 **五处一致**：`.aopc-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`package.json`、`ui/panel.js`、`src/server.ts`。

## 打开画布自动适应视图（v0.34.1）

- 编辑器就绪后（`__openpencilPanel.canvasReady`）**自动调用 `editor.zoomToFit()`**，解决「已连接但画布空白」（文档加载后视口偏离内容）。
- 顶栏「适应视图」按钮（同源 srcdoc 直接调用编辑器 zoomToFit）；渲染器未就绪时状态栏直接报「CanvasKit/wasm 可能被限制」。
- 自检逻辑读编辑器全局接口而非 canvas 探测，状态判断更精确：已连接 · 已自动适应视图 / 画布渲染器未就绪 / 渲染异常：<错误>。

## prelude 语法缺陷修复（v0.34.2）

- **根因**：srcdoc prelude（资产 fetch 补丁）模板字符串里的 `\/` 被运行时吞成 `/`，正则 `/^https?:\/\/…/` 退化为非法的 `//` → **整段 prelude 语法错误、从未执行** → `canvaskit.wasm`/字体补丁未安装 → CanvasKit 起不来 → 「画布渲染器未就绪」。
- 修复：模板串内改用 `\\/`（运行时输出 `\/`）；**构建期新增 OP_PRELUDE 语法门禁**（提取模板、运行时求值、node --check，杜绝回归）。
- prelude 增加 `console.error` 采集（`__wudiLogs`），自检状态栏可直接显示编辑器内部报错。
- 已用宿主同款 CSP（含/不含 wasm 放宽）探针复测：`wasm: ok`、8 个资产（含 canvaskit.wasm/字体）全部经资源管线取回。

## 字体 fallback：文字渲染修复（v0.34.3）

- **文字不正常根因**：编辑器只内置 Inter / NotoNaskhArabic；文档用到其他字体（尤其中文）时，unifont 会在运行时从 **fontsource（cdn.jsdelivr.net）** 按需下载字形包——宿主 CSP 的 `connect-src` 只放行回环地址，下载被拦 → 缺字形。
- 修复：面板资源 CSP 增加 `https://cdn.jsdelivr.net` 到 `connectDomains` / `resourceDomains`，字体兜底包可正常下载；内置 Inter 路径不受影响。
- 自检优先级调整：渲染器正常时忽略无害 console 日志（不再误报「渲染异常」），仅未就绪时展示首条内部错误。

## 中文文字渲染：内置 Noto Sans SC（v0.34.4）

- **根因**：文本渲染按 `nodeFontReadiness` 阻塞——缺字形时节点永远 pending、不绘制。官方插件沙箱内**禁用了在线字体下载**（`setOnlineFontProviders({})` + `setWebFontFetch(null)`），本地系统字体也拿不到 → **中文（CJK）文字永远不显示**（拉丁 Inter 正常）。
- **修复**：向 vendor 的 openpencil 源码内置 **Noto Sans SC（OFL，8.3MB OTF）**并注册为 CJK fallback：
  - `ui/fonts/NotoSansSC-Regular.otf` + `ui/assets.ts` 资产表 + `ui/fonts.ts: configureBundledCjkFont()`（fetch → `fontManager.registerAndCache` → `setCJKFallbackFamily`）+ `ui/web/main.ts` 调用；
  - `src/adapters/resources.ts` 二进制白名单放行 `.otf`；构建脚本拷贝 `*.otf`；
  - 面板 prelude 的资产正则同步支持 `.otf`。
- 实测（真实子进程 + 真编辑器链路）：中英混排文本 `nodeFontReadiness → ready`、`buildTextPicture` 成功、OTF 经资源管线加载；纯英文与中文均可渲染。离线可用，无 CDN 依赖。

## 中文字体子集化（v0.34.5）

- 宿主对页面发起的 `resources/read` 有 **8 MiB 解码上限**（超出直接报 `resource_too_large`，面板实例可能被关掉 → 「MCP App connection is no longer available」）；完整 Noto Sans SC（7.94MiB）贴着红线。
- 用 fontTools 按 **GB2312 全字符集**（6763 汉字 + 拉丁 + 常用标点，共 7904 字符）子集化为 **1.92MiB**，字形覆盖验证通过（测试用字全部命中）；离线可用、远离大小上限。

## 画布 CRUD 与面板收敛（v0.35.0）

- **项目支持删除**：项目卡的移除按钮改为常显；删除确认改用自定义弹窗（AOPC 沙箱禁用原生 `confirm()`，此前确认永远返回 false 导致删除从未生效——这就是「项目不支持删除」的原因）。
- **画布 CRUD**：新增 `wudi_design_delete` / `wudi_design_rename`（仅允许 designs/ 内 .fig/.pen，防路径穿越）；设计页画布卡带「重命名 ✎ / 删除 ×」，配合创建/进入即完整增删改查。
- **设计页收敛为画布**：「设计资产」「更多工具」（DesignCraft / Figma / HTML 设计稿生成 / 线框转换）整块移除——设计工作全部基于 openPencil 画布；总览的「设计产物」统计改为「设计画布」数。
- **移除「画布」标签页**：无敌线框实验画布（renderCanvas + 相关状态/SSE 订阅）整体下线；Agent 侧 `wudi_canvas_*` 工具保留，工作台的设计入口统一为「设计」页的 openPencil 画布。
- smoke 新增 6 项画布 CRUD 回归（109 项全绿）。

## 文件夹选择与项目重命名（v0.36.0）

- **文件夹弹框选择**：登记项目时点「浏览…」打开面板内文件夹选择器（路径条 / 进入子目录 / 上一级 / 选择此文件夹）——沙箱无法唤起系统原生目录对话框，用服务端 `wudi_fs_list_dirs` 驱动的自绘弹窗实现。
- **范围限定**：只能浏览/登记**当前项目根目录及其子文件夹**。`wudi_fs_list_dirs` 与 `wudi_projects_add` 服务端双重校验（越界直接拒绝），弹窗顶部明确提示可选范围。
- **项目重命名**：项目卡「重命名」→ 输入框改名（仅改工作台显示名，不动项目目录）；修复了 `projects_list` 每次用 `.wudi` 档案名覆盖用户改名的问题。
- smoke 新增 6 项：子文件夹可登记 / 越界拒绝 / 目录浏览（根、子目录、越界）/ 重命名与列表生效（116 项全绿）。

## 自动建档：取消「未建档」概念（v0.36.1）

- **插件即建档**：wudi server 启动即在当前项目根创建 `.wudi/` 与最小 `project.json`（名称取目录名）；登记项目时自动在目标目录创建 `.wudi/project.json`——**不再存在「未建档」状态**，卡片/下钻的未建档徽章已移除。
- **总览页改为按配置完整度判断**：档案存在但缺构建命令/部署根目录时，显示**预填当前值**的「完善部署配置」表单（原来只有档案缺失才出现，且从空白开始）。
- 清理全部「未建档」文案（工具输出、卡片、下钻）；`wudi_projects_list` 不再用档案名覆盖用户重命名。
- 项目卡布局修正：状态行与「重命名/移除」操作行分开，窄卡片不再竖排挤压。
- smoke 新增 2 项（启动即建档案 / 登记自动建档），118 项全绿。

## 所有项目可进入内容（v0.37.0）

- **项目卡全部可进入内容页**：非当前工作区项目不再只是只读下钻——总览（档案/环境/部署历史/文档）、部署历史、设计、文档都按**该项目根**加载。
- **多根寻址**：`wudi_status` / `wudi_deploy_history` / `wudi_designs_list` / `wudi_design_delete` / `wudi_design_rename` / `wudi_project_get` 新增 `root` 参数；openpencil 子进程改为**按项目根多实例**（`__root` 路由），资源读取携带 `wudiRoot`。
- **编辑器 WS 反代**：`get_design_status` 返回的 WS 端点统一改写为 wudi 协同桥的 `/op-ws` 透明代理——任意项目根的编辑器端口都落在宿主 CSP 已放行的桥 origin 下，非当前项目的画布也能在面板内编辑。
- **安全边界**：非当前项目为「看内容 + 管设计稿」；部署/回滚/健康检查/周报/SSH 测试按钮禁用并提示在该项目工作区执行。
- smoke 新增 5 项多根回归（123 项全绿）。

## 当前项目可移除（v0.37.1）

- **修复「移除当前项目删不掉」**：`wudi_projects_list` 每次都会自动登记当前工作区，导致刚移除的卡片立刻回来。现在移除当前项目会记入**隐藏集**（插件数据目录 `hidden_projects.json`），列表不再自动加回；`wudi_projects_add` 重新登记同一路径即恢复。
- 移除当前项目只影响工作台列表与登记记录，**项目文件与 .wudi 不动**。
- smoke 更新/新增 5 项（移除当前→隐藏→不再加回→重新登记恢复，126 项全绿）。

## 创建画布按钮修复（v0.37.2）

- **根因**：v0.35.0 清理死代码时，`btn-tokens-edit`（单行绑定）的删除把紧随其后的 `btn-op-new`「创建画布」处理器整块吞掉——按钮在、绑定没了，点击无响应。
- **修复**：恢复处理器（带 `__root` 项目根路由，非当前项目也能在正确目录建稿）。
- **构建期双向门禁**：面板源码里每个 `id="btn-*"` 必须有对应 `getElementById` 绑定、每个绑定必须引用存在的标记——两类残缺（绑定丢失 / 绑定指向不存在标记）都会让构建直接失败。
- 顺带清理：画布页下线后遗留的 `btn-ex-new` / `btn-ex-export` 死绑定与丢失的画布卡 ×/✎ 样式恢复。

## 画布支持中文名（v0.37.3）

- **根因**：设计稿文件名校验用 `\w`（只匹配 ASCII 字母数字下划线），**中文名被拒**——而 openPencil 建稿允许中文名，导致「能创建、不能改删」。
- 修复：校验放宽为 Unicode 友好（允许中文等字符），仍拒绝路径穿越、分隔符与控制字符；`resolveDesignFile` 与重命名共用同一校验。
- smoke 新增 4 项中文名全链路回归（建稿 → 列表 → 重命名 → 删除，130 项全绿）。

## 设计页不再自动弹编辑器（v0.37.4）

- 移除「单画布时点设计 tab 自动进入编辑器」的行为——点「设计」**只显示画布页**（画布卡列表 + 新建入口），想编辑点画布卡的「进入画布 →」或「进入编辑器」。

## 画布存储归位 .wudi（v0.38.0）

- **设计稿存储位置修正**：画布（.fig）从项目根的 `designs/` 迁移到 **`.wudi/designs/`**——与档案、部署记录、文档一样统一收纳在项目的 `.wudi/` 数据中心下。
- **自动迁移**：server 启动、打开项目列表、登记项目时，旧 `designs/` 里的 .fig/.pen 自动移入 `.wudi/designs/`（旧目录清空后删除）。
- 路径解析兼容三种写法：`.wudi/designs/<名>.fig` / `designs/<名>.fig`（旧）/ `<名>.fig`；删除与重命名同样按根定位。
- 列表接口的 path 字段同步为 `.wudi/designs/<名>`；smoke 全量路径断言更新（130 项全绿）。

## 按项目存储：查看根持久化 + 存储位置可见（v0.38.1）

- **查看根持久化**：正在查看的项目根（projectRoot）写入 widgetState，面板重挂载/重开后恢复——避免静默切回当前工作区导致画布存错项目。
- **存储位置可见**：设计页「项目画布」标题栏显示实际存储目录（`<项目>/.wudi/designs/`），每个项目的画布都在该项目自己的 .wudi 下。
- 提醒：在非当前项目的画布里创建的内容存该项目目录；部署/构建类操作仍需在该项目工作区执行。

## 画布存储按项目分目录（v0.38.2）

- **存储模型修正**：`.wudi/` 下面以项目为基准——每个项目的画布存放在**工作区单一 .wudi 下的 `<项目>/designs/`**（如 `.wudi/zongheng-mini/designs/xx.fig`），而不是各子项目目录里散落各自的 .wudi。
- 迁移兼容三种历史位置：`.wudi/designs/`（v0.38.0 中央）、各项目根 `designs/`（v0.35 旧位置）、当前 `.wudi/<项目>/designs/`；中央位置的迁移仅归属当前工作区项目（避免被子项目抢走）。
- 新增 `wudi_design_create {name, root?}`：服务端按项目计算集中路径并建稿（含落盘等待），面板「创建画布」改用该工具。
- 路径解析兼容 `.wudi/<项目>/designs/`、`designs/`、裸名三种写法（resolveDesignFile 共用）。
- smoke 断言对齐新布局（130 项全绿）。

## 路径剥离修复（v0.38.3）

- **修复**：`resolveDesignFile` 的路径前缀剥离正则里 `[^/]+` 无法跨两级目录，`.wudi/<项目>/designs/<名>` 的完整路径剥不干净 → 删除/重命名误报「非法设计稿名」。改为显式三段前缀处理（`.wudi/<项目>/designs/`、`.wudi/designs/`、`designs/`）。

## 非当前项目画布创建修复（v0.38.4）

- **根因**：非当前项目创建画布时，`new_design` 被 `__root` 路由到该项目自己的 openPencil 子进程——它把路径解析到**子项目目录**，而落盘轮询检查的是工作区 `.wudi/` → 永远等不到 → 「画布创建超时（文件未落盘）」。
- **修复**：画布统一存储在工作区 `.wudi/<项目>/designs/` 后，创建一律走**工作区根的默认子进程**（路径已带项目目录）；`designsDirFor` 同步锚定工作区根（root 仅决定项目目录名）。列表/改名/删除与创建完全一致。
- 实测：登记子项目 → 创建画布 → 文件落在 `工作区/.wudi/<子项目>/designs/all.fig`，列表按根可见。

## Agent 设计工具失败自动打开编辑器（v0.38.5）

- **根因**：Agent 的 openPencil 设计工具（get_node/create_shape/render 等）需要**编辑器面板已连接**——面板没开时每个调用都失败（旧文案还指向已下线的「侧栏面板」，Agent 无从下手）。
- **修复**：
  - 文案指向工作台：设计稿编辑器未打开 → 请在工作台「设计」页点击画布打开编辑器后重试；
  - **面板自动打开编辑器**：检测到 Agent 的设计工具因「编辑器未打开」失败时，自动打开画布编辑器（加载当前画布），Agent 重试即可用；
  - vendored openPencil 同步更新提示文案（重建 dist）。

## 设计工具快速失败 + 编辑器自动打开（v0.38.6）

- **根因**：openPencil upstream 的 `/health` 只在**编辑器面板 WS 已连接**时返回 ok，而工具调用的 `waitForConnection` 默认**等 30 秒**——面板没开时每个设计工具（render/get_node/create_shape/…）都挂 30s 才报错，Agent 连试多次全超时。
- **修复**：
  - 等待上限 30s → **2.5s**（源码 `src/adapters/upstream.ts` 与 vendored dist 同步），设计工具未连接时快速失败并给出「编辑器未打开」指引；
  - 面板**主动打开编辑器**：收到 `get_design_status` 的 `live:false` 或「编辑器未打开」失败结果时，自动打开该画布编辑器——Agent 稍后重试即可写入了。
- 注意：本机 homebrew Node 24 依赖损坏（libsimdjson 缺失），openpencil 的 web 构建暂不可用；本次服务端补丁直接应用于 vendored dist（与源码补丁一致）。

## 「交给 Agent」修复（v0.40.1）

- **现象**：架构方案页点「交给 Agent 搭建」报「无法发送给 Agent」。
- **根因**：`ui/message` 的 `content` 必须是 **content block 数组**（`{role:"user", content:[{type:"text", text}]}`），之前传了单个对象 → 宿主参数校验失败 → 进入兜底分支；同时沙箱禁用 `navigator.clipboard`，导致最终报错。
- **修复**：对齐 openPencil `sendFollowUpMessage` 的实现方式：数组载荷 + 轻量 `structuredContent`（类型/框架/方案路径/文件清单）；面板作为内嵌编辑器 shim 转发 `ui/message` 时默认值同样改为数组；剪贴板兜底增加 `textarea + execCommand("copy")` 回落。

## 新增「架构」tab（v0.39.0）

- 项目内容页签：**项目 / 总览 / 架构 / 部署 / 设计 / 文档**。
- 新工具 `wudi_architecture {root?}`（只读静态扫描，上限 4000 文件，跳过 node_modules/dist/.git 等）：
  - 语言占比（按扩展名统计，含 TypeScript/Swift/Vue/CSS…）；
  - 框架与包管理器识别（package.json 依赖 + go.mod / pom.xml / Podfile / pubspec / Gemfile 等）；
  - 顶层模块（文件数 + 主要语言）、关键配置文件、docker-compose 服务（名称/镜像/端口）、npm scripts、monorepo workspaces；
  - 关联资产（画布数、文档数、环境、部署根、健康检查）。
- 面板架构页：技术栈 chips + 语言分布条 + 模块卡片 + 关键文件/关联资产 + 服务与脚本；右上「刷新」重新扫描。
- smoke +5（145 全绿）：React/Vite 识别、TypeScript 统计、src 模块、关键文件与 compose 服务解析、文本摘要。

## 空项目自动设计架构 + Agent 搭框架（v0.40.0）

- **自动识别**：非空项目直接扫描展示（语言/框架/模块/服务）。
- **空项目架构向导**：架构页自动进入向导，选择项目类型与框架（Web：Vue/React+Vite；小程序：Taro/微信原生；移动端：Flutter/SwiftUI；后端：NestJS/Go+Gin；Monorepo：pnpm workspace），生成方案。
- **`wudi_arch_plan`**：输出技术选型、目录与文件清单、安装/开发/构建命令、注意事项，并保存到 `<项目>/.wudi/architecture.json`（Agent 可直接读取）。
- **`wudi_arch_scaffold`**：按方案写入骨架（目录 + 可运行的初始文件），**绝不覆盖已有文件**、需 `confirm: true`、可重复执行（幂等跳过）。
- **面板两个出口**：
  - 「写入骨架」→ 直接落地初始工程（`npm install && npm run dev` 即可启动）；
  - 「交给 Agent 搭建」→ 把带方案路径的任务消息发给 Agent，Agent 继续实现页面/接口，并用 `wudi_architecture` 复查。
- **回归**：smoke 152 项全绿（+7）：空项目识别、Vue 方案生成与落盘、未确认拒绝、骨架写入、幂等跳过、写入后可识别技术栈。

## 编辑器已打开仍报「未打开」（v0.38.7）

- **现象**：编辑器明明已打开（面板状态「已连接 · 已自动适应视图」），Agent 的设计工具仍报「设计稿编辑器未打开」；编辑器自己的 HostBar 一直显示「连接中」。
- **根因**：v0.37.0 起编辑器的 WebSocket 改走协同桥透明代理 `ws://127.0.0.1:<桥端口>/op-ws?target=…`，但面板资源 CSP 的 `connectDomains` 只声明了 `http://127.0.0.1:<桥端口>`。CSP 的 scheme 是**精确匹配**（Chrome 实测：`connect-src http://host:port` 不放行 `ws://host:port`，报 connect-src 违规）→ 编辑器 WS 被拦 → 上游 `/health` 永远 `no_app` → 所有需要编辑器的设计工具都报「未打开」。
- **修复**：`bridgeConnectDomains()` 同时返回 `http://` 与 `ws://` 的桥 origin，内容项 `_meta.ui.csp` 与 `resources/list` 兜底两处一致放行；编辑器 WS 立即连上，Agent 设计工具恢复。
- **回归**：smoke 133 项全绿，新增 3 项——内容项/列表项 CSP 均含 `ws://` 桥 origin；起最小 WS 握手桩实测 `/op-ws` 代理返回 101 且升级后字节直通（证明代理本身没问题，问题只在 CSP）。

## 项目卡「设计」统计修复（v0.38.9）

- **现象**：工作台项目卡与项目详情里的「设计」恒为 0，即使设计页已经有画布。
- **根因**：`registrySummaries` 仍在统计旧「设计资产」目录 `<项目>/.wudi/design/` 下的 html/json；画布早已集中存储在 `<工作区>/.wudi/<项目>/designs/*.fig|.pen`，口径不一致。
- **修复**：改为与设计页列表同一口径（`.fig`/`.pen`），同时覆盖未迁移的历史位置，按文件名去重、不串项目；「设计产物」文案统一改为「画布」。
- **实测**：工作区 `test` → WEB=1（`web.fig`）、DESKTOP/MINI/APP=0，与磁盘一致；smoke 140 项全绿（新增 2 项：按项目统计、不串项目）。

## 项目存储按工作区隔离（v0.38.8）

- **现象**：新开一个左侧栏项目（工作区）后，工作台仍显示其他工作区登记过的项目（纵横小程序、纵横APP）。
- **根因**：项目注册表与「隐藏项目」集合放在插件**全局**数据目录（`~/.aopc/wudi-coding/projects.json`），与工作区无关 → 任何工作区打开都看到同一份列表。
- **修复**：
  - 注册表/隐藏集改为**按工作区分域**：`<工作区>/.wudi/projects.json`、`<工作区>/.wudi/hidden_projects.json`，每个工作区只看到自己登记的项目；
  - 旧全局注册表**惰性迁移**：首次打开某工作区时只迁入位于该工作区范围内的条目（全局旧文件保留），其他工作区各自迁移；
  - 显式 `root` 参数限制在当前工作区内（`toolRoot` 校验），面板残留的跨工作区 `projectRoot` 自动清空，避免串读。
- **回归**：smoke 138 项全绿，新增 5 项——两个工作区互不可见、跨工作区 root 拒绝、注册表落盘位置、旧全局表迁移过滤。

## 版本

见 `.claude-plugin/marketplace.json` 中本插件条目的 changelog。

## License

MIT
