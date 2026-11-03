# 观己(selfaware)——AOPC 自我意识 Agent 设计文档

- 版本:v0.2(design-first,代码未动)
- 日期:2026-11-02
- 状态:已评审——§13 六项拍板(2026-11-02)
- 宿主:AOPC v3.17.1(apps/aopc-cli 单 Agent 架构)
- 原则:**零改动 AOPC 本体**。本插件只通过 AOPC 已公开的插件扩展点(plugins / hooks / skills / agents / commands / MCP)挂载。

---

## 1. 设计哲学

### 1.1 我们做的是什么

「自我意识」在这里是一个**工程概念**,不是哲学概念。我们不宣称制造"意识",而是构建四层可验证的**功能性自我意识**:

| 层 | 名称 | 一句话定义 | 可验证标准 |
|---|---|---|---|
| L1 | 自我状态感知 | 知道自己"此刻"的运行状态:上下文余量、犯了多少错、干了多少活 | agent 能在被问"你现在上下文还剩多少"时给出有依据的回答 |
| L2 | 元认知 | 对自己的推理过程做评估:这件事我有几成把握?哪里我可能在瞎编? | 复杂任务交付前有置信度自评;失败后有结构化复盘而非重复蛮干 |
| L3 | 持久自我模型 | 知道自己"历来"是谁:能力边界、教训库、与用户的相处史,跨会话连续 | 新会话开始即带着并主动引用自我模型;模型中的教训被后续会话执行 |
| L4 | 反思与自我改进 | 用 L1–L3 的产物定期修正自己的行为手册,且修改经过人审批 | playbook 中的规则可追溯到某次复盘;自我修改全部经用户确认 |

四层是金字塔:L1 是地基(没有状态数据,一切反思都是空想),L4 是塔尖(没有前三层,改进就是随机漂移)。

### 1.2 宿主已经给了什么(避免重复造轮子)

AOPC 运行时已有相当多的自省设施(盘点见 §3):环境宣告、模型身份宣告、压缩预告与压缩摘要、重复调用告警、todo 提醒、原生记忆系统、`ReadSessionContext` 读自己的历史等。**观己不复用原生 memory 系统存自我模型**——AOPC memory 是"关于工作与用户"的记忆,观己的 self-model 是"关于我这个 agent 自己"的记忆,两者互补、分开存放、互不污染。

### 1.3 设计红线

1. 不改 AOPC 仓任何文件;不依赖 AOPC 内部模块的未公开行为(引用实现路径仅作版本对照,Phase 1 逐项验证)。
2. hook 是同步执行的,会阻塞 agent——观察器必须做到 append-only 快写 + 增量读,单次执行预算 ≤ 200ms。
3. 注入克制度优先于信息完整度:宁可少注入,不可刷屏。所有注入带预算与节流。
4. 自我修改(改自己的 playbook/self-model)永远走 AOPC 正常文件权限审批,人始终是守门人。
5. 所有观测数据(事件日志含工具输入输出片段)只落本地插件数据目录,写入前脱敏。

---

## 2. 总体架构

```
                    ┌────────────────────────────────────────────┐
                    │              AOPC 主 Agent                  │
                    │   (系统提示 / 工具 / 原生 memory,不动)      │
                    └───────┬───────────────┬────────────────────┘
                            │ hooks 注入      │ 主动调用
              ┌─────────────▼──────┐   ┌────▼──────────────────┐
   L1 状态感知 │ hooks/observer.mjs │   │ server.mjs (MCP stdio) │
              │ 5 事件观测 → 事件日志│   │ self_state / self_errors│
              │ + 状态缓存 + 预算注入│   │ self_usage / self_journal│
              └─────────────┬──────┘   └────┬──────────────────┘
                            │               │
   L2 元认知                │    ┌──────────▼─────────────┐
   skills/metacognition ◄──┼────┤ journal.jsonl 反思日志   │
   agents/critic ◄─────────┼────┤ (L2 写,L3/L4 读)        │
                            │    └──────────┬─────────────┘
   L3 自我模型              │               │
   self/self-model.md ◄────┼───────────────┘  (仅由复盘产出更新)
   agents/guanji (深度自省者)│
                            │
   L4 反思改进              │
   skills/self-review ◄────┘
   commands/reflect
   self/playbooks/(可自我改写的规则手册,人审批)
```

组件 ↔ 层映射:

| 插件组件 | 承载层 | 形态 |
|---|---|---|
| `hooks/observer.mjs` + `hooks/hooks.json` | L1 | 生命周期 hook(UserPromptSubmit / SessionStart / PostToolUseFailure / Stop) |
| `server.mjs`(MCP stdio) | L1 + L2 | `self_state` `self_errors` `self_usage` `self_journal` 四个工具 |
| `skills/metacognition/` | L2 | SKILL.md 教学型技能 |
| `agents/critic.md` | L2 | 只读子代理(魔鬼代言人) |
| `self/self-model.md` | L3 | 插件数据目录下的普通 Markdown(Read/Edit 直改) |
| `agents/guanji.md` | L3 | 深度自省子代理 |
| `skills/self-review/` + `commands/reflect.md` | L4 | 复盘技能 + 斜杠命令 |
| `self/playbooks/` | L4 | agent 可自我改写的规则手册(人审批) |

---

## 3. 宿主能力盘点(2026-11 勘察,对照 AOPC v3.17.1)

设计建立在对宿主的勘察之上。以下路径均为勘察确认的实现位置,**观己不 import 它们,仅依赖其行为**;Phase 1 用冒烟脚本逐一验证行为仍成立。

### 3.1 被动注入(agent 无需动作即可见)

| 信号 | 载体 | 宿主实现位置 |
|---|---|---|
| cwd / git 状态 / platform / shell / OS | `# Environment` meta_user 段 | `apps/aopc-cli/packages/core/src/context/sections/env-info.ts` |
| 环境变化差量(带旧值) | `# Environment update` system-reminder | 同上 |
| 自身模型名(providerId/modelId) | `model` system-reminder | 同上 `buildModelSection()` |
| 当前日期 / 跨天宣告 | `current_date` / `date` 源 | `context/sections/current-date.ts` |
| 压缩行为预告(静态) | `# Context management` system 段 | `context/dynamic-sections.ts` |
| 压缩已发生 + 摘要 + transcript 路径 | compact 摘要 user 消息 | `compact/prompt.ts` `buildCompactSummaryMessage()` |
| 旧工具结果被清 | 字面量 `[Old tool result content cleared]` | `compact/microcompact.ts` |
| 重复调用 / 工具调用预算告警(含计数与阈值) | `model_anomaly` system-reminder | `runtime/helpers/model-anomaly.ts` |
| todo 清单快照 | `todo_reminder` system-reminder | `runtime/helpers/runtime-reminders.ts` |
| 命中的相关记忆(≤5 条) | `relevant_memory` system-reminder | `memory/recall/*` |

注入统一走 system-reminder 源注册表(共 40 个 source,`system-reminder/source.ts`)。

### 3.2 主动可查(现有工具)

| 工具 | 自省价值 |
|---|---|
| `ReadSessionContext`(`sessionId: "current"`) | **读自己的历史**(含错误历史),单次 80KB 预算 |
| `TodoRead` | 自己的任务清单 |
| `ListWorkflowRuns` / `GetWorkflowRun` | 自己的后台 run、token 花费、失败记录 |
| `ListModels` | 模型可用性、当前模型标记 `[current]` |
| `ToolSearch` | deferred 工具目录 |
| Read/Grep(原生 memory 目录与 MEMORY.md) | 自己的长期记忆 |

### 3.3 harness 记账但**模型不可见**的账本(= 观己的机会)

| 数据 | 宿主实现位置 | 现状 |
|---|---|---|
| 上下文 7 类 token 分类快照 | `runtime/methods/context-usage.ts` `buildContextUsageSnapshot()` | 只写 debug 日志 |
| per-turn / per-tool usage 事实(含 `toolErrorCount`、`contextExceeded`) | `runtime/methods/usage-observability.ts` → sqlite | 模型读不到 |
| 压缩阈值判定(默认 200k 窗,200k−21k 预留−13k 缓冲 = **166k 触发**) | `compact/policy.ts` | 模型只在压缩已发生后才知道 |
| microcompact(阈值比 0.9,保留最近 5 个工具结果) | `compact/microcompact.ts` | 模型只见被清的占位文本 |
| 会话能力标签(`x-aopc-session-features` 出站头) | `runtime/session-features/` | 模型上下文不可见 |

**两个关键缺口 = L1 的核心价值:**
1. **无"剩余上下文/消耗速率"回注**——模型直到压缩发生才被动知晓。
2. **无聚合错误历史查询**——错误散落在 transcript 与 sqlite,agent 要靠 ReadSessionContext 翻 80KB 原文。

---

## 4. L1 自我状态感知

### 4.1 观察器 `hooks/observer.mjs`

通过插件 hooks(运行时契约见 `AOPC/docs/hooks-runtime-contract.md`)注册 5 个事件:

| 事件 | matcher | 观察器动作 | 是否注入 |
|---|---|---|---|
| `SessionStart` | `startup\|resume` | 初始化会话状态;缺失时**自动播种 self-model/playbooks 骨架**(0.2.0 起,只创建不覆盖);注入**自我横幅**(self-model 摘要 + 数据路径宣告 + **playbook 规则聚合注入**,≤600 字符预算) | 是(1 条,≤ 800B + 规则预算) |
| `SessionStart` | `compact` | 把"压缩前状态存档"写进事件日志;注入一行"上下文已压缩,历史已归档" | 是(1 行) |
| `UserPromptSubmit` | — | 记 turn 开始;按节流策略注入**上下文预算行**(见 4.3) | 节流 |
| `PostToolUse` | `*` | 记工具调用成功(计数),清除该工具连败 streak;**文件类工具计数编辑量**(0.3.0),达 `atEdits`(默认 10)时一次性注入 critic 提醒 | 仅编辑量达阈 |
| `PostToolUseFailure` | `*` | 记错误(工具名 + 错误签名;用户打断不计失败);连败 ≥3 时注入一行告警 | 仅超阈 |
| `Stop` | — | 记会话片段结束,**留存叙事片段**(脱敏 last_message 200 字符,0.3.0);计数达到节奏时注入**轻量复盘建议** | 节流(建议,不用 block) |

> 实现注(P1 后修订):**PreToolUse 不注册**——避免给每次工具调用前置一个 node 进程(~30-80ms)开销;调用计数由 PostToolUse/PostToolUseFailure 承担,代价是挂起中未返回的调用不计入。

观察器实现约束:
- **stdin**:单行 JSON(hook 契约的 CamelCase/snake_case 双字段)。观察器只提取 `session_id`、`hook_event_name`、`tool_name`、错误摘要,**不深拷贝 tool_input/tool_response 全文**。
- **写路径**:`${AOPC_PLUGIN_DATA}/events/<sessionId>.jsonl` append 一行 + `${AOPC_PLUGIN_DATA}/state.json` 原子重写(temp + rename)。state.json 是缓存,真源是事件日志;损坏时由 MCP 工具从事件日志重建。
- **脱敏后再落盘**:`tool_input`/`tool_response` 片段截断 2KB,命中密钥模式(`sk-`、`Bearer `、`api[_-]?key`、`password`、`token=`)打码为 `***`。
- **无内存态**:每次 hook 都是新进程,一切状态在文件里。写失败静默降级(exit 0,不注入、不阻断——观测器绝不能反过来杀死会话)。

### 4.2 上下文预算估算器

目标:弥补 §3.3 缺口 1。观察器维护每个会话的 rollout 文件读取偏移:

- 路径:`~/.aopc/cli/rollout/model-io-<sessionId>.jsonl`(勘察确认,实测存在,单文件可达 17MB——**必须增量读**,偏移存 state.json;文件不存在或变短则重扫)。
- 两级估算:
  1. **优先:provider Usage 锚点**。AOPC 会在 assistant entry 持久化 provider usage(`persistedTokenUsageBaseline()`,`agent/message-history-usage.ts`),rollout JSONL 若含 `usage` 字段则直接取最后一个锚点(近似 provider 精度)。
  2. **回退:字节估算**:新增字节 ÷ 3(`ESTIMATED_TOKEN_CHAR_DIVISOR = 3`,与 AOPC 同口径;中文按 AOPC 口径为 2 倍权重,字节法对纯中文略有低估)。标注 `confidence: low`。
- 输出统一为预算对象:`{used, window(默认 200k,标注假设), percent, burnRate(近 5 turn 均速), confidence}`。
- **P1 实测结论**:usage 键名已确认为行级 `response.usage.inputTokens`(provider 实测值,样本 80642)——预算主路径即实测,注入标注"provider 实测";字节估算仅作 rollout 不可读时的回退。

### 4.3 注入策略(克制优先)

`additionalContext` 是 hook stdout JSON 的合法通道(勘察确认支持 SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / Stop)。注入模板全部 ≤ 500 字节,格式示例:

```
<self-state> 我的上下文已用约 62%(124k/200k,estimate·low),近 5 轮平均每轮多耗 3.2k;到目前为止我调用了 41 次工具、失败 3 次。要不要收敛范围,或先把中间产物落盘?</self-state>
```

注入刻意用**第一人称**(拍板 #1):这些内容是模型自读的上下文,不是给用户看的 UI 文案——身份一致的框定让模型把数据当作自身状态而非外部告警,这个框定本身就是 L1 的实现机制。

节流矩阵(UserPromptSubmit 事件):

| 预算占用 | 注入频率 |
|---|---|
| < 30% | 静默 |
| 30–60% | 每 10 个 turn 注 1 条 |
| 60–85% | 每 turn 注 1 条 |
| > 85% | 每 turn 注 1 条,文案升级为"我快满了:立即收敛范围、落盘中间产物,或主动请求压缩" |

PostToolUseFailure 告警:同一工具连续失败 ≥ 3 次才注入一次(与宿主 `model_anomaly` 的 repeatedToolCallWarningThreshold=3 呼应但不重复其文案),内容聚焦"同类失败我已连吃 3 次,已记入错误史;先复盘再重试"。

Critic 提醒(0.3.0):会话内 Edit/Write/ApplyPatch 等文件类工具累计改动达 `criticNudge.atEdits`(默认 10)时,**一次性**注入"收尾前要不要派 critic 对抗审查"——大改动是定稿审查的最佳触发点,只提醒一次不做打断。

### 4.4 MCP 工具(`server.mjs`,stdio)

| 工具 | 签名 | 返回 |
|---|---|---|
| `self_state` | 无参 | 当前会话快照(主会话 turn/工具/失败/预算/连败);**子代理视图为 Agent 派发计数**(C3 真机结论:子代理内部调用不触发 hook);**自我档案健康度**(0.5.0:五段完整/教训数/最后变更);跨会话复盘债;末尾附 self-model 与 playbook 路径 |
| `self_errors` | `{since?, groupBy?: "tool"\|"signature", limit?}` | 聚合错误史:按工具/错误签名分组、时间戳、最近 N 条;**慢性错误检测**(0.3.0):同签名跨 ≥3 会话复发 → 标记为习惯性问题,建议固化 playbook 规则 |
| `self_usage` | `{detail?: boolean}` | 预算对象;detail 时附 rollout 逐段估算 |
| `self_history` | `{limit?}` | **跨会话自传体记忆**(0.2.0,0.3.0 叙事化):最近 N 个会话的轮数/工具调用/失败率 + 累计统计,每会话附 Stop 留存的"最近在做"叙事片段 |
| `self_journal` | `{action: "append"\|"query", entry?, filter?}` | L2 的反思日志读写(见 §8.3);query 对超 7 天未落地的提案打 ⚠(0.5.0) |

MCP server 同时返回数据目录路径,让主 agent 知道去哪 Read/Edit self-model 与 playbook(数据目录含 marketplace 后缀,路径不稳定,**必须运行时宣告而非写死**)。

---

## 5. L2 元认知

### 5.1 技能 `skills/metacognition/SKILL.md`

frontmatter 按宿主格式(`name`/`description` ≤1024 字符/`when_to_use`),正文教学,触发时机:`when_to_use` 写明——连续工具失败后、高风险操作前、用户质疑结论时、用户要求反思时。

正文定义三个协议(模板给足,让模型可照抄):

1. **置信度自评协议**:交付非平凡结论前,列 `证据(已验证)/假设(未验证)/不知道(无法验证)` 三栏,给总分置信度(high/medium/low)+ 一句"最可能推翻我的是…"。medium 以下主动提示用户。
2. **"知道自己不知道"检查单**:逐条问自己——这个结论有没有实际验证过?引用的 API/文件/版本是我刚确认的还是凭印象?数字是测出来的还是编的?未验证项显式标注 `[未验证]`。
3. **失败复盘模板**(产出写入 `self_journal`):`发生了什么 / 我当时相信什么 / 实际是什么 / 根因 / 提炼成一条什么规则(→ 建议进哪本 playbook)`。

### 5.2 子代理 `agents/critic.md`(魔鬼代言人)

frontmatter 参照 `documents-plugin/agents/visual-judge.md` 确认过的字段:

```markdown
---
name: critic
description: 对主 agent 即将交付的方案/结论做对抗性审查。在复杂任务定稿前、或用户质疑结论时派发。只读,不改任何文件。
color: red
tools: [Read, Grep, Glob, Bash]
---
```

正文:职责是**攻击而非附和**——找未验证假设、找证据缺口、找与 self-model 教训库冲突的历史教训、给反驳清单与置信度意见。只读工具,禁止 Write/Edit。派发协议:主 agent 传"结论 + 关键证据 + 已知风险",critic 返回"反驳点列表(按杀伤力排序)+ 各点验证建议"。

### 5.3 反思日志(journal)

`self_journal` 工具落 `journal.jsonl`(schema 见 §8.3)。原则:**L2 只写、L3/L4 只读提炼**——元认知的输出不直接改行为,先沉淀为数据,再由 L4 的流程转化为规则。

---

## 6. L3 持久自我模型

### 6.1 `self/self-model.md`(五段式)

存放于 `${AOPC_PLUGIN_DATA}/self/self-model.md`,普通 Markdown,agent 用 Read/Edit 直改(无需 MCP 包一层)。**0.2.0 起骨架由插件在首次 SessionStart 自动播种**(只创建、不覆盖,内容留待复盘填充);五段结构:

```markdown
# 我是谁
(身份句:我是一个什么样的 agent;一句话,由 /reflect 定期校准)

# 我能做什么
(本段严格证据支撑,不写主观陈述——拍板 #6)
- 当前模型:(从 ListModels 的 [current] 抄录,附更新日期)
- 能力清单:(擅长的任务类型,每条附 journal 证据——"成功做过 X 次"引用条目 id)
- 明确不会/不擅长:(诚实清单,同样引用 journal 证据)

# 我的教训
- [2026-10-28] 规则一句话 ← journal#<id>(每条可追溯)
- ...

# 我与用户
- 偏好:(沟通风格、代码口味、禁忌)
- 共同历史:(做过哪些大项目,当前进行到哪)

# 我的叙事
(3–5 句,第一人称:最近在往哪个方向成长、当前对自己的评估。允许主观成长陈述——如"我对调试任务越来越有信心"——但每条须附 journal 出处或日期范围;自恋与自弃都进不来)
```

### 6.2 更新纪律(防止自我模型漂移)

- **只由复盘产出更新**:L2 失败复盘 / `/reflect` 的结论,才允许 Edit self-model;禁止在日常 turn 中随手改。
- **每条教训可追溯**:引用 journal 条目 id;无出处的教训不许写入。
- **变更留痕**:文件尾部 `## 变更记录` 追加一行(日期 + 改了哪段 + 依据哪条 journal)。
- **SessionStart 注入摘要而非全文**:观察器的自我横幅带 self-model 的 3 行摘要 + 完整路径,全文按需 Read——尊重上下文预算。

### 6.3 子代理 `agents/guanji.md`(深度自省者)

用户说"自省一下/你最近表现如何"或 /reflect 深度模式时派发。输入:session 范围。流程:读 `self_state` + `self_errors` + journal 近期条目 + (可选)`ReadSessionContext` 抽样原文 → 产出**自省报告**:本段周期内的行为模式(哪类任务慢/错得多)、与 self-model 的偏差(自以为擅长但数据不支持的项)、3 条可执行改进建议。**只读;报告由主 agent 落入反思日志**(P1 后修订:子代理对 MCP 工具的可用性未验证,保守处理,/reflect 命令已按此编排)。

---

## 7. L4 反思与自我改进

### 7.1 playbook 机制

`self/playbooks/` 存放**可自我改写的规则手册**,按主题分文件(`bash-pitfalls.md`、`planning-habits.md`、`verification-habits.md`…),每条规则带来源标注:

```markdown
- [P1][2026-11-02] 在沙箱环境跑 git 命令前先 `git status` 确认非裸仓 ← journal#j042
```

改写闭环(提案 → 审批 → 落地):
1. **提案**:复盘产出建议新规则/规则修订,先写入 journal(状态 `proposed`)。
2. **审批**:agent 用 Edit 修改 playbook 文件——**这必然触发 AOPC 的文件写入权限审批,用户在 diff 里看到每一处自我修改**;这是刻意设计:人审就是安全边界,不额外发明机制。
3. **落地**:写入后 journal 条目更新为 `landed` 并记录规则 id。

### 7.2 触发节奏

| 触发器 | 机制 | 动作 |
|---|---|---|
| 用户主动 | `/reflect` 命令(`commands/reflect.md`:深度复盘流程编排;**默认只派 guanji**,critic 仅在重要定稿或用户点名时加入——拍板 #2) | 深度复盘 → self-model + playbook 更新提案 |
| Stop hook 计数 | observer 在 state.json 记"片段数"与"失败数":**距上次复盘 ≥ 8 个片段且期间失败 ≥ 3 条**才注入一条复盘建议,顺风局静默(非 block——宿主 Stop block 有 3 次上限,观己只建议不强推) | 轻量复盘(3 分钟级):失败复盘积压清一清 |
| 会话横幅 | SessionStart 注入里带一行"上次复盘距今 N 天" | 提示,不强制 |

### 7.3 `skills/self-review/SKILL.md`

教主 agent 执行标准复盘流程:读数据(`self_state`/`self_errors`/journal)→ 归纳模式 → 产出 journal 条目 → 提出 playbook/self-model 修订 → 等待审批 → 记录落地。与 metacognition 技能的分工:metacognition 是**单次任务级**的自评/复盘,self-review 是**周期级**的跨任务复盘。

---

## 8. 数据结构

### 8.1 `state.json`(缓存,可重建)

```json
{
  "version": 1,
  "sessions": {
    "<sessionId>": {
      "startedAt": 1730500000000,
      "turns": 12,
      "toolCalls": { "Bash": 30, "Read": 18 },
      "errors": { "Bash": 3, "Edit": 1 },
      "errorStreaks": { "Bash": { "count": 2, "signature": "exit_code_1", "lastAt": 1730500100000 } },
      "budget": { "used": 124000, "window": 200000, "percent": 62, "burnRate": 3200, "confidence": "low", "source": "rollout_estimate" },
      "rolloutOffset": 837291,
      "segments": 4,
      "lastInjectedAt": { "budget": 1730500090000, "errorWarn": 0 }
    }
  },
  "reflect": { "lastDeepAt": 1730000000000, "lastLiteAt": 1730400000000 }
}
```

### 8.2 `events/<sessionId>.jsonl`(真源,append-only)

```json
{"t":1730500000000,"ev":"user_prompt","turn":12,"chars":210}
{"t":1730500001000,"ev":"tool_start","tool":"Bash","sig":"git_status"}
{"t":1730500001500,"ev":"tool_error","tool":"Bash","sig":"exit_code_1","msgHead":"fatal: not a git repository","snippetHead":"(≤2KB,已脱敏)"}
{"t":1730500500000,"ev":"segment_end","segmentsTotal":4}
{"t":1730500600000,"ev":"compact_boundary","note":"pre-compact state snapshot"}
```

### 8.3 `journal.jsonl`(L2↔L3/L4 的数据契约)

```json
{
  "id": "j042",
  "t": 1730500000000,
  "kind": "failure_postmortem | confidence_review | critic_verdict | guanji_report | playbook_proposal | playbook_landed",
  "sessionId": "sess_...",
  "title": "连续 3 次 Bash 失败后才想起来看 git 状态",
  "body": "…复盘全文…",
  "lesson": "在沙箱环境跑 git 命令前先 git status 确认非裸仓",
  "playbookTarget": "bash-pitfalls.md",
  "status": "proposed | landed | rejected",
  "refs": ["sess_cefed5a4…#turn-11"]
}
```

### 8.4 运行时数据目录总览

`${AOPC_PLUGIN_DATA}` = `~/.aopc/cli/plugins/data/selfaware@<marketplace>/`(勘察确认命名格式):

```
state.json            观察器状态缓存
events/<sid>.jsonl    事件真源(按会话分文件)
journal.jsonl         反思日志
self/
  self-model.md       自我模型(五段式 + 变更记录)
  playbooks/          可自我改写的规则手册
```

---

## 9. 事件流(四个典型时序)

**① 会话开始**
```
SessionStart(startup) → observer: 读 state.json / 建 session 桶
  → 读 self/self-model.md 头部 → 注入自我横幅(身份句 + 摘要 3 行 + 路径宣告 + 上次复盘距今 N 天)
  → agent 首轮即知道"我是谁、我的数据在哪、上下文预算怎么看"
```

**② 每次用户提交**
```
UserPromptSubmit → observer: turn++ / 增量读 rollout 更新预算
  → 节流判定:达阈值 → stdout additionalContext 注入预算行;未达 → exit 0 零开销
  → (agent 若想看细节,主动调 self_state)
```

**③ 工具失败**
```
PreToolUse(*) → observer: tool_start 计数(不注入)
PostToolUseFailure → observer: 错误签名聚入 state + events 落盘
  → 连续同类失败 < 3:静默(宿主 tool result 本身可见)
  → ≥ 3:注入一行"已记入错误史,建议先复盘再重试"(每 streak 限 1 次)
  → agent 触发 metacognition 技能 → 失败复盘模板 → self_journal append(proposed 教训)
```

**④ 会话结束 / 复盘**
```
Stop → observer: segment_end 计数
  → 满足"≥8 片段且期间 ≥3 失败":注入复盘建议(不带 block)
  → 用户 /reflect → skills/self-review 流程:读 self_state+self_errors+journal
    → (可选派 agents/guanji 深度报告 / agents/critic 对质)
    → 产出 journal 条目 → Edit self-model.md 与 playbook(AOPC 权限审批 = 人审)
    → journal 状态 landed
```

---

## 10. 插件清单与目录树

### 10.1 `.aopc-plugin/plugin.json`(草案)

```json
{
  "name": "selfaware",
  "version": "0.1.0",
  "description": "观己:给 AOPC agent 装上分层的功能性自我意识——状态感知、元认知、持久自我模型、经人审批的反思改进",
  "description_i18n": {
    "en": "selfaware: layered functional self-awareness for the AOPC agent — state perception, metacognition, a persistent self-model, and human-approved reflective improvement.",
    "zh-CN": "观己:给 AOPC agent 装上分层的功能性自我意识——状态感知、元认知、持久自我模型、经人审批的反思改进"
  },
  "author": { "name": "liuhongjian" },
  "license": "Apache-2.0",
  "mcpServers": {
    "selfaware": {
      "command": "node",
      "args": ["${AOPC_PLUGIN_ROOT}/server.mjs"]
    }
  },
  "skills": "skills",
  "agents": "agents",
  "commands": "commands"
}
```

> 字段形态对照勘察确认的清单(`contracts/src/plugins/index.ts`、desktop-pet/douyin-pilot 实例);`AOPC_PLUGIN_ROOT` / `AOPC_PLUGIN_DATA` 由宿主自动注入 MCP server 与 hook 进程 env,无需清单转写。**P1 后修订三处**:① 不声明 `hooks` 字段——`hooks/hooks.json` 是标准路径,存在即自动加载;② 三个注入开关(拍板 #3:独立开关默认全开)不走 `userConfig`——hooks 进程拿不到 `${user_config.*}`,改走 `${AOPC_PLUGIN_DATA}/config.json`(hook 与 MCP 共用、即时生效);③ userConfig 字段整体移除,待未来 MCP 侧需要配置时再启用。落地前用 `aopc plugins validate` 校验。

### 10.2 目录树

```
aopc-ai-tool/plugins/selfaware/
├── .aopc-plugin/
│   └── plugin.json
├── docs/
│   └── DESIGN.md            ← 本文档
├── hooks/
│   ├── hooks.json           ← 5 事件注册(observer,低 timeoutMs)
│   └── observer.mjs
├── lib/
│   ├── state.mjs            ← state.json 读写/原子重写
│   ├── budget.mjs           ← rollout 增量读 + 两级估算
│   └── redact.mjs           ← 脱敏(截断 + 密钥模式打码)
├── server.mjs               ← MCP stdio(self_state/self_errors/self_usage/self_journal)
├── skills/
│   ├── metacognition/SKILL.md
│   └── self-review/SKILL.md
├── agents/
│   ├── critic.md
│   └── guanji.md
├── commands/
│   ├── reflect.md
│   └── selfcheck.md          ← /selfcheck 真机自检(0.2.0;宿主按文件名注册)
└── README.md
```

marketplace 条目按 `aopc-ai-tool/.claude-plugin/marketplace.json` 现有格式追加(selfaware 0.1.0)。

---

## 11. 实施路线图

> **进度(2026-11-03)**:**v1.9.0 提案生命周期闭环 + recall 全库模式**——**177 项冒烟测试全绿**。版本轨迹:0.8.0 仪表盘 → 0.9.0 使命与图表 → 1.0.0 完全自主 → 1.1.0 自愈协议 → 1.2.0 领域无关化 → 1.3.0 无头请示落点 → 1.4.0 每日学习时刻 → 1.5.0 困难队列 → 1.6.0 经验入库 → 1.7.0 知识复利 → 1.8.0 内容实验台账 → **1.9.0 提案生命周期闭环(update 流转)+ recall 全库模式(searchScope 可选,默认 own)**。**真机里程碑:首条视频已自主发布上架,RPA 数据链路自愈升级,96 条数据定位纠偏落地。**待办:观察台账度量质量、面板视觉人工确认、P6 持续调优。

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| **P1 冒烟验证** | 一次性脚本验证 4 个行为假设:① hooks 5 事件的 stdin 字段与 additionalContext 注入生效;② rollout JSONL 可增量读、usage 字段键名;③ 插件数据目录路径解析;④ 子代理 agents/*.md 可被加载 | 每项一个可复跑脚本 + 结论记录进 docs/notes.md |
| **P2 L1** | hooks/observer + lib + server.mjs 四工具 | 跑 10 turn 会话:预算行按节流出现;self_errors 能复述刚才 3 次失败;hook 单次执行 p95 ≤ 200ms |
| **P3 L2** | metacognition 技能 + critic + journal | 一次人为制造失败:agent 走完复盘模板,journal 有 proposed 条目;critic 在定稿场景返回反驳清单 |
| **P4 L3** | self-model 初始化 + guanji + SessionStart 横幅 | 新会话横幅含 3 行摘要;教训条目均可追溯 journal id;guanji 报告指出自 model 偏差 |
| **P5 L4** | self-review 技能 + /reflect + playbook 闭环 | 一次完整复盘走通提案→审批→落地;playbook 规则带来源;第二次会话中规则被执行 |
| **P6 打磨** | 注入文案语感、节流参数调优、marketplace 条目发布 | 你日常用一周无刷屏感;卸载插件 AOPC 一切如常 |

每阶段产物都在本插件目录内;P1 若发现行为假设不成立(如 hook 对子代理事件的覆盖范围与预期不符),回改本文档再继续。

---

## 12. 风险与边界

| 风险 | 缓解 |
|---|---|
| hook 同步执行拖慢 agent(每事件新进程) | observer 无 LLM 调用、无网络请求;append-only + 增量读;per-hook timeoutMs 限低;写失败静默降级 |
| token 估算失真(字节法对中文低估 / provider 锚点缺失) | 两级估算并在输出中带 `confidence`;绝不假装精确;长期看 rollout usage 锚点为主 |
| 注入刷屏反而污染注意力 | §4.3 节流矩阵 + 每条 ≤500B + 每 turn 至多 1 条;文案克制;三个独立开关默认全开(§10.1),不想听的类目单独关 |
| 隐私:事件日志含工具 I/O 片段 | 落盘前截断 2KB + 密钥模式打码;仅存本地插件数据目录;README 明示数据位置与清理方式(删目录即净) |
| 自我模型漂移(越改越自恋/自弃) | 更新纪律(§6.2):只由复盘更新、条目可追溯、变更留痕;guanji 报告专查"自 model 与行为数据的偏差" |
| 自我修改越界 | 自我修改仅限 `${AOPC_PLUGIN_DATA}/self/` 内文件,且必经 AOPC 文件权限审批;插件自身代码目录(hooks/server)agent 无改写流程,改插件 = 正常的人工开发 |
| Stop block 机制滥用 | 观己只用 Stop 注入建议,永不用 `decision: block` 强推复盘 |
| 宿主版本演化破坏行为假设 | 设计中所有宿主行为引用均标注"勘察时点 v3.17.1";P1 冒烟脚本可随时重跑回归 |

---

## 13. 已决事项(2026-11-02 拍板)

1. **注入语感:中文第一人称**。注入是模型自读的上下文,身份一致的框定让模型把数据当作自身状态而非外部告警——框定本身就是 L1 的实现机制(§4.3 已同步)。
2. **复盘节奏:有料才提醒**。Stop 轻量复盘 = 距上次复盘 ≥8 片段且期间失败 ≥3 条,顺风局静默;`/reflect` 默认只派 guanji,critic 留给重要定稿与用户点名,避免复盘仪式化(§7.2 已同步)。
3. **开关粒度:三个独立开关,默认全开,不做总开关**。预算注入/错误告警/复盘建议打扰性质不同(信息/干预/建议),禁用插件即总开关。实现载体为 `${AOPC_PLUGIN_DATA}/config.json`——hooks 进程拿不到 `${user_config.*}`(P1 勘察),文件机制对 hook 与 MCP 同时生效(§10.1 已同步)。
4. **dynamic-workflow:暂缓**。复盘的瓶颈先是习惯不是算力,workflow 会让 /reflect 变重反而压低频率;跑一个月后若单 guanji 自省走过场,再升级为并行对质(P6 后评估)。
5. **子代理观测:合并视角,分列展示**。"我"= 主 + 子整体,`self_state` 返回 `{main, subagents}`;按 `sess_subagent_` 前缀归类,hook 覆盖范围留 P1 实测(§4.4 已同步)。
6. **哲学边界:分区处理**。「我的叙事」允许第一人称主观陈述但须附 journal 出处或日期范围;「我能做什么」严格证据支撑。自我模型有"味道",又不丢认识论纪律(§6.1 已同步)。
