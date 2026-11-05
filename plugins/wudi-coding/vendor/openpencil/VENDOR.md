# openpencil（vendor 自官方插件：源码 + 构建环境 + 预构建运行时）

- **上游仓库**：[zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins/tree/main/ui-plugins/openpencil)
- **版本**：0.3.2（上游 commit `0cc58d6`）
- **License**：MIT（上游 © 作者；运行时第三方闭包见 `dist/THIRD_PARTY_NOTICES.txt`）

## 目录（与官方 monorepo 1:1 对应）

| 路径 | 官方对应 | 说明 |
| --- | --- | --- |
| `ui-plugins/openpencil/` | `ui-plugins/openpencil` | **源码 + 构建环境**：`package.json`（Node ≥ 24）、`src/`（MCP server）、`ui/`（Vue 编辑器）、`scripts/`（esbuild 打包 + 上游源码按 SHA-256 下载）、`tsconfig` / `vitest` |
| `external_plugins/openpencil/` | `external_plugins/openpencil` | 官方打包骨架：`LICENSE`、`licenses/`（构建时并入 notices）、`.zcode-plugin/plugin.json`、`skills/design` |
| `dist/` | 构建产物 | **预构建运行时**（`dist/server.mjs` + `dist/ui/*`），wudi server 直接 spawn，面板经 `ui://openpencil/panel.html` 加载 |
| `tools-static.json` | —（wudi 自产） | 117 个工具定义缓存 |

## 从源码重建 dist（已验证可用）

布局与官方 monorepo 一致，构建脚本的 `../../node_modules/.cache` 与 `dist/../../../external_plugins` 相对路径可直接解析：

```bash
cd vendor/openpencil/ui-plugins/openpencil
npm install
npm run build     # Node ≥ 24；esbuild 打包 server + 编辑器；自动下载上游 open-pencil 源码（revision 见 scripts/upstream.mjs）
```

产物落在 `ui-plugins/openpencil/dist/`（与官方一致，被该目录 `.gitignore` 忽略）。运行时使用的是 vendor 根的 `dist/`：如需替换，`cp -R ui-plugins/openpencil/dist/. ../dist/` 后 `git add -f dist`。

## wudi 集成方式

- `lib/openpencil-runtime.mjs`：spawn `dist/server.mjs`（stdio JSON-RPC），117 工具/资源经 wudi server 代理给 Agent 与工作台；
- 工作台设计页：编辑器以 iframe **srcdoc** 注入（loader 经 `ui://openpencil/panel.html` 资源取回，资产走 MCP 资源管线）；`canvaskit.wasm` 与字体由面板注入的 fetch 补丁转回资源管线（srcdoc 不透明源下编辑器同源拦截器失效）。
