// src/store.ts
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
function projectRoot() {
  const root = process.env.AOPC_WORKSPACE_ROOT || process.cwd();
  return resolve(root);
}
function wudiDir() {
  return join(projectRoot(), ".wudi");
}
function ensureWudiDir() {
  mkdirSync(wudiDir(), { recursive: true });
  return wudiDir();
}
function ensureProfileAt(root, name = "") {
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
    console.error(`[wudi-coding] ${p} \u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C\uFF1A${err.message}`);
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
var PROJECT_TEMPLATE = {
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
  notes: ""
};
function readJSONAt(root, name, fallback) {
  const p = join(resolve(root), ".wudi", name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[wudi-coding] ${p} \u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C\uFF1A${err.message}`);
    return fallback;
  }
}
function loadProjectAt(root) {
  const raw = readJSONAt(root, "project.json", null);
  if (!raw) return null;
  return {
    ...structuredClone(PROJECT_TEMPLATE),
    ...raw,
    package: { ...PROJECT_TEMPLATE.package, ...raw.package ?? {} },
    healthCheck: { ...PROJECT_TEMPLATE.healthCheck, ...raw.healthCheck ?? {} },
    envs: Array.isArray(raw.envs) ? raw.envs : []
  };
}
function loadProject() {
  const raw = readJSON("project.json", null);
  if (!raw) return null;
  return {
    ...structuredClone(PROJECT_TEMPLATE),
    ...raw,
    package: { ...PROJECT_TEMPLATE.package, ...raw.package ?? {} },
    healthCheck: { ...PROJECT_TEMPLATE.healthCheck, ...raw.healthCheck ?? {} },
    envs: Array.isArray(raw.envs) ? raw.envs : []
  };
}
function saveProject(patch) {
  const current = loadProject() ?? structuredClone(PROJECT_TEMPLATE);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === void 0) continue;
    if (k === "package") next.package = { ...current.package, ...v };
    else if (k === "healthCheck") next.healthCheck = { ...current.healthCheck, ...v };
    else next[k] = v;
  }
  const file = writeJSON("project.json", next);
  return { project: next, file };
}
function resolveEnv(project, envName) {
  const envs = Array.isArray(project?.envs) ? project.envs : [];
  let env = null;
  if (envs.length) {
    const wanted = envName || project.defaultEnv || envs[0]?.name;
    env = envs.find((e) => e?.name === wanted) ?? null;
    if (!env) {
      const err = new Error(
        `\u627E\u4E0D\u5230\u73AF\u5883\u300C${wanted}\u300D\u3002\u6863\u6848\u5DF2\u914D\u7F6E\u73AF\u5883\uFF1A${envs.map((e) => e.name).join("\u3001")}\uFF08\u7528 env \u53C2\u6570\u6307\u5B9A\uFF0C\u6216\u7528 wudi_env_set \u589E\u6539\uFF09\u3002`
      );
      err.code = "ENV_NOT_FOUND";
      throw err;
    }
  }
  const pick = (key, fallback = "") => env && env[key] !== void 0 && env[key] !== "" ? env[key] : project[key] ?? fallback;
  return {
    name: env?.name ?? "default",
    deployRoot: pick("deployRoot"),
    remoteScript: pick("remoteScript"),
    logCommand: pick("logCommand"),
    healthCheck: {
      url: env && env.healthCheck?.url || project.healthCheck?.url || "",
      expect: env && env.healthCheck?.expect || project.healthCheck?.expect || 200,
      checkFrom: env && env.healthCheck?.checkFrom || project.healthCheck?.checkFrom || "remote"
    },
    notifyWebhook: env && env.notifyWebhook || project.notifyWebhook || "",
    notifyFormat: env && env.notifyFormat || project.notifyFormat || "generic",
    confirmWord: env && env.confirmWord || project.confirmWord || "",
    deployPolicy: env && env.deployPolicy || project.deployPolicy || "confirm",
    ssh: {
      host: env && env.sshHost || "",
      port: env && env.sshPort || "",
      user: env && env.sshUser || ""
    },
    raw: env
  };
}
function listEnvNames(project) {
  const envs = Array.isArray(project?.envs) ? project.envs : [];
  return envs.length ? envs.map((e) => e.name) : ["default"];
}
function loadDeploysAt(root) {
  const list = readJSONAt(root, "deploys.json", []);
  return Array.isArray(list) ? list : [];
}
function loadDocsAt(root) {
  const list = readJSONAt(root, "docs.json", []);
  return Array.isArray(list) ? list : [];
}
function loadDeploys() {
  const list = readJSON("deploys.json", []);
  let changed = false;
  const now = Date.now();
  for (const d of list) {
    if (d.status === "running" && now - Date.parse(d.startedAt ?? 0) > 30 * 6e4) {
      d.status = "aborted";
      d.finishedAt = d.finishedAt ?? (/* @__PURE__ */ new Date()).toISOString();
      changed = true;
    }
  }
  if (changed) writeJSON("deploys.json", list);
  return list;
}
function appendDeploy(record) {
  const list = loadDeploys();
  list.unshift(record);
  writeJSON("deploys.json", list.slice(0, 50));
  return record;
}
function updateDeploy(id, patch) {
  const list = loadDeploys();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  writeJSON("deploys.json", list);
  return list[idx];
}
function loadDocs() {
  return readJSON("docs.json", []);
}
function registerDoc({ path: docPath, type = "doc", title = "", source = "" }) {
  if (!docPath) throw new Error("\u7F3A\u5C11 path\uFF1A\u8981\u767B\u8BB0\u7684\u6587\u6863\u76F8\u5BF9\u9879\u76EE\u6839\u7684\u8DEF\u5F84\u3002");
  const list = loadDocs().filter((d) => d.path !== docPath);
  list.unshift({
    path: docPath,
    type,
    title: title || docPath,
    source,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  writeJSON("docs.json", list.slice(0, 100));
  return list[0];
}
function designDir() {
  return join(wudiDir(), "design");
}
function loadTokens() {
  return readJSON("design/tokens.json", null);
}
function saveTokens(tokens) {
  if (!tokens || typeof tokens !== "object" || Array.isArray(tokens)) {
    throw new Error("tokens \u5FC5\u987B\u662F\u5BF9\u8C61\uFF08\u5982 { color: { primary: '#xxx' }, spacing: {...} }\uFF09\u3002");
  }
  mkdirSync(designDir(), { recursive: true });
  writeJSON("design/tokens.json", tokens);
  const lines = [":root {"];
  const flat = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      const varName = `${prefix}-${k}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (v && typeof v === "object" && !Array.isArray(v)) flat(v, varName);
      else if (v !== null && v !== void 0) lines.push(`  --${varName.slice(1)}: ${v};`);
    }
  };
  flat(tokens, "@");
  lines.push("}");
  writeFileSync(join(designDir(), "tokens.css"), lines.join("\n"), "utf-8");
  return { json: join(designDir(), "tokens.json"), css: join(designDir(), "tokens.css") };
}
var CANVAS_SHAPE_TYPES = ["rect", "ellipse", "diamond", "arrow", "text"];
function loadCanvas() {
  const raw = readJSON("canvas.json", null);
  if (!raw) return { version: 2, frames: [], shapes: [] };
  if (Array.isArray(raw.frames)) {
    return { version: 2, frames: raw.frames, shapes: Array.isArray(raw.shapes) ? raw.shapes : [] };
  }
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
    name: "\u753B\u5E03 1",
    x: Math.floor(minX - 40),
    y: Math.floor(minY - 60),
    w: Math.max(400, Math.ceil(maxX - minX + 80)),
    h: Math.max(300, Math.ceil(maxY - minY + 100)),
    background: "#ffffff"
  };
  for (const sh of shapes) sh.frameId = frame.id;
  return { version: 2, frames: [frame], shapes };
}
function sanitizeFrame(input, index = 0) {
  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), lo), hi) : dflt;
  };
  return {
    id: /^f[\w-]{0,63}$/.test(String(input?.id)) ? String(input.id) : `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    name: String(input?.name ?? `\u753B\u677F ${index + 1}`).slice(0, 60) || `\u753B\u677F ${index + 1}`,
    x: num(input?.x, -2e3, 4e3, 0),
    y: num(input?.y, -2e3, 4e3, 0),
    w: num(input?.w, 50, 8e3, 1440),
    h: num(input?.h, 50, 8e3, 900),
    background: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.background)) ? String(input.background) : "#ffffff"
  };
}
function sanitizeShape(input, index = 0, validFrameIds = null) {
  const type = String(input?.type ?? "");
  if (!CANVAS_SHAPE_TYPES.includes(type)) {
    throw new Error(`\u5F62\u72B6[${index}] \u7C7B\u578B\u975E\u6CD5\uFF1A${type}\uFF08\u5141\u8BB8 ${CANVAS_SHAPE_TYPES.join("/")}\uFF09`);
  }
  const num = (v, lo, hi, dflt) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return dflt;
    return Math.min(Math.max(Math.round(n), lo), hi);
  };
  let frameId = "";
  if (input?.frameId) {
    if (validFrameIds && !validFrameIds.has(String(input.frameId))) {
      throw new Error(`\u5F62\u72B6[${index}] frameId \u4E0D\u5B58\u5728\uFF1A${input.frameId}`);
    }
    frameId = String(input.frameId);
  }
  const shape = {
    // 关键：input.id 为 undefined 时 String() 会得到 "undefined" 并通过 \w 正则 —— 必须先判类型，
    // 否则所有自动生成的形状共享同一 id，update/delete/reorder 全部命中第一个。
    id: typeof input?.id === "string" && /^\w[\w-]{0,63}$/.test(input.id) ? input.id : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}${Number.isInteger(index) && index > 0 ? "-" + index : ""}`,
    type,
    frameId,
    x: num(input.x, -2e3, 8e3, 40),
    y: num(input.y, -2e3, 8e3, 40),
    fill: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.fill)) ? String(input.fill) : "",
    stroke: /^#[0-9a-fA-F]{3,8}$/.test(String(input?.stroke)) ? String(input.stroke) : "#3565f0",
    fontSize: num(input.fontSize, 8, 72, 14)
  };
  if (type === "text") {
    shape.text = String(input?.text ?? "").slice(0, 500);
    shape.w = num(input.w, 10, 4e3, Math.max(60, shape.text.length * shape.fontSize * 0.62));
    shape.h = num(input.h, 16, 800, Math.ceil(shape.fontSize * 1.5));
  } else {
    shape.w = num(input.w, 2, 4e3, 120);
    shape.h = num(input.h, 2, 4e3, 80);
    shape.text = String(input?.text ?? "").slice(0, 200);
  }
  if (type === "arrow") {
    shape.x2 = num(input.x2, -2e3, 8e3, shape.x + 120);
    shape.y2 = num(input.y2, -2e3, 8e3, shape.y + 40);
  }
  return shape;
}
function saveCanvas(canvas) {
  if (!canvas || !Array.isArray(canvas.shapes) || !Array.isArray(canvas.frames)) {
    throw new Error("canvas \u7ED3\u6784\u975E\u6CD5\uFF08\u7F3A frames/shapes \u6570\u7EC4\uFF09\u3002");
  }
  const cur = join(wudiDir(), "canvas.json");
  if (existsSync(cur)) copyFileSync(cur, join(wudiDir(), "canvas.backup.json"));
  writeJSON("canvas.json", {
    version: 2,
    frames: canvas.frames.slice(0, 50),
    shapes: canvas.shapes.slice(0, 1e3)
  });
  return join(wudiDir(), "canvas.json");
}
function deleteFrame(canvas, frameId, withShapes) {
  const frame = canvas.frames.find((f) => f.id === frameId);
  if (!frame) throw new Error(`\u627E\u4E0D\u5230\u753B\u677F ${frameId}`);
  canvas.frames = canvas.frames.filter((f) => f.id !== frameId);
  if (withShapes) canvas.shapes = canvas.shapes.filter((s) => s.frameId !== frameId);
  else for (const s of canvas.shapes) if (s.frameId === frameId) s.frameId = "";
  return frame;
}
function getFigmaUrl() {
  try {
    return readFileSync(join(designDir(), "figma-url.txt"), "utf-8").trim();
  } catch {
    return "";
  }
}
function setFigmaUrl(url) {
  const u = String(url ?? "").trim();
  if (!/^https:\/\/(www\.)?figma\.com\//.test(u)) {
    throw new Error("\u8BF7\u586B https://www.figma.com/ \u5F00\u5934\u7684 Figma \u6587\u4EF6\u94FE\u63A5\u3002");
  }
  mkdirSync(designDir(), { recursive: true });
  writeFileSync(join(designDir(), "figma-url.txt"), u, "utf-8");
  return u;
}
function exportCanvasToExcalidraw(canvas, name) {
  const safe = String(name || "canvas").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "canvas";
  const el = (e) => ({
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height,
    angle: 0,
    strokeColor: e.strokeColor,
    backgroundColor: e.backgroundColor,
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 1,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    groupIds: [],
    frameId: e.frameId ?? null,
    link: null,
    locked: false,
    opacity: 100,
    ...e.text !== void 0 ? { text: e.text, fontSize: e.fontSize, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, lineHeight: 1.25 } : {},
    ...e.points ? { points: e.points, startArrowhead: null, endArrowhead: "arrow", lastCommittedPoint: null } : {},
    ...e.frameName !== void 0 ? { name: e.frameName } : {}
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
function exportCanvasToMockups(canvas, name) {
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
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeXml(f.name)} \u8BBE\u8BA1\u753B\u677F</title>
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
  const text = (t, x, y, size, anchor = "middle") => t ? `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="#171a21" font-family="sans-serif">${escapeXml(t)}</text>` : "";
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
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function releaseStamp(date = /* @__PURE__ */ new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}
function pluginDataDir() {
  return process.env.AOPC_PLUGIN_DATA ? join(process.env.AOPC_PLUGIN_DATA, "wudi-coding") : join(homedir(), ".aopc", "wudi-coding");
}
function registryPath() {
  return join(pluginDataDir(), "projects.json");
}
function loadRegistry() {
  const p = registryPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[wudi-coding] ${p} \u89E3\u6790\u5931\u8D25\uFF0C\u6309\u7A7A\u6CE8\u518C\u8868\u5904\u7406\uFF1A${err.message}`);
    return [];
  }
}
function saveRegistry(list) {
  mkdirSync(pluginDataDir(), { recursive: true });
  const p = registryPath();
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(list, null, 2));
  renameSync(tmp, p);
  return list;
}
function registryAdd(path2, name = "") {
  const abs = resolve(String(path2).trim());
  if (!abs || abs === "/") throw new Error("path \u65E0\u6548\u3002");
  const list = loadRegistry();
  const existing = list.find((e) => e.path === abs);
  if (existing) {
    if (name) existing.name = name;
    saveRegistry(list);
    return { entry: existing, added: false };
  }
  const entry = {
    id: `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || abs.split("/").filter(Boolean).pop() || abs,
    path: abs,
    addedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  list.unshift(entry);
  saveRegistry(list);
  return { entry, added: true };
}
function registryRename(idOrPath, name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("name \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  const list = loadRegistry();
  const entry = list.find((e) => e.id === idOrPath || e.path === idOrPath);
  if (!entry) return null;
  entry.name = trimmed;
  saveRegistry(list);
  return entry;
}
function registryRemove(idOrPath) {
  const list = loadRegistry();
  const next = list.filter((e) => e.id !== idOrPath && e.path !== idOrPath);
  if (next.length === list.length) return null;
  saveRegistry(next);
  return list.find((e) => e.id === idOrPath || e.path === idOrPath);
}
function registrySummaries(currentRoot = "") {
  const cur = currentRoot ? resolve(currentRoot) : "";
  return loadRegistry().map((entry) => {
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
      designCount = readdirSync(join(wudi, "design"), { recursive: true }).filter((f) => String(f).endsWith(".html") || String(f).endsWith(".json")).length;
    } catch {
    }
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
      designCount
    };
  });
}
export {
  CANVAS_SHAPE_TYPES,
  PROJECT_TEMPLATE,
  appendDeploy,
  deleteFrame,
  designDir,
  ensureProfileAt,
  ensureWudiDir,
  exportCanvasToExcalidraw,
  exportCanvasToMockups,
  getFigmaUrl,
  listEnvNames,
  loadCanvas,
  loadDeploys,
  loadDeploysAt,
  loadDocs,
  loadDocsAt,
  loadProject,
  loadProjectAt,
  loadRegistry,
  loadTokens,
  pluginDataDir,
  projectRoot,
  registerDoc,
  registryAdd,
  registryRemove,
  registryRename,
  registrySummaries,
  releaseStamp,
  resolveEnv,
  sanitizeFrame,
  sanitizeShape,
  saveCanvas,
  saveProject,
  saveTokens,
  setFigmaUrl,
  updateDeploy,
  wudiDir
};
