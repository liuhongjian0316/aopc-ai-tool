/**
 * wudi-coding —— AOPC 插件 MCP stdio server（最小实现：initialize / tools/list / tools/call / resources）。
 * 零依赖。工具逻辑在 src/tools.ts，项目状态在 src/store.ts（项目根 .wudi/），SSH 执行在 src/ssh.ts；
 * 工作台面板（构建产物 dist/ui/panel.html）以 ui:// 资源分发（text/html;profile=mcp-app，MCP App 规范）。
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TOOLS, callTool, bridgeConnectDomains, frameDomains, fontCdnDomains, opWsProxyUrl } from "./tools";
import { ensureWudiDir, ensureProfileAt, migrateDesignsFor, projectRoot } from "./store";

// 进程级兜底：任何未捕获错误都不能杀掉 server（宿主连接断开的根因）
process.on("uncaughtException", (err) => console.error("[wudi] uncaught:", err.message));
process.on("unhandledRejection", (err) => console.error("[wudi] unhandled:", String(err).slice(0, 300)));
import { openpencilTools, openpencilCall, openpencilReadResource, openpencilResourcesList, openpencilBridgeEndpointCached } from "./openpencil";
import { readFileSync as _rf } from "node:fs";
import { join as _join, dirname as _dn } from "node:path";
import { fileURLToPath as _fURL } from "node:url";
const _vendorDir = _join(_dn(_dn(_fURL(import.meta.url))), "vendor", "openpencil");
let opToolsCache = (() => {
  try { return JSON.parse(_rf(_join(_vendorDir, "tools-static.json"), "utf-8")); }
  catch { return []; }
})(); // 静态工具定义（117 个），后台动态刷新

const SERVER_INFO = { name: "wudi-coding", version: "0.40.1" };

/* 只要插件被使用：自动创建 .wudi/ 与最小项目档案（不再有「未建档」状态） */
try {
  ensureWudiDir();
  ensureProfileAt(projectRoot());
  migrateDesignsFor(projectRoot()); // 旧 designs/ 画布迁入 .wudi/<项目>/designs/
} catch { /* 只读工作区等场景降级 */ }
const PANEL_URI = "ui://wudi-coding/panel.html";
const PANEL_MIME = "text/html;profile=mcp-app";
const panelPath = resolve(join(dirname(fileURLToPath(import.meta.url)), "ui", "panel.html"));

function readPanel() {
  if (!existsSync(panelPath)) {
    throw new Error(`面板文件缺失：${panelPath}（先运行 scripts/build-panel.mjs）`);
  }
  return readFileSync(panelPath, "utf-8");
}

/* ---- 动态设计资源：项目 .wudi/design/ 下的设计稿 HTML 与 PNG 暴露为 ui:// 资源 ---- */

const designRoot = () => resolve(join(process.env.AOPC_WORKSPACE_ROOT || process.cwd(), ".wudi", "design"));

/** 安全解析资源名：只允许纯文件名（防路径穿越），并限制在 design 子目录内。 */
function safeDesignFile(kind, name) {
  if (!/^[\w.-]+$/.test(name)) throw new Error(`非法资源名：${name}`);
  const dir = resolve(designRoot(), kind === "mockup" ? "mockups" : "figma");
  const file = resolve(dir, name);
  if (!file.startsWith(dir + "/") || !existsSync(file)) throw new Error(`资源不存在：${kind}/${name}`);
  return file;
}

function listDesignResources() {
  const out = [];
  const scan = (sub, kind, mime) => {
    try {
      for (const f of readdirSync(join(designRoot(), sub))) {
        if (!/\.(html|png)$/.test(f)) continue;
        out.push({
          uri: `ui://wudi-coding/${kind}/${f}`,
          name: f,
          title: f,
          mimeType: mime,
          description: kind === "mockup" ? "UI 设计稿（HTML）" : "设计图（PNG）",
        });
      }
    } catch { /* 目录不存在 */ }
  };
  scan("mockups", "mockup", "text/html");
  scan("figma", "image", "image/png");
  scan("renders", "image", "image/png"); // DesignCraft 等外部设计工具的渲染 PNG
  return out;
}

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

let buffer = "";
let inFlight = 0;
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) handleMessage(line);
  }
});
// stdin 关闭后等在途调用完成再退出（部署等长任务不能被提前杀掉）；兜底 10 分钟强制退出。
process.stdin.on("end", () => {
  const timer = setInterval(() => {
    if (inFlight <= 0) {
      clearInterval(timer);
      process.exit(0);
    }
  }, 50);
  setTimeout(() => process.exit(0), 600_000).unref();
});

function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    send(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {}, resources: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "resources/list") {
    send(id, {
      resources: [
        {
          uri: PANEL_URI,
          name: "无敌编程工作台",
          title: "无敌编程工作台",
          description: "项目档案、SSH 状态、部署历史与健康检查、文档库、内嵌设计画布",
          mimeType: PANEL_MIME,
          // 宿主对「内容项无 _meta」的兜底读取路径（resources/list 项级）
          _meta: {
            ui: {
              csp: {
                connectDomains: [...bridgeConnectDomains(), ...fontCdnDomains()],
                resourceDomains: fontCdnDomains(),
                frameDomains: frameDomains(),
              },
            },
          },
        },
        ...listDesignResources(),
      ],
    });
    return;
  }
  if (method === "resources/read") {
    const uri = params?.uri ?? "";
    try {
      if (uri === PANEL_URI) {
        // 面板内嵌 OpenPencil 编辑器：srcdoc 加载（宿主契约允许子帧 srcdoc，不受 frame-src 限制）。
        // 编辑器需 ①直连 openpencil 子进程的 WS 桥（独立随机端口）②wasm/eval 能力 —— 都在资源 _meta 声明。
        // 桥端点探测最多等 800ms，避免拖慢面板挂载（拿到后 30s 缓存）。
        Promise.race([
          openpencilBridgeEndpointCached().catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 800)),
        ]).then((ep) => {
          const connect = [...bridgeConnectDomains()];
          if (ep?.url) {
            try {
              const opOrigin = new URL(ep.url).origin; // ws://127.0.0.1:<port>
              connect.push(opOrigin, opOrigin.replace(/^ws:/, "http:"));
            } catch { /* 端点格式异常则忽略 */ }
          }
          const meta = {
            ui: {
              csp: {
                connectDomains: [...new Set([...connect, ...fontCdnDomains()])],
                resourceDomains: fontCdnDomains(),
                frameDomains: frameDomains(),
              },
            },
            "aopc/csp": { wasmUnsafeEval: true, unsafeEval: true },
          };
          send(id, {
            contents: [{ uri: PANEL_URI, mimeType: PANEL_MIME, text: readPanel(), _meta: meta }],
            _meta: meta,
          });
        }).catch((err) => sendError(id, -32603, `面板资源读取失败：${String(err?.message ?? err).slice(0, 200)}`));
        return;
      }
      if (uri.startsWith("ui://openpencil/")) {
        // 资源按项目根寻址：面板在非当前项目上下文读资源时带 ?wudiRoot=<项目根>
        let cleanUri = uri;
        let root = "";
        try {
          const u = new URL(uri);
          const r = u.searchParams.get("wudiRoot");
          if (r) { root = r; u.search = ""; cleanUri = u.toString(); }
        } catch { /* 非法 URI 交由子进程报错 */ }
        openpencilReadResource(root || undefined, cleanUri)
          .then((result) => send(id, result))
          .catch((err) => sendError(id, -32602, `OpenPencil 资源读取失败：${String(err?.message ?? err).slice(0, 200)}`));
        return;
      }
      const m = uri.match(/^ui:\/\/wudi-coding\/(mockup|image)\/([\w.-]+)$/);
      if (!m) {
        sendError(id, -32602, `未知资源：${uri}（可用：${PANEL_URI} 或设计资源）`);
        return;
      }
      const file = safeDesignFile(m[1], m[2]);
      if (m[1] === "mockup") {
        send(id, { contents: [{ uri, mimeType: "text/html", text: readFileSync(file, "utf-8") }] });
      } else {
        const b64 = readFileSync(file).toString("base64");
        send(id, { contents: [{ uri, mimeType: "image/png", blob: b64 }] });
      }
    } catch (err) {
      sendError(id, -32603, `读取资源失败：${String(err?.message ?? err).slice(0, 300)}`);
    }
    return;
  }
  if (method === "tools/list") {
    openpencilTools().then((t) => { opToolsCache = t; }).catch(() => {});
    send(id, { tools: [...TOOLS, ...opToolsCache] });
    return;
  }
  if (method === "tools/call") {
    inFlight++;
    const toolName = params?.name ?? "";
    const isWudiTool = TOOLS.some((t) => t.name === toolName);
    const callPromise = isWudiTool
      ? callTool(toolName, params?.arguments ?? {})
      : (() => {
          // 画布集中存储在工作区 .wudi/<项目>/designs/，openpencil 子进程固定工作区根
          return openpencilCall(undefined, toolName, params?.arguments ?? {}).then((r) => {
            const sc = r.structuredContent;
            // 编辑器 WS 端点统一改写成 wudi 桥反代（任意项目根的端口都在 CSP 允许的桥 origin 下）
            if (toolName === "get_design_status" && sc?.bridge?.url) {
              sc.bridge = { ...sc.bridge, url: opWsProxyUrl(sc.bridge.url) };
            }
            return {
              content: (r.content ?? []).map((c) => ({ type: "text", text: c.text ?? "" })),
              isError: !!r.isError,
              structuredContent: sc,
            };
          });
        })();
    callPromise
      .then((result) => send(id, result))
      .catch((err) => sendError(id, -32603, `工具内部错误：${String(err?.message ?? err).slice(0, 500)}`))
      .finally(() => {
        inFlight--;
      });
    return;
  }
  if (method === "ping") {
    send(id, {});
    return;
  }
  sendError(id, -32601, `方法未实现：${method}`);
}
