---
name: wudi-ui
description: UI 设计闭环：单文件 HTML 设计稿生成、截图自检迭代、design tokens 沉淀、设计转组件代码，Figma 设计稿接入（可选）。当用户要做 UI 设计、页面原型、设计稿、设计规范、设计转代码，或 /wudi-ui 进入 UI 域时使用。
---

# UI 设计闭环

按「定调 → 设计稿 → 自检迭代 → tokens → 转代码」五步推进。产出全部落盘到项目 `.wudi/design/` 目录，可反复迭代。

## 1. 定调（30 秒，不啰嗦）

问清三件事，用户没说就按合理默认给并在稿子上标注：目标用户与场景、品牌调性（专业/活泼/极简…）、参考对象（"像 Linear 那种"算有效输入）。
项目档案 `.wudi/design/tokens.json` 已存在时直接沿用，不要重立规范。

## 2. 设计稿：单文件 HTML

- **从内置模板起步**：本技能带三套完整级模板（`templates/` 相对本技能目录）——`dashboard.html`（管理后台/工作台）、`landing.html`（产品落地页）、`mobile.html`（移动端 App 375 画布）。按页面类型选模板复制到 `.wudi/design/mockups/<名称>-v1.html`，替换 `:root` tokens 为项目 tokens、内容换业务真实文案，再按需增删区块；模板内的【可改区】注释是改造指引。
- 每稿一个自包含 HTML（内联 CSS/JS，仅字体允许外链）；没有合适模板才从空白起稿。
- 桌面端默认 1440 宽画布（mobile 模板为 375）；同时给一个 375 宽移动摘要块（响应式设计必须展示断点行为）。
- 必画状态：默认、hover、加载、空数据、错误，至少覆盖主要交互组件。
- 标注：关键间距/字号/色值直接写在稿内标注层，方便转代码时对照。
- 真实感数据：用贴近业务的真实文案和长度，不用 lorem ipsum 和 "Test User"。
- 落盘后用 `wudi_design_list` 确认进入图库（面板设计页可见、可预览）。

## 2b. 设计画布：快速线框（wudi_canvas_* 工具）

布局探索阶段优先用**设计画布**（面板「画布」页与 Agent 共享同一份数据）：

- `wudi_canvas_edit` 批量铺形状：`add`（rect/ellipse/diamond/arrow/text，坐标 0-4000）搭线框——先大区块（侧栏/主区/卡片），再小元素；`update` 调位置尺寸颜色；`delete` 清理。
- 布局定稿后 `wudi_canvas_export {name}` 导出：`format=html` 进图库精修，`format=excalidraw` 生成 .excalidraw 场景（再让 Agent 调官方 Excalidraw 插件的 open_diagram 导入，在完整级白板自由编辑，该插件也有 create_diagram/apply_operations 供 Agent 继续操作）——**线框在画布，精修在模板或 Excalidraw**，不要在画布上抠像素细节。
- 用户在面板画布上的拖拽/填色与你的操作实时同步同一份数据；动 Agent 侧大改前先 `wudi_canvas_get` 看现状。

## 2c. OpenPencil 工作流（.fig 设计稿，Agent 深度读写）

Figma 式设计走 OpenPencil（vendor 官方插件，117 工具）：设计稿是工作区 `designs/*.fig` 文件，**Agent 与用户在侧栏编辑器实时协同**。

- **建稿**：`new_design {path: "designs/<名>.fig"}` → `create_shape`（FRAME/RECTANGLE/TEXT…）或 `render`（JSX 批量搭布局）→ `set_layout`（auto-layout）→ `set_fill/set_text/set_radius` 精修。
- **改稿**：先 `open_design` + `get_page_tree`/`find_nodes` 摸清结构，再 `update_node`/`batch_update`；不要全量重建覆盖用户布局。
- **进面板**：`export_image` 渲染 PNG 到 `.wudi/design/renders/`（自动进工作台设计图墙）；`wudi_designs_list` 随时盘点设计稿。
- **tokens 打通**：`design_to_tokens` 从设计稿导出 tokens → `wudi_design_tokens_set` 沉淀；反向用 `list_variables`/`create_variable` 把 wudi tokens 灌回设计稿变量。
- 面板「设计」页有每个 .fig 的「打开 / 渲染到图墙」按钮（经宿主 message 唤起你执行）。

## 3. 截图自检（不可跳过）

用宿主浏览器/截图能力打开设计稿截图，对照清单逐项检查，不合格就改稿重截：

- [ ] 8pt 间距节奏：所有间距是 4 的倍数，主间距 8/16/24/32
- [ ] 层级 ≤ 3 层：字号、字重、颜色深浅构成清晰的信息层级，无同级打架
- [ ] 对比度达 WCAG AA（正文 ≥ 4.5:1，大字 ≥ 3:1）
- [ ] 对齐：栅格一致，无肉眼可见的错位
- [ ] 空态/错误态不是白板，有引导动作
- [ ] 品牌一致性：色彩不超过 1 主 + 1 辅 + 中性灰阶，圆角/阴影全稿统一

自检结果要如实汇报（"改了 3 处间距，对比度从 3.8 提到 5.2"），不许跳过截图就说"已完成"。

## 4. design tokens 沉淀

- 定稿后抽取 `.wudi/design/tokens.json`（color/spacing/radius/shadow/typography 六组），并生成同目录 `tokens.css`（CSS 变量形式）。
- tokens.json 结构：`{ "color": { "primary": "#..." }, "spacing": { "sm": "8px", ... }, ... }`，键名全小写短横线。
- 后续所有设计稿与代码引用 tokens，不再出现魔法值；改规范只改 tokens 文件。

## 5. 转组件代码

- 先看项目档案的技术栈（`.wudi/project.json` 没有 `<techStack>` 字段就问用户）。
- 按项目现有组件风格生成：先读 1~2 个现有组件文件对齐命名/props/样式方案，再写新组件。
- 样式值全部来自 tokens（CSS 变量或导入的常量），硬编码色值/间距 = 没转完。
- 验收：实现页截图与设计稿并排对比，肉眼级一致才算完成；差异列表如实汇报。

## Figma 分支（可选）

插件提供 `wudi_figma_fetch` 工具且用户已配置 token 时：把 Figma 链接（建议带 node-id，指向具体画板）传给工具，得到提炼后的结构树（尺寸/颜色 hex/字号/文本/flex/gap/padding）→ 从中提取颜色与字号作为 tokens 初稿、布局关系作为组件层级 → 再走第 3 步起的标准闭环。工具返回「未启用」指引时如实转告（需用户在插件设置填 token 并重开会话），直接走本地生成路线。

## 风格参考

宿主装有 `apple-design`、`design-taste-frontend` 等审美技能时，做高保真稿前先调用其对齐审美原则；没有则按本技能清单执行。
