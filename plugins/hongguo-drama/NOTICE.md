# NOTICE

## 红果短剧运行壳（runtime/）

本插件的 `runtime/` 目录改编自开源项目 [jackotom/hongguo-drama](https://github.com/jackotom/hongguo-drama) v5.7.0（"红果短剧桌面版"，源码预发标签 v5.7，正式版为 v5.6），遵循 **GPL-3.0** 许可证分发。原作者版权声明见 `LICENSE`。

### 改动清单（相对上游 5.7.0）

| 位置 | 改动 |
|---|---|
| `runtime/main.js` | 数据目录跟随 `AOPC_PLUGIN_DATA`（与独立安装版隔离）；`AOPC_HONGGUO_HEADLESS=1` 时窗口隐藏启动；`window-all-closed` 下不退出（后台续下）；应用内更新检查禁用（更新走插件市场）；IPC 包装器把 handler 登记进 `aopcIpcRegistry` 供 HTTP 桥调用；启动时拉起 `aopc-bridge` |
| `runtime/aopc-bridge.js` | 新增文件：本地回环 HTTP API（token 鉴权 + IPC 白名单 + READY 握手行） |
| `runtime/vendor/axios.cjs` | 新增文件：axios 1.20.0 的 esbuild 单文件打包（插件分发不携带完整 node_modules） |
| `runtime/node_modules/axios/` | 新增 stub：把 `require('axios')` 重定向到 vendor 单文件包 |
| `runtime/package.json` | 改名 `hongguo-aopc-runtime`，版本 `5.7.0-aopc.1` |
| 移除 | `src/native/licenses/`（许可证文本，本文件与 LICENSE 覆盖）；渲染层 React 源码（构建产物 `dist-react/` 已随包） |

上游其余业务代码（解析、下载引擎、解密、合并、UI）未做逻辑改动。

### 相关项目

- 上游项目：https://github.com/jackotom/hongguo-drama （GPL-3.0，本插件基于 v5.7.0）
- 本插件不是红果、西饭或河马的官方客户端，未获平台官方背书；不提供付费分集解锁。
- axios（MIT）：以 esbuild 打包内嵌于 `runtime/vendor/axios.cjs`。
