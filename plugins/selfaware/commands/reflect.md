---
description: 观己复盘:汇总自我状态/错误史/反思日志,清复盘债并修订自我模型(深度模式派 guanji 子代理)
argument-hint: "[lite](默认深度:派 guanji 子代理出报告并全面修订;lite 只清积压不重写模型)"
---

按观己(selfaware)插件的 self-review 技能执行一次复盘。参数:$ARGUMENTS

## 执行规则

**默认(深度模式,无参数或参数非 lite)**:

1. 数据采集:依次调 `self_state`、`self_errors`、`self_journal`(action=query);读 `self/self-model.md` 与 `self/playbooks/` 现状。
2. 派发子代理:用 Agent 工具派发 `guanji`(若该名不可用则试 `selfaware:guanji`),把数据目录路径传给它;等它的自省报告。子代理不可用时,自己按 self-review 技能的框架完成归纳,并在结果里注明"单代理自省"。
3. 落地三件套(见 self-review 技能"产出"节):
   - `self_journal` append(guanji 报告原文作 body,kind=guanji_report);
   - 按报告的偏差结论,用 Edit 修订 `self/self-model.md`(含尾部「变更记录」追加,依据 journal id);
   - 把可执行建议落成 playbook 规则(`self/playbooks/<主题>.md`,格式 `- [P1][日期] 规则 ← journal#<id>`)。所有 Edit 走正常权限审批。
4. 向用户汇报:偏差结论 + 本次改了哪些文件 + 改动依据。

**lite 模式(参数为 lite)**:

跳过子代理,只做"清积压":查 journal 里 proposed 未落地的条目与近期失败,把 lesson 落进对应 playbook;有 failure_postmortem 积压就逐条补记;不动「我的叙事」。最后一句汇报落地了哪些规则。

## 纪律

- 全程遵守 self-review 技能的"纪律"节:可追溯、不越界、不自夸。
- 若观己数据全空(如刚安装),改为完成首次初始化:创建 `self/self-model.md` 五段式骨架(我是谁/我能做什么/我的教训/我与用户/我的叙事,内容从本会话能观察到的事实起笔,没把握的留空待补)与 `self/playbooks/README.md`(说明用途与格式),并告知用户。
