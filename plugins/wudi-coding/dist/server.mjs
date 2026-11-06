/* wudi-coding server —— src/ 的构建产物，勿手改（npm run build） */

// src/server.ts
import { readFileSync as readFileSync3, existsSync as existsSync4, readdirSync as readdirSync3 } from "node:fs";
import { dirname as dirname2, join as join4, resolve as resolve4 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/tools.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync2, renameSync as renameSync2, rmSync, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join2, resolve as resolve2 } from "node:path";

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

// src/ssh.ts
import { execFile } from "node:child_process";
import { existsSync as existsSync2 } from "node:fs";
function sshConfig(overrides = {}) {
  const cfg = {
    host: overrides.host || process.env.WUDI_SSH_HOST || "",
    port: overrides.port || process.env.WUDI_SSH_PORT || "22",
    user: overrides.user || process.env.WUDI_SSH_USER || "root",
    identity: process.env.WUDI_SSH_IDENTITY || "",
    timeoutSec: Number(process.env.WUDI_SSH_TIMEOUT_SEC || "15")
  };
  if (!cfg.host) {
    throw new Error(
      "\u672A\u914D\u7F6E SSH \u76EE\u6807\u3002\u8BF7\u5728 AOPC \u63D2\u4EF6\u8BBE\u7F6E\u91CC\u586B\u5199 wudi-coding \u7684 sshHost / sshUser\uFF08\u53EF\u9009 sshPort\u3001sshIdentityPath\uFF09\uFF0C\u7136\u540E\u91CD\u5F00\u4F1A\u8BDD\u4F7F MCP server \u91CD\u65B0\u52A0\u8F7D\u3002"
    );
  }
  return cfg;
}
function baseArgs(cfg) {
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    `ConnectTimeout=${Math.min(cfg.timeoutSec, 30)}`,
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-p",
    String(cfg.port)
  ];
  if (cfg.identity) {
    if (!existsSync2(cfg.identity)) {
      throw new Error(`SSH \u5BC6\u94A5\u6587\u4EF6\u4E0D\u5B58\u5728\uFF1A${cfg.identity}`);
    }
    args.push("-i", cfg.identity);
  }
  args.push(`${cfg.user}@${cfg.host}`);
  return args;
}
function run(file, args, { timeoutMs = 12e4, maxBuffer = 32 * 1024 * 1024 } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(file, args, { timeout: timeoutMs, maxBuffer, encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(
          `${file} \u9000\u51FA\u7801 ${err.killed ? "\uFF08\u8D85\u65F6\u88AB\u6740\uFF09" : err.code ?? "?"}\uFF1A${String(stderr || err.message).slice(0, 2e3)}`
        );
        e.code = err.code;
        e.killed = err.killed;
        reject(e);
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}
async function sshRun(command, { timeoutMs = 12e4, overrides = {} } = {}) {
  const cfg = sshConfig(overrides);
  const args = [...baseArgs(cfg), command];
  return run("ssh", args, { timeoutMs });
}
function localRun(command, { cwd, timeoutMs = 6e5 } = {}) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      "/bin/sh",
      ["-c", command],
      { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, encoding: "utf-8" },
      (err, stdout, stderr) => {
        if (err) {
          const e = new Error(
            `\u672C\u5730\u547D\u4EE4\u9000\u51FA\u7801 ${err.killed ? "\uFF08\u8D85\u65F6\u88AB\u6740\uFF09" : err.code ?? "?"}\uFF1A${command}
${String(stderr || err.message).slice(0, 2e3)}`
          );
          e.code = err.code;
          reject(e);
          return;
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });
}
async function uploadFile(localPath, remotePath, { timeoutMs = 30 * 6e4, overrides = {} } = {}) {
  const cfg = sshConfig(overrides);
  const dest = `${cfg.user}@${cfg.host}`;
  const sshOption = `ssh -o BatchMode=yes -o ConnectTimeout=${Math.min(cfg.timeoutSec, 30)} -o StrictHostKeyChecking=accept-new${cfg.identity ? ` -i ${cfg.identity}` : ""} -p ${cfg.port}`;
  try {
    const rsyncArgs = ["-az", "--quiet", "-e", sshOption, localPath, `${dest}:${remotePath}`];
    return await run("rsync", rsyncArgs, { timeoutMs });
  } catch {
    const scpArgs = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-P", String(cfg.port)];
    if (cfg.identity) scpArgs.push("-i", cfg.identity);
    scpArgs.push(localPath, `${dest}:${remotePath}`);
    return run("scp", scpArgs, { timeoutMs });
  }
}
async function sshPing(overrides = {}) {
  const cfg = sshConfig(overrides);
  const started = Date.now();
  const { stdout } = await sshRun("echo wudi-ping-ok", { timeoutMs: cfg.timeoutSec * 1e3 + 5e3, overrides });
  return { ok: stdout.includes("wudi-ping-ok"), latencyMs: Date.now() - started, host: cfg.host };
}

// src/figma.ts
var API = "https://api.figma.com/v1";
function figmaToken() {
  return (process.env.WUDI_FIGMA_TOKEN || "").trim();
}
function parseFigmaRef(input) {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("\u7F3A\u5C11 fileKey \u6216 Figma \u94FE\u63A5\u3002");
  const urlMatch = s.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (urlMatch) {
    const nodeMatch = s.match(/node-id=([\d-]+)/);
    return {
      fileKey: urlMatch[1],
      nodeId: nodeMatch ? nodeMatch[1].replace("-", ":") : ""
    };
  }
  const bare = s.match(/^([A-Za-z0-9]+)(?:[\s:]+([\d]+:[\d]+))?$/);
  if (bare) return { fileKey: bare[1], nodeId: bare[2] ?? "" };
  throw new Error(`\u65E0\u6CD5\u8BC6\u522B\u7684 Figma \u5F15\u7528\uFF1A${s.slice(0, 100)}\uFF08\u652F\u6301 https://www.figma.com/(file|design)/<key>?node-id=<id> \u94FE\u63A5\u6216\u88F8 fileKey\uFF09`);
}
async function figmaGet(path2) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}${path2}`, {
    headers: { "X-Figma-Token": token },
    signal: AbortSignal.timeout(3e4)
  });
  if (res.status === 403) throw new Error("Figma \u62D2\u7EDD\u8BBF\u95EE\uFF08403\uFF09\uFF1Atoken \u65E0\u6548\u6216\u65E0\u8BE5\u6587\u4EF6\u6743\u9650\u3002");
  if (res.status === 404) throw new Error("Figma \u6587\u4EF6/\u8282\u70B9\u4E0D\u5B58\u5728\uFF08404\uFF09\uFF1A\u68C0\u67E5 fileKey \u4E0E nodeId\u3002");
  if (res.status === 429) throw new Error("Figma \u9650\u6D41\uFF08429\uFF09\uFF1A\u7A0D\u540E\u518D\u8BD5\u3002");
  if (!res.ok) throw new Error(`Figma API ${res.status}\uFF1A${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function fetchFigmaImages({ fileKey, nodeIds, scale = 2 }) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}/images/${encodeURIComponent(fileKey)}`, {
    method: "POST",
    headers: { "X-Figma-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: nodeIds.join(","), format: "png", scale }),
    signal: AbortSignal.timeout(3e4)
  });
  if (res.status === 403) throw new Error("Figma \u62D2\u7EDD\u8BBF\u95EE\uFF08403\uFF09\uFF1Atoken \u65E0\u6548\u6216\u65E0\u8BE5\u6587\u4EF6\u6743\u9650\u3002");
  if (res.status === 404) throw new Error("Figma \u6587\u4EF6\u4E0D\u5B58\u5728\uFF08404\uFF09\uFF1A\u68C0\u67E5 fileKey\u3002");
  if (res.status === 429) throw new Error("Figma \u9650\u6D41\uFF08429\uFF09\uFF1A\u7A0D\u540E\u518D\u8BD5\u3002");
  if (!res.ok) throw new Error(`Figma API ${res.status}\uFF1A${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.err) throw new Error(`Figma \u6E32\u67D3\u5931\u8D25\uFF1A${data.err}`);
  return data.images ?? {};
}
function extractStyles(tree, { maxNodes = 2e3 } = {}) {
  const colors = /* @__PURE__ */ new Map();
  const fontSizes = /* @__PURE__ */ new Map();
  let visited = 0;
  const walk = (node) => {
    if (!node || visited >= maxNodes) return;
    visited++;
    if (Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.visible === false || f.type !== "SOLID" || !f.color) continue;
        const hex = toHex(f.color);
        if (hex) colors.set(hex, (colors.get(hex) ?? 0) + 1);
      }
    }
    if (node.type === "TEXT") {
      const size = node.style?.fontSizePx ?? node.fontSize;
      if (size) {
        const key = String(Number(size));
        fontSizes.set(key, (fontSizes.get(key) ?? 0) + 1);
      }
    }
    for (const child2 of node.children ?? []) walk(child2);
  };
  walk(tree);
  return {
    colors: [...colors.entries()].sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count })),
    fontSizes: [...fontSizes.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([size, count]) => ({ size: Number(size), count })),
    visited
  };
}
function toHex(c) {
  if (!c) return null;
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex;
}
function distill(node, depth, maxDepth, budget) {
  if (!node || budget.count <= 0 || depth > maxDepth) return null;
  budget.count--;
  const box = node.absoluteBoundingBox ?? {};
  const out = {
    name: node.name,
    type: node.type,
    w: box.width != null ? Math.round(box.width) : void 0,
    h: box.height != null ? Math.round(box.height) : void 0
  };
  if (node.fills?.length) {
    const paints = node.fills.filter((f) => f.visible !== false && f.type === "SOLID").slice(0, 3);
    if (paints.length) out.fill = toHex(paints[0].color);
  }
  if (node.type === "TEXT") {
    out.text = node.characters?.slice(0, 200);
    const seg = node.style ?? {};
    if (seg.fontSizePx) out.fontSize = seg.fontSizePx;
    if (seg.fontWeight) out.fontWeight = seg.fontWeight;
    if (seg.fontFamily) out.fontFamily = seg.fontFamily;
    if (seg.lineHeightPx) out.lineHeight = Math.round(seg.lineHeightPx);
  }
  if (node.cornerRadius) out.radius = node.cornerRadius;
  if (node.effects?.some((e) => e.type === "DROP_SHADOW" && e.visible !== false)) out.shadow = true;
  if (node.layoutMode) {
    out.flex = `${node.layoutMode === "HORIZONTAL" ? "row" : "column"}`;
    if (node.itemSpacing) out.gap = node.itemSpacing;
    if (node.paddingLeft || node.paddingTop) {
      out.padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => v ?? 0);
    }
  }
  const kids = node.children ?? [];
  if (kids.length && depth < maxDepth) {
    const children = kids.slice(0, 40).map((k) => distill(k, depth + 1, maxDepth, budget)).filter(Boolean);
    if (children.length) out.children = children;
  } else if (kids.length) {
    out.childrenTruncated = kids.length;
  }
  return out;
}
async function fetchFigmaStructure({ fileKey, nodeId, maxDepth = 6, budgetMax = 400 }) {
  const budget = { count: budgetMax };
  if (nodeId) {
    const data2 = await figmaGet(`/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}&depth=${Math.min(maxDepth + 1, 8)}`);
    const nodes = data2.nodes ?? {};
    const entry = Object.values(nodes)[0];
    if (!entry) throw new Error(`\u672A\u627E\u5230\u8282\u70B9 ${nodeId}\u3002`);
    return {
      fileKey,
      nodeId,
      name: data2.name,
      lastModified: data2.lastModified,
      tree: distill(entry.document, 0, maxDepth, budget)
    };
  }
  const data = await figmaGet(`/files/${encodeURIComponent(fileKey)}?depth=${Math.min(maxDepth + 1, 8)}`);
  const doc = data.document;
  const pages = (doc?.children ?? []).slice(0, 8);
  return {
    fileKey,
    name: data.name,
    lastModified: data.lastModified,
    pages: pages.map((p) => ({
      name: p.name,
      id: p.id,
      tree: distill(p, 0, maxDepth, budget)
    }))
  };
}

// src/notify.ts
var NOTIFY_TIMEOUT_MS = 5e3;
function resolveNotify(project, envObj) {
  const env = envObj?.raw ?? null;
  const webhook = (env?.notifyWebhook || project?.notifyWebhook || "").trim();
  if (!webhook) return null;
  const format = (env?.notifyFormat || project?.notifyFormat || "generic").toLowerCase();
  return { webhook, format: ["feishu", "wecom", "generic"].includes(format) ? format : "generic" };
}
function buildPayload(format, info) {
  const statusZh = info.status === "ok" ? "\u2705 \u6210\u529F" : info.status === "ok-with-warnings" ? "\u26A0\uFE0F \u6210\u529F\uFF08\u672A\u7ECF\u5065\u5EB7\u68C0\u67E5\u9A8C\u8BC1\uFF09" : info.status === "aborted" ? "\u23F9 \u5DF2\u4E2D\u65AD" : `\u274C \u5931\u8D25\uFF08\u5361\u5728 ${info.failedStage ?? "?"}\uFF09`;
  const text = [
    `\u3010\u65E0\u654C\u7F16\u7A0B\u3011${info.project || "\u672A\u547D\u540D\u9879\u76EE"} \xB7 ${info.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}${info.env && info.env !== "default" ? `@${info.env}` : ""}`,
    `\u7ED3\u679C\uFF1A${statusZh}`,
    `\u7248\u672C\uFF1A${info.release ?? "?"}`,
    info.durationMs ? `\u8017\u65F6\uFF1A${(info.durationMs / 1e3).toFixed(1)}s` : "",
    info.detail ? `\u8BE6\u60C5\uFF1A${String(info.detail).slice(0, 500)}` : ""
  ].filter(Boolean).join("\n");
  if (format === "feishu") {
    return { msg_type: "text", content: { text } };
  }
  if (format === "wecom") {
    return { msgtype: "text", text: { content: text } };
  }
  return { source: "wudi-coding", ...info, statusText: statusZh, text };
}
async function sendNotify(cfg, info) {
  if (!cfg?.webhook) return { ok: false, detail: "\u672A\u914D\u7F6E\u901A\u77E5 webhook\uFF0C\u8DF3\u8FC7" };
  try {
    const body = JSON.stringify(buildPayload(cfg.format, info));
    const res = await fetch(cfg.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS)
    });
    if (!res.ok) {
      return { ok: false, detail: `webhook \u8FD4\u56DE ${res.status}` };
    }
    return { ok: true, detail: `\u5DF2\u63A8\u9001 ${cfg.format} \u901A\u77E5` };
  } catch (err) {
    return { ok: false, detail: `\u63A8\u9001\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 200)}` };
  }
}

// src/tools.ts
import http from "node:http";
import { dirname as _dirname, join as _join } from "node:path";
import { fileURLToPath as _fURL } from "node:url";
var ok = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  isError: false,
  ...structuredContent !== void 0 ? { structuredContent } : {}
});
var fail = (text) => ({ content: [{ type: "text", text }], isError: true });
var j = (v) => JSON.stringify(v, null, 2);
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
var clip = (s, n = 1500) => String(s ?? "").trim().slice(-n);
var OP_FRAME_HTML = _join(_dirname(_fURL(import.meta.url)), "..", "vendor", "openpencil", "dist", "ui", "panel.html");
var bridgeSubscribers = /* @__PURE__ */ new Set();
var bridgePort = 0;
var bridgeServer = http.createServer((req, res) => {
  if (req.url === "/openpencil/frame") {
    try {
      const html = readFileSync2(OP_FRAME_HTML, "utf-8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(`\u7F16\u8F91\u5668\u52A0\u8F7D\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
    }
    return;
  }
  if (req.url !== "/bridge") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}

`);
  bridgeSubscribers.add(res);
  req.on("close", () => bridgeSubscribers.delete(res));
});
bridgeServer.listen(0, "127.0.0.1", () => {
  bridgePort = bridgeServer.address().port;
});
function broadcastCanvasChanged() {
  for (const res of bridgeSubscribers) {
    try {
      res.write(`data: ${JSON.stringify({ type: "canvas-changed" })}

`);
    } catch {
    }
  }
}
function bridgeConnectDomains() {
  return bridgePort ? [`http://127.0.0.1:${bridgePort}`] : [];
}
function frameDomains() {
  return bridgePort ? [`http://127.0.0.1:${bridgePort}`] : [];
}
function fontCdnDomains() {
  return ["https://cdn.jsdelivr.net"];
}
var UI_META = { ui: { resourceUri: "ui://wudi-coding/panel.html", surface: "wudi", visibility: ["model", "app"] } };
var TOOLS = [
  {
    name: "wudi_project_get",
    description: "\u8BFB\u53D6\u5F53\u524D\u9879\u76EE\u7684\u65E0\u654C\u7F16\u7A0B\u6863\u6848\uFF08.wudi/project.json\uFF1A\u6280\u672F\u6808/\u6784\u5EFA\u547D\u4EE4/\u6253\u5305\u65B9\u5F0F/\u90E8\u7F72\u6839\u76EE\u5F55/\u8FDC\u7AEF\u811A\u672C/\u5065\u5EB7\u68C0\u67E5\uFF09\u3002\u6863\u6848\u4E0D\u5B58\u5728\u65F6\u8FD4\u56DE\u7F3A\u5931\u8BF4\u660E\u4E0E\u5EFA\u6863\u5B57\u6BB5\u6A21\u677F\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_project_init",
    description: "\u5EFA\u7ACB\u6216\u66F4\u65B0\u9879\u76EE\u6863\u6848\u3002\u4FE1\u606F\u4E0D\u5168\u65F6\u53EF\u53EA\u4F20\u5DF2\u6709\u5B57\u6BB5\uFF08\u6D45\u5408\u5E76\uFF0C\u4E0D\u5F71\u54CD\u5176\u4ED6\u5B57\u6BB5\uFF09\uFF1B\u7F3A\u5173\u952E\u5B57\u6BB5\uFF08build/deployRoot/healthCheck.url\uFF09\u65F6\u8FD4\u56DE\u4F53\u91CC\u4F1A\u63D0\u793A\u8FD8\u7F3A\u4EC0\u4E48\u3002\u5EFA\u8BAE\u901A\u8FC7\u4E0E\u7528\u6237\u95EE\u7B54\u6536\u96C6\u540E\u8C03\u7528\u3002",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "\u9879\u76EE\u540D\uFF08\u7528\u4E8E\u4EA7\u7269\u547D\u540D\uFF0C\u5EFA\u8BAE\u77ED\u6A2A\u7EBF\u5C0F\u5199\uFF09" },
        techStack: { type: "string", description: "\u6280\u672F\u6808\u4E00\u53E5\u8BDD\uFF0C\u5982 go-service / vite-spa / node-nest / docker-compose" },
        build: { type: "string", description: "\u672C\u5730\u6784\u5EFA\u547D\u4EE4\uFF0C\u5728\u9879\u76EE\u6839\u6267\u884C\uFF0C\u5982 npm run build" },
        packageType: { type: "string", enum: ["dir", "docker-image"], description: "\u6253\u5305\u65B9\u5F0F\uFF1Adir=\u4EA7\u7269\u76EE\u5F55\u6253 tar\uFF08\u8F6F\u94FE\u53D1\u5E03\uFF09\uFF1Bdocker-image=\u955C\u50CF tar\uFF08docker load\uFF09" },
        packagePath: { type: "string", description: "packageType=dir \u65F6\u7684\u4EA7\u7269\u76EE\u5F55\uFF08\u76F8\u5BF9\u9879\u76EE\u6839\uFF0C\u5982 dist\uFF09" },
        dockerImage: { type: "string", description: "packageType=docker-image \u65F6\u7684\u672C\u5730\u955C\u50CF\u540D\uFF0C\u5982 myapp:latest" },
        deployRoot: { type: "string", description: "\u670D\u52A1\u5668\u4E0A\u7684\u90E8\u7F72\u6839\u76EE\u5F55\uFF0C\u5982 /srv/myapp\uFF08\u5176\u4E0B releases/ \u6309\u65F6\u95F4\u6233\u653E\u7248\u672C\uFF09" },
        remoteScript: { type: "string", description: "\u7248\u672C\u5207\u6362\u540E\u5728\u670D\u52A1\u5668\u4E0A\u6267\u884C\u7684\u547D\u4EE4\uFF08cwd=deployRoot\uFF09\uFF0C\u5982 docker compose up -d\uFF1B\u9759\u6001\u7AD9\u53EF\u7559\u7A7A" },
        logCommand: { type: "string", description: "\u670D\u52A1\u65E5\u5FD7\u547D\u4EE4\uFF08wudi_deploy_logs \u7528\uFF09\uFF0C\u5982 docker compose logs --tail 200\uFF1B\u5404\u73AF\u5883\u53EF\u5728 wudi_env_set \u91CC\u8986\u76D6" },
        notifyWebhook: { type: "string", description: "\u90E8\u7F72/\u56DE\u6EDA\u7EC8\u6001\u901A\u77E5\u7684 webhook URL\uFF08\u98DE\u4E66\u673A\u5668\u4EBA\u3001\u4F01\u5FAE\u673A\u5668\u4EBA\u6216\u901A\u7528\u63A5\u6536\u5668\uFF09\uFF1B\u5404\u73AF\u5883\u53EF\u8986\u76D6" },
        notifyFormat: { type: "string", enum: ["feishu", "wecom", "generic"], description: "\u901A\u77E5\u62A5\u6587\u683C\u5F0F\uFF0C\u7F3A\u7701 generic" },
        confirmWord: { type: "string", description: "\u90E8\u7F72\u786E\u8BA4\u8BCD\uFF08\u5982\u7ED9 prod \u914D\uFF09\uFF1A\u8BBE\u7F6E\u540E wudi_deploy \u5BF9\u8BE5\u73AF\u5883\u5FC5\u987B\u4F20\u5339\u914D\u7684 confirmWord \u624D\u6267\u884C\uFF1B\u5404\u73AF\u5883\u53EF\u8986\u76D6" },
        deployPolicy: { type: "string", enum: ["confirm", "direct"], description: "\u90E8\u7F72\u5BA1\u6279\u7B56\u7565\uFF1Aconfirm=\u4E24\u6B65\u6D41\uFF08\u9884\u68C0\u2192\u786E\u8BA4\uFF0C\u9ED8\u8BA4\uFF09\uFF1Bdirect=\u4E00\u952E\u76F4\u53D1\uFF08\u9762\u677F\u8DF3\u8FC7\u786E\u8BA4\u5BF9\u8BDD\u6846\uFF0C\u5BBF\u4E3B\u5BA1\u6279\u515C\u5E95\uFF1B\u5EFA\u8BAE\u53EA\u7ED9 staging \u7528\uFF09\u3002\u5404\u73AF\u5883\u53EF\u8986\u76D6" },
        defaultEnv: { type: "string", description: "\u9ED8\u8BA4\u73AF\u5883\u540D\uFF08\u591A\u73AF\u5883\u65F6\u7528\uFF09" },
        remoteWhitelist: { type: "string", description: "\u9017\u53F7\u5206\u9694\u7684\u8FDC\u7AEF\u547D\u4EE4\u767D\u540D\u5355\u524D\u7F00\uFF0C\u4F9B wudi_remote_exec \u6821\u9A8C\uFF0C\u5982 docker compose,df -h,journalctl" },
        healthCheckUrl: { type: "string", description: "\u5065\u5EB7\u68C0\u67E5 URL\uFF08\u9ED8\u8BA4\u5728\u670D\u52A1\u5668\u672C\u673A curl\uFF09" },
        healthExpect: { type: "number", description: "\u671F\u671B HTTP \u72B6\u6001\u7801\uFF0C\u9ED8\u8BA4 200" },
        healthCheckFrom: { type: "string", enum: ["remote", "local"], description: "\u5065\u5EB7\u68C0\u67E5\u6267\u884C\u4F4D\u7F6E\uFF1Aremote=\u670D\u52A1\u5668\u4E0A curl\uFF08\u9ED8\u8BA4\uFF0C\u9002\u5408 localhost \u5730\u5740\uFF09\uFF1Blocal=\u672C\u673A fetch\uFF08\u9002\u5408\u516C\u7F51\u57DF\u540D\uFF09" },
        notes: { type: "string", description: "\u5907\u6CE8\uFF08\u73AF\u5883\u53D8\u91CF\u6E05\u5355\u3001\u6CE8\u610F\u4E8B\u9879\u7B49\uFF09" }
      }
    }
  },
  {
    name: "wudi_projects_list",
    description: "\u9879\u76EE\u6CE8\u518C\u8868\uFF1A\u5217\u51FA\u6240\u6709\u5DF2\u767B\u8BB0\u9879\u76EE\uFF08\u81EA\u52A8\u542B\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09\u53CA\u5404\u81EA\u6982\u89C8\u2014\u2014\u6280\u672F\u6808\u3001\u73AF\u5883\u3001\u6700\u8FD1\u90E8\u7F72\u3001\u6587\u6863/\u8BBE\u8BA1\u4EA7\u7269\u6570\u3002\u9879\u76EE\u7BA1\u7406 landing \u7684\u6570\u636E\u6E90\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_projects_add",
    description: "\u628A\u4E00\u4E2A\u9879\u76EE\u6839\u76EE\u5F55\u767B\u8BB0\u8FDB\u9879\u76EE\u6CE8\u518C\u8868\uFF08\u6309 path \u53BB\u91CD\uFF1B\u767B\u8BB0\u540E\u53EF\u5728\u5DE5\u4F5C\u53F0\u9762\u677F\u7EDF\u4E00\u7BA1\u7406\uFF0C\u6982\u89C8\u53EA\u8BFB\uFF0C\u90E8\u7F72\u64CD\u4F5C\u4ECD\u9700\u5728\u8BE5\u9879\u76EE\u5DE5\u4F5C\u533A\u8FDB\u884C\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "\u9879\u76EE\u6839\u76EE\u5F55\u7EDD\u5BF9\u8DEF\u5F84" },
        name: { type: "string", description: "\u663E\u793A\u540D\uFF0C\u7F3A\u7701\u53D6\u76EE\u5F55\u540D" }
      },
      required: ["path"]
    }
  },
  {
    name: "wudi_projects_remove",
    description: "\u4ECE\u9879\u76EE\u6CE8\u518C\u8868\u79FB\u9664\u4E00\u4E2A\u9879\u76EE\uFF08\u53EA\u79FB\u9664\u767B\u8BB0\uFF0C\u4E0D\u5220\u9879\u76EE\u6587\u4EF6\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "\u9879\u76EE id\uFF08wudi_projects_list \u91CC\u53D6\uFF09" } },
      required: ["id"]
    }
  },
  {
    name: "wudi_status",
    description: "\u9879\u76EE\u5168\u666F\uFF1A\u6863\u6848\u6458\u8981\uFF08\u542B\u73AF\u5883\u5217\u8868\u4E0E\u5F53\u524D\u73AF\u5883\u89E3\u6790\u7ED3\u679C\uFF09+ \u6700\u8FD1\u90E8\u7F72 + \u6587\u6863\u6E05\u5355 + SSH \u914D\u7F6E\u72B6\u6001\u3002/wudi \u547D\u4EE4\u4E0E\u5DE5\u4F5C\u53F0\u9762\u677F\u7684\u6570\u636E\u6E90\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D\uFF1B\u6863\u6848\u914D\u7F6E\u4E86\u591A\u4E2A\u73AF\u5883\u65F6\u7F3A\u7701\u7528 defaultEnv/\u7B2C\u4E00\u4E2A" },
        deployLimit: { type: "number", description: "\u8FD4\u56DE\u6700\u8FD1\u51E0\u6B21\u90E8\u7F72\uFF0C\u9ED8\u8BA4 5" }
      }
    }
  },
  {
    name: "wudi_docs_register",
    description: "\u767B\u8BB0/\u66F4\u65B0\u4E00\u4EFD\u9879\u76EE\u6587\u6863\u5230 .wudi/docs.json\uFF08\u5DE5\u4F5C\u53F0\u6587\u6863\u5E93\u53EF\u89C1\uFF09\u3002path \u76F8\u5BF9\u9879\u76EE\u6839\u3002",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "\u6587\u6863\u76F8\u5BF9\u9879\u76EE\u6839\u8DEF\u5F84\uFF0C\u5982 docs/api.md" },
        type: { type: "string", description: "\u6587\u6863\u7C7B\u578B\uFF1Areadme/api/prd/runbook/changelog/architecture/doc" },
        title: { type: "string", description: "\u6807\u9898\uFF0C\u7F3A\u7701\u7528\u8DEF\u5F84" },
        source: { type: "string", description: "\u751F\u6210\u6765\u6E90\u8BF4\u660E\uFF0C\u5982 route scan / git log" }
      },
      required: ["path"]
    }
  },
  {
    name: "wudi_ssh_ping",
    description: "\u6D4B\u8BD5 SSH \u76EE\u6807\u8FDE\u901A\u6027\uFF08\u53EF\u6309\u73AF\u5883\u8986\u76D6 host/port/user\uFF09\uFF0C\u8FD4\u56DE\u5EF6\u8FDF\u3002\u90E8\u7F72/\u9762\u677F\u73AF\u5883\u72B6\u6001\u68C0\u67E5\u7528\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D\uFF1B\u73AF\u5883\u914D\u7F6E\u4E86 sshHost/sshPort/sshUser \u8986\u76D6\u65F6\u6309\u8BE5\u73AF\u5883\u6D4B\u8BD5" }
      }
    }
  },
  {
    name: "wudi_deploy",
    description: "\u6267\u884C\u4E94\u9636\u6BB5\u90E8\u7F72\u6D41\u6C34\u7EBF\uFF1Abuild \u2192 package \u2192 upload \u2192 remote\uFF08\u8F6F\u94FE/\u955C\u50CF\u5207\u6362\uFF09\u2192 verify\uFF08\u5065\u5EB7\u68C0\u67E5\uFF09\u3002confirm=false \u65F6\u53EA\u8FD4\u56DE\u6267\u884C\u8BA1\u5212\uFF08\u9884\u68C0\uFF09\uFF1Bconfirm=true \u624D\u771F\u6B63\u6267\u884C\u3002\u652F\u6301 env \u53C2\u6570\u9009\u62E9\u76EE\u6807\u73AF\u5883\uFF08staging/prod \u7B49\uFF09\u3002\u76EE\u6807\u73AF\u5883\u914D\u7F6E\u4E86 confirmWord \u65F6\u5FC5\u987B\u540C\u65F6\u4F20\u5165\u5339\u914D\u7684 confirmWord\uFF08\u751F\u4EA7\u73AF\u5883\u4E8C\u6B21\u786E\u8BA4\uFF09\u3002\u6BCF\u6B21\u90E8\u7F72\u81EA\u52A8\u5199\u5165 .wudi/deploys.json \u5386\u53F2\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D\uFF08\u6863\u6848 envs \u91CC\u7684\u4E00\u4E2A\uFF09\uFF1B\u672A\u914D\u7F6E\u591A\u73AF\u5883\u65F6\u53EF\u7701\u7565" },
        confirm: { type: "boolean", description: "\u662F\u5426\u771F\u6B63\u6267\u884C\u3002false=\u53EA\u51FA\u9884\u68C0\u8BA1\u5212\uFF08\u9ED8\u8BA4\uFF09" },
        confirmWord: { type: "string", description: "\u786E\u8BA4\u8BCD\uFF1A\u76EE\u6807\u73AF\u5883/\u6863\u6848\u914D\u7F6E\u4E86 confirmWord \u65F6\u5FC5\u4F20\u4E14\u5FC5\u987B\u4E00\u81F4" },
        skipBuild: { type: "boolean", description: "\u8DF3\u8FC7 build \u9636\u6BB5\uFF08\u4EA7\u7269\u5DF2\u5C31\u7EEA\u65F6\uFF09" },
        pruneOld: { type: "boolean", description: "\u90E8\u7F72\u6210\u529F\u540E\u6E05\u7406\u8BE5\u73AF\u5883\u670D\u52A1\u5668\u65E7\u7248\u672C\uFF0C\u4EC5\u4FDD\u7559\u6700\u8FD1 5 \u4E2A\uFF08\u53EA\u5220\u65F6\u95F4\u6233\u547D\u540D\u7684\u76EE\u5F55\uFF0C\u5148\u5217\u540E\u5220\u5E76\u6C47\u62A5\uFF09" }
      }
    }
  },
  {
    name: "wudi_deploy_history",
    description: "\u67E5\u8BE2\u90E8\u7F72\u5386\u53F2\uFF08.wudi/deploys.json\uFF09\uFF0C\u542B\u6BCF\u6B21\u7684\u9636\u6BB5\u660E\u7EC6\u4E0E\u7ED3\u679C\u3002\u53EF\u6309\u73AF\u5883\u8FC7\u6EE4\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u53EA\u770B\u67D0\u4E2A\u73AF\u5883\u7684\u8BB0\u5F55" },
        limit: { type: "number", description: "\u8FD4\u56DE\u6761\u6570\uFF0C\u9ED8\u8BA4 10\uFF0C\u6700\u5927 50" }
      }
    }
  },
  {
    name: "wudi_rollback",
    description: "\u56DE\u6EDA\u5230\u5386\u53F2\u7248\u672C\uFF08\u8F6F\u94FE\u6A21\u5F0F\uFF1A\u5207 current \u8F6F\u94FE + \u6267\u884C remoteScript + \u5065\u5EB7\u68C0\u67E5\uFF09\u3002docker-image \u9879\u76EE\u4E0D\u652F\u6301\u8F6F\u94FE\u56DE\u6EDA\uFF0C\u8FD4\u56DE\u6307\u5F15\uFF08\u7528\u672C\u5730\u4FDD\u7559\u7684\u65E7 artifact \u91CD\u65B0\u90E8\u7F72\uFF09\u3002confirm=false \u65F6\u53EA\u8FD4\u56DE\u56DE\u6EDA\u8BA1\u5212\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D" },
        target: { type: "string", description: "\u76EE\u6807\u7248\u672C\u65F6\u95F4\u6233\uFF08yyyymmdd-hhmmss\uFF09\uFF0C\u7F3A\u7701=\u5F53\u524D\u7248\u672C\u7684\u4E0A\u4E00\u7248" },
        confirm: { type: "boolean", description: "\u662F\u5426\u771F\u6B63\u6267\u884C\u3002false=\u53EA\u51FA\u8BA1\u5212\uFF08\u9ED8\u8BA4\uFF09" }
      }
    }
  },
  {
    name: "wudi_health_check",
    description: "\u53EA\u505A\u5065\u5EB7\u68C0\u67E5\uFF1A\u6309\u6863\u6848 healthCheck \u914D\u7F6E\uFF08\u53EF\u6309\u73AF\u5883\uFF09\u91CD\u8BD5 3 \u6B21\uFF08\u95F4\u9694 5 \u79D2\uFF09\uFF0C\u8FD4\u56DE\u6BCF\u6B21\u7ED3\u679C\uFF1B\u5931\u8D25\u65F6\u7ED9\u51FA\u6392\u67E5\u5EFA\u8BAE\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D" }
      }
    }
  },
  {
    name: "wudi_remote_exec",
    description: "\u5728\u670D\u52A1\u5668\u4E0A\u6267\u884C\u767D\u540D\u5355\u5185\u7684\u547D\u4EE4\uFF08\u6863\u6848 remoteWhitelist \u524D\u7F00\u5339\u914D\uFF1B\u767D\u540D\u5355\u4E3A\u7A7A\u5219\u62D2\u7EDD\uFF09\u3002confirm \u5FC5\u987B true\u3002\u7528\u4E8E\u67E5\u65E5\u5FD7\u3001\u770B\u78C1\u76D8\u7B49\u6392\u67E5\u52A8\u4F5C\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D" },
        command: { type: "string", description: "\u8981\u6267\u884C\u7684\u5355\u6761 shell \u547D\u4EE4" },
        confirm: { type: "boolean", description: "\u5FC5\u987B\u4E3A true \u624D\u6267\u884C" },
        timeoutSec: { type: "number", description: "\u8D85\u65F6\u79D2\u6570\uFF0C\u9ED8\u8BA4 60\uFF0C\u6700\u5927 600" }
      },
      required: ["command"]
    }
  },
  {
    name: "wudi_deploy_logs",
    description: "\u62C9\u53D6\u76EE\u6807\u73AF\u5883\u7684\u670D\u52A1\u65E5\u5FD7\uFF08\u53EA\u8BFB\uFF09\uFF1A\u6309\u6863\u6848\u7684 logCommand \u6267\u884C\uFF08\u5982 docker compose logs --tail 200\uFF09\u3002logCommand \u672A\u914D\u7F6E\u65F6\u8FD4\u56DE\u8BBE\u7F6E\u6307\u5F15\u3002\u7B49\u4EF7\u4E8E remote_exec \u4F46\u514D\u767D\u540D\u5355\u3001\u514D confirm\uFF08\u547D\u4EE4\u6765\u81EA\u9879\u76EE\u6863\u6848\u672C\u8EAB\uFF0C\u53EA\u8BFB\u7528\u9014\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D" }
      }
    }
  },
  {
    name: "wudi_env_set",
    description: "\u65B0\u589E/\u66F4\u65B0/\u5220\u9664\u4E00\u4E2A\u90E8\u7F72\u73AF\u5883\uFF08\u6863\u6848 envs \u6570\u7EC4\uFF09\u3002\u81F3\u5C11\u7ED9 name\uFF1B\u5B57\u6BB5\u7F3A\u7701\u56DE\u843D\u9876\u5C42\u6863\u6848\u503C\u3002\u5E38\u7528\uFF1Astaging \u4E0E prod \u5404\u6307\u5411\u4E0D\u540C deployRoot/healthCheckUrl\uFF0C\u5FC5\u8981\u65F6\u7528 sshHost/sshPort/sshUser \u8986\u76D6\u76EE\u6807\u673A\u5668\u3002",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "\u73AF\u5883\u540D\uFF0C\u5982 staging / prod" },
        deployRoot: { type: "string", description: "\u8BE5\u73AF\u5883\u7684\u90E8\u7F72\u6839\u76EE\u5F55\uFF08\u8986\u76D6\u9876\u5C42\uFF09" },
        remoteScript: { type: "string", description: "\u8BE5\u73AF\u5883\u7684\u5207\u6362\u540E\u547D\u4EE4\uFF08\u8986\u76D6\u9876\u5C42\uFF09" },
        healthCheckUrl: { type: "string", description: "\u8BE5\u73AF\u5883\u7684\u5065\u5EB7\u68C0\u67E5 URL\uFF08\u8986\u76D6\u9876\u5C42\uFF09" },
        healthExpect: { type: "number", description: "\u8BE5\u73AF\u5883\u7684\u671F\u671B\u72B6\u6001\u7801" },
        healthCheckFrom: { type: "string", enum: ["remote", "local"], description: "\u8BE5\u73AF\u5883\u7684\u68C0\u67E5\u4F4D\u7F6E" },
        logCommand: { type: "string", description: "\u8BE5\u73AF\u5883\u7684\u670D\u52A1\u65E5\u5FD7\u547D\u4EE4\uFF0C\u5982 docker compose logs --tail 200" },
        sshHost: { type: "string", description: "\u8BE5\u73AF\u5883\u72EC\u7ACB\u7684\u670D\u52A1\u5668\u5730\u5740\uFF08\u8986\u76D6\u63D2\u4EF6\u5168\u5C40\u8BBE\u7F6E\uFF09" },
        sshPort: { type: "string", description: "\u8BE5\u73AF\u5883\u72EC\u7ACB\u7AEF\u53E3" },
        sshUser: { type: "string", description: "\u8BE5\u73AF\u5883\u72EC\u7ACB\u7528\u6237" },
        notifyWebhook: { type: "string", description: "\u8BE5\u73AF\u5883\u72EC\u7ACB\u7684\u90E8\u7F72\u901A\u77E5 webhook\uFF08\u8986\u76D6\u9876\u5C42\uFF09" },
        notifyFormat: { type: "string", enum: ["feishu", "wecom", "generic"], description: "\u8BE5\u73AF\u5883\u7684\u901A\u77E5\u683C\u5F0F" },
        confirmWord: { type: "string", description: "\u8BE5\u73AF\u5883\u7684\u90E8\u7F72\u786E\u8BA4\u8BCD\uFF08\u8986\u76D6\u9876\u5C42\uFF1B\u6E05\u7A7A\u4F20\u7A7A\u5B57\u7B26\u4E32\uFF09" },
        deployPolicy: { type: "string", enum: ["confirm", "direct"], description: "\u8BE5\u73AF\u5883\u7684\u90E8\u7F72\u5BA1\u6279\u7B56\u7565\uFF08\u8986\u76D6\u9876\u5C42\uFF1Bdirect \u5EFA\u8BAE\u53EA\u7ED9 staging\uFF09" },
        setDefault: { type: "boolean", description: "\u540C\u65F6\u628A\u6863\u6848 defaultEnv \u8BBE\u4E3A\u8BE5\u73AF\u5883" },
        remove: { type: "boolean", description: "\u5220\u9664\u8BE5\u73AF\u5883\uFF08\u5FFD\u7565\u5176\u4ED6\u5B57\u6BB5\uFF09" }
      },
      required: ["name"]
    }
  },
  {
    name: "wudi_doctor",
    description: "\u4E00\u952E\u4F53\u68C0\uFF1A\u6863\u6848\u5B8C\u6574\u6027\u3001SSH \u8FDE\u901A\u3001\u8FDC\u7AEF\u78C1\u76D8/\u5185\u5B58\u3001releases \u6570\u91CF\u4E0E current \u8F6F\u94FE\u3001\u5065\u5EB7\u68C0\u67E5\u5355\u6B21\u5FEB\u6D4B\u3001\u901A\u77E5\u914D\u7F6E\u3002\u6BCF\u9879\u72EC\u7ACB\u5224 PASS/WARN/FAIL \u5E76\u7ED9\u51FA\u6C47\u603B\uFF0C\u4EFB\u4F55\u5355\u9879\u5931\u8D25\u4E0D\u5F71\u54CD\u5176\u4F59\u68C0\u67E5\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D" }
      }
    }
  },
  {
    name: "wudi_design_tokens_export",
    description: "\u628A design tokens \u5BFC\u51FA\u4E3A\u6307\u5B9A\u683C\u5F0F\uFF1Acss\uFF08\u53D8\u91CF\u6587\u4EF6\uFF09\u3001tailwind\uFF08tailwind.config.js \u7684 theme.extend \u7247\u6BB5\uFF09\u3001json\u3002\u843D\u76D8\u5230 .wudi/design/exports/ \u5E76\u8FD4\u56DE\u5185\u5BB9\u3002",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["css", "tailwind", "json"], description: "\u5BFC\u51FA\u683C\u5F0F\uFF0C\u9ED8\u8BA4 css" }
      }
    }
  },
  {
    name: "wudi_notify_test",
    description: "\u53D1\u9001\u4E00\u6761\u6D4B\u8BD5\u901A\u77E5\u9A8C\u8BC1 webhook \u914D\u7F6E\uFF08\u6863\u6848 notifyWebhook/notifyFormat\uFF0C\u53EF\u6309\u73AF\u5883\u8986\u76D6\uFF09\u3002\u672A\u914D\u7F6E\u65F6\u8FD4\u56DE\u8BBE\u7F6E\u6307\u5F15\u3002",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D\uFF08\u7528\u8BE5\u73AF\u5883\u7684\u901A\u77E5\u8986\u76D6\u914D\u7F6E\uFF09" }
      }
    }
  },
  {
    name: "wudi_docs_weekly",
    description: "\u4ECE git log \u751F\u6210\u5468\u62A5\u8349\u7A3F\uFF08\u9ED8\u8BA4\u8FD1 7 \u5929\uFF1A\u6982\u89C8\u7EDF\u8BA1 + \u9010\u65E5 commit \u6E05\u5355 + \u5F85\u8865\u5145\u4E8B\u9879\u9AA8\u67B6\uFF09\uFF0C\u5199\u5165 docs/weekly/ \u5E76\u81EA\u52A8\u767B\u8BB0\u5230\u6587\u6863\u5E93\u3002\u9879\u76EE\u4E0D\u662F git \u4ED3\u5E93\u65F6\u8FD4\u56DE\u8BF4\u660E\u3002",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "\u7EDF\u8BA1\u6700\u8FD1\u51E0\u5929\uFF0C\u9ED8\u8BA4 7" },
        author: { type: "string", description: "\u53EA\u7EDF\u8BA1\u8BE5\u4F5C\u8005\uFF08git author \u540D\uFF0C\u53EF\u9009\uFF09" }
      }
    }
  },
  {
    name: "wudi_figma_fetch",
    description: "\uFF08\u53EF\u9009\u80FD\u529B\uFF09\u62C9\u53D6 Figma \u6587\u4EF6/\u8282\u70B9\u7684\u7ED3\u6784\u4E0E\u6837\u5F0F\u63D0\u70BC\uFF08\u5E03\u5C40\u3001\u989C\u8272 hex\u3001\u5B57\u53F7\u3001\u6587\u672C\u3001flex/gap/padding\uFF09\uFF0C\u4F9B UI \u8BBE\u8BA1 tokens \u63D0\u53D6\u4E0E\u8BBE\u8BA1\u8F6C\u4EE3\u7801\u3002\u9700\u5728\u63D2\u4EF6\u8BBE\u7F6E\u914D\u7F6E figmaToken\uFF1B\u672A\u914D\u7F6E\u65F6\u8FD4\u56DE\u542F\u7528\u6307\u5F15\u3002",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma \u94FE\u63A5\uFF08https://www.figma.com/file/...?node-id=1-2\uFF09\u6216\u88F8 fileKey\u3002\u5E26 node-id \u62C9\u53D6\u8BE5\u8282\u70B9\u5B50\u6811\uFF0C\u4E0D\u5E26\u5219\u5217\u51FA\u9875\u9762\u7EA7\u6982\u89C8" },
        maxDepth: { type: "number", description: "\u63D0\u70BC\u6811\u6700\u5927\u6DF1\u5EA6\uFF0C\u9ED8\u8BA4 6" },
        budgetMax: { type: "number", description: "\u6700\u591A\u63D0\u70BC\u7684\u8282\u70B9\u6570\uFF0C\u9ED8\u8BA4 400\uFF08\u8D85\u5927\u6587\u4EF6\u9632\u7206\u56DE\u590D\uFF09" }
      },
      required: ["ref"]
    }
  },
  {
    name: "wudi_figma_images",
    description: "\uFF08\u53EF\u9009\u80FD\u529B\uFF09\u628A Figma \u8282\u70B9\u6E32\u67D3\u6210 PNG \u4E0B\u8F7D\u5230 .wudi/design/figma/\uFF0C\u8FD4\u56DE\u672C\u5730\u8DEF\u5F84\u6E05\u5355\u4F9B\u4E0E\u5B9E\u73B0\u622A\u56FE\u505A\u89C6\u89C9\u6BD4\u5BF9\u3002\u9700\u914D\u7F6E figmaToken\uFF1BnodeIds \u7F3A\u7701\u65F6\u8FD4\u56DE\u7528\u6CD5\u6307\u5F15\u3002",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma \u94FE\u63A5\u6216\u88F8 fileKey\uFF08\u540C wudi_figma_fetch\uFF09" },
        nodeIds: { type: "string", description: "\u8282\u70B9 id\uFF0C\u9017\u53F7\u5206\u9694\uFF08\u5982 12:34,12:35\uFF1B\u6765\u81EA wudi_figma_fetch \u7684\u7ED3\u6784\uFF09" },
        scale: { type: "number", description: "\u5BFC\u51FA\u500D\u7387\uFF0C\u9ED8\u8BA4 2\uFF080.01~4\uFF09" }
      },
      required: ["ref", "nodeIds"]
    }
  },
  {
    name: "wudi_figma_tokens_diff",
    description: "\uFF08\u53EF\u9009\u80FD\u529B\uFF09\u62C9\u53D6 Figma \u753B\u677F\u6837\u5F0F\u5E76\u4E0E\u672C\u5730 design tokens \u6BD4\u5BF9\uFF1A\u62A5\u544A\u8BBE\u8BA1\u7A3F\u51FA\u73B0\u4F46 tokens \u7F3A\u5931\u7684\u989C\u8272/\u5B57\u53F7\u3001tokens \u4E2D\u5B58\u5728\u4F46\u8BBE\u8BA1\u7A3F\u672A\u4F7F\u7528\u7684\u9879\u3002\u53EA\u51FA\u62A5\u544A\u4E0D\u81EA\u52A8\u6539 tokens\u3002\u9700\u914D\u7F6E figmaToken\uFF1B\u672C\u5730\u65E0 tokens \u65F6\u63D0\u793A\u5148\u5EFA\u3002",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma \u94FE\u63A5\u6216\u88F8 fileKey\uFF1B\u5F3A\u70C8\u5EFA\u8BAE\u5E26 node-id \u6307\u5411\u5B9A\u7A3F\u753B\u677F\uFF08\u4E0D\u5E26\u5219\u626B\u6574\u4E2A\u6587\u4EF6\u7684\u9875\u9762\u7EA7\u8282\u70B9\uFF0C\u566A\u58F0\u5927\uFF09" },
        maxDepth: { type: "number", description: "\u63D0\u53D6\u6811\u6700\u5927\u6DF1\u5EA6\uFF0C\u9ED8\u8BA4 8" }
      },
      required: ["ref"]
    }
  },
  {
    name: "wudi_canvas_bridge",
    description: "\u83B7\u53D6\u8BBE\u8BA1\u753B\u5E03\u5B9E\u65F6\u534F\u540C\u6865\u7AEF\u70B9\uFF08SSE\uFF09\u3002\u9762\u677F\u901A\u8FC7\u5B83\u8BA2\u9605\u753B\u5E03\u53D8\u66F4\u5B9E\u73B0 Agent\u2194\u7528\u6237\u5B9E\u65F6\u534F\u540C\uFF1B\u4E00\u822C\u65E0\u9700\u4E3B\u52A8\u8C03\u7528\uFF0C\u9762\u677F\u542F\u52A8\u65F6\u81EA\u52A8\u8FDE\u63A5\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_canvas_get",
    description: "\u8BFB\u53D6\u8BBE\u8BA1\u753B\u5E03\uFF08.wudi/design/canvas.json \u7684\u5F62\u72B6\u5217\u8868\uFF09\u3002\u753B\u5E03\u662F Agent \u53EF\u76F4\u63A5\u64CD\u4F5C\u7684\u8BBE\u8BA1\u753B\u677F\uFF1A\u7EBF\u6846\u3001\u6D41\u7A0B\u3001\u5E03\u5C40\u8349\u56FE\u5148\u753B\u5728\u8FD9\uFF0C\u518D\u5BFC\u51FA\u4E3A\u8BBE\u8BA1\u7A3F\u3002",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_canvas_edit",
    description: "\u7F16\u8F91\u8BBE\u8BA1\u753B\u5E03\uFF08Figma \u5F0F\u65E0\u9650\u753B\u5E03 + \u591A\u753B\u677F\uFF0C\u6279\u91CF\u64CD\u4F5C\uFF09\u3002ops \u6BCF\u9879\uFF1A{op:'add', shape:{type,x,y,w,h,fill,stroke,text,fontSize,frameId}} / {op:'update', id, patch} / {op:'delete', ids} / {op:'add_frame', frame:{name,x,y,w,h,background}} / {op:'update_frame', id, patch} / {op:'delete_frame', id, withShapes}\u3002type: rect/ellipse/diamond/arrow/text\uFF1B\u5F62\u72B6\u5E26 frameId \u5F52\u5165\u753B\u677F\u3002\u6BCF\u4E2A UI \u8BBE\u8BA1\u5EFA\u8BAE\u4E00\u4E2A\u753B\u677F\uFF08\u5982 \u9996\u9875-1440\u3001\u8BE6\u60C5-375\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          description: "\u6279\u91CF\u64CD\u4F5C\u6570\u7EC4\uFF0C\u6309\u987A\u5E8F\u6267\u884C",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "update", "delete", "add_frame", "update_frame", "delete_frame"] },
              shape: { type: "object", description: "op=add \u65F6\u7684\u5F62\u72B6" },
              id: { type: "string", description: "op=update/delete/update_frame/delete_frame \u7684\u76EE\u6807 id" },
              patch: { type: "object", description: "op=update \u7684\u5B57\u6BB5\u8865\u4E01" },
              ids: { type: "array", items: { type: "string" }, description: "op=delete \u7684 id \u5217\u8868" },
              frame: { type: "object", description: "op=add_frame \u65F6\u7684\u753B\u677F\uFF08name/x/y/w/h\uFF0C\u9884\u8BBE\uFF1A\u684C\u9762 1440x900\u3001\u79FB\u52A8 375x812\uFF09" },
              withShapes: { type: "boolean", description: "op=delete_frame \u65F6\u662F\u5426\u8FDE\u540C\u5F62\u72B6\u5220\u9664" }
            },
            required: ["op"]
          }
        }
      },
      required: ["ops"]
    }
  },
  {
    name: "wudi_canvas_clear",
    description: "\u6E05\u7A7A\u8BBE\u8BA1\u753B\u5E03\uFF08confirm \u5FC5\u987B true\uFF1B\u5EFA\u8BAE\u5148 wudi_canvas_get \u5C55\u793A\u73B0\u72B6\u5F81\u5F97\u540C\u610F\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: { confirm: { type: "boolean", description: "\u5FC5\u987B\u4E3A true" } }
    }
  },
  {
    name: "wudi_canvas_export",
    description: "\u5BFC\u51FA\u8BBE\u8BA1\u753B\u5E03\u3002format=html\uFF08\u9ED8\u8BA4\uFF09\uFF1ASVG \u8BBE\u8BA1\u7A3F HTML \u843D\u5230 mockups/\uFF0C\u8FDB\u9762\u677F\u56FE\u5E93\uFF1Bformat=excalidraw\uFF1A.excalidraw \u573A\u666F\u6587\u4EF6\u843D .wudi/design/canvas/\uFF0C\u968F\u540E\u53EF\u8BA9 Agent \u8C03\u5B98\u65B9 Excalidraw \u63D2\u4EF6\u7684 open_diagram \u5BFC\u5165\uFF0C\u5728\u5B8C\u6574\u7EA7\u767D\u677F\u4E2D\u7EE7\u7EED\u7F16\u8F91\uFF1Bformat=both \u4E24\u8005\u90FD\u8981\u3002",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "\u8BBE\u8BA1\u7A3F\u6587\u4EF6\u540D\uFF08\u4E0D\u542B\u6269\u5C55\u540D\uFF0C\u5982 app-wireframe-v1\uFF09" },
        format: { type: "string", enum: ["html", "excalidraw", "both"], description: "\u5BFC\u51FA\u683C\u5F0F\uFF0C\u9ED8\u8BA4 html" }
      },
      required: ["name"]
    }
  },
  {
    name: "wudi_tokens_compare",
    description: "\u6BD4\u5BF9\u4E00\u7EC4\u5916\u90E8 tokens\uFF08\u5982 OpenPencil design_to_tokens \u7684\u8F93\u51FA\u3001Figma \u53D8\u91CF\u5BFC\u51FA\uFF09\u4E0E\u5F53\u524D design tokens\uFF1A\u6309\u6241\u5E73\u952E\u8DEF\u5F84\u62A5\u544A \u65B0\u589E/\u53D8\u66F4/\u79FB\u9664 \u4E09\u6E05\u5355\u3002\u53EA\u51FA\u62A5\u544A\u4E0D\u6539\u672C\u5730\uFF1B\u786E\u8BA4\u5408\u5E76\u540E\u7528 wudi_design_tokens_set \u6574\u4F53\u5199\u5165\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        tokens: { type: "object", description: "\u5916\u90E8 tokens \u5BF9\u8C61\uFF08\u7ED3\u6784\u4E0E wudi tokens \u4E00\u81F4\uFF1Acolor/spacing/... \u5206\u7EC4\uFF09" },
        json: { type: "string", description: "tokens \u7684 JSON \u5B57\u7B26\u4E32\uFF08\u4E0E tokens \u4E8C\u9009\u4E00\uFF09" }
      }
    }
  },
  {
    name: "wudi_designs_list",
    description: "\u5217\u51FA\u5DE5\u4F5C\u533A designs/ \u76EE\u5F55\u4E0B\u7684 .fig/.pen \u8BBE\u8BA1\u7A3F\u6587\u4EF6\uFF08\u540D\u79F0\u3001\u5927\u5C0F\u3001\u4FEE\u6539\u65F6\u95F4\uFF09\u3002\u914D\u5408 OpenPencil \u63D2\u4EF6\uFF1AAgent \u53EF\u7528 open_design \u6253\u5F00\u534F\u540C\u7F16\u8F91\u3001export_image \u6E32\u67D3 PNG \u5230 .wudi/design/renders/ \u8FDB\u9762\u677F\u56FE\u5899\u3002",
    _meta: UI_META,
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_design_delete",
    description: "\u5220\u9664\u5DE5\u4F5C\u533A designs/ \u76EE\u5F55\u4E0B\u7684\u8BBE\u8BA1\u7A3F\u6587\u4EF6\uFF08.fig/.pen\uFF09\u3002\u4EC5\u5141\u8BB8 designs/ \u76EE\u5F55\u5185\u7684\u6587\u4EF6\uFF1B\u82E5\u7F16\u8F91\u5668\u6B63\u6253\u5F00\u8BE5\u8BBE\u8BA1\u7A3F\uFF0C\u5EFA\u8BAE\u5148\u5173\u95ED\u518D\u5220\u9664\u3002",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF0C\u5982 designs/old.fig" } },
      required: ["path"]
    }
  },
  {
    name: "wudi_design_rename",
    description: "\u91CD\u547D\u540D\u5DE5\u4F5C\u533A designs/ \u76EE\u5F55\u4E0B\u7684\u8BBE\u8BA1\u7A3F\u6587\u4EF6\uFF08.fig/.pen\uFF09\u3002\u4EC5\u5141\u8BB8 designs/ \u76EE\u5F55\u5185\u64CD\u4F5C\uFF1B\u76EE\u6807\u540D\u5DF2\u5B58\u5728\u65F6\u62D2\u7EDD\u3002",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "\u73B0\u6709\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF0C\u5982 designs/old.fig" },
        name: { type: "string", description: "\u65B0\u6587\u4EF6\u540D\uFF0C\u5982 new.fig\uFF08\u4E0D\u542B\u76EE\u5F55\uFF09" }
      },
      required: ["path", "name"]
    }
  },
  {
    name: "wudi_figma_link",
    description: "\u8BB0\u4F4F/\u67E5\u770B\u9879\u76EE\u7684 Figma \u6587\u4EF6\u94FE\u63A5\uFF08https://www.figma.com/ \u5F00\u5934\uFF09\u3002\u8BBE\u7F6E\u540E\u9762\u677F\u8BBE\u8BA1\u9875\u53EF\u4E00\u952E\u5728\u6D4F\u89C8\u5668\u6253\u5F00 Figma \u5B8C\u6574\u7F16\u8F91\u5668\u3002\u6CE8\u610F\uFF1AFigma API \u53EA\u8BFB\uFF0CAgent \u80FD\u8BFB\u8BBE\u8BA1\u4F46\u6539\u4E0D\u4E86 Figma \u6587\u4EF6\uFF1B\u9700\u8981 Agent \u5199\u7684\u8BBE\u8BA1\u8D70 Excalidraw\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Figma \u6587\u4EF6\u94FE\u63A5\uFF1B\u7F3A\u7701\u4E3A\u67E5\u770B\u5F53\u524D\u94FE\u63A5" }
      }
    }
  },
  {
    name: "wudi_design_tokens_get",
    description: "\u8BFB\u53D6\u9879\u76EE design tokens\uFF08.wudi/design/tokens.json\uFF1Acolor/spacing/radius/shadow/typography \u7B49\u5206\u7EC4\uFF09\u3002\u4E0D\u5B58\u5728\u65F6\u8FD4\u56DE\u7ED3\u6784\u6A21\u677F\u4E0E\u5EFA\u7ACB\u6307\u5F15\u3002",
    _meta: UI_META,
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "wudi_design_tokens_set",
    description: "\u5199\u5165 design tokens\uFF08\u6574\u4F53\u8986\u76D6\uFF09\uFF0C\u5E76\u540C\u6B65\u751F\u6210 tokens.css\uFF08CSS \u53D8\u91CF --\u5206\u7EC4-\u952E\u540D\uFF09\u3002\u4F20 tokens \u5BF9\u8C61\uFF0C\u6216\u4F20 json \u5B57\u7B26\u4E32\u3002",
    inputSchema: {
      type: "object",
      properties: {
        tokens: { type: "object", description: "tokens \u5BF9\u8C61\uFF0C\u5982 { color: { primary: '#3b6ef6' }, spacing: { sm: '8px' } }" },
        json: { type: "string", description: "tokens \u7684 JSON \u5B57\u7B26\u4E32\uFF08\u4E0E tokens \u4E8C\u9009\u4E00\uFF09" }
      }
    }
  },
  {
    name: "wudi_design_list",
    description: "\u5217\u51FA .wudi/design/ \u4E0B\u7684\u8BBE\u8BA1\u4EA7\u7269\uFF08\u8BBE\u8BA1\u7A3F HTML \u7248\u672C\u3001tokens \u6587\u4EF6\uFF09\uFF0C\u542B\u5927\u5C0F\u4E0E\u4FEE\u6539\u65F6\u95F4\u3002\u8BBE\u8BA1\u8FED\u4EE3\u5386\u53F2\u4E00\u76EE\u4E86\u7136\u3002",
    _meta: UI_META,
    inputSchema: { type: "object", properties: {} }
  }
];
async function callTool(name, args = {}) {
  try {
    switch (name) {
      case "wudi_project_get":
        return toolProjectGet();
      case "wudi_project_init":
        return toolProjectInit(args);
      case "wudi_status":
        return await toolStatus(args);
      case "wudi_docs_register":
        return toolDocsRegister(args);
      case "wudi_ssh_ping":
        return await toolSshPing();
      case "wudi_deploy":
        return await toolDeploy(args);
      case "wudi_deploy_history":
        return toolDeployHistory(args);
      case "wudi_rollback":
        return await toolRollback(args);
      case "wudi_health_check":
        return await toolHealthCheck();
      case "wudi_remote_exec":
        return await toolRemoteExec(args);
      case "wudi_figma_fetch":
        return await toolFigmaFetch(args);
      case "wudi_deploy_logs":
        return await toolDeployLogs(args);
      case "wudi_doctor":
        return await toolDoctor(args);
      case "wudi_env_set":
        return toolEnvSet(args);
      case "wudi_design_tokens_get":
        return toolDesignTokensGet();
      case "wudi_design_tokens_set":
        return toolDesignTokensSet(args);
      case "wudi_design_list":
        return toolDesignList();
      case "wudi_design_tokens_export":
        return toolDesignTokensExport(args);
      case "wudi_figma_link":
        return toolFigmaLink(args);
      case "wudi_designs_list":
        return toolDesignsList();
      case "wudi_design_delete":
        return toolDesignDelete(args);
      case "wudi_design_rename":
        return toolDesignRename(args);
      case "wudi_tokens_compare":
        return toolTokensCompare(args);
      case "wudi_canvas_get":
        return toolCanvasGet();
      case "wudi_canvas_bridge":
        return toolCanvasBridge();
      case "wudi_canvas_edit":
        return toolCanvasEdit(args);
      case "wudi_canvas_clear":
        return toolCanvasClear(args);
      case "wudi_canvas_export":
        return toolCanvasExport(args);
      case "wudi_docs_weekly":
        return await toolDocsWeekly(args);
      case "wudi_notify_test":
        return await toolNotifyTest(args);
      case "wudi_projects_list":
        return toolProjectsList();
      case "wudi_projects_add":
        return toolProjectsAdd(args);
      case "wudi_projects_remove":
        return toolProjectsRemove(args);
      case "wudi_figma_images":
        return await toolFigmaImages(args);
      case "wudi_figma_tokens_diff":
        return await toolFigmaTokensDiff(args);
      default:
        return fail(`\u672A\u77E5\u5DE5\u5177\uFF1A${name}`);
    }
  } catch (err) {
    return fail(`\u5DE5\u5177 ${name} \u6267\u884C\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 1500)}`);
  }
}
function toolProjectGet() {
  const project = loadProject();
  if (!project) {
    return ok(
      [
        "\u5F53\u524D\u9879\u76EE\u8FD8\u6CA1\u6709\u65E0\u654C\u7F16\u7A0B\u6863\u6848\uFF08.wudi/project.json\uFF09\u3002",
        "\u8BF7\u901A\u8FC7\u95EE\u7B54\u5411\u7528\u6237\u6536\u96C6\u4EE5\u4E0B\u4FE1\u606F\u540E\u8C03\u7528 wudi_project_init \u5EFA\u6863\uFF1A",
        "- name / techStack\uFF1A\u9879\u76EE\u540D\u4E0E\u6280\u672F\u6808",
        "- build\uFF1A\u672C\u5730\u6784\u5EFA\u547D\u4EE4",
        "- packageType\uFF1Adir\uFF08\u4EA7\u7269\u76EE\u5F55\uFF09\u6216 docker-image\uFF08\u955C\u50CF tar\uFF09",
        "- deployRoot\uFF1A\u670D\u52A1\u5668\u90E8\u7F72\u6839\u76EE\u5F55\uFF1BremoteScript\uFF1A\u7248\u672C\u5207\u6362\u540E\u547D\u4EE4",
        "- healthCheckUrl\uFF1A\u5065\u5EB7\u68C0\u67E5 URL",
        "\u5B57\u6BB5\u6A21\u677F\uFF1A",
        j(PROJECT_TEMPLATE)
      ].join("\n")
    );
  }
  const envLine = listEnvNames(project).length > 1 || project.envs?.length ? `
\u73AF\u5883\uFF1A${listEnvNames(project).join("\u3001")}${project.defaultEnv ? `\uFF08\u9ED8\u8BA4 ${project.defaultEnv}\uFF09` : ""}` : "";
  return ok(`\u9879\u76EE\u6863\u6848\uFF08.wudi/project.json\uFF09\uFF1A
${j(project)}${envLine}`, { project });
}
function toolEnvSet(args) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\uFF0C\u5148 wudi_project_init\u3002");
  const name = String(args.name ?? "").trim();
  if (!name) return fail("\u7F3A\u5C11 name\u3002");
  if (name === "default") return fail("default \u662F\u5355\u73AF\u5883\u6A21\u5F0F\u7684\u865A\u62DF\u540D\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u663E\u5F0F\u73AF\u5883\u540D\u3002");
  const envs = Array.isArray(project.envs) ? [...project.envs] : [];
  if (args.remove === true) {
    const next2 = { ...project, envs: envs.filter((e) => e.name !== name) };
    if (next2.defaultEnv === name) next2.defaultEnv = "";
    saveProject({ envs: next2.envs, defaultEnv: next2.defaultEnv });
    return ok(`\u73AF\u5883\u300C${name}\u300D\u5DF2\u5220\u9664\u3002\u5F53\u524D\u73AF\u5883\uFF1A${listEnvNames(next2).join("\u3001")}`, { project: next2 });
  }
  const env = envs.find((e) => e.name === name) ?? { name };
  if (args.deployRoot !== void 0) env.deployRoot = String(args.deployRoot).trim();
  if (args.remoteScript !== void 0) env.remoteScript = String(args.remoteScript);
  if (args.healthCheckUrl !== void 0) env.healthCheck = { ...env.healthCheck, url: String(args.healthCheckUrl).trim() };
  if (args.healthExpect !== void 0) env.healthCheck = { ...env.healthCheck, expect: Number(args.healthExpect) || 200 };
  if (args.healthCheckFrom !== void 0) env.healthCheck = { ...env.healthCheck, checkFrom: args.healthCheckFrom === "local" ? "local" : "remote" };
  if (args.logCommand !== void 0) env.logCommand = String(args.logCommand);
  if (args.sshHost !== void 0) env.sshHost = String(args.sshHost).trim();
  if (args.sshPort !== void 0) env.sshPort = String(args.sshPort).trim();
  if (args.sshUser !== void 0) env.sshUser = String(args.sshUser).trim();
  if (args.notifyWebhook !== void 0) env.notifyWebhook = String(args.notifyWebhook).trim();
  if (args.notifyFormat !== void 0) env.notifyFormat = ["feishu", "wecom", "generic"].includes(String(args.notifyFormat)) ? String(args.notifyFormat) : "generic";
  if (args.confirmWord !== void 0) env.confirmWord = String(args.confirmWord).trim();
  if (args.deployPolicy !== void 0) env.deployPolicy = String(args.deployPolicy) === "direct" ? "direct" : "confirm";
  const idx = envs.findIndex((e) => e.name === name);
  if (idx >= 0) envs[idx] = env;
  else envs.push(env);
  const patch = { envs };
  if (args.setDefault === true) patch.defaultEnv = name;
  const { project: next } = saveProject(patch);
  const resolved = resolveEnv(next, name);
  return ok(
    [
      `\u73AF\u5883\u300C${name}\u300D\u5DF2${idx >= 0 ? "\u66F4\u65B0" : "\u65B0\u589E"}${args.setDefault ? "\uFF08\u8BBE\u4E3A\u9ED8\u8BA4\uFF09" : ""}\u3002`,
      `\u89E3\u6790\u7ED3\u679C\uFF08\u542B\u56DE\u843D\u9876\u5C42\uFF09\uFF1A
${j(resolved)}`,
      `\u5F53\u524D\u73AF\u5883\u5217\u8868\uFF1A${listEnvNames(next).join("\u3001")}`
    ].join("\n"),
    { project: next, resolved }
  );
}
function toolProjectInit(args) {
  const patch = {};
  if (args.name !== void 0) patch.name = String(args.name);
  if (args.techStack !== void 0) patch.techStack = String(args.techStack);
  if (args.build !== void 0) patch.build = String(args.build);
  if (args.deployRoot !== void 0) patch.deployRoot = String(args.deployRoot).trim();
  if (args.remoteScript !== void 0) patch.remoteScript = String(args.remoteScript);
  if (args.notes !== void 0) patch.notes = String(args.notes);
  if (args.logCommand !== void 0) patch.logCommand = String(args.logCommand);
  if (args.defaultEnv !== void 0) patch.defaultEnv = String(args.defaultEnv);
  if (args.notifyWebhook !== void 0) patch.notifyWebhook = String(args.notifyWebhook).trim();
  if (args.notifyFormat !== void 0) patch.notifyFormat = ["feishu", "wecom", "generic"].includes(String(args.notifyFormat)) ? String(args.notifyFormat) : "generic";
  if (args.confirmWord !== void 0) patch.confirmWord = String(args.confirmWord).trim();
  if (args.deployPolicy !== void 0) patch.deployPolicy = String(args.deployPolicy) === "direct" ? "direct" : "confirm";
  if (args.remoteWhitelist !== void 0) {
    patch.remoteWhitelist = String(args.remoteWhitelist).split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (args.packageType !== void 0 || args.packagePath !== void 0 || args.dockerImage !== void 0) {
    patch.package = {};
    if (args.packageType !== void 0) patch.package.type = args.packageType === "docker-image" ? "docker-image" : "dir";
    if (args.packagePath !== void 0) patch.package.path = String(args.packagePath);
    if (args.dockerImage !== void 0) patch.package.dockerImage = String(args.dockerImage);
  }
  if (args.healthCheckUrl !== void 0 || args.healthExpect !== void 0 || args.healthCheckFrom !== void 0) {
    patch.healthCheck = {};
    if (args.healthCheckUrl !== void 0) patch.healthCheck.url = String(args.healthCheckUrl).trim();
    if (args.healthExpect !== void 0) patch.healthCheck.expect = Number(args.healthExpect) || 200;
    if (args.healthCheckFrom !== void 0) patch.healthCheck.checkFrom = args.healthCheckFrom === "local" ? "local" : "remote";
  }
  const { project, file } = saveProject(patch);
  const missing = [];
  if (!project.build) missing.push("build\uFF08\u672C\u5730\u6784\u5EFA\u547D\u4EE4\uFF09");
  if (!project.deployRoot) missing.push("deployRoot\uFF08\u670D\u52A1\u5668\u90E8\u7F72\u6839\u76EE\u5F55\uFF09");
  if (!project.healthCheck.url) missing.push("healthCheckUrl\uFF08\u5065\u5EB7\u68C0\u67E5 URL\uFF0C\u4E0D\u914D\u5219\u90E8\u7F72\u53EA\u5230 verify \u8DF3\u8FC7\uFF09");
  const lines = [`\u6863\u6848\u5DF2\u4FDD\u5B58\uFF1A${file}`, j(project)];
  if (missing.length) lines.push(`
\u8FD8\u7F3A\u5173\u952E\u5B57\u6BB5\uFF08\u4E0D\u5F71\u54CD\u5EFA\u6863\uFF0C\u4F46\u90E8\u7F72\u524D\u8981\u8865\uFF09\uFF1A
- ${missing.join("\n- ")}`);
  return ok(lines.join("\n"), { project });
}
async function toolStatus(args = {}) {
  const project = loadProject();
  const envName = args.env ? String(args.env) : void 0;
  let resolved = null;
  let envErr = null;
  if (project) {
    try {
      resolved = resolveEnv(project, envName);
    } catch (err) {
      envErr = String(err?.message ?? err);
    }
  }
  const deployLimit = Math.min(Math.max(Number(args.deployLimit) || 5, 1), 20);
  const deploys = loadDeploys().slice(0, deployLimit);
  const docs = loadDocs();
  let sshLine = "SSH\uFF1A\u672A\u914D\u7F6E\uFF08\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u586B sshHost \u7B49\uFF09";
  try {
    const cfg = sshConfig(resolved?.ssh ?? {});
    sshLine = `SSH\uFF1A${cfg.user}@${cfg.host}:${cfg.port}${cfg.identity ? `\uFF08\u5BC6\u94A5 ${cfg.identity}\uFF09` : "\uFF08\u9ED8\u8BA4\u5BC6\u94A5/agent\uFF09"}${resolved && resolved.name !== "default" ? `\uFF08\u73AF\u5883 ${resolved.name}\uFF09` : ""}`;
  } catch {
  }
  const envsLine = project ? `\u73AF\u5883\uFF1A${listEnvNames(project).join("\u3001")}${resolved ? `\uFF5C\u5F53\u524D\u89E3\u6790\uFF1A${resolved.name}` : ""}` : "";
  const lines = [
    "\u2550\u2550\u2550 \u65E0\u654C\u7F16\u7A0B \xB7 \u9879\u76EE\u5168\u666F \u2550\u2550\u2550",
    project ? [
      `\u9879\u76EE\uFF1A${project.name || "(\u672A\u547D\u540D)"}\uFF5C\u6280\u672F\u6808\uFF1A${project.techStack || "?"}`,
      `\u6784\u5EFA\uFF1A${project.build || "(\u672A\u914D\u7F6E)"}`,
      `\u6253\u5305\uFF1A${project.package.type === "docker-image" ? `\u955C\u50CF ${project.package.dockerImage || "(\u672A\u914D\u7F6E\u955C\u50CF\u540D)"}` : `\u76EE\u5F55 ${project.package.path}`}`,
      envsLine,
      envErr ? `\u73AF\u5883\u89E3\u6790\u5931\u8D25\uFF1A${envErr}` : resolved ? `\u90E8\u7F72\uFF08${resolved.name}\uFF09\uFF1A${resolved.deployRoot || "(\u672A\u914D\u7F6E)"}\uFF1B\u5207\u6362\u811A\u672C\uFF1A${resolved.remoteScript || "(\u65E0)"}\uFF1B\u65E5\u5FD7\uFF1A${resolved.logCommand || "(\u672A\u914D\u7F6E)"}` : "",
      `\u5065\u5EB7\u68C0\u67E5\uFF1A${resolved?.healthCheck?.url || "(\u672A\u914D\u7F6E)"}\uFF08\u671F\u671B ${resolved?.healthCheck?.expect ?? 200}\uFF0C${resolved?.healthCheck?.checkFrom ?? "remote"} \u4FA7\u68C0\u67E5\uFF09`
    ].filter(Boolean).join("\n") : "\u9879\u76EE\u6863\u6848\uFF1A\u672A\u5EFA\u6863\uFF08\u7528 wudi_project_init \u6216 /wudi \u5EFA\u6863\uFF09",
    sshLine,
    `\u6700\u8FD1\u90E8\u7F72\uFF08${deploys.length}\uFF09\uFF1A`,
    deploys.length ? deploys.map(
      (d) => `- ${d.release ?? d.id}\uFF5C${d.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}${d.env && d.env !== "default" ? `@${d.env}` : ""}\uFF5C${d.status}\uFF5C${d.finishedAt ?? d.startedAt}${d.status === "failed" ? `\uFF5C\u5361\u5728 ${d.failedStage ?? "?"}` : ""}`
    ).join("\n") : "  \uFF08\u65E0\u90E8\u7F72\u8BB0\u5F55\uFF09",
    `\u6587\u6863\uFF08${docs.length}\uFF09\uFF1A`,
    docs.length ? docs.slice(0, 10).map((d) => `- [${d.type}] ${d.path}`).join("\n") : "  \uFF08\u65E0\u767B\u8BB0\u6587\u6863\uFF0C\u7528 wudi_docs_register \u767B\u8BB0\uFF09"
  ];
  return ok(lines.join("\n"), { project, envs: project ? listEnvNames(project) : [], currentEnv: resolved?.name ?? null, resolved, deploys, docs: docs.slice(0, 50) });
}
function toolDocsRegister(args) {
  const doc = registerDoc({
    path: args.path,
    type: args.type,
    title: args.title,
    source: args.source
  });
  return ok(`\u6587\u6863\u5DF2\u767B\u8BB0\uFF1A[${doc.type}] ${doc.path}\uFF08.wudi/docs.json\uFF09`, { doc });
}
async function toolSshPing(args = {}) {
  try {
    const project = loadProject();
    const overrides = project ? resolveEnv(project, args.env ? String(args.env) : void 0).ssh : {};
    const r = await sshPing(overrides);
    return ok(`SSH \u8FDE\u901A\uFF1A${r.host}\uFF0C\u5EF6\u8FDF ${r.latencyMs}ms`, { ping: r });
  } catch (err) {
    return fail(`SSH \u8FDE\u901A\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
function artifactsDir() {
  const dir = join2(wudiDir(), "artifacts");
  mkdirSync2(dir, { recursive: true });
  return dir;
}
function artifactName(project, stamp, ext) {
  const safe = String(project.name || "app").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  return `${safe}-${stamp}.${ext}`;
}
async function stagePackage(project, stamp) {
  if (project.package.type === "docker-image") {
    if (!project.package.dockerImage) throw new Error("packageType=docker-image \u4F46\u6863\u6848\u672A\u914D\u7F6E dockerImage\uFF08\u672C\u5730\u955C\u50CF\u540D\uFF09\u3002");
    const file2 = join2(artifactsDir(), artifactName(project, stamp, "tar"));
    await localRun(`docker save -o ${q(file2)} ${q(project.package.dockerImage)}`, { cwd: projectRoot() });
    return { file: file2, kind: "docker-image" };
  }
  const pkgPath = resolve2(projectRoot(), project.package.path || "dist");
  if (!existsSync3(pkgPath)) throw new Error(`\u4EA7\u7269\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${pkgPath}\uFF08\u68C0\u67E5\u6863\u6848 package.path \u6216\u5148\u5B8C\u6210\u6784\u5EFA\uFF09`);
  const file = join2(artifactsDir(), artifactName(project, stamp, "tar.gz"));
  await localRun(
    `tar -czf ${q(file)} --exclude='./.wudi' --exclude='./.env' --exclude='./.git' -C ${q(pkgPath)} .`,
    { cwd: projectRoot() }
  );
  return { file, kind: "dir" };
}
async function checkHealthOnce(envObj) {
  const hc = envObj.healthCheck ?? {};
  if (!hc.url) return { skipped: true, reason: "\u6863\u6848\u672A\u914D\u7F6E healthCheck.url\uFF0C\u8DF3\u8FC7\u5065\u5EB7\u68C0\u67E5" };
  const expect = Number(hc.expect ?? 200);
  if ((hc.checkFrom ?? "remote") === "local") {
    const res = await fetch(hc.url, { signal: AbortSignal.timeout(8e3) });
    return { ok: res.status === expect, status: res.status, expect, via: "local" };
  }
  const { stdout } = await sshRun(`curl -s -o /dev/null -w '%{http_code}' --max-time 8 ${q(hc.url)}`, { timeoutMs: 3e4, overrides: envObj.ssh });
  const status = parseInt(String(stdout).trim(), 10);
  return { ok: status === expect, status, expect, via: "remote" };
}
async function checkHealthWithRetry(envObj, attempts = 3, gapMs = 5e3) {
  const results = [];
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(gapMs);
    try {
      results.push(await checkHealthOnce(envObj));
    } catch (err) {
      results.push({ ok: false, error: String(err?.message ?? err).slice(0, 300) });
    }
    const last = results.at(-1);
    if (last.ok || last.skipped) break;
  }
  return results;
}
function formatHealth(results) {
  return results.map(
    (r, i) => r.skipped ? `\u7B2C ${i + 1} \u6B21\uFF1A\u8DF3\u8FC7\uFF08${r.reason}\uFF09` : r.ok ? `\u7B2C ${i + 1} \u6B21\uFF1AHTTP ${r.status} \u2713\uFF08${r.via} \u4FA7\u68C0\u67E5\uFF09` : `\u7B2C ${i + 1} \u6B21\uFF1A${r.status !== void 0 ? `HTTP ${r.status}\uFF08\u671F\u671B ${r.expect}\uFF09` : `\u9519\u8BEF\uFF1A${r.error}`}`
  ).join("\n");
}
function planText(lines, confirmHint) {
  return [...lines, "", confirmHint].join("\n");
}
async function toolDeploy(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\uFF0C\u5148 wudi_project_init\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.deployRoot) return fail(`\u73AF\u5883 ${envObj.name} \u7F3A deployRoot\uFF08wudi_project_init \u8865\u9876\u5C42\u6216 wudi_env_set \u8865\u8BE5\u73AF\u5883\uFF09\u3002`);
  const confirm = args.confirm === true;
  const skipBuild = args.skipBuild === true;
  const pruneOld = args.pruneOld === true;
  const stamp = releaseStamp();
  let cfg;
  try {
    cfg = sshConfig(envObj.ssh);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!skipBuild && !project.build) return fail("\u6863\u6848\u7F3A build \u547D\u4EE4\uFF08\u6216\u672C\u6B21\u8C03\u7528\u5E26 skipBuild=true \u8DF3\u8FC7\u6784\u5EFA\uFF09\u3002");
  if (confirm && envObj.confirmWord) {
    if (String(args.confirmWord ?? "").trim() !== envObj.confirmWord) {
      return fail(
        [
          `\u73AF\u5883 ${envObj.name} \u914D\u7F6E\u4E86\u90E8\u7F72\u786E\u8BA4\u8BCD\uFF08confirmWord\uFF09\uFF0C\u672C\u6B21\u8C03\u7528\u672A\u901A\u8FC7\u6821\u9A8C\uFF0C\u6D41\u6C34\u7EBF\u672A\u6267\u884C\u3002`,
          "\u5904\u7F6E\uFF1A\u5411\u7528\u6237\u590D\u8FF0\u9884\u68C0\u8BA1\u5212\u5E76\u7D22\u53D6\u786E\u8BA4\u8BCD\u540E\uFF0C\u5E26 confirm=true + confirmWord \u91CD\u65B0\u8C03\u7528\u3002"
        ].join("\n")
      );
    }
  }
  if (!confirm) {
    const lines = [
      "\u2550\u2550\u2550 \u90E8\u7F72\u9884\u68C0\u8BA1\u5212\uFF08\u672A\u6267\u884C\uFF09\u2550\u2550\u2550",
      `\u73AF\u5883\uFF1A${envObj.name}${envObj.confirmWord ? "\uFF08\u9700\u786E\u8BA4\u8BCD\uFF09" : ""}`,
      `\u76EE\u6807\uFF1A${cfg.user}@${cfg.host}:${cfg.port} \u2192 ${envObj.deployRoot}`,
      `\u7248\u672C\uFF1A${stamp}`,
      `\u9636\u6BB5\uFF1A${[!skipBuild && "build", "package", "upload", "remote", envObj.healthCheck.url ? "verify" : "verify(\u8DF3\u8FC7\uFF1A\u672A\u914D\u5065\u5EB7\u68C0\u67E5)"].filter(Boolean).join(" \u2192 ")}`,
      `\u6253\u5305\uFF1A${project.package.type === "docker-image" ? `docker save ${project.package.dockerImage}` : `tar ${project.package.path}`}`,
      envObj.remoteScript ? `\u5207\u6362\u540E\u6267\u884C\uFF1A${envObj.remoteScript}` : "\u5207\u6362\u540E\u65E0\u8FDC\u7AEF\u811A\u672C",
      "\u4E0A\u7EBF\u786E\u8BA4\uFF1A\u8BF7\u5411\u7528\u6237\u590D\u8FF0\u4EE5\u4E0A\u76EE\u6807\u5E76\u5F81\u5F97\u540C\u610F\u540E\uFF0C\u518D\u6B21\u8C03\u7528 wudi_deploy \u5E76\u5E26 confirm=true\u3002"
    ];
    return ok(planText(lines, "\uFF08\u672C\u6B21\u4EC5\u9884\u68C0\uFF0C\u672A\u505A\u4EFB\u4F55\u53D8\u66F4\uFF09"));
  }
  const record = {
    id: `dep-${stamp}`,
    type: "deploy",
    env: envObj.name,
    release: stamp,
    status: "running",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    finishedAt: null,
    failedStage: null,
    stages: []
  };
  appendDeploy(record);
  const stage = async (name, fn) => {
    const entry = { name, status: "running", startedAt: (/* @__PURE__ */ new Date()).toISOString(), detail: "", durationMs: 0 };
    record.stages.push(entry);
    updateDeploy(record.id, { stages: record.stages });
    const t0 = Date.now();
    try {
      const detail = await fn();
      entry.status = detail?.skipped ? "skipped" : "ok";
      entry.detail = detail?.summary ?? "";
      entry.durationMs = Date.now() - t0;
      updateDeploy(record.id, { stages: record.stages });
      return detail;
    } catch (err) {
      entry.status = "failed";
      entry.detail = String(err?.message ?? err).slice(0, 800);
      entry.durationMs = Date.now() - t0;
      record.status = "failed";
      record.failedStage = name;
      record.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      updateDeploy(record.id, { status: record.status, failedStage: name, finishedAt: record.finishedAt, stages: record.stages });
      throw err;
    }
  };
  let pkg;
  try {
    if (!skipBuild) {
      await stage("build", async () => {
        const { stderr } = await localRun(project.build, { cwd: projectRoot() });
        return { summary: "\u6784\u5EFA\u5B8C\u6210" + (stderr ? `\uFF08stderr \u6709\u8F93\u51FA\uFF1A${clip(stderr, 300)}\uFF09` : "") };
      });
    } else {
      record.stages.push({ name: "build", status: "skipped", detail: "skipBuild=true", startedAt: (/* @__PURE__ */ new Date()).toISOString(), durationMs: 0 });
    }
    pkg = await stage("package", () => stagePackage(project, stamp));
    await stage("upload", async () => {
      await sshRun(`mkdir -p ${q(join2(envObj.deployRoot, "releases", stamp).replaceAll("\\", "/"))}`, { timeoutMs: 6e4, overrides: envObj.ssh });
      const remotePath = `${envObj.deployRoot}/releases/${stamp}/bundle${pkg.kind === "docker-image" ? ".tar" : ".tar.gz"}`;
      await uploadFile(pkg.file, remotePath, { overrides: envObj.ssh });
      const sizeMB = (statSync(pkg.file).size / 1024 / 1024).toFixed(1);
      return { summary: `\u4E0A\u4F20 ${sizeMB} MB \u2192 ${remotePath}`, remotePath };
    });
    await stage("remote", async () => {
      const remoteDir = `${envObj.deployRoot}/releases/${stamp}`;
      if (pkg.kind === "docker-image") {
        await sshRun(`docker load -i ${q(`${remoteDir}/bundle.tar`)}`, { timeoutMs: 3e5, overrides: envObj.ssh });
        await sshRun(`rm -f ${q(`${remoteDir}/bundle.tar`)}`, { overrides: envObj.ssh });
      } else {
        await sshRun(`tar -xzf ${q(`${remoteDir}/bundle.tar.gz`)} -C ${q(remoteDir)} && rm -f ${q(`${remoteDir}/bundle.tar.gz`)}`, { timeoutMs: 12e4, overrides: envObj.ssh });
        await sshRun(`ln -sfn ${q(join2(envObj.deployRoot, "releases", stamp))} ${q(join2(envObj.deployRoot, "current"))}`, { overrides: envObj.ssh });
      }
      if (envObj.remoteScript) {
        await sshRun(`cd ${q(envObj.deployRoot)} && ( ${envObj.remoteScript} )`, { timeoutMs: 3e5, overrides: envObj.ssh });
      }
      return { summary: `${pkg.kind === "docker-image" ? "\u955C\u50CF\u52A0\u8F7D" : "\u8F6F\u94FE\u5DF2\u5207\u6362"}${envObj.remoteScript ? ` + \u6267\u884C ${envObj.remoteScript}` : ""}` };
    });
    const healthResults = await stage("verify", async () => {
      const results = await checkHealthWithRetry(envObj);
      const last = results.at(-1);
      record.health = last.skipped ? { skipped: true } : { ok: !!last.ok, status: last.status, via: last.via, attempts: results.length };
      if (last.skipped) return { summary: last.reason, skipped: true };
      if (!last.ok) {
        throw new Error(`\u5065\u5EB7\u68C0\u67E5\u672A\u901A\u8FC7\uFF08${results.length} \u6B21\u5C1D\u8BD5\uFF09\uFF1A
${formatHealth(results)}`);
      }
      return { summary: `\u5065\u5EB7\u68C0\u67E5\u901A\u8FC7\uFF08${results.length} \u6B21\u5185\uFF09`, healthResults: results };
    });
    record.status = healthResults?.skipped ? "ok-with-warnings" : "ok";
    record.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    updateDeploy(record.id, { status: record.status, finishedAt: record.finishedAt, ...record.health ? { health: record.health } : {} });
    let pruneLine = "";
    if (pruneOld) pruneLine = `
${await pruneReleases(envObj)}`;
    let notifyLine = "";
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name,
        env: envObj.name,
        type: "deploy",
        status: record.status,
        release: stamp,
        failedStage: null,
        durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: record.stages.find((s) => s.status === "failed")?.detail ?? ""
      });
      notifyLine = `
\u901A\u77E5\uFF1A${notifyRes.detail}`;
    }
    const lines = [
      "\u2550\u2550\u2550 \u90E8\u7F72\u5B8C\u6210 \u2550\u2550\u2550",
      `\u73AF\u5883\uFF1A${envObj.name}\uFF5C\u7248\u672C\uFF1A${stamp} \u2192 ${cfg.user}@${cfg.host}:${envObj.deployRoot}`,
      ...record.stages.map((s) => `- ${s.name}: ${s.status}${s.detail ? `\uFF08${s.detail}\uFF09` : ""}${s.durationMs ? ` ${s.durationMs}ms` : ""}`),
      record.status === "ok-with-warnings" ? "\u6CE8\u610F\uFF1A\u672A\u914D\u7F6E\u5065\u5EB7\u68C0\u67E5 URL\uFF0C\u672C\u6B21\u90E8\u7F72\u672A\u7ECF\u7EBF\u4E0A\u9A8C\u8BC1\u3002" : "",
      pruneLine,
      notifyLine,
      record.status === "ok-with-warnings" ? "\u5EFA\u8BAE\uFF1A\u8865\u5168\u6863\u6848 healthCheck.url \u540E\u7528 wudi_health_check \u624B\u52A8\u9A8C\u8BC1\u3002" : "\u4E0B\u4E00\u6B65\uFF1A\u5982\u9700\u6587\u6863\u66F4\u65B0\u7528 /wudi-docs changelog\u3002"
    ].filter(Boolean);
    return ok(lines.join("\n"), { deploy: loadDeploys()[0] });
  } catch (err) {
    const failed = record.stages.find((s) => s.status === "failed");
    const remoteTouched = ["remote", "verify"].includes(record.failedStage);
    let notifyLine = "";
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name,
        env: envObj.name,
        type: "deploy",
        status: "failed",
        release: stamp,
        failedStage: record.failedStage,
        durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: failed?.detail ?? String(err?.message ?? err)
      });
      notifyLine = `
\u901A\u77E5\uFF1A${notifyRes.detail}`;
    }
    const lines = [
      "\u2550\u2550\u2550 \u90E8\u7F72\u5931\u8D25 \u2550\u2550\u2550",
      `\u73AF\u5883\uFF1A${envObj.name}\uFF5C\u5361\u5728\u9636\u6BB5\uFF1A${record.failedStage}`,
      `\u9519\u8BEF\uFF1A${clip(failed?.detail ?? err?.message, 800)}`,
      remoteTouched ? "\u6CE8\u610F\uFF1A\u5931\u8D25\u53D1\u751F\u5728\u8FDC\u7AEF\u5207\u6362\u4E4B\u540E\uFF0C\u7EBF\u4E0A\u53EF\u80FD\u53D7\u5F71\u54CD \u2014\u2014 \u7ACB\u5373\u8BC4\u4F30\uFF1Awudi_health_check \u68C0\u67E5\uFF0C\u6216 wudi_rollback \u56DE\u6EDA\u4E0A\u4E00\u7248\u3002" : "\u7EBF\u4E0A\u672A\u53D7\u5F71\u54CD\uFF08\u5931\u8D25\u53D1\u751F\u5728\u4E0A\u4F20/\u5207\u6362\u4E4B\u524D\uFF09\u3002",
      notifyLine,
      "\u4FEE\u590D\u540E\u91CD\u65B0\u8C03\u7528 wudi_deploy\uFF08confirm=true\uFF09\u3002"
    ].filter(Boolean);
    return fail(lines.join("\n"));
  }
}
function toolDeployHistory(args = {}) {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
  const envFilter = args.env ? String(args.env) : null;
  const deploys = loadDeploys().filter((d) => !envFilter || d.env === envFilter).slice(0, limit);
  if (!deploys.length) return ok(envFilter ? `\u73AF\u5883 ${envFilter} \u8FD8\u6CA1\u6709\u90E8\u7F72\u8BB0\u5F55\u3002` : "\u8FD8\u6CA1\u6709\u90E8\u7F72\u8BB0\u5F55\u3002", { deploys: [] });
  const lines = deploys.map(
    (d) => [
      `\u2500\u2500 ${d.release ?? d.id}\uFF5C${d.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}${d.env && d.env !== "default" ? `@${d.env}` : ""}\uFF5C${d.status}`,
      `   ${d.startedAt} \u2192 ${d.finishedAt ?? "\u8FDB\u884C\u4E2D"}`,
      ...d.stages.map((s) => `   ${s.name}: ${s.status}${s.detail ? `\uFF5C${clip(s.detail, 160)}` : ""}`)
    ].join("\n")
  );
  return ok(lines.join("\n"), { deploys });
}
function parseRemoteReleases(stdout) {
  return String(stdout).split("\n").map((s) => s.trim()).filter((s) => /^\d{8}-\d{6}$/.test(s)).sort().reverse();
}
async function readCurrentRelease(envObj) {
  const { stdout } = await sshRun(`readlink ${q(join2(envObj.deployRoot, "current"))}`, { timeoutMs: 3e4, overrides: envObj.ssh });
  const m = String(stdout).trim().match(/(\d{8}-\d{6})$/);
  return m ? m[1] : "";
}
async function toolRollback(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (project.package.type === "docker-image") {
    const artifacts = listLocalArtifacts();
    return fail(
      [
        "docker-image \u9879\u76EE\u6CA1\u6709\u8F6F\u94FE\u53EF\u5207\uFF0C\u4E0D\u80FD\u7528\u4E00\u952E\u56DE\u6EDA\u3002\u4E24\u4E2A\u66FF\u4EE3\u65B9\u6848\uFF1A",
        "1. \u672C\u5730\u4FDD\u7559\u4E86\u6700\u8FD1 10 \u4E2A\u955C\u50CF artifact\uFF08.wudi/artifacts/\uFF09\uFF1A",
        ...artifacts.length ? artifacts.map((a) => `   - ${a.name}\uFF08${a.sizeMB} MB\uFF09`) : ["   \uFF08\u672C\u5730\u65E0\u4FDD\u7559 artifact\uFF09"],
        "   \u9009\u5B9A\u65E7\u7248\u672C\u540E\uFF0C\u628A\u6863\u6848 dockerImage \u4E34\u65F6\u6307\u5411\u65E7\u955C\u50CF\u91CD\u6253\u5305\u90E8\u7F72\uFF1B\u6216\u76F4\u63A5 docker load \u65E7 tar + \u8C03\u6574 compose \u540E wudi_remote_exec \u6267\u884C\u3002",
        "2. \u82E5\u670D\u52A1\u5668\u4E0A\u65E7\u955C\u50CF tag \u8FD8\u5728\uFF1Awudi_remote_exec \u6267\u884C docker tag/compose \u5207\u6362\uFF08\u9700\u5728 remoteWhitelist \u767D\u540D\u5355\u5185\uFF09\u3002"
      ].join("\n")
    );
  }
  if (!envObj.deployRoot) return fail(`\u73AF\u5883 ${envObj.name} \u7F3A deployRoot\u3002`);
  const confirm = args.confirm === true;
  let releases;
  try {
    const { stdout } = await sshRun(`ls -1 ${q(join2(envObj.deployRoot, "releases"))}`, { timeoutMs: 3e4, overrides: envObj.ssh });
    releases = parseRemoteReleases(stdout);
  } catch (err) {
    return fail(`\u65E0\u6CD5\u8BFB\u53D6\u670D\u52A1\u5668\u7248\u672C\u5217\u8868\uFF08SSH \u4E0D\u53EF\u8FBE\u6216 releases \u76EE\u5F55\u7F3A\u5931\uFF09\uFF1A${String(err?.message ?? err).slice(0, 300)}`);
  }
  if (!releases.length) return fail(`\u670D\u52A1\u5668 ${envObj.deployRoot}/releases \u4E0B\u6CA1\u6709\u53EF\u56DE\u6EDA\u7684\u7248\u672C\u3002`);
  const current = await readCurrentRelease(envObj);
  const target = args.target ? String(args.target).trim() : releases.find((r) => r < (current || releases[0]));
  if (!target) {
    return fail(`\u73AF\u5883 ${envObj.name} \u5F53\u524D\u53EA\u6709\u4E00\u4E2A\u7248\u672C\uFF08${releases[0]}\uFF09\u4E14\u6B63\u5728\u8FD0\u884C\uFF0C\u6CA1\u6709\u53EF\u56DE\u6EDA\u7684\u4E0A\u4E00\u7248\u3002`);
  }
  if (!releases.includes(target)) {
    return fail(`\u76EE\u6807\u7248\u672C ${target} \u4E0D\u5B58\u5728\u3002\u670D\u52A1\u5668\u53EF\u7528\u7248\u672C\uFF08\u65B0\u2192\u65E7\uFF09\uFF1A
${releases.join("\n")}`);
  }
  if (target === current) return fail(`\u76EE\u6807\u7248\u672C ${target} \u5C31\u662F\u5F53\u524D\u7EBF\u4E0A\u7248\u672C\uFF0C\u65E0\u9700\u56DE\u6EDA\u3002\u53EF\u7528\u7248\u672C\uFF1A
${releases.join("\n")}`);
  if (!confirm) {
    return ok(
      planText(
        [
          "\u2550\u2550\u2550 \u56DE\u6EDA\u9884\u68C0\u8BA1\u5212\uFF08\u672A\u6267\u884C\uFF09\u2550\u2550\u2550",
          `\u73AF\u5883\uFF1A${envObj.name}`,
          `\u5F53\u524D\u7EBF\u4E0A\uFF1A${current || "(\u672A\u77E5)"}`,
          `\u56DE\u6EDA\u5230\uFF1A${target}`,
          `\u52A8\u4F5C\uFF1A\u5207\u6362 current \u8F6F\u94FE${envObj.remoteScript ? ` + \u6267\u884C ${envObj.remoteScript}` : ""} + \u5065\u5EB7\u68C0\u67E5`,
          envObj.remoteScript?.includes("migrate") ? "\u8B66\u544A\uFF1A\u5207\u6362\u811A\u672C\u7591\u4F3C\u5305\u542B migrate\uFF0C\u6570\u636E\u5E93\u8FC1\u79FB\u4E0D\u53EF\u81EA\u52A8\u56DE\u6EDA\uFF0C\u8BF7\u5148\u786E\u8BA4\u6709\u5907\u4EFD\uFF01" : ""
        ].filter(Boolean),
        "\u4E0E\u7528\u6237\u786E\u8BA4\u540E\u518D\u6B21\u8C03\u7528 wudi_rollback \u5E76\u5E26 confirm=true\u3002"
      )
    );
  }
  const stamp = releaseStamp();
  const record = {
    id: `rb-${stamp}`,
    type: "rollback",
    env: envObj.name,
    release: target,
    fromRelease: current,
    status: "running",
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    finishedAt: null,
    failedStage: null,
    stages: []
  };
  appendDeploy(record);
  try {
    await sshRun(`ln -sfn ${q(join2(envObj.deployRoot, "releases", target))} ${q(join2(envObj.deployRoot, "current"))}`, { timeoutMs: 6e4, overrides: envObj.ssh });
    record.stages.push({ name: "switch", status: "ok", detail: `current \u2192 ${target}`, startedAt: (/* @__PURE__ */ new Date()).toISOString(), durationMs: 0 });
    if (envObj.remoteScript) {
      await sshRun(`cd ${q(envObj.deployRoot)} && ( ${envObj.remoteScript} )`, { timeoutMs: 3e5, overrides: envObj.ssh });
      record.stages.push({ name: "remote", status: "ok", detail: envObj.remoteScript, startedAt: (/* @__PURE__ */ new Date()).toISOString(), durationMs: 0 });
    }
    updateDeploy(record.id, { stages: record.stages });
    const health = await checkHealthWithRetry(envObj);
    const last = health.at(-1);
    record.stages.push({ name: "verify", status: last.ok ? "ok" : last.skipped ? "skipped" : "failed", detail: formatHealth(health), startedAt: (/* @__PURE__ */ new Date()).toISOString(), durationMs: 0 });
    record.health = last.skipped ? { skipped: true } : { ok: !!last.ok, status: last.status, via: last.via, attempts: health.length };
    record.status = last.ok ? "ok" : last.skipped ? "ok-with-warnings" : "failed";
    record.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    updateDeploy(record.id, { status: record.status, finishedAt: record.finishedAt, stages: record.stages, health: record.health });
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name,
        env: envObj.name,
        type: "rollback",
        status: record.status,
        release: target,
        failedStage: record.status === "failed" ? "verify" : null,
        durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: formatHealth(health)
      });
      var notifyLine = `
\u901A\u77E5\uFF1A${notifyRes.detail}`;
    } else {
      var notifyLine = "";
    }
    if (record.status === "failed") {
      return fail(
        [
          `\u2550\u2550\u2550 \u56DE\u6EDA\u5DF2\u5207\u6362\u4F46\u5065\u5EB7\u68C0\u67E5\u672A\u901A\u8FC7 \u2550\u2550\u2550`,
          `current \u5DF2\u6307\u5411 ${target}\uFF0C\u4F46\u670D\u52A1\u672A\u6062\u590D\u3002\u6309\u6392\u67E5\u6E05\u5355\u68C0\u67E5\uFF1A`,
          "1) docker ps / systemctl status \u770B\u8FDB\u7A0B\uFF1B2) docker logs / journalctl \u770B\u65E5\u5FD7\uFF1B3) ss -tlnp \u770B\u7AEF\u53E3\uFF1B4) \u78C1\u76D8 df -h\u3002",
          "\u53EF\u7528 wudi_remote_exec\uFF08\u767D\u540D\u5355\u5185\u547D\u4EE4\uFF09\u6216 wudi_deploy_logs \u6392\u67E5\uFF0C\u6216\u8003\u8651\u56DE\u6EDA\u5230\u66F4\u65E9\u7248\u672C\u3002"
        ].join("\n")
      );
    }
    return ok(
      [
        `\u2550\u2550\u2550 \u56DE\u6EDA${record.status === "ok-with-warnings" ? "\u5B8C\u6210\uFF08\u672A\u7ECF\u5065\u5EB7\u68C0\u67E5\u9A8C\u8BC1\uFF09" : "\u5B8C\u6210"} \u2550\u2550\u2550`,
        `\u73AF\u5883\uFF1A${envObj.name}\uFF5C\u7EBF\u4E0A\u7248\u672C\uFF1A${target}\uFF08\u539F ${current || "\u672A\u77E5"}\uFF09`,
        formatHealth(health),
        notifyLine
      ].filter(Boolean).join("\n"),
      { deploy: loadDeploys()[0] }
    );
  } catch (err) {
    record.status = "failed";
    record.failedStage = "switch";
    record.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
    updateDeploy(record.id, { status: "failed", failedStage: "switch", finishedAt: record.finishedAt, stages: record.stages });
    return fail(`\u56DE\u6EDA\u5931\u8D25\uFF08\u8F6F\u94FE\u53EF\u80FD\u672A\u5207\u6362\uFF0C\u7EBF\u4E0A\u7EF4\u6301 ${current || "\u672A\u77E5"}\uFF09\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
async function toolHealthCheck(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.healthCheck?.url) {
    return fail(`\u73AF\u5883 ${envObj.name} \u672A\u914D\u7F6E healthCheck.url\u3002\u7528 wudi_project_init \u8865\u9876\u5C42\u6216 wudi_env_set \u8865\u8BE5\u73AF\u5883\u540E\u91CD\u8BD5\u3002`);
  }
  const results = await checkHealthWithRetry(envObj);
  const last = results.at(-1);
  const lines = [`\u5065\u5EB7\u68C0\u67E5\uFF08${envObj.name}\uFF09\uFF1A${last.ok ? "\u901A\u8FC7 \u2713" : "\u672A\u901A\u8FC7 \u2717"}`, formatHealth(results)];
  if (!last.ok) {
    lines.push(
      "",
      "\u6392\u67E5\u5EFA\u8BAE\uFF08wudi_remote_exec \u6267\u884C\u767D\u540D\u5355\u5185\u547D\u4EE4\uFF0C\u6216 wudi_deploy_logs \u62C9\u670D\u52A1\u65E5\u5FD7\uFF09\uFF1A",
      "1) \u8FDB\u7A0B\uFF1Adocker ps -a / systemctl status\uFF1B2) \u65E5\u5FD7\uFF1Adocker logs --tail 100 / journalctl -n 100\uFF1B",
      "3) \u7AEF\u53E3\uFF1Ass -tlnp\uFF1B4) \u53CD\u4EE3\uFF1Atail -50 /var/log/nginx/error.log + nginx -t\uFF1B5) \u78C1\u76D8\u5185\u5B58\uFF1Adf -h\u3001free -m\u3002"
    );
  }
  return last.ok ? ok(lines.join("\n"), { health: results }) : fail(lines.join("\n"));
}
async function toolRemoteExec(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const command = String(args.command ?? "").trim();
  if (!command) return fail("\u7F3A\u5C11 command\u3002");
  if (args.confirm !== true) return fail("\u8FDC\u7AEF\u6267\u884C\u9700 confirm=true\u3002\u8BF7\u5148\u5411\u7528\u6237\u590D\u8FF0\u5C06\u8981\u6267\u884C\u7684\u547D\u4EE4\u5E76\u5F81\u5F97\u540C\u610F\u3002");
  const whitelist = project.remoteWhitelist ?? [];
  if (!whitelist.length) {
    return fail("\u6863\u6848 remoteWhitelist \u4E3A\u7A7A\uFF0C\u8FDC\u7AEF\u6267\u884C\u88AB\u62D2\u7EDD\u3002\u8BF7\u5148\u5728\u6863\u6848\u4E2D\u52A0\u767D\u540D\u5355\u524D\u7F00\uFF08\u5982 docker compose,df -h,journalctl\uFF09\uFF0C\u518D\u91CD\u8BD5\u3002");
  }
  const hit = whitelist.find((prefix) => command.startsWith(prefix));
  if (!hit) {
    return fail(`\u547D\u4EE4\u4E0D\u5728\u767D\u540D\u5355\u5185\uFF08\u524D\u7F00\u5339\u914D\uFF09\u3002\u767D\u540D\u5355\uFF1A
- ${whitelist.join("\n- ")}
\u5982\u9700\u6267\u884C\uFF0C\u5148\u66F4\u65B0\u6863\u6848 remoteWhitelist\u3002`);
  }
  const timeoutMs = Math.min(Math.max(Number(args.timeoutSec) || 60, 5), 600) * 1e3;
  const { stdout, stderr } = await sshRun(command, { timeoutMs, overrides: envObj.ssh });
  const out = clip(stdout, 3e3);
  return ok(
    [
      `\u5DF2\u5728 ${envObj.name}\uFF08${sshConfig(envObj.ssh).host}\uFF09\u6267\u884C\uFF08\u767D\u540D\u5355\u547D\u4E2D\uFF1A${hit}\uFF09\uFF1A`,
      `$ ${command}`,
      out ? `
${out}` : "(\u65E0\u6807\u51C6\u8F93\u51FA)",
      stderr ? `
[stderr] ${clip(stderr, 800)}` : ""
    ].filter(Boolean).join("\n"),
    { stdout: out, stderr: clip(stderr, 800) }
  );
}
async function toolDoctor(args = {}) {
  const project = loadProject();
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail: String(detail).slice(0, 400) });
  if (!project) {
    add("\u9879\u76EE\u6863\u6848", "fail", "\u672A\u5EFA\u6863\uFF08.wudi/project.json \u4E0D\u5B58\u5728\uFF09\uFF0C\u5148 wudi_project_init\u3002");
    return failReport(checks);
  }
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    add("\u73AF\u5883\u89E3\u6790", "fail", String(err?.message ?? err));
    return failReport(checks);
  }
  const missing = [];
  if (!project.build) missing.push("build");
  if (!envObj.deployRoot) missing.push("deployRoot");
  if (!envObj.healthCheck.url) missing.push("healthCheck.url");
  add("\u6863\u6848\u5173\u952E\u5B57\u6BB5", missing.length ? "warn" : "pass", missing.length ? `\u7F3A\uFF1A${missing.join("\u3001")}\uFF08\u90E8\u7F72\u524D\u8981\u8865\u5168\uFF09` : "build/\u6253\u5305/\u90E8\u7F72\u76EE\u6807/\u5065\u5EB7\u68C0\u67E5\u9F50\u5168");
  try {
    const ping = await sshPing(envObj.ssh);
    add("SSH \u8FDE\u901A", ping.ok ? "pass" : "fail", `${envObj.ssh.host || sshConfig(envObj.ssh).host}:${envObj.ssh.port || "22"} \u5EF6\u8FDF ${ping.latencyMs}ms`);
  } catch (err) {
    add("SSH \u8FDE\u901A", "fail", String(err?.message ?? err).slice(0, 300));
  }
  let remoteReachable = checks.find((c) => c.name === "SSH \u8FDE\u901A")?.status === "pass";
  if (remoteReachable) {
    try {
      const { stdout } = await sshRun(`df -Pm ${q(envObj.deployRoot)} 2>/dev/null | tail -1 | awk '{print $5}'`, { timeoutMs: 3e4, overrides: envObj.ssh });
      const usage = parseInt(String(stdout).trim(), 10);
      if (Number.isNaN(usage)) add("\u78C1\u76D8\u7A7A\u95F4", "warn", "\u65E0\u6CD5\u8BFB\u53D6\uFF08\u68C0\u67E5 deployRoot \u662F\u5426\u5DF2\u521B\u5EFA\uFF09");
      else add("\u78C1\u76D8\u7A7A\u95F4", usage >= 95 ? "fail" : usage >= 80 ? "warn" : "pass", `${envObj.deployRoot} \u6240\u5728\u5206\u533A\u4F7F\u7528 ${usage}%`);
    } catch (err) {
      add("\u78C1\u76D8\u7A7A\u95F4", "warn", String(err?.message ?? err).slice(0, 200));
    }
    try {
      const { stdout } = await sshRun(`awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo`, { timeoutMs: 3e4, overrides: envObj.ssh });
      const availMB = parseInt(String(stdout).trim(), 10);
      if (Number.isNaN(availMB)) add("\u5185\u5B58", "warn", "\u65E0\u6CD5\u8BFB\u53D6 MemAvailable");
      else add("\u5185\u5B58", availMB < 200 ? "warn" : "pass", `\u53EF\u7528 ${availMB} MB`);
    } catch (err) {
      add("\u5185\u5B58", "warn", String(err?.message ?? err).slice(0, 200));
    }
    try {
      const { stdout: lsOut } = await sshRun(`ls -1 ${q(join2(envObj.deployRoot, "releases"))} 2>/dev/null`, { timeoutMs: 3e4, overrides: envObj.ssh });
      const releases = parseRemoteReleases(lsOut);
      if (!releases.length) add("\u7248\u672C\u76EE\u5F55", "warn", "releases \u4E3A\u7A7A\uFF08\u5C1A\u672A\u90E8\u7F72\u8FC7\uFF09");
      else add("\u7248\u672C\u76EE\u5F55", releases.length > 10 ? "warn" : "pass", `${releases.length} \u4E2A\u7248\u672C${releases.length > 10 ? "\uFF08\u5EFA\u8BAE pruneOld \u6E05\u7406\uFF09" : ""}`);
      if (project.package.type !== "docker-image" && releases.length) {
        const current = await readCurrentRelease(envObj);
        const { stdout: exists } = await sshRun(`test -e ${q(join2(envObj.deployRoot, "current"))} && echo yes || echo no`, { overrides: envObj.ssh });
        add("current \u8F6F\u94FE", current && String(exists).includes("yes") ? "pass" : "warn", current ? `\u6307\u5411 ${current}\uFF0C\u76EE\u6807\u5B58\u5728` : "\u672A\u8BBE\u7F6E\u6216\u76EE\u6807\u4E0D\u5B58\u5728");
      }
    } catch (err) {
      add("\u7248\u672C\u76EE\u5F55/\u8F6F\u94FE", "warn", String(err?.message ?? err).slice(0, 200));
    }
  } else {
    add("\u8FDC\u7AEF\u68C0\u67E5", "warn", "SSH \u4E0D\u901A\uFF0C\u8DF3\u8FC7\u78C1\u76D8/\u5185\u5B58/\u7248\u672C\u68C0\u67E5");
  }
  try {
    const r = await checkHealthOnce(envObj);
    if (r.skipped) add("\u5065\u5EB7\u68C0\u67E5", "warn", r.reason);
    else add("\u5065\u5EB7\u68C0\u67E5", r.ok ? "pass" : "fail", `${r.via} \u4FA7 HTTP ${r.status}\uFF08\u671F\u671B ${r.expect}\uFF09`);
  } catch (err) {
    add("\u5065\u5EB7\u68C0\u67E5", "fail", String(err?.message ?? err).slice(0, 300));
  }
  const notifyCfg = resolveNotify(project, envObj);
  add("\u90E8\u7F72\u901A\u77E5", notifyCfg ? "pass" : "warn", notifyCfg ? `${notifyCfg.format} webhook \u5DF2\u914D\u7F6E` : "\u672A\u914D\u7F6E notifyWebhook\uFF08\u90E8\u7F72\u7ED3\u679C\u4E0D\u4F1A\u63A8\u9001\u5230\u7FA4\uFF09");
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const verdict = failCount ? "FAIL" : warnCount ? "WARN" : "PASS";
  const lines = [
    `\u2550\u2550\u2550 \u65E0\u654C\u7F16\u7A0B\u4F53\u68C0\uFF08${envObj.name}\uFF09\u2550\u2550\u2550`,
    ...checks.map((c) => `- [${c.status.toUpperCase()}] ${c.name}\uFF1A${c.detail}`),
    "",
    `\u7ED3\u8BBA\uFF1A${verdict}${failCount ? `\uFF08${failCount} \u9879\u5931\u8D25\uFF09` : warnCount ? `\uFF08${warnCount} \u9879\u8B66\u544A\uFF09` : "\uFF08\u5168\u90E8\u901A\u8FC7\uFF09"}`
  ];
  return verdict === "FAIL" ? fail(lines.join("\n")) : ok(lines.join("\n"), { checks, verdict });
}
function failReport(checks) {
  const lines = ["\u2550\u2550\u2550 \u65E0\u654C\u7F16\u7A0B\u4F53\u68C0 \u2550\u2550\u2550", ...checks.map((c) => `- [${c.status.toUpperCase()}] ${c.name}\uFF1A${c.detail}`), "", "\u7ED3\u8BBA\uFF1AFAIL"];
  return fail(lines.join("\n"));
}
async function toolDeployLogs(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.logCommand) {
    return fail(
      [
        `\u73AF\u5883 ${envObj.name} \u672A\u914D\u7F6E logCommand\u3002\u8BBE\u7F6E\u65B9\u6CD5\uFF08\u4E8C\u9009\u4E00\uFF09\uFF1A`,
        "- wudi_env_set \u4F20 logCommand\uFF0C\u5982\uFF1Adocker compose logs --tail 200 \u6216 journalctl -u <\u670D\u52A1> -n 200 --no-pager",
        "- wudi_project_init \u8865\u9876\u5C42 logCommand\uFF08\u73AF\u5883\u672A\u8BBE\u7F6E\u65F6\u56DE\u843D\u9876\u5C42\uFF09"
      ].join("\n")
    );
  }
  try {
    const { stdout, stderr } = await sshRun(envObj.logCommand, { timeoutMs: 6e4, overrides: envObj.ssh });
    const out = clip(stdout, 4e3);
    return ok(
      [`${envObj.name} \u670D\u52A1\u65E5\u5FD7\uFF08${envObj.logCommand}\uFF09\uFF1A`, out || "(\u65E0\u8F93\u51FA)", stderr ? `
[stderr] ${clip(stderr, 500)}` : ""].filter(Boolean).join("\n"),
      { stdout: out }
    );
  } catch (err) {
    return fail(`\u65E5\u5FD7\u62C9\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
async function toolFigmaFetch(args = {}) {
  if (!figmaToken()) {
    return ok(
      [
        "Figma \u63A5\u5165\u672A\u542F\u7528\uFF1A\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u8FD8\u6CA1\u6709\u914D\u7F6E figmaToken\u3002",
        "\u542F\u7528\u6B65\u9AA4\uFF1A",
        "1. Figma \u2192 Settings \u2192 Security \u2192 Personal access tokens \u2192 \u751F\u6210\uFF08\u53EA\u8BFB\u6743\u9650\u5373\u53EF\uFF09",
        "2. \u628A token \u586B\u5230 AOPC \u63D2\u4EF6\u8BBE\u7F6E\u4E2D wudi-coding \u7684\u300CFigma Personal Access Token\u300D",
        "3. \u91CD\u5F00\u4F1A\u8BDD\u4F7F MCP server \u91CD\u65B0\u52A0\u8F7D\uFF0C\u5373\u53EF\u7528\u672C\u5DE5\u5177\u62C9\u53D6\u8BBE\u8BA1\u7A3F\u7ED3\u6784\u4E0E\u6837\u5F0F\u3002",
        "\u672A\u914D\u7F6E\u4E0D\u5F71\u54CD\u5176\u4ED6\u529F\u80FD\uFF0CUI \u8BBE\u8BA1\u53EF\u8D70\u672C\u5730\u751F\u6210\u8DEF\u7EBF\uFF08wudi-ui \u6280\u80FD\uFF09\u3002"
      ].join("\n")
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  try {
    const data = await fetchFigmaStructure({
      fileKey: ref.fileKey,
      nodeId: ref.nodeId,
      maxDepth: Math.min(Math.max(Number(args.maxDepth) || 6, 1), 10),
      budgetMax: Math.min(Math.max(Number(args.budgetMax) || 400, 50), 2e3)
    });
    const summary = [
      `Figma \u6587\u4EF6\uFF1A${data.name}\uFF08key ${data.fileKey}${ref.nodeId ? `\uFF0C\u8282\u70B9 ${ref.nodeId}` : ""}\uFF0C\u6700\u540E\u4FEE\u6539 ${data.lastModified ?? "?"}\uFF09`,
      ref.nodeId ? "\u8282\u70B9\u7ED3\u6784\uFF08\u63D0\u70BC\uFF1A\u5C3A\u5BF8/\u989C\u8272/\u5B57\u53F7/\u6587\u672C/flex\uFF09\uFF1A\n" + j(data.tree) : "\u9875\u9762\u6982\u89C8\uFF08\u7528 node-id \u94FE\u63A5\u53EF\u62C9\u53D6\u5177\u4F53\u753B\u677F\uFF09\uFF1A\n" + j(data.pages?.map((p) => ({ name: p.name, id: p.id })))
    ].join("\n");
    return ok(summary.slice(0, 4e4), { figma: data });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN \u73AF\u5883\u53D8\u91CF\u7F3A\u5931\uFF1A\u68C0\u67E5\u63D2\u4EF6\u6E05\u5355 userConfig \u6620\u5C04\u3002");
    return fail(`Figma \u62C9\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
function toolDesignTokensGet() {
  const tokens = loadTokens();
  if (!tokens) {
    return ok(
      [
        "\u8FD8\u6CA1\u6709 design tokens\uFF08.wudi/design/tokens.json\uFF09\u3002",
        "\u5EFA\u7ACB\u65B9\u5F0F\uFF1A/wudi-ui \u8BBE\u8BA1\u5B9A\u7A3F\u540E\u81EA\u52A8\u6C89\u6DC0\uFF0C\u6216\u76F4\u63A5\u8C03\u7528 wudi_design_tokens_set \u4F20\u5165\u5BF9\u8C61\uFF1A",
        j({
          color: { primary: "#3b6ef6", text: "#1a1d21", bg: "#ffffff" },
          spacing: { sm: "8px", md: "16px", lg: "24px" },
          radius: { md: "8px" },
          typography: { "font-size-base": "14px" }
        }),
        "\u5199\u5165\u65F6\u4F1A\u540C\u6B65\u751F\u6210 tokens.css\uFF08CSS \u53D8\u91CF --\u5206\u7EC4-\u952E\u540D\uFF09\u3002"
      ].join("\n")
    );
  }
  return ok(`design tokens\uFF08.wudi/design/tokens.json\uFF09\uFF1A
${j(tokens)}`, { tokens });
}
function toolDesignTokensSet(args) {
  let tokens = args.tokens;
  if (!tokens && args.json !== void 0) {
    try {
      tokens = JSON.parse(String(args.json));
    } catch (err) {
      return fail(`json \u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${String(err?.message ?? err).slice(0, 200)}`);
    }
  }
  try {
    const files = saveTokens(tokens);
    return ok(
      [
        "tokens \u5DF2\u5199\u5165\u5E76\u751F\u6210 CSS \u53D8\u91CF\u6587\u4EF6\uFF1A",
        `- ${files.json}`,
        `- ${files.css}`,
        "\u540E\u7EED\u8BBE\u8BA1\u7A3F\u4E0E\u7EC4\u4EF6\u4EE3\u7801\u8BF7\u5F15\u7528\u8FD9\u4E9B\u53D8\u91CF\uFF0C\u4E0D\u518D\u51FA\u73B0\u9B54\u6CD5\u503C\u3002"
      ].join("\n"),
      { files }
    );
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
}
function toolDesignList() {
  const dir = designDir();
  if (!existsSync3(dir)) {
    return ok("\u8FD8\u6CA1\u6709\u8BBE\u8BA1\u4EA7\u7269\uFF08.wudi/design/ \u4E0D\u5B58\u5728\uFF09\u3002\u6267\u884C /wudi-ui \u751F\u6210\u8BBE\u8BA1\u7A3F\u540E\u4F1A\u843D\u76D8\u5230\u8FD9\u91CC\u3002", { files: [] });
  }
  const files = [];
  const walk = (d, prefix = "") => {
    for (const entry of readdirSync2(d, { withFileTypes: true })) {
      const full = join2(d, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else {
        const st = statSync(full);
        files.push({
          path: `.wudi/design/${prefix}${entry.name}`,
          sizeKB: Number((st.size / 1024).toFixed(1)),
          updatedAt: st.mtime.toISOString()
        });
      }
    }
  };
  walk(dir);
  files.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
  const lines = files.length ? files.map((f) => `- ${f.path}\uFF08${f.sizeKB} KB\uFF0C${f.updatedAt.slice(0, 16).replace("T", " ")}\uFF09`).join("\n") : "\uFF08\u76EE\u5F55\u4E3A\u7A7A\uFF09";
  return ok(`\u8BBE\u8BA1\u4EA7\u7269\uFF08.wudi/design/\uFF0C\u65B0\u2192\u65E7\uFF09\uFF1A
${lines}`, { files });
}
function toolProjectsList() {
  const root = projectRoot();
  try {
    registryAdd(root, loadProject()?.name || "");
  } catch {
  }
  const projects = registrySummaries(root);
  const lines = projects.map((p) => {
    const last = p.lastDeploy ? `${p.lastDeploy.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}@${p.lastDeploy.env ?? "default"} ${p.lastDeploy.release}\uFF08${p.lastDeploy.status}\uFF09` : "\u65E0\u90E8\u7F72";
    return `- ${p.isCurrent ? "\u2605\u5F53\u524D " : ""}${p.name}\uFF5C${p.path}${p.archived ? "" : "\uFF08\u672A\u5EFA\u6863\uFF09"}
  \u6280\u672F\u6808 ${p.techStack || "?"}\uFF5C\u73AF\u5883 ${(p.envNames || ["\u2014"]).join("\u3001")}\uFF5C${last}\uFF5C\u6587\u6863 ${p.docsCount}\uFF5C\u8BBE\u8BA1\u4EA7\u7269 ${p.designCount}`;
  }).join("\n");
  return ok(`\u2550\u2550\u2550 \u9879\u76EE\u6CE8\u518C\u8868\uFF08${projects.length}\uFF09\u2550\u2550\u2550
${lines || "\uFF08\u7A7A\uFF09"}`, { projects });
}
function toolProjectsAdd(args) {
  const path2 = String(args.path ?? "").trim();
  if (!path2) return fail("\u7F3A\u5C11 path\uFF1A\u8981\u767B\u8BB0\u7684\u9879\u76EE\u6839\u76EE\u5F55\u7EDD\u5BF9\u8DEF\u5F84\u3002");
  if (!existsSync3(path2)) return fail(`\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${path2}`);
  let res;
  try {
    res = registryAdd(path2, args.name ? String(args.name) : "");
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const s = registrySummaries(projectRoot()).find((x) => x.id === res.entry.id);
  return ok(
    `${res.added ? "\u5DF2\u767B\u8BB0\u9879\u76EE" : "\u9879\u76EE\u5DF2\u5728\u6CE8\u518C\u8868"}\uFF1A${res.entry.name}\uFF08${res.entry.path}\uFF09${s?.archived ? "" : "\n\u6CE8\u610F\uFF1A\u8BE5\u9879\u76EE\u8FD8\u6CA1\u6709 .wudi \u6863\u6848\uFF0C\u53BB\u8BE5\u9879\u76EE\u5DE5\u4F5C\u533A\u8DD1 /wudi \u5EFA\u6863\u3002"}`,
    { project: s }
  );
}
function toolProjectsRemove(args) {
  const removed = registryRemove(String(args.id ?? "").trim());
  if (!removed) return fail(`\u6CE8\u518C\u8868\u4E2D\u627E\u4E0D\u5230 ${args.id}\uFF08\u7528 wudi_projects_list \u67E5 id\uFF09\u3002`);
  return ok(`\u5DF2\u4ECE\u6CE8\u518C\u8868\u79FB\u9664\uFF1A${removed.name}\uFF08${removed.path}\uFF09\u3002\u9879\u76EE\u6587\u4EF6\u672C\u8EAB\u672A\u5220\u9664\u3002`, { removed });
}
function toolCanvasBridge() {
  if (!bridgePort) return fail("\u534F\u540C\u6865\u5C1A\u672A\u5C31\u7EEA\uFF0C\u7A0D\u540E\u91CD\u8BD5\u3002");
  return ok(`\u5B9E\u65F6\u534F\u540C\u6865\uFF1Ahttp://127.0.0.1:${bridgePort}/bridge\uFF08SSE\uFF0C\u753B\u5E03\u53D8\u66F4\u63A8\u9001\uFF09`, { url: `http://127.0.0.1:${bridgePort}/bridge` });
}
function toolCanvasGet() {
  const canvas = loadCanvas();
  return ok(`\u8BBE\u8BA1\u753B\u5E03\uFF08${canvas.shapes.length} \u4E2A\u5F62\u72B6\uFF09\uFF1A
${j(canvas)}`, { canvas });
}
function toolCanvasEdit(args = {}) {
  const ops = args.ops;
  if (!Array.isArray(ops) || !ops.length) return fail("\u7F3A\u5C11 ops \u6570\u7EC4\uFF08add/update/delete/add_frame/update_frame/delete_frame \u6279\u91CF\u64CD\u4F5C\uFF09\u3002");
  const canvas = loadCanvas();
  const validFrames = new Set(canvas.frames.map((f) => f.id));
  const summary = [];
  for (const [i, op] of ops.entries()) {
    try {
      if (op?.op === "add") {
        const shape = sanitizeShape(op.shape, i, validFrames);
        if (canvas.shapes.length >= 1e3) throw new Error("\u753B\u5E03\u5DF2\u8FBE 1000 \u5F62\u72B6\u4E0A\u9650\uFF0C\u5148\u5220\u9664\u518D\u6DFB\u52A0\u3002");
        canvas.shapes.push(shape);
        summary.push(`+ ${shape.type} ${shape.id} @(${shape.x},${shape.y})${shape.frameId ? ` in ${shape.frameId}` : ""}`);
      } else if (op?.op === "update") {
        const idx = canvas.shapes.findIndex((s) => s.id === op.id);
        if (idx < 0) throw new Error(`\u627E\u4E0D\u5230\u5F62\u72B6 ${op.id}`);
        const merged = { ...canvas.shapes[idx], ...op.patch ?? {} };
        canvas.shapes[idx] = sanitizeShape(merged, i, validFrames);
        summary.push(`~ ${op.id}`);
      } else if (op?.op === "delete") {
        const ids = new Set(Array.isArray(op.ids) ? op.ids : [op.id].filter(Boolean));
        const before = canvas.shapes.length;
        canvas.shapes = canvas.shapes.filter((s) => !ids.has(s.id));
        summary.push(`- ${before - canvas.shapes.length} \u4E2A\u5F62\u72B6`);
      } else if (op?.op === "add_frame") {
        if (canvas.frames.length >= 50) throw new Error("\u753B\u677F\u6570\u5DF2\u8FBE 50 \u4E0A\u9650\u3002");
        const frame = sanitizeFrame(op.frame, canvas.frames.length);
        canvas.frames.push(frame);
        summary.push(`+ \u753B\u677F ${frame.name} ${frame.id} @(${frame.x},${frame.y}) ${frame.w}x${frame.h}`);
      } else if (op?.op === "update_frame") {
        const idx = canvas.frames.findIndex((f) => f.id === op.id);
        if (idx < 0) throw new Error(`\u627E\u4E0D\u5230\u753B\u677F ${op.id}`);
        canvas.frames[idx] = sanitizeFrame({ ...canvas.frames[idx], ...op.patch ?? {} }, idx);
        summary.push(`~ \u753B\u677F ${op.id}`);
      } else if (op?.op === "delete_frame") {
        const frame = deleteFrame(canvas, String(op.id ?? ""), op.withShapes === true);
        summary.push(`- \u753B\u677F ${frame.name}${op.withShapes ? "\uFF08\u542B\u5F62\u72B6\uFF09" : "\uFF08\u5F62\u72B6\u8F6C\u6E38\u79BB\uFF09"}`);
      } else if (op?.op === "reorder") {
        const idx = canvas.shapes.findIndex((s) => s.id === op.id);
        if (idx < 0) throw new Error(`\u627E\u4E0D\u5230\u5F62\u72B6 ${op.id}`);
        const [sh] = canvas.shapes.splice(idx, 1);
        if (op.to === "front") canvas.shapes.push(sh);
        else canvas.shapes.unshift(sh);
        summary.push(`\u21C5 ${op.id} ${op.to === "front" ? "\u7F6E\u9876" : "\u7F6E\u5E95"}`);
      } else if (op?.op === "replace") {
        const frames = (op.canvas?.frames ?? []).map((f, fi) => sanitizeFrame(f, fi));
        const valid = new Set(frames.map((f) => f.id));
        const shapes = (op.canvas?.shapes ?? []).map((sh, si) => sanitizeShape(sh, si, valid));
        canvas.frames = frames;
        canvas.shapes = shapes;
        summary.push(`\u21BA \u5168\u91CF\u66FF\u6362\uFF08${frames.length} \u753B\u677F / ${shapes.length} \u5F62\u72B6\uFF09`);
      } else {
        throw new Error(`ops[${i}] \u7684 op \u975E\u6CD5\uFF1A${op?.op}`);
      }
    } catch (err) {
      return fail(`ops[${i}] \u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
    }
  }
  saveCanvas(canvas);
  broadcastCanvasChanged();
  return ok(`\u753B\u5E03\u5DF2\u66F4\u65B0\uFF08${canvas.frames.length} \u753B\u677F / ${canvas.shapes.length} \u5F62\u72B6\uFF09\uFF1A
${summary.map((s) => `- ${s}`).join("\n")}`, { canvas });
}
function toolCanvasClear(args = {}) {
  if (args.confirm !== true) return fail("\u6E05\u7A7A\u753B\u5E03\u9700 confirm=true\u3002\u5EFA\u8BAE\u5148 wudi_canvas_get \u5C55\u793A\u73B0\u72B6\u5F81\u5F97\u7528\u6237\u540C\u610F\u3002");
  const canvas = loadCanvas();
  const n = canvas.shapes.length;
  const fn = canvas.frames.length;
  saveCanvas({ frames: [], shapes: [] });
  broadcastCanvasChanged();
  return ok(`\u753B\u5E03\u5DF2\u6E05\u7A7A\uFF08\u79FB\u9664 ${fn} \u753B\u677F / ${n} \u5F62\u72B6\uFF09\u3002`, { canvas: { frames: [], shapes: [] } });
}
function toolCanvasExport(args = {}) {
  const name = String(args.name ?? "").trim();
  if (!name) return fail("\u7F3A\u5C11 name\uFF08\u8BBE\u8BA1\u7A3F\u6587\u4EF6\u540D\uFF0C\u5982 app-wireframe-v1\uFF09\u3002");
  const canvas = loadCanvas();
  if (!canvas.shapes.length && !canvas.frames.length) return fail("\u753B\u5E03\u662F\u7A7A\u7684\uFF0C\u5148 wudi_canvas_edit \u6DFB\u52A0\u753B\u677F\u4E0E\u5F62\u72B6\u518D\u5BFC\u51FA\u3002");
  const format = ["html", "excalidraw", "both"].includes(String(args.format)) ? String(args.format) : "html";
  const lines = [];
  const out = {};
  if (format === "html" || format === "both") {
    const outputs = exportCanvasToMockups(canvas, name);
    for (const o of outputs) {
      registerDoc({ path: o.relPath, type: "doc", title: `\u753B\u5E03\u5BFC\u51FA\uFF1A${o.frame}`, source: "canvas export" });
      lines.push(`- \u753B\u677F\u300C${o.frame}\u300D\u2192 ${o.relPath}\uFF08${o.shapes} \u5F62\u72B6\uFF0C\u5DF2\u8FDB\u56FE\u5E93\uFF09`);
    }
    out.mockups = outputs;
  }
  if (format === "excalidraw" || format === "both") {
    const ex = exportCanvasToExcalidraw(canvas, name);
    out.excalidraw = ex.relPath;
    lines.push(`- Excalidraw \u573A\u666F\uFF1A${ex.relPath}\uFF08${ex.elements} \u5143\u7D20\uFF0C\u753B\u677F\u6620\u5C04\u4E3A frame\uFF09`);
    lines.push("  \u7EE7\u7EED\u7F16\u8F91\uFF1A\u8BA9 Agent \u8C03\u5B98\u65B9 Excalidraw \u63D2\u4EF6\u7684 open_diagram \u5BFC\u5165\u8BE5\u6587\u4EF6\uFF0C\u5728\u5B8C\u6574\u7EA7\u65E0\u9650\u753B\u5E03\u4E2D\u62D6\u62FD/\u8FDE\u7EBF/\u6539\u6837\u5F0F\u3002");
  }
  return ok(
    [`\u753B\u5E03\u5DF2\u5BFC\u51FA\uFF08${format}\uFF0C${canvas.frames.length} \u753B\u677F\uFF09\uFF1A`, ...lines, "", "\u4E0B\u4E00\u6B65\uFF1AHTML \u7248\u6309 wudi-ui \u6D41\u7A0B\u63A5 tokens \u7CBE\u4FEE\uFF1Bexcalidraw \u7248\u5728\u5B8C\u6574\u7EA7\u65E0\u9650\u753B\u5E03\u81EA\u7531\u7F16\u8F91\u3002"].join("\n"),
    out
  );
}
function isoWeek(d = /* @__PURE__ */ new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 864e5 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}
async function toolDocsWeekly(args = {}) {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 90);
  const author = String(args.author ?? "").trim();
  let out;
  try {
    const r = await localRun(
      `git log --since=${q(`${days} days ago`)} --pretty=format:${q("%h|%ad|%an|%s")} --date=short${author ? ` --author ${q(author)}` : ""}`,
      { cwd: projectRoot(), timeoutMs: 3e4 }
    );
    out = r.stdout.trim();
  } catch (err) {
    return fail(`git log \u5931\u8D25\uFF08\u9879\u76EE\u6839\u4E0D\u662F git \u4ED3\u5E93\uFF1F\uFF09\uFF1A${String(err?.message ?? err).slice(0, 300)}`);
  }
  if (!out) return ok(`\u6700\u8FD1 ${days} \u5929${author ? `\uFF08\u4F5C\u8005 ${author}\uFF09` : ""}\u6CA1\u6709 commit\uFF0C\u5468\u62A5\u65E0\u53EF\u5199\u5185\u5BB9\u3002`);
  const byDate = /* @__PURE__ */ new Map();
  const authors = /* @__PURE__ */ new Set();
  let total = 0;
  for (const line of out.split("\n")) {
    const [hash = "", date = "", who = "", ...rest] = line.split("|");
    const subject = rest.join("|").trim();
    if (!hash || !date || !subject) continue;
    total++;
    authors.add(who);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ hash: hash.slice(0, 7), who, subject });
  }
  const { year, week } = isoWeek();
  const relPath = `docs/weekly/${year}-W${String(week).padStart(2, "0")}.md`;
  const absPath = join2(projectRoot(), relPath);
  const dates = [...byDate.keys()].sort();
  const md = [
    `# \u5468\u62A5 ${year}-W${String(week).padStart(2, "0")}`,
    "",
    `> \u81EA\u52A8\u751F\u6210\u81EA git log\uFF08\u8FD1 ${days} \u5929${author ? `\uFF0C\u4F5C\u8005 ${author}` : ""}\uFF0C\u622A\u81F3 ${dates.at(-1)}\uFF09\u3002commit \u539F\u6587\u504F\u6280\u672F\u89C6\u89D2\uFF0C\u63D0\u4EA4\u524D\u8BF7\u628A\u300C\u672C\u5468\u5B8C\u6210\u300D\u6539\u5199\u6210\u7528\u6237\u4EF7\u503C\u8BED\u8A00\u3002`,
    "",
    "## \u6982\u89C8",
    `- \u63D0\u4EA4\u6570\uFF1A${total}\uFF08\u6D3B\u8DC3 ${byDate.size} \u5929\uFF09`,
    `- \u4F5C\u8005\uFF1A${[...authors].join("\u3001") || "?"}`,
    "",
    "## \u9010\u65E5\u8FDB\u5C55",
    ...dates.flatMap((d) => [
      `### ${d}\uFF08${byDate.get(d).length} \u6761\uFF09`,
      ...byDate.get(d).map((c) => `- \`${c.hash}\` ${c.subject}\uFF08${c.who}\uFF09`),
      ""
    ]),
    "## \u672C\u5468\u5B8C\u6210\uFF08\u4EBA\u5DE5\u8865\u5145\uFF1A\u4ECE\u4E0A\u9762\u63D0\u70BC\u6210\u7528\u6237\u4EF7\u503C\u8BED\u8A00\uFF09",
    "- [ ] ",
    "",
    "## \u4E0B\u5468\u8BA1\u5212\uFF08\u4EBA\u5DE5\u8865\u5145\uFF09",
    "- [ ] ",
    ""
  ].join("\n");
  try {
    const { mkdirSync: mkdirSync3, writeFileSync: writeFileSync3 } = await import("node:fs");
    mkdirSync3(join2(projectRoot(), "docs", "weekly"), { recursive: true });
    writeFileSync3(absPath, md, "utf-8");
  } catch (err) {
    return fail(`\u5468\u62A5\u5199\u5165\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 300)}`);
  }
  registerDoc({ path: relPath, type: "weekly", title: `\u5468\u62A5 ${year}-W${String(week).padStart(2, "0")}`, source: `git log ${days}d` });
  return ok(
    [
      `\u5468\u62A5\u8349\u7A3F\u5DF2\u751F\u6210\uFF1A${relPath}\uFF08\u5DF2\u767B\u8BB0\u6587\u6863\u5E93\uFF09`,
      `- \u63D0\u4EA4 ${total} \u6761\uFF0C\u6D3B\u8DC3 ${byDate.size} \u5929\uFF0C\u4F5C\u8005 ${[...authors].join("\u3001") || "?"}`,
      `- \u65E5\u671F\u8303\u56F4\uFF1A${dates[0]} ~ ${dates.at(-1)}`,
      "\u4E0B\u4E00\u6B65\uFF1A\u4EBA\u5DE5\u628A\u300C\u672C\u5468\u5B8C\u6210\u300D\u6539\u5199\u6210\u7528\u6237\u4EF7\u503C\u8BED\u8A00\u540E\u5373\u53EF\u53D1\u51FA\uFF08\u53EF\u7528 /wudi-docs export \u8F6C\u4EA4\u4ED8\u683C\u5F0F\uFF09\u3002"
    ].join("\n"),
    { path: relPath, total, activeDays: byDate.size }
  );
}
async function toolFigmaImages(args = {}) {
  if (!figmaToken()) {
    return ok(
      [
        "Figma \u63A5\u5165\u672A\u542F\u7528\uFF1A\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u8FD8\u6CA1\u6709\u914D\u7F6E figmaToken\uFF08\u540C wudi_figma_fetch \u7684\u542F\u7528\u6B65\u9AA4\uFF09\u3002",
        "\u914D\u7F6E\u540E\u672C\u5DE5\u5177\u628A\u8282\u70B9\u6E32\u67D3\u6210 PNG \u4E0B\u8F7D\u5230 .wudi/design/figma/\uFF0C\u4F9B\u4E0E\u5B9E\u73B0\u622A\u56FE\u505A\u89C6\u89C9\u6BD4\u5BF9\u3002"
      ].join("\n")
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const nodeIds = String(args.nodeIds ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.replace("-", ":"));
  if (!nodeIds.length) return fail("\u7F3A\u5C11 nodeIds\uFF1A\u4ECE wudi_figma_fetch \u8FD4\u56DE\u7684\u7ED3\u6784\u91CC\u53D6\u8282\u70B9 id\uFF0C\u9017\u53F7\u5206\u9694\uFF08\u5982 12:34,12:35\uFF09\u3002");
  const scale = Math.min(Math.max(Number(args.scale) || 2, 0.01), 4);
  try {
    const images = await fetchFigmaImages({ fileKey: ref.fileKey, nodeIds, scale });
    const outDir = join2(wudiDir(), "design", "figma");
    const { mkdirSync: mkdirSync3, writeFileSync: writeFileSync3 } = await import("node:fs");
    mkdirSync3(outDir, { recursive: true });
    const saved = [];
    const failedNodes = [];
    for (const [nodeId, url] of Object.entries(images)) {
      if (!url) {
        failedNodes.push(nodeId);
        continue;
      }
      const fname = `${ref.fileKey}-${nodeId.replace(/[^0-9:]/g, "_")}-x${scale}.png`.replaceAll(":", "-");
      const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(6e4) })).arrayBuffer());
      const abs = join2(outDir, fname);
      writeFileSync3(abs, buf);
      saved.push({ nodeId, path: `.wudi/design/figma/${fname}`, sizeKB: Number((buf.length / 1024).toFixed(1)) });
    }
    const lines = [
      `\u5DF2\u4E0B\u8F7D ${saved.length} \u5F20\u8BBE\u8BA1\u7A3F PNG\uFF08scale ${scale}\uFF09\uFF1A`,
      ...saved.map((s) => `- ${s.nodeId} \u2192 ${s.path}\uFF08${s.sizeKB} KB\uFF09`),
      failedNodes.length ? `\u6E32\u67D3\u5931\u8D25\u8282\u70B9\uFF1A${failedNodes.join("\u3001")}` : "",
      "",
      "\u7528\u6CD5\uFF1A\u4E0E\u5B9E\u73B0\u9875\u622A\u56FE\u5E76\u6392\u5BF9\u6BD4\uFF08\u89C6\u89C9\u6BD4\u5BF9\uFF09\uFF0C\u6216\u4EA4\u7ED9 Agent \u8BFB\u53D6\u56FE\u7247\u81EA\u67E5\u3002"
    ].filter(Boolean);
    return ok(lines.join("\n"), { images: saved, failedNodes });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN \u73AF\u5883\u53D8\u91CF\u7F3A\u5931\uFF1A\u68C0\u67E5\u63D2\u4EF6\u6E05\u5355 userConfig \u6620\u5C04\u3002");
    return fail(`Figma \u6E32\u67D3\u62C9\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
function toolDesignTokensExport(args = {}) {
  const tokens = loadTokens();
  if (!tokens) return fail("\u8FD8\u6CA1\u6709 design tokens\u3002\u5148 /wudi-ui \u6C89\u6DC0\u6216 wudi_design_tokens_set \u5199\u5165\uFF0C\u518D\u5BFC\u51FA\u3002");
  const format = ["css", "tailwind", "json"].includes(String(args.format)) ? String(args.format) : "css";
  let content = "";
  let fname = "";
  if (format === "json") {
    content = j(tokens);
    fname = "tokens.json";
  } else if (format === "tailwind") {
    const camel = (s) => String(s).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    const toJs = (obj, indent = "  ") => {
      const lines = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (v && typeof v === "object" && !Array.isArray(v)) lines.push(`${indent}${camel(k)}: {`);
        const sub = v && typeof v === "object" && !Array.isArray(v) ? toJs(v, indent + "  ") : null;
        if (sub) {
          lines.push(sub);
          lines.push(`${indent}},`);
        } else lines.push(`${indent}${camel(k)}: ${JSON.stringify(String(v))},`);
      }
      return lines.join("\n");
    };
    content = [
      "// \u7531 wudi-coding \u8BBE\u8BA1 tokens \u5BFC\u51FA\uFF1B\u5408\u5E76\u8FDB tailwind.config.js \u7684 theme.extend",
      "// \u7528\u6CD5\uFF1Atheme: { extend: { colors: {...}, spacing: {...}, borderRadius: {...}, fontSize: {...} } }",
      `{`,
      `  colors: {`,
      toJs(tokens.color ?? {}),
      `  },`,
      `  spacing: {`,
      toJs(tokens.spacing ?? {}),
      `  },`,
      `  borderRadius: {`,
      toJs(tokens.radius ?? {}),
      `  },`,
      `  fontSize: {`,
      toJs(tokens.typography ?? {}),
      `  },`,
      `}`
    ].join("\n");
    fname = "tailwind.theme.js";
  } else {
    try {
      content = readFileSync2(join2(designDir(), "tokens.css"), "utf-8");
    } catch {
      content = "";
    }
    if (!content) return fail("tokens.css \u4E0D\u5B58\u5728\uFF08tokens \u53EF\u80FD\u662F\u65E7\u7248\u5199\u5165\uFF09\uFF0C\u91CD\u8DD1\u4E00\u6B21 wudi_design_tokens_set \u751F\u6210\u540E\u518D\u5BFC\u51FA\u3002");
    fname = "tokens.css";
  }
  const exportsDir = join2(designDir(), "exports");
  mkdirSync2(exportsDir, { recursive: true });
  const outPath = join2(exportsDir, fname);
  writeFileSync2(outPath, content, "utf-8");
  return ok(
    [`tokens \u5DF2\u5BFC\u51FA\uFF08${format}\uFF09\uFF1A`, `- ${outPath}`, "", "```", clip(content, 1200), "```", "\u8F6C\u7EC4\u4EF6\u4EE3\u7801\u65F6\u5F15\u7528\u8BE5\u6587\u4EF6\uFF0C\u4E0D\u518D\u51FA\u73B0\u9B54\u6CD5\u503C\u3002"].join("\n"),
    { format, path: `.wudi/design/exports/${fname}`, content }
  );
}
async function toolNotifyTest(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u672A\u5EFA\u6863\uFF0C\u5148 wudi_project_init\u3002");
  let envObj;
  try {
    envObj = resolveEnv(project, args.env ? String(args.env) : void 0);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const cfg = resolveNotify(project, envObj);
  if (!cfg) {
    return fail(
      [
        `\u73AF\u5883 ${envObj.name} \u672A\u914D\u7F6E\u901A\u77E5 webhook\u3002\u8BBE\u7F6E\u65B9\u6CD5\uFF1A`,
        "- wudi_project_init \u4F20 notifyWebhook\uFF08\u5982\u98DE\u4E66\u7FA4\u673A\u5668\u4EBA\u5730\u5740\uFF09+ notifyFormat\uFF08feishu/wecom/generic\uFF09",
        "- \u6216 wudi_env_set \u7ED9\u5355\u4E2A\u73AF\u5883\u914D\u7F6E notifyWebhook\uFF08\u5982\u53EA\u7ED9 prod \u53D1\u901A\u77E5\uFF09",
        "\u914D\u7F6E\u540E\u91CD\u8DD1\u672C\u5DE5\u5177\u9A8C\u8BC1\u8FDE\u901A\u6027\u3002"
      ].join("\n")
    );
  }
  const res = await sendNotify(cfg, {
    project: project.name,
    env: envObj.name,
    type: "notify-test",
    status: "ok",
    release: "test-" + releaseStamp(),
    detail: "\u8FD9\u662F\u4E00\u6761 wudi-coding \u6D4B\u8BD5\u901A\u77E5\uFF0C\u6536\u5230\u5373\u914D\u7F6E\u6210\u529F\u3002"
  });
  return res.ok ? ok(`\u6D4B\u8BD5\u901A\u77E5\u5DF2\u53D1\u9001\uFF08${cfg.format} \u683C\u5F0F \u2192 ${cfg.webhook}\uFF09\uFF1A${res.detail}\u3002\u8BF7\u5230\u7FA4\u91CC\u786E\u8BA4\u6536\u5230\u3002`, { notify: res }) : fail(`\u6D4B\u8BD5\u901A\u77E5\u5931\u8D25\uFF1A${res.detail}\uFF08\u68C0\u67E5 webhook \u5730\u5740\u4E0E\u7F51\u7EDC\u8FDE\u901A\u6027\uFF09`);
}
function flattenTokens(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path2 = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenTokens(v, path2, out);
    else if (v !== null && v !== void 0) out[path2] = String(v);
  }
  return out;
}
function toolTokensCompare(args = {}) {
  let incoming = args.tokens;
  if (!incoming && args.json !== void 0) {
    try {
      incoming = JSON.parse(String(args.json));
    } catch (err) {
      return fail(`json \u53C2\u6570\u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${String(err?.message ?? err).slice(0, 200)}`);
    }
  }
  if (!incoming || typeof incoming !== "object") return fail("\u7F3A\u5C11 tokens \u5BF9\u8C61\uFF08\u6216 json \u5B57\u7B26\u4E32\uFF09\u3002");
  const local = loadTokens();
  if (!local) return fail("\u672C\u5730\u8FD8\u6CA1\u6709 design tokens\uFF0C\u5148 wudi_design_tokens_set \u5EFA\u7ACB\u57FA\u51C6\u518D\u6BD4\u5BF9\u3002");
  const flatIn = flattenTokens(incoming);
  const flatLocal = flattenTokens(local);
  const added = Object.keys(flatIn).filter((k) => !(k in flatLocal)).map((k) => ({ key: k, value: flatIn[k] }));
  const changed = Object.keys(flatIn).filter((k) => k in flatLocal && flatLocal[k] !== flatIn[k]).map((k) => ({ key: k, local: flatLocal[k], incoming: flatIn[k] }));
  const removed = Object.keys(flatLocal).filter((k) => !(k in flatIn)).map((k) => ({ key: k, value: flatLocal[k] }));
  const same = Object.keys(flatIn).length - added.length - changed.length;
  const lines = [
    `\u2550\u2550\u2550 tokens \u6BD4\u5BF9\uFF08\u5916\u90E8 vs \u672C\u5730\uFF09\u2550\u2550\u2550`,
    `\u5916\u90E8 ${Object.keys(flatIn).length} \u952E / \u672C\u5730 ${Object.keys(flatLocal).length} \u952E\uFF5C\u4E00\u81F4 ${same}`,
    "",
    `\u3010\u65B0\u589E\u3011\u5916\u90E8\u6709\u672C\u5730\u65E0\uFF08${added.length}\uFF09\uFF1A`,
    ...added.slice(0, 20).map((a) => `- ${a.key} = ${a.value}`),
    added.length > 20 ? `  \u2026\u5171 ${added.length} \u6761` : "",
    "",
    `\u3010\u53D8\u66F4\u3011\u540C\u952E\u4E0D\u540C\u503C\uFF08${changed.length}\uFF09\uFF1A`,
    ...changed.slice(0, 20).map((c) => `- ${c.key}: ${c.local} \u2192 ${c.incoming}`),
    changed.length > 20 ? `  \u2026\u5171 ${changed.length} \u6761` : "",
    "",
    `\u3010\u79FB\u9664\u3011\u672C\u5730\u6709\u5916\u90E8\u65E0\uFF08${removed.length}\uFF09\uFF1A`,
    ...removed.slice(0, 20).map((r) => `- ${r.key} = ${r.value}`),
    removed.length > 20 ? `  \u2026\u5171 ${removed.length} \u6761` : "",
    "",
    "\u5904\u7F6E\uFF1A\u786E\u8BA4\u540E\u628A\u5408\u5E76\u7ED3\u679C\u7528 wudi_design_tokens_set \u6574\u4F53\u5199\u5165\uFF08\u5199\u524D\u53EF\u8BA9\u7528\u6237\u8FC7\u76EE\u672C\u62A5\u544A\uFF09\u3002"
  ].filter(Boolean);
  return ok(lines.join("\n").slice(0, 3e4), { added, changed, removed, same });
}
function resolveDesignFile(p) {
  const dir = resolve2(join2(projectRoot(), "designs"));
  const base = String(p ?? "").trim().replace(/^designs\//i, "");
  if (!/^[\w.-]+\.(fig|pen)$/i.test(base)) throw new Error(`\u975E\u6CD5\u8BBE\u8BA1\u7A3F\u540D\uFF1A${p}\uFF08\u4EC5\u5141\u8BB8 designs/<\u540D\u79F0>.fig/.pen\uFF09`);
  const file = resolve2(dir, base);
  if (!file.startsWith(dir + "/")) throw new Error(`\u975E\u6CD5\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF1A${p}`);
  return { dir, file, base };
}
function toolDesignDelete(args = {}) {
  const path2 = String(args?.path ?? "").trim();
  if (!path2) return fail("\u7F3A\u5C11 path\uFF1A\u8981\u5220\u9664\u7684\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF0C\u5982 designs/old.fig\u3002");
  let file;
  try {
    file = resolveDesignFile(path2).file;
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!existsSync3(file)) return fail(`\u8BBE\u8BA1\u7A3F\u4E0D\u5B58\u5728\uFF1A${path2}`);
  rmSync(file);
  return ok(`\u5DF2\u5220\u9664\u8BBE\u8BA1\u7A3F\uFF1A${path2}`);
}
function toolDesignRename(args = {}) {
  const path2 = String(args?.path ?? "").trim();
  const name = String(args?.name ?? "").trim();
  if (!path2 || !name) return fail("\u7F3A\u5C11\u53C2\u6570\uFF1Apath\uFF08\u73B0\u6709\u8BBE\u8BA1\u7A3F\uFF09\u4E0E name\uFF08\u65B0\u6587\u4EF6\u540D\uFF0C\u5982 new.fig\uFF09\u3002");
  let dir, file, base;
  try {
    ({ dir, file, base } = resolveDesignFile(path2));
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!/^[\w.-]+\.(fig|pen)$/i.test(name)) return fail(`\u975E\u6CD5\u65B0\u6587\u4EF6\u540D\uFF1A${name}\uFF08\u4EC5\u5141\u8BB8 <\u540D\u79F0>.fig/.pen\uFF09`);
  if (!existsSync3(file)) return fail(`\u8BBE\u8BA1\u7A3F\u4E0D\u5B58\u5728\uFF1A${path2}`);
  const target = resolve2(dir, name);
  if (!target.startsWith(dir + "/")) return fail(`\u975E\u6CD5\u76EE\u6807\u8DEF\u5F84\uFF1A${name}`);
  if (existsSync3(target)) return fail(`\u76EE\u6807\u5DF2\u5B58\u5728\uFF1Adesigns/${name}`);
  renameSync2(file, target);
  return ok(`\u5DF2\u91CD\u547D\u540D\uFF1A${base} \u2192 designs/${name}`, { path: `designs/${name}` });
}
function toolDesignsList() {
  const dir = join2(projectRoot(), "designs");
  const designs = [];
  try {
    for (const f of readdirSync2(dir)) {
      if (!/\.(fig|pen)$/i.test(f)) continue;
      const st = statSync(join2(dir, f));
      designs.push({
        name: f,
        path: `designs/${f}`,
        format: f.toLowerCase().endsWith(".fig") ? "fig\uFF08\u53EF\u7F16\u8F91\uFF09" : "pen\uFF08\u53EA\u8BFB\u5BFC\u5165\uFF09",
        sizeKB: Number((st.size / 1024).toFixed(1)),
        updatedAt: st.mtime.toISOString()
      });
    }
  } catch {
  }
  designs.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
  const lines = designs.length ? designs.map((d) => `- ${d.name}\uFF08${d.format}\uFF0C${d.sizeKB} KB\uFF0C${d.updatedAt.slice(0, 16).replace("T", " ")}\uFF09`).join("\n") : "\uFF08designs/ \u76EE\u5F55\u8FD8\u6CA1\u6709\u8BBE\u8BA1\u7A3F\u3002\u7528 OpenPencil \u7684 new_design \u521B\u5EFA\uFF0C\u6216\u8BA9 Agent \u5EFA\u7A3F\u3002\uFF09";
  return ok(`\u8BBE\u8BA1\u7A3F\uFF08${designs.length}\uFF09\uFF1A
${lines}

\u4EA4\u4E92\uFF1Aopen_design \u6253\u5F00\u534F\u540C\u7F16\u8F91 \u2192 create_shape/render \u6539\u5185\u5BB9 \u2192 export_image \u6E32\u67D3 PNG \u5230 .wudi/design/renders/ \u8FDB\u9762\u677F\u56FE\u5899\u3002`, { designs });
}
function toolFigmaLink(args = {}) {
  if (args.url === void 0) {
    const url = getFigmaUrl();
    return url ? ok(`\u5F53\u524D Figma \u6587\u4EF6\u94FE\u63A5\uFF1A${url}`, { url }) : ok("\u5C1A\u672A\u8BBE\u7F6E Figma \u6587\u4EF6\u94FE\u63A5\u3002\u8C03\u7528\u672C\u5DE5\u5177\u4F20 url\uFF08https://www.figma.com/ \u5F00\u5934\uFF09\u8BB0\u4F4F\u540E\u9762\u677F\u53EF\u4E00\u952E\u6253\u5F00\u3002");
  }
  try {
    const url = setFigmaUrl(args.url);
    return ok(`Figma \u6587\u4EF6\u94FE\u63A5\u5DF2\u4FDD\u5B58\uFF1A${url}
\u8FB9\u754C\u8BF4\u660E\uFF1AFigma API \u53EA\u8BFB \u2014\u2014 Agent \u53EF\u62C9\u53D6\u7ED3\u6784/\u6E32\u67D3\u56FE/\u6BD4\u5BF9 tokens\uFF08wudi_figma_*\uFF09\uFF0C\u4F46\u6539\u4E0D\u4E86 Figma \u6587\u4EF6\uFF1B\u9700\u8981 Agent \u5199\u7684\u8BBE\u8BA1\u8BF7\u8D70 Excalidraw \u753B\u5E03\u3002`, { url });
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
}
async function toolFigmaTokensDiff(args = {}) {
  if (!figmaToken()) {
    return ok(
      "Figma \u63A5\u5165\u672A\u542F\u7528\uFF1A\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u8FD8\u6CA1\u6709\u914D\u7F6E figmaToken\uFF08\u540C wudi_figma_fetch \u7684\u542F\u7528\u6B65\u9AA4\uFF09\u3002\u914D\u7F6E\u540E\u672C\u5DE5\u5177\u628A\u753B\u677F\u6837\u5F0F\u4E0E\u672C\u5730 design tokens \u81EA\u52A8\u6BD4\u5BF9\u3002"
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!ref.nodeId) {
    return fail("\u5EFA\u8BAE\u5E26 node-id \u6307\u5411\u5B9A\u7A3F\u753B\u677F\uFF08\u5426\u5219\u626B\u63CF\u6574\u6587\u4EF6\u566A\u58F0\u5927\uFF09\u3002\u793A\u4F8B\uFF1Ahttps://www.figma.com/design/<key>/<file>?node-id=12-34");
  }
  const localTokens = loadTokens();
  if (!localTokens) {
    return fail("\u672C\u5730\u8FD8\u6CA1\u6709 design tokens\uFF08.wudi/design/tokens.json\uFF09\u3002\u5148 /wudi-ui \u5EFA\u7ACB\u89C4\u8303\u6216\u7528 wudi_design_tokens_set \u5199\u5165\uFF0C\u518D\u56DE\u6765\u6BD4\u5BF9\u3002");
  }
  try {
    const data = await fetchFigmaStructure({
      fileKey: ref.fileKey,
      nodeId: ref.nodeId,
      maxDepth: Math.min(Math.max(Number(args.maxDepth) || 8, 1), 12),
      budgetMax: 2e3
    });
    const styles = extractStyles(data.tree);
    const localColors = /* @__PURE__ */ new Set();
    const localSizes = /* @__PURE__ */ new Set();
    for (const v of Object.values(localTokens.color ?? {})) {
      if (typeof v === "string") localColors.add(v.toLowerCase());
    }
    for (const v of Object.values(localTokens.typography ?? {})) {
      const m = typeof v === "string" ? v.match(/^(\d+(?:\.\d+)?)px$/) : null;
      if (m) localSizes.add(String(Number(m[1])));
    }
    const missingColors = styles.colors.filter((c) => !localColors.has(c.hex.toLowerCase()));
    const unusedColors = [...localColors].filter((c) => !styles.colors.some((s) => s.hex.toLowerCase() === c));
    const missingSizes = styles.fontSizes.filter((s) => !localSizes.has(String(s.size)));
    const unusedSizes = [...localSizes].filter((s) => !styles.fontSizes.some((x) => String(x.size) === s));
    const lines = [
      `\u2550\u2550\u2550 Figma \u2194 tokens \u6BD4\u5BF9\uFF08\u8282\u70B9 ${ref.nodeId}\uFF0C\u626B\u63CF ${styles.visited} \u8282\u70B9\uFF09\u2550\u2550\u2550`,
      `\u8BBE\u8BA1\u7A3F\u989C\u8272 ${styles.colors.length} \u79CD / \u5B57\u53F7 ${styles.fontSizes.length} \u6863\uFF1B\u672C\u5730 tokens \u989C\u8272 ${localColors.size} / \u5B57\u53F7 ${localSizes.size}`,
      "",
      `\u3010tokens \u7F3A\u5931\u3011\u8BBE\u8BA1\u7A3F\u51FA\u73B0\u4F46 tokens \u6CA1\u6709\uFF08${missingColors.length} \u8272 / ${missingSizes.length} \u6863\uFF09\uFF1A`,
      ...missingColors.slice(0, 15).map((c) => `- ${c.hex}\uFF08\u51FA\u73B0 ${c.count} \u6B21\uFF09`),
      ...missingSizes.slice(0, 10).map((s) => `- ${s.size}px\uFF08\u51FA\u73B0 ${s.count} \u6B21\uFF09`),
      !missingColors.length && !missingSizes.length ? "  \uFF08\u65E0\u7F3A\u5931 \u2713\uFF09" : "",
      "",
      `\u3010tokens \u672A\u7528\u3011tokens \u6709\u4F46\u8BE5\u753B\u677F\u672A\u51FA\u73B0\uFF08${unusedColors.length} \u8272 / ${unusedSizes.length} \u6863\uFF09\uFF1A`,
      ...unusedColors.slice(0, 15).map((c) => `- ${c}`),
      ...unusedSizes.slice(0, 10).map((s) => `- ${s}px`),
      !unusedColors.length && !unusedSizes.length ? "  \uFF08\u65E0\u672A\u7528 \u2713\uFF09" : "",
      "",
      "\u5904\u7F6E\u5EFA\u8BAE\uFF1A\u7F3A\u5931\u9879\u786E\u8BA4\u540E\u7528 wudi_design_tokens_set \u8865\u5165\uFF1B\u672A\u7528\u9879\u786E\u8BA4\u662F\u522B\u7684\u753B\u677F\u5728\u7528\u8FD8\u662F\u89C4\u8303\u8FC7\u65F6\uFF08\u672C\u5DE5\u5177\u53EA\u51FA\u62A5\u544A\u4E0D\u6539 tokens\uFF09\u3002"
    ].filter(Boolean);
    return ok(lines.join("\n").slice(0, 3e4), { missingColors, missingSizes, unusedColors, unusedSizes, scanned: styles.visited });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN \u73AF\u5883\u53D8\u91CF\u7F3A\u5931\uFF1A\u68C0\u67E5\u63D2\u4EF6\u6E05\u5355 userConfig \u6620\u5C04\u3002");
    return fail(`\u6BD4\u5BF9\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 800)}`);
  }
}
function listLocalArtifacts() {
  const dir = join2(wudiDir(), "artifacts");
  if (!existsSync3(dir)) return [];
  return readdirSync2(dir).filter((f) => /\.(tar|tar\.gz)$/.test(f)).sort().reverse().slice(0, 10).map((name) => {
    const sizeMB = (statSync(join2(dir, name)).size / 1024 / 1024).toFixed(1);
    return { name, sizeMB: Number(sizeMB) };
  });
}
async function pruneReleases(envObj) {
  const releasesDir = join2(envObj.deployRoot, "releases");
  const { stdout } = await sshRun(`ls -1 ${q(releasesDir)}`, { timeoutMs: 3e4, overrides: envObj.ssh });
  const all = parseRemoteReleases(stdout);
  const keep = all.slice(0, 5);
  const toDelete = all.filter((r) => !keep.includes(r));
  if (!toDelete.length) return "\u65E7\u7248\u672C\u6E05\u7406\uFF1A\u65E0\u9700\u6E05\u7406\uFF08\u5171 " + all.length + " \u4E2A\u7248\u672C\uFF09\u3002";
  for (const r of toDelete) {
    await sshRun(`rm -rf -- ${q(join2(releasesDir, r))}`, { timeoutMs: 12e4, overrides: envObj.ssh });
  }
  return `\u65E7\u7248\u672C\u6E05\u7406\uFF1A\u5DF2\u5220\u9664 ${toDelete.length} \u4E2A\uFF08${toDelete.join(", ")}\uFF09\uFF0C\u4FDD\u7559\u6700\u8FD1 5 \u4E2A\uFF08${keep.join(", ")}\uFF09\u3002`;
}

// src/openpencil.ts
import { spawn } from "node:child_process";
import { dirname, join as join3, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
var vendorRoot = resolve3(join3(dirname(fileURLToPath(import.meta.url)), "..", "vendor", "openpencil"));
var childServerPath = join3(vendorRoot, "dist", "server.mjs");
var child = null;
var pendingId = 0;
var pending = /* @__PURE__ */ new Map();
var childStderr = "";
var buffer = "";
var initDone = null;
function ensureChild(env = {}) {
  if (child) return child;
  const wsRoot = env.workspaceRoot || process.env.AOPC_PROJECT_DIR || process.env.AOPC_WORKSPACE_ROOT || process.cwd();
  try {
    child = spawn(process.execPath, [childServerPath], {
      env: {
        ...process.env,
        ZCODE_WORKSPACE_ROOT: wsRoot,
        ZCODE_PLUGIN_ROOT: vendorRoot,
        ZCODE_WORKSPACE_IDENTITY: wsRoot
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (err) {
    console.error("[wudi] OpenPencil spawn \u5931\u8D25:", err.message);
    child = null;
    return;
  }
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
        if (msg.id !== void 0 && pending.has(msg.id)) {
          pending.get(msg.id)(msg);
          pending.delete(msg.id);
        }
      } catch {
      }
    }
  });
  child.stderr.on("data", (d) => {
    childStderr += d;
  });
  child.on("exit", (code) => {
    console.error("[wudi] OpenPencil \u5B50\u8FDB\u7A0B\u9000\u51FA code=" + code);
    child = null;
    initDone = null;
  });
  initDone = request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "wudi-coding", version: "1.0" }
  }).then(() => notify("notifications/initialized"));
  return child;
}
function request(method, params) {
  ensureChild();
  const id = ++pendingId;
  const p = new Promise((res, rej) => {
    pending.set(id, res);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        rej(new Error(`openpencil \u5B50\u8FDB\u7A0B\u8BF7\u6C42\u8D85\u65F6\uFF1A${method}
stderr: ${childStderr.slice(-300)}`));
      }
    }, 6e4);
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p.then((r) => {
    if (r.error) throw Object.assign(new Error(r.error.message ?? "openpencil error"), { code: r.error.code });
    return r.result;
  });
}
function notify(method, params) {
  ensureChild();
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
async function openpencilTools() {
  await initDone;
  const r = await request("tools/list", {});
  return r.tools ?? [];
}
async function openpencilCall(name, args) {
  await initDone;
  const r = await request("tools/call", { name, arguments: args ?? {} });
  return r;
}
async function openpencilReadResource(uri) {
  await initDone;
  return request("resources/read", { uri });
}
async function openpencilBridgeEndpoint() {
  const r = await openpencilCall("get_design_status", {});
  const sc = r.structuredContent ?? {};
  return sc.bridge ?? null;
}
var _epCache = { at: 0, value: null };
async function openpencilBridgeEndpointCached() {
  if (Date.now() - _epCache.at < 3e4) return _epCache.value;
  try {
    const ep = await openpencilBridgeEndpoint();
    _epCache = { at: Date.now(), value: ep };
    return ep;
  } catch {
    _epCache = { at: Date.now(), value: null };
    return null;
  }
}
try {
  ensureChild();
} catch (e) {
  console.error("[wudi] OpenPencil \u9884\u70ED\u5931\u8D25:", e.message);
}

// src/server.ts
import { readFileSync as _rf } from "node:fs";
import { join as _join2, dirname as _dn } from "node:path";
import { fileURLToPath as _fURL2 } from "node:url";
process.on("uncaughtException", (err) => console.error("[wudi] uncaught:", err.message));
process.on("unhandledRejection", (err) => console.error("[wudi] unhandled:", String(err).slice(0, 300)));
var _vendorDir = _join2(_dn(_dn(_fURL2(import.meta.url))), "vendor", "openpencil");
var opToolsCache = (() => {
  try {
    return JSON.parse(_rf(_join2(_vendorDir, "tools-static.json"), "utf-8"));
  } catch {
    return [];
  }
})();
var SERVER_INFO = { name: "wudi-coding", version: "0.35.2" };
var PANEL_URI = "ui://wudi-coding/panel.html";
var PANEL_MIME = "text/html;profile=mcp-app";
var panelPath = resolve4(join4(dirname2(fileURLToPath2(import.meta.url)), "ui", "panel.html"));
function readPanel() {
  if (!existsSync4(panelPath)) {
    throw new Error(`\u9762\u677F\u6587\u4EF6\u7F3A\u5931\uFF1A${panelPath}\uFF08\u5148\u8FD0\u884C scripts/build-panel.mjs\uFF09`);
  }
  return readFileSync3(panelPath, "utf-8");
}
var designRoot = () => resolve4(join4(process.env.AOPC_WORKSPACE_ROOT || process.cwd(), ".wudi", "design"));
function safeDesignFile(kind, name) {
  if (!/^[\w.-]+$/.test(name)) throw new Error(`\u975E\u6CD5\u8D44\u6E90\u540D\uFF1A${name}`);
  const dir = resolve4(designRoot(), kind === "mockup" ? "mockups" : "figma");
  const file = resolve4(dir, name);
  if (!file.startsWith(dir + "/") || !existsSync4(file)) throw new Error(`\u8D44\u6E90\u4E0D\u5B58\u5728\uFF1A${kind}/${name}`);
  return file;
}
function listDesignResources() {
  const out = [];
  const scan = (sub, kind, mime) => {
    try {
      for (const f of readdirSync3(join4(designRoot(), sub))) {
        if (!/\.(html|png)$/.test(f)) continue;
        out.push({
          uri: `ui://wudi-coding/${kind}/${f}`,
          name: f,
          title: f,
          mimeType: mime,
          description: kind === "mockup" ? "UI \u8BBE\u8BA1\u7A3F\uFF08HTML\uFF09" : "\u8BBE\u8BA1\u56FE\uFF08PNG\uFF09"
        });
      }
    } catch {
    }
  };
  scan("mockups", "mockup", "text/html");
  scan("figma", "image", "image/png");
  scan("renders", "image", "image/png");
  return out;
}
function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}
`);
}
function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}
`);
}
var buffer2 = "";
var inFlight = 0;
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer2 += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer2.indexOf("\n")) >= 0) {
    const line = buffer2.slice(0, newlineIndex).trim();
    buffer2 = buffer2.slice(newlineIndex + 1);
    if (line) handleMessage(line);
  }
});
process.stdin.on("end", () => {
  const timer = setInterval(() => {
    if (inFlight <= 0) {
      clearInterval(timer);
      process.exit(0);
    }
  }, 50);
  setTimeout(() => process.exit(0), 6e5).unref();
});
function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    send(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {}, resources: {} },
      serverInfo: SERVER_INFO
    });
    return;
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "resources/list") {
    send(id, {
      resources: [
        {
          uri: PANEL_URI,
          name: "\u65E0\u654C\u7F16\u7A0B\u5DE5\u4F5C\u53F0",
          title: "\u65E0\u654C\u7F16\u7A0B\u5DE5\u4F5C\u53F0",
          description: "\u9879\u76EE\u6863\u6848\u3001SSH \u72B6\u6001\u3001\u90E8\u7F72\u5386\u53F2\u4E0E\u5065\u5EB7\u68C0\u67E5\u3001\u6587\u6863\u5E93\u3001\u5185\u5D4C\u8BBE\u8BA1\u753B\u5E03",
          mimeType: PANEL_MIME,
          // 宿主对「内容项无 _meta」的兜底读取路径（resources/list 项级）
          _meta: {
            ui: {
              csp: {
                connectDomains: [...bridgeConnectDomains(), ...fontCdnDomains()],
                resourceDomains: fontCdnDomains(),
                frameDomains: frameDomains()
              }
            }
          }
        },
        ...listDesignResources()
      ]
    });
    return;
  }
  if (method === "resources/read") {
    const uri = params?.uri ?? "";
    try {
      if (uri === PANEL_URI) {
        Promise.race([
          openpencilBridgeEndpointCached().catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 800))
        ]).then((ep) => {
          const connect = [...bridgeConnectDomains()];
          if (ep?.url) {
            try {
              const opOrigin = new URL(ep.url).origin;
              connect.push(opOrigin, opOrigin.replace(/^ws:/, "http:"));
            } catch {
            }
          }
          const meta = {
            ui: {
              csp: {
                connectDomains: [.../* @__PURE__ */ new Set([...connect, ...fontCdnDomains()])],
                resourceDomains: fontCdnDomains(),
                frameDomains: frameDomains()
              }
            },
            "aopc/csp": { wasmUnsafeEval: true, unsafeEval: true }
          };
          send(id, {
            contents: [{ uri: PANEL_URI, mimeType: PANEL_MIME, text: readPanel(), _meta: meta }],
            _meta: meta
          });
        }).catch((err) => sendError(id, -32603, `\u9762\u677F\u8D44\u6E90\u8BFB\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 200)}`));
        return;
      }
      if (uri.startsWith("ui://openpencil/")) {
        openpencilReadResource(uri).then((result) => send(id, result)).catch((err) => sendError(id, -32602, `OpenPencil \u8D44\u6E90\u8BFB\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 200)}`));
        return;
      }
      const m = uri.match(/^ui:\/\/wudi-coding\/(mockup|image)\/([\w.-]+)$/);
      if (!m) {
        sendError(id, -32602, `\u672A\u77E5\u8D44\u6E90\uFF1A${uri}\uFF08\u53EF\u7528\uFF1A${PANEL_URI} \u6216\u8BBE\u8BA1\u8D44\u6E90\uFF09`);
        return;
      }
      const file = safeDesignFile(m[1], m[2]);
      if (m[1] === "mockup") {
        send(id, { contents: [{ uri, mimeType: "text/html", text: readFileSync3(file, "utf-8") }] });
      } else {
        const b64 = readFileSync3(file).toString("base64");
        send(id, { contents: [{ uri, mimeType: "image/png", blob: b64 }] });
      }
    } catch (err) {
      sendError(id, -32603, `\u8BFB\u53D6\u8D44\u6E90\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 300)}`);
    }
    return;
  }
  if (method === "tools/list") {
    openpencilTools().then((t) => {
      opToolsCache = t;
    }).catch(() => {
    });
    send(id, { tools: [...TOOLS, ...opToolsCache] });
    return;
  }
  if (method === "tools/call") {
    inFlight++;
    const toolName = params?.name ?? "";
    const isWudiTool = TOOLS.some((t) => t.name === toolName);
    const callPromise = isWudiTool ? callTool(toolName, params?.arguments ?? {}) : openpencilCall(toolName, params?.arguments ?? {}).then((r) => ({
      content: (r.content ?? []).map((c) => ({ type: "text", text: c.text ?? "" })),
      isError: !!r.isError,
      structuredContent: r.structuredContent
    }));
    callPromise.then((result) => send(id, result)).catch((err) => sendError(id, -32603, `\u5DE5\u5177\u5185\u90E8\u9519\u8BEF\uFF1A${String(err?.message ?? err).slice(0, 500)}`)).finally(() => {
      inFlight--;
    });
    return;
  }
  if (method === "ping") {
    send(id, {});
    return;
  }
  sendError(id, -32601, `\u65B9\u6CD5\u672A\u5B9E\u73B0\uFF1A${method}`);
}
