/**
 * desktop-pet MCP stdio server。
 *
 * 职责：把 MCP 工具调用转发给 Electron 运行壳的本地 HTTP API；运行壳不在时负责拉起。
 * 运行壳自持全部宿主逻辑（窗口/状态/菜单/托盘/HTTP API），本进程只是薄代理，
 * 因此 MCP server 重启不会打断宠物显示（单实例握手复用既有运行壳）。
 *
 * Electron 运行时解析顺序：
 *   1. 环境变量 AOPC_PET_ELECTRON（显式指定）
 *   2. AOPC 仓库 node_modules 的开发态 Electron（同工作区开发场景）
 *   3. 插件数据目录缓存 <AOPC_PLUGIN_DATA>/electron-cache/（首次自动从 GitHub Releases 下载）
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = process.env.AOPC_PLUGIN_DATA || join(PLUGIN_ROOT, ".data");
const CACHE_DIR = join(DATA_DIR, "electron-cache");
mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------- MCP 最小实现
const TOOLS = [
  { name: "pet_list", description: "列出全部桌面宠物及其显示状态", inputSchema: { type: "object", properties: {} } },
  {
    name: "pet_show",
    description: "在桌面显示宠物（透明置顶悬浮窗）",
    inputSchema: { type: "object", properties: { pet: { type: "string", description: "宠物 id，缺省 = 第一只" } } },
  },
  { name: "pet_hide", description: "隐藏宠物窗口", inputSchema: { type: "object", properties: { pet: { type: "string" } } } },
  {
    name: "pet_say",
    description: "让宠物说一句话（头顶气泡）。想让它有性格地聊天，直接用本工具说人话即可",
    inputSchema: {
      type: "object",
      properties: {
        pet: { type: "string" },
        text: { type: "string", description: "要说的话" },
        duration: { type: "number", description: "气泡展示毫秒数，默认 10000，0 = 常驻" },
      },
      required: ["text"],
    },
  },
  {
    name: "pet_whisper",
    description: "让宠物碎碎念一句（不传 text 则从配置短语池随机抽），并播放碎碎念动画",
    inputSchema: { type: "object", properties: { pet: { type: "string" }, text: { type: "string" } } },
  },
  {
    name: "pet_anim",
    description: "点播一个动画（name = 配置里的动画名，如 待机/点击弹跳/庆祝/思考…；或给 url 播外部视频）",
    inputSchema: {
      type: "object",
      properties: {
        pet: { type: "string" },
        name: { type: "string" },
        url: { type: "string" },
        facing: { type: "string", enum: ["left", "right"] },
      },
    },
  },
  {
    name: "pet_work_status",
    description: "设置工作状态动画（六档，语义同 dsh-pet）：thinking/working/result/waiting/success/error；clear 恢复空闲。Agent 干活时切 working、出错切 error 等",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["thinking", "working", "result", "waiting", "success", "error", "clear"] },
        text: { type: "string", description: "可选：覆盖该档位的默认气泡文案" },
      },
      required: ["state"],
    },
  },
  {
    name: "pet_balance",
    description: "余额档位动画（percent 0-100 决定档位；AOPC 版不自动轮询任何账户，仅由本工具/接口驱动）",
    inputSchema: {
      type: "object",
      properties: { pet: { type: "string" }, percent: { type: "number" }, text: { type: "string" } },
      required: ["percent"],
    },
  },
  {
    name: "pet_move",
    description: "移动宠物到绝对屏幕坐标（工作区 px，包围盒左上角）",
    inputSchema: {
      type: "object",
      properties: {
        pet: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        mode: { type: "string", enum: ["instant", "spring", "line"] },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "pet_throw",
    description: "把宠物抛出去（angle 度，0=正右、逆时针为正、90=向上；power 1.0 ≈ 1200px/s，同拖拽甩抛手感）",
    inputSchema: {
      type: "object",
      properties: { pet: { type: "string" }, angle: { type: "number" }, power: { type: "number" } },
      required: ["angle"],
    },
  },
  {
    name: "pet_lock",
    description: "冻结宠物（暂停随机动画链与自主漫游），seconds 后自动解除",
    inputSchema: { type: "object", properties: { pet: { type: "string" }, seconds: { type: "number" } } },
  },
  { name: "pet_unlock", description: "解除冻结", inputSchema: { type: "object", properties: { pet: { type: "string" } } } },
  { name: "pet_pose", description: "读取所有宠物实时位置/朝向/速度", inputSchema: { type: "object", properties: {} } },
  { name: "pet_reload_config", description: "重载配置文件（config.jsonc / pack 配置）", inputSchema: { type: "object", properties: {} } },
  {
    name: "pet_open_url",
    description: "用系统浏览器打开网址",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "pet_notify",
    description: "弹一条系统通知（走宠物通知通道）",
    inputSchema: { type: "object", properties: { title: { type: "string" }, text: { type: "string" } }, required: ["text"] },
  },
  {
    name: "pet_menu_item",
    description: "注册宠物右键菜单「更多」分组项（owner 隔离，整体覆盖式更新）；用户点击后用 pet_menu_events 读取（读取即消费）",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "注册方标识（≤64 字符）" },
        items: {
          type: "array",
          items: { type: "object", properties: { id: { type: "string" }, label: { type: "string" } }, required: ["id", "label"] },
        },
      },
      required: ["owner", "items"],
    },
  },
  {
    name: "pet_menu_events",
    description: "读取宠物右键菜单点击事件（owner 维度，读取即消费；wait=长轮询秒数）",
    inputSchema: {
      type: "object",
      properties: { owner: { type: "string" }, wait: { type: "number" } },
      required: ["owner"],
    },
  },
];

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}
function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
function log(msg) {
  process.stderr.write(`[desktop-pet] ${msg}\n`);
}

// ---------------------------------------------------------------- Electron 运行时解析
function devElectronCandidates() {
  const exe = {
    darwin: "dist/Electron.app/Contents/MacOS/Electron",
    win32: "dist/electron.exe",
    linux: "dist/electron",
  }[process.platform] ?? "dist/electron";
  // 同工作区开发场景：aopc-ai-tool 与 AOPC 仓库并列（向上最多找 5 层）
  const candidates = [process.env.AOPC_PET_ELECTRON];
  let dir = PLUGIN_ROOT;
  for (let i = 0; i < 5; i++) {
    dir = dirname(dir);
    candidates.push(join(dir, "AOPC", "node_modules", "electron", exe));
  }
  candidates.push(join(CACHE_DIR, "electron", exe));
  return candidates.filter(Boolean);
}

function resolveElectron() {
  for (const candidate of devElectronCandidates()) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const ELECTRON_VERSION = "33.4.11"; // LTS 稳定版；下载缓存到插件数据目录
let downloadInFlight = null;
async function downloadElectron() {
  if (downloadInFlight) return downloadInFlight;
  downloadInFlight = (async () => {
    const cached = resolveElectron();
    if (cached && cached.includes(CACHE_DIR)) return cached;
    const plat = { darwin: "darwin", win32: "win32", linux: "linux" }[process.platform];
    const arch = { arm64: "arm64", x64: "x64" }[process.arch] ?? process.arch;
    const zipName = `electron-v${ELECTRON_VERSION}-${plat}-${arch}.zip`;
    const url = `https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/${zipName}`;
    const zipPath = join(CACHE_DIR, zipName);
    mkdirSync(CACHE_DIR, { recursive: true });
    if (!existsSync(zipPath)) {
      log(`downloading Electron runtime: ${url}`);
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`electron download failed: HTTP ${res.status}`);
      await pipeline(res.body, createWriteStream(zipPath));
    }
    const extractTo = join(CACHE_DIR, "electron");
    if (!existsSync(zipPath) || existsSync(join(extractTo, "dist"))) {
      // 已解压过
    } else {
      rmSync(extractTo, { recursive: true, force: true });
      mkdirSync(extractTo, { recursive: true });
      log("extracting…");
      execFileSync(process.platform === "win32" ? "powershell" : "unzip", [
        ...(process.platform === "win32" ? ["-NoProfile", "-Command", `Expand-Archive -Force '${zipPath}' '${extractTo}'`] : ["-q", zipPath, "-d", extractTo]),
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

async function fetchApi(pathname, { method = "GET", body, timeoutMs = 8000 } = {}) {
  const res = await fetch(`http://127.0.0.1:${runtime.port}${pathname}`, {
    method,
    headers: { "content-type": "application/json", "x-aopc-pet-token": runtime.token },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// 对运行壳 HTTP API 的底层请求：node:http 硬超时 + 响应体必收尾。
// （undici fetch 在"上一个同源响应 body 未消费"时会排队卡死后续请求，探测/版本这类
//   只读状态的小请求改走这里，行为完全确定。）
function runtimeRequest(port, token, pathname, { timeoutMs = 1200, method = "GET", body = null } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: {
          "x-aopc-pet-token": token,
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
    const res = await runtimeRequest(port, token, "/quit", { timeoutMs: 900 });
    return res.status === 200;
  } catch {
    return false;
  }
}

const PLUGIN_MANIFEST = JSON.parse(
  readFileSync(join(PLUGIN_ROOT, ".aopc-plugin", "plugin.json"), "utf-8"),
);
const RUNTIME_VERSION = PLUGIN_MANIFEST.version;
async function fetchRuntimeVersion(port, token) {
  const res = await runtimeRequest(port, token, "/version", { timeoutMs: 900 });
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(res.body || "{}").version ?? null;
}

async function ensureRuntime() {
  // 0) 本进程已拉起且活着 → 直接复用
  if (runtime && (await probeRuntime(runtime.port, runtime.token))) return runtime;
  // 1) 既有运行壳活着（单实例握手）且版本一致 → 直接复用
  const saved = readRuntimeState();
  if (process.env.AOPC_PET_DEBUG) log(`ensure: saved=${saved.apiPort ?? "-"} runtime=${runtime ? "set" : "null"}`);
  if (saved.apiPort && saved.apiToken) {
    const probeResult = await probeRuntime(saved.apiPort, saved.apiToken);
    if (process.env.AOPC_PET_DEBUG) log(`ensure: probe=${probeResult}`);
    if (probeResult) {
    const version = await fetchRuntimeVersion(saved.apiPort, saved.apiToken).catch((e) => { if (process.env.AOPC_PET_DEBUG) log(`version fetch err: ${e?.message}`); return null; });
    if (version === RUNTIME_VERSION) {
      runtime = { child: null, port: saved.apiPort, token: saved.apiToken };
      return runtime;
    }
    // 版本不一致（插件刚升级，旧代码运行壳还挂着）→ 退出旧壳，下面拉起新代码
    log(`runtime version mismatch (${version ?? "unknown"} != ${RUNTIME_VERSION}), restarting`);
    await runtimeRequest(saved.apiPort, saved.apiToken, "/quit", { timeoutMs: 1500, method: "POST" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
    if (process.env.AOPC_PET_DEBUG) log("ensure: old runtime quit, respawning");
    }
  }
  // 2) 拉起 Electron 运行壳
  let electronBin = resolveElectron();
  if (process.env.AOPC_PET_DEBUG) log(`ensure: electron=${electronBin ?? "(none, downloading)"}`);
  if (!electronBin) electronBin = await downloadElectron();
  const child = spawn(electronBin, [join(PLUGIN_ROOT, "runtime", "main.cjs")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, AOPC_PLUGIN_ROOT: PLUGIN_ROOT, AOPC_PLUGIN_DATA: DATA_DIR },
  });
  child.stderr.on("data", (d) => process.stderr.write(d));
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("runtime ready timeout (60s)")), 60000);
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d.toString();
      const m = buf.match(/AOPC_PET_READY port=(\d+) token=([0-9a-f]+)/);
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
  if (process.env.AOPC_PET_DEBUG) log(`spawning runtime: ${electronBin}`);
  const { port, token } = await ready;
  runtime = { child, port, token };
  log(`runtime ready port=${port}`);
  return runtime;
}

async function callTool(name, args) {
  await ensureRuntime();
  switch (name) {
    case "pet_list": {
      const { config } = await fetchApi("/config");
      return {
        pets: config.pets.map((p) => ({ id: p.id, name: p.name, pack: p.pack, display: p.display, size: p.size })),
      };
    }
    case "pet_show":
      return fetchApi("/pet-display", { method: "POST", body: { pet: args.pet, display: "desktop" } });
    case "pet_hide":
      return fetchApi("/pet-display", { method: "POST", body: { pet: args.pet, display: "none" } });
    case "pet_say":
      return fetchApi("/say", { method: "POST", body: args });
    case "pet_whisper":
      return fetchApi("/whisper", { method: "POST", body: args });
    case "pet_anim":
      return fetchApi("/anim", { method: "POST", body: args });
    case "pet_work_status":
      return fetchApi("/work-status", { method: "POST", body: { state: args.state, text: args.text } });
    case "pet_balance":
      return fetchApi("/balance", { method: "POST", body: args });
    case "pet_move":
      return fetchApi("/position", { method: "POST", body: args });
    case "pet_throw":
      return fetchApi("/throw", { method: "POST", body: args });
    case "pet_lock":
      return fetchApi("/lock", { method: "POST", body: args });
    case "pet_unlock":
      return fetchApi("/lock/release", { method: "POST", body: args });
    case "pet_pose":
      return fetchApi("/pose");
    case "pet_reload_config":
      return fetchApi("/reload", { method: "POST", body: {} });
    case "pet_open_url":
      return fetchApi("/open-url", { method: "POST", body: { url: args.url } });
    case "pet_notify":
      return fetchApi("/notify", { method: "POST", body: args });
    case "pet_menu_item":
      return fetchApi("/menu/item", { method: "POST", body: args });
    case "pet_menu_events":
      return fetchApi(`/menu/events?owner=${encodeURIComponent(args.owner)}&wait=${Number(args.wait ?? 0) * 1000}`, {
        timeoutMs: (Number(args.wait ?? 0) + 3) * 1000,
      });
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

// autoStart：运行壳已按配置自动显示宠物（AOPC_PET_AUTO_START 由 manifest env 注入）
// 本进程不需要额外动作；运行壳挂掉时下一次工具调用会自动重启它。

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
      capabilities: { tools: {} },
      serverInfo: { name: "desktop-pet", version: "0.1.0" },
    });
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "tools/list") return send(id, { tools: TOOLS });
  if (method === "tools/call") {
    const name = params?.name;
    try {
      const result = await callTool(name, params?.arguments ?? {});
      pushEnvConfig().catch(() => {});
      return send(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 1).slice(0, 4000) }],
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
// autoStart：会话创建（MCP server 启动）即拉起运行壳，宠物立刻出现——
// 不等第一次工具调用（否则用户只开设置不调工具时永远看不到宠物）。
const AUTO_START_SERVER = !["0", "false"].includes(
  String(process.env.AOPC_PET_AUTO_START ?? "true").toLowerCase(),
);
if (AUTO_START_SERVER) {
  ensureRuntime()
    .then(pushEnvConfig)
    .catch((e) => log(`auto start failed: ${e?.message ?? e}`));
}
// 运行壳生命周期独立于本进程：禁用插件 / 会话结束（宿主杀掉 MCP server）时宠物**继续存活**，
// 显式退出只走托盘「退出」或 POST /quit。单实例握手保证不会堆积多个运行壳——
// 下次会话的新 server 启动时直接复用活着的那个。

// 把本进程持有的最新插件设置推给运行壳：配置保存后宿主会重启 server（env 刷新），
// 复用中的旧运行壳靠这一步拿到新设置（名字/显示/碎碎念周期/力度）并重启宠物。
let configPushed = false;
async function pushEnvConfig() {
  if (process.env.AOPC_PET_DEBUG) log(`pushEnvConfig: enter runtime=${runtime ? runtime.port : "null"}`);
  if (configPushed || !runtime) return;
  configPushed = true;
  try {
    await runtimeRequest(runtime.port, runtime.token, "/apply-config", {
      method: "POST",
      timeoutMs: 5000,
      body: JSON.stringify({
        petName: process.env.AOPC_PET_PET_NAME ?? "",
        show: process.env.AOPC_PET_SHOW ?? "true",
        whisperIntervalSec: process.env.AOPC_PET_WHISPER_INTERVAL ?? "",
        physicsPower: process.env.AOPC_PET_PHYSICS_POWER ?? "1",
      }),
    });
    log("env config applied to runtime");
  } catch (e) {
    log(`apply-config failed: ${e?.name} ${e?.message ?? e}`);
  }
}
