// @ts-nocheck —— 由 JS 迁移（tools/store/ssh/figma/notify/openpencil 为动态工具实现，类型逐步收紧；入口 src/server.ts 全量检查）
/**
 * wudi-coding 项目状态存储：项目根 .wudi/ 目录下的 JSON 文件。
 * 与 douyin-pilot 的插件数据目录不同：无敌编程的档案/部署历史属于具体项目，
 * 随项目走（.wudi/ 可入 .gitignore），因此以 AOPC_WORKSPACE_ROOT 为根。
 * 原子写入（tmp + rename）。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function projectRoot() {
  /* 与 openpencil.defaultWorkspaceRoot() 保持同一解析顺序：宿主以项目目录为准 */
  const root = process.env.AOPC_PROJECT_DIR || process.env.AOPC_WORKSPACE_ROOT || process.cwd();
  return resolve(root);
}

export function wudiDir() {
  return join(projectRoot(), ".wudi");
}

/** 启动即建 .wudi/（插件只要被使用就存在），返回目录。 */
export function ensureWudiDir() {
  mkdirSync(wudiDir(), { recursive: true });
  return wudiDir();
}

/**
 * 确保指定项目根存在 .wudi/project.json（缺省用给定名/目录名初始化）。
 * 登记项目、打开项目列表、服务启动时调用 —— 「未建档」概念由此取消。
 */
export function ensureProfileAt(root, name = "") {
  const abs = resolve(root);
  const dir = join(abs, ".wudi");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "project.json");
  if (!existsSync(file)) {
    const base = String(name || abs.split("/").filter(Boolean).pop() || "project").trim();
    const doc = { ...structuredClone(PROJECT_TEMPLATE), name: base };
    writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  return file;
}

function path(name) {
  return join(wudiDir(), name);
}

function readJSON(name, fallback) {
  const p = path(name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[wudi-coding] ${p} 解析失败，使用默认值：${err.message}`);
    return fallback;
  }
}

function writeJSON(name, value) {
  mkdirSync(wudiDir(), { recursive: true });
  const p = path(name);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
  return p;
}

/* ---------------- 项目档案 project.json ---------------- */

export const PROJECT_TEMPLATE = {
  name: "",
  techStack: "",
  build: "",
  package: { type: "dir", path: "dist", dockerImage: "" },
  deployRoot: "",
  remoteScript: "",
  remoteWhitelist: [],
  healthCheck: { url: "", expect: 200, checkFrom: "remote" },
  logCommand: "",
  notifyWebhook: "",
  notifyFormat: "generic",
  confirmWord: "",
  deployPolicy: "confirm",
  envs: [],
  defaultEnv: "",
  notes: "",
};

/** 读项目档案；不存在返回 null。 */
function readJSONAt(root, name, fallback) {
  const p = join(resolve(root), ".wudi", name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[wudi-coding] ${p} 解析失败，使用默认值：${err.message}`);
    return fallback;
  }
}

/** 读指定项目根的档案（工作台多项目内容页用）；不存在返回 null。 */
export function loadProjectAt(root) {
  const raw = readJSONAt(root, "project.json", null);
  if (!raw) return null;
  return {
    ...structuredClone(PROJECT_TEMPLATE),
    ...raw,
    package: { ...PROJECT_TEMPLATE.package, ...(raw.package ?? {}) },
    healthCheck: { ...PROJECT_TEMPLATE.healthCheck, ...(raw.healthCheck ?? {}) },
    envs: Array.isArray(raw.envs) ? raw.envs : [],
  };
}

export function loadProject() {
  const raw = readJSON("project.json", null);
  if (!raw) return null;
  // 补齐新增字段的默认值，老档案也能用
  return {
    ...structuredClone(PROJECT_TEMPLATE),
    ...raw,
    package: { ...PROJECT_TEMPLATE.package, ...(raw.package ?? {}) },
    healthCheck: { ...PROJECT_TEMPLATE.healthCheck, ...(raw.healthCheck ?? {}) },
    envs: Array.isArray(raw.envs) ? raw.envs : [],
  };
}

/** 建立/更新项目档案（浅合并顶层，package/healthCheck 深合并），返回 {project, file}。 */
export function saveProject(patch) {
  const current = loadProject() ?? structuredClone(PROJECT_TEMPLATE);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === undefined) continue;
    if (k === "package") next.package = { ...current.package, ...v };
    else if (k === "healthCheck") next.healthCheck = { ...current.healthCheck, ...v };
    else next[k] = v;
  }
  const file = writeJSON("project.json", next);
  return { project: next, file };
}

/* ---------------- 多环境解析 ---------------- */

/**
 * 解析目标环境。规则（全部向后兼容）：
 *  - 档案没有 envs（或为空）→ 虚拟单环境 "default"，全部取顶层字段；
 *  - 有 envs → 按 name 找（envName 缺省用档案 defaultEnv，再缺省用第一个环境）；
 *    环境字段覆盖顶层同名字段，未设置的回落顶层。
 * 返回 {name, deployRoot, remoteScript, healthCheck, logCommand, ssh:{host,port,user}}；
 * ssh 取环境级覆盖（sshHost/sshPort/sshUser），再回落插件 userConfig 的全局值（ssh.mjs 处理）。
 */
export function resolveEnv(project, envName) {
  const envs = Array.isArray(project?.envs) ? project.envs : [];
  let env = null;
  if (envs.length) {
    const wanted = envName || project.defaultEnv || envs[0]?.name;
    env = envs.find((e) => e?.name === wanted) ?? null;
    if (!env) {
      const err = new Error(
        `找不到环境「${wanted}」。档案已配置环境：${envs.map((e) => e.name).join("、")}（用 env 参数指定，或用 wudi_env_set 增改）。`
      );
      err.code = "ENV_NOT_FOUND";
      throw err;
    }
  }
  const pick = (key, fallback = "") => (env && env[key] !== undefined && env[key] !== "" ? env[key] : project[key] ?? fallback);
  return {
    name: env?.name ?? "default",
    deployRoot: pick("deployRoot"),
    remoteScript: pick("remoteScript"),
    logCommand: pick("logCommand"),
    healthCheck: {
      url: (env && env.healthCheck?.url) || project.healthCheck?.url || "",
      expect: (env && env.healthCheck?.expect) || project.healthCheck?.expect || 200,
      checkFrom: (env && env.healthCheck?.checkFrom) || project.healthCheck?.checkFrom || "remote",
    },
    notifyWebhook: (env && env.notifyWebhook) || project.notifyWebhook || "",
    notifyFormat: (env && env.notifyFormat) || project.notifyFormat || "generic",
    confirmWord: (env && env.confirmWord) || project.confirmWord || "",
    deployPolicy: (env && env.deployPolicy) || project.deployPolicy || "confirm",
    ssh: {
      host: (env && env.sshHost) || "",
      port: (env && env.sshPort) || "",
      user: (env && env.sshUser) || "",
    },
    raw: env,
  };
}

/** 列出档案环境名（无 envs 时返回 ["default"]）。 */
export function listEnvNames(project) {
  const envs = Array.isArray(project?.envs) ? project.envs : [];
  return envs.length ? envs.map((e) => e.name) : ["default"];
}

/* ---------------- 部署历史 deploys.json ---------------- */

/**
 * 画布设计稿目录（集中式）：工作区单一 .wudi/ 下按项目分目录 ——
 * `.wudi/<项目目录名>/designs/`（用户要求：.wudi/ 下面以项目为基准）。
 */
export function projectBaseName(root) {
  return resolve(root).split("/").filter(Boolean).pop() || "project";
}

export function designsDirFor(root) {
  const dir = join(wudiDir(), projectBaseName(root), "designs");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 迁移历史遗留的画布到集中式目录（幂等）：
 * ① v0.38.0 的 .wudi/designs/（未按项目分）② 各项目根下的 designs/（v0.35 旧位置）。
 */
export function migrateDesignsFor(root) {
  const absRoot = resolve(root);
  const wsRoot = projectRoot();
  const base = projectBaseName(absRoot);
  const target = join(wsRoot, ".wudi", base, "designs");
  mkdirSync(target, { recursive: true });
  let moved = 0;
  const sources = [join(absRoot, "designs")]; // 各项目根下的旧位置
  if (absRoot === wsRoot) sources.push(join(wsRoot, ".wudi", "designs")); // v0.38.0 中央位置仅属于当前工作区项目
  for (const srcDir of sources) {
    if (!existsSync(srcDir) || resolve(srcDir) === resolve(target)) continue;
    for (const f of readdirSync(srcDir)) {
      if (!/\.(fig|pen)$/i.test(f)) continue;
      const src = join(srcDir, f);
      const dst = join(target, f);
      if (existsSync(dst)) { rmSync(src); continue; }
      renameSync(src, dst);
      moved++;
    }
    try {
      if (readdirSync(srcDir).length === 0) rmSync(srcDir, { recursive: true });
    } catch { /* ignore */ }
  }
  return moved;
}

/** 读指定项目根的部署历史（只读，不做僵尸清扫）。 *//** 读指定项目根的部署历史（只读，不做僵尸清扫）。 */
export function loadDeploysAt(root) {
  const list = readJSONAt(root, "deploys.json", []);
  return Array.isArray(list) ? list : [];
}

/** 读指定项目根的文档库。 */
export function loadDocsAt(root) {
  const list = readJSONAt(root, "docs.json", []);
  return Array.isArray(list) ? list : [];
}

export function loadDeploys() {
  const list = readJSON("deploys.json", []);
  // 清扫僵尸记录：进程中断留下的 running 状态，30 分钟无进展视为 aborted
  let changed = false;
  const now = Date.now();
  for (const d of list) {
    if (d.status === "running" && now - Date.parse(d.startedAt ?? 0) > 30 * 60_000) {
      d.status = "aborted";
      d.finishedAt = d.finishedAt ?? new Date().toISOString();
      changed = true;
    }
  }
  if (changed) writeJSON("deploys.json", list);
  return list;
}

/** 追加一条部署记录（最新在前，最多留 50 条）。 */
export function appendDeploy(record) {
  const list = loadDeploys();
  list.unshift(record);
  writeJSON("deploys.json", list.slice(0, 50));
  return record;
}

/** 按 id 更新一条部署记录（流水线阶段推进用）。 */
export function updateDeploy(id, patch) {
  const list = loadDeploys();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  writeJSON("deploys.json", list);
  return list[idx];
}

/* ---------------- 文档清单 docs.json ---------------- */

export function loadDocs() {
  return readJSON("docs.json", []);
}

/** 登记一条文档；同路径覆盖更新。 */
export function registerDoc({ path: docPath, type = "doc", title = "", source = "" }) {
  if (!docPath) throw new Error("缺少 path：要登记的文档相对项目根的路径。");
  const list = loadDocs().filter((d) => d.path !== docPath);
  list.unshift({
    path: docPath,
    type,
    title: title || docPath,
    source,
    updatedAt: new Date().toISOString(),
  });
  writeJSON("docs.json", list.slice(0, 100));
  return list[0];
}

/* ---------------- 设计产物 design/ ---------------- */

export function designDir() {
  return join(wudiDir(), "design");
}

/** 读 design tokens（.wudi/design/tokens.json）；不存在返回 null。 */
export function loadTokens() {
  return readJSON("design/tokens.json", null);
}

/** 写 design tokens（必须为对象），并同步生成 tokens.css（CSS 变量，两段式键名 --group-name）。 */
export function saveTokens(tokens) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error("tokens 必须是对象（如 { color: { primary: '#xxx' }, spacing: {...} }）。");
  }
  mkdirSync(designDir(), { recursive: true });
  writeJSON("design/tokens.json", tokens);
  // 生成 tokens.css：扁平化两层 { group: { name: value } } → --group-name: value;
  const lines = [":root {"];
  const flat = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const varName = `${prefix}-${k}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (v && typeof v === "object" && !Array.isArray(v)) flat(v, varName);
      else if (v !== null && v !== undefined) lines.push(`  --${varName.slice(1)}: ${v};`);
    }
  };
  flat(tokens, "@");
  lines.push("}");
  writeFileSync(join(designDir(), "tokens.css"), lines.join("\n"), "utf-8");
  return { json: join(designDir(), "tokens.json"), css: join(designDir(), "tokens.css") };
}

/* ---------------- 设计画布 v2（Figma 式：无限画布 + 多画板 Frame，Agent 可操作） ---------------- */

export const CANVAS_SHAPE_TYPES = ["rect", "ellipse", "diamond", "arrow", "text"];

/** 读设计画布 v2；旧格式（只有 shapes）自动迁移：全部形状归入新建默认画板。 */
export function loadCanvas() {
  const raw = readJSON("canvas.json", null);
  if (!raw) return { version: 2, frames: [], shapes: [] };
  if (Array.isArray(raw.frames)) {
    return { version: 2, frames: raw.frames, shapes: Array.isArray(raw.shapes) ? raw.shapes : [] };
  }
  // v1 迁移：shapes 平铺 → 建"画布 1"并按包围盒收纳
  const shapes = Array.isArray(raw.shapes) ? raw.shapes : [];
  let minX = 0, minY = 0, maxX = 800, maxY = 500;
  if (shapes.length) {
    minX = Math.min(...shapes.map((s) => s.x ?? 0));
    minY = Math.min(...shapes.map((s) => s.y ?? 0));
    maxX = Math.max(...shapes.map((s) => (s.x ?? 0) + (s.w ?? 0)));
    maxY = Math.max(...shapes.map((s) => (s.y ?? 0) + (s.h ?? 0)));
  }
  const frame = {
    id: `f-${Date.now().toString(36)}`,
    name: "画布 1",
    x: Math.floor(minX - 40),
    y: Math.floor(minY - 60),
    w: Math.max(400, Math.ceil(maxX - minX + 80)),
    h: Math.max(300, Math.ceil(maxY - minY + 100)),
    background: "#ffffff",
  };
  for (const sh of shapes) sh.frameId = frame.id;
  return { version: 2, frames: [frame], shapes };
}

/** 校验并规整画板（Frame）。 */
export function sanitizeFrame(input, index = 0) {
  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), lo), hi) : dflt;
  };
  return {
    id: /^f[\w-]{0,63}$/.test(String(input?.id)) ? String(input.id) : `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: String(input?.name ?? `画板 ${index + 1}`).slice(0, 60) || `画板 ${index + 1}`,
    x: num(input?.x, -2000, 4000, 0),
    y: num(input?.y, -2000, 4000, 0),
    w: num(input?.w, 50, 8000, 1440),
    h: num(input?.h, 50, 8000, 900),
    background: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.background)) ? String(input.background) : "#ffffff",
  };
}

/** 校验并规整形状：类型白名单、数值钳制、文本截断、frameId 校验（validFrameIds 传入时）。 */
export function sanitizeShape(input, index = 0, validFrameIds = null) {
  const type = String(input?.type ?? "");
  if (!CANVAS_SHAPE_TYPES.includes(type)) {
    throw new Error(`形状[${index}] 类型非法：${type}（允许 ${CANVAS_SHAPE_TYPES.join("/")}）`);
  }
  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.min(Math.max(Math.round(n), lo), hi);
  };
  let frameId = "";
  if (input?.frameId) {
    if (validFrameIds && !validFrameIds.has(String(input.frameId))) {
      throw new Error(`形状[${index}] frameId 不存在：${input.frameId}`);
    }
    frameId = String(input.frameId);
  }
  const shape = {
    // 关键：input.id 为 undefined 时 String() 会得到 "undefined" 并通过 \w 正则 —— 必须先判类型，
    // 否则所有自动生成的形状共享同一 id，update/delete/reorder 全部命中第一个。
    id: typeof input?.id === "string" && /^\w[\w-]{0,63}$/.test(input.id) ? input.id : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${Number.isInteger(index) && index > 0 ? "-" + index : ""}`,
    type,
    frameId,
    x: num(input.x, -2000, 8000, 40),
    y: num(input.y, -2000, 8000, 40),
    fill: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.fill)) ? String(input.fill) : "",
    stroke: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.stroke)) ? String(input.stroke) : "#3565f0",
    fontSize: num(input.fontSize, 8, 72, 14),
  };
  if (type === "text") {
    shape.text = String(input?.text ?? "").slice(0, 500);
    shape.w = num(input.w, 10, 4000, Math.max(60, shape.text.length * shape.fontSize * 0.62));
    shape.h = num(input.h, 16, 800, Math.ceil(shape.fontSize * 1.5));
  } else {
    shape.w = num(input.w, 2, 4000, 120);
    shape.h = num(input.h, 2, 4000, 80);
    shape.text = String(input?.text ?? "").slice(0, 200);
  }
  if (type === "arrow") {
    shape.x2 = num(input.x2, -2000, 8000, shape.x + 120);
    shape.y2 = num(input.y2, -2000, 8000, shape.y + 40);
  }
  return shape;
}

/** 保存设计画布 v2（原子写）。 */
export function saveCanvas(canvas) {
  if (!canvas || !Array.isArray(canvas.shapes) || !Array.isArray(canvas.frames)) {
    throw new Error("canvas 结构非法（缺 frames/shapes 数组）。");
  }
  // 数据安全：写入前把当前画布备份一份（误清空/误删可让 Agent 读 canvas.backup.json + replace 恢复）
  const cur = join(wudiDir(), "canvas.json");
  if (existsSync(cur)) copyFileSync(cur, join(wudiDir(), "canvas.backup.json"));
  writeJSON("canvas.json", {
    version: 2,
    frames: canvas.frames.slice(0, 50),
    shapes: canvas.shapes.slice(0, 1000),
  });
  return join(wudiDir(), "canvas.json");
}

/** 删除画板：withShapes=true 连同画板内形状一起删，否则形状转为游离（frameId 清空）。 */
export function deleteFrame(canvas, frameId, withShapes) {
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) throw new Error(`找不到画板 ${frameId}`);
  canvas.frames = canvas.frames.filter((f) => f.id !== frameId);
  if (withShapes) canvas.shapes = canvas.shapes.filter((s) => s.frameId !== frameId);
  else for (const s of canvas.shapes) if (s.frameId === frameId) s.frameId = "";
  return frame;
}

/** Figma 文件链接（.wudi/design/figma-url.txt）：面板「在浏览器打开 Figma」用。 */
export function getFigmaUrl() {
  try {
    return readFileSync(join(designDir(), "figma-url.txt"), "utf-8").trim();
  } catch {
    return "";
  }
}

export function setFigmaUrl(url) {
  const u = String(url ?? "").trim();
  if (!/^https:\/\/(www\.)?figma\.com\//.test(u)) {
    throw new Error("请填 https://www.figma.com/ 开头的 Figma 文件链接。");
  }
  mkdirSync(designDir(), { recursive: true });
  writeFileSync(join(designDir(), "figma-url.txt"), u, "utf-8");
  return u;
}

/** 画布导出为 Excalidraw 场景（.excalidraw）：画板映射为 Excalidraw frame，形状挂 frameId。 */
export function exportCanvasToExcalidraw(canvas, name) {
  const safe = String(name || "canvas").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "canvas";
  const el = (e) => ({
    id: e.id, type: e.type, x: e.x, y: e.y, width: e.width, height: e.height, angle: 0,
    strokeColor: e.strokeColor, backgroundColor: e.backgroundColor, fillStyle: "solid",
    strokeWidth: 2, roughness: 1, roundness: null, seed: 1, version: 1, versionNonce: 1,
    isDeleted: false, boundElements: null, groupIds: [], frameId: e.frameId ?? null, link: null, locked: false, opacity: 100,
    ...(e.text !== undefined ? { text: e.text, fontSize: e.fontSize, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, lineHeight: 1.25 } : {}),
    ...(e.points ? { points: e.points, startArrowhead: null, endArrowhead: "arrow", lastCommittedPoint: null } : {}),
    ...(e.frameName !== undefined ? { name: e.frameName } : {}),
  });
  const elements = [];
  for (const f of canvas.frames ?? []) {
    elements.push(el({ id: `f-${f.id}`, type: "frame", x: f.x, y: f.y, width: f.w, height: f.h, strokeColor: "transparent", backgroundColor: f.background, frameName: f.name }));
  }
  for (const s of canvas.shapes ?? []) {
    const id = `wudi-${s.id}`;
    const frameId = s.frameId ? `f-${s.frameId}` : null;
    if (s.type === "text") {
      elements.push(el({ id, type: "text", x: s.x, y: s.y, width: s.w, height: s.h, strokeColor: s.fill || "#171a21", backgroundColor: "transparent", text: s.text, fontSize: s.fontSize, frameId }));
      continue;
    }
    if (s.type === "arrow") {
      const dx = (s.x2 ?? s.x + 120) - s.x, dy = (s.y2 ?? s.y + 40) - s.y;
      elements.push(el({ id, type: "arrow", x: s.x, y: s.y, width: Math.abs(dx), height: Math.abs(dy), strokeColor: s.stroke || "#3565f0", backgroundColor: "transparent", points: [[0, 0], [dx, dy]], frameId }));
      continue;
    }
    elements.push(el({ id, type: s.type === "diamond" ? "diamond" : "rectangle", x: s.x, y: s.y, width: s.w, height: s.h, strokeColor: s.stroke || "#3565f0", backgroundColor: s.fill || "transparent", frameId }));
  }
  const scene = { type: "excalidraw", version: 2, source: "wudi-coding", elements, appState: { viewBackgroundColor: "#f4f6fa" }, files: {} };
  const dir = join(wudiDir(), "design", "canvas");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${safe}.excalidraw`);
  writeFileSync(file, JSON.stringify(scene, null, 2), "utf-8");
  return { file, relPath: `.wudi/design/canvas/${safe}.excalidraw`, elements: elements.length };
}

/** 画布按画板导出为设计稿 HTML：每帧一个独立 mockup（命名取画板名）。 */
export function exportCanvasToMockups(canvas, name) {
  const safe = String(name || "canvas").replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/^-+|-+$/g, "") || "canvas";
  const mockDir = join(wudiDir(), "design", "mockups");
  mkdirSync(mockDir, { recursive: true });
  const outputs = [];
  const frames = (canvas.frames ?? []).length ? canvas.frames : [{ id: "", name: safe, x: 0, y: 0, w: 800, h: 500, background: "#ffffff" }];
  for (const f of frames) {
    const shapes = (canvas.shapes ?? []).filter((s) => (s.frameId || "") === f.id);
    const shapesSvg = shapes.map((s) => shapeToSvg(s)).join("\n  ");
    const frameSafe = `${safe}-${String(f.name).replace(/[^\w\u4e00-\u9fa5-]+/g, "-")}`;
    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeXml(f.name)} 设计画板</title>
<style>body{margin:0;background:#f4f6fa;display:flex;justify-content:center;padding:24px}.frame{background:${f.background};border:1px solid #e3e7ee;border-radius:12px;box-shadow:0 1px 3px rgba(16,24,40,.06)}</style>
</head><body><div class="frame"><svg width="${f.w}" height="${f.h}" viewBox="0 0 ${f.w} ${f.h}" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <defs><marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#3565f0"/></marker></defs>
  <rect width="${f.w}" height="${f.h}" fill="${f.background}"/>
  ${shapesSvg}
</svg></div></body></html>`;
    const file = join(mockDir, `${frameSafe}.html`);
    writeFileSync(file, html, "utf-8");
    outputs.push({ frame: f.name, frameId: f.id, relPath: `.wudi/design/mockups/${frameSafe}.html`, shapes: shapes.length });
  }
  return outputs;
}

function shapeToSvg(s) {
  const stroke = s.stroke || "#3565f0";
  const fill = s.fill || "none";
  const text = (t, x, y, size, anchor = "middle") => (t ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#171a21" font-family="sans-serif">${escapeXml(t)}</text>` : "");
  if (s.type === "rect") return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${text(s.text, s.x + s.w / 2, s.y + s.h / 2 + s.fontSize / 3, s.fontSize)}`;
  if (s.type === "ellipse") return `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${text(s.text, s.x + s.w / 2, s.y + s.h / 2 + s.fontSize / 3, s.fontSize)}`;
  if (s.type === "diamond") {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    return `<polygon points="${cx},${s.y} ${s.x + s.w},${cy} ${cx},${s.y + s.h} ${s.x},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${text(s.text, cx, cy + s.fontSize / 3, s.fontSize)}`;
  }
  if (s.type === "arrow") return `<line x1="${s.x}" y1="${s.y}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="2" marker-end="url(#arrowhead)"/>`;
  return text(s.text, s.x, s.y + s.fontSize, s.fontSize, "start");
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- 时间戳与工具 ---------------- */

/** 本地时间 yyyymmdd-hhmmss，用作 release 标识。 */
export function releaseStamp(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/** 本地插件数据目录（日志等非项目状态用）。 */
export function pluginDataDir() {
  return process.env.AOPC_PLUGIN_DATA
    ? join(process.env.AOPC_PLUGIN_DATA, "wudi-coding")
    : join(homedir(), ".aopc", "wudi-coding");
}

/* ---------------- 项目注册表（按工作区分域：<工作区>/.wudi/projects.json） ----------------
 * 每个左侧栏工作区（AOPC_WORKSPACE_ROOT）只看到自己登记的项目；注册表与隐藏集随工作区走，
 * 不再放插件全局数据目录——否则新开一个工作区还能看到别的工作区登记的项目。 */

function wudiDirAt(root) {
  return join(resolve(root), ".wudi");
}

function registryPath(wsRoot = projectRoot()) {
  return join(wudiDirAt(wsRoot), "projects.json");
}

function hiddenPath(wsRoot = projectRoot()) {
  return join(wudiDirAt(wsRoot), "hidden_projects.json");
}

function legacyPath(name) {
  return join(pluginDataDir(), name);
}

function withinRoot(p, root) {
  const abs = resolve(String(p ?? ""));
  const base = resolve(root);
  return abs === base || abs.startsWith(base + "/");
}

/** 旧版全局注册表 → 按工作区惰性迁移：只迁入本工作区范围内的条目，旧文件保留不动。 */
export function migrateRegistryFor(wsRoot = projectRoot()) {
  const root = resolve(wsRoot);
  try {
    if (!existsSync(registryPath(root))) {
      const legacy = legacyPath("projects.json");
      if (existsSync(legacy)) {
        const list = JSON.parse(readFileSync(legacy, "utf-8"));
        const mine = Array.isArray(list) ? list.filter((e) => e?.path && withinRoot(e.path, root)) : [];
        if (mine.length) saveRegistry(mine, root);
      }
    }
    if (!existsSync(hiddenPath(root))) {
      const legacy = legacyPath("hidden_projects.json");
      if (existsSync(legacy)) {
        const list = JSON.parse(readFileSync(legacy, "utf-8"));
        const mine = Array.isArray(list) ? list.filter((x) => withinRoot(x, root)) : [];
        if (mine.length) saveHidden(mine, root);
      }
    }
  } catch (err) {
    console.error(`[wudi-coding] 注册表迁移失败（按空处理）：${err.message}`);
  }
}

/** 读项目注册表：[{id, name, path, addedAt}]（工作区作用域，随 .wudi 走）。 */
export function loadRegistry(wsRoot = projectRoot()) {
  const root = resolve(wsRoot);
  migrateRegistryFor(root);
  const p = registryPath(root);
  if (!existsSync(p)) return [];
  try {
    const list = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error(`[wudi-coding] ${p} 解析失败，按空注册表处理：${err.message}`);
    return [];
  }
}

function saveRegistry(list, wsRoot = projectRoot()) {
  mkdirSync(wudiDirAt(wsRoot), { recursive: true });
  const p = registryPath(wsRoot);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(list, null, 2));
  renameSync(tmp, p);
  return list;
}

/**
 * 注册表登记/更新一个项目（按 path 去重；name 缺省取目录名）。
 * 返回 {entry, added}。
 */
export function registryAdd(path, name = "", wsRoot = projectRoot()) {
  const abs = resolve(String(path).trim());
  if (!abs || abs === "/") throw new Error("path 无效。");
  const list = loadRegistry(wsRoot);
  const existing = list.find((e) => e.path === abs);
  if (existing) {
    if (name) existing.name = name;
    saveRegistry(list, wsRoot);
    return { entry: existing, added: false };
  }
  const entry = {
    id: `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || abs.split("/").filter(Boolean).pop() || abs,
    path: abs,
    addedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  saveRegistry(list, wsRoot);
  return { entry, added: true };
}

/* ---------------- 隐藏项目（用户显式移除当前工作区后不再自动登记，工作区作用域） ---------------- */

function loadHidden(wsRoot = projectRoot()) {
  try {
    const list = JSON.parse(readFileSync(hiddenPath(wsRoot), "utf-8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHidden(list, wsRoot = projectRoot()) {
  mkdirSync(wudiDirAt(wsRoot), { recursive: true });
  const p = hiddenPath(wsRoot);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(list, null, 2));
  renameSync(tmp, p);
  return list;
}

/** 把项目根加入隐藏集（显式移除当前工作区项目后调用）。 */
export function hideProjectRoot(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  const list = loadHidden(wsRoot);
  if (!list.includes(abs)) {
    list.push(abs);
    saveHidden(list, wsRoot);
  }
  return abs;
}

/** 取消隐藏（重新登记时调用）。 */
export function unhideProjectRoot(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  const list = loadHidden(wsRoot).filter((x) => resolve(x) !== abs);
  saveHidden(list, wsRoot);
  return abs;
}

/** 该项目根是否被用户显式移除/隐藏。 */
export function isProjectRootHidden(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  return loadHidden(wsRoot).some((x) => resolve(x) === abs);
}

/** 重命名注册表条目（只改显示名，不动项目目录）。 */
export function registryRename(idOrPath, name, wsRoot = projectRoot()) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("name 不能为空。");
  const list = loadRegistry(wsRoot);
  const entry = list.find((e) => e.id === idOrPath || e.path === idOrPath);
  if (!entry) return null;
  entry.name = trimmed;
  saveRegistry(list, wsRoot);
  return entry;
}

export function registryRemove(idOrPath, wsRoot = projectRoot()) {
  const list = loadRegistry(wsRoot);
  const next = list.filter((e) => e.id !== idOrPath && e.path !== idOrPath);
  if (next.length === list.length) return null;
  saveRegistry(next, wsRoot);
  return list.find((e) => e.id === idOrPath || e.path === idOrPath);
}

/**
 * 汇总注册表里每个项目的只读概览（读各自 .wudi/）：
 * 档案字段、环境数、最近部署、文档数、设计产物数、是否当前工作区。
 */
export function registrySummaries(currentRoot = "", wsRoot = projectRoot()) {
  const cur = currentRoot ? resolve(currentRoot) : "";
  return loadRegistry(wsRoot).map((entry) => {
    const wudi = join(entry.path, ".wudi");
    const read = (name, fallback) => {
      try {
        return JSON.parse(readFileSync(join(wudi, name), "utf-8"));
      } catch {
        return fallback;
      }
    };
    const project = read("project.json", null);
    const deploys = read("deploys.json", []);
    const docs = read("docs.json", []);
    let designCount = 0;
    try {
      /* 画布集中存储：<工作区>/.wudi/<项目>/designs/*.fig|.pen（与设计页列表同一口径）；
       * 未迁移的历史位置（项目根 designs/、v0.38 中央 .wudi/designs/）一并统计，按文件名去重。 */
      const canvasDirs = [
        join(wsRoot, ".wudi", projectBaseName(entry.path), "designs"),
        join(entry.path, "designs"),
      ];
      if (resolve(entry.path) === resolve(wsRoot)) canvasDirs.push(join(wsRoot, ".wudi", "designs"));
      const names = new Set();
      for (const dir of canvasDirs) {
        try {
          for (const f of readdirSync(dir)) {
            if (/\.(fig|pen)$/i.test(f)) names.add(f);
          }
        } catch { /* 目录不存在 */ }
      }
      designCount = names.size;
    } catch { /* 无画布目录 */ }
    const envs = Array.isArray(project?.envs) ? project.envs.map((e) => e.name) : [];
    const last = deploys[0] ?? null;
    return {
      ...entry,
      isCurrent: !!cur && resolve(entry.path) === cur,
      archived: !!project,
      techStack: project?.techStack ?? "",
      envNames: envs.length ? envs : project?.deployRoot ? ["default"] : [],
      lastDeploy: last ? { release: last.release ?? last.id, type: last.type, status: last.status, env: last.env, finishedAt: last.finishedAt ?? last.startedAt } : null,
      docsCount: docs.length,
      designCount,
    };
  });
}
