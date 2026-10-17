# aopc-ai-tool

liuhongjian 的 AOPC 插件/技能源（marketplace）。本仓库按 AOPC 插件源规范组织，可直接作为 GitHub marketplace 源添加到 AOPC，也可以被 Claude Code 兼容读取。

## 目录结构

```text
aopc-ai-tool/
├── .claude-plugin/
│   └── marketplace.json      # marketplace 清单（AOPC 优先读取该路径，根目录 marketplace.json 为回退）
├── plugins/                  # 插件目录，每个插件一个子目录
│   └── fcm-bridge/
│       ├── .aopc-plugin/
│       │   └── plugin.json   # 插件清单（name/version/commands 等）
│       ├── commands/         # 斜杠命令（Markdown）
│       ├── scripts/          # 插件自带脚本
│       └── README.md
├── docs/                     # 源维护说明
└── skills/                   # 技能收录说明与约定
```

## 收录插件

| 插件        | 版本   | 说明                                                         |
| ----------- | ------ | ------------------------------------------------------------ |
| fcm-bridge  | 0.1.0  | AOPC 会话内查看与切换 free-coding-models 免费模型路由（`/fcm`） |

## 安装使用

添加本仓库为 marketplace 源并安装插件：

```bash
aopc plugins marketplace add liuhongjian0316/aopc-ai-tool
aopc plugins install fcm-bridge@aopc-ai-tool
```

更新源与插件：

```bash
aopc plugins marketplace update
aopc plugins update fcm-bridge@aopc-ai-tool
```

## 贡献新插件 / 技能

1. 在 `plugins/<plugin-name>/` 下创建插件目录，清单放 `.aopc-plugin/plugin.json`（必需 `name`、`version`；按需声明 `commands`、`skills`、`hooks`、`mcpServers`）。
2. 在 `.claude-plugin/marketplace.json` 的 `plugins` 数组追加条目，`source` 指向 `"./plugins/<plugin-name>"`。
3. 技能随插件分发：把技能放在插件的 `skills/<skill-name>/SKILL.md`（frontmatter 含 `name`、`description`），并在插件清单中声明 `"skills": "skills"`；纯技能型插件可以只含 skills 目录。
4. 提交 PR 前用 `aopc plugins validate <路径>` 校验插件或 marketplace 清单。

## 规范依据

- AOPC 兼容 Claude Marketplace 默认结构：优先读取 `.claude-plugin/marketplace.json`，根目录 `marketplace.json` 作为回退。
- 插件 id 为 `<plugin-name>@<marketplace>`，本源 marketplace id 为 `aopc-ai-tool`。
- 公开 GitHub HTTPS 源走 GitHub Archive（zipball）安装，无需本机 Git；插件条目 `source` 为相对路径时，相对仓库根解析。
- 插件内引用自身文件时不要硬编码安装路径；运行时 hooks/MCP 可用 `${CLAUDE_PLUGIN_ROOT}`，命令 Markdown 正文用自定位写法（参考 `plugins/fcm-bridge/commands/fcm.md`）。

## License

MIT
