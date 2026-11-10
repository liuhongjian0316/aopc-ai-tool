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


  const app = new App(
    { name: "wudi-coding", version: "0.40.2" },
    { availableDisplayModes: ["inline", "fullscreen"] }
  );
  /* 资源缓存：设计图 base64 与设计稿 HTML 文本（readServerResource 经 server 动态资源管线） */

  const state = {
    view: "projects",  // 打开先见项目选择/创建页；点项目卡片选中后才进入项目内容（v0.31）
    drill: null,       // 历史字段（保留兼容）
    projectRoot: "",   // 正在查看的项目根（空 = 当前工作区；非空 = 已登记的其他项目）
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
    arch: null,        // wudi_architecture structuredContent（架构页）
    archPlan: null,    // wudi_arch_plan structuredContent（空项目架构方案）
    archWizard: false, // 架构向导展开态
    archKind: "web",   // 方案项目类型
    archBusy: false,   // 生成方案 / 写入骨架进行中
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
  /** 复制文本：优先 Clipboard API；沙箱禁用它时回落到临时 textarea + execCommand。 */
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }
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
    if (!p.build) acts.push(["补构建命令", "流水线配置缺 build —— 在总览页完善部署配置", "hint"]);
    if (!resolved?.deployRoot) acts.push(["补部署目标", "档案缺 deployRoot，部署流水线无法启动", "hint"]);
    if (!resolved?.healthCheck?.url) acts.push(["配健康检查", "没有健康检查 URL，部署将跳过线上验证", "hint"]);
    if (p.build && resolved?.deployRoot && !deploys.length) acts.push(["首次部署", "一切就绪，去「部署」页走五阶段流水线", "goto-deploys"]);
    if (deploys.length) {
      const last = deploys[0];
      if (last.status === "failed") acts.push(["排查上次失败", `版本 ${last.release ?? ""} 部署失败（${last.failedStage ?? "?"}）—— 去「部署」页健康检查或回滚`, "goto-deploys"]);
    }
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
        { method: "ui/set-widget-state", params: { widgetState: { view: state.view, tab: state.tab, projectRoot: state.projectRoot } } },
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
    if (Array.isArray(sc.projects)) state.projects = { projects: sc.projects };
    if (Array.isArray(sc.designs)) state.designs = { designs: sc.designs };
    /* Agent 的设计工具需要编辑器面板：live=false（get_design_status）或「编辑器未打开」失败 → 自动打开编辑器 */
    try {
      const overlayOn = document.getElementById("op-layer")?.classList.contains("on");
      const errText = (result?.content ?? []).map((c) => c.text ?? "").join("\n");
      const needEditor = (sc && sc.live === false) ||
        (result?.isError && /编辑器未打开|设计稿编辑器未打开|设计稿面板未连接/.test(errText));
      if (needEditor && !overlayOn && !state.opEmbed) {
        const hint = sc?.document?.path ?? sc?.activeDocument?.path ?? state.designs?.designs?.[0]?.path;
        if (hint) {
          void openOpEmbed(hint);
          state.notice = { kind: "ok", text: "检测到 Agent 需要编辑画布：已自动打开编辑器，让它稍后重试" };
        }
      }
    } catch { /* 自动打开失败不阻塞 */ }
    render();
  };

  /* ---------- 渲染骨架 ---------- */
  const ICONS = {
    projects: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 2A1.5 1.5 0 0 1 3 .5h4A1.5 1.5 0 0 1 8.5 2v4A1.5 1.5 0 0 1 7 7.5H3A1.5 1.5 0 0 1 1.5 6V2Zm7 8A1.5 1.5 0 0 1 10 8.5h4A1.5 1.5 0 0 1 15.5 10v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 14v-4ZM1.5 10A1.5 1.5 0 0 1 3 8.5h4A1.5 1.5 0 0 1 8.5 10v4A1.5 1.5 0 0 1 7 15.5H3A1.5 1.5 0 0 1 1.5 14v-4Zm7-8A1.5 1.5 0 0 1 10 .5h4A1.5 1.5 0 0 1 15.5 2v4A1.5 1.5 0 0 1 14 7.5h-4A1.5 1.5 0 0 1 8.5 6V2Z"/></svg>',
    overview: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5h-1.6A4.9 4.9 0 1 1 8 3.1V1.5Zm1.5 0v4.7l3.3-3.4A6.5 6.5 0 0 0 9.5 1.5Z"/></svg>',
    arch: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="6" y="1" width="4" height="3" rx="1"/><rect x="1" y="9" width="4" height="3" rx="1"/><rect x="11" y="9" width="4" height="3" rx="1"/><rect x="7.4" y="4" width="1.2" height="3"/><rect x="3.6" y="6.4" width="8.8" height="1.2"/><rect x="3.4" y="7.6" width="1.2" height="1.6"/><rect x="11.4" y="7.6" width="1.2" height="1.6"/></svg>',
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
      ["arch", "架构", ICONS.arch, ""],
      ["deploys", "部署", ICONS.deploys, ""],
      ["design", "设计", ICONS.design, ""],
      ["docs", "文档", ICONS.docs, (state.data?.docs ?? []).length || ""],
    ];
    const nav = inProject ? navTabs.map(([id, label, icon, count]) =>
      `<button data-tab="${id}" class="${(state.view === "projects" ? "projects" : state.tab) === id ? "active" : ""}">${icon}${label}${count !== "" ? `<span class="count">${esc(String(count))}</span>` : ""}</button>`
    ).join("") : "";

    let body;
    if (state.view === "projects" && !state.drill) body = renderProjects();
    else if (state.drill) body = renderDrill();
    else body = state.tab === "overview" ? renderOverview(state.data?.project ?? null)
      : state.tab === "arch" ? renderArch()
      : state.tab === "deploys" ? renderDeploys()
      : state.tab === "design" ? renderDesign()
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
        if (b.dataset.tab === "projects") state.projectRoot = "";
        state.tab = b.dataset.tab === "projects" ? state.tab : b.dataset.tab;
        state.notice = null;
        if (state.tab === "design" && state.view === "detail") loadDesign();
        if (state.tab === "arch" && state.view === "detail") loadArch();
        if (state.view === "projects") loadProjects();
        render();
        saveWidgetState();
      })
    );
    document.getElementById("btn-refresh")?.addEventListener("click", () => {
      state.drill = null;
      loadAll();
      if (state.view === "detail" && state.tab === "design") loadDesign();
      if (state.view === "detail" && state.tab === "arch") loadArch();
    });
    document.getElementById("btn-back")?.addEventListener("click", () => { state.drill = null; render(); saveWidgetState(); });
    document.getElementById("btn-back-projects")?.addEventListener("click", () => {
      state.view = "projects";
      state.tab = "overview";
      state.projectRoot = "";
      state.notice = null;
      render();
      saveWidgetState();
    });
    bindActions();
    bindArchActions();
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
        <div class="pname">${esc(p.name)}</div>
        <div class="ppath">${esc(shortPath(p.path))}</div>
        <div class="stats">
          ${p.techStack ? `<span class="chip accent">${esc(p.techStack)}</span>` : ""}
          ${(p.envNames ?? []).slice(0, 3).map((e) => `<span class="chip">${esc(e)}</span>`).join("")}
        </div>
        <div class="foot">${healthDot(p)}<span style="flex:1"></span>文档 ${p.docsCount} · 设计 ${p.designCount}</div>
        <div class="cta">进入项目内容 →</div>
        <div class="pcard-actions">
          <button class="link-act" data-prj-rename="${esc(p.id)}" title="重命名项目显示名">重命名</button>
          <button class="link-del" data-remove="${esc(p.id)}" title="从工作台移除（不影响项目文件）">移除</button>
        </div>
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
          <span class="k">项目路径</span><span class="v" style="display:flex;gap:6px"><input id="p-path" placeholder="当前项目根或其子文件夹（可点右侧浏览）"><button class="btn" id="btn-pbrowse" style="flex:none;white-space:nowrap">浏览…</button></span>
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
        </div>
      </div>
      <div class="card"><h3>最近部署<span class="line"></span></h3>
        ${last ? `<div class="kv"><span class="k">版本</span><span class="v">${esc(last.release)}</span><span class="k">结果</span><span class="v plain">${badge(last.status)}（${esc(last.type === "rollback" ? "回滚" : "部署")}@${esc(last.env ?? "default")}）</span><span class="k">时间</span><span class="v plain">${esc(fmtTime(last.finishedAt))}</span></div>` : `<div class="muted">该项目还没有部署记录${p.isCurrent ? "，去「部署」页发布第一版。" : "。"}</div>`}
        ${!p.isCurrent && p.archived ? '<div class="muted" style="margin-top:8px">这是只读总览；部署操作请在该项目的工作区会话中进行（AOPC 打开该项目目录）。</div>' : ""}
      </div>
      <div class="card"><h3>资产<span class="line"></span></h3>
        <div class="kv"><span class="k">文档</span><span class="v plain">${p.docsCount} 份</span><span class="k">画布</span><span class="v plain">${p.designCount} 个</span><span class="k">登记时间</span><span class="v plain">${esc(fmtTime(p.addedAt))}</span></div>
      </div>`;
  }

  /* ---------- 当前项目四页 ---------- */
  function renderOverview(p) {
    const resolvedCfg = state.data?.resolved;
    /* 档案缺失或部署配置不完整：显示（预填的）配置表单 —— 「未建档」概念已取消，档案由插件自动创建 */
    if ((!p || !p.build || !resolvedCfg?.deployRoot) && isForeignProject()) {
      return `<div class="card"><h3>部署配置<span class="line"></span></h3>
        <div class="muted">该项目还没有完整的构建/部署配置。请在该项目的工作区会话中完善（工作台里对非当前项目为只读）。</div>
      </div>`;
    }
    if (!p || !p.build || !resolvedCfg?.deployRoot) {
      return `
      <div class="card"><h3>${p ? "完善部署配置" : "快速建档"}<span class="line"></span></h3>
        <div class="muted" style="margin-bottom:8px">${p ? "档案已自动创建；填好构建/部署信息即可开通部署流水线。" : "填基础配置即可开通部署流水线。"}多环境/通知/确认词可用 <span class="mono">wudi_env_set</span> 配置。</div>
        <div class="kv">
          <span class="k">项目名</span><span class="v"><input id="f-name" style="${INPUT_CSS}" placeholder="my-app" value="${esc(p?.name ?? "")}"></span>
          <span class="k">技术栈</span><span class="v"><input id="f-tech" style="${INPUT_CSS}" placeholder="vite-spa / go-service / node-nest" value="${esc(p?.techStack ?? "")}"></span>
          <span class="k">构建命令</span><span class="v"><input id="f-build" style="${INPUT_CSS}" placeholder="npm run build" value="${esc(p?.build ?? "")}"></span>
          <span class="k">打包</span><span class="v"><select id="f-ptype" style="${INPUT_CSS}"><option value="dir" ${p?.package?.type === "docker-image" ? "" : "selected"}>产物目录（软链发布）</option><option value="docker-image" ${p?.package?.type === "docker-image" ? "selected" : ""}>Docker 镜像</option></select></span>
          <span class="k">产物路径</span><span class="v"><input id="f-ppath" style="${INPUT_CSS}" placeholder="dist（镜像模式填镜像名如 myapp:latest）" value="${esc(p?.package?.type === "docker-image" ? (p?.package?.dockerImage ?? "") : (p?.package?.path ?? ""))}"></span>
          <span class="k">部署根目录</span><span class="v"><input id="f-root" style="${INPUT_CSS}" placeholder="/srv/myapp" value="${esc(p?.deployRoot ?? "")}"></span>
          <span class="k">切换脚本</span><span class="v"><input id="f-script" style="${INPUT_CSS}" placeholder="docker compose up -d（可留空）" value="${esc(p?.remoteScript ?? "")}"></span>
          <span class="k">健康检查</span><span class="v"><input id="f-health" style="${INPUT_CSS}" placeholder="http://127.0.0.1:8080/healthz（可留空）" value="${esc(p?.healthCheck?.url ?? "")}"></span>
        </div>
        <div class="btnrow" style="margin-top:10px">
          <button class="btn primary" id="btn-init" ${state.busy ? "disabled" : ""}>${p ? "保存配置" : "建立档案"}</button>
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
        <div class="stat"><div class="num">${(state.designs?.designs ?? []).length}</div><div class="lbl">设计画布</div></div>
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
      ${isForeignProject() ? "" : `<div class="card"><h3>连接与通知<span class="line"></span></h3>
        <div class="btnrow">
          <button class="btn" id="btn-ping" ${state.busy ? "disabled" : ""}>测试 SSH</button>
          <button class="btn" id="btn-notify-test" ${state.busy ? "disabled" : ""}>测试通知</button>
          <span id="ping-result" class="muted">凭据来自插件设置；通知按档案 notifyWebhook</span>
        </div>
      </div>`}
      <div class="card"><h3>最近部署<span class="line"></span></h3>
        ${latest ? `<div class="kv"><span class="k">版本</span><span class="v">${esc(latest.release ?? latest.id)}</span><span class="k">状态</span><span class="v plain">${badge(latest.status)}</span></div>` : '<span class="muted">还没有部署记录，去「部署」页发布第一版。</span>'}
      </div>`;
  }

  function renderDeploys() {
    const deploys = state.history?.deploys ?? state.data?.deploys ?? [];
    return `
      <div class="card"><h3>操作<span class="line"></span></h3>
        <div class="btnrow">
          <button class="btn primary" id="btn-deploy" ${state.busy || !state.data?.project || isForeignProject() ? "disabled" : ""}>部署新版本…</button>
          <button class="btn" id="btn-health" ${state.busy || isForeignProject() ? "disabled" : ""}>健康检查</button>
          <button class="btn danger" id="btn-rollback" ${state.busy || !deploys.length || isForeignProject() ? "disabled" : ""}>回滚上一版…</button>
          <span class="muted">${isForeignProject() ? "查看其他项目：部署/回滚/体检请在该项目工作区进行（此处只读）" : "均先出预检计划，确认后执行（走宿主审批）"}</span>
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
    /* 设计页 = 项目画布：增（创建）删（删除）改（重命名）查（进入/列表），全部基于 openPencil */
    const canvases = state.designs?.designs ?? [];
    const canvasCards = canvases.map((d) => `
      <div class="pcard cvcard" data-cv-open="${esc(d.path)}" title="进入画布编辑">
        <div class="pname">${esc(String(d.name).replace(/\.(fig|pen)$/i, ""))}</div>
        <div class="ppath">${esc(d.path)} · ${esc(String(d.sizeKB))} KB</div>
        <div class="stats"><span class="chip accent">${esc(d.format)}</span>${state.opEmbed?.path === d.path ? '<span class="chip">编辑中</span>' : ""}</div>
        <div class="foot">${esc(fmtTime(d.updatedAt))}<span style="flex:1"></span><b class="cta-inline">进入画布 →</b></div>
        <button class="cv-del" data-cv-delete="${esc(d.path)}" title="删除此画布">×</button>
        <button class="cv-ren" data-cv-rename="${esc(d.path)}" title="重命名此画布">✎</button>
      </div>`).join("");
    const createRow = `
      <div class="card" style="margin-top:12px">
        <h3>新建画布<span class="line"></span></h3>
        <div class="btnrow">
          <input id="op-name" placeholder="画布名称，如 UI / 官网 / App（可留空）" style="width:260px;flex:none">
          <button class="btn primary" id="btn-op-new" ${state.busy ? "disabled" : ""}>创建画布</button>
          <span class="muted">文件存于项目 .wudi/designs/ 下，创建后自动进编辑器</span>
        </div>
      </div>`;
    const canvasSection = canvases.length
      ? `<div class="card"><h3 style="color:var(--accent-strong)">项目画布<span class="line"></span><span class="muted" style="text-transform:none;letter-spacing:0">存储于工作区 .wudi/designs/（按项目分目录）</span></h3>
          <div class="grid">${canvasCards}</div>
          ${state.canvasCreateOpen ? createRow : `<div class="btnrow" style="margin-top:10px"><button class="btn" id="btn-cv-create-toggle">＋ 新建画布</button><span class="muted">一个画布容纳项目的全部 UI 设计：网站 / 移动端 / 平板各建画板</span></div>`}
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
    return canvasSection;
  }

  /* ---------- 架构页：技术栈 / 语言 / 模块 / 关键文件 / 服务（静态扫描，只读） ---------- */
  const LANG_COLORS = ["#4f7cff", "#e8a33d", "#3fbf8f", "#b06df0", "#e2605f", "#5bb7d6", "#9a9a9a", "#c9b458"];
  /* 空项目架构向导：类型与可选框架（与服务端 wudi_arch_plan 的预设一一对应） */
  const ARCH_KINDS = [
    ["web", "Web 前端", [["vue-vite", "Vue 3 + Vite"], ["react-vite", "React + Vite"]]],
    ["miniprogram", "小程序", [["taro", "Taro（React）"], ["native-wechat", "微信原生"]]],
    ["mobile", "移动 App", [["flutter", "Flutter"], ["swiftui", "SwiftUI"]]],
    ["backend", "后端服务", [["nest", "NestJS"], ["go-gin", "Go + Gin"]]],
    ["monorepo", "Monorepo 全栈", [["pnpm-workspace", "pnpm workspace"]]],
  ];
  function archKindDef(id) { return ARCH_KINDS.find((k) => k[0] === id) ?? ARCH_KINDS[0]; }
  function archIsEmpty(a) {
    if (!a || a.error) return false;
    const entries = a.entries ?? [];
    return (a.scanned?.files ?? 0) === 0 && (a.modules ?? []).length === 0 &&
      !entries.some((e) => /^(package\.json|go\.mod|pubspec\.yaml|Podfile|pom\.xml|Cargo\.toml)$/.test(e.name));
  }
  function archPlanTree(plan) {
    const dirs = plan.dirs ?? [];
    const files = (plan.files ?? []).map((f) => f.path);
    const dirSet = new Set(dirs);
    for (const p of [...dirs, ...files]) {
      const parts = p.split("/");
      for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join("/"));
    }
    const paths = [...new Set([...dirSet, ...files])].sort();
    return paths.map((p) => {
      const depth = Math.max(0, p.split("/").length - 1);
      return `<div>${"&nbsp;&nbsp;&nbsp;".repeat(depth)}${esc(p.split("/").pop())}${dirSet.has(p) ? "/" : ""}</div>`;
    }).join("");
  }
  function renderArchWizard() {
    const def = archKindDef(state.archKind);
    const fw = state.archFw && def[2].some((f) => f[0] === state.archFw) ? state.archFw : def[2][0][0];
    const name = state.data?.project?.name || "";
    return `
      <div class="card"><h3>设计项目架构<span class="line"></span></h3>
        <div class="muted">当前项目还没有代码。选择项目类型生成架构方案，随后可一键写入骨架，或让 Agent 按方案搭建项目框架。</div>
        <div class="entrychips" style="margin:12px 0">
          ${ARCH_KINDS.map(([id, label]) => `<button class="btn ${id === state.archKind ? "primary" : ""}" data-arch-kind="${id}" ${state.archBusy ? "disabled" : ""}>${label}</button>`).join("")}
        </div>
        <div class="kv" style="grid-template-columns:88px 1fr">
          <span class="k">框架</span><span class="v"><select id="arch-fw" style="${INPUT_CSS}" ${state.archBusy ? "disabled" : ""}>${def[2].map(([id, label]) => `<option value="${id}" ${id === fw ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></span>
          <span class="k">项目名</span><span class="v"><input id="arch-name" style="${INPUT_CSS}" value="${esc(name)}" placeholder="项目显示名（可留空）" ${state.archBusy ? "disabled" : ""}></span>
        </div>
        <div class="btnrow" style="margin-top:10px">
          <button class="btn primary" id="btn-arch-plan" ${state.archBusy ? "disabled" : ""}>${state.archBusy ? '<span class="spin"></span>' : ""}生成架构方案</button>
          <span class="muted">方案会保存到 .wudi/<项目名>/architecture.json，Agent 可直接读取</span>
        </div>
      </div>`;
  }
  function renderArchPlan(p) {
    const cmds = p.commands ?? {};
    return `
      <div class="banner">
        <div class="row"><h2>架构方案</h2><span class="chip">${esc(p.kindLabel ?? "")} · ${esc(p.frameworkLabel ?? p.framework ?? "")}</span></div>
        <div class="meta"><span class="chip">${esc(p.name ?? "")}</span><span class="chip">${(p.files ?? []).length} 个文件</span><span class="chip">${esc(p.savedPath ?? ".wudi/<项目名>/architecture.json")}</span></div>
      </div>
      <div class="card"><h3>方案说明<span class="line"></span></h3>
        <div class="muted" style="margin-bottom:10px">${esc(p.summary ?? "")}</div>
        <div class="plan-tree mono">${archPlanTree(p)}</div>
        <div class="muted" style="margin-top:10px">命令：安装 <span class="mono">${esc(cmds.install ?? "—")}</span>｜开发 <span class="mono">${esc(cmds.dev ?? "—")}</span>｜构建 <span class="mono">${esc(cmds.build ?? "—")}</span></div>
        ${(p.notes ?? []).length ? `<div class="muted" style="margin-top:8px">注意：${p.notes.map((n) => esc(n)).join("；")}</div>` : ""}
      </div>
      <div class="btnrow">
        <button class="btn primary" id="btn-arch-scaffold" ${state.archBusy ? "disabled" : ""}>${state.archBusy ? '<span class="spin"></span>' : ""}写入骨架</button>
        <button class="btn" id="btn-arch-agent" ${state.archBusy ? "disabled" : ""}>交给 Agent 搭建</button>
        <button class="btn" id="btn-arch-replan" ${state.archBusy ? "disabled" : ""}>重新设计</button>
      </div>`;
  }
  function renderArch() {
    const a = state.arch;
    if (state.archPlan) return renderArchPlan(state.archPlan);
    if (!a) return `<div class="card"><h3>项目架构<span class="line"></span></h3><div class="muted">正在扫描项目结构…</div></div>`;
    if (a.error) return `<div class="card"><h3>项目架构<span class="line"></span></h3><div class="muted">扫描失败：${esc(a.error)}</div></div>`;
    if (archIsEmpty(a) || state.archWizard) return renderArchWizard();
    const langs = a.languages ?? [];
    const frameworks = a.frameworks ?? [];
    const pms = a.packageManagers ?? [];
    const modules = a.modules ?? [];
    const entries = a.entries ?? [];
    const scripts = a.scripts ?? [];
    const related = a.related ?? {};
    const chips = [...frameworks, ...pms].slice(0, 12);
    const langBar = langs.length
      ? `<div class="langbar">${langs.slice(0, 8).map((l, i) => `<i style="width:${Math.max(2, l.pct)}%;background:${LANG_COLORS[i % LANG_COLORS.length]}" title="${esc(l.name)} ${l.files} 文件"></i>`).join("")}</div>
        <div class="langlist">${langs.slice(0, 8).map((l, i) => `<span><i style="background:${LANG_COLORS[i % LANG_COLORS.length]}"></i>${esc(l.name)} <b>${l.files}</b><em>${l.pct}%</em></span>`).join("")}</div>`
      : `<div class="muted">未扫描到源码文件（可能都在依赖/产物目录里）。</div>`;
    const moduleCards = modules.length
      ? `<div class="grid">${modules.slice(0, 12).map((m) => `
          <div class="card mod">
            <div class="mod-head"><b>${esc(m.name)}</b><span class="chip">${m.files} 文件</span></div>
            <div class="mod-path mono">${esc(m.path)}</div>
            ${(m.languages ?? []).length ? `<div class="mod-langs">${m.languages.map((l) => `<span class="chip">${esc(l)}</span>`).join("")}</div>` : ""}
          </div>`).join("")}</div>`
      : `<div class="muted">没有可展示的顶层目录。</div>`;
    const entryChips = entries.length
      ? entries.map((e) => `<span class="chip mono">${esc(e.name)}</span>`).join("")
      : `<span class="muted">未发现关键配置文件</span>`;
    const services = a.compose?.services ?? [];
    return `
      <div class="banner">
        <div class="row"><h2>${esc(a.name || "项目")}</h2><span class="chip">${a.scanned?.files ?? 0} 个源码文件${a.scanned?.truncated ? "（已截断）" : ""}</span></div>
        <div class="meta">${chips.length ? chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("") : '<span class="chip">未识别技术栈</span>'}</div>
      </div>
      <div class="card"><h3>语言分布<span class="line"></span></h3>${langBar}</div>
      <div class="sec"><div class="sec-title">顶层模块<span class="line"></span></div>${moduleCards}</div>
      <div class="grid" style="margin-top:12px">
        <div class="card"><h3>关键文件<span class="line"></span></h3><div class="entrychips">${entryChips}</div></div>
        <div class="card"><h3>关联资产<span class="line"></span></h3>
          <div class="kv">
            <span class="k">画布</span><span class="v plain">${related.designs ?? 0} 个</span>
            <span class="k">文档</span><span class="v plain">${related.docs ?? 0} 份</span>
            <span class="k">环境</span><span class="v plain">${(related.envs ?? []).join("、") || "未配置"}</span>
            <span class="k">部署根</span><span class="v">${esc(related.deployRoot || "—")}</span>
            <span class="k">健康检查</span><span class="v">${esc(related.healthCheck || "—")}</span>
          </div>
        </div>
      </div>
      ${services.length ? `<div class="card" style="margin-top:12px"><h3>服务<span style="text-transform:none">（${esc(a.compose.file)}）</span><span class="line"></span></h3>
        <div class="entrychips">${services.map((s) => `<span class="chip mono">${esc(s.name)}${s.image ? ` · ${esc(s.image)}` : ""}${s.ports ? ` · ${esc(s.ports)}` : ""}</span>`).join("")}</div>
      </div>` : ""}
      ${scripts.length ? `<div class="card" style="margin-top:12px"><h3>脚本<span class="line"></span></h3>
        <div class="entrychips">${scripts.map((s) => `<span class="chip mono">${esc(s.name)}<span class="muted"> · ${esc(s.command)}</span></span>`).join("")}</div>
      </div>` : ""}
      ${(a.workspaces ?? []).length ? `<div class="card" style="margin-top:12px"><h3>Monorepo workspaces<span class="line"></span></h3><div class="entrychips">${a.workspaces.map((w) => `<span class="chip mono">${esc(w)}</span>`).join("")}</div></div>` : ""}
      <div class="btnrow" style="margin-top:10px"><button class="btn" id="btn-arch-wizard">＋ 为这个项目设计架构骨架</button></div>
      <div class="muted" style="margin-top:10px">扫描于 ${esc(fmtTime(a.generatedAt))} · 只读静态扫描（跳过 node_modules / dist 等目录），点右上「刷新」重新扫描</div>`;
  }

  function renderDocs() {
    const docs = state.data?.docs ?? [];
    return `<div class="card"><h3>文档库（.wudi/docs.json）<span class="line"></span></h3>
      <div class="btnrow" style="margin-bottom:8px">
        <button class="btn" id="btn-weekly" ${state.busy || isForeignProject() ? "disabled" : ""}>生成周报</button>
        <span class="muted">${isForeignProject() ? "查看其他项目：只读（生成周报请在该项目工作区进行）" : "从 git log 生成近 7 天周报草稿并登记"}</span>
      </div>
      ${docs.length ? docs.map((d) =>
        `<div class="row clickable" data-path="${esc(d.path)}" title="点击让 Agent 打开并简介这份文档"><span class="badge neutral">${esc(TYPE_ZH[d.type] ?? d.type)}</span><span class="path">${esc(d.path)}</span><span class="time">${esc(fmtTime(d.updatedAt))}</span></div>`
      ).join("") : `<div class="empty" style="padding:22px">还没有登记文档。执行 <span class="mono">/wudi-docs</span> 生成后自动登记。</div>`}
    </div>`;
  }

  /* 文件夹选择弹窗：仅浏览当前项目根及其子文件夹（后端 wudi_fs_list_dirs 强校验） */
  const DEMO_FS = {
    "/Users/me/code/zongheng-app": ["apps", "packages", "docs", "scripts"],
    "/Users/me/code/zongheng-app/apps": ["web", "mobile"],
    "/Users/me/code/zongheng-app/packages": ["ui", "shared"],
  };
  async function fsList(path) {
    if (DEMO) {
      const root = "/Users/me/code/zongheng-app";
      const cur = path || root;
      const names = DEMO_FS[cur] ?? [];
      return {
        root,
        path: cur,
        parent: cur !== root ? cur.split("/").slice(0, -1).join("/") : "",
        dirs: names.map((n) => ({ name: n, path: `${cur}/${n}` })),
      };
    }
    const res = await callTool("wudi_fs_list_dirs", path ? { path } : {});
    return struct(res) ?? null;
  }

  function pickFolderDialog(initialPath = "") {
    return new Promise((resolvePromise) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `<div class="dialog" style="width:min(560px, calc(100vw - 40px))">
        <h3>选择项目文件夹</h3>
        <div class="muted" style="margin-bottom:8px" id="fp-scope">可选范围：当前项目根目录及其子文件夹</div>
        <div class="mono" id="fp-path" style="background:var(--bg-inset);border-radius:8px;padding:7px 10px;font-size:11.5px;word-break:break-all;margin-bottom:8px"></div>
        <div id="fp-list" class="fp-list"><div class="muted"><span class="spin"></span>加载中…</div></div>
        <div class="btnrow" style="margin-top:10px">
          <button class="btn" id="fp-up">↑ 上一级</button>
          <span style="flex:1"></span>
          <button class="btn" id="fp-cancel">取消</button>
          <button class="btn primary" id="fp-pick">选择此文件夹</button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      let data = null;
      const pathEl = overlay.querySelector("#fp-path");
      const listEl = overlay.querySelector("#fp-list");
      const upBtn = overlay.querySelector("#fp-up");
      const draw = () => {
        pathEl.textContent = data?.path ?? "";
        upBtn.disabled = !data?.parent;
        listEl.innerHTML = (data?.dirs ?? []).length
          ? data.dirs.map((d) => `<div class="fp-row" data-fp="${esc(d.path)}"><span class="fp-icon">▸</span><span class="fp-name">${esc(d.name)}</span><span class="muted">进入</span></div>`).join("")
          : '<div class="muted" style="padding:14px 4px">（没有子文件夹）</div>';
        listEl.querySelectorAll("[data-fp]").forEach((row) =>
          row.addEventListener("dblclick", () => go(row.dataset.fp))
        );
        listEl.querySelectorAll("[data-fp]").forEach((row) => {
          const enter = document.createElement("button");
          enter.className = "btn";
          enter.textContent = "进入";
          enter.addEventListener("click", (ev) => { ev.stopPropagation(); go(row.dataset.fp); });
          row.querySelector("span.muted")?.replaceWith(enter);
        });
      };
      const go = async (p) => {
        listEl.innerHTML = '<div class="muted"><span class="spin"></span>加载中…</div>';
        try {
          data = await fsList(p);
          draw();
        } catch (err) {
          listEl.innerHTML = `<div class="muted">读取失败：${esc(String(err.message ?? err).slice(0, 200))}</div>`;
        }
      };
      const done = (val) => { overlay.remove(); resolvePromise(val); };
      overlay.querySelector("#fp-cancel").addEventListener("click", () => done(null));
      overlay.addEventListener("click", (ev) => { if (ev.target === overlay) done(null); });
      overlay.querySelector("#fp-pick").addEventListener("click", () => done(data?.path ?? ""));
      upBtn.addEventListener("click", () => { if (data?.parent) go(data.parent); });
      go(initialPath || "");
    });
  }

  /** 确认弹窗（AOPC 沙箱禁用原生 confirm/alert）：Promise<boolean>。 */
  function confirmDialog(message) {
    return new Promise((resolvePromise) => {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.innerHTML = `<div class="dialog" style="width:min(420px, calc(100vw - 40px))">
        <h3>${esc(message)}</h3>
        <div class="btnrow"><button class="btn" id="dlg-cancel">取消</button><button class="btn danger" id="dlg-ok">删除</button></div>
      </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("#dlg-cancel").addEventListener("click", () => { overlay.remove(); resolvePromise(false); });
      overlay.querySelector("#dlg-ok").addEventListener("click", () => { overlay.remove(); resolvePromise(true); });
    });
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
window.__wudiErrs=[];window.__wudiLogs=[];
addEventListener("error",function(e){window.__wudiErrs.push(String(e.message||e.error||"error"))});
addEventListener("unhandledrejection",function(e){window.__wudiErrs.push(String(e.reason||"rejection"))});
(function(){var ce=console.error.bind(console);console.error=function(){try{window.__wudiLogs.push("error: "+Array.prototype.map.call(arguments,function(a){return String(a).slice(0,200)}).join(" | "))}catch(e){};return ce.apply(null,arguments)};var cw=console.warn.bind(console);console.warn=function(){try{window.__wudiLogs.push("warn: "+Array.prototype.map.call(arguments,function(a){return String(a).slice(0,200)}).join(" | "))}catch(e){};return cw.apply(null,arguments)}})();
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
    var m=raw.replace(/^https?:\\/\\/[^/]+/,"").replace(/^\\/+/,"");
    var hit=m.match(/^(canvaskit\.wasm|[A-Za-z0-9-]+\.(ttf|otf))$/);
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
        <button class="btn" id="op-layer-fit" title="缩放到全部内容（调用编辑器 zoomToFit）">适应视图</button>
        <button class="btn" id="op-layer-reload" title="重新加载编辑器">重载</button>
        <button class="btn danger" id="op-layer-close">关闭编辑器</button>
      </div>
      <div class="op-frame-holder"></div>`;
    document.body.appendChild(layer);
    layer.querySelector("#op-layer-close").addEventListener("click", () => closeOpEmbed());
    layer.querySelector("#op-layer-fit").addEventListener("click", () => {
      const frame = document.getElementById("op-frame");
      if (frame) opAutoFit(frame);
    });
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
              hostInfo: { name: "wudi-workbench", version: "0.40.2" },
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
            /* 协议要求 content 是 content block 数组（编辑器 SDK 已按数组发送） */
            await app.sendMessage?.({ role: "user", content: p.content ?? [{ type: "text", text: "" }] });
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
    /* 渲染自检：连接后 6s 读编辑器全局接口（srcdoc 同源）：
     * - canvasReady 判断渲染器是否真的起来了；
     * - 就绪则自动 zoomToFit()（文档加载后视口可能偏离内容，避免“已连接但画布空”）。 */
    setTimeout(() => {
      const live = document.getElementById("op-frame");
      if (!live || !opReady) return;
      try {
        const win = live.contentWindow;
        const errs = [...(win?.__wudiErrs ?? []), ...(win?.__wudiLogs ?? [])];
        const api = win?.__openpencilPanel;
        if (!api) { opSetStatus("编辑器接口未就绪（仍可用；看不到内容请在编辑器内按 Shift+1）", "ok"); return; }
        let ready = false;
        try { ready = !!api.canvasReady; } catch { ready = false; }
        if (!ready) {
          // 再给 4s 渲染器初始化（大文档 / 慢机器）；仍未就绪才报错并展示首条内部错误
          setTimeout(() => {
            try {
              if (api.canvasReady) { opAutoFit(live); return; }
              if (errs.length) opSetStatus(`编辑器渲染异常：${String(errs[0]).slice(0, 160)}`, "err");
              else opSetStatus("画布渲染器未就绪（CanvasKit/wasm 可能被限制）", "err");
            } catch { /* ignore */ }
          }, 4000);
          return;
        }
        /* 渲染器正常：忽略无害 console 日志，直接适应视图 */
        opAutoFit(live);
      } catch { /* 读不到 iframe 就跳过 */ }
    }, 6000);
  }

  /** 自动适应视图：直接调用编辑器暴露的 zoomToFit（同源 srcdoc）。 */
  function opAutoFit(frameEl) {
    try {
      const api = frameEl.contentWindow?.__openpencilPanel;
      api?.editor?.zoomToFit?.();
      opSetStatus("已连接 · 已自动适应视图", "ok");
    } catch {
      opSetStatus("已连接 · 看不到内容请在编辑器内按 Shift+1", "ok");
    }
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

  /** 项目根参数：查看其他项目时随工具调用传递（空 = 当前工作区）。 */
  function rootArg() {
    return state.projectRoot ? { root: state.projectRoot } : {};
  }
  const isForeignProject = () => !!state.projectRoot;

  /* ---------- 架构页交互：向导 / 生成方案 / 写入骨架 / 交给 Agent ---------- */
  function demoArchPlan(kind, fw, name) {
    const def = archKindDef(kind);
    const f = def[2].find((x) => x[0] === fw) ?? def[2][0];
    return {
      kind, kindLabel: def[1], framework: f[0], frameworkLabel: f[1], name: name || "demo",
      summary: "示例架构方案（demo 模式：不会真的写文件）",
      dirs: ["src/components", "src/views"],
      files: ["package.json", "index.html", "vite.config.ts", "src/main.ts", "src/App.vue"].map((p) => ({ path: p, purpose: "" })),
      commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
      notes: [], savedPath: ".wudi/zongheng-app/architecture.json", generatedAt: new Date().toISOString(),
    };
  }
  function bindArchActions() {
    $root().querySelectorAll("[data-arch-kind]").forEach((b) => b.addEventListener("click", () => {
      state.archKind = b.dataset.archKind;
      state.archFw = "";
      state.archPlan = null;
      render();
    }));
    document.getElementById("btn-arch-wizard")?.addEventListener("click", () => { state.archWizard = true; render(); });
    document.getElementById("btn-arch-replan")?.addEventListener("click", () => { state.archPlan = null; state.archWizard = true; render(); });
    document.getElementById("btn-arch-plan")?.addEventListener("click", async () => {
      const fw = String(document.getElementById("arch-fw")?.value ?? "");
      const name = String(document.getElementById("arch-name")?.value ?? "").trim();
      state.archBusy = true;
      render();
      try {
        if (DEMO) {
          await new Promise((r) => setTimeout(r, 300));
          state.archPlan = demoArchPlan(state.archKind, fw, name);
        } else {
          const res = await callTool("wudi_arch_plan", { kind: state.archKind, ...(fw ? { framework: fw } : {}), ...(name ? { name } : {}), ...rootArg() });
          state.archPlan = struct(res);
        }
        state.notice = { kind: "ok", text: `已生成架构方案：${state.archPlan?.frameworkLabel ?? ""}` };
      } catch (err) {
        state.notice = { kind: "err", text: `生成架构方案失败：${String(err.message ?? err).slice(0, 300)}` };
      }
      state.archBusy = false;
      render();
    });
    document.getElementById("btn-arch-scaffold")?.addEventListener("click", async () => {
      if (!state.archPlan) return;
      if (DEMO) { state.notice = { kind: "ok", text: "演示模式：不会真的写文件" }; render(); return; }
      state.archBusy = true;
      render();
      let done = false;
      try {
        const res = await callTool("wudi_arch_scaffold", { plan: state.archPlan, confirm: true, ...rootArg() });
        const sc = struct(res);
        state.notice = { kind: "ok", text: `骨架已写入：新建 ${sc?.created?.length ?? 0} 个文件${sc?.skipped?.length ? `，跳过 ${sc.skipped.length} 个已存在` : ""}` };
        done = true;
      } catch (err) {
        state.notice = { kind: "err", text: `写入骨架失败：${String(err.message ?? err).slice(0, 300)}` };
      }
      state.archBusy = false;
      if (done) { state.archPlan = null; state.archWizard = false; await loadArch(); }
      render();
    });
    document.getElementById("btn-arch-agent")?.addEventListener("click", async () => {
      const p = state.archPlan;
      if (!p) return;
      const prompt = `请按已确认的架构方案搭建「${p.name}」项目框架：\n- 方案文件：${p.savedPath ?? ".wudi/<项目名>/architecture.json"}\n- 类型：${p.kindLabel ?? p.kind} · ${p.frameworkLabel ?? p.framework}\n- 说明：${p.summary ?? ""}\n请先读取该方案（或调用 wudi_arch_plan 复核），然后调用 wudi_arch_scaffold {confirm:true} 写入骨架，并按方案实现各模块的初始页面/接口，最后用 wudi_architecture 复查结构。`;
      try {
        /* ui/message 的 content 必须是 content block 数组（对齐 openPencil sendFollowUpMessage）；
           structuredContent 附轻量方案摘要，宿主支持时模型可直接拿到路径与文件清单。 */
        await app.sendMessage({
          role: "user",
          content: [{ type: "text", text: prompt }],
          structuredContent: {
            architecture: {
              kind: p.kind,
              framework: p.framework,
              name: p.name,
              savedPath: p.savedPath ?? ".wudi/<项目名>/architecture.json",
              dirs: p.dirs ?? [],
              files: (p.files ?? []).map((f) => f.path),
            },
          },
        });
        state.notice = { kind: "ok", text: "已把搭建任务发给 Agent" };
      } catch (err) {
        try { app.sendLog?.({ level: "warning", data: `[wudi] ui/message 失败：${String(err?.message ?? err)}` }); } catch {}
        const copied = await copyText(prompt);
        state.notice = copied
          ? { kind: "ok", text: "宿主未接受面板消息（ui/message）：任务已复制到剪贴板，粘贴到对话即可" }
          : { kind: "err", text: "无法发送给 Agent：请在对话里说明「按 .wudi/<项目名>/architecture.json 的架构方案搭建项目框架」" };
      }
      render();
    });
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
        const okRemove = await confirmDialog(`从工作台移除项目「${(state.projects?.projects ?? []).find((x) => x.id === b.dataset.remove)?.name ?? b.dataset.remove}」？（不影响项目文件）`);
        if (!okRemove) return;
        setBusy(true);
        try { await callTool("wudi_projects_remove", { id: b.dataset.remove }); await loadAll(); } catch (err) {
          state.notice = { kind: "err", text: String(err.message ?? err).slice(0, 400) };
          setBusy(false);
        }
      })
    );
    document.getElementById("btn-pbrowse")?.addEventListener("click", async () => {
      const picked = await pickFolderDialog(String(document.getElementById("p-path")?.value ?? "").trim());
      if (picked) {
        const input = document.getElementById("p-path");
        if (input) input.value = picked;
      }
    });
    $root().querySelectorAll("[data-prj-rename]").forEach((b) =>
      b.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const p = (state.projects?.projects ?? []).find((x) => x.id === b.dataset.prjRename);
        const name = await inputDialog(`重命名项目（当前：${p?.name ?? b.dataset.prjRename}）：`, p?.name ?? "");
        if (!name || name === p?.name) return;
        setBusy(true);
        try {
          const res = await callTool("wudi_projects_rename", { id: b.dataset.prjRename, name });
          state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? "已重命名" };
          setBusy(false);
          await loadAll();
        } catch (err) {
          state.notice = { kind: "err", text: `重命名失败：${String(err.message ?? err).slice(0, 300)}` };
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
        state.drill = null;
        state.projectRoot = p.isCurrent ? "" : p.path;
        state.view = "detail";
        state.tab = "overview";
        if (!DEMO) { state.data = null; state.history = null; state.designs = null; state.arch = null; state.archPlan = null; state.archWizard = false; }
        render();
        saveWidgetState();
        loadAll();
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
    /* 画布重命名 / 删除（CRUD 的改与删） */
    $root().querySelectorAll("[data-cv-rename]").forEach((b) =>
      b.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const path = b.dataset.cvRename;
        const oldName = path.replace(/^designs\//, "").replace(/\.(fig|pen)$/i, "");
        const name = await inputDialog(`重命名画布（当前：${oldName}）：`, oldName);
        if (!name || name === oldName) return;
        setBusy(true);
        try {
          const res = await callTool("wudi_design_rename", { path, name: `${name}.fig`, ...rootArg() });
          state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? `已重命名为 ${name}` };
          setBusy(false);
          await loadDesign();
        } catch (err) {
          state.notice = { kind: "err", text: `重命名失败：${String(err.message ?? err).slice(0, 300)}` };
          setBusy(false);
        }
      })
    );
    $root().querySelectorAll("[data-cv-delete]").forEach((b) =>
      b.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const path = b.dataset.cvDelete;
        const okDel = await confirmDialog(`删除画布「${path}」？文件将被移除，不可恢复。`);
        if (!okDel) return;
        setBusy(true);
        try {
          const res = await callTool("wudi_design_delete", { path, ...rootArg() });
          state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? `已删除 ${path}` };
          if (state.opEmbed?.path === path) closeOpEmbed();
          setBusy(false);
          await loadDesign();
        } catch (err) {
          state.notice = { kind: "err", text: `删除失败：${String(err.message ?? err).slice(0, 300)}` };
          setBusy(false);
        }
      })
    );
    /* 创建项目画布：new_design 建稿（经 wudi 代理，按项目根路由）→ 自动进内嵌编辑器 */
    document.getElementById("btn-op-new")?.addEventListener("click", async () => {
      const name = String(document.getElementById("op-name")?.value ?? "").trim() || "ui";
      if (DEMO) { await openOpEmbed(`.wudi/designs/${name}.fig`); return; }
      setBusy(true);
      try {
        const res = await callTool("wudi_design_create", { name, ...(state.projectRoot ? { root: state.projectRoot } : {}) });
        const createdPath = res.structuredContent?.path ?? `.wudi/designs/${name}.fig`;
        state.notice = { kind: "ok", text: res.content?.map((c) => c.text).join("\n") ?? `已创建画布 ${createdPath}` };
        state.canvasCreateOpen = false;
        setBusy(false);
        await loadDesign();
        await openOpEmbed(createdPath);
        return;
      } catch (err) {
        state.notice = { kind: "err", text: `创建画布失败：${String(err.message ?? err).slice(0, 400)}` };
      }
      setBusy(false);
    });
    document.getElementById("btn-cv-create-toggle")?.addEventListener("click", () => {
      state.canvasCreateOpen = true;
      render();
      document.getElementById("op-name")?.focus();
    });
    $root().querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const act = b.dataset.act;
        if (act === "goto-deploys") { state.view = "detail"; state.tab = "deploys"; }
        else if (act === "goto-design") { state.view = "detail"; state.tab = "design"; loadDesign(); }
        else if (act === "goto-docs") { state.view = "detail"; state.tab = "docs"; }
        else return; // hint 类仅提示
        state.notice = null;
        render();
        saveWidgetState();
      })
    );
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
          await app.sendMessage({ role: "user", content: [{ type: "text", text: `请打开 ${path} 并给我一个三句话以内的简介。` }] });
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
      /* 注册表按工作区分域：残留的 projectRoot 若不在本工作区项目里，清掉，避免串读别的工作区 */
      if (state.projectRoot && !(state.projects?.projects ?? []).some((p) => p.path === state.projectRoot)) {
        state.projectRoot = "";
        saveWidgetState();
      }
    } catch { /* 保留旧数据 */ }
    if (state.view === "projects" && !state.drill) render();
  }

  async function loadDesign() {
    if (DEMO) return;
    try {
      const ds = await callTool("wudi_designs_list", rootArg());
      state.designs = struct(ds);
    } catch { state.designs = null; }
    if (state.tab === "design" && state.view === "detail") render();
  }

  async function loadArch() {
    if (DEMO) return;
    try {
      const res = await callTool("wudi_architecture", rootArg());
      state.arch = struct(res);
    } catch (err) {
      state.arch = { error: String(err.message ?? err).slice(0, 400) };
    }
    if (state.tab === "arch" && state.view === "detail") render();
  }

  async function loadAll() {
    if (DEMO) return;
    setBusy(true);
    try {
      const envArg = state.env ? { env: state.env } : {};
      const status = await callTool("wudi_status", { ...envArg, ...rootArg(), deployLimit: 5 });
      state.data = struct(status);
      state.notice = null;
      try {
        const history = await callTool("wudi_deploy_history", { limit: 10, ...rootArg() });
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
        { name: "ui.fig", path: ".wudi/designs/ui.fig", format: "fig（可编辑）", sizeKB: 128.4, updatedAt: iso(30) },
        { name: "landing.fig", path: ".wudi/designs/landing.fig", format: "fig（可编辑）", sizeKB: 42.1, updatedAt: iso(1800) },
      ],
    };
    state.arch = {
      name: "zongheng-app",
      root: "/Users/me/code/zongheng-app",
      scanned: { files: 386, truncated: false },
      frameworks: ["SwiftUI", "Vue", "Vite", "Pinia"],
      packageManagers: ["pnpm"],
      languages: [
        { name: "TypeScript", files: 162, pct: 42 },
        { name: "Swift", files: 96, pct: 25 },
        { name: "Vue", files: 48, pct: 12 },
        { name: "CSS", files: 40, pct: 10 },
        { name: "JSON", files: 24, pct: 6 },
        { name: "Markdown", files: 16, pct: 5 },
      ],
      modules: [
        { name: "src", path: "/Users/me/code/zongheng-app/src", files: 184, languages: ["TypeScript", "Vue", "CSS"] },
        { name: "ios", path: "/Users/me/code/zongheng-app/ios", files: 112, languages: ["Swift", "Objective-C"] },
        { name: "packages", path: "/Users/me/code/zongheng-app/packages", files: 54, languages: ["TypeScript"] },
        { name: "docs", path: "/Users/me/code/zongheng-app/docs", files: 18, languages: ["Markdown"] },
        { name: "scripts", path: "/Users/me/code/zongheng-app/scripts", files: 9, languages: ["Shell", "TypeScript"] },
      ],
      entries: [
        { name: "package.json" }, { name: "vite.config.ts" }, { name: "tsconfig.json" },
        { name: "Podfile" }, { name: "docker-compose.yml" }, { name: "README.md" },
      ],
      scripts: [
        { name: "dev", command: "vite" }, { name: "build", command: "vite build" }, { name: "test", command: "vitest run" },
      ],
      workspaces: ["packages/*"],
      compose: { file: "docker-compose.yml", services: [{ name: "web", image: "nginx:alpine", ports: "8080:80" }, { name: "api", image: "zongheng/api:latest", ports: "3000:3000" }] },
      related: { docs: 6, designs: 9, envs: ["staging", "prod"], deployRoot: "/srv/zongheng", healthCheck: "http://127.0.0.1:8080/healthz" },
      generatedAt: iso(2),
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
    /* 恢复上次查看的项目根（面板重挂载后不串到当前工作区，避免画布存错位置） */
    try {
      const wsRoot = app.getHostContext()?.widgetState?.projectRoot;
      if (typeof wsRoot === "string" && wsRoot) state.projectRoot = wsRoot;
    } catch { /* ignore */ }
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
