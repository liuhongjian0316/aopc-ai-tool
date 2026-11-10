---
description: 观己真机自检:逐项验证 hook 注入、数据流、rollout 对应、九工具面、台账/召回/进化时间线与子代理派发名是否在本会话真实生效,输出核对报告
argument-hint: ""
---

执行观己(selfaware)插件的真机自检。逐项做,每项给出 PASS / FAIL / SKIP 与证据,最后汇总成核对报告。不要臆测——每一项都以本会话实际读到的数据为准。

## 检查项

**C1 · SessionStart 注入**
调 `self_state`。若返回「暂无观察数据」→ FAIL(SessionStart hook 未生效:检查插件是否启用、hooks 是否被 Trust 拦截);若返回主会话状态 → PASS,记下其中的数据目录路径与 session id。

**C2 · 数据流与会话对应**
从 self_state 输出的数据目录,Read `events/<当前会话id>.jsonl` 是否存在且含 `session_start` 事件;再调 `self_usage`,核对「rollout 存在」是否为 true、`rolloutOffset` 是否在增长(调用两次对比,第二次应 ≥ 第一次)。二者皆真 → PASS。

**C3 · 子代理观测(派发计数语义)**
用 Agent 工具派发一个最轻量的只读子代理(如 Explore 类型,任务是「报告当前目录下文件数,不许做别的」),完成后重新调 `self_state`:
- `session.dispatches` 计数 ≥1 → PASS(C3 真机结论:子代理内部工具调用不触发 hook,合并视角为**派发计数**);
- 计数无任何变化 → FAIL(Agent 工具派发本身未被 hook 观测到——那才是异常)。

**C4 · guanji/critic 派发名**
用 Agent 工具派发 `guanji`,任务「只输出一行:guanji 派发名验证通过,不读任何数据」;若该名不可用,改试 `selfaware:guanji`。记录最终可用的派发名 → PASS(含可用名),两个都失败 → FAIL(检查插件 agents/ 目录加载)。

**C5 · 九工具面**
依次调 `self_state`、`self_errors`、`self_usage`、`self_history`、`self_recall`(query: "测试")、`self_mission`(action=get)、`self_config`(action=get)、`self_journal`(action=query)、`self_learn`(action=list),确认全部返回结构化结果而非报错 → PASS/FAIL(列出哪个不可用)。

**C6 · 预算来源**
看 `self_usage` 输出的数据来源:provider 实测 → PASS;字节估算 → PASS 但注明「rollout 无 usage 锚点(超长单行场景已被 2.1.0 正则兜底覆盖,理论少见)」;完全无数据 → FAIL。

**C7 · 台账 / 召回 / 进化时间线**
- `self_mission get` 的台账段:有 awaiting 条目 → 核对超 24h 未自评的是否带「自评逾期」提示、≥48h 的是否被标记优先回访(3.6.0 起 structured 带 `selfReviewDue`);有 voided → 确认原因可读;
- `self_recall`(query 用当前使命关键词):确认知识库/playbook 源可命中或明确无命中;
- `self_state` 的 `evolution`:modelChanges/rulesByFile 可读(数字可为 0,新装正常);
- `self_state` 的 `opsScripts`:已登记/未登记标记可读(登记簿兼容裸数组与 `{scripts:[...]}` 两种格式)。
四项皆真 → PASS。

**C8 · 版本一致性(3.7.0 起,防版本漂移复发)**
若能定位插件源目录(本仓库 `plugins/selfaware/` 或安装缓存目录):读取 `.aopc-plugin/plugin.json`、`.zcode-plugin/plugin.json`、`server.mjs` 的 `VERSION`、`panel/panel.js` 的 App version、仓库两个 `marketplace.json` 中 selfaware 条目,五处应完全一致 → PASS;任何一处不一致 → FAIL(列出全部值——历史上 v3.1.0/v3.7.0 都栽在双 manifest 漂移)。定位不到插件源 → SKIP。

## 汇报格式

```
【观己真机自检】<日期> · 插件 v<版本>
C1 SessionStart 注入:PASS/FAIL — <证据一句话>
C2 数据流与 rollout:...
C3 子代理派发计数:...(若 FAIL,注明 Agent 派发本身未被观测到——那是 hook 层异常,而非语义降级)
C4 派发名:...(记录可用名)
C5 九工具:...
C6 预算来源:...
C7 台账/召回/进化时间线:...
C8 版本一致性:...(五处值列表或 SKIP)
结论:<N/8 通过;待修事项列表>
```

自检本身不做任何修复、不改任何文件;发现 FAIL 项留给用户决定是否排查。若 `self_state` 显示的插件版本与本命令预期(≥2.9.0)不符,在结论里注明「插件版本较旧,部分检查项可能不适用」。
