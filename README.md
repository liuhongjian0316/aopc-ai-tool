# aopc-ai-tool Plugin Marketplace

liuhongjian's AOPC/ZCode plugin marketplace. Add it as a GitHub marketplace source to AOPC; compatible with Claude Code and ZCode clients.

> 中文文档：[README_CN.md](./README_CN.md)

## Install

```shell
aopc plugins marketplace add <本仓库 GitHub 地址>
aopc plugins install wudi-coding@aopc-ai-tool --scope user
```

## Available Plugins

| Plugin | Category | Version | Description |
| --- | --- | --- | --- |
| [wudi-coding](./plugins/wudi-coding) | `developer-tools` | 0.28.0 | 无敌编程 |
| [hongguo-drama](./plugins/hongguo-drama) | `entertainment` | 0.3.0 | 红果短剧下载器接入 AOPC |
| [fcm-bridge](./plugins/fcm-bridge) | `developer-tools` | 0.2.0 | AOPC 会话内查看与切换 free-coding-models 免费模型路由(/fcm 命令) |
| [freellm-bridge](./plugins/freellm-bridge) | `developer-tools` | 0.1.1 | AOPC 会话内接入 FreeLLMAPI 免费模型聚合网关 |
| [boot-animation](./plugins/boot-animation) | `customization` | 0.2.1 | 自定义 AOPC 启动画面 |
| [desktop-pet](./plugins/desktop-pet) | `customization` | 0.1.0 | AOPC 桌面宠物 |
| [douyin-pilot](./plugins/douyin-pilot) | `social-media` | 0.2.1 | 抖音账号托管助手 |
| [obsidian-kb](./plugins/obsidian-kb) | `knowledge-base` | 0.1.3 | Obsidian 知识库集成 |
| [selfaware](./plugins/selfaware) | `productivity` | 2.7.0 | 观己:给 AOPC agent 装上分层的功能性自我意识 |

## Repository Layout

```text
aopc-ai-tool/
├── .claude-plugin/
│   └── marketplace.json      # marketplace 清单（AOPC 优先读取该路径，根 marketplace.json 为回退）
├── marketplace.json           # 根清单副本（与 .claude-plugin 同步，ZCode 客户端兼容）
├── plugins/                   # 插件目录，每个插件一个子目录
│   └── wudi-coding/
│       ├── .aopc-plugin/plugin.json    # AOPC 插件清单
│       ├── .zcode-plugin/plugin.json   # ZCode 兼容清单（双目录惯例，与 .aopc-plugin 同步）
│       ├── commands/ skills/ agents/   # 组件
│       ├── mcp-server/ lib/            # MCP 工具面
│       └── README.md
├── docs/                      # 源维护说明
├── skills/                    # 技能收录说明与约定
└── AGENTS.md                  # Agent 维护指南
```

## Plugin Structure

```text
my-plugin/
├── .aopc-plugin/plugin.json   # 必需清单（AOPC）
├── .zcode-plugin/plugin.json  # ZCode 兼容清单（与 .aopc-plugin 保持同版本）
├── commands/*.md              # 斜杠命令，$ARGUMENTS 接收输入
├── skills/<name>/SKILL.md     # 技能（name/description 必填）
├── agents/*.md                # 子代理定义
└── mcp-server/                # MCP stdio server（可选）
```

## Versioning Contract

任何进入安装包的文件变更（清单/组件/Hook/MCP 声明/插件 README）都必须同时在 `.aopc-plugin/plugin.json` 与根 `marketplace.json` 提升语义化版本。已发布版本不可复用。

## Validation

提交前在仓库根执行：

```shell
aopc plugins validate plugins/<插件名>
```

## License

MIT（各插件以其清单标注为准；vendor 组件见各插件内归属文件）。
