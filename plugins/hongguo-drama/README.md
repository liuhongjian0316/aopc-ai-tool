# hongguo-drama（红果短剧 AOPC 插件）

把开源的[红果短剧桌面版](https://github.com/jackotom/hongguo-drama)（GPL-3.0）接入 AOPC：**Agent 可以搜索短剧、解析分集、提交下载、查询进度**；完整 UI（播放、下载管理、追剧、设置）由独立 Electron 运行壳承载，关窗后下载继续。

## 架构

```
AOPC 会话
  └─ mcp-server/server.mjs（MCP stdio 薄代理，无第三方依赖）
       ├─ 解析/缓存 Electron 44.9.1 运行时到 <AOPC_PLUGIN_DATA>/electron-cache/
       ├─ spawn 运行壳（无头），stdout 握手 AOPC_HONGGUO_READY port=… token=…
       └─ runtime.json 单实例握手：版本一致复用旧壳，不一致重启
            └─ runtime/（vendor 自 hongguo-drama 5.3.0 的 Electron 运行壳）
                 ├─ main.js（原业务逻辑 + [AOPC] 补丁）
                 ├─ aopc-bridge.js（127.0.0.1 HTTP 桥，token 鉴权 + IPC 白名单）
                 └─ dist-react/（原前端构建产物）
```

- 运行壳生命周期独立于 MCP server：会话结束/插件禁用后**下载继续**；`hongguo_quit` 显式退出。
- 数据目录 `<AOPC_PLUGIN_DATA>/app-data`，与用户自装的正式版红果短剧**完全隔离、可并存**。
- 应用内更新已禁用，随插件市场更新。

## MCP 工具

| 工具 | 说明 |
|---|---|
| `hongguo_search {keyword}` | 搜索短剧，返回 seriesId 候选 |
| `hongguo_resolve {query}` | 分享链接/seriesId → 完整分集列表 |
| `hongguo_download {seriesId\|query, episodes?, quality?}` | 提交下载；episodes 支持 `all`/`3`/`[1,2]`/`"1,3,5-8"`（1 起始） |
| `hongguo_status` | 队列与任务进度（标题/集数/状态/百分比/失败原因），按需拉起运行壳 |
| `hongguo_panel_status` | 轻量状态查询，**不拉起运行壳**（面板轮询专用） |
| `hongguo_library` | 本地剧库 |
| `hongguo_control {action, taskId?}` | pause / resume / stop / retry |
| `hongguo_open` / `hongguo_hide` | 唤出/隐藏完整 UI 窗口 |
| `hongguo_quit` | 退出运行壳（自动暂停未完成任务并保存） |

典型链路：`hongguo_search` → `hongguo_download`（seriesId）→ `hongguo_status` 轮询 → `hongguo_open` 看结果。

## 侧栏面板（UI Plugin）

manifest 声明 `ui.surfaces`（id `hongguo`，资源 `ui://hongguo-drama/panel.html`），AOPC 桌面本地工作区的会话侧栏会出现「红果短剧」面板：

- **下载任务**：进度条 + 状态徽标 + 已下载/总大小；失败任务一键重试、进行中任务一键停止；每 4 秒轻量轮询（`hongguo_panel_status`，壳未运行时不会拉起）
- **我的剧库**：渐变字母占位卡片 + 集数（面板 CSP 不允许远程封面图，完整封面看窗口）；点击卡片打开窗口
- **头部控制**：打开窗口 / 暂停全部 / 恢复全部 / 退出运行壳；运行壳状态灯
- 主题跟随宿主（暗/亮）；基于官方 `@modelcontextprotocol/ext-apps` 握手，自包含单文件 HTML（662 KiB）

面板构建：`npm install && npm run build:panel`（产物 `dist/ui/panel.html` 随插件分发）。

## 首次运行

1. 插件安装后首次调用任意工具时，自动下载 Electron 44.9.1（~110MB）缓存到插件数据目录；GitHub 失败自动回退 npmmirror，也可用环境变量 `AOPC_HONGGUO_ELECTRON_MIRROR` 指定镜像。
2. 下载目录默认 `<AOPC_PLUGIN_DATA>/downloads`，可在 userConfig `downloadDir` 或窗口设置页修改。
3. ffmpeg：合并/转码功能探测 PATH 上的 ffmpeg（`brew install ffmpeg`），未装时仅下载与在线播放可用。

## userConfig

| 项 | 默认 | 说明 |
|---|---|---|
| `downloadDir` | "" | 下载目录，空 = 插件数据目录 downloads/；改动后 `hongguo_quit` 重启运行壳生效 |
| `autoStart` | false | 会话创建即后台拉起运行壳（无窗口） |
| `electronPath` | "" | 显式指定 Electron 可执行文件 |

## 开发调试

```bash
# 环境变量 AOPC_HONGGUO_DEBUG=1 打印握手细节；AOPC_HONGGUO_ELECTRON 指定本机 Electron
# 同工作区有 hongguo-drama 克隆或 AOPC 仓库时，自动复用其 node_modules 里的 Electron，无需下载
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | AOPC_PLUGIN_DATA=/tmp/hg-data node mcp-server/server.mjs

# 单独跑运行壳（无头）
AOPC_HONGGUO_RUNTIME=1 AOPC_PLUGIN_DATA=/tmp/hg-data AOPC_HONGGUO_HEADLESS=1 \
  /path/to/electron runtime/

# 重建面板（改 src/ui/ 后）
npm install && npm run build:panel
```

## 维护：同步上游

`runtime/` 业务代码 vendor 自上游，所有改动带 `// [AOPC]` 标记（清单见 `NOTICE.md`）。升级上游版本：

```bash
# 1. 准备上游克隆（或更新已有克隆到目标 tag）
git -C /path/to/hongguo-drama fetch --tags && git -C /path/to/hongguo-drama checkout vX.Y
# 2. 一键同步：复制文件 → 回放 8 条 AOPC 补丁 → 语法/标记校验 → 重建 axios vendor → 原子落盘
node scripts/sync-upstream.mjs --source /path/to/hongguo-drama
# 3. 按脚本输出的清单收尾：升 plugin.json 版本、跑冒烟、aopc plugins update
```

脚本特性：全程在 `.sync-staging` 进行，**补丁锚点失配（上游重构）会明确报错中止**，现有 runtime 不受影响；同基础版本保留 `-aopc.N` 后缀，上游版本号变化则重置为 `-aopc.1`。补丁定义集中在 `scripts/sync-upstream.mjs` 的 `PATCHES` 数组，上游改了对应代码段时人工比对该处、更新 find/replace 即可。

## 许可

- 本插件承载的上游代码遵循 **GPL-3.0**（见 `LICENSE`、`NOTICE.md`）。
- 不是红果、西饭或河马的官方客户端，未获平台官方背书；不提供付费分集解锁。剧集、清晰度和可用范围取决于来源平台。
