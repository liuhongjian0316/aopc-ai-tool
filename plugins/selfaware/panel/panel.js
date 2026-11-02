/* 观己 · 自我仪表盘面板逻辑(vanilla JS,与 vendor SDK 拼进同一 module,经 build-panel.mjs 组装)。
 * 通信走官方 @modelcontextprotocol/ext-apps SDK(App/callServerTool/getHostContext),
 * 遵循 wudi/obsidian 踩坑结论:connect() 成功前不发任何通知;主题跟随 hostContext;工具用 structuredContent。
 * 本文件不得使用 import/export(SDK 解构来自 GUANJI_SDK,构建时转换)。 */
const { App } = GUANJI_SDK;

(() => {
  const app = new App(
    { name: "selfaware", version: "1.2.0" },
    { availableDisplayModes: ["inline", "fullscreen"] }
  );

  const state = {
    data: null,      // self_state structuredContent
    usage: null,     // self_usage structuredContent
    history: null,   // self_history structuredContent
    errors: null,    // self_errors structuredContent
    journal: null,   // self_journal query structuredContent
    busy: false,
    connected: false,
    err: null,
  };

  /* ---------- 小工具 ---------- */
  const $root = () => document.getElementById("root");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtK = (n) => Math.round((n || 0) / 100) / 10 + "k";
  const fmtT = (t) => {
    if (!t) return "";
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  async function callTool(name, args) {
    const res = await app.callServerTool({ name, arguments: args ?? {} });
    if (res?.isError) throw new Error(res.content?.map((c) => c.text).join("\n") || `${name} 执行失败`);
    return res;
  }
  const sc = (res) => res?.structuredContent ?? null;

  function reportSize() {
    if (!state.connected) return;
    try { app.sendSizeChanged?.({ height: document.body.scrollHeight }); } catch { /* 宿主不支持时忽略 */ }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = app.getHostContext()?.theme ?? "light";
  }
  app.onhostcontextchanged = () => { applyTheme(); render(); };

  /* Gen UI:主 agent 在会话里调观己工具时,结构化数据实时合并进面板 */
  app.ontoolresult = (result) => {
    const s = result?.structuredContent;
    if (!s || typeof s !== "object") return;
    if (s.session !== undefined) state.data = s;
    if (s.mission !== undefined) state.data = { ...(state.data ?? {}), mission: s.mission };
    if (s.budget !== undefined && s.rolloutOffset !== undefined) state.usage = s;
    if (Array.isArray(s.sessions) && s.totals) state.history = s;
    if (Array.isArray(s.groups)) state.errors = s;
    if (Array.isArray(s.entries)) state.journal = s;
    render();
  };

  /* ---------- 数据拉取 ---------- */
  async function loadAll() {
    if (state.busy) return;
    state.busy = true;
    state.err = null;
    render();
    const jobs = [
      callTool("self_state").then((r) => { state.data = sc(r); }),
      callTool("self_usage").then((r) => { state.usage = sc(r); }),
      callTool("self_history", { limit: 10 }).then((r) => { state.history = sc(r); }),
      callTool("self_errors", { limit: 10 }).then((r) => { state.errors = sc(r); }),
      callTool("self_journal", { action: "query", limit: 10 }).then((r) => { state.journal = sc(r); }),
    ];
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) state.err = failed.map((f) => String(f.reason?.message ?? f.reason)).join("; ");
    state.busy = false;
    render();
    reportSize();
  }

  /* ---------- 渲染 ---------- */
  function budgetBar(b) {
    if (!b) return `<div class="empty">预算未知(尚无 rollout 数据)</div>`;
    const pct = Math.min(100, b.percent || 0);
    const cls = pct >= 85 ? "critical" : pct >= 60 ? "mid" : "";
    const srcTag = b.src === "provider" ? `<span class="tag ok">provider 实测</span>` : `<span class="tag warn">字节估算</span>`;
    return `
      <div class="big"><span class="num">${b.percent}%</span><span class="sub">${fmtK(b.used)} / ${fmtK(b.window)} tokens · 近几轮 +${b.burn}/轮</span></div>
      <div class="bar"><div class="fill ${cls}" style="width:${pct}%"></div></div>
      <div>${srcTag}<span class="tag dim">confidence=${esc(b.confidence)}</span></div>`;
  }

  /* ---------- 图表(零依赖手写 SVG;颜色走 CSS 变量跟随主题) ---------- */
  const CHART_W = 560;

  function svgBars(daily, h = 110) {
    if (!daily?.length) return `<div class="empty">暂无按天数据</div>`;
    const w = CHART_W;
    const max = Math.max(1, ...daily.map((d) => d.calls + d.errors));
    const bw = w / daily.length;
    let shapes = "";
    daily.forEach((d, i) => {
      const hc = (d.calls / max) * (h - 20);
      const he = (d.errors / max) * (h - 20);
      const x = i * bw + 2;
      if (d.calls) shapes += `<rect x="${x}" y="${(h - 16 - hc).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(hc, 1.5).toFixed(1)}" fill="var(--accent)" rx="1.5"><title>${d.date} 调用 ${d.calls}</title></rect>`;
      if (d.errors) shapes += `<rect x="${x}" y="${(h - 16 - hc - he).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${Math.max(he, 1.5).toFixed(1)}" fill="var(--err)" rx="1.5"><title>${d.date} 失败 ${d.errors}</title></rect>`;
    });
    let labels = "";
    daily.forEach((d, i) => {
      if (i % 3 === 0 || i === daily.length - 1) labels += `<text x="${(i * bw + bw / 2).toFixed(1)}" y="${h - 4}" font-size="8.5" fill="var(--text-dim)" text-anchor="middle">${esc(d.date.slice(5))}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">${shapes}${labels}</svg>`;
  }

  function svgLine(points, { h = 64, max = 100, color = "var(--accent)", area = true } = {}) {
    const pts = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (pts.length < 2) return `<div class="empty">数据点不足</div>`;
    const w = CHART_W;
    const minX = pts[0].x;
    const maxX = pts[pts.length - 1].x;
    const X = (x) => (minX === maxX ? w / 2 : ((x - minX) / (maxX - minX)) * (w - 10) + 5);
    const Y = (y) => (h - 6) - (Math.min(max, Math.max(0, y)) / max) * (h - 14);
    const path = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
    const areaPath = area ? `<path d="${path} L${X(maxX).toFixed(1)},${h - 4} L${X(minX).toFixed(1)},${h - 4} Z" fill="${color}" opacity="0.12"/>` : "";
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">${areaPath}<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  }

  function render() {
    const root = $root();
    if (!state.connected) { root.innerHTML = `<div class="loading">正在连接观己…</div>`; return; }
    const d = state.data;
    const parts = [];
    parts.push(`
      <div class="header">
        <h1>观己 · 自我仪表盘</h1>
        <span class="updated">更新于 ${fmtT(Date.now())}</span>
        <span class="spacer"></span>
        <button class="btn" id="btn-refresh" ${state.busy ? "disabled" : ""}>${state.busy ? "刷新中…" : "刷新"}</button>
      </div>`);
    if (state.err) parts.push(`<div class="card"><span class="tag err">拉取失败</span> ${esc(state.err)}</div>`);

    /* 此刻 */
    if (d?.session) {
      const s = d.session;
      const calls = Object.entries(s.toolCalls || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const errs = Object.entries(s.errors || {});
      const streaks = Object.entries(s.streaks || {}).filter(([, v]) => v.count >= 2);
      parts.push(`
        <div class="card">
          <h2>此刻 · ${esc(s.sid || "")}</h2>
          ${budgetBar(s.budget)}
          <div class="kv" style="margin-top:8px">
            <span class="k">对话轮次</span><span>${s.turns ?? 0} 轮 / ${s.segments ?? 0} 工作段</span>
            <span class="k">工具调用</span><span>${calls.length ? calls.map(([t, n]) => `${esc(t)}×${n}`).join(", ") : "尚无"}</span>
            <span class="k">本会话失败</span><span>${errs.length ? errs.map(([t, n]) => `<span class="tag err">${esc(t)}×${n}</span>`).join(" ") : '<span class="tag ok">无</span>'}</span>
            <span class="k">子代理派发</span><span>${s.dispatches ?? 0} 次(内部调用不经 hook)</span>
            ${streaks.length ? `<span class="k">连败告警</span><span>${streaks.map(([t, v]) => `<span class="tag warn">${esc(t)}×${v.count}</span>`).join(" ")}</span>` : ""}
            ${d.debt > 0 ? `<span class="k">跨会话复盘债</span><span><span class="tag err">${d.debt} 次未复盘</span></span>` : ""}
          </div>
        </div>`);
    } else {
      parts.push(`<div class="card"><div class="empty">尚无本会话数据(hook 尚未在本会话运行,或为新装)</div></div>`);
    }

    /* 使命(0.9.0:跨会话持久目标) */
    if (d?.mission) {
      const m = d.mission;
      parts.push(`
        <div class="card">
          <h2>使命 <span class="tail">· 跨会话的持久目标</span></h2>
          ${m.active
            ? `<div class="big" style="margin-bottom:4px"><span class="num" style="font-size:16px">「${esc(m.active.title)}」</span><span class="sub">第 ${m.active.day} 天</span><span class="tag ${m.active.autonomy === "full" ? "ok" : "dim"}">${m.active.autonomy === "full" ? "完全自主" : "受监督"}</span></div>
               ${m.active.goal ? `<div class="narr" style="margin-left:0">目标:${esc(m.active.goal)}</div>` : ""}`
            : `<div class="empty">无进行中的使命(self_mission 工具可立项)</div>`}
          ${(m.recentLog || []).length
            ? `<div style="margin-top:6px">${m.recentLog.map((e2) => `<div class="narr" style="margin-left:0"><span class="tag dim">${esc(e2.kind)}</span> ${fmtT(e2.t)} — ${esc(String(e2.text).slice(0, 70))}</div>`).join("")}</div>`
            : ""}
        </div>`);
    }

    /* 趋势图表(0.9.0) */
    const daily = state.history?.daily || [];
    const trail = d?.session?.trail || [];
    if (daily.length || trail.length >= 2) {
      const ratePoints = daily.map((dd) => ({ x: Date.parse(dd.date), y: dd.calls + dd.errors ? Math.round((dd.errors / (dd.calls + dd.errors)) * 100) : 0 }));
      parts.push(`
        <div class="card">
          <h2>趋势 <span class="tail">· 近 ${daily.length} 天(蓝=工具调用,红=失败)</span></h2>
          ${svgBars(daily)}
          <h2 style="margin-top:10px">失败率(%)</h2>
          ${svgLine(ratePoints, { color: "var(--err)" })}
          ${trail.length >= 2 ? `<h2 style="margin-top:10px">本会话上下文占用(%)</h2>${svgLine(trail.map((p) => ({ x: p.t, y: p.pct })), { h: 56 })}` : ""}
        </div>`);
    }

    /* 健康 */
    if (d) {
      parts.push(`
        <div class="card">
          <h2>自我档案与健康 <span class="tail">· 上次深度复盘:${d.lastDeepAt ? fmtT(d.lastDeepAt) : "无记录"}</span></h2>
          <div>${d.health ? `<span class="tag ${String(d.health).includes("缺") ? "warn" : "ok"}">档案</span> ${esc(d.health)}` : '<span class="empty">档案未创建</span>'}</div>
          ${Array.isArray(d.playbookRules) && d.playbookRules.length
            ? `<div class="rules" style="margin-top:6px">playbook 规则(注入会话的):<ul>${d.playbookRules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`
            : `<div class="empty" style="margin-top:4px">playbook 暂无规则——由 /reflect 从教训中落地</div>`}
        </div>`);
    }

    /* 慢性错误 */
    const e = state.errors;
    if (e) {
      const chronic = e.chronic || [];
      parts.push(`
        <div class="card">
          <h2>慢性错误 <span class="tail">· 同签名跨 ≥3 会话复发</span></h2>
          ${chronic.length
            ? chronic.map((g) => `<div class="jentry"><span class="tag err">${esc(g.tool)}</span> <span class="mono">[${esc(g.sig)}]</span> 跨 ${g.sessions} 个会话共 ${g.count} 次</div>`).join("")
            : `<div class="empty">无慢性错误——偶发失败已全部消化</div>`}
        </div>`);
    }

    /* 历史 */
    const h = state.history;
    if (h) {
      const tot = h.totals || { turns: 0, calls: 0, errors: 0 };
      const totAll = tot.calls + tot.errors;
      parts.push(`
        <div class="card">
          <h2>跨会话历史 <span class="tail">· 共 ${h.totalSessions} 个会话</span></h2>
          <div style="margin-bottom:6px"><span class="tag dim">累计 ${tot.turns} 轮</span><span class="tag dim">${tot.calls} 次工具</span><span class="tag ${tot.errors ? "warn" : "ok"}">${tot.errors} 败${totAll ? ` ${Math.round((tot.errors / totAll) * 100)}%` : ""}</span></div>
          ${(h.sessions || []).slice(0, 8).map((s) => `
            <div class="sess">
              <span class="sid">${s.sub ? "[子] " : ""}${esc(String(s.sid).slice(0, 22))}…</span>
              <span class="stat"> ${fmtT(s.lastAt)} · ${s.turns} 轮 · ${s.calls} 工具 · ${s.errors} 败</span>
              ${s.lastMsg ? `<div class="narr">“${esc(String(s.lastMsg).slice(0, 70))}”</div>` : ""}
            </div>`).join("")}
        </div>`);
    }

    /* 反思日志 */
    const j = state.journal;
    if (j) {
      const entries = j.entries || [];
      parts.push(`
        <div class="card">
          <h2>反思日志 <span class="tail">· 共 ${j.total ?? entries.length} 条</span></h2>
          ${entries.length
            ? entries.map((en) => `
              <div class="jentry">
                ${en.status === "proposed" && Date.now() - (en.t || 0) > 7 * 86400000 ? '<span class="tag warn">超 7 天</span>' : ""}
                <span class="meta">[${esc(en.id)}] ${new Date(en.t).toISOString().slice(0, 10)} ${esc(en.kind)}${en.status ? ` (${esc(en.status)})` : ""}</span>
                <div>「${esc(en.title)}」</div>
                ${en.lesson ? `<div class="narr">规则:${esc(en.lesson)}</div>` : ""}
              </div>`).join("")
            : `<div class="empty">日志为空——失败复盘与 /reflect 的产出都会记在这里</div>`}
        </div>`);
    }

    parts.push(`<div class="footer">数据目录:${esc(d?.paths?.data || "")} · 面板只读,自我修改一律走 /reflect 与权限审批</div>`);
    root.innerHTML = parts.join("");
    const btn = document.getElementById("btn-refresh");
    if (btn) btn.onclick = () => loadAll();
  }

  /* ---------- 启动 ---------- */
  async function main() {
    applyTheme();
    try {
      await app.connect();
      state.connected = true;
      await loadAll();
    } catch (err) {
      $root().innerHTML = `<div class="card"><span class="tag err">连接失败</span> ${esc(String(err?.message ?? err))}</div>`;
    }
    setInterval(() => { if (state.connected && !state.busy) loadAll(); }, 60000);
  }
  main();
})();
