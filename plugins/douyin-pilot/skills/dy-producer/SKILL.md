---
name: dy-producer
description: 编排 AOPC 内置视频生成技能产出抖音成片，并衔接发布队列。当用户要求生成抖音视频/把选题做成作品时使用。
---

# 抖音内容生产线

把 dy-planner 排期的选题做成可直接发布的成片。AOPC 自带的视频技能链就是生产车间，按内容形式选路径：

## 路径选择

| 内容形式 | 技能链 |
| --- | --- |
| 口播讲解/知识类 | `general-video`（脚本→成片）或 `talking-head-recut`（真人素材剪辑） |
| 图文轮播/清单类 | `slideshow` + `imagegen`（配图） |
| 动效/数据可视化 | `motion-graphics` 或 `hyperframes` |
| 音乐卡点/氛围类 | `music-to-video` |
| 字幕 | `embedded-captions`（抖音完播率对字幕敏感，竖版视频默认都加） |

## 生成规格（抖音适配）

- 竖版 9:16，1080×1920；时长：引流款 ≤25s，干货款 40~60s
- 开头 3 秒必须有钩子（直接说结论/反常识），结尾引导互动但不引导站外
- 音量对齐 -14 LUFS 左右，避免爆音

## 与发布衔接

1. 成片输出到工作区固定目录（建议 `douyin-works/YYYY-MM-DD-选题名.mp4`）
2. **个人账号（路线B）**：调 `dy_rpa_publish`（videoPath + title + tags；定时用 scheduleAt，须晚于当前 2 小时）。首次使用前确认 RPA 依赖已装（`dy_rpa_status`）、已扫码登录（`dy_rpa_login`）
3. **有开放平台资质的账号**：走 `dy_publish_video`（官方 API）；立即发布的频控不满足时（返回提示要等 N 分钟），改用 `dy_queue_add` 排到下一个流量高峰时段
4. 发布后 48h 用 dy-analytics 复盘该条数据，反馈给下一条的选题/形式

## 注意

- 批量生产时保持封面/开头风格统一，账号才有记忆点。
- 生成的视频先给用户过目再发（默认不静默发布）。
