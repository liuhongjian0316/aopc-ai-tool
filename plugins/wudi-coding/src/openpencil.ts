// @ts-nocheck —— 由 JS 迁移（tools/store/ssh/figma/notify/openpencil 为动态工具实现，类型逐步收紧；入口 src/server.ts 全量检查）
/**
 * OpenPencil 子进程代理（多项目根）：每个工作区根一个 stdio 子进程，
 * 把它的 117 工具/资源暴露给 wudi server（进而暴露给 Agent 与工作台内嵌编辑器）。
 * 编辑器在工作台内嵌运行时，文档操作经 WS 桥直达子进程（OpenPencil 原生架构）。
 */
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const vendorRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "openpencil"));
const childServerPath = join(vendorRoot, "dist", "server.mjs");

/** 默认根：与 store.projectRoot() 同根序。 */
export function defaultWorkspaceRoot() {
  return resolve(process.env.AOPC_PROJECT_DIR || process.env.AOPC_WORKSPACE_ROOT || process.cwd());
}

const children = new Map(); // root -> child state

function createState(root) {
  return {
    root,
    child: null,
    pendingId: 0,
    pending: new Map(),
    stderr: "",
    buffer: "",
    initDone: null,
  };
}

function ensureChild(root) {
  const key = resolve(root || defaultWorkspaceRoot());
  let st = children.get(key);
  if (!st) { st = createState(key); children.set(key, st); }
  if (st.child) return st;
  try {
    st.child = spawn(process.execPath, [childServerPath], {
      env: {
        ...process.env,
        ZCODE_WORKSPACE_ROOT: st.root,
        ZCODE_PLUGIN_ROOT: vendorRoot,
        ZCODE_WORKSPACE_IDENTITY: st.root,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    console.error("[wudi] OpenPencil spawn 失败:", err.message);
    st.child = null;
    return st;
  }
  st.child.stdout.setEncoding("utf-8");
  st.child.stdout.on("data", (chunk) => {
    st.buffer += chunk;
    let idx;
    while ((idx = st.buffer.indexOf("\n")) >= 0) {
      const line = st.buffer.slice(0, idx).trim();
      st.buffer = st.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && st.pending.has(msg.id)) {
          const res = st.pending.get(msg.id);
          st.pending.delete(msg.id);
          res(msg);
        }
      } catch { /* 忽略非 JSON */ }
    }
  });
  st.child.stderr.on("data", (d) => { st.stderr += d; });
  st.child.on("exit", (code) => {
    console.error(`[wudi] OpenPencil 子进程退出 root=${st.root} code=` + code);
    st.child = null;
    st.initDone = null;
  });
  st.initDone = request(st, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "wudi-coding", version: "1.0" },
  }).then(() => notify(st, "notifications/initialized"));
  return st;
}

function request(st, method, params) {
  ensureChild(st.root);
  if (!st.child) return Promise.reject(new Error("OpenPencil 子进程未启动"));
  const id = ++st.pendingId;
  const p = new Promise((res, rej) => {
    st.pending.set(id, res); // 存 resolver 本身：stdout 分发处按 pending.get(id)(msg) 调用
    setTimeout(() => {
      if (st.pending.has(id)) { st.pending.delete(id); rej(new Error(`openpencil 子进程请求超时：${method}\nstderr: ${st.stderr.slice(-300)}`)); }
    }, 60_000);
  });
  st.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p.then((r) => {
    if (r.error) throw Object.assign(new Error(r.error.message ?? "openpencil error"), { code: r.error.code });
    return r.result;
  });
}

function notify(st, method, params) {
  ensureChild(st.root);
  st.child?.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

/** 子进程工具清单（117 个，含 .fig 全套设计操作）。 */
export async function openpencilTools(root = undefined) {
  const st = ensureChild(root);
  await st.initDone;
  const r = await request(st, "tools/list", {});
  return r.tools ?? [];
}

/** 转发工具调用到对应项目根的 openpencil 子进程。 */
export async function openpencilCall(root = undefined, name, args = undefined) {
  const st = ensureChild(root);
  await st.initDone;
  return request(st, "tools/call", { name, arguments: args ?? {} });
}

/** 转发资源读取（ui://openpencil/*：编辑器 bundle/字体/wasm/设计稿分片）。 */
export async function openpencilReadResource(root = undefined, uri) {
  const st = ensureChild(root);
  await st.initDone;
  return request(st, "resources/read", { uri });
}

/** 子进程资源清单。 */
export async function openpencilResourcesList(root = undefined) {
  const st = ensureChild(root);
  await st.initDone;
  const r = await request(st, "resources/list", {});
  return r.resources ?? [];
}

/** 桥端点（get_design_status 的 bridge 字段：{url, token}）。 */
export async function openpencilBridgeEndpoint(root = undefined) {
  const r = await openpencilCall(root, "get_design_status", {});
  const sc = r.structuredContent ?? {};
  return sc.bridge ?? null;
}

/** 带缓存的桥端点（面板资源 CSP 声明用，30s TTL；按根分别缓存）。 */
const _epCache = new Map(); // root -> { at, value }
export async function openpencilBridgeEndpointCached(root = undefined) {
  const key = resolve(root || defaultWorkspaceRoot());
  const cur = _epCache.get(key);
  if (cur && Date.now() - cur.at < 30_000) return cur.value;
  try {
    const ep = await openpencilBridgeEndpoint(key);
    _epCache.set(key, { at: Date.now(), value: ep });
    return ep;
  } catch {
    _epCache.set(key, { at: Date.now(), value: null });
    return null;
  }
}

// 预热默认根（消除首次工具调用的冷启动超时）
try { ensureChild(defaultWorkspaceRoot()); } catch (e) { console.error("[wudi] OpenPencil 预热失败:", e.message); }

export function openpencilServerPath() {
  return childServerPath;
}
