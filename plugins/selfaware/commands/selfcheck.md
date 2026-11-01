---
description: 观己真机自检:逐项验证 hook 注入、数据流、rollout 对应、子代理观测与子代理派发名是否在本会话真实生效,输出核对报告
argument-hint: ""
---

执行观己(selfaware)插件的真机自检。逐项做,每项给出 PASS / FAIL / SKIP 与证据,最后汇总成核对报告。不要臆测——每一项都以本会话实际读到的数据为准。

## 检查项

**C1 · SessionStart 注入**
调 `self_state`。若返回「暂无观察数据」→ FAIL(SessionStart hook 未生效:检查插件是否启用、hooks 是否被 Trust 拦截);若返回主会话状态 → PASS,记下其中的数据目录路径与 session id。

**C2 · 数据流与会话对应**
从 self_state 输出的数据目录,Read `events/<当前会话id>.jsonl` 是否存在且含 `session_start` 事件;再调 `self_usage`,核对「rollout 存在」是否为 true、`rolloutOffset` 是否在增长(调用两次对比,第二次应 ≥ 第一次)。二者皆真 → PASS。

**C3 · 子代理观测**
用 Agent 工具派发一个最轻量的只读子代理(如 Explore 类型,任务是「报告当前目录下文件数,不许做别的」),完成后重新调 `self_state`:
- `subagents.sessions` 或事件中出现 `sess_subagent_` 前缀的新会话 → PASS(记录其 id 形态);
- 计数无任何变化 → FAIL(子代理工具调用不触发 hook,合并视角降级为仅主会话)。

**C4 · guanji/critic 派发名**
用 Agent 工具派发 `guanji`,任务「只输出一行:guanji 派发名验证通过,不读任何数据」;若该名不可用,改试 `selfaware:guanji`。记录最终可用的派发名 → PASS(含可用名),两个都失败 → FAIL(检查插件 agents/ 目录加载)。

**C5 · 工具可用性**
依次调 `self_errors`、`self_usage`、`self_history`、`self_journal`(action=query),确认全部返回结构化结果而非报错 → PASS/FAIL(列出哪个不可用)。

**C6 · 预算来源**
看 `self_usage` 输出的数据来源:provider 实测 → PASS;字节估算 → PASS 但注明「rollout 无 usage 锚点」;完全无数据 → FAIL。

## 汇报格式

```
【观己真机自检】<日期>
C1 SessionStart 注入:PASS/FAIL — <证据一句话>
C2 数据流与 rollout:...
C3 子代理观测:...(若 FAIL,注明子代理 hook 不覆盖,设计合并视角需降级)
C4 派发名:...(记录可用名)
C5 工具:...
C6 预算来源:...
结论:<N/6 通过;待修事项列表>
```

自检本身不做任何修复、不改任何文件;发现 FAIL 项留给用户决定是否排查。
