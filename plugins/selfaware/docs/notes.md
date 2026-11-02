# P1 勘察与实现笔记(2026-11-02)

对应 DESIGN.md §11 路线图。状态:**迭代至 v0.4.0,冒烟测试 76 项全绿;真机验证六项全部有结论(见 §四)**;待办:0.4.0 提交推送、marketplace 发布、周级语感调优。

## 〇、升级记录

### v0.3.0(2026-11-02)

- **慢性错误检测**:`self_errors` 对同一 工具×签名 跨 ≥3 个会话复发的错误标记"慢性"并建议固化 playbook——把"偶发"和"习惯性问题"区分开,是 L2→L4 闭环的推理升级(T14)。
- **self_history 叙事化**:Stop 事件留存我最后回复的脱敏片段(200 字符,密钥打码),跨会话记忆从纯统计升级为"最近在做"(T13)。
- **critic 提醒**:会话内文件改动累计 10 处(atEdits 可配)时一次性建议收尾前派 critic——大改动是定稿审查的最佳触发点;开关 `injectCriticNudge`(第 4 独立开关,延续拍板 #3 的粒度精神)(T12)。
- **实现教训(T12 抓出)**:`const FILE_TOOLS` 一度声明在 `main()` 之后,模块顶部的 `main()` 调用触发 TDZ,PostToolUse 全路径静默死亡——观察器"静默降级"铁律同时会吞掉这类 bug,新增测试是唯一防线;已把声明提到 `main()` 前,并在注释中标明约束。
- **真机实证(部分)**:0.2.0 已安装;resume 老会话(sess_cefed5a4…)时 SessionStart hook 触发、self-model/playbooks 骨架自动播种——C1/C2 的关键链路在真实宿主通过。冒烟测试 59 → **70 项**全绿。
- 数据目录清理:清除了早前冒烟调试误写入真实数据目录的 state.json/sess_dbg 残留(均零数据,无用户内容)。

### v0.2.0(2026-11-02)

- **修复**:`self_state` 可能误选子代理会话为主会话——observer 现对每个事件显式写 `sess.sub = isSub`;子代理会话即便更晚活跃也不会被选为 currentSid(T8 覆盖)。
- **新增 self_history**:跨会话自传体记忆——最近 N 个会话的轮数/工具调用/失败率 + 累计统计(工具表第 5 项)。
- **SessionStart 自动播种**:首次会话自动创建 `self/self-model.md` 五段式骨架与 `self/playbooks/README.md`(只创建、不覆盖;内容填充仍只走复盘,§6.2 纪律不变)。
- **playbook 规则注入横幅**:规则从文件进入上下文(600 字符截断预算,超量提示"其余 N 条见目录")——L4 闭环的"规则被执行"有了载体(T10 覆盖)。
- **新增 /selfcheck 命令**:把本文件 §四的待真机验证项产品化,新会话一键逐项核对(C1 注入/C2 数据流/C3 子代理观测/C4 派发名/C5 工具/C6 预算来源)。
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

## 四、真机验证结论(2026-11-02,`aopc -p` 无头 ×3 + resume 会话)

| 项 | 结论 | 证据 |
|---|---|---|
| C1 SessionStart 注入 | **✓ hook 实锤触发**(startup 与 resume 两种 source 都见过);注入到达模型由 stdout 契约 + 冒烟保证 | 真实 `events/*.jsonl` 出现 `session_start`(resume:老会话 sess_cefed5a4;startup:无头 V1) |
| C2 数据流与 rollout 对应 | **✓** 事件/state/rollout 三方一致;**但发现时序 bug**:rollout 在 turn 结束才落盘 → 首 turn 预算必为 null(v0.4.0 修复:Stop 时增量刷新) | V1:events 齐全而 budget null;rollout mtime 晚于 Stop |
| C3 子代理观测 | **✗ 负结果(实锤)**:子代理内部工具调用不触发 hook、不产生 sess_subagent_ 事件,主会话只见 `Agent` 派发本身。合并视角降级为**派发计数**(v0.4.0 已适配) | V2 派发 Explore+guanji,主会话 toolCalls 仅 `{"Agent":2}` |
| C4 子代理派发名 | **✓ `guanji` 裸名在真实宿主直接可用**(无需回落 `selfaware:guanji`) | V2 主 agent 汇报"在可用 agent 类型列表中存在,一次派发成功" |
| C5 MCP 工具 | **✓ 真实宿主端到端可用**;MCP 工具真实命名空间实测为 `mcp__plugin_selfaware_selfaware__self_state`(plugin_插件名_服务名__工具名) | V3:主 agent 调 `self_state` 并完整回传结构化结果;事件日志记下真实工具名 |
| C6 预算来源 | **✓ provider 实测**(confidence=high,"39.7k/200k,19.8%")——V1 的 null 纯属时序,非估算失真 | V3 self_state 原文 |

另:/selfcheck 命令(宿主按文件名注册,非 /self-check)作为产品化自检保留,2026-11-02 已在真实宿主完成首次 dogfood:**5/6 PASS**(C3 为已知宿主事实,报告中引的是当时安装的 0.2.0 措辞,0.4.0+ 已适配派发计数);C5 见证 self_history 积累到 5 个真实会话。

## 〇、升级记录

### v0.7.0(2026-11-02,长期卫生)

- **事件日志保留策略**:`retentionDays`(默认 90,0=永久)——超过保留期的 events/*.jsonl 在首个 startup 会话惰性清理(仅 startup,避开 resume/compact 热路径)。此前 events/ 无限增长且 self_history 每次全量扫描,长期使用会退化。
- **时间展示本地化**:self_history/self_journal 从 UTC 改本地时区——UTC+8 用户傍晚的会话此前会显示成"次日凌晨"。
- **测试侧教训(T22)**:`fs.utimesSync` 传数字按**秒**解释而非毫秒,旧文件被设成未来时间导致清理断言失败——改传 Date 对象。
- 冒烟测试 94 → **100 项**全绿。

### v0.6.0(2026-11-02,校验与 dogfood 收口)

- **宿主级校验通过**:`aopc plugins validate` → "Plugin manifest is valid"——设计承诺的最后一道验证关卡关闭。
- **/selfcheck 真机 dogfood**:产品自己的体检命令在真实宿主端到端跑通,5/6 PASS(唯一 FAIL 为已知 C3 宿主事实,报告引用的是当时安装的 0.2.0 措辞);C5 见证 self_history 积累 5 个真实会话。
- **self_config 工具**(第 6 个 MCP 工具):注入开关/节流参数/上下文窗口会话内白名单读写,立即生效,不必手改 config.json。
- 命令命名统一 `/selfcheck`(宿主按文件名注册);冒烟测试 85 → 94 项全绿。

### v0.5.0(2026-11-02,自检闭环收紧)

- **自我档案健康度**:self_state 报告五段完整性、教训条数、最后变更——复盘漂移有了仪表;健康度统计按 "## " 标题切片实现(第一版正则被 `/m` 的 `$`-行尾语义坑了,T19 抓出,教训同 TDZ 一并记档:观察器的静默降级会吞实现错误,测试是唯一防线)。
- **过期提案提醒**:self_journal 查询对超 7 天未落地的提案打 ⚠ + 清账指引——积压的提案等于没有提案(T20)。
- **真机回归脚本化**:scripts/e2e.mjs 把 V1/V2/V3 手工验证固化为可复跑断言(hook 全链/provider 预算/Agent 派发计数/无子代理事件/MCP 端到端),与 smoke(85 项本地)构成两级测试;e2e 需已安装 ≥0.4.0。
- dataRoot 回退改 `os.homedir()`(Windows 兼容);冒烟测试 76 → **85 项**全绿。

### v0.4.0(2026-11-02,真机验证驱动)

- **修复(C2)**:rollout 在 turn 结束才落盘 → 首 turn/单 turn 会话预算永远 null。Stop 时增量刷新预算(T15 复现→修复→锁定)。
- **适配(C3)**:`self_state` 子代理视图从"子会话聚合"改为"Agent 派发计数";子代理内部调用对 hook 不可见是宿主事实,如实呈报。
- **慢性错误自动提案**:`self_errors` 发现慢性模式时惰性写 journal `playbook_proposal`(refs 带 `chronic:tool|sig` 去重标记,/reflect 落地)——L2→L4 闭环不再依赖人记得去查(T16)。
- **跨会话复盘债**:Stop 时把未复盘失败**增量**并入全局 `outstandingDebt`,开场横幅提示清账,journal 落账(复盘/自省/规则落地)清零。**T5 教训**:Stop 每轮触发,整批搬运会把会话内 nudge 计数搬空——必须增量搬运(carried 游标),T5/T17 双向锁定该语义。
- playbookDigest 规则按 P1→P3 排序进入预算(T18)。
- 冒烟测试 70 → **76 项**全绿。

### v0.3.0(2026-11-02)
