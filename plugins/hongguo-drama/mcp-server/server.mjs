/**
 * hongguo-drama MCP stdio server。
 *
 * 职责：把 MCP 工具调用转发给红果短剧 Electron 运行壳的本地 HTTP 桥；运行壳不在时负责拉起。
 * 运行壳自持全部业务逻辑（解析/搜索/下载队列/播放/UI），本进程只是薄代理，
 * 因此 MCP server 重启不会打断下载队列（单实例握手复用既有运行壳）。
 *
 * Electron 运行时解析顺序：
 *   1. 环境变量 AOPC_HONGGUO_ELECTRON（显式指定可执行文件）
 *   2. 同工作区开发态：向上 5 层找 hongguo-drama 克隆与 AOPC 仓库的 node_modules electron
 *   3. 插件数据目录缓存 <AOPC_PLUGIN_DATA>/electron-cache/（首次自动下载，GitHub 失败回退 npmmirror）
 */
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.AOPC_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const CACHE_DIR = join(DATA_DIR, "electron-cache");
mkdirSync(DATA_DIR, { recursive: true });

// UI 面板资源（.aopc-plugin/plugin.json 的 ui.surfaces[].resourceUri）
const PANEL_URI = "ui://hongguo-drama/panel.html";
const PANEL_MIME = "text/html;profile=mcp-app";
let panelHtmlCache = null;
function readPanelHtml() {
  if (!panelHtmlCache) {
    panelHtmlCache = readFileSync(join(PLUGIN_ROOT, "dist", "ui", "panel.html"), "utf-8");
  }
  return panelHtmlCache;
}

const DEBUG = !!process.env.AOPC_HONGGUO_DEBUG;
function log(msg) {
  process.stderr.write(`[hongguo-drama] ${msg}\n`);
}

// ---------------------------------------------------------------- MCP 工具面
const TOOLS = [
  {
    name: "hongguo_open",
    description: "打开/聚焦红果短剧窗口（完整 UI：搜索、播放、下载管理、设置都在窗口里）。后台下载不受窗口开关影响",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hongguo_hide",
    description: "隐藏红果短剧窗口（后台继续下载）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hongguo_search",
    description: "搜索红果短剧（关键词）。返回候选剧集列表（seriesId/标题），用于后续 hongguo_download",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "剧名关键词" },
      },
      required: ["keyword"],
    },
  },
  {
    name: "hongguo_resolve",
    description: "解析一部剧的完整分集列表。query 支持红果分享链接或数字 seriesId（可从 hongguo_search 结果获得）",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "红果分享链接或 seriesId" },
      },
      required: ["query"],
    },
  },
  {
    name: "hongguo_download",
    description: "提交整剧或指定集数的下载任务。用 hongguo_search/hongguo_resolve 拿到 seriesId 后调用；进度用 hongguo_status 查询",
    inputSchema: {
      type: "object",
      properties: {
        seriesId: { type: "string", description: "数字 seriesId（推荐，跳过解析）" },
        query: { type: "string", description: "红果分享链接（没有 seriesId 时用这个）" },
        episodes: {
          description: "下载哪些集：'all' 全部（默认）；或 1 起始的集号，如 3、[1,2,3]、'1,3,5-8'",
        },
        quality: { type: "string", description: "清晰度，如 1080p/720p，默认 auto" },
      },
    },
  },
  {
    name: "hongguo_status",
    description: "查询下载队列：活跃/排队数，以及每个任务的标题、集数、状态、进度、失败原因（调用会按需拉起运行壳）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hongguo_panel_status",
    description: "轻量查询下载器状态：不拉起运行壳（侧栏面板轮询专用）。返回 running 与任务摘要；未运行时 running=false",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hongguo_library",
    description: "列出本地剧库（已登记的剧集档案与分集总数）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "hongguo_control",
    description: "控制下载任务：pause 暂停全部 / resume 恢复全部 / stop 停止单个 / retry 重试单个（stop/retry 需要 taskId，从 hongguo_status 获取）",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["pause", "resume", "stop", "retry"] },
        taskId: { type: "string" },
      },
      required: ["action"],
    },
  },
  {
    name: "hongguo_quit",
    description: "退出红果短剧运行壳（会暂停未完成下载并保存状态，下次启动自动续跑）",
    inputSchema: { type: "object", properties: {} },
  },
];

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}
function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

// ---------------------------------------------------------------- Electron 运行时解析
const ELECTRON_VERSION = "44.9.1"; // 与红果 5.3 开发依赖同版本
const ELECTRON_BIN = {
  darwin: "Electron.app/Contents/MacOS/Electron",
  win32: "electron.exe",
  linux: "electron",
}[process.platform] ?? "electron";

function devElectronCandidates() {
  // 同工作区开发场景：aopc-ai-tool 与 hongguo-drama 克隆 / AOPC 仓库并列（向上最多 5 层）
  const candidates = [process.env.AOPC_HONGGUO_ELECTRON];
  let dir = PLUGIN_ROOT;
  for (let i = 0; i < 5; i++) {
    dir = dirname(dir);
    candidates.push(join(dir, "hongguo-drama", "node_modules", "electron", "dist", ELECTRON_BIN));
    candidates.push(join(dir, "AOPC", "node_modules", "electron", "dist", ELECTRON_BIN));
  }
  candidates.push(join(CACHE_DIR, "electron", "dist", ELECTRON_BIN));
  candidates.push(join(CACHE_DIR, "electron", ELECTRON_BIN)); // macOS zip 顶层即 Electron.app
  return candidates.filter(Boolean);
}

function resolveElectron() {
  for (const candidate of devElectronCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let downloadInFlight = null;
async function downloadElectron() {
  if (downloadInFlight) return downloadInFlight;
  downloadInFlight = (async () => {
    const cached = resolveElectron();
    if (cached && cached.includes(CACHE_DIR)) return cached;
    const plat = { darwin: "darwin", win32: "win32", linux: "linux" }[process.platform] ?? process.platform;
    const arch = { arm64: "arm64", x64: "x64" }[process.arch] ?? process.arch;
    const zipName = `electron-v${ELECTRON_VERSION}-${plat}-${arch}.zip`;
    const zipPath = join(CACHE_DIR, zipName);
    mkdirSync(CACHE_DIR, { recursive: true });
    if (!existsSync(zipPath)) {
      const urls = [
        process.env.AOPC_HONGGUO_ELECTRON_MIRROR
          ? `${process.env.AOPC_HONGGUO_ELECTRON_MIRROR.replace(/\/$/, "")}/v${ELECTRON_VERSION}/${zipName}`
          : null,
        `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${zipName}`,
        `https://npmmirror.com/mirrors/electron/v${ELECTRON_VERSION}/${zipName}`,
      ].filter(Boolean);
      let lastError = null;
      let ok = false;
      for (const url of urls) {
        try {
          log(`downloading Electron runtime: ${url}`);
          const res = await fetch(url, { redirect: "follow" });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          await pipeline(res.body, createWriteStream(zipPath));
          ok = true;
          break;
        } catch (error) {
          lastError = error;
          log(`download failed (${url}): ${error?.message ?? error}`);
          try { rmSync(zipPath, { force: true }); } catch (_) {}
        }
      }
      if (!ok) throw new Error(`electron download failed: ${lastError?.message ?? lastError}`);
    }
    const extractTo = join(CACHE_DIR, "electron");
    const alreadyExtracted = devElectronCandidates().some((c) => c.includes(CACHE_DIR) && existsSync(c));
    if (!alreadyExtracted) {
      rmSync(extractTo, { recursive: true, force: true });
      mkdirSync(extractTo, { recursive: true });
      log("extracting…");
      execFileSync(process.platform === "win32" ? "powershell" : "unzip", [
        ...(process.platform === "win32"
          ? ["-NoProfile", "-Command", `Expand-Archive -Force '${zipPath}' '${extractTo}'`]
          : ["-q", zipPath, "-d", extractTo]),
      ]);
    }
    const resolved = devElectronCandidates().find((c) => c.includes(CACHE_DIR) && existsSync(c));
    if (!resolved) throw new Error("electron extracted but binary not found");
    if (process.platform !== "win32") execFileSync("chmod", ["+x", resolved]);
    return resolved;
  })();
  try {
    return await downloadInFlight;
  } finally {
    downloadInFlight = null;
  }
}

// ---------------------------------------------------------------- 运行壳生命周期
let runtime = null; // { child, port, token }

function runtimeStateFile() {
  return join(DATA_DIR, "runtime.json");
}
function readRuntimeState() {
  try {
    return JSON.parse(readFileSync(runtimeStateFile(), "utf-8"));
  } catch {
    return {};
  }
}
function writeRuntimeState(state) {
  try {
    writeFileSync(runtimeStateFile(), JSON.stringify(state, null, 2));
  } catch (error) {
    log(`write runtime state failed: ${error?.message ?? error}`);
  }
}

// 对运行壳 HTTP 桥的底层请求：node:http 硬超时 + 响应体必收尾（避免 undici 排队卡死）
function runtimeRequest(port, token, pathname, { timeoutMs = 2000, method = "GET", body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === null || body === undefined ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          "x-aopc-hongguo-token": token,
          ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf-8") }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout ${timeoutMs}ms`)));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function probeRuntime(port, token) {
  try {
    const res = await runtimeRequest(port, token, "/health", { timeoutMs: 900 });
    return res.status === 200;
  } catch {
    return false;
  }
}

const PLUGIN_MANIFEST = JSON.parse(readFileSync(join(PLUGIN_ROOT, ".aopc-plugin", "plugin.json"), "utf-8"));
const RUNTIME_VERSION = PLUGIN_MANIFEST.version;

async function fetchRuntimeVersion(port, token) {
  const res = await runtimeRequest(port, token, "/version", { timeoutMs: 900 });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body || "{}").pluginVersion ?? null;
}

async function ensureRuntime() {
  // 0) 本进程已拉起且活着 → 直接复用
  if (runtime && (await probeRuntime(runtime.port, runtime.token))) return runtime;
  // 1) 既有运行壳活着（单实例握手）且插件版本一致 → 直接复用
  const saved = readRuntimeState();
  if (saved.apiPort && saved.apiToken) {
    const alive = await probeRuntime(saved.apiPort, saved.apiToken);
    if (DEBUG) log(`ensure: saved=${saved.apiPort} alive=${alive}`);
    if (alive) {
      const version = await fetchRuntimeVersion(saved.apiPort, saved.apiToken).catch(() => null);
      if (version === RUNTIME_VERSION) {
        runtime = { child: null, port: saved.apiPort, token: saved.apiToken };
        return runtime;
      }
      log(`runtime version mismatch (${version ?? "unknown"} != ${RUNTIME_VERSION}), restarting`);
      await runtimeRequest(saved.apiPort, saved.apiToken, "/quit", { timeoutMs: 2000, method: "POST" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  // 2) 拉起 Electron 运行壳（无头启动，hongguo_open 唤出窗口）
  let electronBin = resolveElectron();
  if (!electronBin) {
    log("no local electron found, downloading runtime…");
    electronBin = await downloadElectron();
  }
  const child = spawn(electronBin, [join(PLUGIN_ROOT, "runtime")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      AOPC_HONGGUO_RUNTIME: "1",
      AOPC_HONGGUO_HEADLESS: process.env.AOPC_HONGGUO_HEADLESS ?? "1",
      AOPC_PLUGIN_ROOT: PLUGIN_ROOT,
      AOPC_PLUGIN_DATA: DATA_DIR,
      AOPC_HONGGUO_PLUGIN_VERSION: RUNTIME_VERSION,
    },
  });
  child.stderr.on("data", (d) => process.stderr.write(d));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("runtime ready timeout (60s)")), 60000);
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString();
      const m = buf.match(/AOPC_HONGGUO_READY port=(\d+) token=([0-9a-f]+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ port: Number(m[1]), token: m[2] });
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      runtime = null;
      reject(new Error(`runtime exited early code=${code}`));
    });
  });
  if (DEBUG) log(`spawning runtime: ${electronBin}`);
  const { port, token } = await ready;
  runtime = { child, port, token };
  // 运行壳的 aopc-bridge 也会写 runtime.json；这里再写一次保持双端一致
  writeRuntimeState({ apiPort: port, apiToken: token, pid: child.pid, pluginVersion: RUNTIME_VERSION, startedAt: new Date().toISOString() });
  log(`runtime ready port=${port}`);
  return runtime;
}

async function fetchApi(pathname, { method = "GET", body, timeoutMs = 10000 } = {}) {
  const res = await fetch(`http://127.0.0.1:${runtime.port}${pathname}`, {
    method,
    headers: { "content-type": "application/json", "x-aopc-hongguo-token": runtime.token },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// 白名单 IPC 通道调用
async function ipc(channel, ...args) {
  const data = await fetchApi(`/ipc/${encodeURIComponent(channel)}`, {
    method: "POST",
    body: { args },
    timeoutMs: 35000,
  });
  return data?.result;
}

// ---------------------------------------------------------------- 工具实现
function summarizeTasks(list) {
  const arr = Array.isArray(list) ? list : [];
  return {
    total: arr.length,
    tasks: arr.slice(0, 40).map((t) => ({
      taskId: t?.id,
      title: t?.title || t?.hongguoInfo?.series_title || "",
      episode: t?.hongguoInfo?.vid_index,
      status: t?.status,
      percent: typeof t?.progress === "number" ? t.progress : undefined,
      receivedBytes: t?.receivedBytes,
      totalBytes: t?.totalBytes,
      filename: t?.filename,
      error: t?.error || "",
    })),
  };
}

function summarizeSearch(result) {
  const results = Array.isArray(result?.results) ? result.results : [];
  return {
    success: result?.success !== false,
    channel: result?.channel || "",
    count: results.length,
    results: results.slice(0, 15).map((item) => ({
      seriesId: String(item?.series_id ?? ""),
      title: item?.series_title || item?.title || "",
      cover: item?.cover || "",
    })).filter((item) => item.seriesId && item.title),
    hint: "用 hongguo_download 的 seriesId 参数提交下载",
  };
}

function summarizeResolve(result) {
  if (result?.success === false) return result;
  const data = result?.data ?? {};
  const episodes = Array.isArray(data.episodes) ? data.episodes : [];
  return {
    success: true,
    seriesId: String(data.series_id ?? ""),
    title: data.series_title || "",
    totalEpisodes: episodes.length,
    firstEpisode: episodes[0]?.title || episodes[0]?.ep_title || "",
    hint: "把 seriesId 和 title 传给 hongguo_download 提交下载",
  };
}

// 'all' | 3 | [1,2,3] | '1,3,5-8' → 按 1 起始序号展开为分集对象数组
function selectEpisodes(episodes, selector) {
  const total = episodes.length;
  if (selector === undefined || selector === "all") return { picked: episodes.slice() };
  let indexes = [];
  if (typeof selector === "number") indexes = [selector];
  else if (Array.isArray(selector)) indexes = selector.map(Number);
  else if (typeof selector === "string") {
    for (const part of selector.split(",")) {
      const range = /^(\d+)\s*[-~]\s*(\d+)$/.exec(part.trim());
      if (range) {
        for (let i = Number(range[1]); i <= Number(range[2]); i++) indexes.push(i);
      } else if (part.trim()) indexes.push(Number(part.trim()));
    }
  } else throw new Error("episodes 参数格式不支持：用 'all'、集号、集号数组或 '1,3,5-8'");
  if (indexes.some((n) => !Number.isInteger(n) || n < 1 || n > total)) {
    throw new Error(`集号超出范围（1-${total}）`);
  }
  const unique = [...new Set(indexes)].sort((a, b) => a - b);
  return { picked: unique.map((n) => episodes[n - 1]) };
}

// 这两个工具不拉起运行壳：panel_status 是面板轮询专用（壳未跑就返回 running=false），
// quit 在壳未跑时直接返回成功——都不能为了查询/退出先 spawn 一个 Electron。
const NO_SPAWN_TOOLS = new Set(["hongguo_panel_status", "hongguo_quit"]);

async function callTool(name, args) {
  if (!NO_SPAWN_TOOLS.has(name)) await ensureRuntime();
  switch (name) {
    case "hongguo_open":
      return fetchApi("/show", { method: "POST", body: {}, timeoutMs: 15000 });
    case "hongguo_hide":
      return fetchApi("/hide", { method: "POST", body: {} });
    case "hongguo_search":
      return summarizeSearch(await ipc("search-series", String(args.keyword ?? "").trim(), {}));
    case "hongguo_resolve":
      return summarizeResolve(await ipc("hongguo-resolve", String(args.query ?? "").trim()));
    case "hongguo_download": {
      const sid = String(args.seriesId ?? args.query ?? "").trim();
      if (!sid) throw new Error("需要 seriesId 或 query（分享链接）参数");
      const resolved = await ipc("hongguo-resolve", sid);
      if (resolved?.success === false) throw new Error(resolved.error || "解析失败");
      const data = resolved?.data;
      if (!data || !Array.isArray(data.episodes) || !data.episodes.length) throw new Error("未解析到任何分集");
      const { picked } = selectEpisodes(data.episodes, args.episodes);
      const payload = {
        seriesId: data.series_id,
        seriesTitle: data.series_title,
        episodes: picked,
        ...(args.quality ? { quality: args.quality } : {}),
      };
      const result = await ipc("hongguo-download-batch", payload);
      if (result?.success === false) throw new Error(result.error || "提交下载失败");
      return {
        success: true,
        title: data.series_title,
        seriesId: data.series_id,
        submitted: result?.count ?? picked.length,
        requested: picked.length,
        hint: "用 hongguo_status 查询进度；下载文件在设置指定的目录（默认插件数据目录 downloads/）",
      };
    }
    case "hongguo_status": {
      const [queue, tasks] = await Promise.all([ipc("get-queue-status"), ipc("get-download-tasks")]);
      return { queue, ...summarizeTasks(tasks) };
    }
    case "hongguo_panel_status": {
      // 轻量路径：只探活既有运行壳，绝不 spawn（面板轮询专用）
      const saved = readRuntimeState();
      if (!saved.apiPort || !saved.apiToken) return { running: false };
      if (!(await probeRuntime(saved.apiPort, saved.apiToken))) return { running: false };
      try {
        const ipcCall = (channel) => runtimeRequest(saved.apiPort, saved.apiToken, `/ipc/${encodeURIComponent(channel)}`, {
          method: "POST",
          body: JSON.stringify({ args: [] }),
          timeoutMs: 5000,
        });
        const [queueRes, tasksRes] = await Promise.all([ipcCall("get-queue-status"), ipcCall("get-download-tasks")]);
        const queue = queueRes.status === 200 ? JSON.parse(queueRes.body || "{}")?.result ?? null : null;
        const tasks = tasksRes.status === 200 ? JSON.parse(tasksRes.body || "{}")?.result ?? [] : [];
        return { running: true, queue, ...summarizeTasks(tasks) };
      } catch (error) {
        return { running: true, error: `查询队列失败: ${error?.message ?? error}` };
      }
    }
    case "hongguo_library": {
      const list = await ipc("get-series-list", {});
      const arr = Array.isArray(list) ? list : [];
      return {
        count: arr.length,
        series: arr.slice(0, 30).map((s) => ({
          seriesId: String(s?.series_id ?? ""),
          title: s?.series_title || "",
          totalEpisodes: Array.isArray(s?.episodes) ? s.episodes.length : undefined,
          cover: s?.cover || "",
        })),
      };
    }
    case "hongguo_control": {
      const { action, taskId } = args ?? {};
      switch (action) {
        case "pause":
          return ipc("pause-all");
        case "resume":
          return ipc("resume-all");
        case "stop":
          if (!taskId) throw new Error("stop 需要 taskId（hongguo_status 获取）");
          return ipc("stop-download", taskId);
        case "retry":
          if (!taskId) throw new Error("retry 需要 taskId（hongguo_status 获取）");
          return ipc("retry-task", taskId);
        default:
          throw new Error(`未知 action: ${action}`);
      }
    }
    case "hongguo_quit": {
      // 不经 ensureRuntime（见 NO_SPAWN_TOOLS）：凭 runtime.json 找到活壳就退出，否则无事可做
      if (!runtime || !(await probeRuntime(runtime.port, runtime.token))) {
        const saved = readRuntimeState();
        if (saved.apiPort && saved.apiToken && (await probeRuntime(saved.apiPort, saved.apiToken))) {
          runtime = { child: null, port: saved.apiPort, token: saved.apiToken };
        } else {
          return { ok: true, running: false };
        }
      }
      const result = await fetchApi("/quit", { method: "POST", body: {} }).catch((e) => ({ ok: false, error: e?.message }));
      runtime = null;
      return result;
    }
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------- stdio 主循环
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (line) handleMessage(line).catch((e) => log(`handle error: ${e?.message ?? e}`));
  }
});
process.stdin.on("end", () => process.exit(0));

async function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: "hongguo-drama", version: RUNTIME_VERSION },
    });
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "tools/list") return send(id, { tools: TOOLS });
  if (method === "resources/list") {
    return send(id, {
      resources: [{ uri: PANEL_URI, name: "红果短剧面板", mimeType: PANEL_MIME }],
    });
  }
  if (method === "resources/templates/list") {
    return send(id, { resourceTemplates: [] });
  }
  if (method === "resources/read") {
    const uri = params?.uri;
    if (uri !== PANEL_URI) return sendError(id, -32602, `未知资源: ${uri}`);
    try {
      return send(id, { contents: [{ uri: PANEL_URI, mimeType: PANEL_MIME, text: readPanelHtml() }] });
    } catch (error) {
      return sendError(id, -32603, `读取面板资源失败: ${error?.message ?? error}`);
    }
  }
  if (method === "tools/call") {
    const name = params?.name;
    try {
      const result = await callTool(name, params?.arguments ?? {});
      return send(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 1).slice(0, 12000) }],
      });
    } catch (error) {
      log(`tool ${name} failed: ${error?.message ?? error}`);
      return send(id, {
        content: [{ type: "text", text: `工具执行失败：${error?.message ?? error}` }],
        isError: true,
      });
    }
  }
  if (id !== undefined) sendError(id, -32601, `Unknown method: ${method}`);
}

log(`mcp server started root=${PLUGIN_ROOT} data=${DATA_DIR}`);
// autoStart（userConfig.autoStart，默认 false）：会话创建即拉起运行壳（无头），下载与追剧更早开始。
// 默认关闭：首次工具调用才拉起，避免每个会话都常驻一个 Electron。
const AUTO_START = ["1", "true"].includes(String(process.env.AOPC_HONGGUO_AUTO_START ?? "false").toLowerCase());
if (AUTO_START) {
  ensureRuntime().catch((e) => log(`auto start failed: ${e?.message ?? e}`));
}
// 运行壳生命周期独立于本进程：会话结束/插件禁用后下载继续，
// 显式退出走 hongguo_quit 工具。单实例握手保证不会堆积多个运行壳。
