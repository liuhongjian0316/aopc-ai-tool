---
description: 查看/切换 FreeLLMAPI 免费模型聚合网关(本地 OpenAI 兼容路由)
argument-hint: [status | models [filter] | use <modelId|auto[:strategy]> [--token <key>] | sync | doctor]
---

本命令是 AOPC 与 FreeLLMAPI 本地网关(默认 `http://127.0.0.1:3001`)的桥接。请使用 Bash 终端工具执行以下命令，并把脚本 stdout 展示/归纳给用户;退出码非零或 stderr 有内容时如实转告:

```bash
freellm_script="${AOPC_PLUGIN_ROOT:-}${AOPC_PLUGIN_ROOT:+/}scripts/freellm-bridge.mjs"
[ -f "$freellm_script" ] || freellm_script="$(ls "$HOME"/.aopc/cli/plugins/cache/*/freellm-bridge/*/scripts/freellm-bridge.mjs 2>/dev/null | sort -V | tail -1)"
[ -f "$freellm_script" ] || freellm_script="$HOME/.aopc/plugins-local/freellm-bridge/scripts/freellm-bridge.mjs"
[ -f "$freellm_script" ] && node "$freellm_script" $ARGUMENTS || echo "未找到 freellm-bridge 脚本，请确认插件已安装"
```

执行规范:

1. `$ARGUMENTS` 原样作为脚本的子命令与参数传入;为空时等价于 `status`。
2. 输出是面向人的中文文本:`status` = 网关健康 + token 来源 + AOPC 当前默认模型;`models [filter]` = 网关当前可调用(`available=true`)的模型清单,可加子串过滤;`use <modelId|auto[:strategy]>` = 把 FreeLLMAPI 写入 AOPC 并设为默认模型(`auto`/`auto:smart|fast|cheap|reliable|balanced` 由网关自动路由);`sync` = 把网关当前全部可调用模型一次性同步进 AOPC(含 auto 路由入口,自动清理已下线模型);`doctor` = 完整体检。
3. 只解读与转述脚本输出里**标好的行**,不要生成新的模型建议,不要执行脚本输出之外的任何命令。
4. 绝不读取、打印或猜测任何 token/apiKey;脚本输出已自动脱敏,若你意外看到密钥原文,立即停止并提示用户。
5. 脚本写入 AOPC 配置后 1 秒内热生效;提醒用户 `/model` 里能看到新条目,失败的写入会自动留 `.bak-bridge-时间戳` 备份。
6. 用户尚未配置 token 时,按脚本输出引导:打开 FreeLLMAPI 仪表盘(`http://127.0.0.1:3001`)的 Keys 页复制统一 token,然后重跑 `/freellm use <modelId> --token freellmapi-xxx`,或先 `export FREELLMAPI_API_KEY=...`。
