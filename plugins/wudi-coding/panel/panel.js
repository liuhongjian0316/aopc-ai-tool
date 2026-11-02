/* 无敌编程工作台面板逻辑 v0.11（vanilla JS，与 vendor SDK 拼接进同一 module，经 build-panel.mjs 组装）。
 * 通信走官方 @modelcontextprotocol/ext-apps SDK；遵循 obsidian-kb 踩坑结论：tools/list 全量声明、
 * 主题跟随 hostContext、widgetState 存视图状态、connect 前不发通知。
 * IA：项目（landing 网格）→ 总览 / 部署 / 设计 / 文档（当前项目操作页）+ 非当前项目只读下钻。
 * 本文件不得使用 import/export（拼接产物是单 module），SDK 解构来自 WUDI_SDK。
 */
const { App } = WUDI_SDK;
/* EmptyResultSchema 未随 app-with-deps 入口导出（在 core 包里）：widgetState 响应是空对象，
 * 用 duck-typed shim 兼容 SDK 内部 zod 的 parse/safeParse 调用约定。 */
const EmptyResultSchema = {
  parse: (v) => v,
  safeParse: (v) => ({ success: true, data: v }),
};

(() => {
  const DEMO = String(location.hash || "").includes("demo");
  /* demo 模式的内置设计稿样例与 PNG 渐变占位 */
  const DEMO_PNG_GRADIENTS = {
    "workbench-home.png": "linear-gradient(135deg,#3565f0,#7c5cf0)",
    "deploy-flow.png": "linear-gradient(135deg,#0e8a4f,#3565f0)",
  };
  const DEMO_MOCKUP_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>__NAME__</title><style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,"PingFang SC",sans-serif}
  body{background:#f4f6fa;padding:24px;color:#171a21}
  .top{display:flex;align-items:center;gap:10px;margin-bottom:20px}.logo{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#3565f0,#7c5cf0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
  h1{font-size:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .c{background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .c b{font-size:13px}.num{font-size:26px;font-weight:800;margin:8px 0 2px;background:linear-gradient(135deg,#3565f0,#7c5cf0);-webkit-background-clip:text;background-clip:text;color:transparent}
  .muted{color:#8a93a3;font-size:11px}.btn{display:inline-block;margin-top:10px;padding:7px 16px;border-radius:8px;background:linear-gradient(135deg,#3565f0,#7c5cf0);color:#fff;font-size:12px;font-weight:600}
  </style></head><body>
  <div class="top"><div class="logo">无敌</div><div><h1>__NAME__ 设计稿预览</h1><div class="muted">工作台 · 项目管理 · 部署 · 1440 设计画布</div></div></div>
  <div class="grid">
    <div class="c"><b>项目总览</b><div class="num">3</div><div class="muted">进行中的项目</div><span class="btn">查看全部</span></div>
    <div class="c"><b>本周部署</b><div class="num">5</div><div class="muted">成功率 96%</div><span class="btn">部署记录</span></div>
    <div class="c"><b>健康检查</b><div class="num">200</div><div class="muted">全部通过</div><span class="btn">体检报告</span></div>
  </div></body></html>`;
  const app = new App(
    { name: "wudi-coding", version: "0.12.0" },
    { availableDisplayModes: ["inline", "fullscreen"] }
  );
  /* 资源缓存：设计图 base64 与设计稿 HTML 文本（readServerResource 经 server 动态资源管线） */
  const imgCache = new Map();
  const mockCache = new Map();

  const state = {
    view: "projects",  // projects=landing 网格 | detail=当前项目四页
    drill: null,       // 非当前项目的只读下钻（registry summary）
    tab: "overview",
    envs: [],
    env: "",
    data: null,        // wudi_status structuredContent
    history: null,     // wudi_deploy_history structuredContent
    projects: null,    // wudi_projects_list structuredContent {projects}
    design: null,      // {tokens, files}
    busy: false,
    connected: false,
    notice: null,
  };

  /* ---------- 小工具 ---------- */
  const $root = () => document.getElementById("root");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtTime = (iso) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch { return String(iso); }
  };
  const STATUS_ZH = { ok: "成功", "ok-with-warnings": "成功(未验证)", failed: "失败", running: "进行中", aborted: "已中断" };
  const STAGE_ZH = { build: "构建", package: "打包", upload: "上传", remote: "切换", verify: "验证", switch: "切换" };
  const TYPE_ZH = { readme: "README", api: "API", prd: "PRD", runbook: "部署手册", changelog: "CHANGELOG", architecture: "架构", weekly: "周报", doc: "文档" };
  const badge = (status) => `<span class="badge ${esc(status === "ok-with-warnings" ? "warn" : status)}">${esc(STATUS_ZH[status] ?? status)}</span>`;
  const shortPath = (p, n = 42) => (String(p).length > n ? "…" + String(p).slice(-n) : String(p));
  const INPUT_CSS = "width:100%;padding:7px 10px;border:1px solid var(--border-strong);border-radius:8px;background:var(--bg-card);color:var(--text);font-family:var(--mono);font-size:12px";

  async function callTool(name, args) {
    const res = await app.callServerTool({ name, arguments: args ?? {} });
    if (res?.isError) throw new Error(res.content?.map((c) => c.text).join("\n") || `${name} 执行失败`);
    return res;
  }
  const struct = (res) => res?.structuredContent ?? null;

  async function saveWidgetState() {
    try {
      if (!app.getHostCapabilities()?.experimental?.["aopc/widgetState"]) return;
      await app.request(
        { method: "ui/set-widget-state", params: { widgetState: { view: state.view, tab: state.tab } } },
        EmptyResultSchema
      );
    } catch { /* 视图状态失败不阻塞 */ }
  }

  function reportSize() {
    if (!state.connected) return;
    try { app.sendSizeChanged?.({ height: document.body.scrollHeight }); } catch { /* 宿主不支持时忽略 */ }
  }

  /* ---------- 主题 ---------- */
  function applyTheme() {
    document.documentElement.dataset.theme = app.getHostContext()?.theme ?? "light";
  }
  app.onhostcontextchanged = () => { applyTheme(); render(); };

  /* Gen UI：工具结果驱动（_meta.ui 绑定的工具被调用时，结构化数据合并进面板状态并实时渲染） */
  app.ontoolresult = (result) => {
    const sc = result?.structuredContent;
    if (!sc || typeof sc !== "object") return;
    if (sc.project !== undefined || sc.resolved !== undefined) state.data = { ...(state.data ?? {}), ...sc };
    if (Array.isArray(sc.deploys)) state.history = { deploys: sc.deploys };
    if (sc.tokens !== undefined) state.design = { ...(state.design ?? { files: [] }), tokens: sc.tokens };
    if (Array.isArray(sc.files)) state.design = { ...(state.design ?? { tokens: null }), files: sc.files };
    if (Array.isArray(sc.projects)) state.projects = { projects: sc.projects };
    render();
  };

  /* ---------- 渲染骨架 ---------- */
  const ICONS = {
    projects: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 2A1.5 1.5 0 0 1 3 .5h4A1.5 1.5 0 0 1 8.5 2v4A1.5 1.5 0 0 1 7 7.5H3A1.5 1.5 0 0 1 1.5 6V2Zm7 8A1.5 1.5 0 0 1 10 8.5h4A1.5 1.5 0 0 1 15.5 10v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 14v-4ZM1.5 10A1.5 1.5 0 0 1 3 8.5h4A1.5 1.5 0 0 1 8.5 10v4A1.5 1.5 0 0 1 7 15.5H3A1.5 1.5 0 0 1 1.5 14v-4Zm7-8A1.5 1.5 0 0 1 10 .5h4A1.5 1.5 0 0 1 15.5 2v4A1.5 1.5 0 0 1 14 7.5h-4A1.5 1.5 0 0 1 8.5 6V2Z"/></svg>',
    overview: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.6A4.9 4.9 0 1 1 8 3.1V1.5Zm1.5 0v4.7l3.3-3.4A6.5 6.5 0 0 0 9.5 1.5Z"/></svg>',
    deploys: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 .8c2.6 1.3 4.4 3.9 4.4 7.4l-2.6 2.6c.2-2.6-.3-5-1.8-7.3-.2-.3-.6-.3-.8 0C5.7 5.8 5.2 8.2 5.4 10.8L2.8 8.2C2.8 4.7 5.4 2.1 8 .8ZM5.6 11.4c.5 1 .9 2 1 3.1-.9.6-1.9 1-3 1.2-.4.1-.7-.3-.6-.6.3-1.1 1-2.4 2.6-3.7Zm4.8 0c1.6 1.3 2.3 2.6 2.6 3.7.1.4-.2.7-.6.6-1.1-.2-2.1-.6-3-1.2.1-1.1.5-2.1 1-3.1Z"/></svg>',
    design: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 0 0 0 14c.9 0 1.5-.7 1.5-1.5 0-.4-.15-.75-.4-1-.24-.26-.4-.6-.4-1 0-.83.67-1.5 1.5-1.5h1.3A3.6 3.6 0 0 0 15 6.4C15 3.4 11.9 1 8 1ZM3.5 8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm3-3.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4.5.5a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>',
    docs: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.5A1.5 1.5 0 0 1 4.5 0h5L14 4.5v10A1.5 1.5 0 0 1 12.5 16h-8A1.5 1.5 0 0 1 3 14.5v-13ZM9.5 1.2V4a.5.5 0 0 0 .5.5h2.8L9.5 1.2ZM5 7.5h6v1.2H5V7.5Zm0 3h6v1.2H5v-1.2Z"/></svg>',
  };
  function render() {
    const navTabs = [
      ["projects", "项目", ICONS.projects, (state.projects?.projects ?? []).length || ""],
      ["overview", "总览", ICONS.overview, ""],
      ["deploys", "部署", ICONS.deploys, ""],
      ["design", "设计", ICONS.design, ""],
      ["docs", "文档", ICONS.docs, (state.data?.docs ?? []).length || ""],
    ];
    const nav = navTabs.map(([id, label, icon, count]) =>
      `<button data-tab="${id}" class="${(state.view === "projects" ? "projects" : state.tab) === id ? "active" : ""}">${icon}${label}${count !== "" ? `<span class="count">${esc(String(count))}</span>` : ""}</button>`
    ).join("");

    let body;
    if (state.view === "projects" && !state.drill) body = renderProjects();
    else if (state.drill) body = renderDrill();
    else body = state.tab === "overview" ? renderOverview(state.data?.project ?? null)
      : state.tab === "deploys" ? renderDeploys()
      : state.tab === "design" ? renderDesign()
      : renderDocs();

    $root().innerHTML = `
      <div class="container">
        <div class="masthead">
          <div class="brand">
            <div class="logo">无敌</div>
            <div><h1>无敌编程工作台</h1><div class="sub">${state.drill ? esc(state.drill.name) : "项目管理 · 设计 · 部署 · 文档"}</div></div>
          </div>
          <span class="spacer"></span>
          <button class="btn" id="btn-refresh" ${state.busy ? "disabled" : ""}>${state.busy ? '<span class="spin"></span>' : ""}刷新</button>
        </div>
        ${state.drill ? `<div style="margin-bottom:10px"><button class="backlink" id="btn-back">← 返回项目列表</button></div>` : ""}
        <div class="nav">${nav}</div>
        ${state.notice ? `<div class="notice ${state.notice.kind}"><span class="badge ${state.notice.kind}">${state.notice.kind === "ok" ? "完成" : "失败"}</span><span class="mono">${esc(state.notice.text)}</span></div>` : ""}
        ${body}
      </div>`;
    $root().querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.drill = null;
        state.view = b.dataset.tab === "projects" ? "projects" : "detail";
        state.tab = b.dataset.tab === "projects" ? state.tab : b.dataset.tab;
        state.notice = null;
        if (state.tab === "design" && state.view === "detail") loadDesign();
        if (state.view === "projects") loadProjects();
        render();
        saveWidgetState();
      })
    );
    document.getElementById("btn-refresh")?.addEventListener("click", () => { state.drill = null; loadAll(); });
    document.getElementById("btn-back")?.addEventListener("click", () => { state.drill = null; render(); saveWidgetState(); });
    bindActions();
    if (state.view === "detail" && state.tab === "design") {
      fillDesignAssets();
      $root().querySelectorAll(".mock-card").forEach((c) => c.addEventListener("click", () => previewMockup(c.dataset.mock)));
      $root().querySelectorAll(".png-card[data-ok]").forEach((c) =>
        c.addEventListener("click", () => {
          if (DEMO) {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#3565f0'/><stop offset='1' stop-color='#7c5cf0'/></linearGradient></defs><rect width='800' height='500' fill='url(%23g)'/><text x='400' y='255' font-family='sans-serif' font-size='28' fill='white' text-anchor='middle'>${esc(c.dataset.png)}（demo 占位图）</text></svg>`;
            previewImage(`data:image/svg+xml;charset=utf-8,${svg}`, c.dataset.png);
            return;
          }
          previewImage(imgCache.get(c.dataset.png), c.dataset.png);
        })
      );
    }
    reportSize();
  }

  /* ---------- 项目 landing ---------- */
  function healthDot(p) {
    const s = p.lastDeploy?.status;
    if (!s) return '<span class="dot none"></span>未部署';
    if (s === "ok") return '<span class="dot ok"></span>运行正常';
    if (s === "failed") return '<span class="dot err"></span>上次失败';
    if (s === "ok-with-warnings") return '<span class="dot warn"></span>未验证';
    return `<span class="dot warn"></span>${esc(STATUS_ZH[s] ?? s)}`;
  }

  function renderProjects() {
    const projects = state.projects?.projects;
    const cards = (projects ?? []).map((p) => `
      <div class="pcard ${p.isCurrent ? "current" : ""}" data-pid="${esc(p.id)}" data-current="${p.isCurrent ? 1 : 0}">
        <button class="remove" data-remove="${esc(p.id)}" title="从注册表移除">×</button>
        <div class="pname">${esc(p.name)}</div>
        <div class="ppath">${esc(shortPath(p.path))}</div>
        <div class="stats">
          ${p.archived ? "" : '<span class="badge warn">未建档</span>'}
          ${p.techStack ? `<span class="chip accent">${esc(p.techStack)}</span>` : ""}
          ${(p.envNames ?? []).slice(0, 3).map((e) => `<span class="chip">${esc(e)}</span>`).join("")}
        </div>
        <div class="foot">${healthDot(p)}<span style="flex:1"></span>文档 ${p.docsCount} · 设计 ${p.designCount}</div>
      </div>`).join("");
    const grid = projects?.length
      ? `<div class="grid">${cards}</div>`
      : `<div class="empty"><div class="icon"></div>还没有登记项目。下面登记第一个，或在各项目工作区里跑 <span class="mono">/wudi</span>。</div>`;
    return `
      ${grid}
      <div class="card" style="margin-top:12px">
        <h3>登记项目<span class="line"></span></h3>
        <div class="kv">
          <span class="k">项目路径</span><span class="v"><input id="p-path" placeholder="/Users/me/code/my-app（绝对路径）"></span>
          <span class="k">显示名</span><span class="v"><input id="p-name" placeholder="缺省取目录名"></span>
        </div>
        <div class="btnrow" style="margin-top:10px"><button class="btn primary" id="btn-padd" ${state.busy ? "disabled" : ""}>登记</button><span class="muted">登记后面板可总览；部署操作仍在该项目工作区进行</span></div>
      </div>`;
  }

  function renderDrill() {
    const p = state.drill;
    const last = p.lastDeploy;
    return `
      <div class="banner">
        <div class="row"><h2>${esc(p.name)}</h2>${p.isCurrent ? '<span class="badge" style="background:rgba(255,255,255,.2);color:#fff">当前工作区</span>' : ""}</div>
        <div class="meta">
          <span class="chip">${esc(shortPath(p.path, 56))}</span>
          ${p.techStack ? `<span class="chip">${esc(p.techStack)}</span>` : ""}
          ${(p.envNames ?? []).map((e) => `<span class="chip">${esc(e)}</span>`).join("")}
          ${p.archived ? "" : '<span class="chip">未建档</span>'}
        </div>
      </div>
      <div class="card"><h3>最近部署<span class="line"></span></h3>
        ${last ? `<div class="kv"><span class="k">版本</span><span class="v">${esc(last.release)}</span><span class="k">结果</span><span class="v plain">${badge(last.status)}（${esc(last.type === "rollback" ? "回滚" : "部署")}@${esc(last.env ?? "default")}）</span><span class="k">时间</span><span class="v plain">${esc(fmtTime(last.finishedAt))}</span></div>` : `<div class="muted">该项目还没有部署记录${p.isCurrent ? "，去「部署」页发布第一版。" : "。"}</div>`}
        ${!p.isCurrent && p.archived ? '<div class="muted" style="margin-top:8px">这是只读总览；部署操作请在该项目的工作区会话中进行（AOPC 打开该项目目录）。</div>' : ""}
      </div>
      <div class="card"><h3>资产<span class="line"></span></h3>
        <div class="kv"><span class="k">文档</span><span class="v plain">${p.docsCount} 份</span><span class="k">设计产物</span><span class="v plain">${p.designCount} 个</span><span class="k">登记时间</span><span class="v plain">${esc(fmtTime(p.addedAt))}</span></div>
      </div>`;
  }

  /* ---------- 当前项目四页 ---------- */
  function renderOverview(p) {
    if (!p) {
      return `
      <div class="card"><h3>快速建档<span class="line"></span></h3>
        <div class="muted" style="margin-bottom:8px">填基础档案即可开通部署流水线；多环境/通知/确认词在建档后用 <span class="mono">wudi_env_set</span> 配置。</div>
        <div class="kv">
          <span class="k">项目名</span><span class="v"><input id="f-name" style="${INPUT_CSS}" placeholder="my-app"></span>
          <span class="k">技术栈</span><span class="v"><input id="f-tech" style="${INPUT_CSS}" placeholder="vite-spa / go-service / node-nest"></span>
          <span class="k">构建命令</span><span class="v"><input id="f-build" style="${INPUT_CSS}" placeholder="npm run build"></span>
          <span class="k">打包</span><span class="v"><select id="f-ptype" style="${INPUT_CSS}"><option value="dir">产物目录（软链发布）</option><option value="docker-image">Docker 镜像</option></select></span>
          <span class="k">产物路径</span><span class="v"><input id="f-ppath" style="${INPUT_CSS}" placeholder="dist（镜像模式填镜像名如 myapp:latest）"></span>
          <span class="k">部署根目录</span><span class="v"><input id="f-root" style="${INPUT_CSS}" placeholder="/srv/myapp"></span>
          <span class="k">切换脚本</span><span class="v"><input id="f-script" style="${INPUT_CSS}" placeholder="docker compose up -d（可留空）"></span>
          <span class="k">健康检查</span><span class="v"><input id="f-health" style="${INPUT_CSS}" placeholder="http://127.0.0.1:8080/healthz（可留空）"></span>
        </div>
        <div class="btnrow" style="margin-top:10px">
          <button class="btn primary" id="btn-init" ${state.busy ? "disabled" : ""}>建立档案</button>
          <span class="muted">SSH 目标在插件设置里配置（host/用户/密钥）</span>
        </div>
      </div>`;
    }
    const latest = state.data?.deploys?.[0];
    const resolved = state.data?.resolved;
    const deploys = state.history?.deploys ?? state.data?.deploys ?? [];
    const okCount = deploys.filter((d) => d.status === "ok" || d.status === "ok-with-warnings").length;
    const successRate = deploys.length ? Math.round((okCount / deploys.length) * 100) : null;
    const statTiles = `
      <div class="stats-row">
        <div class="stat"><div class="num">${deploys.length}</div><div class="lbl">部署（近 ${deploys.length} 次）</div></div>
        <div class="stat"><div class="num">${successRate === null ? "—" : successRate + "%"}</div><div class="lbl">成功率</div></div>
        <div class="stat"><div class="num">${state.data?.docs?.length ?? 0}</div><div class="lbl">文档</div></div>
        <div class="stat"><div class="num">${(state.design?.files ?? []).length}</div><div class="lbl">设计产物</div></div>
      </div>`;
    const envBtns = (state.data?.envs ?? []).length > 1
      ? ["", ...state.data.envs].map((e) =>
          `<button class="btn env-btn ${state.env === e ? "primary" : ""}" data-env="${esc(e)}">${e === "" ? `默认（${esc(state.data.currentEnv || "?")}）` : esc(e)}</button>`
        ).join("")
      : "";
    return `
      <div class="banner">
        <div class="row"><h2>${esc(p.name || "(未命名)")}</h2><span class="badge" style="background:rgba(255,255,255,.2);color:#fff">${esc(latest ? STATUS_ZH[latest.status] ?? latest.status : "未部署")}</span></div>
        <div class="meta">
          ${p.techStack ? `<span class="chip">${esc(p.techStack)}</span>` : ""}
          ${(state.data?.envs ?? []).map((e) => `<span class="chip">${esc(e)}${state.data.currentEnv === e ? " ✓" : ""}</span>`).join("")}
          <span class="chip">${p.package?.type === "docker-image" ? "Docker" : "静态/目录"}</span>
          <span class="chip">策略 ${esc(resolved?.deployPolicy ?? "confirm")}</span>
        </div>
      </div>
      ${statTiles}
      ${envBtns ? `<div class="btnrow" style="margin-bottom:12px">${envBtns}</div>` : ""}
      <div class="card"><h3>流水线配置<span class="line"></span></h3>
        <div class="kv">
          <span class="k">构建</span><span class="v">${esc(p.build || "—")}</span>
          <span class="k">打包</span><span class="v plain">${esc(p.package?.type === "docker-image" ? `镜像 ${p.package?.dockerImage || "未配置"}` : `目录 ${p.package?.path || "dist"}`)}</span>
          <span class="k">部署</span><span class="v">${esc(resolved?.deployRoot || p.deployRoot || "—")}</span>
          <span class="k">切换脚本</span><span class="v">${esc(resolved?.remoteScript || "（无）")}</span>
          <span class="k">健康检查</span><span class="v">${esc(resolved?.healthCheck?.url || "未配置")}<span class="muted">（期望 ${esc(resolved?.healthCheck?.expect ?? 200)}，${esc(resolved?.healthCheck?.checkFrom ?? "remote")} 侧）</span></span>
        </div>
      </div>
      <div class="card"><h3>连接与通知<span class="line"></span></h3>
        <div class="btnrow">
          <button class="btn" id="btn-ping" ${state.busy ? "disabled" : ""}>测试 SSH</button>
          <button class="btn" id="btn-notify-test" ${state.busy ? "disabled" : ""}>测试通知</button>
          <span id="ping-result" class="muted">凭据来自插件设置；通知按档案 notifyWebhook</span>
        </div>
      </div>
      <div class="card"><h3>最近部署<span class="line"></span></h3>
        ${latest ? `<div class="kv"><span class="k">版本</span><span class="v">${esc(latest.release ?? latest.id)}</span><span class="k">状态</span><span class="v plain">${badge(latest.status)}</span></div>` : '<span class="muted">还没有部署记录，去「部署」页发布第一版。</span>'}
      </div>`;
  }

  function renderDeploys() {
    const deploys = state.history?.deploys ?? state.data?.deploys ?? [];
    return `
      <div class="card"><h3>操作<span class="line"></span></h3>
        <div class="btnrow">
          <button class="btn primary" id="btn-deploy" ${state.busy || !state.data?.project ? "disabled" : ""}>部署新版本…</button>
          <button class="btn" id="btn-health" ${state.busy ? "disabled" : ""}>健康检查</button>
          <button class="btn danger" id="btn-rollback" ${state.busy || !deploys.length ? "disabled" : ""}>回滚上一版…</button>
          <span class="muted">均先出预检计划，确认后执行（走宿主审批）</span>
        </div>
      </div>
      ${deploys.length ? deploys.map((d) => {
        const h = d.health;
        const healthBadge = !h ? "" : h.skipped
          ? '<span class="badge neutral">未验证</span>'
          : h.ok
            ? `<span class="badge ok">HTTP ${esc(String(h.status))}</span>`
            : `<span class="badge failed">HTTP ${esc(String(h.status ?? "?"))}</span>`;
        const stages = (d.stages ?? []).map((s) =>
          `<div class="stage"><span class="name">${esc(STAGE_ZH[s.name] ?? s.name)}</span>${badge(s.status)}<span class="detail">${esc(s.detail || "")}</span><span class="dur">${s.durationMs ? `${s.durationMs}ms` : ""}</span></div>`
        ).join("");
        return `<div class="deploy">
          <div class="head"><span class="rel">${esc(d.release ?? d.id)}</span>${badge(d.status)}<span class="badge neutral">${d.type === "rollback" ? "回滚" : "部署"}</span>${healthBadge}<span class="time">${esc(fmtTime(d.startedAt))}</span></div>
          <div class="stages">${stages || '<div class="muted">无阶段明细</div>'}</div>
        </div>`;
      }).join("") : `<div class="empty"><div class="icon"></div>还没有部署记录。点上方「部署新版本」或会话里执行 <span class="mono">/wudi-deploy deploy</span>。</div>`}`;
  }

  function renderDesign() {
    const design = state.design;
    if (!design) return `<div class="empty"><div class="icon"></div><span class="spin"></span> 加载设计产物…</div>`;
    const files = design.files ?? [];
    const mockups = files.filter((f) => String(f.path).endsWith(".html") && String(f.path).includes("mockups"));
    const pngs = files.filter((f) => String(f.path).endsWith(".png"));

    /* 设计稿 HTML 卡片（点击 iframe 预览） */
    const mockupCards = mockups.length
      ? `<div class="mockups">${mockups.map((f) => {
          const name = String(f.path).split("/").pop();
          return `<div class="mock-card" data-mock="${esc(name)}" title="点击预览设计稿">
            <div class="mock-thumb"><div class="mock-wire"></div></div>
            <div class="mock-meta"><div class="name">${esc(name)}</div><div class="muted">${esc(String(f.sizeKB))} KB · ${esc(fmtTime(f.updatedAt))}</div></div>
          </div>`;
        }).join("")}</div>`
      : "";
    /* PNG 设计图墙（resource 管线 → data URI；demo 用渐变占位） */
    const pngWall = pngs.length
      ? `<div class="pngs">${pngs.map((f) => {
          const name = String(f.path).split("/").pop();
          if (DEMO) {
            return `<div class="png-card" data-png="${esc(name)}" data-ok="1"><div class="png-ph" style="background:${esc(DEMO_PNG_GRADIENTS[name] ?? "linear-gradient(135deg,#3565f0,#7c5cf0)")};height:110px"></div><div class="meta">${esc(name)}</div></div>`;
          }
          return `<div class="png-card" data-png="${esc(name)}"><img data-uri="ui://wudi-coding/image/${esc(name)}" alt="${esc(name)}"><div class="meta">${esc(name)}</div></div>`;
        }).join("")}</div>`
      : "";

    const tokens = design.tokens;
    const colorEntries = Object.entries(tokens?.color ?? {});
    const palette = colorEntries.length
      ? `<div class="card"><h3>色板<span class="line"></span></h3><div class="swatches">${colorEntries.map(([k, v]) =>
          `<div class="swatch"><div class="color" style="background:${esc(String(v))}"></div><div class="meta"><div class="name">${esc(k)}</div><div class="val">${esc(String(v))}</div></div></div>`
        ).join("")}</div></div>`
      : "";
    const otherTokens = tokens
      ? Object.entries(tokens).filter(([g]) => g !== "color").map(([group, entries]) =>
          `<div class="card"><h3>${esc(group)}<span class="line"></span></h3><div class="kv">${Object.entries(entries ?? {}).map(([k, v]) =>
            `<span class="k">${esc(k)}</span><span class="v">${esc(String(v))}</span>`).join("")}</div></div>`
        ).join("")
      : "";
    return `
      ${mockups.length ? `<div class="card"><h3>UI 设计稿<span class="line"></span></h3>${mockupCards}<div class="muted" style="margin-top:8px">点击卡片预览完整设计稿</div></div>` : ""}
      ${pngs.length ? `<div class="card"><h3>设计图<span class="line"></span></h3>${pngWall}<div class="muted" style="margin-top:8px">来自 wudi_figma_images 渲染，点击放大</div></div>` : ""}
      ${palette}
      ${otherTokens}
      ${!mockups.length && !pngs.length ? `<div class="card"><h3>UI 设计稿<span class="line"></span></h3><div class="empty" style="padding:22px">还没有设计稿。执行 <span class="mono">/wudi-ui</span> 生成设计稿（HTML 落到 .wudi/design/mockups/），或用 <span class="mono">wudi_figma_images</span> 从 Figma 拉 PNG。</div></div>` : ""}
      ${!tokens ? `<div class="card"><h3>Design Tokens<span class="line"></span></h3><div class="empty" style="padding:22px">还没有 design tokens。执行 <span class="mono">/wudi-ui</span> 设计定稿后自动沉淀。</div></div>` : ""}
      <div class="card"><h3>全部产物（新→旧）<span class="line"></span></h3>
        ${files.length ? files.map((f) =>
          `<div class="row"><span class="chip">${String(f.path).endsWith(".html") ? "设计稿" : String(f.path).endsWith(".png") ? "设计图" : "tokens"}</span><span class="path">${esc(f.path)}</span><span class="muted">${esc(String(f.sizeKB))} KB</span><span class="time">${esc(fmtTime(f.updatedAt))}</span></div>`
        ).join("") : '<div class="empty" style="padding:22px">（空）</div>'}
      </div>`;
  }

  /* ---------- 设计图/设计稿资源加载与预览 ---------- */
  async function fillDesignAssets() {
    for (const img of $root().querySelectorAll("img[data-uri]")) {
      const uri = img.dataset.uri;
      try {
        let dataUrl = imgCache.get(uri);
        if (dataUrl === undefined) {
          const res = await app.readServerResource({ uri });
          const c = res?.contents?.[0];
          dataUrl = c?.blob ? `data:${c.mimeType ?? "image/png"};base64,${c.blob}` : null;
          imgCache.set(uri, dataUrl);
        }
        if (dataUrl) {
          img.src = dataUrl;
          img.closest(".png-card")?.setAttribute("data-ok", "1");
        } else img.replaceWith(Object.assign(document.createElement("div"), { className: "muted", textContent: "图片加载失败" }));
      } catch (err) {
        img.replaceWith(Object.assign(document.createElement("div"), { className: "muted", textContent: `加载失败：${String(err.message ?? err).slice(0, 80)}` }));
      }
    }
  }

  async function previewMockup(name) {
    let html;
    try {
      if (DEMO) {
        html = DEMO_MOCKUP_HTML.replace(/__NAME__/g, name);
      } else {
        let text = mockCache.get(`mock:${name}`);
        if (text === undefined) {
          const res = await app.readServerResource({ uri: `ui://wudi-coding/mockup/${name}` });
          text = res?.contents?.[0]?.text ?? null;
          mockCache.set(`mock:${name}`, text);
        }
        if (!text) throw new Error("设计稿内容为空");
        html = text;
      }
    } catch (err) {
      state.notice = { kind: "err", text: `预览加载失败：${String(err.message ?? err).slice(0, 200)}` };
      render();
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="dialog" style="width:min(860px, calc(100vw - 40px));height:82vh;display:flex;flex-direction:column">
      <div class="btnrow" style="justify-content:space-between"><h3 style="margin:0">${esc(name)}</h3><button class="btn" id="mp-close">关闭</button></div>
      <iframe id="mp-frame" style="flex:1;margin-top:10px;border:1px solid var(--border);border-radius:10px;background:#fff" sandbox="allow-same-origin"></iframe>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });
    overlay.querySelector("#mp-close").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#mp-frame").srcdoc = html;
  }

  function previewImage(dataUrl, name) {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div style="max-width:92vw;max-height:90vh;display:flex;flex-direction:column;gap:8px">
      <div class="btnrow" style="justify-content:space-between"><span class="mono" style="color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6)">${esc(name)}</span><button class="btn" id="pv-close">关闭</button></div>
      <img src="${esc(dataUrl)}" style="max-width:92vw;max-height:82vh;border-radius:12px;box-shadow:var(--shadow-2)">
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (ev) => { if (ev.target === overlay) overlay.remove(); });
    overlay.querySelector("#pv-close").addEventListener("click", () => overlay.remove());
  }

  function renderDocs() {
    const docs = state.data?.docs ?? [];
    return `<div class="card"><h3>文档库（.wudi/docs.json）<span class="line"></span></h3>
      <div class="btnrow" style="margin-bottom:8px">
        <button class="btn" id="btn-weekly" ${state.busy ? "disabled" : ""}>生成周报</button>
        <span class="muted">从 git log 生成近 7 天周报草稿并登记</span>
      </div>
      ${docs.length ? docs.map((d) =>
        `<div class="row clickable" data-path="${esc(d.path)}" title="点击让 Agent 打开并简介这份文档"><span class="badge neutral">${esc(TYPE_ZH[d.type] ?? d.type)}</span><span class="path">${esc(d.path)}</span><span class="time">${esc(fmtTime(d.updatedAt))}</span></div>`
      ).join("") : `<div class="empty" style="padding:22px">还没有登记文档。执行 <span class="mono">/wudi-docs</span> 生成后自动登记。</div>`}
    </div>`;
  }

  /* ---------- 动作 ---------- */
  function envArg() {
    return state.env ? { env: state.env } : {};
  }

  function bindActions() {
    document.getElementById("btn-padd")?.addEventListener("click", async () => {
      const path = String(document.getElementById("p-path")?.value ?? "").trim();
      const name = String(document.getElementById("p-name")?.value ?? "").trim();
      if (!path) { state.notice = { kind: "err", text: "请填项目根目录绝对路径。" }; render(); return; }
      setBusy(true);
      try {
        await callTool("wudi_projects_add", { path, ...(name ? { name } : {}) });
        state.notice = null;
        await loadAll();
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 500) };
        setBusy(false);
      }
    });
    $root().querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (!confirm("从注册表移除该项目？（不影响项目文件）")) return;
        setBusy(true);
        try { await callTool("wudi_projects_remove", { id: b.dataset.remove }); await loadAll(); } catch (err) {
          state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 400) };
          setBusy(false);
        }
      })
    );
    $root().querySelectorAll(".pcard").forEach((card) =>
      card.addEventListener("click", () => {
        const pid = card.dataset.pid;
        const p = (state.projects?.projects ?? []).find((x) => x.id === pid);
        if (!p) return;
        if (card.dataset.current === "1") {
          state.drill = null;
          state.view = "detail";
          state.tab = "overview";
          render();
          saveWidgetState();
        } else {
          state.drill = p;
          render();
          saveWidgetState();
        }
      })
    );
    $root().querySelectorAll("[data-env]").forEach((b) =>
      b.addEventListener("click", () => { state.env = b.dataset.env; state.notice = null; loadAll(); })
    );
    document.getElementById("btn-ping")?.addEventListener("click", async () => {
      const out = document.getElementById("ping-result");
      out.innerHTML = '<span class="spin"></span>测试中…';
      try {
        const r = struct(await callTool("wudi_ssh_ping", envArg()));
        out.textContent = `SSH 连通 ✓ ${r?.ping?.host ?? ""}，延迟 ${r?.ping?.latencyMs ?? "?"}ms`;
      } catch (err) {
        out.textContent = `SSH 失败：${String(err.message ?? err).slice(0, 160)}`;
      }
    });
    document.getElementById("btn-notify-test")?.addEventListener("click", async () => {
      const out = document.getElementById("ping-result");
      out.innerHTML = '<span class="spin"></span>发送测试通知…';
      try {
        const res = await callTool("wudi_notify_test", envArg());
        out.textContent = res.content?.map((c) => c.text).join(" ") ?? "已发送";
      } catch (err) {
        out.textContent = `通知：${String(err.message ?? err).slice(0, 160)}`;
      }
    });
    document.getElementById("btn-health")?.addEventListener("click", async () => {
      setBusy(true);
      try {
        const res = await callTool("wudi_health_check", envArg());
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "通过" };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 800) };
      }
      setBusy(false);
    });
    document.getElementById("btn-rollback")?.addEventListener("click", () =>
      openActionDialog({
        title: "回滚预检计划", confirmLabel: "确认回滚",
        planTool: "wudi_rollback", planArgs: envArg(),
        confirmTool: "wudi_rollback", confirmArgs: envArg(),
        successText: "回滚完成",
      })
    );
    document.getElementById("btn-deploy")?.addEventListener("click", async () => {
      const policy = state.data?.resolved?.deployPolicy ?? "confirm";
      const hasWord = !!state.data?.resolved?.confirmWord;
      if (policy === "direct" && !hasWord) {
        setBusy(true);
        try {
          const res = await callTool("wudi_deploy", { ...envArg(), confirm: true });
          state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "部署完成" };
        } catch (err) {
          state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 800) };
        }
        await loadAll();
        return;
      }
      openActionDialog({
        title: "部署预检计划", confirmLabel: "确认部署",
        planTool: "wudi_deploy", planArgs: envArg(),
        confirmTool: "wudi_deploy", confirmArgs: envArg(),
        successText: "部署完成", confirmWord: true,
      });
    });
    document.getElementById("btn-init")?.addEventListener("click", async () => {
      const val = (id) => String(document.getElementById(id)?.value ?? "").trim();
      const name = val("f-name");
      const build = val("f-build");
      const deployRoot = val("f-root");
      if (!name || !build || !deployRoot) {
        state.notice = { kind: "err", text: "项目名、构建命令、部署根目录为必填项。" };
        render();
        return;
      }
      setBusy(true);
      try {
        const ptype = val("f-ptype");
        await callTool("wudi_project_init", {
          name, techStack: val("f-tech"), build,
          packageType: ptype,
          ...(ptype === "docker-image" ? { dockerImage: val("f-ppath") } : { packagePath: val("f-ppath") || "dist" }),
          deployRoot, remoteScript: val("f-script"), healthCheckUrl: val("f-health"),
        });
        state.notice = { kind: "ok", text: "档案已建立，开始使用！" };
        await loadAll();
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 500) };
        setBusy(false);
      }
    });
    document.getElementById("btn-weekly")?.addEventListener("click", async () => {
      setBusy(true);
      try {
        const res = await callTool("wudi_docs_weekly", {});
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "周报已生成" };
        await loadAll();
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 500) };
        setBusy(false);
      }
    });
    $root().querySelectorAll(".row.clickable").forEach((el) =>
      el.addEventListener("click", async () => {
        const path = el.dataset.path;
        try {
          if (!app.getHostCapabilities()?.message) {
            state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里直接让 Agent 打开该文档。" };
            render();
            return;
          }
          await app.sendMessage({ role: "user", content: { type: "text", text: `请打开 ${path} 并给我一个三句话以内的简介。` } });
        } catch (err) {
          state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
          render();
        }
      })
    );
  }

  /** 通用两步审批流：先调 planTool（confirm 缺省 → 只出计划），对话框展示计划，确认后带 confirm=true 执行。 */
  async function openActionDialog({ title, confirmLabel, planTool, planArgs, confirmTool, confirmArgs, successText, confirmWord = false }) {
    setBusy(true);
    let planText = "预检失败";
    try {
      const res = await callTool(planTool, planArgs ?? {});
      planText = res.content?.map((c) => c.text).join("\n") ?? "";
    } catch (err) {
      state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 800) };
      setBusy(false);
      return;
    }
    setBusy(false);
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="dialog">
      <h3>${esc(title)}</h3>
      <pre>${esc(planText)}</pre>
      ${confirmWord ? `<div style="margin:8px 0"><label class="muted" for="dlg-word">确认词（目标环境配置了 confirmWord 时必填，未配置留空）</label><br><input id="dlg-word" style="margin-top:4px" placeholder="prod 等环境的二次确认词" autocomplete="off"></div>` : ""}
      <div class="btnrow"><button class="btn" id="dlg-cancel">取消</button><button class="btn ${confirmLabel.includes("回滚") ? "danger" : "primary"}" id="dlg-go">${esc(confirmLabel)}</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#dlg-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#dlg-go").addEventListener("click", async () => {
      const word = confirmWord ? String(overlay.querySelector("#dlg-word")?.value ?? "").trim() : "";
      overlay.remove();
      setBusy(true);
      try {
        const res = await callTool(confirmTool, { ...(confirmArgs ?? {}), confirm: true, ...(confirmWord && word ? { confirmWord: word } : {}) });
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? successText };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 800) };
      }
      await loadAll();
    });
  }

  function setBusy(v) {
    state.busy = v;
    render();
  }

  /* ---------- 数据 ---------- */
  async function loadProjects() {
    if (DEMO) return; // demo 数据已在 loadDemoData 填好，勿被无宿主的加载失败覆盖
    try {
      const res = await callTool("wudi_projects_list", {});
      state.projects = struct(res);
    } catch { /* 保留旧数据 */ }
    if (state.view === "projects" && !state.drill) render();
  }

  async function loadDesign() {
    if (DEMO) return;
    state.design = null;
    try {
      const [tokensRes, listRes] = await Promise.all([
        callTool("wudi_design_tokens_get", {}).catch(() => null),
        callTool("wudi_design_list", {}).catch(() => null),
      ]);
      state.design = {
        tokens: tokensRes?.structuredContent?.tokens ?? null,
        files: listRes?.structuredContent?.files ?? [],
      };
    } catch {
      state.design = { tokens: null, files: [] };
    }
    if (state.tab === "design" && state.view === "detail") render();
  }

  async function loadAll() {
    if (DEMO) return;
    setBusy(true);
    try {
      const envArg = state.env ? { env: state.env } : {};
      const status = await callTool("wudi_status", { ...envArg, deployLimit: 5 });
      state.data = struct(status);
      state.notice = null;
      try {
        const history = await callTool("wudi_deploy_history", { limit: 10 });
        state.history = struct(history);
      } catch { state.history = null; }
    } catch (err) {
      state.notice = { kind: "err", text: `加载数据失败：${String(err.message ?? err).slice(0, 500)}` };
    }
    setBusy(false);
    if (state.view === "projects") loadProjects();
  }

  /* ---------- demo 模式（#demo：无宿主时用模拟数据渲染完整 UI，供视觉迭代） ---------- */
  function loadDemoData() {
    const now = Date.now();
    const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
    state.projects = {
      projects: [
        { id: "d1", name: "zongheng-app", path: "/Users/me/code/zongheng-app", isCurrent: true, archived: true, techStack: "ios-swift", envNames: ["staging", "prod"], docsCount: 6, designCount: 9, addedAt: iso(9000), lastDeploy: { release: "20261101-2201", type: "deploy", status: "ok", env: "prod", finishedAt: iso(300) } },
        { id: "d2", name: "zongheng-serve", path: "/Users/me/code/zongheng-serve", isCurrent: false, archived: true, techStack: "go-sponge", envNames: ["prod"], docsCount: 4, designCount: 0, addedAt: iso(8000), lastDeploy: { release: "20261031-1830", type: "rollback", status: "ok", env: "prod", finishedAt: iso(1500) } },
        { id: "d3", name: "freebound-mini", path: "/Users/me/code/freebound-mini", isCurrent: false, archived: false, techStack: "", envNames: [], docsCount: 0, designCount: 0, addedAt: iso(60), lastDeploy: null },
      ],
    };
    state.data = {
      project: { name: "zongheng-app", techStack: "ios-swift", build: "xcodebuild -scheme App", package: { type: "dir", path: "build/" }, deployRoot: "/srv/zongheng", remoteScript: "docker compose up -d", healthCheck: { url: "http://127.0.0.1:8080/healthz", expect: 200, checkFrom: "local" } },
      envs: ["staging", "prod"], currentEnv: "prod",
      resolved: { name: "prod", deployRoot: "/srv/zongheng", remoteScript: "docker compose up -d", deployPolicy: "confirm", confirmWord: "", healthCheck: { url: "http://127.0.0.1:8080/healthz", expect: 200, checkFrom: "local" } },
      deploys: [
        { release: "20261101-2201", type: "deploy", status: "ok", env: "prod", startedAt: iso(305), finishedAt: iso(300), health: { ok: true, status: 200, via: "local", attempts: 1 }, stages: [ { name: "build", status: "ok", detail: "构建完成", durationMs: 42000 }, { name: "package", status: "ok", detail: "", durationMs: 3100 }, { name: "upload", status: "ok", detail: "上传 48.2 MB → /srv/zongheng/releases/20261101-2201/bundle.tar.gz", durationMs: 61000 }, { name: "remote", status: "ok", detail: "软链已切换 + 执行 docker compose up -d", durationMs: 8200 }, { name: "verify", status: "ok", detail: "健康检查通过（1 次内）", durationMs: 240 } ] },
        { release: "20261101-1533", type: "deploy", status: "failed", env: "staging", startedAt: iso(800), finishedAt: iso(795), failedStage: "verify", stages: [ { name: "build", status: "ok", detail: "构建完成", durationMs: 39000 }, { name: "verify", status: "failed", detail: "健康检查未通过（3 次尝试）", durationMs: 15200 } ] },
        { release: "20261031-1830", type: "rollback", status: "ok", env: "prod", startedAt: iso(1500), finishedAt: iso(1498), health: { ok: true, status: 200, via: "remote", attempts: 1 }, stages: [ { name: "switch", status: "ok", detail: "current → 20261031-1102", durationMs: 210 } ] },
      ],
      docs: [
        { path: "docs/api.md", type: "api", updatedAt: iso(2000) },
        { path: "docs/weekly/2026-W44.md", type: "weekly", updatedAt: iso(400) },
        { path: "README.md", type: "readme", updatedAt: iso(5000) },
      ],
    };
    state.history = { deploys: state.data.deploys };
    state.design = {
      tokens: {
        color: { primary: "#3565f0", accent: "#7c5cf0", text: "#171a21", bg: "#ffffff", ok: "#0e8a4f", err: "#c73a33" },
        spacing: { sm: "8px", md: "16px", lg: "24px" },
        radius: { md: "12px" },
        typography: { "font-size-base": "13px" },
      },
      files: [
        { path: ".wudi/design/mockups/workbench-v3.html", sizeKB: 48.2, updatedAt: iso(120) },
        { path: ".wudi/design/mockups/workbench-v2.html", sizeKB: 44.1, updatedAt: iso(300) },
        { path: ".wudi/design/figma/workbench-home.png", sizeKB: 320.5, updatedAt: iso(90) },
        { path: ".wudi/design/figma/deploy-flow.png", sizeKB: 210.2, updatedAt: iso(95) },
        { path: ".wudi/design/tokens.json", sizeKB: 0.8, updatedAt: iso(130) },
        { path: ".wudi/design/tokens.css", sizeKB: 0.5, updatedAt: iso(130) },
      ],
    };
  }

  /* ---------- 启动 ---------- */
  function renderFatal(err) {
    $root().innerHTML = `<div class="container"><div class="empty" style="margin-top:40px">面板无法连接宿主：${esc(String(err?.message ?? err))}<br><span class="muted">请重开会话，或检查插件版本与宿主兼容性。视觉预览可在地址加 #demo。</span></div></div>`;
    reportSize();
  }

  async function main() {
    applyTheme();
    const ws = app.getHostContext()?.widgetState;
    if (ws && ["projects", "overview", "deploys", "design", "docs"].includes(ws.tab)) {
      state.tab = ws.tab;
      state.view = ws.tab === "projects" ? "projects" : "detail";
    }
    if (DEMO) {
      state.connected = true; // demo 模式不连宿主，但允许 reportSize
      loadDemoData();
      render();
      return;
    }
    render(); // 先出骨架
    try {
      await app.connect();
      state.connected = true;
    } catch (err) {
      renderFatal(err);
      return;
    }
    applyTheme();
    await loadAll();
    if (state.view === "projects") loadProjects();
  }

  app.onteardown = () => { /* 面板无持久资源需释放 */ };
  main();
})();
