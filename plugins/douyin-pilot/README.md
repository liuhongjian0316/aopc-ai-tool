# douyin-pilot

抖音账号托管助手（AOPC 插件）。**双通道架构**：

- **RPA 主通道（路线B，个人开发者可用）**：Playwright 自动操作创作者中心（`creator.douyin.com`），扫码登录一次、登录态本机持久化；支持视频发布、定时发布（平台原生），每步失败自动存现场截图。
- **官方 API 通道（需开放平台资质）**：OAuth 授权、`data.external` 数据拉取、评论管理。个人开发者主体申请敏感权限受限，资质下来后即插即用，代码已在。

配套 `douyin-manager` 托管代理与四个运营技能（数据分析 / 选题排期 / 客服回复 / 内容生产）。

## 功能矩阵

| 功能 | 工具 | 通道 |
| --- | --- | --- |
| RPA 依赖安装 | `dy_rpa_setup`（国内镜像自动装 playwright + chromium） | 本机 |
| 扫码登录 | `dy_rpa_login`（弹窗扫码，登录态存本机 profile） | RPA |
| 发布视频 | `dy_rpa_publish`（上传/标题/话题/二次确认全自动，含风控守卫） | RPA |
| 定时发布 | `dy_rpa_publish` 的 `scheduleAt`（平台原生定时，2h~10天）或 `dy_queue_add` + `dy_queue_run` 队列 | RPA |
| RPA 状态/关闭 | `dy_rpa_status`（无头探测登录态）/ `dy_rpa_close` | RPA |
| 官方 API 发布 | `dy_publish_video`（风控守卫） | API（需资质） |
| 发布队列 | `dy_queue_add` / `dy_queue_list` / `dy_queue_run`（`channel: rpa/api` 路由） | 双通道 |
| 数据分析 | `dy_account_stats` / `dy_video_list` / `dy_video_stats` / `dy_snapshot` | API（需资质） |
| 评论管理 | `dy_comment_list` / `dy_comment_reply`（敏感词拦截） | API（需资质） |
| 私信规则 | `dy_dm_rules` | Phase 2+（webhook / RPA 兜底） |

配套运营资产（安装后 AOPC 自动识别）：

- **Agent**：`douyin-manager` —— 说「帮我托管抖音账号」即可启动
- **技能**：`dy-analytics`（数据复盘）、`dy-planner`（选题排期）、`dy-reply`（评论/私信客服）、`dy-producer`（编排 AOPC 视频技能链产出成片）
- **命令**：`/douyin [status|auth|queue|data]`

## 快速开始（路线B：个人开发者，无资质要求）

### 第 1 步：安装 RPA 依赖（一次性）

对 Agent 说「安装抖音 RPA 依赖」，插件会自动在国内镜像下装 playwright + chromium；或手动：

```bash
cd <插件目录>/rpa
npm install --registry=https://registry.npmmirror.com
PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright npx playwright install chromium
```

### 第 2 步：扫码登录创作者中心

```
对 Agent 说：登录抖音创作者中心        # 调用 dy_rpa_login，弹出浏览器扫码
```

登录态保存在本机 profile（`${AOPC_PLUGIN_DATA}/douyin-pilot/rpa-profile`），长期有效，掉线再扫一次即可。

### 第 3 步：发布

```
对 Agent 说：把 douyin-works/demo.mp4 发出去，标题「xxx」，带上 #美食 #探店
# 内部执行 dy_rpa_publish；要定时就加「明天晚上7点发」
```

风控内建：单账号每日上限、最小发布间隔（插件设置里可调，`force=true` 越过）；发布过程有头可见，结束后浏览器不会强杀（`dy_rpa_close` 手动关）。

### 数据与评论（官方 API 通道）

个人开发者注册开放平台后即可创建应用调试；`video.create`/`data.external` 等权限能否获批以控制台实测为准。路径：`/douyin status` → `dy_config_set` 写入 client_key/secret → `/douyin auth` 授权。全部工具见 `dy_config_get` 的输出与 TOOLS 清单。

数据与凭证全部保存在本机 `${AOPC_PLUGIN_DATA}/douyin-pilot/`（config / accounts / queue / snapshots / dm-rules + rpa-profile / rpa-debug），不上传任何第三方。

## ⚠️ 创作者中心改版应对

RPA 依赖页面选择器，抖音改版可能失效。内置兜底：每一步失败自动截图到 `rpa-debug/`，报错信息里带截图路径——把截图喂给 Agent 即可定位新选择器，改 `rpa/worker.mjs` 对应步骤即可。选择器参考开源实现 [dreammis/social-auto-upload](https://github.com/dreammis/social-auto-upload)。

## Phase 2+ 路线

1. **私信自动回复通道**：认证企业号后申请 `im.direct_message` webhook（需执照）；个人号走创作者中心私信页 RPA 兜底（低频、拟人化）。`dy_dm_rules` 已就绪。
2. **图文发布**：创作者中心图文上传页 RPA（与视频页同构）。
3. **RPA 数据抓取**：创作者中心数据中心页面的播放/互动数据抓取，喂给 dy-analytics（API 资质下来前的过渡方案）。
4. **对标账号数据**：接入极致了数据/新抖等商业 API 做竞品监控。
5. **UI Plugin 面板**：内容日历、数据看板、私信收件箱（MCP Apps `ui.surfaces`）。
6. **分片上传**：官方 API 通道大视频分片（`upload_video_part`）。

## 风控与合规红线

- 只走创作者中心（运营后台本就是给人用的）与官方 API；**不做** App Hook、群控、批量关注/点赞、刷量
- 发布节奏有守卫；自动回复带敏感词拦截 + 频控；私信 AI 回复须声明 AI 身份
- 新账号建议先只读运行一周（只看不发）再放开发布

## 本地调试

```bash
node --check mcp-server/server.mjs      # 语法检查
node scripts/smoke-test.mjs             # 冒烟测试（握手/工具表/配置/队列/RPA 降级路径，数据用临时目录）
AOPC_PLUGIN_DATA=$(mktemp -d) node mcp-server/server.mjs   # 隔离数据目录手动调试
```
