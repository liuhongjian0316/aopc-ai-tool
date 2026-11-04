# 贡献指南

## 提交插件

1. Fork 本仓库，在 `plugins/<kebab-case-name>/` 下创建插件目录。
2. 按 [AGENTS.md](./AGENTS.md) 的插件结构约定提供 `.aopc-plugin/plugin.json` 清单与至少一个可发现组件。
3. 同步 `.zcode-plugin/plugin.json`（同版本）与根 `marketplace.json` 条目。
4. 运行 `aopc plugins validate plugins/<name>` 通过校验。
5. 提交 PR，说明插件功能、工具面与已完成的验证。

## 版本

任何安装包内文件变更都需要提升语义化版本（清单 + marketplace 条目同步）。详见 [AGENTS.md](./AGENTS.md) 版本契约。
