---
description: 抖音托管总览：账号授权状态、发布队列、数据快照
argument-hint: [status | auth | rpa | queue | data]
---

本命令是 douyin-pilot 插件的快捷入口。请按以下步骤用 MCP 工具（douyin-pilot 提供的 dy_* 工具）收集信息并汇总给用户；插件未安装时如实说明并给出安装指引。

1. `$ARGUMENTS` 为空或 `status` 时：依次调用 `dy_rpa_status`（RPA 通道状态）和 `dy_config_get`、`dy_accounts`（API 通道状态），汇总为「RPA 通道 / API 通道 / 发布队列」三段输出；给出下一步建议（未装依赖 → 建议运行 `dy_rpa_setup`；未登录 → 建议运行 `dy_rpa_login` 扫码；API 未配置 → 说明其需开放平台资质，不影响 RPA 发布）。
2. `rpa`：依次 `dy_rpa_status`、必要时 `dy_rpa_login`（提示用户在弹出的浏览器扫码），完成后报告登录态。
3. `auth`：调用 `dy_auth_listen` 发起官方 API 本机授权流程（需先配置 client_key），等待结果并如实转达。
4. `queue`：调用 `dy_queue_list`；若有到期任务（dueAt 早于当前时间且状态 pending），询问用户后调用 `dy_queue_run`（RPA 通道任务在到期时刻立即发布）。
5. `data`：调用 `dy_account_stats`（dateRange=7d）并解读为中文摘要：粉丝量、播放、互动的变化与异常点。API 通道不可用时如实说明（需开放平台资质）。

规范：只转述工具返回的真实数据，接口报错时原文说明原因（常见：未装 RPA 依赖、未扫码登录、未配置 client_key、token 过期、能力未开通），不要编造数字。
