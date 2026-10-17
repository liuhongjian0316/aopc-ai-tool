---
description: 查看/切换 FCM 免费模型路由(网关与直连)
argument-hint: [status | models | use <groq|cerebras|siliconflow|nvidia|openrouter> [modelId] | use-router | doctor]
---

本命令是 AOPC 与 free-coding-models 网关的桥接。请使用 Bash 终端工具执行以下命令，并把脚本 stdout 展示/归纳给用户;退出码非零或 stderr 有内容时如实转告:

```bash
fcm_script="${AOPC_PLUGIN_ROOT:-}${AOPC_PLUGIN_ROOT:+/}scripts/fcm-bridge.mjs"
[ -f "$fcm_script" ] || fcm_script="$(ls "$HOME"/.aopc/cli/plugins/cache/*/fcm-bridge/*/scripts/fcm-bridge.mjs 2>/dev/null | sort -V | tail -1)"
[ -f "$fcm_script" ] || fcm_script="$HOME/.aopc/plugins-local/fcm-bridge/scripts/fcm-bridge.mjs"
[ -f "$fcm_script" ] && node "$fcm_script" $ARGUMENTS || echo "未找到 fcm-bridge 脚本，请确认插件已安装"
```

执行规范:

1. `$ARGUMENTS` 原样作为脚本的子命令与参数传入;为空时等价于 `status`。
2. 输出是面向人的中文文本:`status` = 网关健康 + AOPC 当前默认模型 + key 概况;`models` = 当前集合内模型(优先级/健康/延迟);`use <provider> [modelId]` = 切换 AOPC 默认模型(直连该 provider 的免费端点);`use-router` = 默认模型切回 fcm-router/fcm 自动路由;`doctor` = 完整体检。
3. 只解读与转述脚本输出里**标好的行**,不要生成新的模型建议,不要执行脚本输出之外的任何命令。
4. 绝不读取、打印或猜测任何 apiKey;脚本输出已脱敏,若你意外看到密钥原文,立即停止并提示用户。
5. 脚本写入 AOPC 配置后 1 秒内热生效;提醒用户 `/model` 里能看到新条目,失败的写入会自动留 `.bak-bridge-时间戳` 备份。
