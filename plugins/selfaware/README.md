# 观己(selfaware)

给 AOPC agent 装上**分层的功能性自我意识**:状态感知 → 元认知 → 持久自我模型 → 经人审批的反思改进。零改动 AOPC 本体,全部通过插件扩展点挂载(hooks + MCP + skills + agents + commands)。

完整设计见 [docs/DESIGN.md](docs/DESIGN.md),P1 勘察与偏差记录见 [docs/notes.md](docs/notes.md)。

## 装了之后你会得到什么

| 时机 | agent 会发生什么 |
|---|---|
| 会话开始 | 注入第一人称自我横幅:上次复盘距今、自我档案路径、工具入口;**首次挂载自动播种自我档案与 playbooks 骨架**;**把 playbook 规则聚合注入**(≤600 字符预算)——规则写下来是为了被执行 |
| 每轮对话 | 按节流注入上下文预算行("我的上下文已用约 62%…要不要收敛?"),provider 实测精度 |
| 同类工具连败 ≥3 次 | 注入一行告警,提示先复盘再重试 |
| 复盘债积累(≥8 段且 ≥3 败) | Stop 时建议跑 /reflect |
| 主动查询 | MCP 工具:`self_state` / `self_errors` / `self_usage` / `self_history`(跨会话自传体记忆) / `self_journal` |
| 技能 | `metacognition`(置信度自评/反幻觉检查单/失败复盘)、`self-review`(周期复盘流程) |
| 子代理 | `critic`(对抗性审查,只读)、`guanji`(深度自省,只读) |
| 命令 | `/reflect [lite]` — 深度复盘或清积压;`/self-check` — 真机自检(hook 注入/数据流/子代理观测/派发名逐项核对) |

## 安装

```bash
# 已有 aopc-ai-tool 市场的话,更新后直接装:
aopc plugins install selfaware@aopc-ai-tool

# 或先添加市场(支持本地目录):
aopc plugins marketplace add /path/to/aopc-ai-tool
aopc plugins install selfaware@aopc-ai-tool
```

装完**新开会话**生效(hook 配置在每个 session 启动时快照)。

## 数据与隐私

全部数据落在 `~/.aopc/cli/plugins/data/selfaware@<marketplace>/`:

```
state.json            状态缓存(可重建)
events/<sid>.jsonl    事件真源(工具名/错误签名/错误头 300 字符,prompt 只记长度)
journal.jsonl         反思日志
config.json           用户开关(见下)
self/self-model.md    自我模型(五段式)
self/playbooks/       自我改写规则手册(agent 修改必经权限审批)
```

- 事件日志**不存 prompt 正文与工具输出全文**,只存计数、签名与脱敏截断的错误头(密钥模式打码)。
- 数据只存本地;彻底清理 = 删除上面的目录。
- 卸载插件后 AOPC 一切如常,无残留钩子。

## 配置开关

编辑 `~/.aopc/cli/plugins/data/selfaware@<marketplace>/config.json`(不存在则全默认开):

```json
{
  "injectBudget": true,        // 上下文预算注入
  "injectErrorWarn": true,     // 错误连败告警
  "injectReflectNudge": true,  // 复盘债提醒
  "contextWindow": 200000,     // 模型上下文窗口(非 200k 的模型改这里)
  "budgetThrottle": { "mid": 0.3, "high": 0.6, "critical": 0.85, "midEveryTurns": 10 },
  "reflectNudge": { "minSegments": 8, "minFailures": 3 },
  "rolloutDir": ""             // 留空自动推断 ~/.aopc/cli/rollout
}
```

改动只影响新 hook 进程,即时生效,无需重启。

## 自我模型的成长路径

1. 装好后新开会话 — 骨架已自动创建(self-model + playbooks);想立即校准再跑 `/reflect`。
2. 正常干活;失败复盘与教训会自动积累进 `journal.jsonl`。
3. 复盘债提醒出现时跑 `/reflect lite` 清积压;阶段性跑 `/reflect` 修订自我模型——**修订后的 playbook 规则从下个会话开始自动进入上下文**。
4. 拿不准插件是否正常?跑 `/self-check` 逐项核对。
5. 所有自我修改(自我模型/playbook)都走文件写入审批——**人始终是守门人**。
