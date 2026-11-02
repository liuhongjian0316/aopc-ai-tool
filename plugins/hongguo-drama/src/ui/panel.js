/**
 * hongguo-drama UI 面板（自包含，经 resources/read 分发）
 *
 * 通过官方 @modelcontextprotocol/ext-apps 与宿主握手，callServerTool 调用本插件 MCP server：
 *   - hongguo_panel_status：轻量轮询（不拉起运行壳）
 *   - hongguo_library / hongguo_control / hongguo_open：显式动作（会按需拉起运行壳）
 * 主题跟随宿主 hostContext（暗/亮）。封面图受面板 CSP 限制不可远程加载，用渐变字母占位。
 */
import { App } from "@modelcontextprotocol/ext-apps";

const PLUGIN_NAME = "hongguo-drama";
const PLUGIN_VERSION = "0.2.0";

// ---------------------------------------------------------------- 连接层
let appPromise = null;
function getApp() {
  if (!appPromise) {
    const app = new App({ name: PLUGIN_NAME, version: PLUGIN_VERSION }, {}, { autoResize: false });
    app.onhostcontextchanged = () => applyTheme(app);
    appPromise = app
      .connect()
      .then(() => {
        applyTheme(app);
        return app;
      })
      .catch((err) => {
        appPromise = null; // 面板重载后允许重新握手
        throw err;
      });
  }
  return appPromise;
}

function applyTheme(app) {
  const theme = app.getHostContext()?.theme ?? "dark";
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}

async function rpc(name, args = {}) {
  const app = await getApp();
  const result = await app.callServerTool({ name, arguments: args });
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) throw new Error(text || `工具调用失败: ${name}`);
  if (result.structuredContent !== undefined) return result.structuredContent;
  if (text !== undefined) {
    try { return JSON.parse(text); } catch { return text; }
  }
  return undefined;
}

// ---------------------------------------------------------------- 工具函数
function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const STATUS_LABELS = {
  downloading: "下载中", waiting: "等待中", queued: "排队中",
  completed: "已完成", failed: "失败", stopped: "已停止", paused: "已暂停",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------------------------------------------------------------- 状态
const state = {
  running: false,
  queue: null,
  tasks: [],
  library: null,          // null = 未加载；[] = 空剧库
  libraryLoading: false,
  error: "",
  actionBusy: false,
};

// ---------------------------------------------------------------- 渲染
const $list = () => document.querySelector("#tasks");
const $lib = () => document.querySelector("#library");

function render() {
  // 头部状态
  const dot = document.querySelector("#shell-dot");
  dot.className = `dot ${state.running ? "on" : "off"}`;
  dot.title = state.running ? "下载器运行中" : "下载器未运行";
  document.querySelector("#shell-label").textContent = state.running ? "运行中" : "未运行";
  for (const id of ["btn-open", "btn-pause", "btn-resume", "btn-quit"]) {
    document.querySelector(`#${id}`).disabled = state.actionBusy;
  }
  document.querySelector("#btn-pause").disabled = state.actionBusy || !state.running;
  document.querySelector("#btn-resume").disabled = state.actionBusy || !state.running;
  document.querySelector("#btn-quit").disabled = state.actionBusy || !state.running;

  // 错误横幅
  const banner = document.querySelector("#error");
  banner.hidden = !state.error;
  if (state.error) banner.querySelector("span").textContent = state.error;

  // 下载队列
  const list = $list();
  list.replaceChildren();
  const active = state.tasks.filter((t) => ["downloading", "waiting", "queued", "paused"].includes(t.status));
  const done = state.tasks.filter((t) => ["completed", "failed", "stopped"].includes(t.status));
  if (!state.running) {
    list.append(el(`
      <div class="empty">
        <p>下载器未运行。打开窗口或提交下载时会自动启动。</p>
        <button class="btn primary" data-action="open">启动下载器</button>
      </div>`));
  } else if (!state.tasks.length) {
    list.append(el(`<div class="empty"><p>暂无下载任务</p></div>`));
  } else {
    for (const t of [...active, ...done.slice(0, 8)]) list.append(taskCard(t));
    if (done.length > 8) {
      list.append(el(`<div class="more">还有 ${done.length - 8} 个历史任务，打开窗口查看全部</div>`));
    }
  }

  // 队列摘要
  const q = state.queue;
  document.querySelector("#queue-summary").textContent = state.running && q
    ? `下载中 ${q.active ?? 0} · 排队 ${q.queued ?? 0} · 并发上限 ${q.maxConcurrent ?? "-"}`
    : "";

  // 剧库
  const lib = $lib();
  lib.replaceChildren();
  if (state.libraryLoading) {
    lib.append(el(`<div class="empty"><p>剧库加载中…</p></div>`));
  } else if (state.library === null) {
    lib.append(el(`
      <div class="empty">
        <p>剧库未加载（加载会启动下载器）</p>
        <button class="btn" data-action="load-library">加载剧库</button>
      </div>`));
  } else if (!state.library.length) {
    lib.append(el(`<div class="empty"><p>剧库为空，先在窗口里搜几部剧吧</p></div>`));
  } else {
    for (const s of state.library) lib.append(seriesCard(s));
  }
}

function taskCard(t) {
  const statusLabel = STATUS_LABELS[t.status] || t.status || "未知";
  const pct = typeof t.percent === "number" ? Math.max(0, Math.min(100, t.percent)) : null;
  const size = [fmtBytes(t.receivedBytes), fmtBytes(t.totalBytes)].filter(Boolean).join(" / ");
  const isActive = ["downloading", "waiting", "queued"].includes(t.status);
  const action = t.status === "failed"
    ? `<button class="btn small" data-action="retry" data-task="${esc(t.taskId)}">重试</button>`
    : isActive
      ? `<button class="btn small" data-action="stop" data-task="${esc(t.taskId)}">停止</button>`
      : "";
  return el(`
    <div class="card task">
      <div class="row">
        <div class="title" title="${esc(t.title)}">${esc(t.title)}${t.episode ? ` <span class="ep">第${String(t.episode).padStart(3, "0")}集</span>` : ""}</div>
        <span class="pill ${esc(t.status)}">${esc(statusLabel)}</span>
      </div>
      ${pct !== null || isActive ? `
      <div class="bar"><div class="fill ${esc(t.status)}" style="width:${pct ?? 0}%"></div></div>` : ""}
      <div class="meta">
        <span>${pct !== null ? `${pct}%` : ""}${size ? ` · ${size}` : ""}</span>
        ${t.error ? `<span class="err" title="${esc(t.error)}">${esc(t.error)}</span>` : ""}
        ${action}
      </div>
    </div>`);
}

function seriesCard(s) {
  const ch = (s.title || "剧").trim().charAt(0);
  return el(`
    <div class="card series" data-action="open" title="${esc(s.title)}（点击打开窗口）">
      <div class="avatar g${[...ch].reduce((a, c) => a + c.codePointAt(0), 0) % 6}">${esc(ch)}</div>
      <div class="s-title">${esc(s.title)}</div>
      <div class="s-meta">${s.totalEpisodes ? `${s.totalEpisodes} 集` : ""}</div>
    </div>`);
}

// ---------------------------------------------------------------- 动作
async function refresh({ silent = false } = {}) {
  try {
    const data = await rpc("hongguo_panel_status");
    state.running = !!data?.running;
    state.queue = data?.queue ?? null;
    state.tasks = Array.isArray(data?.tasks) ? data.tasks : [];
    state.error = "";
  } catch (e) {
    if (!silent) state.error = e?.message || String(e);
  }
  render();
}

async function loadLibrary() {
  state.libraryLoading = true;
  render();
  try {
    const data = await rpc("hongguo_library");
    state.library = Array.isArray(data?.series) ? data.series : [];
    state.error = "";
  } catch (e) {
    state.error = e?.message || String(e);
  } finally {
    state.libraryLoading = false;
    render();
  }
}

async function action(fn) {
  state.actionBusy = true;
  render();
  try {
    await fn();
    state.error = "";
  } catch (e) {
    state.error = e?.message || String(e);
  } finally {
    state.actionBusy = false;
    await refresh({ silent: true });
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const { action: act, task } = target.dataset;
  if (act === "open") action(() => rpc("hongguo_open"));
  else if (act === "pause") action(() => rpc("hongguo_control", { action: "pause" }));
  else if (act === "resume") action(() => rpc("hongguo_control", { action: "resume" }));
  else if (act === "quit") action(() => rpc("hongguo_quit").then(() => { state.library = null; }));
  else if (act === "stop") action(() => rpc("hongguo_control", { action: "stop", taskId: task }));
  else if (act === "retry") action(() => rpc("hongguo_control", { action: "retry", taskId: task }));
  else if (act === "load-library") loadLibrary();
  else if (act === "reload-error") { state.error = ""; render(); }
});

// 轮询：仅面板可见时每 4 秒轻量刷新（hongguo_panel_status 不会拉起运行壳）
setInterval(() => {
  if (document.visibilityState === "visible" && !state.actionBusy) refresh({ silent: true });
}, 4000);

// ---------------------------------------------------------------- 启动
getApp()
  .then(() => refresh())
  .catch((e) => {
    state.error = `面板握手失败：${e?.message ?? e}（可尝试重新打开面板）`;
    render();
  });
render();
