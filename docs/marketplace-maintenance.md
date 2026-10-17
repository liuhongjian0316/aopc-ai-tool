# 源维护说明

本目录记录 aopc-ai-tool 作为 marketplace 源的维护约定，规范依据见 AOPC 仓库
`docs/claude-code-marketplace-plugin-compat.md` 与 `docs/plugin-github-archive-source.md`。

## marketplace 清单

- 清单位于 `.claude-plugin/marketplace.json`（AOPC 优先读取，Claude Code 默认路径一致）。
- 根目录也可以放 `marketplace.json` 作为回退；两份并存时必须保持内容一致，本源目前只维护一份。
- `name` 即 marketplace id（`aopc-ai-tool`），安装后的插件 id 形如 `fcm-bridge@aopc-ai-tool`。

## 插件条目

- 插件源码放 `plugins/<name>/`，条目 `source` 写相对路径 `"./plugins/<name>"`，
  相对仓库根（materialize 后的 marketplace 根）解析。
- 公开 GitHub 源默认走 GitHub Archive zipball 下载（限额内无需 Git），自动剥离唯一顶层目录后
  在其内解析清单与条目路径。
- 条目可带 `ref`/`sha` 固定版本；`sha` 是 Git 对象身份，不要与 zip 内容的 SHA-256 混用。

## 版本与更新

- 插件缓存目录的版本段取插件 `.aopc-plugin/plugin.json` 的真实 `version`，
  发布新版本时同步更新 plugin.json 与 marketplace 条目的 `version`。
- 用户侧通过 `aopc plugins marketplace update` 刷新快照、`aopc plugins update <plugin>` 更新插件。

## 校验

```bash
aopc plugins validate .claude-plugin/marketplace.json
aopc plugins validate plugins/fcm-bridge
```
