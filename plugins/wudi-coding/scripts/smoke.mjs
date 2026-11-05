#!/usr/bin/env node
/**
 * wudi-coding 一键自测（无外部依赖、不连真实服务器）：
 * 以 JSON-RPC over stdio 起真实 MCP server，对协议层与全部工具面做回归断言；
 * 另对 notify 载荷、Figma 引用解析等纯函数直接单测。
 * 用法：node scripts/smoke.mjs   —— 全绿退出码 0，任何失败退出码 1。
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = join(root, "mcp-server", "server.mjs");

let passed = 0;
let failed = 0;
const fails = [];
function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    fails.push(name);
    console.log(`  ✗ ${name}${detail ? ` —— ${String(detail).slice(0, 300)}` : ""}`);
  }
}

/* ---------- 纯函数单测（不走 server） ---------- */

async function unitTests() {
  console.log("◆ 纯函数单测");
  const notify = await import(join(root, "lib", "notify.mjs").replace("file://", ""));
  const info = { project: "p", env: "prod", type: "deploy", status: "ok", release: "r1", durationMs: 100, detail: "" };
  const feishu = notify.buildPayload("feishu", info);
  check("notify: 飞书包格式", feishu.msg_type === "text" && typeof feishu.content?.text === "string");
  const wecom = notify.buildPayload("wecom", info);
  check("notify: 企微包格式", wecom.msgtype === "text" && typeof wecom.text?.content === "string");
  const generic = notify.buildPayload("generic", info);
  check("notify: 通用包字段", generic.source === "wudi-coding" && generic.release === "r1");
  check("notify: 失败态文案含卡点", notify.buildPayload("generic", { ...info, status: "failed", failedStage: "verify" }).text.includes("verify"));
  check("notify: 未配置返回 null", notify.resolveNotify({ notifyWebhook: "" }, { raw: null }) === null);
  check("notify: 环境覆盖顶层", notify.resolveNotify({ notifyWebhook: "http://top" }, { raw: { notifyWebhook: "http://env", notifyFormat: "feishu" } }).webhook === "http://env");

  const figma = await import(join(root, "lib", "figma.mjs").replace("file://", ""));
  /* 设计模板库完整性 */
  for (const t of ["dashboard.html", "landing.html", "mobile.html"]) {
    const tpl = await readFile(join(root, "skills", "wudi-ui", "templates", t), "utf-8").catch(() => "");
    check(`template: ${t} 存在且含 tokens 变量与可改区`, tpl.includes("--color-primary") && tpl.includes("【可改区"));
  }  const styles = figma.extractStyles({
    type: "FRAME",
    children: [
      { type: "RECTANGLE", fills: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 1, a: 1 } }] },
      { type: "TEXT", characters: "Hi", style: { fontSizePx: 14 } },
      { type: "TEXT", characters: "Yo", style: { fontSizePx: 14 } },
      { type: "FRAME", fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 0.5 }, visible: false }], children: [] },
    ],
  });
  check("figma: extractStyles 颜色收集", styles.colors.some((c) => c.hex === "#3366ff") && styles.colors.length === 1, JSON.stringify(styles.colors));
  check("figma: extractStyles 字号去重计数", styles.fontSizes.length === 1 && styles.fontSizes[0].size === 14 && styles.fontSizes[0].count === 2);
  const ref = figma.parseFigmaRef("https://www.figma.com/design/KEY123/File?node-id=12-34&t=xyz");
  check("figma: URL 解析（fileKey+nodeId）", ref.fileKey === "KEY123" && ref.nodeId === "12:34", JSON.stringify(ref));
  const ref2 = figma.parseFigmaRef("https://www.figma.com/file/KEY456/File");
  check("figma: URL 无 node-id", ref2.fileKey === "KEY456" && ref2.nodeId === "");
  check("figma: 裸 key 解析", figma.parseFigmaRef("KEY123").fileKey === "KEY123");
  let threw = false;
  try { figma.parseFigmaRef("!!!"); } catch { threw = true; }
  check("figma: 坏引用报错", threw);

  const store = await import(join(root, "lib", "store.mjs").replace("file://", ""));
  const proj = { name: "t", build: "x", package: { type: "dir", path: "dist" }, deployRoot: "/top", healthCheck: { url: "http://top", expect: 200, checkFrom: "remote" }, envs: [{ name: "staging", deployRoot: "/staging", healthCheck: { url: "http://staging" } }] };
  const dflt = store.resolveEnv(proj);
  check("store: 默认环境回落顶层", dflt.name === "staging" && dflt.deployRoot === "/staging" && dflt.healthCheck.url === "http://staging");
  check("store: 未知环境报错", (() => { try { store.resolveEnv(proj, "nonexistent"); return false; } catch (e) { return e.code === "ENV_NOT_FOUND"; } })());
  check("store: 指定环境生效", store.resolveEnv(proj, "staging").deployRoot === "/staging");
}

/* ---------- 版本一致性守卫 ---------- */
  console.log("◆ 版本一致性");
  try {
    const pluginJson = JSON.parse(await readFile(join(root, ".aopc-plugin", "plugin.json"), "utf8"));
    const zcodeJson = JSON.parse(await readFile(join(root, ".zcode-plugin", "plugin.json"), "utf8"));
    const pkgJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const panelSrc = await readFile(join(root, "panel", "panel.js"), "utf8");
    const serverSrc = await readFile(join(root, "mcp-server", "server.mjs"), "utf8");
    const v = pluginJson.version;
    check(`版本五处一致（${v}）`,
      zcodeJson.version === v && pkgJson.version === v &&
      panelSrc.includes(`version: "${v}" }`) && serverSrc.includes(`version: "${v}" }`),
      `aopc=${v} zcode=${zcodeJson.version} package=${pkgJson.version} panel=${panelSrc.match(/version: "([0-9.]+)" \}/)?.[1]} server=${serverSrc.match(/version: "([0-9.]+)" \}/)?.[1]}`);
  } catch (err) {
    check("版本一致性文件可读", false, String(err));
  }

/* ---------- MCP 协议回归（起真实 server） ---------- */

function rpcSession(env, serverFile = serverPath) {
  const child = spawn(process.execPath, [serverFile], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let buffer = "";
  let fatalError = null;
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
        if (msg.id && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch { /* 忽略非 JSON 行 */ }
    }
  });
  child.stderr.on("data", (d) => { fatalError = String(d); });
  const call = (method, params) =>
    new Promise((res) => {
      const id = Math.floor(Math.random() * 1e9);
      pending.set(id, res);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          res({ timeout: true });
        }
      }, 15_000);
    });
  return { call, kill: () => child.kill() };
}

const textOf = (r) => r?.result?.content?.map((c) => c.text).join("\n") ?? "";
const errOf = (r) => r?.result?.isError === true;

async function protocolTests() {
  console.log("◆ MCP 协议与工具面（真实 stdio server）");
  const workdir = await mkdtemp(join(tmpdir(), "wudi-smoke-"));
  const s = rpcSession({
    AOPC_WORKSPACE_ROOT: workdir,
    WUDI_SSH_HOST: "203.0.113.10",
    WUDI_SSH_TIMEOUT_SEC: "2",
  });
  try {
    const init = await s.call("initialize", { protocolVersion: "2024-11-05" });
    check("initialize: serverInfo", init?.result?.serverInfo?.name === "wudi-coding");
    check("initialize: capabilities 含 tools+resources", !!init?.result?.capabilities?.tools && !!init?.result?.capabilities?.resources);

    const tools = await s.call("tools/list", {});
    const list = tools?.result?.tools ?? [];
    check(`tools/list: 工具数 ≥ 17（实际 ${list.length}）`, list.length >= 17);
    check("tools/list: 全部有 inputSchema", list.every((t) => t.inputSchema?.type === "object"));
    const uiBound = list.filter((t) => t?._meta?.ui?.surface === "wudi");
    check("tools/list: Gen UI 绑定 7 个（+ wudi_tokens_compare）", uiBound.length === 7);
    check("tools/list: 关键工具在列", ["wudi_deploy", "wudi_rollback", "wudi_doctor", "wudi_deploy_logs", "wudi_env_set", "wudi_design_tokens_set", "wudi_figma_fetch"].every((n) => list.some((t) => t.name === n)));

    const resList = await s.call("resources/list", {});
    check("resources/list: 面板资源", resList?.result?.resources?.[0]?.uri === "ui://wudi-coding/panel.html" && String(resList.result.resources[0].mimeType).includes("profile=mcp-app"));
    const resRead = await s.call("resources/read", { uri: "ui://wudi-coding/panel.html" });
    const panelHtml = resRead?.result?.contents?.[0]?.text ?? "";
    check("resources/read: 自包含面板", panelHtml.includes("无敌编程工作台") && panelHtml.includes("WUDI_SDK"));

    let r = await s.call("tools/call", { name: "wudi_project_init", arguments: { name: "smoke", techStack: "static", build: "echo built", packageType: "dir", packagePath: "dist", deployRoot: "/srv/smoke", healthCheckUrl: "http://127.0.0.1:9/health", notifyWebhook: "http://127.0.0.1:9/hook", notifyFormat: "feishu" } });
    check("project_init: 建档成功", !errOf(r) && textOf(r).includes("smoke"));
    r = await s.call("tools/call", { name: "wudi_project_get", arguments: {} });
    check("project_get: 读回档案", !errOf(r) && textOf(r).includes('"name": "smoke"'));
    const sc = r?.result?.structuredContent;
    check("project_get: structuredContent", sc?.project?.name === "smoke");
    check("project_init: notify 字段落档", sc?.project?.notifyFormat === "feishu");

    r = await s.call("tools/call", { name: "wudi_env_set", arguments: { name: "staging", deployRoot: "/srv/smoke-staging", setDefault: true } });
    check("env_set: 新增+设默认", !errOf(r) && textOf(r).includes("staging"));
    r = await s.call("tools/call", { name: "wudi_status", arguments: {} });
    check("status: 环境列表与解析", !errOf(r) && textOf(r).includes("staging") && r?.result?.structuredContent?.currentEnv === "staging");
    r = await s.call("tools/call", { name: "wudi_status", arguments: { env: "nope" } });
    // 设计行为：status 是数据源，未知环境不致命 —— 优雅降级并在文本中标明解析失败
    check("status: 未知环境优雅降级", !errOf(r) && textOf(r).includes("环境解析失败") && textOf(r).includes("找不到环境"));

    r = await s.call("tools/call", { name: "wudi_deploy", arguments: { confirm: false } });
    check("deploy: 预检计划含环境与目标", !errOf(r) && textOf(r).includes("预检计划") && textOf(r).includes("staging"));
    r = await s.call("tools/call", { name: "wudi_deploy", arguments: { env: "ghost" } });
    check("deploy: 未知环境拒绝", errOf(r) && textOf(r).includes("找不到环境"));

    r = await s.call("tools/call", { name: "wudi_remote_exec", arguments: { command: "df -h" } });
    check("remote_exec: 无 confirm 拒绝", errOf(r) && textOf(r).includes("confirm"));
    r = await s.call("tools/call", { name: "wudi_remote_exec", arguments: { command: "df -h", confirm: true } });
    check("remote_exec: 白名单为空拒绝", errOf(r) && textOf(r).includes("白名单"));

    r = await s.call("tools/call", { name: "wudi_deploy_logs", arguments: {} });
    check("deploy_logs: 未配置 logCommand 给指引", errOf(r) && textOf(r).includes("logCommand"));

    r = await s.call("tools/call", { name: "wudi_figma_fetch", arguments: { ref: "KEY123" } });
    check("figma: 未配 token 返回指引（不报错）", !errOf(r) && textOf(r).includes("figmaToken"));

    r = await s.call("tools/call", { name: "wudi_design_tokens_set", arguments: { tokens: { color: { primary: "#3366ff" }, spacing: { sm: "8px" } } } });
    check("design_tokens_set: 写入+css", !errOf(r) && textOf(r).includes("tokens.css"));
    r = await s.call("tools/call", { name: "wudi_design_tokens_get", arguments: {} });
    check("design_tokens_get: 读回", !errOf(r) && textOf(r).includes("#3366ff"));
    /* tokens 导出三格式 */
    for (const [fmt, expect] of [["css", "--color-primary: #3366ff"], ["tailwind", "colors: {"], ["json", '"color"']]) {
      r = await s.call("tools/call", { name: "wudi_design_tokens_export", arguments: { format: fmt } });
      check(`tokens_export: ${fmt} 格式`, !errOf(r) && textOf(r).includes(expect) && textOf(r).includes(".wudi/design/exports/"), textOf(r).slice(0, 120));
    }
    r = await s.call("tools/call", { name: "wudi_design_list", arguments: {} });
    check("design_list: 产物清单", !errOf(r) && textOf(r).includes("tokens.json"));
    const css = await readFile(join(workdir, ".wudi", "design", "tokens.css"), "utf-8").catch(() => "");
    check("design tokens.css 内容正确", css.includes("--color-primary: #3366ff;") && css.includes("--spacing-sm: 8px;"));

    r = await s.call("tools/call", { name: "wudi_docs_register", arguments: { path: "docs/api.md", type: "api" } });
    check("docs_register: 登记", !errOf(r) && textOf(r).includes("docs/api.md"));
    r = await s.call("tools/call", { name: "wudi_status", arguments: {} });
    check("status: 文档清单可见", textOf(r).includes("docs/api.md"));

    /* ---- 周报（临时 git 仓真实提交）---- */
    const { execSync } = await import("node:child_process");
    try {
      execSync("git init -q && git config user.email t@t && git config user.name Tester && echo a > a.txt && git add . && git commit -qm 'feat: 首个功能'", { cwd: workdir, stdio: "pipe" });
      execSync("echo b >> a.txt && git add . && git commit -qm 'fix: 修一个 bug'", { cwd: workdir, stdio: "pipe" });
    } catch { /* git 不可用时跳过该组断言 */ }
    r = await s.call("tools/call", { name: "wudi_docs_weekly", arguments: {} });
    if (textOf(r).includes("git log 失败")) {
      console.log("  ⊘ 周报：环境无 git，跳过");
    } else {
      check("docs_weekly: 草稿生成并登记", !errOf(r) && textOf(r).includes("docs/weekly/") && textOf(r).includes("提交 2 条"));
      const weeklyMd = await readFile(join(workdir, "docs", "weekly", textOf(r).match(/docs\/weekly\/[\w-]+\.md/)?.[0]?.split("/").pop() ?? "x.md"), "utf-8").catch(() => "");
      check("docs_weekly: 内容含逐日与骨架", weeklyMd.includes("fix: 修一个 bug") && weeklyMd.includes("## 本周完成"));
    }

    /* ---- 部署确认词 ---- */
    r = await s.call("tools/call", { name: "wudi_project_init", arguments: { confirmWord: "go-prod" } });
    check("project_init: confirmWord 落档", !errOf(r) && r?.result?.structuredContent?.project?.confirmWord === "go-prod");
    r = await s.call("tools/call", { name: "wudi_deploy", arguments: { confirm: true } });
    check("deploy: 缺确认词被拦", errOf(r) && textOf(r).includes("确认词") && !textOf(r).includes("═══ 部署完成"));
    r = await s.call("tools/call", { name: "wudi_deploy", arguments: { confirm: true, confirmWord: "wrong" } });
    check("deploy: 错误确认词被拦", errOf(r) && textOf(r).includes("确认词"));
    r = await s.call("tools/call", { name: "wudi_deploy", arguments: { confirm: true, confirmWord: "go-prod" } });
    // 确认词通过后进入流水线（SSH 不可达 → 在 upload/verify 前后失败，但绝不是确认词拦截）
    check("deploy: 正确确认词进入流水线", errOf(r) && !textOf(r).includes("确认词"), textOf(r).slice(0, 200));

    /* ---- figma images 未配 token ---- */
    r = await s.call("tools/call", { name: "wudi_figma_images", arguments: { ref: "KEY123", nodeIds: "12:34" } });
    check("figma_images: 未配 token 返回指引（不报错）", !errOf(r) && textOf(r).includes("figmaToken"));

    /* ---- 通知测试工具 ---- */
    r = await s.call("tools/call", { name: "wudi_notify_test", arguments: {} });
    // smoke 档案配置了 webhook（127.0.0.1:9 不可达）→ 走发送失败路径；未配置则走指引路径。两者皆为正确行为。
    check("notify_test: 未配置给指引 / 已配置尝试发送并如实报败", errOf(r) && (textOf(r).includes("notifyWebhook") || textOf(r).includes("测试通知失败")));

    /* ---- 部署策略 ---- */
    r = await s.call("tools/call", { name: "wudi_env_set", arguments: { name: "staging", deployPolicy: "direct" } });
    check("env_set: deployPolicy 落档", !errOf(r) && r?.result?.structuredContent?.resolved?.deployPolicy === "direct");
    r = await s.call("tools/call", { name: "wudi_status", arguments: { env: "staging" } });
    check("status: resolved 含策略", r?.result?.structuredContent?.resolved?.deployPolicy === "direct");

    /* ---- figma tokens diff ---- */
    r = await s.call("tools/call", { name: "wudi_figma_tokens_diff", arguments: { ref: "https://www.figma.com/design/KEY123/File?node-id=1-2" } });
    check("figma_tokens_diff: 未配 token 指引（不报错）", !errOf(r) && textOf(r).includes("figmaToken"));

    /* ---- 项目注册表 ---- */
    r = await s.call("tools/call", { name: "wudi_projects_list", arguments: {} });
    const curEntry = (r?.result?.structuredContent?.projects ?? []).find((p) => p.isCurrent);
    check("projects_list: 当前工作区自动登记", !errOf(r) && !!curEntry && curEntry.name === "smoke");
    r = await s.call("tools/call", { name: "wudi_projects_add", arguments: { path: workdir, name: "smoke-alias" } });
    check("projects_add: 重复路径幂等（改名生效）", !errOf(r) && textOf(r).includes("已在注册表") && textOf(r).includes("smoke-alias"));
    r = await s.call("tools/call", { name: "wudi_projects_add", arguments: { path: "/nonexistent-xyz" } });
    check("projects_add: 不存在路径拒绝", errOf(r) && textOf(r).includes("不存在"));
    r = await s.call("tools/call", { name: "wudi_projects_remove", arguments: { id: curEntry.id } });
    check("projects_remove: 移除成功", !errOf(r) && textOf(r).includes("已从注册表移除"));
    r = await s.call("tools/call", { name: "wudi_projects_list", arguments: {} });
    check("projects_list: 移除后重新自动登记当前区", (r?.result?.structuredContent?.projects ?? []).some((p) => p.isCurrent));

    /* ---- 设计画布 v2（Figma 式多画板，Agent 操作面）---- */
    r = await s.call("tools/call", { name: "wudi_canvas_get", arguments: {} });
    check("canvas_get: 空画布（v2）", !errOf(r) && (r?.result?.structuredContent?.canvas?.frames?.length ?? -1) === 0);
    r = await s.call("tools/call", {
      name: "wudi_canvas_edit",
      arguments: { ops: [
        { op: "add_frame", frame: { name: "首页-1440", x: 0, y: 0, w: 1440, h: 900 } },
        { op: "add_frame", frame: { name: "详情-375", x: 1560, y: 0, w: 375, h: 812 } },
      ] },
    });
    const framesAfter = r?.result?.structuredContent?.canvas?.frames ?? [];
    check("canvas_edit: add_frame 两画板", !errOf(r) && framesAfter.length === 2);
    const fid = framesAfter[0]?.id;
    r = await s.call("tools/call", {
      name: "wudi_canvas_edit",
      arguments: { ops: [
        { op: "add", shape: { type: "rect", frameId: fid, x: 40, y: 40, w: 200, h: 120, fill: "#dbe4fd", text: "侧栏" } },
        { op: "add", shape: { type: "text", frameId: fid, x: 60, y: 200, text: "标题文字", fontSize: 18 } },
        { op: "add", shape: { type: "arrow", frameId: fid, x: 250, y: 100, x2: 400, y2: 100 } },
      ] },
    });
    const canvasAfter = r?.result?.structuredContent?.canvas;
    check("canvas_edit: 形状挂画板", !errOf(r) && canvasAfter?.shapes?.length === 3 && canvasAfter.shapes.every((sh) => sh.frameId === fid));
    const addedId = canvasAfter?.shapes?.[0]?.id;
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "update", id: addedId, patch: { w: 260, text: "侧栏导航" } }] } });
    check("canvas_edit: update 生效", !errOf(r) && r?.result?.structuredContent?.canvas?.shapes?.[0]?.w === 260);
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "add", shape: { type: "rect", frameId: "f-ghost", x: 1, y: 1 } }] } });
    check("canvas_edit: frameId 不存在拒绝", errOf(r) && textOf(r).includes("frameId 不存在"));
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "add", shape: { type: "pentagon", x: 1, y: 1 } }] } });
    check("canvas_edit: 非法类型拒绝", errOf(r) && textOf(r).includes("类型非法"));
    r = await s.call("tools/call", { name: "wudi_canvas_export", arguments: { name: "smoke-wire" } });
    check("canvas_export: 按画板出两份设计稿", !errOf(r) && (r?.result?.structuredContent?.mockups?.length ?? 0) === 2 && textOf(r).includes("首页-1440"));
    const exportHtml = await readFile(join(workdir, ".wudi", "design", "mockups", "smoke-wire-首页-1440.html"), "utf-8").catch(() => "");
    check("canvas_export: SVG 内联与箭头 marker", exportHtml.includes("<svg") && exportHtml.includes("arrowhead"));
    r = await s.call("tools/call", { name: "wudi_canvas_export", arguments: { name: "smoke-wire", format: "excalidraw" } });
    check("canvas_export: excalidraw 场景", !errOf(r) && textOf(r).includes(".excalidraw"));
    const exScene = JSON.parse(await readFile(join(workdir, ".wudi", "design", "canvas", "smoke-wire.excalidraw"), "utf-8").catch(() => "{}"));
    check("canvas_export: frame 与元素映射", exScene.type === "excalidraw" && exScene.elements.some((e) => e.type === "frame") && exScene.elements.some((e) => e.type === "rectangle" && e.frameId) && exScene.elements.some((e) => e.type === "text" && e.text === "标题文字"));
    /* ---- 层级调整 ---- */
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "add", shape: { type: "rect", frameId: "", x: 500, y: 40, w: 100, h: 60, text: "底层" } }, { op: "add", shape: { type: "rect", frameId: "", x: 520, y: 60, w: 100, h: 60, text: "顶层" } }] } });
    const twoIds = (r?.result?.structuredContent?.canvas?.shapes ?? []).filter((sh) => sh.text === "底层" || sh.text === "顶层").map((sh) => sh.id);
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "reorder", id: twoIds[0], to: "front" }] } });
    const lastShape = r?.result?.structuredContent?.canvas?.shapes?.at(-1);
    check("canvas_edit: reorder 置顶", !errOf(r) && lastShape?.text === "底层", `isError=${errOf(r)} last=${JSON.stringify(lastShape)} shapes=${JSON.stringify(r?.result?.structuredContent?.canvas?.shapes?.map((x) => x.text))}`);
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "reorder", id: twoIds[0], to: "back" }] } });
    check("canvas_edit: reorder 置底", !errOf(r) && r?.result?.structuredContent?.canvas?.shapes?.[0]?.text === "底层");

    /* ---- canvas.json 自动备份 ---- */
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "add", shape: { type: "rect", frameId: "", x: 700, y: 40, w: 80, h: 40, text: "备份前" } }] } });
    const backupOk = await readFile(join(workdir, ".wudi", "canvas.backup.json"), "utf8").then((t) => t.includes('"version": 2')).catch(() => false);
    check("canvas_backup: 写入前自动备份上一版", backupOk);

    /* ---- replace 全量替换（撤销/重做数据基础）---- */
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "replace", canvas: { frames: [{ name: "替换画板", x: 10, y: 10, w: 800, h: 600 }], shapes: [{ type: "rect", frameId: "", x: 50, y: 50, w: 100, h: 60, fill: "#e2f5ea", text: "替换后的形状" }] } }] } });
    check("canvas_edit: replace 全量替换", !errOf(r) && textOf(r).includes("全量替换（1 画板 / 1 形状）"));
    r = await s.call("tools/call", { name: "wudi_canvas_get", arguments: {} });
    check("canvas_get: replace 后状态", !errOf(r) && (r?.result?.structuredContent?.canvas?.frames?.[0]?.name === "替换画板") && (r?.result?.structuredContent?.canvas?.shapes?.[0]?.text === "替换后的形状"));
    r = await s.call("tools/call", { name: "wudi_canvas_edit", arguments: { ops: [{ op: "replace", canvas: { frames: [{ name: "坏画板", x: 0, y: 0, w: 100, h: 100 }], shapes: [{ type: "hexagon", x: 0, y: 0 }] } }] } });
    check("canvas_edit: replace 非法形状拒绝且不落盘", errOf(r) && textOf(r).includes("类型非法"));

    r = await s.call("tools/call", { name: "wudi_canvas_clear", arguments: {} });
    check("canvas_clear: 无 confirm 拒绝", errOf(r) && textOf(r).includes("confirm"));
    r = await s.call("tools/call", { name: "wudi_canvas_clear", arguments: { confirm: true } });
    check("canvas_clear: 确认后清空", !errOf(r) && (r?.result?.structuredContent?.canvas?.frames?.length ?? -1) === 0);

    /* ---- vendor OpenPencil server（独立 MCP server，Figma .fig 设计稿）---- */
    {
      const op = rpcSession({ ZCODE_WORKSPACE_ROOT: workdir }, join(root, "vendor", "openpencil", "dist", "server.mjs"));
      try {
        const init = await op.call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "1.0" } });
        check("openpencil: initialize", !!init?.result?.serverInfo);
        await op.call("notifications/initialized", {});
        const tl = await op.call("tools/list", {});
        const names = (tl?.result?.tools ?? []).map((t) => t.name);
        check(`openpencil: 工具数 ≥ 100（实际 ${names.length}）`, names.length >= 100);
        check("openpencil: 关键工具在列", ["new_design", "open_design", "create_shape", "render", "design_to_tokens", "export_image", "set_layout", "query_nodes"].every((n) => names.includes(n)));
        const nd = await op.call("tools/call", { name: "new_design", arguments: { path: "designs/smoke.fig" } });
        const ndText = nd?.result?.content?.map((c) => c.text).join("\n") ?? "";
        check("openpencil: new_design 建稿", (nd?.result?.isError ?? true) === false || ndText.includes("已存在") || ndText.includes("smoke.fig"));
        const rs = await op.call("resources/list", {});
        check("openpencil: 面板资源", JSON.stringify(rs?.result ?? {}).includes("openpencil"));
      } finally {
        op.kill();
      }
    }

    /* ---- tokens 比对 ---- */
    r = await s.call("tools/call", { name: "wudi_tokens_compare", arguments: { tokens: { color: { primary: "#ffffff", accent: "#7c5cf0" }, spacing: { sm: "8px" } } } });
    const cmpSc = r?.result?.structuredContent ?? {};
    check("tokens_compare: 变更与新增识别（本地 2 键无移除）", !errOf(r) && cmpSc.changed?.some((c) => c.key === "color.primary" && c.local === "#3366ff") && cmpSc.added?.some((a) => a.key === "color.accent") && (cmpSc.removed?.length ?? 0) === 0, JSON.stringify(cmpSc).slice(0, 220));
    r = await s.call("tools/call", { name: "wudi_tokens_compare", arguments: { tokens: { color: { primary: "#3366ff" }, spacing: { sm: "8px" } } } });
    check("tokens_compare: 一致时三清单全空", !errOf(r) && (r?.result?.structuredContent?.added ?? [1]).length === 0 && (r?.result?.structuredContent?.changed ?? [1]).length === 0 && (r?.result?.structuredContent?.removed ?? [1]).length === 0);

    /* ---- 设计稿清单（OpenPencil 建稿后文件级联动）---- */
    r = await s.call("tools/call", { name: "wudi_designs_list", arguments: {} });
    const designsSc = r?.result?.structuredContent?.designs ?? [];
    check("designs_list: 发现 openpencil 建的 .fig", !errOf(r) && designsSc.some((d) => d.name === "smoke.fig"), JSON.stringify(designsSc).slice(0, 150));

    /* ---- 内嵌 OpenPencil 编辑器（协同桥 frame 端点 + 面板 CSP frameDomains）---- */
    r = await s.call("tools/call", { name: "new_design", arguments: { path: "designs/proxy-smoke.fig" } });
    check("op_proxy: new_design 经 wudi 代理建稿", !errOf(r) && textOf(r).includes("proxy-smoke.fig"), textOf(r).slice(0, 160));
    r = await s.call("tools/call", { name: "wudi_designs_list", arguments: {} });
    check("op_proxy: designs_list 发现代理建的稿", (r?.result?.structuredContent?.designs ?? []).some((d) => d.name === "proxy-smoke.fig"));
    r = await s.call("tools/call", { name: "wudi_canvas_bridge", arguments: {} });
    const bridgeUrlSc = r?.result?.structuredContent?.url ?? "";
    check("op_embed: 协同桥端点可用", bridgeUrlSc.startsWith("http://127.0.0.1:"));
    if (bridgeUrlSc) {
      const frameRes = await fetch(`${new URL(bridgeUrlSc).origin}/openpencil/frame`).catch(() => null);
      const frameHtml = await frameRes?.text().catch(() => "") ?? "";
      check("op_embed: /openpencil/frame 返回编辑器 loader",
        frameRes?.status === 200 && frameHtml.length > 500 && frameHtml.includes("正在加载设计稿编辑器"),
        `HTTP ${frameRes?.status ?? "?"} · ${frameHtml.length}B`);
    }
    r = await s.call("resources/read", { uri: "ui://wudi-coding/panel.html" });
    // 宿主读内容项级 _meta（规范）；结果级仅兼容兜底
    const cspMeta = r?.result?.contents?.[0]?._meta?.ui?.csp ?? r?.result?._meta?.ui?.csp ?? {};
    check("op_embed: 面板资源项 _meta 声明 frameDomains",
      Array.isArray(cspMeta.frameDomains) && cspMeta.frameDomains.some((d) => /^http:\/\/127\.0\.0\.1:\d+$/.test(d)),
      JSON.stringify(cspMeta).slice(0, 180));
    check("op_embed: 面板资源项 _meta 声明 connectDomains",
      Array.isArray(cspMeta.connectDomains) && cspMeta.connectDomains.length > 0);
    const relaxMeta = r?.result?.contents?.[0]?._meta?.["aopc/csp"] ?? {};
    check("op_embed: 资源项声明 wasm/eval 放宽（CanvasKit/kiwi）",
      relaxMeta.wasmUnsafeEval === true && relaxMeta.unsafeEval === true, JSON.stringify(relaxMeta));
    r = await s.call("resources/list", {});
    const listMeta = (r?.result?.resources ?? []).find((x) => x.uri === "ui://wudi-coding/panel.html")?._meta?.ui?.csp ?? {};
    check("op_embed: resources/list 兜底声明 frameDomains",
      Array.isArray(listMeta.frameDomains) && listMeta.frameDomains.length > 0);

    r = await s.call("tools/call", { name: "wudi_doctor", arguments: { env: "staging" } });
    // 无真实 SSH（TEST-NET 地址 2s 超时）：SSH/远端/健康检查应失败或跳过，但档案项应 PASS
    check("doctor: 档案项 PASS", textOf(r).includes("[PASS] 档案关键字段"));
    check("doctor: 输出结论", textOf(r).includes("结论："));
    check("doctor: 检查项 ≥ 6", (r?.result?.structuredContent?.checks ?? []).length >= 6 || textOf(r).split("[PASS]").length + textOf(r).split("[WARN]").length + textOf(r).split("[FAIL]").length >= 6);

    r = await s.call("tools/call", { name: "wudi_rollback", arguments: { confirm: false } });
    // 无真实 SSH（TEST-NET 2s 超时）→ 应给出人话报错；docker-image 档案则给重部署指引
    check("rollback: 失败路径人话报错", errOf(r) === true && (textOf(r).includes("无法读取服务器版本列表") || textOf(r).includes("没有可回滚") || textOf(r).includes("docker-image")));
  } finally {
    s.kill();
    await rm(workdir, { recursive: true, force: true });
  }
}

/* ---------- 入口 ---------- */

console.log("═══ wudi-coding 自测 ═══\n");
await unitTests();
console.log("");
await protocolTests();
console.log(`\n═══ 结果：${passed} 通过，${failed} 失败 ═══`);
if (failed) {
  console.log("失败项：\n- " + fails.join("\n- "));
  process.exit(1);
}
process.exit(0);
