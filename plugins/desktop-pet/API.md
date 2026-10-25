# desktop-pet HTTP API

宿主运行壳监听 `http://127.0.0.1:<port>`（端口写入 `<AOPC_PLUGIN_DATA>/runtime.json`，同字段含 `apiToken`）。
所有非静态请求需带 `x-aopc-pet-token: <apiToken>`。MCP 工具与下列端点一一对应；本文件即 openapi 速览。

## 状态

- `GET /state?since=&timeout=` — 全量状态快照（叶子 `{counter,data}`；`since+timeout` 成对长轮询，timeout ≤ 10000ms）
  - `sections.workStatus` `{state, at}`；`sections.config` 纯信号（变了重拉 `/config`）；`sections.notify` 预留
  - `pets.<id>.say` `{kind:'say',text,image?,url?,duration?}` / `{kind:'clear'}`
  - `pets.<id>.anim` `{name|url, facing?, once}`；`pets.<id>.lock` `{locked, expiresAt}`
- `GET /pose` — 全部宠物实时 `{x,y,facing,vx,vy}`（包围盒左上角，工作区 px）
- `GET /config` / `POST /reload` — 配置读取 / 热重载

## 驱动

- `POST /work-status` `{state: thinking|working|result|waiting|success|error|clear, text?}`
- `POST /say`（= `/broadcast`）`{pet?, text, image?, url?, duration?, anim?}` — 气泡（可选配图/联动动画）
- `POST /bubble/clear` `{pet?}`
- `POST /whisper` `{pet?, text?}` — 碎碎念（缺省从短语池抽）
- `POST /anim` `{pet?, name|url, facing?}` — 点播动画（name/url 恰好一个）
- `POST /position` `{pet?, x, y, mode?: instant|spring|line}`
- `POST /throw` `{pet?, angle(度,0=正右,逆时针正), power?(1.0≈1200px/s 软钳前)}`
- `POST /lock` `{pet?, seconds}` / `POST /lock/release` `{pet?}`
- `POST /balance` `{pet?, percent(0-100), text?}` — 余额档位动画
- `POST /notify` `{title?, text}` — 系统通知
- `POST /open-url` `{url}` — http(s) only
- `POST /pet-display` `{pet?, display: desktop|none}`

## 第三方菜单

- `POST /menu/item` `{owner(≤64), items:[{id,label}](≤20)}` — 该 owner 整体覆盖
- `DELETE /menu/item?owner=`
- `GET /menu/events?owner=&wait=` — 读取点击事件（读取即消费；wait ≤ 10000ms 长轮询）

## 静态素材

- `GET /pack/<pack>/webm/<动画名>.webm`（无鉴权；`.mov` 同路径规则，macOS 回落）

## 生命周期

- `GET /quit` — 探活（单实例握手用）
- `POST /quit` — 退出运行壳
- `POST /debug/click` `{pet?}` — 测试专用：向渲染端注入一次鼠标点击（绕过 OS 事件权限）
