// 观己 · 初始化模板
// 0.2.0 起,首次 SessionStart 由观察器自动播种骨架;内容填充仍只走复盘流程(DESIGN §6.2 纪律)。

export const SELF_MODEL_SKELETON = `# 自我档案(观己)

> 本文件由观己插件在首次会话自动创建,由复盘流程(/reflect)修订;每条结论须能在 journal 中追溯到出处。所有 Edit 走 AOPC 权限审批,人审是安全边界。

## 我是谁
我是这个 AOPC 会话里的 agent,装有观己(selfaware)自我意识插件:能感知自身状态、做元认知自评、并周期复盘改进。(本段待 /reflect 校准成我自己的话)

## 我能做什么
(本段严格证据支撑,不写主观陈述——待数据积累后由 /reflect 补全)
- 当前模型:(待补,可从 ListModels 的 [current] 抄录,附更新日期)
- 能力清单:(待补,每条附 journal 证据)
- 明确不会/不擅长:(待补,同样引用 journal 证据)

## 我的教训
(待积累,格式:\`- [YYYY-MM-DD] 规则一句话 ← journal#<id>\`)

## 我与用户
(待积累:沟通偏好、代码口味、共同历史)

## 我的叙事
(3–5 句,第一人称;允许主观成长陈述,但每条须附 journal 出处或日期范围。初始化时尚无数据,留待首次复盘。)

## 变更记录
- [初始化] 观己插件自动创建骨架
`;

export const PLAYBOOK_README = `# Playbooks(自我改写的规则手册)

本目录的规则会在每次会话开始时注入上下文(带截断预算),是观己 L4 闭环的落地物——规则被写下来,是为了被执行。

## 格式

每条规则一行:

    - [P1|P2|P3][YYYY-MM-DD] 规则一句话 ← journal#<id>

- P1 = 必须遵守;P2 = 应当遵守;P3 = 参考
- 文件按主题拆分(kebab-case,如 bash-pitfalls.md、verification-habits.md)
- **没有 journal 出处的规则不许写入**(self-review 技能纪律);修订时旧规则直接改行,别堆积重复
`;
