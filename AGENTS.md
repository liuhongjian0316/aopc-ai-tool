# aopc-ai-tool: Agent Guide

本仓库是 AOPC/ZCode 插件市场。将本文件作为创建插件、修改可安装插件内容与维护仓库文档的操作指南。字段定义与协议细节按需查阅 [docs/marketplace-maintenance.md](docs/marketplace-maintenance.md)。

## 事实来源

从仓库文件推导当前契约，不要凭记忆或其他项目的示例：

- 目标插件的 `.aopc-plugin/plugin.json` 清单（及同步的 `.zcode-plugin/plugin.json`）
- 目标插件的 README 文档
- 实际组件目录：`commands/`、`skills/`、`agents/`、`mcp-server/`、`lib/`
- 根 `marketplace.json`（与 `.claude-plugin/marketplace.json` 同步）中的对应条目
- 仓库校验器：`aopc plugins validate plugins/<name>` 与 `plugins/<name>/scripts/smoke.mjs`

## 工作流

1. 检查事实来源，将任务分类为：新插件 / 可安装内容变更 / 仅根文档变更。
2. 先改行为与清单，再同步插件 README、marketplace 条目与插件版本。
3. 在仓库根运行仓库检查，以命令输出（而非静态检查）作为验证边界。

## 版本契约

任何进入安装包的文件变更（清单/组件/MCP 声明/插件 README）都必须同时在 `.aopc-plugin/plugin.json` 与根 `marketplace.json` 提升语义化版本。三处版本号（plugin.json / panel.js / server.mjs）由 `scripts/smoke.mjs` 的版本守卫断言一致。已发布版本不可复用。

仅根文档变更不需要提升插件版本。

## 插件结构

```text
my-plugin/
├── .aopc-plugin/plugin.json    # AOPC 必需清单
├── .zcode-plugin/plugin.json   # ZCode 兼容清单（与 .aopc-plugin 同版本，双目录惯例）
├── commands/*.md               # 斜杠命令
├── skills/<name>/SKILL.md      # 技能
├── agents/*.md                 # 子代理
├── mcp-server/*.mjs            # MCP stdio server（可选）
├── lib/*.mjs                   # 工具逻辑（可选）
└── README.md
```

新插件从现有插件结构起步，移除未用组件，保留至少一个可发现组件。目录名唯一且 kebab-case。

## 校验

```shell
aopc plugins validate plugins/<name>   # 清单校验
cd plugins/<name> && node scripts/smoke.mjs   # 冒烟（有 scripts/smoke.mjs 的插件）
aopc plugins marketplace update aopc-ai-tool  # 刷新市场源
aopc plugins install <name>@aopc-ai-tool --scope user  # 本机安装验证
```

## UI 插件（MCP App）

面板类插件（如 wudi-coding）的页面以 `ui://` 资源分发，遵循 MCP Apps 规范：

- 自包含单文件 HTML（CSS/JS 内联，`</script` 转义），由 `scripts/build-panel.mjs` 生成
- MCP server 必须实现 `resources/list` + `resources/read`（`text/html;profile=mcp-app`）
- `tools/list` 全量声明；主题跟随 `hostContext`；connect 前不发通知
- 踩坑结论见各插件 changelog（如 obsidian-kb、wudi-coding）
