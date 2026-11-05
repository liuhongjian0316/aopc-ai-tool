/* 无敌编程工作台面板逻辑 v0.34（vanilla JS，与 vendor SDK 拼接进同一 module，经 scripts/build.mjs 组装进 dist/ui/panel.html）。
 * 通信走官方 @modelcontextprotocol/ext-apps SDK；遵循 obsidian-kb 踩坑结论：tools/list 全量声明、
 * 主题跟随 hostContext、widgetState 存视图状态、connect 前不发通知。
 * IA：打开即项目选择/创建页（项目网格 + 登记入口）→ 选中项目后才进入项目内容
 * （总览 / 部署 / 设计 / 画布 / 文档，当前项目操作页）+ 非当前项目只读下钻。
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
    "workbench-home.png": "#0066dd",
    "deploy-flow.png": "linear-gradient(135deg,#0e8a4f,#0066dd)",
  };
  const DEMO_MOCKUP_HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>__NAME__</title><style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,"PingFang SC",sans-serif}
  body{background:#f4f6fa;padding:24px;color:#171a21}
  .top{display:flex;align-items:center;gap:10px;margin-bottom:20px}.logo{width:34px;height:34px;border-radius:10px;background:#0066dd;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
  h1{font-size:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .c{background:#fff;border:1px solid #e3e7ee;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(16,24,40,.06)}
  .c b{font-size:13px}.num{font-size:26px;font-weight:800;margin:8px 0 2px;background:#0066dd;-webkit-background-clip:text;background-clip:text;color:transparent}
  .muted{color:#8a93a3;font-size:11px}.btn{display:inline-block;margin-top:10px;padding:7px 16px;border-radius:8px;background:#0066dd;color:#fff;font-size:12px;font-weight:600}
  </style></head><body>
  <div class="top"><div class="logo">无敌</div><div><h1>__NAME__ 设计稿预览</h1><div class="muted">工作台 · 项目管理 · 部署 · 1440 设计画布</div></div></div>
  <div class="grid">
    <div class="c"><b>项目总览</b><div class="num">3</div><div class="muted">进行中的项目</div><span class="btn">查看全部</span></div>
    <div class="c"><b>本周部署</b><div class="num">5</div><div class="muted">成功率 96%</div><span class="btn">部署记录</span></div>
    <div class="c"><b>健康检查</b><div class="num">200</div><div class="muted">全部通过</div><span class="btn">体检报告</span></div>
  </div></body></html>`;
  const app = new App(
    { name: "wudi-coding", version: "0.34.0" },
    { availableDisplayModes: ["inline", "fullscreen"] }
  );
  /* 资源缓存：设计图 base64 与设计稿 HTML 文本（readServerResource 经 server 动态资源管线） */
  const imgCache = new Map();
  const mockCache = new Map();

  const state = {
    view: "projects",  // 打开先见项目选择/创建页；点项目卡片选中后才进入项目内容（v0.31）
    drill: null,       // 非当前项目的只读下钻（registry summary）
    tab: "overview",
    createOpen: false, // landing 登记项目表单展开态（无项目时强制展开）
    envs: [],
    env: "",
    data: null,        // wudi_status structuredContent
    history: null,     // wudi_deploy_history structuredContent
    projects: null,    // wudi_projects_list structuredContent {projects}
    design: null,      // {tokens, files}
    canvas: { frames: [], shapes: [] }, // 设计画布（Agent 与面板共享）
    cv: { tx: 40, ty: 40, scale: 1 },   // 画布视口（平移/缩放），必须初始化否则 canvas 页首渲染即崩
    canvasSel: "",
    canvasMulti: [],   // 多选附加 id（框选/Shift 加选）
    marquee: null,     // 框选矩形 {x,y,w,h}
    canvasTool: "select",
    canvasStamp: "",   // 组件戳：button/input/card/heading/body/divider
    canvasFill: "#dbe4fd",
    canvasBusy: false,
    designs: null,     // wudi_designs_list structuredContent {designs}
    figmaUrl: "",
    opEmbed: null,     // 内嵌 OpenPencil 编辑器会话 {path}（overlay 层，不参与 render 循环）
    opFrameOrigin: "", // 内嵌编辑器 iframe 的 http origin（wudi 协同桥）
    canvasCreateOpen: false, // 设计页「新建画布」表单展开态
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

  /* 下一步建议：按项目状态给出可执行动作（点按钮直达） */
  function nextActions(p) {
    if (!p) return "";
    const acts = [];
    const resolved = state.data?.resolved;
    const deploys = state.history?.deploys ?? state.data?.deploys ?? [];
    if (!p.build) acts.push(["补构建命令", "流水线配置缺 build —— 用顶部快速建档补全", "hint"]);
    if (!resolved?.deployRoot) acts.push(["补部署目标", "档案缺 deployRoot，部署流水线无法启动", "hint"]);
    if (!resolved?.healthCheck?.url) acts.push(["配健康检查", "没有健康检查 URL，部署将跳过线上验证", "hint"]);
    if (p.build && resolved?.deployRoot && !deploys.length) acts.push(["首次部署", "一切就绪，去「部署」页走五阶段流水线", "goto-deploys"]);
    if (deploys.length) {
      const last = deploys[0];
      if (last.status === "failed") acts.push(["排查上次失败", `版本 ${last.release ?? ""} 部署失败（${last.failedStage ?? "?"}）—— 去「部署」页健康检查或回滚`, "goto-deploys"]);
    }
    if (!state.design?.tokens) acts.push(["沉淀 design tokens", "去「设计」页用 /wudi-ui 或 OpenPencil design_to_tokens 建立", "goto-design"]);
    if (!(state.data?.docs ?? []).length) acts.push(["生成首批文档", "README / API / 周报，去「文档」页一键生成", "goto-docs"]);
    if (!acts.length) return "";
    return `<div class="card"><h3>下一步<span class="line"></span></h3>
      <div class="btnrow">${acts.slice(0, 4).map(([label, tip, act]) =>
        `<button class="btn" data-act="${esc(act)}" title="${esc(tip)}">${esc(label)}</button>`).join("")}</div>
      <div class="muted" style="margin-top:8px">${esc(acts[0]?.[1] ?? "")}</div>
    </div>`;
  }

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
    if (Array.isArray(sc.designs)) state.designs = { designs: sc.designs };
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
    try {
      renderInner();
    } catch (err) {
      try { app.sendLog?.({ level: "error", data: `[wudi] render 失败: ${String(err?.stack ?? err).slice(0, 600)}` }); } catch {}
      const el = document.getElementById("root");
      if (el) el.innerHTML = `<div class="container"><div class="empty" style="margin-top:40px">面板渲染出错：${esc(String(err?.message ?? err))}<br><span class="muted">点「重新加载」或重开会话；详情见开发者工具。</span></div></div>`;
    }
  }

  function renderInner() {
    const inProject = state.view === "detail" && !state.drill;
    /* 项目内容导航只在选中项目后出现；landing / 下钻页不显示内容页签 */
    const navTabs = [
      ["projects", "项目", ICONS.projects, (state.projects?.projects ?? []).length || ""],
      ["overview", "总览", ICONS.overview, ""],
      ["deploys", "部署", ICONS.deploys, ""],
      ["design", "设计", ICONS.design, ""],
      ["canvas", "画布", '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M11.2 1.6a2 2 0 0 1 2.83 0l.37.37a2 2 0 0 1 0 2.83L6.4 12.8l-4.03 1.34a.5.5 0 0 1-.63-.63L3.07 9.6l8.13-8Zm-6.9 9.06-.7 2.1 2.1-.7-1.4-1.4Z"/></svg>', ""],
      ["docs", "文档", ICONS.docs, (state.data?.docs ?? []).length || ""],
    ];
    const nav = inProject ? navTabs.map(([id, label, icon, count]) =>
      `<button data-tab="${id}" class="${(state.view === "projects" ? "projects" : state.tab) === id ? "active" : ""}">${icon}${label}${count !== "" ? `<span class="count">${esc(String(count))}</span>` : ""}</button>`
    ).join("") : "";

    let body;
    if (state.view === "projects" && !state.drill) body = renderProjects();
    else if (state.drill) body = renderDrill();
    else body = state.tab === "overview" ? renderOverview(state.data?.project ?? null)
      : state.tab === "deploys" ? renderDeploys()
      : state.tab === "design" ? renderDesign()
      : state.tab === "canvas" ? renderCanvas()
      : renderDocs();

    const sub = state.drill ? `${esc(state.drill.name)} · 只读总览`
      : inProject ? esc(state.data?.project?.name || "当前项目")
      : "选择一个项目进入，或登记新项目";
    $root().innerHTML = `
      <div class="container">
        <div class="masthead">
          <div class="brand">
            <div class="logo">无敌</div>
            <div><h1>无敌编程工作台</h1><div class="sub">${sub}</div></div>
          </div>
          <span class="spacer"></span>
          <button class="btn" id="btn-refresh" ${state.busy ? "disabled" : ""}>${state.busy ? '<span class="spin"></span>' : ""}刷新</button>
        </div>
        ${state.drill ? `<div style="margin-bottom:10px"><button class="backlink" id="btn-back">← 返回项目列表</button></div>` : ""}
        ${inProject ? `<div style="margin-bottom:10px"><button class="backlink" id="btn-back-projects">← 项目列表</button></div><div class="nav">${nav}</div>` : ""}
        ${state.notice ? `<div class="notice ${state.notice.kind}"><span class="badge ${state.notice.kind}">${state.notice.kind === "ok" ? "完成" : "失败"}</span><span class="mono">${esc(state.notice.text)}</span></div>` : ""}
        ${body}
      </div>`;
    $root().querySelectorAll("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.drill = null;
        state.view = b.dataset.tab === "projects" ? "projects" : "detail";
        state.tab = b.dataset.tab === "projects" ? state.tab : b.dataset.tab;
        state.notice = null;
        if (state.tab === "design" && state.view === "detail") loadDesign({ autoEnter: true });
        if (state.tab === "canvas" && state.view === "detail") loadCanvas();
        if (state.view === "projects") loadProjects();
        render();
        saveWidgetState();
      })
    );
    document.getElementById("btn-refresh")?.addEventListener("click", () => {
      state.drill = null;
      loadAll();
      if (state.view === "detail" && state.tab === "design") loadDesign();
      if (state.view === "detail" && state.tab === "canvas") loadCanvas();
    });
    document.getElementById("btn-back")?.addEventListener("click", () => { state.drill = null; render(); saveWidgetState(); });
    document.getElementById("btn-back-projects")?.addEventListener("click", () => {
      state.view = "projects";
      state.tab = "overview";
      state.notice = null;
      render();
      saveWidgetState();
    });
    bindActions();
    if (state.view === "detail" && state.tab === "design") {
      fillDesignAssets();
      $root().querySelectorAll(".mock-card").forEach((c) => c.addEventListener("click", () => previewMockup(c.dataset.mock)));
      $root().querySelectorAll(".png-card[data-ok]").forEach((c) =>
        c.addEventListener("click", () => {
          if (DEMO) {
            const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#0066dd'/><stop offset='1' stop-color='#0047a3'/></linearGradient></defs><rect width='800' height='500' fill='url(%23g)'/><text x='400' y='255' font-family='sans-serif' font-size='28' fill='white' text-anchor='middle'>${esc(c.dataset.png)}（demo 占位图）</text></svg>`;
            previewImage(`data:image/svg+xml;charset=utf-8,${svg}`, c.dataset.png);
            return;
          }
          previewImage(imgCache.get(c.dataset.png), c.dataset.png);
        })
      );
    }
    if (state.view === "detail" && state.tab === "canvas") bindCanvas();
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
    /* 首次加载：注册表还没回来时显示加载态，避免闪「还没有项目」空态 */
    if (projects === undefined && !DEMO) {
      return `<div class="empty"><span class="spin"></span>正在加载项目列表…</div>`;
    }
    const list = projects ?? [];
    const cards = list.map((p) => `
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
        ${p.isCurrent ? '<div class="cta">进入项目内容 →</div>' : ""}
      </div>`).join("");
    /* 「＋ 登记项目」虚线卡：点开展开登记表单（也是页面上唯一的创建入口） */
    const addCard = `
      <div class="pcard add" data-add="1" title="登记一个项目目录到工作台">
        <div class="pname">＋ 登记项目</div>
        <div class="ppath">把项目根目录加入工作台</div>
      </div>`;
    const showForm = state.createOpen || !list.length;
    const form = showForm ? `
      <div class="card" style="margin-top:12px">
        <h3>登记项目<span class="line"></span>${list.length ? '<button class="btn" id="btn-pcollapse">收起</button>' : ""}</h3>
        <div class="kv">
          <span class="k">项目路径</span><span class="v"><input id="p-path" placeholder="/Users/me/code/my-app（绝对路径）"></span>
          <span class="k">显示名</span><span class="v"><input id="p-name" placeholder="缺省取目录名"></span>
        </div>
        <div class="btnrow" style="margin-top:10px"><button class="btn primary" id="btn-padd" ${state.busy ? "disabled" : ""}>登记</button><span class="muted">登记后回到这里选择进入；部署操作仍在该项目工作区进行</span></div>
      </div>` : "";
    return `
      ${list.length ? `<div class="grid">${cards}${addCard}</div>` : `
        <div class="empty"><div class="icon"></div>工作台还没有项目。在下方登记第一个项目目录，<br>当前工作区项目会在打开面板时自动登记。</div>`}
      ${form}`;
  }

  function renderDrill() {
    const p = state.drill;
    const last = p.lastDeploy;
    return `
      <div class="banner">
        <div class="row"><h2>${esc(p.name)}</h2>${p.isCurrent ? '<span class="chip">当前工作区</span>' : ""}</div>
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
        <div class="row"><h2>${esc(p.name || "(未命名)")}</h2><span class="chip">${esc(latest ? STATUS_ZH[latest.status] ?? latest.status : "未部署")}</span></div>
        <div class="meta">
          ${p.techStack ? `<span class="chip">${esc(p.techStack)}</span>` : ""}
          ${(state.data?.envs ?? []).map((e) => `<span class="chip">${esc(e)}${state.data.currentEnv === e ? " ✓" : ""}</span>`).join("")}
          <span class="chip">${p.package?.type === "docker-image" ? "Docker" : "静态/目录"}</span>
          <span class="chip">策略 ${esc(resolved?.deployPolicy ?? "confirm")}</span>
        </div>
      </div>
      ${statTiles}
      ${nextActions(p)}
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
    const tokens = design.tokens;
    const canvases = state.designs?.designs ?? [];

    /* ---------- 主区：项目画布（设计页 = 画布；所有 UI 设计都在画布里） ---------- */
    const canvasCards = canvases.map((d) => `
      <div class="pcard cvcard" data-cv-open="${esc(d.path)}" title="进入画布编辑">
        <div class="pname">${esc(String(d.name).replace(/\.(fig|pen)$/i, ""))}</div>
        <div class="ppath">${esc(d.path)} · ${esc(String(d.sizeKB))} KB</div>
        <div class="stats"><span class="chip accent">${esc(d.format)}</span>${state.opEmbed?.path === d.path ? '<span class="chip">编辑中</span>' : ""}</div>
        <div class="foot">${esc(fmtTime(d.updatedAt))}<span style="flex:1"></span><b class="cta-inline">进入画布 →</b></div>
      </div>`).join("");
    const createRow = `
      <div class="card" style="margin-top:12px">
        <h3>新建画布<span class="line"></span></h3>
        <div class="btnrow">
          <input id="op-name" placeholder="画布名称，如 UI / 官网 / App（可留空）" style="width:260px;flex:none">
          <button class="btn primary" id="btn-op-new" ${state.busy ? "disabled" : ""}>创建画布</button>
          <span class="muted">一个画布容纳这个项目的全部 UI 设计：网站 1440 / 移动端 375 / 平板 768 各建画板</span>
        </div>
      </div>`;
    const canvasSection = canvases.length
      ? `<div class="card"><h3 style="color:var(--accent-strong)">项目画布<span class="line"></span><span class="muted" style="text-transform:none;letter-spacing:0">点画布进入编辑器 · Agent 实时协同</span></h3>
          <div class="grid">${canvasCards}</div>
          ${state.canvasCreateOpen ? createRow : `<div class="btnrow" style="margin-top:10px"><button class="btn" id="btn-cv-create-toggle">＋ 新建画布</button><span class="muted">画布即 designs/&lt;名称&gt;.fig；没有画布时进入设计页会直接引导创建</span></div>`}
        </div>`
      : `<div class="empty cv-empty">
          <div class="cv-empty-title">创建项目画布</div>
          <div class="muted" style="margin-bottom:14px">画布里放这个项目的所有 UI 设计：移动端、网站、后台……<br>每个界面一个画板，Agent 可以和你一起在画布上实时设计。</div>
          <div class="btnrow" style="justify-content:center">
            <input id="op-name" placeholder="画布名称（可留空）" style="width:220px">
            <button class="btn primary" id="btn-op-new" ${state.busy ? "disabled" : ""}>创建画布</button>
          </div>
          <div class="muted" style="margin-top:10px">创建后自动进入编辑器，无需任何额外配置</div>
        </div>`;

    /* ---------- 折叠区一：设计资产（HTML 设计稿 / 图墙 / tokens / 全部产物） ---------- */
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
    const pngGroups = [];
    for (const f of pngs) {
      const name = String(f.path).split("/").pop();
      const group = name.replace(/-[0-9a-z]+\.png$/i, "");
      const last = pngGroups.at(-1);
      if (last && last.group === group) last.items.push({ f, name });
      else pngGroups.push({ group, items: [{ f, name }] });
    }
    const pngWall = pngs.length
      ? `<div>${pngGroups.map((g) => `
        <div class="muted" style="margin:10px 0 6px;font-weight:650">▸ ${esc(g.group)}（${g.items.length}）</div>
        <div class="pngs">${g.items.map(({ f, name }) => {
          if (DEMO) {
            return `<div class="png-card" data-png="${esc(name)}" data-ok="1"><div class="png-ph" style="background:${esc(DEMO_PNG_GRADIENTS[name] ?? "#0066dd")};height:110px"></div><div class="meta">${esc(name)}</div></div>`;
          }
          return `<div class="png-card" data-png="${esc(name)}"><img data-uri="ui://wudi-coding/image/${esc(name)}" alt="${esc(name)}"><div class="meta">${esc(name)}</div></div>`;
        }).join("")}</div>`).join("")}</div>`
      : "";
    const colorEntries = Object.entries(tokens?.color ?? {});
    const palette = colorEntries.length
      ? `<div class="card"><h3>色板<span class="line"></span><button class="btn" id="btn-tokens-edit" style="margin-left:auto">编辑 JSON</button></h3><div class="swatches">${colorEntries.map(([k, v]) =>
          `<div class="swatch"><div class="color" style="background:${esc(String(v))}"></div><div class="meta"><div class="name">${esc(k)}</div><div class="val">${esc(String(v))}</div></div></div>`
        ).join("")}</div></div>`
      : "";
    const otherTokens = tokens
      ? Object.entries(tokens).filter(([g]) => g !== "color").map(([group, entries]) =>
          `<div class="card"><h3>${esc(group)}<span class="line"></span></h3><div class="kv">${Object.entries(entries ?? {}).map(([k, v]) =>
            `<span class="k">${esc(k)}</span><span class="v">${esc(String(v))}</span>`).join("")}</div></div>`
        ).join("")
      : "";
    const assetsDetails = `
      <details class="card fold">
        <summary>设计资产 · HTML 设计稿 ${mockups.length} · 渲染图 ${pngs.length} · tokens ${colorEntries.length} 色</summary>
        ${mockups.length ? `<h3>HTML 设计稿<span class="line"></span></h3>${mockupCards}<div class="muted" style="margin-top:8px">点击卡片预览完整设计稿</div>` : ""}
        ${pngs.length ? `<h3>设计图<span class="line"></span></h3>${pngWall}<div class="muted" style="margin-top:8px">来自设计稿渲染，点击放大</div>` : ""}
        ${palette}${otherTokens}
        ${!tokens ? '<div class="muted" style="margin:8px 0">还没有 design tokens —— 设计定稿后执行 /wudi-ui 自动沉淀。</div>' : ""}
        <h3>全部产物（新→旧）<span class="line"></span></h3>
        ${files.length ? files.map((f) =>
          `<div class="row"><span class="chip">${String(f.path).endsWith(".html") ? "设计稿" : String(f.path).endsWith(".png") ? "设计图" : "tokens"}</span><span class="path">${esc(f.path)}</span><span class="muted">${esc(String(f.sizeKB))} KB</span><span class="time">${esc(fmtTime(f.updatedAt))}</span></div>`
        ).join("") : '<div class="muted">（空）</div>'}
      </details>`;

    /* ---------- 折叠区二：更多工具（线框转换 / HTML 稿生成 / DesignCraft / Figma） ---------- */
    const toolsDetails = `
      <details class="card fold">
        <summary>更多工具 · 线框转画布 / HTML 设计稿生成 / DesignCraft / Figma</summary>
        <div class="card" style="box-shadow:none"><h3>把无敌线框转入画布<span class="line"></span></h3>
          <div class="btnrow">
            <input id="op-name-wire" placeholder="目标画布名称（可留空）" style="width:200px;flex:none">
            <button class="btn" id="btn-op-wire" ${state.busy ? "disabled" : ""} title="把无敌画布的线框按坐标重建为 .fig 画布（Agent 双工具集转换）">把线框转入 .fig</button>
            <span class="muted">「画布」页的快速线框 → .fig 设计稿</span>
          </div>
        </div>
        <div class="card" style="box-shadow:none"><h3>生成 HTML 设计稿<span class="line"></span></h3>
          <div class="kv">
            <span class="k">页面名称</span><span class="v"><input id="gen-name" placeholder="如 workbench-v4 / settings-page"></span>
            <span class="k">模板类型</span><span class="v"><select id="gen-template" style="font-family:inherit">
              <option value="dashboard">dashboard · 管理后台/工作台</option>
              <option value="landing">landing · 产品落地页</option>
              <option value="mobile">mobile · 移动端 App（375 画布）</option>
            </select></span>
          </div>
          <div class="btnrow" style="margin-top:10px">
            <button class="btn" id="btn-gen" ${state.busy ? "disabled" : ""}>唤起 Agent 生成 HTML 稿</button>
            <button class="btn" id="btn-export" ${state.busy || !tokens ? "disabled" : ""}>导出 tokens.css</button>
            <span class="muted">生成单文件 HTML 设计稿进「设计资产」</span>
          </div>
        </div>
        <div class="card" style="box-shadow:none"><h3>DesignCraft · 完整设计编辑器<span class="line"></span></h3>
          <div class="muted" style="margin-bottom:10px">官方插件：面板内完整设计编辑器，<b>Agent 25 个工具直接读写</b>，渲染 PNG 自动进「设计资产」。需在 AOPC 插件市场安装 designcraft。</div>
          <div class="btnrow">
            <button class="btn" id="btn-dc-new" ${state.busy ? "disabled" : ""}>新建设计文档</button>
            <button class="btn" id="btn-dc-render" ${state.busy ? "disabled" : ""} title="让 Agent 渲染当前页 PNG 到 .wudi/design/renders/">渲染当前页到图库</button>
          </div>
        </div>
        <div class="card" style="box-shadow:none"><h3>Figma · 只读设计源<span class="line"></span></h3>
          <div class="kv">
            <span class="k">文件链接</span><span class="v"><input id="fig-url" placeholder="https://www.figma.com/design/..." value="${esc(state.figmaUrl)}"></span>
          </div>
          <div class="btnrow" style="margin-top:10px">
            <button class="btn" id="btn-fig-open" ${state.figmaUrl ? "" : "disabled"}>在浏览器打开 Figma ↗</button>
            <button class="btn" id="btn-fig-save" ${state.busy ? "disabled" : ""}>保存链接</button>
            <span class="muted">Figma API 只读：Agent 能读设计、改不了文件；要 Agent 参与设计请用项目画布</span>
          </div>
        </div>
      </details>`;

    return `${canvasSection}${assetsDetails}${toolsDetails}`;
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

  function tokensEditDialog() {
    const overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.innerHTML = `<div class="dialog" style="width:min(520px, calc(100vw - 40px))">
      <h3>编辑 design tokens（JSON）</h3>
      <textarea id="tok-editor" style="width:100%;height:300px;font-family:var(--mono);font-size:11.5px;padding:10px;border:1px solid var(--border-strong);border-radius:10px;background:var(--bg-inset);color:var(--text)">${esc(JSON.stringify(state.design?.tokens ?? {}, null, 2))}</textarea>
      <div class="btnrow" style="margin-top:10px"><button class="btn" id="tok-cancel">取消</button><button class="btn primary" id="tok-save">保存并生成 tokens.css</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const ta = overlay.querySelector("#tok-editor");
    ta.focus();
    overlay.querySelector("#tok-cancel").addEventListener("click", () => overlay.remove());
    overlay.querySelector("#tok-save").addEventListener("click", async () => {
      let obj;
      try {
        obj = JSON.parse(ta.value);
      } catch (err) {
        ta.style.borderColor = "var(--err)";
        return;
      }
      overlay.remove();
      setBusy(true);
      try {
        const res = await callTool("wudi_design_tokens_set", { tokens: obj });
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "tokens 已更新" };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 300) };
      }
      await loadDesign();
      setBusy(false);
    });
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

  /* ---------- 设计画布 v2：Figma 式无限画布 + 多画板（Agent 与面板共享） ---------- */
  const CANVAS_TOOLS = [
    ["select", "⭥ 选择"], ["frame", "▣ 画板"], ["rect", "▭ 矩形"], ["ellipse", "◯ 圆"], ["diamond", "◇ 菱形"], ["arrow", "→ 箭头"], ["text", "T 文本"],
  ];
  const FRAME_PRESETS = [["桌面 1440×900", 1440, 900], ["桌面 1280×800", 1280, 800], ["移动 375×812", 375, 812], ["平板 768×1024", 768, 1024]];

  let canvasUndo = [];
  let canvasRedo = [];
  let canvasClip = []; // ⌘C/⌘V 内部剪贴板

  async function loadCanvas() {
    canvasUndo = []; canvasRedo = []; canvasClip = [];
    if (DEMO) { if (!state.canvas.frames?.length) loadDemoCanvas(); render(); return; }
    try {
      const res = await callTool("wudi_canvas_get", {});
      state.canvas = struct(res)?.canvas ?? { frames: [], shapes: [] };
    } catch { /* 保留旧数据 */ }
    render();
  }

  async function canvasSave(ops, opts = {}) {
    if (opts.history !== false) {
      canvasUndo.push(structuredClone(state.canvas));
      if (canvasUndo.length > 50) canvasUndo.shift();
      canvasRedo = [];
    }
    if (DEMO) { applyOpsLocal(ops); render(); return; }
    state.canvasBusy = true;
    try {
      const res = await callTool("wudi_canvas_edit", { ops });
      state.canvas = struct(res)?.canvas ?? state.canvas;
    } catch (err) {
      state.notice = { kind: "err", text: `画布保存失败：${String(err.message ?? err).slice(0, 300)}` };
    }
    state.canvasBusy = false;
    render();
  }

  /** 撤销：弹出上一快照全量替换（不记历史）。 */
  function canvasUndoFn() {
    if (!canvasUndo.length || state.canvasBusy) return;
    canvasRedo.push(structuredClone(state.canvas));
    const snap = canvasUndo.pop();
    canvasSave([{ op: "replace", canvas: snap }], { history: false });
  }

  /** 重做：恢复被撤销的快照。 */
  function canvasRedoFn() {
    if (!canvasRedo.length || state.canvasBusy) return;
    canvasUndo.push(structuredClone(state.canvas));
    const snap = canvasRedo.pop();
    canvasSave([{ op: "replace", canvas: snap }], { history: false });
  }

  function applyOpsLocal(ops) {
    for (const op of ops) {
      if (op.op === "add") state.canvas.shapes.push({ id: op.shape.id || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, ...op.shape });
      else if (op.op === "add_frame") state.canvas.frames.push({ ...op.frame });
      else if (op.op === "update" || op.op === "update_frame") {
        const arr = op.op === "update" ? state.canvas.shapes : state.canvas.frames;
        const i = arr.findIndex((s) => s.id === op.id);
        if (i >= 0) arr[i] = { ...arr[i], ...op.patch };
      } else if (op.op === "delete" || op.op === "delete_frame") {
        const ids = new Set(op.ids ?? [op.id].filter(Boolean));
        if (op.op === "delete") state.canvas.shapes = state.canvas.shapes.filter((s) => !ids.has(s.id));
        else {
          state.canvas.frames = state.canvas.frames.filter((f) => !ids.has(f.id));
          if (op.withShapes) state.canvas.shapes = state.canvas.shapes.filter((s) => !ids.has(s.frameId));
          else for (const s of state.canvas.shapes) if (ids.has(s.frameId)) s.frameId = "";
        }
      }
    }
  }

  function selIds() {
    return [...new Set([state.canvasSel, ...state.canvasMulti])].filter(Boolean);
  }

  /* 组件形状库：每个 stamp 返回一组形状（x,y 为放置原点） */
  function stampShapes(kind, x, y) {
    const P = "#0066dd";
    const DIM = "#8a93a3";
    const BORDER = "#d4dae4";
    const F = state.canvasFill || "#dbe4fd";
    if (kind === "button") return [
      { type: "rect", x, y, w: 120, h: 40, fill: P, stroke: P },
      { type: "text", x: x + 34, y: y + 12, w: 60, h: 18, fill: "#ffffff", text: "按钮", fontSize: 14 },
    ];
    if (kind === "input") return [
      { type: "rect", x, y, w: 200, h: 40, fill: "#ffffff", stroke: BORDER },
      { type: "text", x: x + 10, y: y + 12, w: 160, h: 18, fill: DIM, text: "请输入内容", fontSize: 13 },
    ];
    if (kind === "card") return [
      { type: "rect", x, y, w: 280, h: 180, fill: "#ffffff", stroke: BORDER },
      { type: "text", x: x + 16, y: y + 14, w: 240, h: 22, fill: "#171a21", text: "卡片标题", fontSize: 16 },
      { type: "text", x: x + 16, y: y + 48, w: 248, h: 18, fill: DIM, text: "正文内容，用贴近业务的真实文案", fontSize: 13 },
      { type: "text", x: x + 16, y: y + 72, w: 248, h: 18, fill: DIM, text: "第二行正文，保持信息层级 ≤ 3", fontSize: 13 },
    ];
    if (kind === "heading") return [{ type: "text", x, y, w: 240, h: 34, fill: "#171a21", text: "标题文字", fontSize: 24 }];
    if (kind === "body") return [{ type: "text", x, y, w: 300, h: 20, fill: "#4b5565", text: "正文文字，描述具体内容", fontSize: 14 }];
    if (kind === "divider") return [{ type: "rect", x, y, w: 220, h: 2, fill: BORDER, stroke: BORDER }];
    if (kind === "toggle") return [
      { type: "rect", x, y, w: 44, h: 24, fill: P, stroke: P },
      { type: "ellipse", x: x + 24, y: y + 4, w: 16, h: 16, fill: "#ffffff", stroke: "#ffffff" },
    ];
    if (kind === "checkbox") return [
      { type: "rect", x, y: y + 2, w: 16, h: 16, fill: "#ffffff", stroke: P },
      { type: "text", x: x + 24, y: y, w: 120, h: 18, fill: "#171a21", text: "复选项", fontSize: 13 },
    ];
    if (kind === "avatar") return [
      { type: "ellipse", x, y, w: 48, h: 48, fill: F, stroke: P },
      { type: "text", x: x + 15, y: y + 16, w: 20, h: 18, fill: "#ffffff", text: "人", fontSize: 14 },
    ];
    if (kind === "image") return [
      { type: "rect", x, y, w: 200, h: 140, fill: "#eef1f7", stroke: BORDER },
      { type: "arrow", x: x + 50, y: y + 40, x2: x + 150, y2: y + 100, stroke: BORDER },
      { type: "arrow", x: x + 150, y: y + 40, x2: x + 50, y2: y + 100, stroke: BORDER },
      { type: "text", x: x + 66, y: y + 62, w: 80, h: 16, fill: DIM, text: "图片占位", fontSize: 12 },
    ];
    if (kind === "chart") return [
      { type: "rect", x, y, w: 280, h: 160, fill: "#ffffff", stroke: BORDER },
      { type: "text", x: x + 14, y: y + 12, w: 160, h: 18, fill: DIM, text: "图表占位", fontSize: 13 },
      { type: "rect", x: x + 40, y: y + 100, w: 28, h: 40, fill: P, stroke: P },
      { type: "rect", x: x + 90, y: y + 80, w: 28, h: 60, fill: "#7c5cf0", stroke: "#7c5cf0" },
      { type: "rect", x: x + 140, y: y + 60, w: 28, h: 80, fill: "#0e8a4f", stroke: "#0e8a4f" },
      { type: "rect", x: x + 190, y: y + 90, w: 28, h: 50, fill: "#b45309", stroke: "#b45309" },
    ];
    if (kind === "progress") return [
      { type: "rect", x, y, w: 200, h: 8, fill: "#eef1f7", stroke: "#eef1f7" },
      { type: "rect", x, y, w: 120, h: 8, fill: P, stroke: P },
    ];
    return [];
  }

  function frameNode(f, framesSelected) {
    const shapes = state.canvas.shapes.filter((s) => s.frameId === f.id).map((s) => shapeNode(s, s.id === state.canvasSel)).join("\n");
    const labelSize = 14 / state.cv.scale;
    return `
      <g data-frame="${esc(f.id)}">
        <text data-framelabel="${esc(f.id)}" x="${f.x}" y="${f.y - 6 / state.cv.scale}" font-size="${labelSize}" fill="${framesSelected ? "#0066dd" : "#8a93a3"}" font-family="sans-serif" font-weight="${framesSelected ? 700 : 600}" style="cursor:move">${esc(f.name)} · ${f.w}×${f.h}</text>
        <rect data-framebg="${esc(f.id)}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.background}" stroke="${framesSelected ? "#0066dd" : "#d4dae4"}" stroke-width="${(framesSelected ? 2 : 1) / state.cv.scale}" style="cursor:move"/>
        <g clip-path="url(#cv-clip-${esc(f.id)})">${shapes}</g>
      </g>`;
  }

  function shapeNode(s, selected) {
    const common = `data-id="${esc(s.id)}" style="cursor:${state.canvasTool === "select" ? "move" : "crosshair"}"`;
    const stroke = s.stroke || "#0066dd";
    if (s.type === "rect") return `<rect ${common} x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8" fill="${s.fill || "none"}" stroke="${stroke}" stroke-width="${(selected ? 2.5 : 1.5) / state.cv.scale}"/>${shapeText(s)}`;
    if (s.type === "ellipse") return `<ellipse ${common} cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}" fill="${s.fill || "none"}" stroke="${stroke}" stroke-width="${(selected ? 2.5 : 1.5) / state.cv.scale}"/>${shapeText(s)}`;
    if (s.type === "diamond") { const cx = s.x + s.w / 2, cy = s.y + s.h / 2; return `<polygon ${common} points="${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}" fill="${s.fill || "none"}" stroke="${stroke}" stroke-width="${(selected ? 2.5 : 1.5) / state.cv.scale}"/>${shapeText(s)}`; }
    if (s.type === "arrow") return `<line ${common} x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${2 / state.cv.scale}" marker-end="url(#cv-arrow)"/>`;
    return `<text ${common} x="${s.x}" y="${s.y + s.fontSize}" font-size="${s.fontSize}" fill="${s.fill || "#171a21"}" font-family="sans-serif" font-weight="600">${esc(s.text)}</text>`;
  }

  function shapeText(s) {
    if (!s.text) return "";
    return `<text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + s.fontSize / 3}" text-anchor="middle" font-size="${s.fontSize}" fill="#171a21" font-family="sans-serif" pointer-events="none">${esc(s.text)}</text>`;
  }

  function renderCanvas() {
    const cv = state.cv;
    const toolBtns = CANVAS_TOOLS.map(([id, label]) =>
      `<button class="btn ${state.canvasTool === id ? "primary" : ""}" data-ctool="${id}">${label}</button>`).join("");
    const STAMPS = [["button", "🔘 按钮"], ["input", "▭ 输入框"], ["card", "▤ 卡片"], ["heading", "H 标题"], ["body", "¶ 正文"], ["divider", "— 分割线"], ["toggle", "⏻ 开关"], ["checkbox", "☑ 复选框"], ["avatar", "😊 头像"], ["image", "🖼 图片占位"], ["chart", "📊 图表占位"], ["progress", "▰ 进度条"]];
    const stampSel = `<select id="cv-stamp" style="width:118px">${STAMPS.map(([v, label]) =>
      `<option value="${v}" ${state.canvasStamp === v ? "selected" : ""}>${label}</option>`).join("")}</select>`;
    const fills = ["", "#dbe4fd", "#0066dd", "#7c5cf0", "#e2f5ea", "#fde9e7", "#fdf0dd", "#171a21"].map((c) =>
      `<button class="swatch-btn ${state.canvasFill === c ? "on" : ""}" data-cfill="${esc(c)}" title="${c || "透明"}"><span style="background:${c || "repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 4px)"}"></span></button>`).join("");
    const frameOpts = FRAME_PRESETS.map(([label, w, h], i) => `<option value="${i}">${esc(label)}</option>`).join("");
    const frames = state.canvas.frames ?? [];
    const selFrame = frames.find((f) => f.id === state.canvasFrameSel);
    const clipDefs = frames.map((f) => `<clipPath id="cv-clip-${esc(f.id)}"><rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/></clipPath>`).join("");
    const frameNodes = frames.map((f) => frameNode(f, f.id === state.canvasFrameSel)).join("\n");
    const sel = state.canvas.shapes.find((s) => s.id === state.canvasSel);
    const selCount = selIds().length;
    const alignBtns = selCount >= 2
      ? `<span style="width:1px;height:22px;background:var(--border)"></span>` +
        [["left", "⇤ 左"], ["hcenter", "↔ 中"], ["right", "⇥ 右"], ["top", "⇞ 上"], ["vcenter", "↕ 中"], ["bottom", "⇟ 下"]].map(([m, label]) =>
          `<button class="btn" data-calign="${m}" title="${m}">${label}</button>`).join("") +
        (selCount >= 3
          ? `<span style="width:1px;height:22px;background:var(--border)"></span>` +
            [["hdist", "⇹ 均分横"], ["vdist", "⇳ 均分纵"]].map(([m, label]) =>
              `<button class="btn" data-cdist="${m}" title="${m}">${label}</button>`).join("")
          : "")
      : "";
    const handle = sel && sel.type !== "arrow"
      ? `<rect id="cv-handle" x="${sel.x + sel.w - 6 / cv.scale}" y="${sel.y + sel.h - 6 / cv.scale}" width="${12 / cv.scale}" height="${12 / cv.scale}" fill="#fff" stroke="#0066dd" stroke-width="${2 / cv.scale}" style="cursor:nwse-resize"/>`
      : "";
    const layers = frames.length
      ? frames.map((f) => `
          <div class="layer ${state.canvasFrameSel === f.id ? "on" : ""}" data-frame-item="${esc(f.id)}">
            <span class="lname" title="双击重命名">${esc(f.name)}</span><span class="lcount">${state.canvas.shapes.filter((s) => s.frameId === f.id).length}</span>
            <button class="lbtn" data-frename="${esc(f.id)}" title="重命名">✎</button>
            <button class="lbtn" data-fdel="${esc(f.id)}" title="删除画板">🗑</button>
          </div>`).join("")
      : '<div class="muted" style="padding:6px">还没有画板</div>';
    return `
      <div class="card"><h3 style="color:var(--accent-strong)">Excalidraw · 完整设计画布（推荐）<span class="line"></span></h3>
        <div class="muted" style="margin-bottom:10px">成熟的开源白板：自由绘制、连线、无限画布，<b>Agent 可直接读写</b>（create_diagram / apply_operations）。设计画布请在 Excalidraw 中完成。</div>
        <div class="btnrow">
          <button class="btn primary" id="btn-ex-new" ${state.busy ? "disabled" : ""}>新建 Excalidraw 画板</button>
          <button class="btn" id="btn-ex-export" ${state.canvas.frames.length ? "" : "disabled"} title="把无敌画布上的线框导出为 .excalidraw 场景再打开">把线框转入 Excalidraw ↗</button>
          <span class="muted">画板在侧栏打开后即可完整编辑；下面折叠的是快速线框实验画布</span>
        </div>
      </div>
      <details class="card" ${state.canvas.frames.length || state.canvas.shapes.length ? "" : "open"}>
        <summary style="cursor:pointer;font-weight:650;font-size:12.5px;margin-bottom:10px">快速线框（实验）—— 无敌画布</summary>
        <div class="card" style="box-shadow:none;margin:0"><h3>无敌画布 · 无限画布<span class="line"></span>
        <span class="muted" style="text-transform:none;letter-spacing:0">Figma 式多画板 —— 所有 UI 设计在同一块画布上（Agent 经 wudi_canvas_* 同享）</span></h3>
        <div class="btnrow" style="margin-bottom:8px">
          ${toolBtns}
          ${stampSel}
          <span style="width:1px;height:22px;background:var(--border)"></span>
          ${fills}
          <span style="width:1px;height:22px;background:var(--border)"></span>
          <button class="btn" id="cv-undo" ${canvasUndo.length ? "" : "disabled"} title="撤销 ⌘Z">↶</button>
          <button class="btn" id="cv-redo" ${canvasRedo.length ? "" : "disabled"} title="重做 ⌘⇧Z">↷</button>
          <select id="cv-framepreset" style="width:150px">${frameOpts}</select>
          <button class="btn" id="cv-addframe">＋ 画板</button>
          ${alignBtns}
          ${sel && !selCount ? `<button class="btn" data-cz="front" title="置于最上层">置顶</button><button class="btn" data-cz="back" title="置于最下层">置底</button>` : ""}
          <button class="btn danger" id="cv-del" ${!selCount && !selFrame ? "disabled" : ""}>删除${selCount > 1 ? `（${selCount}）` : ""}</button>
          <span style="flex:1"></span>
          <button class="btn" id="cv-zout">−</button><span class="mono" style="min-width:44px;text-align:center">${Math.round(cv.scale * 100)}%</span><button class="btn" id="cv-zin">＋</button>
          <button class="btn" id="cv-fit">适应</button>
        </div>
        <div style="display:flex;gap:10px;align-items:stretch">
          <svg id="cv-svg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" style="flex:1;min-height:520px;background:var(--bg-soft);border:1px solid var(--border);border-radius:10px;touch-action:none;display:block;cursor:${state.canvasTool === "select" ? "default" : "crosshair"}">
            <defs>
              ${clipDefs}
              <pattern id="cv-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#e6eaf2" stroke-width="1"/></pattern>
              <marker id="cv-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0066dd"/></marker>
            </defs>
            <rect x="-4000" y="-4000" width="12000" height="12000" fill="url(#cv-grid)"/>
            <g id="cv-world" transform="translate(${cv.tx},${cv.ty}) scale(${cv.scale})">
              ${frameNodes}
              ${state.canvas.shapes.filter((s) => !s.frameId).map((s) => shapeNode(s, s.id === state.canvasSel)).join("\n")}
              ${handle}
              ${state.marquee ? `<rect x="${state.marquee.x}" y="${state.marquee.y}" width="${state.marquee.w}" height="${state.marquee.h}" fill="rgba(0,102,221,.08)" stroke="#0066dd" stroke-width="1" stroke-dasharray="4 3"/>` : ""}
            </g>
          </svg>
          <div class="layers" style="width:190px">
            <div class="lhead">图层 · 画板<span class="mono" style="margin-left:auto">${Math.round(cv.scale * 100)}%</span></div>
            ${layers}
            <div class="btnrow" style="margin-top:8px">
              <button class="btn danger" id="cv-clear" style="flex:1">清空画布</button>
            </div>
          </div>
        </div>
        <div class="btnrow" style="margin-top:10px">
          <input id="cv-name" placeholder="导出名，如 app-design" style="width:190px">
          <button class="btn primary" id="cv-export" ${state.canvas.frames.length ? "" : "disabled"}>按画板导出设计稿</button>
          <button class="btn" id="cv-ex" ${state.canvas.shapes.length ? "" : "disabled"} title="导出 .excalidraw 场景并唤起 Agent 用官方 Excalidraw 插件打开（完整级无限画布）">在 Excalidraw 打开 ↗</button>
          <button class="btn" id="cv-png" ${state.canvas.shapes.length ? "" : "disabled"} title="把画布内容渲染为 PNG 下载">导出 PNG</button>
          <span class="muted">滚轮平移 · ⌘/Ctrl+滚轮缩放 · 画板标签可拖动整帧 · 双击图层重命名</span>
        </div>
        </div>
      </details>`;
  }

  function bindCanvas() {
    const svg = document.getElementById("cv-svg");
    if (!svg) return;
    // 渲染会反复调 bindCanvas：先摘掉上一轮的全局监听，避免累积
    if (window.__wudiCanvasUp) { window.removeEventListener("mouseup", window.__wudiCanvasUp); window.__wudiCanvasUp = null; }
    $root().querySelectorAll("[data-ctool]").forEach((b) => b.addEventListener("click", () => { state.canvasTool = b.dataset.ctool; state.canvasStamp = ""; render(); }));
    document.getElementById("cv-stamp")?.addEventListener("change", (ev) => {
      state.canvasStamp = ev.target.value;
      state.canvasTool = ev.target.value ? "stamp" : "select";
      render();
    });
    $root().querySelectorAll("[data-cfill]").forEach((b) => b.addEventListener("click", () => {
      state.canvasFill = b.dataset.cfill;
      const ids = selIds();
      if (ids.length) canvasSave(ids.map((id) => ({ op: "update", id, patch: { fill: state.canvasFill } })));
      else render();
    }));
    document.getElementById("cv-undo")?.addEventListener("click", canvasUndoFn);
    document.getElementById("cv-redo")?.addEventListener("click", canvasRedoFn);
    document.getElementById("cv-del")?.addEventListener("click", async () => {
      const ids = selIds();
      if (ids.length) { state.canvasSel = ""; state.canvasMulti = []; await canvasSave([{ op: "delete", ids }]); return; }
      if (state.canvasFrameSel) await delFrame(state.canvasFrameSel, false);
    });
    $root().querySelectorAll("[data-cz]").forEach((b) =>
      b.addEventListener("click", () => {
        if (!state.canvasSel) return;
        canvasSave([{ op: "reorder", id: state.canvasSel, to: b.dataset.cz }]);
      })
    );
    $root().querySelectorAll("[data-cdist]").forEach((b) =>
      b.addEventListener("click", () => {
        const ids = selIds();
        const shapes = ids.map((id) => state.canvas.shapes.find((x) => x.id === id)).filter(Boolean);
        if (shapes.length < 3) return;
        const m = b.dataset.cdist;
        const sorted = [...shapes].sort((a, b2) => (m === "hdist" ? a.x - b2.x : a.y - b2.y));
        const first = sorted[0], last = sorted.at(-1);
        const totalSize = sorted.reduce((acc, s) => acc + (m === "hdist" ? (s.w ?? 0) : (s.h ?? 0)), 0);
        const span = (m === "hdist" ? (last.x + (last.w ?? 0)) - first.x : (last.y + (last.h ?? 0)) - first.y) - totalSize;
        const gap = span / (sorted.length - 1);
        let cursor = m === "hdist" ? first.x : first.y;
        const ops = sorted.map((s) => {
          const patch = m === "hdist" ? { x: Math.round(cursor) } : { y: Math.round(cursor) };
          cursor += (m === "hdist" ? (s.w ?? 0) : (s.h ?? 0)) + gap;
          return { op: "update", id: s.id, patch };
        });
        canvasSave(ops);
      })
    );
    $root().querySelectorAll("[data-calign]").forEach((b) =>
      b.addEventListener("click", () => {
        const ids = selIds();
        const shapes = ids.map((id) => state.canvas.shapes.find((x) => x.id === id)).filter(Boolean);
        if (shapes.length < 2) return;
        const minX = Math.min(...shapes.map((s) => s.x));
        const maxX = Math.max(...shapes.map((s) => s.x + (s.w ?? 0)));
        const minY = Math.min(...shapes.map((s) => s.y));
        const maxY = Math.max(...shapes.map((s) => s.y + (s.h ?? 0)));
        const m = b.dataset.calign;
        const ops = shapes.map((s) => {
          let patch = {};
          if (m === "left") patch.x = minX;
          else if (m === "right") patch.x = maxX - (s.w ?? 0);
          else if (m === "hcenter") patch.x = Math.round((minX + maxX) / 2 - (s.w ?? 0) / 2);
          else if (m === "top") patch.y = minY;
          else if (m === "bottom") patch.y = maxY - (s.h ?? 0);
          else if (m === "vcenter") patch.y = Math.round((minY + maxY) / 2 - (s.h ?? 0) / 2);
          return { op: "update", id: s.id, patch };
        });
        canvasSave(ops);
      })
    );
    document.getElementById("cv-clear")?.addEventListener("click", async () => {
      if (!state.canvas.shapes.length && !state.canvas.frames.length) return;
      if (!confirm("清空画布全部画板与形状？（Agent 侧同数据）")) return;
      state.canvasSel = ""; state.canvasFrameSel = "";
      if (DEMO) { state.canvas = { frames: [], shapes: [] }; render(); return; }
      try { await callTool("wudi_canvas_clear", { confirm: true }); state.canvas = { frames: [], shapes: [] }; } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 300) };
      }
      render();
    });
    document.getElementById("cv-addframe")?.addEventListener("click", async () => {
      const preset = FRAME_PRESETS[Number(document.getElementById("cv-framepreset")?.value ?? 0)];
      // 新画板放在现有画板右侧
      const maxX = Math.max(0, ...state.canvas.frames.map((f) => f.x + f.w));
      const cv = state.cv;
      const op = { op: "add_frame", frame: { name: `画板 ${state.canvas.frames.length + 1}`, x: maxX + 80, y: Math.min(...(state.canvas.frames.length ? state.canvas.frames.map((f) => f.y) : [0])), w: preset[1], h: preset[2] } };
      await canvasSave([op]);
      state.canvasFrameSel = (DEMO ? state.canvas.frames[state.canvas.frames.length - 1]?.id : state.canvas.frames.find((f) => f.x === op.frame.x)?.id) ?? "";
      render();
    });
    $root().querySelectorAll("[data-frame-item]").forEach((el) => el.addEventListener("click", () => {
      state.canvasFrameSel = el.dataset.frameItem;
      state.canvasSel = "";
      render();
    }));
    $root().querySelectorAll("[data-frename]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = b.dataset.frename;
      const f = state.canvas.frames.find((x) => x.id === id);
      const name = await inputDialog(`画板「${f.name}」重命名：`, f.name);
      if (name && name !== f.name) canvasSave([{ op: "update_frame", id, patch: { name } }]);
    }));
    $root().querySelectorAll("[data-fdel]").forEach((b) => b.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const id = b.dataset.fdel;
      const f = state.canvas.frames.find((x) => x.id === id);
      const count = state.canvas.shapes.filter((s) => s.frameId === id).length;
      const withShapes = count ? confirm(`画板「${f.name}」内有 ${count} 个形状。\n确定=连形状一起删除，取消=形状转为游离。`) : true;
      state.canvasFrameSel = ""; state.canvasSel = "";
      await canvasSave([{ op: "delete_frame", id, withShapes }]);
    }));
    document.getElementById("cv-zin")?.addEventListener("click", () => { state.cv.scale = Math.min(4, state.cv.scale * 1.25); render(); });
    document.getElementById("cv-zout")?.addEventListener("click", () => { state.cv.scale = Math.max(0.15, state.cv.scale / 1.25); render(); });
    document.getElementById("cv-fit")?.addEventListener("click", () => fitView());
    document.getElementById("cv-export")?.addEventListener("click", async () => {
      const name = String(document.getElementById("cv-name")?.value ?? "").trim() || `canvas-${Date.now().toString(36)}`;
      setBusy(true);
      try {
        const res = await callTool("wudi_canvas_export", { name });
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "已导出" };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 400) };
      }
      setBusy(false);
    });
    document.getElementById("cv-ex")?.addEventListener("click", async () => {
      const name = String(document.getElementById("cv-name")?.value ?? "").trim() || `canvas-${Date.now().toString(36)}`;
      setBusy(true);
      let path = "";
      try {
        const res = await callTool("wudi_canvas_export", { name, format: "excalidraw" });
        path = res.structuredContent?.excalidraw ?? "";
        state.notice = { kind: "ok", text: `场景已导出：${path}。正在唤起 Agent 用 Excalidraw 插件打开…` };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 400) };
        setBusy(false);
        return;
      }
      setBusy(false);
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: `场景已导出：${path}。请在会话里让 Agent「用 open_diagram 打开 ${path}」。` };
          render();
          return;
        }
        await app.sendMessage({ role: "user", content: { type: "text", text: `请用 Excalidraw 插件的 open_diagram 打开工作区文件 ${path}（导入并打开画板），然后告诉我画板 id。` } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });

    if (!svg) return;
    const pt = (ev) => {
      const r = svg.getBoundingClientRect();
      const sx = 1000 / r.width, sy = 560 / r.height;
      const lx = (ev.clientX - r.left) * sx, ly = (ev.clientY - r.top) * sy;
      return { x: Math.round((lx - state.cv.tx) / state.cv.scale), y: Math.round((ly - state.cv.ty) / state.cv.scale) };
    };
    svg.addEventListener("wheel", (ev) => {
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      const sx = 1000 / r.width, sy = 560 / r.height;
      const lx = (ev.clientX - r.left) * sx, ly = (ev.clientY - r.top) * sy;
      if (ev.ctrlKey || ev.metaKey) {
        const old = state.cv.scale;
        const scale = Math.min(4, Math.max(0.15, old * (1 - ev.deltaY * 0.0015)));
        state.cv.tx = lx - ((lx - state.cv.tx) / old) * scale;
        state.cv.ty = ly - ((ly - state.cv.ty) / old) * scale;
        state.cv.scale = scale;
      } else {
        state.cv.tx -= ev.deltaX;
        state.cv.ty -= ev.deltaY;
      }
      render();
    }, { passive: false });
    let drag = null;
    svg.addEventListener("mousedown", (ev) => {
      state.canvasDragging = true;
      const target = ev.target;
      const p = pt(ev);
      if (target.id === "cv-handle" && state.canvasSel) {
        const s = state.canvas.shapes.find((x) => x.id === state.canvasSel);
        drag = { mode: "resize", id: s.id, startX: p.x, startY: p.y, orig: { ...s } };
        ev.preventDefault();
        return;
      }
      const frameLabel = target?.dataset?.framelabel;
      const frameBg = target?.dataset?.framebg;
      if (frameLabel || frameBg) {
        const fid = frameLabel || frameBg;
        state.canvasFrameSel = fid;
        state.canvasSel = "";
        const f = state.canvas.frames.find((x) => x.id === fid);
        drag = { mode: "frame", id: fid, startX: p.x, startY: p.y, orig: { ...f }, children: state.canvas.shapes.filter((s) => s.frameId === fid).map((s) => ({ id: s.id, x: s.x, y: s.y, x2: s.x2 })) };
        render();
        ev.preventDefault();
        return;
      }
      const id = target?.dataset?.id;
      if (id) {
        const shift = ev.shiftKey;
        if (shift) {
          // Shift 加选/去选
          if (state.canvasMulti.includes(id)) state.canvasMulti = state.canvasMulti.filter((x) => x !== id);
          else state.canvasMulti.push(id);
          state.canvasSel = state.canvasMulti.at(-1) ?? "";
          render();
          return;
        }
        if (state.canvasMulti.length && state.canvasMulti.includes(id) && state.canvasTool === "select") {
          // 多选拖动：整体移动
          state.canvasSel = id;
          drag = { mode: "multimove", startX: p.x, startY: p.y, children: selIds().map((sid) => { const sh = state.canvas.shapes.find((x) => x.id === sid); return { id: sid, x: sh.x, y: sh.y, x2: sh.x2 }; }) };
          render();
          ev.preventDefault();
          return;
        }
        state.canvasMulti = [];
        state.canvasSel = id;
        state.canvasFrameSel = "";
        const s = state.canvas.shapes.find((x) => x.id === id);
        if (state.canvasTool === "select") drag = { mode: "move", id, startX: p.x, startY: p.y, orig: { ...s } };
        render();
        return;
      }
      state.canvasSel = ""; state.canvasMulti = []; state.canvasFrameSel = "";
      if (ev.button === 1) { drag = { mode: "pan", startX: ev.clientX, startY: ev.clientY, tx: state.cv.tx, ty: state.cv.ty }; ev.preventDefault(); render(); return; }
      if (state.canvasTool === "stamp") {
        const fid2 = frameIdAt(p.x, p.y);
        const shapes = stampShapes(state.canvasStamp, p.x, p.y).map((sh) => ({ ...sh, frameId: fid2 }));
        if (shapes.length) canvasSave(shapes.map((sh) => ({ op: "add", shape: sh })));
        return;
      }
      if (state.canvasTool === "frame") {
        drag = { mode: "createframe", startX: p.x, startY: p.y };
        const id2 = `f-${Date.now().toString(36)}-tmp`;
        drag.id = id2;
        state.canvas.frames.push({ id: id2, name: "画板", x: p.x, y: p.y, w: 50, h: 50, background: "#ffffff" });
        render();
        return;
      }
      if (state.canvasTool !== "select" && !state.canvasBusy) {
        if (state.canvasTool === "text") {
          const fid = frameIdAt(p.x, p.y);
          canvasSave([{ op: "add", shape: { type: "text", x: p.x, y: p.y, text: "双击编辑文字", fontSize: 16, frameId: fid } }]);
          return;
        }
        drag = { mode: "create", tool: state.canvasTool, startX: p.x, startY: p.y };
        const id2 = `s-${Date.now().toString(36)}-tmp`;
        drag.id = id2;
        const fid = frameIdAt(p.x, p.y);
        state.canvas.shapes.push({ id: id2, type: state.canvasTool, frameId: fid, x: p.x, y: p.y, w: 2, h: 2, x2: p.x, y2: p.y, stroke: "#0066dd", fill: state.canvasFill, fontSize: 14, text: "" });
      } else {
        drag = { mode: "pan", startX: ev.clientX, startY: ev.clientY, tx: state.cv.tx, ty: state.cv.ty };
      }
      render();
    });
    svg.addEventListener("mousemove", (ev) => {
      if (!drag) return;
      const p = pt(ev);
      const s = state.canvas.shapes.find((x) => x.id === drag.id);
      const f = state.canvas.frames.find((x) => x.id === drag.id);
      if (drag.mode === "pan") {
        state.cv.tx = drag.tx + (ev.clientX - drag.startX) * (1000 / svg.getBoundingClientRect().width);
        state.cv.ty = drag.ty + (ev.clientY - drag.startY) * (560 / svg.getBoundingClientRect().height);
        render();
      } else if (drag.mode === "create" && s) {
        s.w = Math.max(2, Math.abs(p.x - drag.startX));
        s.h = Math.max(2, Math.abs(p.y - drag.startY));
        s.x = Math.min(p.x, drag.startX);
        s.y = Math.min(p.y, drag.startY);
        s.frameId = frameIdAt(s.x + s.w / 2, s.y + s.h / 2);
        if (s.type === "arrow") { s.x2 = p.x; s.y2 = p.y; s.x = drag.startX; s.y = drag.startY; }
        render();
      } else if (drag.mode === "createframe" && f) {
        f.x = Math.min(p.x, drag.startX);
        f.y = Math.min(p.y, drag.startY);
        f.w = Math.max(50, Math.abs(p.x - drag.startX));
        f.h = Math.max(50, Math.abs(p.y - drag.startY));
        render();
      } else if (drag.mode === "move" && s) {
        s.x = Math.max(-2000, Math.min(8000, drag.orig.x + (p.x - drag.startX)));
        s.y = Math.max(-2000, Math.min(8000, drag.orig.y + (p.y - drag.startY)));
        render();
      } else if (drag.mode === "multimove") {
        const dx = p.x - drag.startX, dy = p.y - drag.startY;
        for (const c of drag.children) {
          const cs = state.canvas.shapes.find((x) => x.id === c.id);
          if (!cs) continue;
          cs.x = c.x + dx; cs.y = c.y + dy;
          if (cs.type === "arrow") { cs.x2 = c.x2 + dx; cs.y2 = c.y2 + dy; }
        }
        render();
      } else if (drag.mode === "marquee") {
        state.marquee = { x: Math.min(p.x, drag.startX), y: Math.min(p.y, drag.startY), w: Math.abs(p.x - drag.startX), h: Math.abs(p.y - drag.startY) };
        render();
      } else if (drag.mode === "resize" && s) {
        s.w = Math.max(8, drag.orig.w + (p.x - drag.startX));
        s.h = Math.max(8, drag.orig.h + (p.y - drag.startY));
        render();
      } else if (drag.mode === "frame" && f) {
        const dx = p.x - drag.startX, dy = p.y - drag.startY;
        f.x = drag.orig.x + dx; f.y = drag.orig.y + dy;
        for (const c of drag.children) {
          const cs = state.canvas.shapes.find((x) => x.id === c.id);
          if (!cs) continue;
          cs.x = c.x + dx; cs.y = c.y + dy;
          if (cs.type === "arrow") { cs.x2 = c.x2 + dx; cs.y2 = c.y2 + dy; }
        }
        render();
      }
    });
    const upHandler = () => {
      state.canvasDragging = false;
      if (!drag) return;
      const d = drag; drag = null;
      if (d.mode === "create") {
        const s = state.canvas.shapes.find((x) => x.id === d.id);
        if (s) {
          state.canvas.shapes = state.canvas.shapes.filter((x) => x.id !== d.id);
          canvasSave([{ op: "add", shape: { ...s, fill: state.canvasFill } }]).then(() => {
            state.canvasSel = state.canvas.shapes.find((x) => x.type === s.type && x.x === s.x)?.id ?? "";
          });
        }
      } else if (d.mode === "createframe") {
        const f = state.canvas.frames.find((x) => x.id === d.id);
        if (f) {
          state.canvas.frames = state.canvas.frames.filter((x) => x.id !== d.id);
          canvasSave([{ op: "add_frame", frame: { name: `画板 ${state.canvas.frames.length + 1}`, x: f.x, y: f.y, w: f.w, h: f.h } }]).then(() => {
            state.canvasFrameSel = state.canvas.frames.find((x) => x.x === f.x)?.id ?? "";
          });
        }
      } else if (d.mode === "move" || d.mode === "resize" || d.mode === "multimove") {
        const ids = selIds();
        const ops = ids.map((sid) => {
          const sh = state.canvas.shapes.find((x) => x.id === sid);
          const patch = d.mode === "resize" && sid === d.id ? { w: sh.w, h: sh.h } : { x: sh.x, y: sh.y };
          if (sh.type === "arrow" && d.mode !== "resize") { patch.x2 = sh.x2; patch.y2 = sh.y2; }
          return { op: "update", id: sid, patch };
        });
        canvasSave(ops);
      } else if (d.mode === "marquee") {
        const mq = state.marquee;
        state.marquee = null;
        if (mq && (mq.w > 4 || mq.h > 4)) {
          state.canvasMulti = state.canvas.shapes
            .filter((s) => s.x + (s.w ?? 0) >= mq.x && s.x <= mq.x + mq.w && s.y + (s.h ?? 0) >= mq.y && s.y <= mq.y + mq.h)
            .map((s) => s.id);
          state.canvasSel = state.canvasMulti.at(-1) ?? "";
        }
        render();
      } else if (d.mode === "frame") {
        const f = state.canvas.frames.find((x) => x.id === d.id);
        if (!f) return;
        const ops = [{ op: "update_frame", id: d.id, patch: { x: f.x, y: f.y } }];
        for (const c of d.children) {
          const cs = state.canvas.shapes.find((x) => x.id === c.id);
          if (!cs) continue;
          const patch = { x: cs.x, y: cs.y };
          if (cs.type === "arrow") { patch.x2 = cs.x2; patch.y2 = cs.y2; }
          ops.push({ op: "update", id: c.id, patch });
        }
        canvasSave(ops);
      }
    };
    window.__wudiCanvasUp = upHandler;
    window.addEventListener("mouseup", upHandler);

    // 键盘：Delete 删除 / 方向键微调 / ⌘D 复制（只注册一次，画布页激活时才响应）
    if (!window.__wudiCanvasKeys) {
      window.__wudiCanvasKeys = (ev) => {
        if (state.view !== "detail" || state.tab !== "canvas" || state.busy) return;
        const tag = ev.target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (!state.canvasSel) return;
        const s = state.canvas.shapes.find((x) => x.id === state.canvasSel);
        if (!s) return;
        if (ev.key === "z" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          ev.shiftKey ? canvasRedoFn() : canvasUndoFn();
          return;
        }
        if (ev.key === "a" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          const scope = state.canvasFrameSel || "";
          state.canvasMulti = state.canvas.shapes.filter((s) => !scope || s.frameId === scope).map((s) => s.id);
          state.canvasSel = state.canvasMulti.at(-1) ?? "";
          render();
          return;
        }
        if (ev.key === "Escape") {
          state.canvasSel = ""; state.canvasMulti = []; state.canvasFrameSel = "";
          render();
          return;
        }
        if (ev.key === "c" && (ev.ctrlKey || ev.metaKey)) {
          canvasClip = selIds().map((id) => structuredClone(state.canvas.shapes.find((x) => x.id === id))).filter(Boolean);
          return;
        }
        if (ev.key === "v" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          if (!canvasClip.length) return;
          canvasSave(canvasClip.map((sh, i) => ({ op: "add", shape: { ...sh, id: undefined, x: (sh.x ?? 40) + 24, y: (sh.y ?? 40) + 24 } })));
          return;
        }
        if (ev.key === "Delete" || ev.key === "Backspace") {
          ev.preventDefault();
          const ids = selIds();
          state.canvasSel = ""; state.canvasMulti = [];
          canvasSave([{ op: "delete", ids }]);
          return;
        }
        if (ev.key === "d" && (ev.ctrlKey || ev.metaKey)) {
          ev.preventDefault();
          canvasSave([{ op: "add", shape: { ...s, id: undefined, x: s.x + 24, y: s.y + 24 } }]);
          return;
        }
        const step = ev.shiftKey ? 10 : 1;
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[ev.key]) {
          ev.preventDefault();
          const patch = { x: Math.max(-2000, Math.min(8000, s.x + moves[ev.key][0])), y: Math.max(-2000, Math.min(8000, s.y + moves[ev.key][1])) };
          if (s.type === "arrow") { patch.x2 = (s.x2 ?? s.x) + moves[ev.key][0]; patch.y2 = (s.y2 ?? s.y) + moves[ev.key][1]; }
          canvasSave([{ op: "update", id: s.id, patch }]);
        }
      };
      window.addEventListener("keydown", window.__wudiCanvasKeys);
    }

    // 导出 PNG：序列化世界组为 SVG → Image → canvas 2x → downloadFile（兜底灯箱右键保存）
    document.getElementById("cv-png")?.addEventListener("click", async () => {
      const world = svg.querySelector("#cv-world");
      if (!world || !state.canvas.shapes.length) return;
      const shapesAll = state.canvas.shapes;
      const minX = Math.max(0, Math.min(...shapesAll.map((s) => s.x)) - 30);
      const minY = Math.max(0, Math.min(...shapesAll.map((s) => s.y)) - 30);
      const maxX = Math.min(8000, Math.max(...shapesAll.map((s) => s.x + (s.w ?? 0))) + 30);
      const maxY = Math.min(8000, Math.max(...shapesAll.map((s) => s.y + (s.h ?? 0))) + 30);
      const w = maxX - minX, h = maxY - minY;
      const defs = svg.querySelector("defs")?.outerHTML ?? "";
      const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#ffffff"/>${defs}${world.innerHTML}</svg>`;
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = async () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = w * scale; canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/png");
        const b64 = dataUrl.split(",")[1];
        let saved = false;
        try {
          if (app.getHostCapabilities()?.downloadFile) {
            await app.downloadFile({ contents: [{ mimeType: "image/png", blob: b64 }] });
            saved = true;
          }
        } catch { /* 走灯箱兜底 */ }
        if (!saved) previewImage(dataUrl, `画布导出 ${w}×${h}（右键/长按保存）`);
        state.notice = { kind: "ok", text: saved ? `PNG 已导出（${w}×${h} @2x）` : `PNG 已生成（${w}×${h} @2x），已弹出预览——宿主下载能力不可用，请右键保存` };
        render();
      };
      img.onerror = () => { URL.revokeObjectURL(url); state.notice = { kind: "err", text: "PNG 渲染失败" }; render(); };
      img.src = url;
    });
    svg.addEventListener("dblclick", (ev) => {
      const frameLabel = ev.target?.dataset?.framelabel;
      if (frameLabel) {
        const f = state.canvas.frames.find((x) => x.id === frameLabel);
        inputDialog(`画板「${f.name}」重命名：`, f.name).then((name) => {
          if (name && name !== f.name) canvasSave([{ op: "update_frame", id: frameLabel, patch: { name } }]);
        });
        return;
      }
      const id = ev.target?.dataset?.id;
      const s = state.canvas.shapes.find((x) => x.id === id);
      if (!s) return;
      const input = document.createElement("input");
      input.value = s.text ?? "";
      input.style.cssText = `position:fixed;left:${ev.clientX - 60}px;top:${ev.clientY - 14}px;width:160px;z-index:50;${INPUT_CSS}`;
      document.body.appendChild(input);
      input.focus(); input.select();
      const commit = () => { input.remove(); canvasSave([{ op: "update", id: s.id, patch: { text: input.value.slice(0, 200) } }]); };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(); });
    });
  }

  function frameIdAt(x, y) {
    const f = (state.canvas.frames ?? []).find((fr) => x >= fr.x && x <= fr.x + fr.w && y >= fr.y && y <= fr.y + fr.h);
    return f?.id ?? "";
  }

  function fitView() {
    const frames = state.canvas.frames ?? [];
    if (!frames.length) { state.cv = { tx: 40, ty: 40, scale: 1 }; render(); return; }
    const minX = Math.min(...frames.map((f) => f.x)), minY = Math.min(...frames.map((f) => f.y));
    const maxX = Math.max(...frames.map((f) => f.x + f.w)), maxY = Math.max(...frames.map((f) => f.y + f.h));
    const scale = Math.min(2, Math.max(0.15, Math.min(900 / (maxX - minX + 160), 500 / (maxY - minY + 160))));
    state.cv.scale = Math.round(scale * 100) / 100;
    state.cv.tx = 60 - minX * state.cv.scale;
    state.cv.ty = 40 - minY * state.cv.scale;
    render();
  }

  /** 输入弹窗（Electron 无 window.prompt）：Promise<输入值|null>。 */
  function inputDialog(message, initial = "") {
    return new Promise((resolvePromise) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `<div class="dialog" style="width:min(380px, calc(100vw - 40px))">
        <h3>${esc(message)}</h3>
        <input id="dlg-input" value="${esc(initial)}" style="width:100%;margin:10px 0">
        <div class="btnrow"><button class="btn" id="dlg-cancel">取消</button><button class="btn primary" id="dlg-ok">确定</button></div>
      </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector("#dlg-input");
      input.focus(); input.select();
      const done = (val) => { overlay.remove(); resolvePromise(val); };
      overlay.querySelector("#dlg-cancel").addEventListener("click", () => done(null));
      overlay.querySelector("#dlg-ok").addEventListener("click", () => done(input.value.trim() || null));
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") done(input.value.trim() || null); if (e.key === "Escape") done(null); });
    });
  }

  /* ---------- 内嵌 OpenPencil 编辑器（overlay + 宿主协议 shim） ----------
   * 编辑器本体（vendor 官方 dist 的 loader + bundle 资产）经 wudi 协同桥 HTTP 端点 /openpencil/frame
   * 加载进 iframe；loader 按官方架构走 MCP App 协议连 window.parent —— 这里由面板扮演宿主：
   * ui/initialize 握手，tools/call 与 resources/read 经面板自己的 App 连接转发到 wudi server
   * （再代理到 openpencil 子进程）。文档操作由编辑器拿 get_design_status 的 endpoint+token
   * 直连本机 WS 桥，与 Agent 的 openpencil 工具双向实时同步。
   * overlay 挂在 body 上、不参与 render() 内外重建，保证编辑器会话不被面板刷新打断。 */
  let opShimHandler = null;
  let opReady = false;        // 编辑器握手（ui/initialize）是否完成
  let opReadyTimer = null;    // 加载看门狗：超时给出白屏原因提示

  /* srcdoc prelude：错误采集 + 资产 fetch 补丁。
   * srcdoc 为不透明源，编辑器 bundle 用 location.origin 做同源判断会跳过资产拦截，
   * /canvaskit.wasm 与字体将回落原生 fetch 并失败（CanvasKit 起不来）。这里在 loader
   * 之前接管 fetch，经 postMessage 走面板宿主 shim → MCP 资源管线取回资产。 */
  const OP_PRELUDE = `<script>
window.__wudiErrs=[];
addEventListener("error",function(e){window.__wudiErrs.push(String(e.message||e.error||"error"))});
addEventListener("unhandledrejection",function(e){window.__wudiErrs.push(String(e.reason||"rejection"))});
(function(){
  var seq=0,pending=new Map();
  addEventListener("message",function(ev){
    var m=ev.data;
    if(!m||m.jsonrpc!=="2.0"||!m.id||!pending.has(m.id))return;
    var p=pending.get(m.id);pending.delete(m.id);
    if(m.error){p.reject(new Error(m.error.message||"resource error"))}else{p.resolve(m.result)}
  });
  function readAsset(name){
    return new Promise(function(resolve,reject){
      var id="wudi-asset-"+(++seq);
      pending.set(id,{resolve:resolve,reject:reject});
      window.parent.postMessage({jsonrpc:"2.0",id:id,method:"resources/read",params:{uri:"ui://openpencil/assets/"+name}},"*");
      setTimeout(function(){if(pending.has(id)){pending.delete(id);reject(new Error("asset timeout: "+name))}},15000);
    });
  }
  function b64(b){var s=atob(b),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
  var origFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    var raw=(typeof input==="string")?input:(input&&input.url)||"";
    var m=raw.replace(/^https?:\/\/[^/]+/,"").replace(/^\/+/,"");
    var hit=m.match(/^(canvaskit\.wasm|[A-Za-z0-9-]+\.ttf)$/);
    if(!hit)return origFetch(input,init);
    var name=hit[1];
    var res=await readAsset(name);
    var c=res&&res.contents&&res.contents[0],bytes;
    if(c&&typeof c.blob==="string"){bytes=b64(c.blob)}
    else if(c&&typeof c.text==="string"){bytes=new TextEncoder().encode(c.text)}
    else{throw new Error("asset empty: "+name)}
    return new Response(bytes,{headers:{"content-type":name.slice(-5)===".wasm"?"application/wasm":"font/ttf"}});
  };
})();
<\/script>`;

  function opSetStatus(text, kind = "") {
    const el = document.getElementById("op-status");
    if (!el) return;
    el.textContent = text;
    el.style.color = kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--err)" : "";
  }

  function buildOpOverlay() {
    let layer = document.getElementById("op-layer");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = "op-layer";
    layer.className = "op-layer";
    layer.innerHTML = `
      <div class="op-bar">
        <span class="chip accent">OpenPencil 编辑器</span>
        <span class="op-path mono"></span>
        <span id="op-status" class="muted"></span>
        <span style="flex:1"></span>
        <button class="btn" id="op-layer-reload" title="重新加载编辑器">重载</button>
        <button class="btn danger" id="op-layer-close">关闭编辑器</button>
      </div>
      <div class="op-frame-holder"></div>`;
    document.body.appendChild(layer);
    layer.querySelector("#op-layer-close").addEventListener("click", () => closeOpEmbed());
    layer.querySelector("#op-layer-reload").addEventListener("click", () => {
      const frame = layer.querySelector("#op-frame");
      if (!frame) return;
      if (frame.srcdoc) {
        const html = frame.srcdoc; // srcdoc 重建：清空后下一帧重新注入
        frame.srcdoc = "";
        requestAnimationFrame(() => { frame.srcdoc = html; });
      } else if (frame.src) {
        frame.src = frame.src;
      }
    });
    return layer;
  }

  function bindOpShim(iframeEl) {
    if (opShimHandler) { window.removeEventListener("message", opShimHandler); opShimHandler = null; }
    if (!iframeEl) return;
    opShimHandler = async (ev) => {
      if (ev.source !== iframeEl.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return;
      if (msg.id === undefined || msg.id === null) return; // 通知（initialized / size-changed…）不回应
      const post = (payload) => { try { ev.source.postMessage(payload, "*"); } catch { /* iframe 已关闭 */ } };
      const reply = (result) => post({ jsonrpc: "2.0", id: msg.id, result });
      const fail = (message, code = -32603) => post({ jsonrpc: "2.0", id: msg.id, error: { code, message: String(message).slice(0, 500) } });
      const p = msg.params ?? {};
      try {
        switch (msg.method) {
          case "ui/initialize":
            opReady = true;
            if (opReadyTimer) { clearTimeout(opReadyTimer); opReadyTimer = null; }
            opSetStatus("已连接 · 看不到内容按 Shift+1 适应视图", "ok");
            // 结果 schema 四项必填（protocolVersion/hostInfo/hostCapabilities/hostContext），
            // protocolVersion 回显 app 请求的版本 —— 漏掉会让 SDK 校验失败、编辑器启动即报错
            reply({
              protocolVersion: String(p.protocolVersion ?? "2026-01-26"),
              hostCapabilities: { experimental: {} },
              hostInfo: { name: "wudi-workbench", version: "0.34.0" },
              hostContext: {
                theme: app.getHostContext()?.theme ?? "light",
                displayMode: "inline",
                locale: navigator.language || "zh-CN",
              },
            });
            break;
          case "tools/call": reply(await callTool(p.name, p.arguments ?? {})); break;
          case "resources/read": reply(await app.readServerResource({ uri: p.uri })); break;
          case "resources/list": reply(await app.listServerResources?.() ?? { resources: [] }); break;
          case "ping": reply({}); break;
          case "ui/open-link": await app.openLink?.({ url: p.url }); reply({}); break;
          case "ui/message":
            await app.sendMessage?.({ role: "user", content: p.content ?? { type: "text", text: "" } });
            reply({});
            break;
          case "ui/update-model-context": reply({}); break; // 模型上下文上报：内嵌模式 no-op
          case "ui/set-widget-state": reply({}); break;
          default: fail(`工作台内嵌桥未实现方法：${msg.method}`, -32601);
        }
      } catch (err) {
        fail(err?.message ?? err);
      }
    };
    window.addEventListener("message", opShimHandler);
  }

  async function openOpEmbed(path) {
    if (DEMO) {
      const layer = buildOpOverlay();
      layer.querySelector(".op-path").textContent = path || "（demo：未指定设计稿）";
      layer.querySelector(".op-frame-holder").innerHTML =
        `<div class="empty" style="margin:18px;padding:56px 20px">demo 模式：OpenPencil 编辑器占位。<br>宿主内此处经本机桥加载完整编辑器（画布 / 图层 / Agent 117 工具协同）。</div>`;
      layer.classList.add("on");
      state.opEmbed = { path: path ?? "" };
      return;
    }
    setBusy(true);
    /* srcdoc 加载（宿主契约允许子帧 srcdoc，不受 frame-src 限制 —— 实测 http src 会被拦）。
     * 但 srcdoc 是不透明源，编辑器 bundle 的资产拦截器（location.origin 同源判断）会失效，
     * 导致 /canvaskit.wasm、字体 fetch 报 Failed to fetch → CanvasKit 起不来。
     * 解法：在 loader 之前注入 prelude —— 接管 fetch，把这两个资产转回 MCP 资源管线。 */
    let loaderHtml = "";
    try {
      const res = await app.readServerResource({ uri: "ui://openpencil/panel.html" });
      loaderHtml = res?.contents?.[0]?.text ?? "";
      if (!loaderHtml) throw new Error("loader 内容为空");
    } catch (err) {
      state.notice = { kind: "err", text: `编辑器资源不可用：${String(err.message ?? err).slice(0, 300)}` };
      setBusy(false);
      return;
    }
    if (path) {
      try {
        await callTool("open_design", { path }); // 子进程侧登记活动设计稿，编辑器起来即加载
      } catch (err) {
        state.notice = { kind: "err", text: `登记活动设计稿失败（编辑器内仍可手动打开）：${String(err.message ?? err).slice(0, 200)}` };
      }
    }
    setBusy(false);
    state.opEmbed = { path: path ?? "" };
    state.opFrameOrigin = "";
    const layer = buildOpOverlay();
    layer.querySelector(".op-path").textContent = path ? shortPath(path, 60) : "未指定设计稿 —— 编辑器内点「OpenPencil」选择工作区设计稿";
    const holder = layer.querySelector(".op-frame-holder");
    holder.innerHTML = "";
    const frame = document.createElement("iframe");
    frame.id = "op-frame";
    frame.className = "op-frame";
    frame.title = `OpenPencil · ${path || "workspace designs"}`;
    frame.setAttribute("allow", "clipboard-write");
    holder.appendChild(frame);
    frame.srcdoc = OP_PRELUDE + loaderHtml;
    layer.classList.add("on");
    bindOpShim(frame);
    /* 看门狗：编辑器 15s 内不握手，多半是 CSP（connect-src/wasm 放宽）或桥不可达，给出可操作提示 */
    opReady = false;
    if (opReadyTimer) clearTimeout(opReadyTimer);
    opSetStatus("正在加载编辑器…");
    opReadyTimer = setTimeout(() => {
      if (!opReady) opSetStatus("加载超时：编辑器未握手。先「重载」，仍失败请重启会话；还有问题把开发者工具 Console 报错发我。", "err");
    }, 15000);
    /* 渲染自检：连接后 5s 检查画布渲染器状态（srcdoc 同源，可直接读 canvas/错误采集） */
    setTimeout(() => {
      const live = document.getElementById("op-frame");
      if (!live || !opReady) return;
      try {
        const doc = live.contentDocument;
        if (!doc) return; // src 真实 origin 加载时跨源，无法内省（状态以握手为准）
        const errs = live.contentWindow?.__wudiErrs ?? [];
        const canvases = [...(doc?.querySelectorAll("canvas") ?? [])];
        const hasCtx = canvases.some((c) => {
          try { return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("2d")); } catch { return false; }
        });
        if (errs.length) opSetStatus(`编辑器渲染异常：${String(errs[0]).slice(0, 160)}`, "err");
        else if (!canvases.length) opSetStatus("画布元素未创建：渲染器未启动（wasm/CanvasKit 可能被拦截）", "err");
        else if (!hasCtx) opSetStatus("画布未初始化渲染上下文（CanvasKit/wasm 可能被拦截）", "err");
        else opSetStatus("已连接 · 看不到内容时按 Shift+1 适应视图", "ok");
      } catch { /* 读不到 iframe 就跳过 */ }
    }, 5000);
  }

  function closeOpEmbed() {
    state.opEmbed = null;
    state.opFrameOrigin = "";
    if (opShimHandler) { window.removeEventListener("message", opShimHandler); opShimHandler = null; }
    if (opReadyTimer) { clearTimeout(opReadyTimer); opReadyTimer = null; }
    opReady = false;
    document.getElementById("op-layer")?.remove();
    render();
    saveWidgetState();
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
    /* 「＋ 登记项目」虚线卡：展开表单；「收起」折叠回去 */
    $root().querySelectorAll("[data-add]").forEach((card) =>
      card.addEventListener("click", () => { state.createOpen = true; render(); document.getElementById("p-path")?.focus(); })
    );
    document.getElementById("btn-pcollapse")?.addEventListener("click", () => { state.createOpen = false; render(); });
    $root().querySelectorAll(".pcard[data-pid]").forEach((card) =>
      card.addEventListener("click", () => {
        const pid = card.dataset.pid;
        const p = (state.projects?.projects ?? []).find((x) => x.id === pid);
        if (!p) return;
        state.createOpen = false;
        if (card.dataset.current === "1") {
          // 选中当前项目 → 进入项目内容页（数据启动时已加载，缺了就补一次）
          state.drill = null;
          state.view = "detail";
          state.tab = "overview";
          render();
          saveWidgetState();
          if (!state.data) loadAll();
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
    /* 项目画布卡：进入该画布 */
    $root().querySelectorAll("[data-cv-open]").forEach((card) =>
      card.addEventListener("click", () => openOpEmbed(card.dataset.cvOpen))
    );
    document.getElementById("btn-cv-create-toggle")?.addEventListener("click", () => {
      state.canvasCreateOpen = true;
      render();
      document.getElementById("op-name")?.focus();
    });
    document.getElementById("btn-op-wire")?.addEventListener("click", async () => {
      const name = String(document.getElementById("op-name-wire")?.value ?? "").trim() || `wireframe-${Date.now().toString(36)}`;
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里说「把无敌画布线框转入 OpenPencil 设计稿」。" };
          render();
          return;
        }
        await app.sendMessage({ role: "user", content: { type: "text", text: `请把无敌画布的线框转成 OpenPencil 设计稿：先用 wudi_canvas_get 读取全部形状，再用 OpenPencil 的 new_design 新建 designs/${name}.fig，按坐标用 create_shape 重建（rect→FRAME 或 RECTANGLE、text→TEXT、fill 映射 fills、ellipse→ELLIPSE），完成后 export_image 渲染到 .wudi/design/renders/ 并告诉我结果。` } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });
    document.getElementById("btn-tokens-edit")?.addEventListener("click", tokensEditDialog);
    document.getElementById("btn-op-new")?.addEventListener("click", async () => {
      // 创建项目画布：new_design 建稿（经 wudi 代理直连 openpencil 子进程）→ 自动进内嵌编辑器
      const name = String(document.getElementById("op-name")?.value ?? "").trim() || "ui";
      if (DEMO) { await openOpEmbed(`designs/${name}.fig`); return; }
      setBusy(true);
      try {
        const res = await callTool("new_design", { path: `designs/${name}.fig` });
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? `已创建画布 designs/${name}.fig` };
        state.canvasCreateOpen = false;
        setBusy(false);
        await loadDesign();
        await openOpEmbed(`designs/${name}.fig`);
        return;
      } catch (err) {
        state.notice = { kind: "err", text: `创建画布失败：${String(err.message ?? err).slice(0, 400)}` };
      }
      setBusy(false);
    });$root().querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const act = b.dataset.act;
        if (act === "goto-deploys") { state.view = "detail"; state.tab = "deploys"; }
        else if (act === "goto-design") { state.view = "detail"; state.tab = "design"; loadDesign({ autoEnter: true }); }
        else if (act === "goto-docs") { state.view = "detail"; state.tab = "docs"; }
        else return; // hint 类仅提示
        state.notice = null;
        render();
        saveWidgetState();
      })
    );
    document.getElementById("btn-fig-save")?.addEventListener("click", async () => {
      const url = String(document.getElementById("fig-url")?.value ?? "").trim();
      setBusy(true);
      try {
        await callTool("wudi_figma_link", { url });
        state.figmaUrl = url;
        state.notice = { kind: "ok", text: "Figma 链接已保存。" };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 300) };
      }
      setBusy(false);
    });
    document.getElementById("btn-fig-open")?.addEventListener("click", async () => {
      const url = String(document.getElementById("fig-url")?.value ?? "").trim() || state.figmaUrl;
      if (!url) return;
      try {
        await app.openLink({ url });
      } catch (err) {
        state.notice = { kind: "err", text: `打开失败：${String(err.message ?? err).slice(0, 200)}` };
        render();
      }
    });
    document.getElementById("btn-dc-new")?.addEventListener("click", async () => {
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里说「用 DesignCraft 新建设计文档」。" };
          render();
          return;
        }
        await app.sendMessage({ role: "user", content: { type: "text", text: "请用 DesignCraft 插件新建一个 1440x900 的设计文档（new_document），并在面板打开编辑器，告诉我文档状态。" } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });
    document.getElementById("btn-dc-render")?.addEventListener("click", async () => {
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里说「用 DesignCraft 渲染当前页到 .wudi/design/renders/」。" };
          render();
          return;
        }
        await app.sendMessage({ role: "user", content: { type: "text", text: "请用 DesignCraft 的 render_page 或 export_png 把当前设计页渲染为 PNG，保存到 .wudi/design/renders/ 目录（文件名用 设计名-时间戳.png），完成后告诉我路径。" } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });
    document.getElementById("btn-ex-new")?.addEventListener("click", async () => {
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里说「新建一个 Excalidraw 画板」。" };
          render();
          return;
        }
        await app.sendMessage({ role: "user", content: { type: "text", text: "请用 Excalidraw 插件新建一个空白设计画板（create_diagram，标题用「设计画布」+日期），打开后告诉我画板 id，我会在里面继续设计。" } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });
    document.getElementById("btn-ex-export")?.addEventListener("click", async () => {
      const name = String(document.getElementById("cv-name")?.value ?? "").trim() || `canvas-${Date.now().toString(36)}`;
      setBusy(true);
      let path = "";
      try {
        const res = await callTool("wudi_canvas_export", { name, format: "excalidraw" });
        path = res.structuredContent?.excalidraw ?? "";
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 400) };
        setBusy(false);
        return;
      }
      setBusy(false);
      try {
        await app.sendMessage({ role: "user", content: { type: "text", text: `请用 Excalidraw 插件的 open_diagram 打开工作区文件 ${path}（导入并打开画板）。` } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
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
    document.getElementById("btn-gen")?.addEventListener("click", async () => {
      const name = String(document.getElementById("gen-name")?.value ?? "").trim();
      const tmpl = String(document.getElementById("gen-template")?.value ?? "dashboard");
      if (!name) {
        state.notice = { kind: "err", text: "请先填页面名称（这是生成 HTML 设计稿的流程；只想快速建 .fig？用上方「新建并编辑」）。" };
        render();
        return;
      }
      try {
        if (!app.getHostCapabilities()?.message) {
          state.notice = { kind: "err", text: "宿主不支持从面板发消息；请在会话里直接执行 /wudi-ui。" };
          render();
          return;
        }
        state.notice = { kind: "ok", text: `已唤起 Agent：用 ${tmpl} 模板生成「${name}」设计稿，完成后回到本页刷新即可看到。` };
        render();
        await app.sendMessage({ role: "user", content: { type: "text", text: `请按 wudi-ui 技能的流程，从 ${tmpl} 模板起步为当前项目生成名为「${name}」的 UI 设计稿（复制模板到 .wudi/design/mockups/${name}-v1.html 后按业务改造、接入项目 tokens、截图自检一轮）。完成后告诉我。` } });
      } catch (err) {
        state.notice = { kind: "err", text: `唤起失败：${String(err.message ?? err).slice(0, 300)}` };
        render();
      }
    });
    document.getElementById("btn-export")?.addEventListener("click", async () => {
      setBusy(true);
      try {
        const res = await callTool("wudi_design_tokens_export", { format: "css" });
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "已导出" };
      } catch (err) {
        state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 500) };
      }
      setBusy(false);
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

  async function loadDesign(opts = {}) {
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
      try {
        const linkRes = await callTool("wudi_figma_link", {});
        state.figmaUrl = linkRes?.structuredContent?.url ?? "";
      } catch { state.figmaUrl = ""; }
      try {
        const ds = await callTool("wudi_designs_list", {});
        state.designs = struct(ds);
      } catch { state.designs = null; }
    } catch {
      state.design = { tokens: null, files: [] };
    }
    /* 设计页 = 画布：从项目导航进入设计页且只有一个画布时，直接进入编辑器 */
    if (opts?.autoEnter && state.view === "detail" && state.tab === "design" && !state.opEmbed) {
      const list = state.designs?.designs ?? [];
      if (list.length === 1) { await openOpEmbed(list[0].path); return; }
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
    state.designs = {
      designs: [
        { name: "ui.fig", path: "designs/ui.fig", format: "fig（可编辑）", sizeKB: 128.4, updatedAt: iso(30) },
        { name: "landing.fig", path: "designs/landing.fig", format: "fig（可编辑）", sizeKB: 42.1, updatedAt: iso(1800) },
      ],
    };
    state.design = {
      tokens: {
        color: { primary: "#0066dd", accent: "#7c5cf0", text: "#171a21", bg: "#ffffff", ok: "#0e8a4f", err: "#c73a33" },
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

  function loadDemoCanvas() {
    state.cv = { tx: 30, ty: 30, scale: 0.55 };
    state.canvas = {
      frames: [
        { id: "f-d1", name: "工作台-1440", x: 0, y: 0, w: 1440, h: 900, background: "#ffffff" },
        { id: "f-d2", name: "移动端-375", x: 1560, y: 0, w: 375, h: 812, background: "#ffffff" },
      ],
      shapes: [
        { id: "d-r1", type: "rect", frameId: "f-d1", x: 40, y: 40, w: 260, h: 800, fill: "#e9eefe", stroke: "#0066dd", fontSize: 14, text: "" },
        { id: "d-t1", type: "text", frameId: "f-d1", x: 70, y: 90, w: 200, h: 24, fill: "", stroke: "#171a21", fontSize: 18, text: "侧栏导航" },
        { id: "d-r2", type: "rect", frameId: "f-d1", x: 330, y: 40, w: 1070, h: 120, fill: "#f3ecfe", stroke: "#7c5cf0", fontSize: 14, text: "" },
        { id: "d-t2", type: "text", frameId: "f-d1", x: 360, y: 90, w: 300, h: 22, fill: "", stroke: "#171a21", fontSize: 16, text: "统计卡片区 ×4" },
        { id: "d-r3", type: "rect", frameId: "f-d1", x: 330, y: 180, w: 1070, h: 560, fill: "#e2f5ea", stroke: "#0e8a4f", fontSize: 14, text: "" },
        { id: "d-t3", type: "text", frameId: "f-d1", x: 360, y: 220, w: 300, h: 22, fill: "", stroke: "#171a21", fontSize: 16, text: "表格区" },
        { id: "d-m1", type: "rect", frameId: "f-d2", x: 1590, y: 60, w: 315, h: 120, fill: "#f3ecfe", stroke: "#7c5cf0", fontSize: 14, text: "" },
        { id: "d-m2", type: "text", frameId: "f-d2", x: 1610, y: 100, w: 240, h: 22, fill: "", stroke: "#171a21", fontSize: 15, text: "移动端首屏" },
        { id: "d-m3", type: "rect", frameId: "f-d2", x: 1590, y: 200, w: 315, h: 420, fill: "#e9eefe", stroke: "#0066dd", fontSize: 14, text: "" },
        { id: "d-m4", type: "text", frameId: "f-d2", x: 1610, y: 240, w: 240, h: 22, fill: "", stroke: "#171a21", fontSize: 15, text: "列表区" },
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
    /* v0.31：打开固定落在项目选择/创建页，不做 widgetState 恢复进项目内容 */
    if (DEMO) {
      state.connected = true; // demo 模式不连宿主，但允许 reportSize
      loadDemoData();
      render();
      return;
    }
    // 握手优先：connect 成功后再做任何可能出错的渲染 —— 渲染异常绝不能吃掉 ui/initialize 握手
    try {
      await app.connect();
      state.connected = true;
    } catch (err) {
      renderFatal(err);
      return;
    }
    applyTheme();
    try {
      // OpenPencil 式实时协同：订阅画布变更桥，Agent 操作实时同步到面板
      const bridgeRes = await callTool("wudi_canvas_bridge", {}).catch(() => null);
      const bridgeUrl = bridgeRes?.structuredContent?.url;
      if (bridgeUrl) {
        const es = new EventSource(bridgeUrl);
        es.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "canvas-changed" && !state.canvasBusy && !state.canvasDragging) loadCanvas();
          } catch { /* 忽略畸形消息 */ }
        };
      }
    } catch { /* 桥不可用时降级为手动刷新 */ }
    try {
      render();          // 先渲染 landing（带加载态）
      await loadAll();   // 当前项目数据 + 注册表（loadAll 尾部在 landing 视图会拉项目列表）
    } catch (err) {
      try { app.sendLog?.({ level: "error", data: `[wudi] 启动渲染失败: ${String(err?.stack ?? err).slice(0, 600)}` }); } catch {}
      state.notice = { kind: "err", text: `启动渲染出错：${String(err?.message ?? err).slice(0, 300)}` };
      try { render(); } catch { /* 保底不崩 */ }
    }
  }

  app.onteardown = () => { /* 面板无持久资源需释放 */ };
  main();
})();
