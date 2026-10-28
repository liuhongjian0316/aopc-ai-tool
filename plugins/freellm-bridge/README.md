# freellm-bridge

AOPC 插件：在会话内接入 [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) 免费模型聚合网关（34 家免费上游、630+ 模型端点，OpenAI 兼容 `/v1`），提供 `/freellm` 斜杠命令。

## 功能

- `status`：网关健康 + 统一 token 来源 + AOPC 当前默认模型。
- `models [filter]`：网关当前可调用（`available=true`）的模型清单，支持子串过滤；`auto` / `auto:smart|fast|cheap|reliable|balanced` 等路由入口单独列出。
- `use <modelId|auto[:strategy]> [--token <key>]`：把 FreeLLMAPI 写入 AOPC 个人 Provider（`http://127.0.0.1:3001/v1`）并设为默认模型；普通模型会从官方公开目录核对上下文窗口与图片输入能力，`auto` 系列由网关自动路由。
- `sync`：把网关当前全部可调用模型（含 `auto`/`fusion` 路由入口）一次性同步进 AOPC，自动核对能力、清理已下线模型。
- `doctor`：端到端体检（网关、token、可调用模型数、AOPC 内已收录模型）。

## 安全约束

- 脚本输出对 `sk-...` key 与 `freellmapi-...` 统一 token 自动脱敏；命令规范要求 Agent 不读取、不回显密钥原文。
- token 解析顺序：`--token` 参数 → 环境变量 `FREELLMAPI_API_KEY` → AOPC 已保存值；来源只在输出中说明，不打印原文。
- 每次写入 AOPC `provider_config.json` 前自动备份为 `.bak-bridge-时间戳`，写入采用临时文件 + rename 原子替换，1 秒内热生效。

## 安装

添加本仓库为 AOPC marketplace 源后安装：

```bash
aopc plugins marketplace add liuhongjian0316/aopc-ai-tool
aopc plugins install freellm-bridge@aopc-ai-tool
```

## 前置条件

本机已安装并启动 FreeLLMAPI（默认端口 3001），且在仪表盘 `http://127.0.0.1:3001` 的 Keys 页创建了统一 token。FreeLLMAPI 自身安装方式（Docker 一键脚本 / npm / 桌面版）见其官方 README。

## 使用

在 AOPC 会话内输入：

```text
/freellm status
/freellm models
/freellm models gemini
/freellm use auto:fast
/freellm use glm-5.3:free
/freellm use gemini-3.8-flash --token freellmapi-xxxx
/freellm doctor
```

切换成功后，AOPC `/model` 列表出现 `FreeLLMAPI 免费模型聚合` 条目，会话与 Agent 请求经本地网关路由到免费上游。
