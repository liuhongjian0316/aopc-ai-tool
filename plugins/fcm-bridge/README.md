# fcm-bridge

AOPC 插件：在会话内查看与切换 [free-coding-models](https://github.com/)（FCM）免费模型路由，提供 `/fcm` 斜杠命令。

## 功能

- `status`：FCM 网关健康 + AOPC 当前默认模型 + 各供应商 key 配置概况。
- `models`：当前 active set 的模型清单（优先级/健康/延迟）。
- `use <groq|cerebras|siliconflow|nvidia|openrouter> [modelId]`：直连某家免费供应商并设为 AOPC 默认模型。
- `use-router`：默认模型切回 FCM 网关自动路由（`fcm-router/fcm`）。
- `doctor`：端到端体检。

## 安全约束

- 脚本输出绝不打印 apiKey 原文，命中密钥特征时自动脱敏拦截。
- key 来源支持环境变量（`GROQ_API_KEY` 等）和本机 FCM 配置文件，明文 key 只写入本机 AOPC 配置。
- 每次写入 AOPC `provider_config.json` 前自动备份为 `.bak-bridge-时间戳`，写入采用临时文件 + rename 原子替换。

## 安装

添加本仓库为 AOPC marketplace 源后安装：

```bash
aopc plugins marketplace add liuhongjian0316/aopc-ai-tool
aopc plugins install fcm-bridge@aopc-ai-tool
```

## 使用

在 AOPC 会话内输入：

```text
/fcm status
/fcm models
/fcm use groq llama-3.3-70b-versatile
/fcm use-router
/fcm doctor
```
