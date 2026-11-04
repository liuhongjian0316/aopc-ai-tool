/**
 * OpenPencil 子进程代理：spawn vendor server（stdio JSON-RPC），把它的 117 工具/资源
 * 暴露给 wudi server（进而暴露给 Agent 与工作台内嵌编辑器）。
 * 编辑器在工作台内嵌运行时，文档操作经 WS 桥直达子进程（OpenPencil 原生架构）。
 */
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vendorRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "openpencil"));
const childServerPath = join(vendorRoot, "dist", "server.mjs");

let child = null;
let pendingId = 0;
const pending = new Map();
let buffer = "";
let initDone = null;

function ensureChild(env = {}) {
  if (child) return child;
  const wsRoot = env.workspaceRoot || process.env.AOPC_PROJECT_DIR || process.cwd();
  child = spawn(process.execPath, [childServerPath], {
    env: {
      ...process.env,
      ZCODE_WORKSPACE_ROOT: wsRoot,
      ZCODE_PLUGIN_ROOT: vendorRoot,
      ZCODE_WORKSPACE_IDENTITY: wsRoot,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch { /* 忽略非 JSON */ }
    }
  });
  let childStderr = "";
  child.stderr.on("data", (d) => { childStderr += d; });
  child.on("exit", () => { child = null; initDone = null; });
  // 握手（一次性）
  initDone = request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "wudi-coding", version: "1.0" },
  }).then(() => notify("notifications/initialized"));
  return child;
}

function request(method, params) {
  ensureChild();
  const id = ++pendingId;
  const p = new Promise((res, rej) => {
    pending.set(id, { res, rej });
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); rej(new Error(`openpencil 子进程请求超时：${method}\nstderr: ${childStderr.slice(-300)}`)); }
    }, 60_000);
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p.then((r) => {
    if (r.error) throw Object.assign(new Error(r.error.message ?? "openpencil error"), { code: r.error.code });
    return r.result;
  });
}

function notify(method, params) {
  ensureChild();
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

/** 子进程工具清单（117 个，含 .fig 全套设计操作）。 */
export async function openpencilTools() {
  await initDone;
  const r = await request("tools/list", {});
  return r.tools ?? [];
}

/** 转发工具调用到 openpencil 子进程。 */
export async function openpencilCall(name, args) {
  await initDone;
  const r = await request("tools/call", { name, arguments: args ?? {} });
  return r;
}

/** 转发资源读取（ui://openpencil/*：编辑器 bundle/字体/wasm/设计稿分片）。 */
export async function openpencilReadResource(uri) {
  await initDone;
  return request("resources/read", { uri });
}

/** 子进程资源清单。 */
export async function openpencilResourcesList() {
  await initDone;
  const r = await request("resources/list", {});
  return r.resources ?? [];
}

/** 桥端点（get_design_status 的 bridge 字段：{url, token}）。 */
export async function openpencilBridgeEndpoint() {
  const r = await openpencilCall("get_design_status", {});
  const sc = r.structuredContent ?? {};
  return sc.bridge ?? null;
}

// 预热：server 启动即 spawn 子进程并完成握手（消除首次工具调用的冷启动超时）
try { ensureChild(); } catch (e) { console.error('[wudi] OpenPencil 预热失败:', e.message); }

export function openpencilServerPath() {
  return childServerPath;
}
