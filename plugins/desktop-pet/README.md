# desktop-pet — AOPC 桌面宠物

透明置顶悬浮宠物窗，带完整物理交互与 Agent 联动。**功能复刻自 [dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（MIT）**，架构面向 AOPC 插件体系重写；物理与随机链直接移植其 `src/shared` 纯逻辑层，手感与上游严格一致（见 [NOTICE.md](NOTICE.md)）。

## 功能清单（与 dsh-pet 对照）

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 透明置顶悬浮窗、跳过任务栏、全工作区可见 | ✅ | 一窗一宠（dsh 同款） |
| 点击穿透（光标进身体才可交互，主进程指针轮询兜底） | ✅ | |
| 拖拽弹簧跟手 + 甩抛（初速估算/软钳速/死区） | ✅ | 移植 `shared/physics.ts` |
| 弹弓（双击按住拖，力度=拉距、方向=拉的反方向） | ✅ | |
| 抛物飞行 + 边缘反弹 + 落地 Q 弹挤压 | ✅ | 多屏「空洞是墙」语义一致 |
| 宠物互撞 | ✅ | 宿主仲裁 + `collidePet` 冲量 |
| 多开多宠物、宠物包（pet pack） | ✅ | 默认使用 **dsh 官方素材包**（`packs/dsh/`，106 个透明 webm 动画 + 表情包 + 点击音效，出处与素材条款见 NOTICE）；另有零素材的 `builtin` 程序化包兜底 |
| 随机动画链（idle/turn/move/分类权重、镜像、fixedEnabled） | ✅ | 移植 `pickers.ts` |
| 多屏漫游 + 显示器拓扑变化守恒重定位 | ✅ | |
| 右键菜单（动作点播[事件项中文：工作状态/碎碎念/余额]/立即碎碎念/回到初始位置/重载配置并重启宠物/第三方「更多」/隐藏） | ✅ | 原生 Menu |
| 工作状态六档（thinking/working/result/waiting/success/error）+ 气泡文案 + 终态自动回落 | ✅ | MCP 工具 / HTTP 驱动 |
| 碎碎念（定时短语池 + Agent 点播 + 联动动画） | ✅ | AOPC 版默认不调 LLM：聊天/碎碎念由会话 Agent 通过 `pet_say`/`pet_whisper` 生成（等价替代 dsh 的内置 LLM 调用） |
| 系统通知（窗口失焦场景） | ✅ | `pet_notify` |
| 托盘（逐宠显示/隐藏切换、重载配置、退出） | ✅ | 菜单栏常驻图标 |
| 余额档位动画 | ✅（框架） | dsh 的 DeepSeek/OpenCode 轮询是 DSH 专属；AOPC 版保留档位动画与接口，由外部驱动 |
| 第三方菜单注册 + HTTP API（长轮询） | ✅ | 端点清单见 `API.md` |
| 配置三层合并 + 热重载 + 位置持久化 | ✅ | 内置默认 ← 数据目录 config.jsonc ← pack 配置 |
| 悬浮名字提示 + 原版抓取光标 | ✅ | 悬浮宠物显示名字胶囊（贴光标、自动翻边）；拖拽光标用 dsh 官方 cursor 图 |
| prefers-reduced-motion | ✅ | 减少自主移动 |
| DSH Cordis 服务 | ➖ | 由 MCP 工具 + HTTP API 替代 |

## 使用

安装后新建会话即自动出现宠物（`autoStart` 可关）。对 Agent 说人话即可：

- "让宠物庆祝一下" → `pet_anim`
- "宠物说'编译完成啦'" → `pet_say`
- "开始干活了，让宠物进入工作状态" → `pet_work_status working`
- "把宠物抛上天" → `pet_throw`

直接交互：点击 Q 弹、按住拖拽、快速甩出抛掷、双击按住拖=弹弓、右键菜单、右键拖出窗口外甩飞。

## 配置

数据目录 `<AOPC_PLUGIN_DATA>/config.jsonc`（整段覆盖同名顶层键；`pets` 按 id 合并）。常用：

```jsonc
{
  "pets": [{ "id": "duoduo", "display": "none" }],              // 隐藏内置宠物
  "pets": [{ "id": "mypet", "name": "小鲸", "pack": "dsh", "size": 180, "display": "desktop",
             "position": { "corner": "bottom-left", "marginX": 40, "marginY": 30 } }],
  "confineToScreen": true,                                       // 锁定单屏
  "whisperPhrases": ["记得喝水哦"]                                // 覆盖碎碎念池
}
```

视频素材包放 `packs/<名>/webm/`（文件名=动画名），可从 dsh-pet 官方素材导入：`node scripts/sync-dsh-pack.mjs <assets 目录>`。

## 架构

```
mcp-server/server.mjs   MCP stdio：工具面 → 转发 Electron 宿主 HTTP API；负责运行壳拉起/复用/运行时下载
runtime/main.cjs        Electron 宿主：多窗管理、状态存储、多屏几何、右键菜单、
                        碎碎念/工作状态调度、持久化、127.0.0.1 HTTP API（token 鉴权）
runtime/renderer/       渲染端：双缓冲动画引擎（webm 视频 / 内置 canvas）、物理循环（rAF）、
                        拖拽/甩抛/弹弓交互、气泡、漫游
shared/                 移植自 dsh-pet 的纯逻辑层（物理/几何/随机链/工作状态），esbuild 打包为 dist
```
