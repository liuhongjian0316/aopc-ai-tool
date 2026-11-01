# P1 勘察与实现笔记(2026-11-02)

对应 DESIGN.md §11 路线图。状态:**P1–P5 代码已全部落地,冒烟测试 59 项全绿(v0.2.0)**;待真机会话验证(装上后可直接跑 `/self-check`)与 marketplace 发布。

## 〇、v0.2.0 升级记录(2026-11-02)

- **修复**:`self_state` 可能误选子代理会话为主会话——observer 现对每个事件显式写 `sess.sub = isSub`;子代理会话即便更晚活跃也不会被选为 currentSid(T8 覆盖)。
- **新增 self_history**:跨会话自传体记忆——最近 N 个会话的轮数/工具调用/失败率 + 累计统计(工具表第 5 项)。
- **SessionStart 自动播种**:首次会话自动创建 `self/self-model.md` 五段式骨架与 `self/playbooks/README.md`(只创建、不覆盖;内容填充仍只走复盘,§6.2 纪律不变)。
- **playbook 规则注入横幅**:规则从文件进入上下文(600 字符截断预算,超量提示"其余 N 条见目录")——L4 闭环的"规则被执行"有了载体(T10 覆盖)。
- **新增 /self-check 命令**:把本文件 §四的待真机验证项产品化,新会话一键逐项核对(C1 注入/C2 数据流/C3 子代理观测/C4 派发名/C5 工具/C6 预算来源)。
- 冒烟测试 44 → **59 项**全绿;`/reflect` 命令中"数据全空则初始化骨架"分支保留,与自动播种互为冗余。

## 一、四项行为假设的验证结论

### ① hooks 契约(精读源码,非猜测)

依据:`AOPC/docs/hooks-runtime-contract.md`、`core/src/hooks/output.ts`、`core/src/hooks/configured-runner-input.ts`、`contracts/src/hooks/index.ts`。

- 7 事件确认:SessionStart / UserPromptSubmit / PreToolUse / PermissionRequest / PostToolUse / PostToolUseFailure / Stop。本插件注册 5 个(见偏差 1)。
- stdin 为单行 JSON,camelCase + snake_case 双字段:基础 `session_id`/`transcript_path`/`cwd`/`permission_mode`/`hook_event_name`;SessionStart 给 `source`;UserPromptSubmit 给 `prompt`;PostToolUseFailure 给 `tool_name`/`error`(字符串)/`is_interrupt`;Stop 给 `stop_hook_active`/`last_assistant_message`。
- **注入形状:顶层 `{"additionalContext": "..."}` 即可**(`output.ts:44-46` 同时收 camel 与 snake_case),不需要 hookSpecificOutput 包裹。
- hook 进程环境由宿主注入:`AOPC_PLUGIN_DATA/ROOT/ID/NAME`、`AOPC_SESSION_ID`、`AOPC_PROJECT_DIR` 等(`configured-runner-input.ts:74-98`)——观察器据此定位数据目录与 rollout。
- **hooks 不支持 `${user_config.*}`**(`configured-runner-input.ts:119-120` 固定变量白名单)且 hook 条目无 `env` 字段(`contracts/src/hooks/index.ts:317-343`)→ 开关走数据目录 `config.json`(偏差 2)。
- matcher 语义:空/`*` 全匹配;SessionStart 匹配 `source`。本插件统一空 matcher + 进程内按 source 分支。
- `onError` 缺省 allow;观察器自己也做到任何异常 exit 0 静默降级。

### ② rollout JSONL 结构与 usage 字段(实测真文件)

`~/.aopc/cli/rollout/model-io-<sessionId>.jsonl`,每行一条:

```json
{"type":"model_io","request":{"body":{...API请求...}},"response":{"usage":{"inputTokens":80642,"outputTokens":433,"totalTokens":81075,"cacheReadTokens":0,"reasoningTokens":21},...},"model":{"modelId":"auto","providerId":"freellmapi"},...}
```

- **`response.usage.inputTokens` 就是该次请求的 provider 真实上下文占用** —— 预算不必估算,直接读真值(设计预期的"近似 provider 精度"升级为"实测",见偏差 3)。
- 文件可达 17MB → 观察器首次取尾部 256KB 找最新锚点、后续按 `rolloutOffset` 增量读(实现于 `lib/budget.mjs`)。

### ③ 插件数据目录路径

- `AOPC_PLUGIN_DATA` = `<storageRoot>/plugins/data/<name>@<marketplace>`(`adapters/src/plugins/index.ts:144,184`,实机 `ls ~/.aopc/cli/plugins/data/` 确认命名)。
- `<cli> 根 = AOPC_PLUGIN_DATA 上溯三级` → rollout 目录自动推断;`config.json` 可用 `rolloutDir` 强制覆盖。

### ④ 自定义 agent(.md)加载

依据:`bootstrap/src/subagents.ts`、`packages/shared/src/subagent-profile-parser.ts`。

- frontmatter 键全集:`name`(必填)/`description`(必填)/`model`(`providerId/modelId` 或 inherit)/`thoughtLevel`/`color`(red|blue|green|yellow|purple|orange|pink|cyan)/`permissionMode`/`maxTurns`/`memory`(user|project|local)/`tools`/`disallowedTools`/`skills`/`background`/`injectAgentsMd`/`mcpServers`。
- 插件 agent 权威名 `plugin名:裸名`,裸名唯一时同时注册裸名别名(保留名 general-purpose/Explore 除外)→ 派发先试 `guanji`,回退 `selfaware:guanji`(/reflect 命令已按此写)。

### ⑤ MCP server 实现范本

`aopc-ai-tool/plugins/douyin-pilot/mcp-server/server.mjs`(60 行零依赖):newline 分隔 JSON-RPC;`initialize` **回显客户端 protocolVersion**(缺省 2024-11-05);`tools/list`/`tools/call`/`ping`;未知方法 -32601。错误包装参考 desktop-pet(`content:[{type:"text"}]` + `isError:true`)。本插件 server.mjs 照此实现,并修复两处范本级隐患:stdin `end` 不主动 exit(防响应截断)、journal append 双重 textResult 包装(冒烟 T7 抓出)。

## 二、实现相对设计的偏差(已回写 DESIGN.md)

| # | 偏差 | 原因 |
|---|---|---|
| 1 | **PreToolUse 不注册**;工具调用计数由 PostToolUse(成功)+ PostToolUseFailure(失败)承担 | 避免给每次工具调用**前置**一个 node 进程(~30-80ms);副作用:挂起中未返回的调用不计入 |
| 2 | 三个注入开关从 manifest `userConfig` 改为 `${AOPC_PLUGIN_DATA}/config.json` | hooks 进程拿不到 `user_config.*`,文件是唯一能同时触达 hook 与 MCP 的机制 |
| 3 | 预算标注从"estimate·low"升级:provider 路径标 `provider 实测`(confidence high),字节估算仅回退 | `response.usage.inputTokens` 实测可得 |
| 4 | guanji/critic 子代理**不直接写** journal,报告由主 agent 落盘 | 子代理对 MCP 工具的可用性未验证,保守处理;/reflect 命令已按此编排 |
| 5 | plugin.json 不声明 `hooks` 字段 | `hooks/hooks.json` 是标准路径,存在即自动加载(`hook-sources.ts` STANDARD_HOOKS_PATH) |

## 三、冒烟测试(可复跑)

`node scripts/smoke.mjs` — **44 项全绿**:

| 组 | 覆盖 |
|---|---|
| T0 | 6 个 mjs 文件 `node --check` |
| T1 | SessionStart 横幅注入、工具入口宣告、建会话 |
| T2 | rollout 缺失时首轮静默;turn 计数;**隐私:prompt 只记长度不记正文** |
| T3 | 真实 rollout → provider 实测预算(80.6% 断言)+ 来源入 state |
| T4 | 连败 ×3 告警、成功清 streak、密钥脱敏(`***`)、签名数字归一化、打断不计失败 |
| T5 | 复盘债(≥8 段且 ≥3 败)第 8 段触发并清零 |
| T6 | compact 横幅;坏输入 exit 0 静默;TTY 守卫 |
| T7 | MCP 握手(协议回显)、4 工具、journal append/query、复盘债清理、errors 聚合、ping |

## 四、待真机会话验证(装上插件后)

1. SessionStart 注入在真实首轮前的出现时机与排版。
2. 子代理工具调用是否触发 PostToolUse*、其 `session_id` 是否 `sess_subagent_` 前缀(决定合并视角的实际数据流)。
3. 真实会话的 rollout 文件名与 hook `session_id` 的对应(冒烟用的是历史文件;真实会话首写时 offset 逻辑首跑)。
4. `/reflect` 全流程与 guanji 派发名(`guanji` 裸名 vs `selfaware:guanji`)。
5. 注入语感与节流参数在真实使用中的观感(周级)。
