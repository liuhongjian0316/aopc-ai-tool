/* wudi-coding server —— src/ 的构建产物，勿手改（npm run build） */

// src/server.ts
import { readFileSync as readFileSync3, existsSync as existsSync4, readdirSync as readdirSync3 } from "node:fs";
import { dirname as dirname3, join as join4, resolve as resolve4 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/tools.ts
import { existsSync as existsSync3, mkdirSync as mkdirSync2, readdirSync as readdirSync2, readFileSync as readFileSync2, renameSync as renameSync2, rmSync as rmSync2, statSync, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3, relative, resolve as resolve3, sep } from "node:path";
import { spawn as spawn2 } from "node:child_process";

// src/store.ts
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
function projectRoot() {
  const root = process.env.AOPC_PROJECT_DIR || process.env.AOPC_WORKSPACE_ROOT || process.cwd();
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
  const file = projectDataPath("project.json", abs);
  if (existsSync(file)) return file;
  const legacy = join(abs, ".wudi", "project.json");
  if (existsSync(legacy)) {
    try {
      mkdirSync(projectDataDirFor(abs), { recursive: true });
      renameSync(legacy, file);
      return file;
    } catch {
    }
  }
  mkdirSync(projectDataDirFor(abs), { recursive: true });
  const base = String(name || abs.split("/").filter(Boolean).pop() || "project").trim();
  const doc = { ...structuredClone(PROJECT_TEMPLATE), name: base };
  writeFileSync(file, JSON.stringify(doc, null, 2));
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
function projectDataPath(name, root = projectRoot()) {
  return join(projectDataDirFor(root), name);
}
function readJSONAt(root, name, fallback) {
  const abs = resolve(root);
  const target = projectDataPath(name, abs);
  if (!existsSync(target)) {
    const legacy = join(abs, ".wudi", name);
    if (existsSync(legacy)) {
      try {
        mkdirSync(projectDataDirFor(abs), { recursive: true });
        renameSync(legacy, target);
      } catch {
      }
    }
  }
  const p = existsSync(target) ? target : join(abs, ".wudi", name);
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
  const raw = readJSONAt(projectRoot(), "project.json", null);
  if (!raw) return null;
  return {
    ...structuredClone(PROJECT_TEMPLATE),
    ...raw,
    package: { ...PROJECT_TEMPLATE.package, ...raw.package ?? {} },
    healthCheck: { ...PROJECT_TEMPLATE.healthCheck, ...raw.healthCheck ?? {} },
    envs: Array.isArray(raw.envs) ? raw.envs : []
  };
}
function saveProjectAt(root, patch) {
  const current = loadProjectAt(root) ?? structuredClone(PROJECT_TEMPLATE);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v === void 0) continue;
    if (k === "package") next.package = { ...current.package, ...v };
    else if (k === "healthCheck") next.healthCheck = { ...current.healthCheck, ...v };
    else next[k] = v;
  }
  const file = writeProjectJSONAt(root, "project.json", next);
  try {
    writeDeployConfig(root, next);
  } catch {
  }
  return { project: next, file };
}
function saveProject(patch) {
  return saveProjectAt(projectRoot(), patch);
}
function writeProjectJSONAt(root, name, value) {
  const dir = projectDataDirFor(root);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, name);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
  return p;
}
function readNestedJSON(root, rel, fallback) {
  const p = join(projectDataDirFor(root), rel);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[wudi-coding] ${p} \u89E3\u6790\u5931\u8D25\uFF0C\u4F7F\u7528\u9ED8\u8BA4\u503C\uFF1A${err.message}`);
    return fallback;
  }
}
function writeNestedJSON(root, rel, value) {
  const p = join(projectDataDirFor(root), rel);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
  return p;
}
function writeDeployConfig(root, project) {
  if (!project) return null;
  return writeNestedJSON(root, "deploys/config.json", {
    build: project.build ?? "",
    package: project.package ?? {},
    deployRoot: project.deployRoot ?? "",
    remoteScript: project.remoteScript ?? "",
    healthCheck: project.healthCheck ?? {},
    envs: project.envs ?? [],
    defaultEnv: project.defaultEnv ?? "",
    deployPolicy: project.deployPolicy ?? "confirm",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
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
function projectBaseName(root) {
  return resolve(root).split("/").filter(Boolean).pop() || "project";
}
function designsDirFor(root) {
  const dir = join(wudiDir(), projectBaseName(root), "designs");
  mkdirSync(dir, { recursive: true });
  return dir;
}
function projectDataDirFor(root) {
  return join(wudiDir(), projectBaseName(root));
}
function architectureDirFor(root) {
  return join(projectDataDirFor(root), "architecture");
}
function archPlanPathFor(root) {
  return join(architectureDirFor(root), "plan.json");
}
function archModelPathFor(root) {
  return join(architectureDirFor(root), "architecture.json");
}
function migrateArchPlanFor(root) {
  const abs = resolve(root);
  const target = archPlanPathFor(abs);
  if (existsSync(target)) return target;
  const legacyList = [
    join(wudiDir(), projectBaseName(abs), "architecture.json"),
    join(abs, ".wudi", "architecture.json")
  ];
  for (const legacy of legacyList) {
    if (legacy === target || !existsSync(legacy)) continue;
    try {
      mkdirSync(architectureDirFor(abs), { recursive: true });
      renameSync(legacy, target);
      return target;
    } catch {
    }
  }
  return target;
}
function migrateDesignsFor(root) {
  const absRoot = resolve(root);
  const wsRoot = projectRoot();
  const base = projectBaseName(absRoot);
  const target = join(wsRoot, ".wudi", base, "designs");
  mkdirSync(target, { recursive: true });
  let moved = 0;
  const sources = [join(absRoot, "designs")];
  if (absRoot === wsRoot) sources.push(join(wsRoot, ".wudi", "designs"));
  for (const srcDir of sources) {
    if (!existsSync(srcDir) || resolve(srcDir) === resolve(target)) continue;
    for (const f of readdirSync(srcDir)) {
      if (!/\.(fig|pen)$/i.test(f)) continue;
      const src = join(srcDir, f);
      const dst = join(target, f);
      if (existsSync(dst)) {
        rmSync(src);
        continue;
      }
      renameSync(src, dst);
      moved++;
    }
    try {
      if (readdirSync(srcDir).length === 0) rmSync(srcDir, { recursive: true });
    } catch {
    }
  }
  return moved;
}
function loadDeploysAt(root) {
  const history = join(projectDataDirFor(root), "deploys", "history.json");
  if (!existsSync(history)) {
    const legacyList = [
      join(projectDataDirFor(root), "deploys.json"),
      join(resolve(root), ".wudi", "deploys.json")
    ];
    for (const legacy of legacyList) {
      if (!existsSync(legacy)) continue;
      try {
        mkdirSync(join(projectDataDirFor(root), "deploys"), { recursive: true });
        renameSync(legacy, history);
        break;
      } catch {
      }
    }
  }
  const list = existsSync(history) ? readNestedJSON(root, "deploys/history.json", []) : [];
  return Array.isArray(list) ? list : [];
}
function writeDeployHistory(root, list) {
  return writeNestedJSON(root, "deploys/history.json", list);
}
function loadDocsAt(root) {
  const index = join(projectDataDirFor(root), "docs", "index.json");
  if (!existsSync(index)) {
    const legacyList = [
      join(projectDataDirFor(root), "docs.json"),
      join(resolve(root), ".wudi", "docs.json")
    ];
    for (const legacy of legacyList) {
      if (!existsSync(legacy)) continue;
      try {
        mkdirSync(join(projectDataDirFor(root), "docs"), { recursive: true });
        renameSync(legacy, index);
        break;
      } catch {
      }
    }
  }
  const list = existsSync(index) ? readNestedJSON(root, "docs/index.json", []) : [];
  return Array.isArray(list) ? list : [];
}
function writeDocsIndex(root, list) {
  return writeNestedJSON(root, "docs/index.json", list);
}
function loadDeploys() {
  const list = loadDeploysAt(projectRoot());
  let changed = false;
  const now = Date.now();
  for (const d of list) {
    if (d.status === "running" && now - Date.parse(d.startedAt ?? 0) > 30 * 6e4) {
      d.status = "aborted";
      d.finishedAt = d.finishedAt ?? (/* @__PURE__ */ new Date()).toISOString();
      changed = true;
    }
  }
  if (changed) writeDeployHistory(projectRoot(), list);
  return list;
}
function appendDeploy(record) {
  const list = loadDeploys();
  list.unshift(record);
  writeDeployHistory(projectRoot(), list.slice(0, 50));
  return record;
}
function updateDeploy(id, patch) {
  const list = loadDeploys();
  const idx = list.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  writeDeployHistory(projectRoot(), list);
  return list[idx];
}
function registerDocAt(root, { path: docPath, type = "doc", title = "", source = "" }) {
  if (!docPath) throw new Error("\u7F3A\u5C11 path\uFF1A\u8981\u767B\u8BB0\u7684\u6587\u6863\u8DEF\u5F84\u3002");
  const list = (loadDocsAt(root) ?? []).filter((d) => d.path !== docPath);
  list.unshift({
    path: docPath,
    type,
    title: title || docPath,
    source,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  writeDocsIndex(root, list.slice(0, 100));
  return list[0];
}
function registerDoc(doc) {
  return registerDocAt(projectRoot(), doc);
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
function migrateRegistryFor(wsRoot = projectRoot()) {
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
    console.error(`[wudi-coding] \u6CE8\u518C\u8868\u8FC1\u79FB\u5931\u8D25\uFF08\u6309\u7A7A\u5904\u7406\uFF09\uFF1A${err.message}`);
  }
}
function loadRegistry(wsRoot = projectRoot()) {
  const root = resolve(wsRoot);
  migrateRegistryFor(root);
  const p = registryPath(root);
  if (!existsSync(p)) return [];
  try {
    const list = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error(`[wudi-coding] ${p} \u89E3\u6790\u5931\u8D25\uFF0C\u6309\u7A7A\u6CE8\u518C\u8868\u5904\u7406\uFF1A${err.message}`);
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
function registryAdd(path2, name = "", wsRoot = projectRoot()) {
  const abs = resolve(String(path2).trim());
  if (!abs || abs === "/") throw new Error("path \u65E0\u6548\u3002");
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
    addedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  list.unshift(entry);
  saveRegistry(list, wsRoot);
  return { entry, added: true };
}
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
function hideProjectRoot(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  const list = loadHidden(wsRoot);
  if (!list.includes(abs)) {
    list.push(abs);
    saveHidden(list, wsRoot);
  }
  return abs;
}
function unhideProjectRoot(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  const list = loadHidden(wsRoot).filter((x) => resolve(x) !== abs);
  saveHidden(list, wsRoot);
  return abs;
}
function isProjectRootHidden(root, wsRoot = projectRoot()) {
  const abs = resolve(String(root));
  return loadHidden(wsRoot).some((x) => resolve(x) === abs);
}
function registryRename(idOrPath, name, wsRoot = projectRoot()) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) throw new Error("name \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  const list = loadRegistry(wsRoot);
  const entry = list.find((e) => e.id === idOrPath || e.path === idOrPath);
  if (!entry) return null;
  entry.name = trimmed;
  saveRegistry(list, wsRoot);
  return entry;
}
function registryRemove(idOrPath, wsRoot = projectRoot()) {
  const list = loadRegistry(wsRoot);
  const next = list.filter((e) => e.id !== idOrPath && e.path !== idOrPath);
  if (next.length === list.length) return null;
  saveRegistry(next, wsRoot);
  return list.find((e) => e.id === idOrPath || e.path === idOrPath);
}
function registrySummaries(currentRoot = "", wsRoot = projectRoot()) {
  const cur = currentRoot ? resolve(currentRoot) : "";
  return loadRegistry(wsRoot).map((entry) => {
    const project = loadProjectAt(entry.path);
    const deploys = loadDeploysAt(entry.path);
    const docs = loadDocsAt(entry.path);
    let designCount = 0;
    try {
      const canvasDirs = [
        join(wsRoot, ".wudi", projectBaseName(entry.path), "designs"),
        join(entry.path, "designs")
      ];
      if (resolve(entry.path) === resolve(wsRoot)) canvasDirs.push(join(wsRoot, ".wudi", "designs"));
      const names = /* @__PURE__ */ new Set();
      for (const dir of canvasDirs) {
        try {
          for (const f of readdirSync(dir)) {
            if (/\.(fig|pen)$/i.test(f)) names.add(f);
          }
        } catch {
        }
      }
      designCount = names.size;
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
    for (const child of node.children ?? []) walk(child);
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
    const children2 = kids.slice(0, 40).map((k) => distill(k, depth + 1, maxDepth, budget)).filter(Boolean);
    if (children2.length) out.children = children2;
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

// src/openpencil.ts
import { spawn } from "node:child_process";
import { dirname as dirname2, join as join2, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";
var vendorRoot = resolve2(join2(dirname2(fileURLToPath(import.meta.url)), "..", "vendor", "openpencil"));
var childServerPath = join2(vendorRoot, "dist", "server.mjs");
function defaultWorkspaceRoot() {
  return resolve2(process.env.AOPC_PROJECT_DIR || process.env.AOPC_WORKSPACE_ROOT || process.cwd());
}
var children = /* @__PURE__ */ new Map();
function createState(root) {
  return {
    root,
    child: null,
    pendingId: 0,
    pending: /* @__PURE__ */ new Map(),
    stderr: "",
    buffer: "",
    initDone: null
  };
}
function ensureChild(root) {
  const key = resolve2(root || defaultWorkspaceRoot());
  let st = children.get(key);
  if (!st) {
    st = createState(key);
    children.set(key, st);
  }
  if (st.child) return st;
  try {
    st.child = spawn(process.execPath, [childServerPath], {
      env: {
        ...process.env,
        ZCODE_WORKSPACE_ROOT: st.root,
        ZCODE_PLUGIN_ROOT: vendorRoot,
        ZCODE_WORKSPACE_IDENTITY: st.root
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
  } catch (err) {
    console.error("[wudi] OpenPencil spawn \u5931\u8D25:", err.message);
    st.child = null;
    return st;
  }
  st.child.stdout.setEncoding("utf-8");
  st.child.stdout.on("data", (chunk) => {
    st.buffer += chunk;
    let idx;
    while ((idx = st.buffer.indexOf("\n")) >= 0) {
      const line = st.buffer.slice(0, idx).trim();
      st.buffer = st.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== void 0 && st.pending.has(msg.id)) {
          const res = st.pending.get(msg.id);
          st.pending.delete(msg.id);
          res(msg);
        }
      } catch {
      }
    }
  });
  st.child.stderr.on("data", (d) => {
    st.stderr += d;
  });
  st.child.on("exit", (code) => {
    console.error(`[wudi] OpenPencil \u5B50\u8FDB\u7A0B\u9000\u51FA root=${st.root} code=` + code);
    st.child = null;
    st.initDone = null;
  });
  st.initDone = request(st, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "wudi-coding", version: "1.0" }
  }).then(() => notify(st, "notifications/initialized"));
  return st;
}
function request(st, method, params) {
  ensureChild(st.root);
  if (!st.child) return Promise.reject(new Error("OpenPencil \u5B50\u8FDB\u7A0B\u672A\u542F\u52A8"));
  const id = ++st.pendingId;
  const p = new Promise((res, rej) => {
    st.pending.set(id, res);
    setTimeout(() => {
      if (st.pending.has(id)) {
        st.pending.delete(id);
        rej(new Error(`openpencil \u5B50\u8FDB\u7A0B\u8BF7\u6C42\u8D85\u65F6\uFF1A${method}
stderr: ${st.stderr.slice(-300)}`));
      }
    }, 6e4);
  });
  st.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p.then((r) => {
    if (r.error) throw Object.assign(new Error(r.error.message ?? "openpencil error"), { code: r.error.code });
    return r.result;
  });
}
function notify(st, method, params) {
  ensureChild(st.root);
  st.child?.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}
async function openpencilTools(root = void 0) {
  const st = ensureChild(root);
  await st.initDone;
  const r = await request(st, "tools/list", {});
  return r.tools ?? [];
}
async function openpencilCall(root = void 0, name, args = void 0) {
  const st = ensureChild(root);
  await st.initDone;
  return request(st, "tools/call", { name, arguments: args ?? {} });
}
async function openpencilReadResource(root = void 0, uri) {
  const st = ensureChild(root);
  await st.initDone;
  return request(st, "resources/read", { uri });
}
async function openpencilBridgeEndpoint(root = void 0) {
  const r = await openpencilCall(root, "get_design_status", {});
  const sc = r.structuredContent ?? {};
  return sc.bridge ?? null;
}
var _epCache = /* @__PURE__ */ new Map();
async function openpencilBridgeEndpointCached(root = void 0) {
  const key = resolve2(root || defaultWorkspaceRoot());
  const cur = _epCache.get(key);
  if (cur && Date.now() - cur.at < 3e4) return cur.value;
  try {
    const ep = await openpencilBridgeEndpoint(key);
    _epCache.set(key, { at: Date.now(), value: ep });
    return ep;
  } catch {
    _epCache.set(key, { at: Date.now(), value: null });
    return null;
  }
}
try {
  ensureChild(defaultWorkspaceRoot());
} catch (e) {
  console.error("[wudi] OpenPencil \u9884\u70ED\u5931\u8D25:", e.message);
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
import net from "node:net";
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
function opWsProxyUrl(target) {
  if (!bridgePort || !target) return target;
  return `ws://127.0.0.1:${bridgePort}/op-ws?target=${encodeURIComponent(target)}`;
}
bridgeServer.on("upgrade", (req, socket, head) => {
  let target = null;
  try {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (u.pathname !== "/op-ws") throw new Error("not ws proxy");
    target = new URL(u.searchParams.get("target") ?? "");
  } catch {
    socket.destroy();
    return;
  }
  const host = target.hostname;
  const port = Number(target.port || 80);
  if (host !== "127.0.0.1" || !port) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(port, host, () => {
    const lines = [];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() === "host") continue;
      lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
    lines.push(`Host: 127.0.0.1:${port}`);
    upstream.write(`${req.method} / HTTP/1.1\r
${lines.join("\r\n")}\r
\r
`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
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
  return bridgePort ? [`http://127.0.0.1:${bridgePort}`, `ws://127.0.0.1:${bridgePort}`] : [];
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
    inputSchema: { type: "object", properties: { root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" } } }
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
    name: "wudi_fs_list_dirs",
    description: "\u5217\u51FA\u5F53\u524D\u9879\u76EE\u6839\u76EE\u5F55\uFF08\u6216\u5176\u5B50\u76EE\u5F55\uFF09\u4E0B\u7684\u76F4\u63A5\u5B50\u6587\u4EF6\u5939\uFF0C\u4F9B\u5DE5\u4F5C\u53F0\u767B\u8BB0\u9879\u76EE\u65F6\u9009\u62E9\u8DEF\u5F84\u3002\u4EC5\u5141\u8BB8\u6D4F\u89C8\u5F53\u524D\u9879\u76EE\u6839\u76EE\u5F55\u5185\u7684\u8DEF\u5F84\u3002",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "\u8981\u6D4F\u89C8\u7684\u76EE\u5F55\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u9879\u76EE\u6839\uFF09" } }
    }
  },
  {
    name: "wudi_projects_rename",
    description: "\u91CD\u547D\u540D\u5DE5\u4F5C\u53F0\u91CC\u7684\u9879\u76EE\u6761\u76EE\uFF08\u53EA\u6539\u663E\u793A\u540D\uFF0C\u4E0D\u5F71\u54CD\u9879\u76EE\u76EE\u5F55\u4E0E\u6587\u4EF6\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "\u9879\u76EE id\uFF08wudi_projects_list \u91CC\u53D6\uFF09" },
        name: { type: "string", description: "\u65B0\u7684\u9879\u76EE\u663E\u793A\u540D" }
      },
      required: ["id", "name"]
    }
  },
  {
    name: "wudi_design_create",
    description: "\u521B\u5EFA\u753B\u5E03\u8BBE\u8BA1\u7A3F\uFF08.wudi/<\u9879\u76EE>/designs/<\u540D>.fig\uFF09\uFF0C\u8FD4\u56DE\u8DEF\u5F84\u3002\u5DE5\u4F5C\u53F0\u521B\u5EFA\u753B\u5E03\u7528\uFF1B\u540C\u540D\u5DF2\u5B58\u5728\u65F6\u8FD4\u56DE\u5DF2\u5B58\u5728\u72B6\u6001\uFF08\u5E42\u7B49\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "\u753B\u5E03\u540D\u79F0\uFF08\u4E0D\u5E26\u6269\u5C55\u540D\uFF09\uFF0C\u5982 UI / \u5B98\u7F51" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" }
      },
      required: ["name"]
    }
  },
  {
    name: "wudi_status",
    description: "\u9879\u76EE\u5168\u666F\uFF1A\u6863\u6848\u6458\u8981\uFF08\u542B\u73AF\u5883\u5217\u8868\u4E0E\u5F53\u524D\u73AF\u5883\u89E3\u6790\u7ED3\u679C\uFF09+ \u6700\u8FD1\u90E8\u7F72 + \u6587\u6863\u6E05\u5355 + SSH \u914D\u7F6E\u72B6\u6001\u3002/wudi \u547D\u4EE4\u4E0E\u5DE5\u4F5C\u53F0\u9762\u677F\u7684\u6570\u636E\u6E90\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" },
        env: { type: "string", description: "\u76EE\u6807\u73AF\u5883\u540D\uFF1B\u6863\u6848\u914D\u7F6E\u4E86\u591A\u4E2A\u73AF\u5883\u65F6\u7F3A\u7701\u7528 defaultEnv/\u7B2C\u4E00\u4E2A" },
        deployLimit: { type: "number", description: "\u8FD4\u56DE\u6700\u8FD1\u51E0\u6B21\u90E8\u7F72\uFF0C\u9ED8\u8BA4 5" }
      }
    }
  },
  {
    name: "wudi_architecture",
    description: "\u9879\u76EE\u67B6\u6784\u603B\u89C8\uFF08\u9759\u6001\u626B\u63CF\uFF0C\u53EA\u8BFB\uFF09\uFF1A\u8BED\u8A00\u5360\u6BD4\u3001\u6846\u67B6/\u5305\u7BA1\u7406\u5668\u3001\u9876\u5C42\u6A21\u5757\u3001\u5173\u952E\u5165\u53E3\u6587\u4EF6\u3001docker-compose \u670D\u52A1\u4E0E npm scripts\u3001monorepo workspaces\u3002\u5DE5\u4F5C\u53F0\u300C\u67B6\u6784\u300D\u9875\u7684\u6570\u636E\u6E90\uFF0C\u4E5F\u53EF\u8BA9 Agent \u5FEB\u901F\u4E86\u89E3\u9879\u76EE\u7ED3\u6784\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" } }
    }
  },
  {
    name: "wudi_arch_plan",
    description: "\u4E3A\u7A7A\u9879\u76EE\u8BBE\u8BA1\u67B6\u6784\u65B9\u6848 + \u6280\u672F\u6808\u7EC4\u5408\uFF08web / miniprogram / mobile / backend / monorepo\uFF09\uFF1A\u8F93\u51FA\u6280\u672F\u9009\u578B\u3001\u76EE\u5F55\u4E0E\u6587\u4EF6\u6E05\u5355\u3001\u547D\u4EE4\u3001\u6CE8\u610F\u4E8B\u9879\uFF0C\u5E76\u5728 <\u5DE5\u4F5C\u533A>/.wudi/<\u9879\u76EE\u540D>/architecture/ \u4E0B\u751F\u6210 plan.json\u3001architecture.json\u3001ARCHITECTURE.md\u3001diagrams.md\u3001decisions/\uFF08ADR\uFF09\u3002\u914D\u5408 wudi_arch_scaffold \u5199\u5165\u9AA8\u67B6\uFF0C\u518D\u7531 Agent \u5B9E\u73B0\u5404\u6A21\u5757\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["web", "miniprogram", "mobile", "backend", "monorepo"], description: "\u9879\u76EE\u7C7B\u578B\uFF0C\u7F3A\u7701 web" },
        framework: { type: "string", description: "\u6846\u67B6\uFF1Aweb[vue-vite|react-vite|next-app|nuxt|svelte-kit|static]\u3001miniprogram[taro|uni-app|native-wechat]\u3001mobile[flutter|swiftui|expo]\u3001backend[nest|go-gin|express|fastapi|spring-boot]\u3001monorepo[pnpm-workspace|turbo]" },
        options: { type: "object", description: "\u6280\u672F\u6808\u7EC4\u5408\uFF08\u6309\u6846\u67B6\u652F\u6301\uFF09\uFF1Astyling(css|tailwind|scss)\u3001ui(none|element-plus|naive-ui|antd)\u3001state(none|pinia|zustand)\u3001router(none|vue-router|react-router-dom)\u3001test(none|vitest|jest)" },
        name: { type: "string", description: "\u9879\u76EE\u663E\u793A\u540D\uFF08\u7F3A\u7701\u7528\u6863\u6848\u540D/\u76EE\u5F55\u540D\uFF09" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
      }
    }
  },
  {
    name: "wudi_arch_scaffold",
    description: "\u6309\u67B6\u6784\u65B9\u6848\u5199\u5165\u9879\u76EE\u9AA8\u67B6\uFF1A\u521B\u5EFA\u76EE\u5F55\u4E0E\u521D\u59CB\u6587\u4EF6\uFF0C\u7EDD\u4E0D\u8986\u76D6\u5DF2\u6709\u6587\u4EF6\u3002plan \u7F3A\u7701\u8BFB\u53D6 <\u5DE5\u4F5C\u533A>/.wudi/<\u9879\u76EE\u540D>/architecture/plan.json\uFF1B\u5199\u5165\u540E\u66F4\u65B0 architecture.json \u72B6\u6001\u4E0E\u63A2\u6D4B\u7ED3\u679C\uFF0C\u5FC5\u987B\u4F20 confirm: true\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        plan: { type: "object", description: "wudi_arch_plan \u8FD4\u56DE\u7684\u65B9\u6848\u5BF9\u8C61\uFF08\u7F3A\u7701\u8BFB .wudi/<\u9879\u76EE\u540D>/architecture/plan.json\uFF09" },
        confirm: { type: "boolean", description: "\u5FC5\u987B\u4E3A true \u624D\u5199\u5165\uFF08\u5B89\u5168\u95F8\uFF09" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
      },
      required: ["confirm"]
    }
  },
  {
    name: "wudi_page_from_design",
    description: "\u7531\u753B\u5E03 .fig \u5FEB\u901F\u751F\u6210\u9875\u9762\uFF1Aformat=jsx \u7528 OpenPencil export_design \u5BFC\u51FA JSX + Tailwind \u7C7B\u540D\uFF08\u8BED\u4E49\u7ED3\u6784\uFF09\uFF1Bvue/html \u7528\u6574\u9875 SVG \u5305\u9875\u9762\u9AA8\u67B6\uFF08\u89C6\u89C9 1:1\uFF09\u3002\u8F93\u51FA\u9ED8\u8BA4 generated/<\u753B\u5E03\u540D>.<ext>\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u6587\u4EF6\uFF08overwrite:true \u53EF\u8986\u76D6\uFF09\u3002\u9700\u8981\u8BE5\u753B\u5E03\u7F16\u8F91\u5668\u5DF2\u6253\u5F00\u3002",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "\u753B\u5E03\u8DEF\u5F84\uFF0C\u5982 .wudi/<\u9879\u76EE>/designs/ui.fig" },
        format: { type: "string", enum: ["jsx", "vue", "html"], description: "\u8F93\u51FA\u683C\u5F0F\uFF0C\u9ED8\u8BA4 jsx" },
        output: { type: "string", description: "\u8F93\u51FA\u8DEF\u5F84\uFF08\u76F8\u5BF9\u9879\u76EE\u6839\uFF0C\u6269\u5C55\u540D\u9700\u4E0E format \u4E00\u81F4\uFF09\uFF0C\u9ED8\u8BA4 generated/<\u753B\u5E03\u540D>.<ext>" },
        overwrite: { type: "boolean", description: "\u8F93\u51FA\u5B58\u5728\u65F6\u662F\u5426\u8986\u76D6\uFF0C\u9ED8\u8BA4 false" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
      },
      required: ["path"]
    }
  },
  {
    name: "wudi_dev_actions",
    description: "\u5217\u51FA\u9879\u76EE\u53EF\u7528\u7684\u5F00\u53D1\u52A8\u4F5C\uFF08package.json scripts / go / flutter / python / Makefile\uFF09\uFF1A\u5B89\u88C5\u3001\u5F00\u53D1\u670D\u52A1\u5668\u3001\u6784\u5EFA\u3001\u6D4B\u8BD5\u7B49\uFF0C\u5E76\u8FD4\u56DE\u8FD0\u884C\u4E2D\u8FDB\u7A0B\u72B6\u6001\u3002\u5DE5\u4F5C\u53F0\u300C\u5F00\u53D1\u300D\u9875\u7684\u6570\u636E\u6E90\u3002",
    inputSchema: { type: "object", properties: { root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" } } }
  },
  {
    name: "wudi_dev_run",
    description: "\u542F\u52A8\u5F00\u53D1\u52A8\u4F5C\u6216\u81EA\u5B9A\u4E49\u547D\u4EE4\uFF08\u540E\u53F0\u5E38\u9A7B\uFF0C\u8F93\u51FA\u8FDB\u73AF\u5F62\u65E5\u5FD7\uFF09\u3002name \u7528 wudi_dev_actions \u7684 id\uFF1B\u81EA\u5B9A\u4E49 command \u9700 confirm: true\u3002",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "\u52A8\u4F5C id\uFF08\u5982 script:dev / install / build / test\uFF09" },
        command: { type: "string", description: "\u81EA\u5B9A\u4E49\u547D\u4EE4\uFF08\u9700 confirm: true\uFF09" },
        confirm: { type: "boolean", description: "\u81EA\u5B9A\u4E49\u547D\u4EE4\u786E\u8BA4" },
        kind: { type: "string", enum: ["server", "task"], description: "\u81EA\u5B9A\u4E49\u547D\u4EE4\u7C7B\u578B" },
        port: { type: "number", description: "\u5DF2\u77E5\u7AEF\u53E3\uFF08\u7528\u4E8E\u751F\u6210\u8BBF\u95EE\u5730\u5740\uFF09" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
      }
    }
  },
  {
    name: "wudi_dev_stop",
    description: "\u505C\u6B62\u5F00\u53D1\u8FDB\u7A0B\uFF08\u6309 id/name\uFF0C\u6216 all: true \u505C\u6B62\u8BE5\u9879\u76EE\u7684\u5168\u90E8\u8FDB\u7A0B\uFF09\u3002",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "\u8FDB\u7A0B id" },
        name: { type: "string", description: "\u52A8\u4F5C id/\u540D\u79F0\uFF08\u53EF\u66FF\u4EE3 id\uFF09" },
        all: { type: "boolean", description: "\u505C\u6B62\u8BE5\u9879\u76EE\u5168\u90E8\u8FDB\u7A0B" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
      }
    }
  },
  {
    name: "wudi_dev_logs",
    description: "\u8BFB\u53D6\u5F00\u53D1\u8FDB\u7A0B\u6700\u8FD1\u8F93\u51FA\uFF08\u9ED8\u8BA4 80 \u884C\uFF09\uFF0C\u542B\u72B6\u6001\u3001\u7AEF\u53E3\u4E0E\u8BBF\u95EE\u5730\u5740\u3002",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "\u8FDB\u7A0B id" },
        name: { type: "string", description: "\u52A8\u4F5C id/\u540D\u79F0\uFF08\u53EF\u66FF\u4EE3 id\uFF09" },
        lines: { type: "number", description: "\u8FD4\u56DE\u884C\u6570\uFF0C\u9ED8\u8BA4 80" },
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF09" }
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
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" },
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
    inputSchema: { type: "object", properties: { root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" } } }
  },
  {
    name: "wudi_design_delete",
    description: "\u5220\u9664\u5DE5\u4F5C\u533A designs/ \u76EE\u5F55\u4E0B\u7684\u8BBE\u8BA1\u7A3F\u6587\u4EF6\uFF08.fig/.pen\uFF09\u3002\u4EC5\u5141\u8BB8 designs/ \u76EE\u5F55\u5185\u7684\u6587\u4EF6\uFF1B\u82E5\u7F16\u8F91\u5668\u6B63\u6253\u5F00\u8BE5\u8BBE\u8BA1\u7A3F\uFF0C\u5EFA\u8BAE\u5148\u5173\u95ED\u518D\u5220\u9664\u3002",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" }, path: { type: "string", description: "\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF0C\u5982 designs/old.fig" } },
      required: ["path"]
    }
  },
  {
    name: "wudi_design_rename",
    description: "\u91CD\u547D\u540D\u5DE5\u4F5C\u533A designs/ \u76EE\u5F55\u4E0B\u7684\u8BBE\u8BA1\u7A3F\u6587\u4EF6\uFF08.fig/.pen\uFF09\u3002\u4EC5\u5141\u8BB8 designs/ \u76EE\u5F55\u5185\u64CD\u4F5C\uFF1B\u76EE\u6807\u540D\u5DF2\u5B58\u5728\u65F6\u62D2\u7EDD\u3002",
    inputSchema: {
      type: "object",
      properties: {
        root: { type: "string", description: "\u9879\u76EE\u6839\u8DEF\u5F84\uFF08\u7F3A\u7701\u4E3A\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1B\u5DE5\u4F5C\u53F0\u591A\u9879\u76EE\u5185\u5BB9\u9875\u4F20\u5165\uFF09" },
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
        return toolProjectGet(args);
      case "wudi_project_init":
        return toolProjectInit(args);
      case "wudi_status":
        return await toolStatus(args);
      case "wudi_architecture":
        return toolArchitecture(args);
      case "wudi_arch_plan":
        return toolArchPlan(args);
      case "wudi_arch_scaffold":
        return toolArchScaffold(args);
      case "wudi_page_from_design":
        return await toolPageFromDesign(args);
      case "wudi_dev_actions":
        return toolDevActions(args);
      case "wudi_dev_run":
        return toolDevRun(args);
      case "wudi_dev_stop":
        return toolDevStop(args);
      case "wudi_dev_logs":
        return toolDevLogs(args);
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
        return toolDesignsList(args);
      case "wudi_design_delete":
        return toolDesignDelete(args);
      case "wudi_design_rename":
        return toolDesignRename(args);
      case "wudi_design_create":
        return toolDesignCreate(args);
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
      case "wudi_projects_rename":
        return toolProjectsRename(args);
      case "wudi_fs_list_dirs":
        return toolFsListDirs(args);
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
function toolProjectGet(args = {}) {
  const project = loadProjectAt(toolRoot(args));
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
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\uFF0C\u5148 wudi_project_init\u3002");
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
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const project = loadProjectAt(root);
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
  const deploys = loadDeploysAt(root).slice(0, deployLimit);
  const docs = loadDocsAt(root);
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
    ].filter(Boolean).join("\n") : "\u9879\u76EE\u6863\u6848\uFF1A\u7F3A\u5931\uFF08\u7528 wudi_project_init \u6216 /wudi \u5EFA\u6863\uFF09",
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
  const dir = join3(wudiDir(), "artifacts");
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
    const file2 = join3(artifactsDir(), artifactName(project, stamp, "tar"));
    await localRun(`docker save -o ${q(file2)} ${q(project.package.dockerImage)}`, { cwd: projectRoot() });
    return { file: file2, kind: "docker-image" };
  }
  const pkgPath = resolve3(projectRoot(), project.package.path || "dist");
  if (!existsSync3(pkgPath)) throw new Error(`\u4EA7\u7269\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${pkgPath}\uFF08\u68C0\u67E5\u6863\u6848 package.path \u6216\u5148\u5B8C\u6210\u6784\u5EFA\uFF09`);
  const file = join3(artifactsDir(), artifactName(project, stamp, "tar.gz"));
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
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\uFF0C\u5148 wudi_project_init\u3002");
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
      await sshRun(`mkdir -p ${q(join3(envObj.deployRoot, "releases", stamp).replaceAll("\\", "/"))}`, { timeoutMs: 6e4, overrides: envObj.ssh });
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
        await sshRun(`ln -sfn ${q(join3(envObj.deployRoot, "releases", stamp))} ${q(join3(envObj.deployRoot, "current"))}`, { overrides: envObj.ssh });
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
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const deploys = loadDeploysAt(root).filter((d) => !envFilter || d.env === envFilter).slice(0, limit);
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
  const { stdout } = await sshRun(`readlink ${q(join3(envObj.deployRoot, "current"))}`, { timeoutMs: 3e4, overrides: envObj.ssh });
  const m = String(stdout).trim().match(/(\d{8}-\d{6})$/);
  return m ? m[1] : "";
}
async function toolRollback(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\u3002");
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
    const { stdout } = await sshRun(`ls -1 ${q(join3(envObj.deployRoot, "releases"))}`, { timeoutMs: 3e4, overrides: envObj.ssh });
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
    await sshRun(`ln -sfn ${q(join3(envObj.deployRoot, "releases", target))} ${q(join3(envObj.deployRoot, "current"))}`, { timeoutMs: 6e4, overrides: envObj.ssh });
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
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\u3002");
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
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\u3002");
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
    add("\u9879\u76EE\u6863\u6848", "fail", ".wudi/project.json \u4E0D\u5B58\u5728\uFF0C\u5148 wudi_project_init\u3002");
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
      const { stdout: lsOut } = await sshRun(`ls -1 ${q(join3(envObj.deployRoot, "releases"))} 2>/dev/null`, { timeoutMs: 3e4, overrides: envObj.ssh });
      const releases = parseRemoteReleases(lsOut);
      if (!releases.length) add("\u7248\u672C\u76EE\u5F55", "warn", "releases \u4E3A\u7A7A\uFF08\u5C1A\u672A\u90E8\u7F72\u8FC7\uFF09");
      else add("\u7248\u672C\u76EE\u5F55", releases.length > 10 ? "warn" : "pass", `${releases.length} \u4E2A\u7248\u672C${releases.length > 10 ? "\uFF08\u5EFA\u8BAE pruneOld \u6E05\u7406\uFF09" : ""}`);
      if (project.package.type !== "docker-image" && releases.length) {
        const current = await readCurrentRelease(envObj);
        const { stdout: exists } = await sshRun(`test -e ${q(join3(envObj.deployRoot, "current"))} && echo yes || echo no`, { overrides: envObj.ssh });
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
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\u3002");
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
      const full = join3(d, entry.name);
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
var ARCH_SKIP_DIRS = /* @__PURE__ */ new Set([
  ".git",
  ".wudi",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "Pods",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
  "DerivedData",
  ".gradle",
  ".dart_tool"
]);
var ARCH_LANGS = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  vue: "Vue",
  svelte: "Svelte",
  astro: "Astro",
  dart: "Dart",
  go: "Go",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  m: "Objective-C",
  mm: "Objective-C",
  py: "Python",
  rs: "Rust",
  rb: "Ruby",
  php: "PHP",
  cs: "C#",
  c: "C/C++",
  h: "C/C++",
  cpp: "C/C++",
  cc: "C/C++",
  hpp: "C/C++",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  html: "HTML",
  htm: "HTML",
  json: "JSON",
  md: "Markdown",
  mdx: "Markdown",
  yml: "YAML",
  yaml: "YAML",
  sh: "Shell",
  sql: "SQL",
  fig: "Figma",
  pen: "Pen"
};
var ARCH_ENTRY_NAMES = /* @__PURE__ */ new Set([
  "package.json",
  "tsconfig.json",
  "jsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "nuxt.config.ts",
  "svelte.config.js",
  "astro.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "go.mod",
  "go.sum",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "Cargo.toml",
  "pubspec.yaml",
  "Podfile",
  "Gemfile",
  "composer.json",
  "requirements.txt",
  "pyproject.toml",
  "setup.py",
  "Pipfile",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "compose.yml",
  "compose.yaml",
  "README.md",
  "README.zh-CN.md",
  ".env.example",
  "Makefile"
]);
var ARCH_FRAMEWORK_DEPS = [
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
  ["@remix-run/react", "Remix"],
  ["astro", "Astro"],
  ["vue", "Vue"],
  ["react", "React"],
  ["svelte", "Svelte"],
  ["solid-js", "Solid"],
  ["@angular/core", "Angular"],
  ["@nestjs/core", "NestJS"],
  ["express", "Express"],
  ["koa", "Koa"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
  ["electron", "Electron"],
  ["react-native", "React Native"],
  ["expo", "Expo"],
  ["@tarojs/taro", "Taro"],
  ["uni-app", "uni-app"],
  ["vite", "Vite"],
  ["webpack", "Webpack"],
  ["pinia", "Pinia"],
  ["redux", "Redux"],
  ["tailwindcss", "Tailwind CSS"],
  ["element-plus", "Element Plus"],
  ["antd", "Ant Design"],
  ["@vant/weapp", "Vant Weapp"],
  ["tdesign-miniprogram", "TDesign"]
];
function archPackage(root) {
  try {
    const pkg = JSON.parse(readFileSync2(join3(root, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
    const scripts = Object.entries(pkg.scripts ?? {}).slice(0, 10).map(([name, command]) => ({ name, command: String(command).slice(0, 120) }));
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : Array.isArray(pkg.workspaces?.packages) ? pkg.workspaces.packages : [];
    return { name: pkg.name ?? "", version: pkg.version ?? "", deps, scripts, workspaces: ws.map(String) };
  } catch {
    return null;
  }
}
function archFrameworks(root, deps) {
  const found = [];
  const add = (name) => {
    if (name && !found.includes(name)) found.push(name);
  };
  for (const [dep, label] of ARCH_FRAMEWORK_DEPS) if (deps[dep]) add(label);
  try {
    const goMod = readFileSync2(join3(root, "go.mod"), "utf-8");
    if (goMod.includes("gin-gonic/gin")) add("Gin");
    else if (goMod.includes("labstack/echo")) add("Echo");
    else if (goMod.includes("gofiber/fiber")) add("Fiber");
    else add("Go Modules");
  } catch {
  }
  try {
    if (/spring-boot/.test(readFileSync2(join3(root, "pom.xml"), "utf-8"))) add("Spring Boot");
  } catch {
  }
  try {
    if (/flutter/i.test(readFileSync2(join3(root, "pubspec.yaml"), "utf-8"))) add("Flutter");
  } catch {
  }
  try {
    if (readFileSync2(join3(root, "Podfile"), "utf-8")) add("iOS / CocoaPods");
  } catch {
  }
  try {
    if (/rails/i.test(readFileSync2(join3(root, "Gemfile"), "utf-8"))) add("Rails");
  } catch {
  }
  return found.slice(0, 10);
}
function archPackageManagers(root) {
  const found = [];
  const has = (f) => existsSync3(join3(root, f));
  if (has("pnpm-lock.yaml") || has("pnpm-workspace.yaml")) found.push("pnpm");
  if (has("yarn.lock")) found.push("yarn");
  if (has("bun.lockb") || has("bun.lock")) found.push("bun");
  if (has("package-lock.json")) found.push("npm");
  if (has("go.mod")) found.push("go modules");
  if (has("pom.xml")) found.push("Maven");
  if (has("build.gradle") || has("build.gradle.kts")) found.push("Gradle");
  if (has("Podfile")) found.push("CocoaPods");
  if (has("pubspec.yaml")) found.push("pub");
  if (has("Cargo.toml")) found.push("Cargo");
  if (has("requirements.txt") || has("pyproject.toml") || has("Pipfile")) found.push("pip/poetry");
  if (has("Gemfile")) found.push("Bundler");
  if (has("composer.json")) found.push("Composer");
  return found;
}
function archScan(root) {
  const languages = /* @__PURE__ */ new Map();
  const modules = [];
  const entries = [];
  let files = 0;
  let truncated = false;
  const take = (name, bucket) => {
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    const lang = ARCH_LANGS[ext];
    if (!lang) return;
    languages.set(lang, (languages.get(lang) ?? 0) + 1);
    if (bucket) bucket.set(lang, (bucket.get(lang) ?? 0) + 1);
  };
  const walkDepth = (dir, depth, mod) => {
    if (files >= 4e3) {
      truncated = true;
      return;
    }
    let ents;
    try {
      ents = readdirSync2(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = join3(dir, e.name);
      if (e.isDirectory()) {
        if (ARCH_SKIP_DIRS.has(e.name) || e.name.startsWith(".") || depth >= 3) continue;
        walkDepth(p, depth + 1, mod);
        continue;
      }
      if (!e.isFile()) continue;
      const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ARCH_LANGS[ext]) continue;
      files++;
      mod.files++;
      take(e.name, mod.langs);
      if (files >= 4e3) {
        truncated = true;
        return;
      }
    }
  };
  let rootEntries;
  try {
    rootEntries = readdirSync2(root, { withFileTypes: true });
  } catch {
    return { languages, modules, entries, files, truncated };
  }
  for (const e of rootEntries) {
    if (e.isFile()) {
      if (ARCH_ENTRY_NAMES.has(e.name)) entries.push({ name: e.name, path: join3(root, e.name) });
      const ext = e.name.split(".").pop()?.toLowerCase() ?? "";
      if (ARCH_LANGS[ext]) {
        files++;
        take(e.name);
      }
    } else if (e.isDirectory() && !ARCH_SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) {
      const mod = { name: e.name, path: join3(root, e.name), files: 0, langs: /* @__PURE__ */ new Map() };
      modules.push(mod);
      walkDepth(mod.path, 1, mod);
    }
  }
  return { languages, modules, entries, files, truncated };
}
function archCompose(root) {
  for (const name of ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]) {
    const file = join3(root, name);
    if (!existsSync3(file)) continue;
    let lines = [];
    try {
      lines = readFileSync2(file, "utf-8").split("\n").slice(0, 300);
    } catch {
      continue;
    }
    const services = [];
    let inServices = false;
    let cur = null;
    for (const raw of lines) {
      const line = raw.replace(/\s+#.*$/, "");
      if (/^services:\s*$/.test(line)) {
        inServices = true;
        continue;
      }
      if (inServices && /^\S/.test(line)) inServices = false;
      if (!inServices) continue;
      const head = /^ {2}([A-Za-z0-9._-]+):\s*$/.exec(line);
      if (head) {
        cur = { name: head[1], image: "", ports: "" };
        services.push(cur);
        continue;
      }
      if (!cur) continue;
      const image = /^\s+image:\s*["']?([^"'\s]+)/.exec(line);
      if (image) cur.image = image[1];
      const port = /^\s+-\s*["']?([0-9.:-]+:[0-9.:-]+)["']?/.exec(line);
      if (port) cur.ports = cur.ports ? `${cur.ports}, ${port[1]}` : port[1];
    }
    return { file: name, services };
  }
  return null;
}
function archDesignCount(root) {
  try {
    const dir = join3(projectRoot(), ".wudi", projectBaseName(root), "designs");
    return readdirSync2(dir).filter((f) => /\.(fig|pen)$/i.test(f)).length;
  } catch {
    return 0;
  }
}
function toolArchitecture(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const project = loadProjectAt(root);
  const pkg = archPackage(root);
  const deps = pkg?.deps ?? {};
  const frameworks = archFrameworks(root, deps);
  const packageManagers = archPackageManagers(root);
  const scan = archScan(root);
  const compose = archCompose(root);
  const langTotal = [...scan.languages.values()].reduce((a, b) => a + b, 0) || 1;
  const languages = [...scan.languages.entries()].map(([name2, count]) => ({ name: name2, files: count, pct: Math.round(count / langTotal * 100) })).sort((a, b) => b.files - a.files);
  const modules = scan.modules.map((m) => ({
    name: m.name,
    path: m.path,
    files: m.files,
    languages: [...m.langs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n)
  })).sort((a, b) => b.files - a.files);
  const docs = loadDocsAt(root) ?? [];
  const envs = Array.isArray(project?.envs) ? project.envs.map((e) => e.name) : [];
  const name = project?.name || pkg?.name || projectBaseName(root);
  const related = {
    docs: docs.length,
    designs: archDesignCount(root),
    envs: envs.length ? envs : project?.deployRoot ? ["default"] : [],
    deployRoot: project?.deployRoot ?? "",
    healthCheck: project?.healthCheck?.url ?? "",
    build: project?.build ?? "",
    packagePath: project?.package?.type === "docker-image" ? project?.package?.dockerImage ?? "" : project?.package?.path ?? "",
    packageType: project?.package?.type ?? "dir",
    deployPolicy: project?.deployPolicy ?? "confirm",
    docker: existsSync3(join3(root, "Dockerfile")) || existsSync3(join3(root, "docker-compose.yml")),
    registeredDocs: docs.slice(0, 12).map((d) => ({ path: d.path, type: d.type ?? "doc" }))
  };
  let architecture = null;
  try {
    const modelPath = archModelPathFor(root);
    if (existsSync3(modelPath)) {
      const model = JSON.parse(readFileSync2(modelPath, "utf-8"));
      const archDir = architectureDirFor(root);
      const archFiles = [];
      const walkArch = (dir, prefix) => {
        for (const e of readdirSync2(dir, { withFileTypes: true })) {
          const rel = prefix ? `${prefix}/${e.name}` : e.name;
          if (e.isDirectory()) walkArch(join3(dir, e.name), rel);
          else archFiles.push(rel);
        }
      };
      try {
        walkArch(archDir, "");
      } catch {
      }
      architecture = {
        dir: `.wudi/${projectBaseName(root)}/architecture`,
        status: model.status ?? "",
        stack: model.stack ?? [],
        docs: archFiles.sort()
      };
    }
  } catch {
  }
  const structured = {
    root,
    name,
    techStack: project?.techStack ?? "",
    scanned: { files: scan.files, truncated: scan.truncated },
    languages,
    frameworks,
    packageManagers,
    modules,
    entries: scan.entries,
    scripts: pkg?.scripts ?? [],
    workspaces: pkg?.workspaces ?? [],
    compose,
    related,
    architecture,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const stack = frameworks.length ? frameworks.join(" / ") : project?.techStack || "\uFF08\u672A\u8BC6\u522B\uFF09";
  const langs = languages.slice(0, 6).map((l) => `${l.name} ${l.files}\uFF08${l.pct}%\uFF09`).join("\u3001") || "\uFF08\u65E0\u6E90\u7801\u6587\u4EF6\uFF09";
  const mods = modules.slice(0, 10).map((m) => `${m.name}\uFF08${m.files} \u6587\u4EF6${m.languages.length ? `\uFF1A${m.languages.join("/")}` : ""}\uFF09`).join("\u3001") || "\uFF08\u65E0\u9876\u5C42\u76EE\u5F55\uFF09";
  const ents = scan.entries.map((e) => e.name).join("\u3001") || "\uFF08\u65E0\u5173\u952E\u6587\u4EF6\uFF09";
  const services = compose?.services?.length ? compose.services.map((s) => `${s.name}${s.image ? `\uFF08${s.image}${s.ports ? `\uFF0C${s.ports}` : ""}\uFF09` : ""}`).join("\u3001") : "";
  const lines = [
    `\u2550\u2550\u2550 \u67B6\u6784\u603B\u89C8\uFF1A${name} \u2550\u2550\u2550`,
    `\u6280\u672F\u6808\uFF1A${stack}${packageManagers.length ? `\uFF5C\u5305\u7BA1\u7406 ${packageManagers.join(" / ")}` : ""}`,
    `\u8BED\u8A00\uFF1A${langs}`,
    `\u6A21\u5757\uFF1A${mods}`,
    `\u5173\u952E\u6587\u4EF6\uFF1A${ents}`
  ];
  if (services) lines.push(`\u670D\u52A1\uFF08${compose.file}\uFF09\uFF1A${services}`);
  if (pkg?.scripts?.length) lines.push(`\u811A\u672C\uFF1A${pkg.scripts.map((s) => s.name).join("\u3001")}`);
  if (pkg?.workspaces?.length) lines.push(`Monorepo workspaces\uFF1A${pkg.workspaces.join("\u3001")}`);
  lines.push(`\u5173\u8054\uFF1A\u753B\u5E03 ${related.designs}\uFF5C\u6587\u6863 ${related.docs}\uFF5C\u73AF\u5883 ${related.envs.join("\u3001") || "\u672A\u914D\u7F6E"}`);
  lines.push(`\u90E8\u7F72\uFF1A\u6784\u5EFA ${related.build || "-"}\uFF5C\u4EA7\u7269 ${related.packagePath || "-"}\uFF5C\u90E8\u7F72\u6839 ${related.deployRoot || "\u672A\u914D\u7F6E"}${related.docker ? "\uFF5CDocker \u2713" : ""}`);
  if (related.registeredDocs.length) lines.push(`\u9879\u76EE\u6587\u6863\uFF1A${related.registeredDocs.map((d) => d.path).join("\u3001")}`);
  if (architecture) {
    lines.push(`\u67B6\u6784\u65B9\u6848\uFF1A${architecture.status}\uFF5C${architecture.stack.join(" \xB7 ") || "\uFF08\u65E0\uFF09"}`);
    lines.push(`\u67B6\u6784\u76EE\u5F55\uFF1A${architecture.dir}\uFF08${architecture.docs.length} \u4E2A\u6587\u6863\uFF09`);
  }
  if (scan.truncated) lines.push(`\uFF08\u626B\u63CF\u8FBE\u5230 4000 \u6587\u4EF6\u4E0A\u9650\uFF0C\u7EDF\u8BA1\u4E3A\u4F9D\u636E\u6837\u672C\u7684\u4E0B\u9650\uFF09`);
  return ok(lines.join("\n"), structured);
}
var archJson = (obj) => JSON.stringify(obj, null, 2) + "\n";
var archSlug = (name) => String(name || "app").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "app";
var archPkg = (name, { type = "module", scripts = {}, deps = {}, devDeps = {} } = {}) => archJson({
  name: archSlug(name),
  private: true,
  version: "0.1.0",
  ...type ? { type } : {},
  scripts,
  dependencies: deps,
  devDependencies: devDeps
});
var archMainCss = `:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; }
.app { max-width: 960px; margin: 64px auto; padding: 0 24px; }
`;
var archTailwindCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
var archTailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,vue,svelte}", "./app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`;
var archPostcss = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
`;
var archReadme = (name, stack, dev) => `# ${name}

${stack}\u3002

\`\`\`bash
${dev}
\`\`\`
`;
var ARCH_PRESETS = {
  web: {
    label: "Web \u524D\u7AEF",
    frameworks: {
      "vue-vite": {
        label: "Vue 3 + Vite",
        summary: "Vue 3 + TypeScript + Vite \u5355\u9875\u5E94\u7528\uFF1A\u7EC4\u4EF6 / \u89C6\u56FE / \u6837\u5F0F\u5206\u5C42\uFF0C\u53EF\u9009\u7EC4\u4EF6\u5E93\u3001\u72B6\u6001\u3001\u8DEF\u7531\u4E0E\u6D4B\u8BD5\u3002",
        dirs: ["public", "src/components", "src/views", "src/styles"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {
          styling: [["css", "\u539F\u751F CSS"], ["tailwind", "Tailwind CSS"], ["scss", "SCSS"]],
          ui: [["none", "\u65E0\u7EC4\u4EF6\u5E93"], ["element-plus", "Element Plus"], ["naive-ui", "Naive UI"]],
          state: [["none", "\u65E0\u72B6\u6001\u5E93"], ["pinia", "Pinia"]],
          router: [["none", "\u65E0\u8DEF\u7531"], ["vue-router", "Vue Router"]],
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["vitest", "Vitest"]]
        },
        defaults: { styling: "css", ui: "none", state: "none", router: "none", test: "none" },
        files: (name, o) => {
          const deps = { vue: "^3.5.0" };
          const devDeps = { "@vitejs/plugin-vue": "^5.2.0", typescript: "^5.7.0", vite: "^6.0.0", "vue-tsc": "^2.2.0" };
          const scripts = { dev: "vite", build: "vue-tsc -b && vite build", preview: "vite preview" };
          const imports = [`import { createApp } from "vue";`, `import App from "./App.vue";`];
          const calls = [];
          const extra = [];
          if (o.styling === "tailwind") {
            devDeps.tailwindcss = "^3.4.0";
            devDeps.postcss = "^8.4.0";
            devDeps.autoprefixer = "^10.4.0";
            extra.push(["tailwind.config.js", "Tailwind \u914D\u7F6E", archTailwindConfig], ["postcss.config.js", "PostCSS \u914D\u7F6E", archPostcss]);
          }
          if (o.styling === "scss") devDeps.sass = "^1.80.0";
          if (o.ui === "element-plus") {
            deps["element-plus"] = "^2.8.0";
            imports.push(`import ElementPlus from "element-plus";`, `import "element-plus/dist/index.css";`);
            calls.push("app.use(ElementPlus);");
          }
          if (o.ui === "naive-ui") deps["naive-ui"] = "^2.40.0";
          if (o.state === "pinia") {
            deps.pinia = "^2.2.0";
            imports.push(`import { createPinia } from "pinia";`);
            calls.push("app.use(createPinia());");
            extra.push(["src/stores/counter.ts", "\u793A\u4F8B\u72B6\u6001\uFF08Pinia\uFF09", `import { defineStore } from "pinia";

export const useCounter = defineStore("counter", {
  state: () => ({ count: 0 }),
  actions: { inc() { this.count += 1; } },
});
`]);
          }
          if (o.router === "vue-router") {
            deps["vue-router"] = "^4.4.0";
            imports.push(`import router from "./router";`);
            calls.push("app.use(router);");
            extra.push(
              ["src/router/index.ts", "\u8DEF\u7531\u8868", `import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [{ path: "/", name: "home", component: Home }],
});
`],
              ["src/views/Home.vue", "\u9996\u9875\u89C6\u56FE", `<script setup lang="ts">
const title = "${name}";
</script>

<template>
  <main class="app">
    <h1>{{ title }}</h1>
    <p>Home \u89C6\u56FE\uFF1A\u5728 src/router/index.ts \u6DFB\u52A0\u8DEF\u7531\u3002</p>
  </main>
</template>
`]
            );
          }
          if (o.test === "vitest") {
            devDeps.vitest = "^2.1.0";
            scripts.test = "vitest run";
            extra.push(["src/__tests__/app.test.ts", "\u6700\u5C0F\u5355\u6D4B", `import { describe, expect, it } from "vitest";

describe("app", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
`]);
          }
          const styleFile = o.styling === "scss" ? "src/styles/main.scss" : "src/styles/main.css";
          const styleContent = o.styling === "tailwind" ? archTailwindCss : archMainCss;
          const appVue = o.router === "vue-router" ? `<template>
  <router-view />
</template>
` : `<script setup lang="ts">
const title = "${name}";
</script>

<template>
  <main class="app">
    <h1>{{ title }}</h1>
    <p>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/views \u6DFB\u52A0\u89C6\u56FE\uFF0C\u5728 src/components \u6DFB\u52A0\u7EC4\u4EF6\u3002</p>
  </main>
</template>
`;
          const main = [...imports, `import "./styles/${o.styling === "scss" ? "main.scss" : "main.css"}";`, "", "const app = createApp(App);", ...calls, 'app.mount("#app");', ""].join("\n");
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { scripts, deps, devDeps })],
            ["index.html", "\u5E94\u7528\u5165\u53E3 HTML", `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`],
            ["vite.config.ts", "Vite \u914D\u7F6E", `import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({ plugins: [vue()] });
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, skipLibCheck: true, jsx: "preserve" }, include: ["src/**/*.ts", "src/**/*.vue"] })],
            ["src/main.ts", "\u5E94\u7528\u5F15\u5BFC", main],
            ["src/App.vue", "\u6839\u7EC4\u4EF6", appVue],
            [styleFile, "\u5168\u5C40\u6837\u5F0F", styleContent],
            ["src/components/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["src/views/.gitkeep", "\u9875\u9762\u76EE\u5F55", ""],
            ["public/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
            ...extra,
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "Vue 3 + Vite + TypeScript", "npm install\nnpm run dev")]
          ];
        }
      },
      "react-vite": {
        label: "React + Vite",
        summary: "React 18 + TypeScript + Vite \u5355\u9875\u5E94\u7528\uFF1A\u9875\u9762 / \u7EC4\u4EF6 / \u6837\u5F0F\u5206\u5C42\uFF0C\u53EF\u9009\u7EC4\u4EF6\u5E93\u3001\u72B6\u6001\u3001\u8DEF\u7531\u4E0E\u6D4B\u8BD5\u3002",
        dirs: ["public", "src/components", "src/pages", "src/styles"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {
          styling: [["css", "\u539F\u751F CSS"], ["tailwind", "Tailwind CSS"], ["scss", "SCSS"]],
          ui: [["none", "\u65E0\u7EC4\u4EF6\u5E93"], ["antd", "Ant Design"]],
          state: [["none", "\u65E0\u72B6\u6001\u5E93"], ["zustand", "Zustand"]],
          router: [["none", "\u65E0\u8DEF\u7531"], ["react-router-dom", "React Router"]],
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["vitest", "Vitest"]]
        },
        defaults: { styling: "css", ui: "none", state: "none", router: "none", test: "none" },
        files: (name, o) => {
          const deps = { react: "^18.3.0", "react-dom": "^18.3.0" };
          const devDeps = { "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0", "@vitejs/plugin-react": "^4.3.0", typescript: "^5.7.0", vite: "^6.0.0" };
          const scripts = { dev: "vite", build: "tsc -b && vite build", preview: "vite preview" };
          const extra = [];
          const imports = [];
          if (o.styling === "tailwind") {
            devDeps.tailwindcss = "^3.4.0";
            devDeps.postcss = "^8.4.0";
            devDeps.autoprefixer = "^10.4.0";
            extra.push(["tailwind.config.js", "Tailwind \u914D\u7F6E", archTailwindConfig], ["postcss.config.js", "PostCSS \u914D\u7F6E", archPostcss]);
          }
          if (o.styling === "scss") devDeps.sass = "^1.80.0";
          if (o.ui === "antd") {
            deps.antd = "^5.21.0";
            imports.push(`import "antd/dist/reset.css";`);
          }
          if (o.state === "zustand") {
            deps.zustand = "^5.0.0";
            extra.push(["src/stores/counter.ts", "\u793A\u4F8B\u72B6\u6001\uFF08Zustand\uFF09", `import { create } from "zustand";

type Counter = { count: number; inc: () => void };

export const useCounter = create<Counter>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));
`]);
          }
          if (o.router === "react-router-dom") {
            deps["react-router-dom"] = "^6.26.0";
            extra.push(["src/pages/Home.tsx", "\u9996\u9875\u9875\u9762", `export default function Home() {
  return (
    <main className="app">
      <h1>${name}</h1>
      <p>Home \u9875\u9762\uFF1A\u5728 src/App.tsx \u6DFB\u52A0\u8DEF\u7531\u3002</p>
    </main>
  );
}
`]);
          }
          if (o.test === "vitest") {
            devDeps.vitest = "^2.1.0";
            scripts.test = "vitest run";
            extra.push(["src/__tests__/app.test.ts", "\u6700\u5C0F\u5355\u6D4B", `import { describe, expect, it } from "vitest";

describe("app", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
`]);
          }
          const appTsx = o.router === "react-router-dom" ? `import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
` : `export default function App() {
  return (
    <main className="app">
      <h1>${name}</h1>
      <p>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/pages \u6DFB\u52A0\u9875\u9762\uFF0C\u5728 src/components \u6DFB\u52A0\u7EC4\u4EF6\u3002</p>
    </main>
  );
}
`;
          const main = [
            `import React from "react";`,
            `import ReactDOM from "react-dom/client";`,
            ...imports,
            `import App from "./App";`,
            `import "./styles/${o.styling === "scss" ? "main.scss" : "main.css"}";`,
            "",
            `ReactDOM.createRoot(document.getElementById("root")!).render(`,
            `  <React.StrictMode>`,
            `    <App />`,
            `  </React.StrictMode>`,
            ");",
            ""
          ].join("\n");
          const styleFile = o.styling === "scss" ? "src/styles/main.scss" : "src/styles/main.css";
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { scripts, deps, devDeps })],
            ["index.html", "\u5E94\u7528\u5165\u53E3 HTML", `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`],
            ["vite.config.ts", "Vite \u914D\u7F6E", `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, skipLibCheck: true }, include: ["src"] })],
            ["src/main.tsx", "\u5E94\u7528\u5F15\u5BFC", main],
            ["src/App.tsx", "\u6839\u7EC4\u4EF6", appTsx],
            [styleFile, "\u5168\u5C40\u6837\u5F0F", o.styling === "tailwind" ? archTailwindCss : archMainCss],
            ["src/components/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["src/pages/.gitkeep", "\u9875\u9762\u76EE\u5F55", ""],
            ["public/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
            ...extra,
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "React + Vite + TypeScript", "npm install\nnpm run dev")]
          ];
        }
      },
      "next-app": {
        label: "Next.js App Router",
        summary: "Next.js 14 App Router + TypeScript\uFF1Aapp/ \u8DEF\u7531\u76EE\u5F55\u5373\u9875\u9762\u7ED3\u6784\uFF0C\u5185\u7F6E SSR/SSG \u80FD\u529B\u3002",
        dirs: ["app", "public", "components"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {
          styling: [["css", "\u539F\u751F CSS"], ["tailwind", "Tailwind CSS"]],
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["vitest", "Vitest"]]
        },
        defaults: { styling: "css", test: "none" },
        files: (name, o) => {
          const deps = { next: "^14.2.0", react: "^18.3.0", "react-dom": "^18.3.0" };
          const devDeps = { typescript: "^5.7.0", "@types/node": "^22.10.0", "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0" };
          const scripts = { dev: "next dev", build: "next build", start: "next start" };
          const extra = [];
          let globals = archMainCss;
          if (o.styling === "tailwind") {
            devDeps.tailwindcss = "^3.4.0";
            devDeps.postcss = "^8.4.0";
            devDeps.autoprefixer = "^10.4.0";
            globals = archTailwindCss;
            extra.push(["tailwind.config.js", "Tailwind \u914D\u7F6E", archTailwindConfig], ["postcss.config.js", "PostCSS \u914D\u7F6E", archPostcss]);
          }
          if (o.test === "vitest") {
            devDeps.vitest = "^2.1.0";
            scripts.test = "vitest run";
            extra.push(["app/__tests__/app.test.ts", "\u6700\u5C0F\u5355\u6D4B", `import { describe, expect, it } from "vitest";

describe("app", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
`]);
          }
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { scripts, deps, devDeps })],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, esModuleInterop: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] })],
            ["next-env.d.ts", "Next \u7C7B\u578B\u5F15\u7528", `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`],
            ["app/layout.tsx", "\u6839\u5E03\u5C40", `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "${name}" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
`],
            ["app/page.tsx", "\u9996\u9875\u8DEF\u7531", `export default function HomePage() {
  return (
    <main className="app">
      <h1>${name}</h1>
      <p>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 app/ \u4E0B\u65B0\u589E\u8DEF\u7531\u76EE\u5F55\uFF08\u5982 app/about/page.tsx\uFF09\u3002</p>
    </main>
  );
}
`],
            ["app/globals.css", "\u5168\u5C40\u6837\u5F0F", globals],
            ["public/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
            ["components/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ...extra,
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "Next.js App Router + TypeScript", "npm install\nnpm run dev")]
          ];
        }
      },
      nuxt: {
        label: "Nuxt 3",
        summary: "Nuxt 3 + Vue 3 + TypeScript\uFF1A\u6587\u4EF6\u8DEF\u7531\uFF08pages/\uFF09\u4E0E\u81EA\u52A8\u5BFC\u5165\uFF0C\u9002\u5408\u5185\u5BB9\u578B\u7AD9\u70B9\u4E0E SSR \u5E94\u7528\u3002",
        dirs: ["pages", "components", "public"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {
          styling: [["css", "\u539F\u751F CSS"], ["tailwind", "Tailwind CSS"]],
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["vitest", "Vitest"]]
        },
        defaults: { styling: "css", test: "none" },
        files: (name, o) => {
          const deps = { nuxt: "^3.13.0", vue: "^3.5.0" };
          const devDeps = { typescript: "^5.7.0" };
          const scripts = { dev: "nuxt dev", build: "nuxt build", generate: "nuxt generate", preview: "nuxt preview" };
          const modules = [];
          const extra = [];
          if (o.styling === "tailwind") {
            deps["@nuxtjs/tailwindcss"] = "^6.12.0";
            modules.push("@nuxtjs/tailwindcss");
            extra.push(["assets/css/main.css", "\u5168\u5C40\u6837\u5F0F", archTailwindCss]);
          } else {
            extra.push(["assets/css/main.css", "\u5168\u5C40\u6837\u5F0F", archMainCss]);
          }
          if (o.test === "vitest") {
            devDeps.vitest = "^2.1.0";
            scripts.test = "vitest run";
            extra.push(["tests/app.test.ts", "\u6700\u5C0F\u5355\u6D4B", `import { describe, expect, it } from "vitest";

describe("app", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
`]);
          }
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { scripts, deps, devDeps })],
            ["nuxt.config.ts", "Nuxt \u914D\u7F6E", `export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  modules: ${JSON.stringify(modules)},
});
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ extends: "./.nuxt/tsconfig.json" })],
            ["app.vue", "\u6839\u7EC4\u4EF6", `<template>
  <NuxtPage />
</template>
`],
            ["pages/index.vue", "\u9996\u9875\u8DEF\u7531", `<script setup lang="ts">
const title = "${name}";
</script>

<template>
  <main class="app">
    <h1>{{ title }}</h1>
    <p>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 pages/ \u4E0B\u65B0\u589E .vue \u6587\u4EF6\u5373\u53EF\u751F\u6210\u8DEF\u7531\u3002</p>
  </main>
</template>
`],
            ...extra,
            ["public/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
            ["components/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "Nuxt 3 + Vue 3 + TypeScript", "npm install\nnpm run dev")]
          ];
        }
      },
      "svelte-kit": {
        label: "SvelteKit",
        summary: "SvelteKit + TypeScript\uFF1Asrc/routes \u6587\u4EF6\u8DEF\u7531\uFF0CSSR/\u9759\u6001\u9002\u914D\u5668\u53EF\u5207\u6362\u3002",
        dirs: ["src/routes", "src/lib", "static"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {
          styling: [["css", "\u539F\u751F CSS"], ["tailwind", "Tailwind CSS"]],
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["vitest", "Vitest"]]
        },
        defaults: { styling: "css", test: "none" },
        files: (name, o) => {
          const devDeps = { "@sveltejs/adapter-auto": "^3.2.0", "@sveltejs/kit": "^2.6.0", "@sveltejs/vite-plugin-svelte": "^4.0.0", svelte: "^5.0.0", typescript: "^5.7.0", vite: "^6.0.0" };
          const scripts = { dev: "vite dev", build: "vite build", preview: "vite preview" };
          const extra = [];
          let layoutImport = "";
          if (o.styling === "tailwind") {
            devDeps.tailwindcss = "^3.4.0";
            devDeps.postcss = "^8.4.0";
            devDeps.autoprefixer = "^10.4.0";
            extra.push(["tailwind.config.js", "Tailwind \u914D\u7F6E", archTailwindConfig], ["postcss.config.js", "PostCSS \u914D\u7F6E", archPostcss], ["src/app.css", "\u5168\u5C40\u6837\u5F0F", archTailwindCss]);
            layoutImport = `import "../app.css";
`;
          } else {
            extra.push(["src/app.css", "\u5168\u5C40\u6837\u5F0F", archMainCss]);
            layoutImport = `import "../app.css";
`;
          }
          if (o.test === "vitest") {
            devDeps.vitest = "^2.1.0";
            scripts.test = "vitest run";
            extra.push(["src/lib/app.test.ts", "\u6700\u5C0F\u5355\u6D4B", `import { describe, expect, it } from "vitest";

describe("app", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
`]);
          }
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { scripts, devDeps })],
            ["svelte.config.js", "SvelteKit \u914D\u7F6E", `import adapter from "@sveltejs/adapter-auto";

export default { kit: { adapter: adapter() } };
`],
            ["vite.config.ts", "Vite \u914D\u7F6E", `import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [sveltekit()] });
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ extends: "./.svelte-kit/tsconfig.json", compilerOptions: { allowJs: true, checkJs: true, esModuleInterop: true, forceConsistentCasingInFileNames: true, resolveJsonModule: true, skipLibCheck: true, sourceMap: true, strict: true, moduleResolution: "bundler" } })],
            ["src/app.html", "\u5E94\u7528 HTML \u6A21\u677F", `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`],
            ["src/routes/+layout.svelte", "\u5168\u5C40\u5E03\u5C40", `<script lang="ts">
  ${layoutImport}
</script>

<slot />
`],
            ["src/routes/+page.svelte", "\u9996\u9875\u8DEF\u7531", `<script lang="ts">
  const title = "${name}";
</script>

<main class="app">
  <h1>{title}</h1>
  <p>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/routes \u4E0B\u65B0\u589E +page.svelte\u3002</p>
</main>
`],
            ...extra,
            ["static/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "SvelteKit + TypeScript", "npm install\nnpm run dev")]
          ];
        }
      },
      static: {
        label: "\u539F\u751F HTML/CSS/JS",
        summary: "\u96F6\u4F9D\u8D56\u9759\u6001\u7AD9\u70B9\uFF1Aindex.html + styles.css + app.js\uFF0C\u53EF\u76F4\u63A5\u53CC\u51FB\u6216\u4EFB\u610F\u9759\u6001\u670D\u52A1\u5668\u6258\u7BA1\u3002",
        dirs: ["assets"],
        commands: { install: "\u65E0\u9700\u5B89\u88C5", dev: "\u4EFB\u610F\u9759\u6001\u670D\u52A1\u5668\uFF08\u5982 npx serve .\uFF09", build: "\u65E0\u9700\u6784\u5EFA\uFF0C\u76F4\u63A5\u90E8\u7F72\u76EE\u5F55" },
        options: {},
        defaults: {},
        files: (name) => [
          ["index.html", "\u9875\u9762\u5165\u53E3", `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="app">
      <h1>${name}</h1>
      <p id="tip">\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u7F16\u8F91 index.html / styles.css / app.js\u3002</p>
      <button id="cta">\u70B9\u6211</button>
    </main>
    <script src="./app.js"></script>
  </body>
</html>
`],
          ["styles.css", "\u5168\u5C40\u6837\u5F0F", `:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; }
.app { max-width: 960px; margin: 64px auto; padding: 0 24px; }
button { margin-top: 16px; padding: 8px 14px; }
`],
          ["app.js", "\u9875\u9762\u811A\u672C", `document.getElementById("cta")?.addEventListener("click", () => {
  const tip = document.getElementById("tip");
  if (tip) tip.textContent = "\u4F60\u597D\uFF0C${name}\uFF01";
});
`],
          ["assets/.gitkeep", "\u9759\u6001\u8D44\u6E90\u76EE\u5F55", ""],
          ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "\u539F\u751F HTML/CSS/JS", "npx serve .")]
        ]
      }
    }
  },
  miniprogram: {
    label: "\u5C0F\u7A0B\u5E8F",
    frameworks: {
      taro: {
        label: "Taro\uFF08React\uFF09",
        summary: "Taro 4 + React + TypeScript \u8DE8\u7AEF\u5C0F\u7A0B\u5E8F\uFF1A\u914D\u7F6E / \u5E94\u7528 / \u9875\u9762\u5206\u5C42\uFF0C\u53EF\u7F16\u8BD1\u5230\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u3002",
        dirs: ["config", "src/pages/index"],
        commands: { install: "npm install", dev: "npm run dev:weapp", build: "npm run build:weapp" },
        options: {},
        defaults: {},
        files: (name) => {
          const slug = archSlug(name);
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archJson({
              name: slug,
              private: true,
              version: "0.1.0",
              scripts: { "dev:weapp": "taro build --type weapp --watch", "build:weapp": "taro build --type weapp" },
              dependencies: { "@tarojs/components": "^4.0.0", "@tarojs/helper": "^4.0.0", "@tarojs/plugin-framework-react": "^4.0.0", "@tarojs/react": "^4.0.0", "@tarojs/runtime": "^4.0.0", "@tarojs/taro": "^4.0.0", react: "^18.2.0", "react-dom": "^18.2.0" },
              devDependencies: { "@tarojs/cli": "^4.0.0", "@tarojs/webpack5-runner": "^4.0.0", typescript: "^5.7.0" }
            })],
            ["config/index.ts", "Taro \u7F16\u8BD1\u914D\u7F6E", `export default {
  projectName: "${slug}",
  outputRoot: "dist",
  framework: "react",
  compiler: { type: "webpack5", prebundle: { enable: true } },
};
`],
            ["project.config.json", "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u914D\u7F6E", archJson({ miniprogramRoot: "dist/", projectname: slug, appid: "touristappid", setting: { es6: true } })],
            ["src/app.tsx", "\u5E94\u7528\u5165\u53E3", `import { PropsWithChildren } from "react";
import "./app.scss";

export default function App({ children }: PropsWithChildren) {
  return children;
}
`],
            ["src/app.config.ts", "\u5E94\u7528\u914D\u7F6E\uFF08\u9875\u9762\u6CE8\u518C\uFF09", `export default {
  pages: ["pages/index/index"],
  window: { navigationBarTitleText: "${name}" },
};
`],
            ["src/app.scss", "\u5168\u5C40\u6837\u5F0F", `page { background: #f5f5f5; }
`],
            ["src/pages/index/index.tsx", "\u9996\u9875", `import { View, Text } from "@tarojs/components";
import "./index.scss";

export default function Index() {
  return (
    <View className="page">
      <Text className="title">${name}</Text>
      <Text>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/pages \u4E0B\u65B0\u589E\u9875\u9762\u5E76\u6CE8\u518C\u5230 app.config.ts\u3002</Text>
    </View>
  );
}
`],
            ["src/pages/index/index.config.ts", "\u9996\u9875\u914D\u7F6E", `export default { navigationBarTitleText: "\u9996\u9875" };
`],
            ["src/pages/index/index.scss", "\u9996\u9875\u6837\u5F0F", `.page { padding: 24px; }
.title { display: block; font-size: 32px; font-weight: 700; margin-bottom: 12px; }
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2020", module: "ESNext", moduleResolution: "Node", jsx: "react-jsx", strict: true, skipLibCheck: true } })],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

Taro 4 + React + TypeScript \u5C0F\u7A0B\u5E8F\u3002

\`\`\`bash
npm install
npm run dev:weapp
\`\`\`

\u7528\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u6253\u5F00\u9879\u76EE\u6839\u76EE\u5F55\uFF08\u8BFB\u53D6 dist/\uFF09\u3002
`]
          ];
        }
      },
      "uni-app": {
        label: "uni-app\uFF08Vue 3\uFF09",
        summary: "uni-app + Vue 3 + Vite\uFF1A\u4E00\u5957\u4EE3\u7801\u7F16\u8BD1\u5230\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F/H5/App\u3002",
        dirs: ["src/pages/index"],
        commands: { install: "npm install", dev: "npm run dev:mp-weixin", build: "npm run build:mp-weixin" },
        options: {},
        defaults: {},
        files: (name) => {
          const slug = archSlug(name);
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archJson({
              name: slug,
              private: true,
              version: "0.1.0",
              scripts: { "dev:mp-weixin": "uni -p mp-weixin", "build:mp-weixin": "uni build -p mp-weixin", "dev:h5": "uni", "build:h5": "uni build" },
              dependencies: { "@dcloudio/uni-app": "^3.0.0", "@dcloudio/uni-mp-weixin": "^3.0.0", vue: "^3.4.0" },
              devDependencies: { "@dcloudio/types": "^3.4.0", "@dcloudio/vite-plugin-uni": "^3.0.0", typescript: "^5.4.0", vite: "^5.2.0" }
            })],
            ["vite.config.ts", "Vite \u914D\u7F6E", `import uni from "@dcloudio/vite-plugin-uni";

export default { plugins: [uni()] };
`],
            ["index.html", "H5 \u5165\u53E3", `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`],
            ["src/main.ts", "\u5E94\u7528\u5F15\u5BFC", `import { createSSRApp } from "vue";
import App from "./App.vue";

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
`],
            ["src/App.vue", "\u6839\u7EC4\u4EF6", `<script setup lang="ts"></script>

<template>
  <slot />
</template>
`],
            ["src/pages.json", "\u9875\u9762\u6CE8\u518C", archJson({ pages: [{ path: "pages/index/index", style: { navigationBarTitleText: name } }], globalStyle: { navigationBarTitleText: name } })],
            ["src/pages/index/index.vue", "\u9996\u9875", `<script setup lang="ts">
const title = "${name}";
</script>

<template>
  <view class="page">
    <text class="title">{{ title }}</text>
    <text>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/pages \u4E0B\u65B0\u589E\u9875\u9762\u5E76\u6CE8\u518C\u5230 pages.json\u3002</text>
  </view>
</template>

<style>
.page { padding: 24rpx; }
.title { display: block; font-size: 40rpx; font-weight: 700; margin-bottom: 16rpx; }
</style>
`],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2020", module: "ESNext", moduleResolution: "Node", strict: true, skipLibCheck: true, types: ["@dcloudio/types"] } })],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

uni-app + Vue 3 \u5C0F\u7A0B\u5E8F\u3002

\`\`\`bash
npm install
npm run dev:mp-weixin
\`\`\`

\u7528\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u6253\u5F00 dist/dev/mp-weixin\u3002
`]
          ];
        }
      },
      "native-wechat": {
        label: "\u5FAE\u4FE1\u539F\u751F",
        summary: "\u5FAE\u4FE1\u539F\u751F\u5C0F\u7A0B\u5E8F\uFF1Aapp \u5168\u5C40 + pages \u9875\u9762\u56DB\u4EF6\u5957\uFF0C\u65E0\u6784\u5EFA\u4F9D\u8D56\u3002",
        dirs: ["pages/index"],
        commands: { install: "\u65E0\u9700\u5B89\u88C5", dev: "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u6253\u5F00\u9879\u76EE\u76EE\u5F55", build: "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u4E0A\u4F20" },
        options: {},
        defaults: {},
        files: (name) => {
          const slug = archSlug(name);
          return [
            ["project.config.json", "\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u914D\u7F6E", archJson({ description: name, projectname: slug, appid: "touristappid", compileType: "miniprogram", setting: { es6: true, minified: true } })],
            ["app.js", "\u5E94\u7528\u5165\u53E3", `App({ onLaunch() {} });
`],
            ["app.json", "\u5E94\u7528\u914D\u7F6E\uFF08\u9875\u9762\u6CE8\u518C\uFF09", archJson({ pages: ["pages/index/index"], window: { navigationBarTitleText: name } })],
            ["app.wxss", "\u5168\u5C40\u6837\u5F0F", `page { background: #f5f5f5; }
`],
            ["sitemap.json", "\u7D22\u5F15\u914D\u7F6E", archJson({ rules: [{ action: "allow", page: "*" }] })],
            ["pages/index/index.js", "\u9996\u9875\u903B\u8F91", `Page({ data: { title: "${name}" } });
`],
            ["pages/index/index.json", "\u9996\u9875\u914D\u7F6E", archJson({ navigationBarTitleText: "\u9996\u9875" })],
            ["pages/index/index.wxml", "\u9996\u9875\u7ED3\u6784", `<view class="page">
  <view class="title">{{title}}</view>
  <view>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 pages \u4E0B\u65B0\u589E\u9875\u9762\u5E76\u6CE8\u518C\u5230 app.json\u3002</view>
</view>
`],
            ["pages/index/index.wxss", "\u9996\u9875\u6837\u5F0F", `.page { padding: 24px; }
.title { font-size: 32rpx; font-weight: 700; margin-bottom: 16rpx; }
`],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

\u5FAE\u4FE1\u539F\u751F\u5C0F\u7A0B\u5E8F\u3002\u7528\u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u6253\u5F00\u672C\u76EE\u5F55\u5373\u53EF\u9884\u89C8\u3002
`]
          ];
        }
      }
    }
  },
  mobile: {
    label: "\u79FB\u52A8 App",
    frameworks: {
      flutter: {
        label: "Flutter",
        summary: "Flutter \u8DE8\u7AEF App\uFF1Alib/pages + lib/widgets \u5206\u5C42\uFF0C\u53EF\u76F4\u63A5 flutter run\u3002",
        dirs: ["lib/pages", "lib/widgets"],
        commands: { install: "flutter pub get", dev: "flutter run", build: "flutter build apk --release" },
        options: {},
        defaults: {},
        files: (name) => {
          const slug = archSlug(name).replace(/-/g, "_");
          return [
            ["pubspec.yaml", "\u4F9D\u8D56\u4E0E\u5143\u6570\u636E", `name: ${slug}
description: ${name}
publish_to: "none"
version: 0.1.0
environment:
  sdk: ">=3.4.0 <4.0.0"
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
flutter:
  uses-material-design: true
`],
            ["analysis_options.yaml", "\u9759\u6001\u68C0\u67E5", `include: package:flutter_lints/flutter.yaml
`],
            ["lib/main.dart", "\u5E94\u7528\u5165\u53E3", `import "package:flutter/material.dart";

void main() => runApp(const App());

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "${name}",
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("${name}")),
      body: const Center(child: Text("\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 lib/pages \u6DFB\u52A0\u9875\u9762")),
    );
  }
}
`],
            ["lib/pages/.gitkeep", "\u9875\u9762\u76EE\u5F55", ""],
            ["lib/widgets/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "Flutter App", "flutter pub get\nflutter run")]
          ];
        }
      },
      swiftui: {
        label: "SwiftUI",
        summary: "SwiftUI App \u4EE3\u7801\u9AA8\u67B6\uFF08App / Views / Features \u5206\u5C42\uFF09\u3002",
        dirs: ["App/Views", "App/Features", "App/Resources"],
        commands: { install: "Xcode \u6253\u5F00\u5DE5\u7A0B", dev: "Xcode Run", build: "Xcode Archive" },
        options: {},
        defaults: {},
        files: (name) => [
          ["App/AppApp.swift", "\u5E94\u7528\u5165\u53E3", `import SwiftUI

@main
struct ${String(name).replace(/[^A-Za-z0-9]/g, "") || "App"}App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`],
          ["App/Views/ContentView.swift", "\u6839\u89C6\u56FE", `import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Text("${name}").font(.title.bold())
            Text("\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 App/Features \u6DFB\u52A0\u529F\u80FD\u6A21\u5757")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
`],
          ["App/Features/.gitkeep", "\u529F\u80FD\u6A21\u5757\u76EE\u5F55", ""],
          ["App/Resources/.gitkeep", "\u8D44\u6E90\u76EE\u5F55", ""],
          ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

SwiftUI App \u9AA8\u67B6\u3002\u7528 Xcode \u65B0\u5EFA\u5DE5\u7A0B\u540E\u628A App/ \u4E0B\u7684\u6587\u4EF6\u52A0\u5165\u5DE5\u7A0B\u3002
`]
        ]
      },
      expo: {
        label: "React Native\uFF08Expo\uFF09",
        summary: "Expo + React Native + TypeScript\uFF1A\u65E0\u9700 Xcode/Android Studio \u5373\u53EF npx expo start \u9884\u89C8\u3002",
        dirs: ["src/screens", "src/components", "assets"],
        commands: { install: "npm install", dev: "npx expo start", build: "npx expo export" },
        options: {},
        defaults: {},
        files: (name) => {
          const slug = archSlug(name);
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archJson({
              name: slug,
              private: true,
              version: "0.1.0",
              main: "node_modules/expo/AppEntry.js",
              scripts: { start: "expo start", android: "expo start --android", ios: "expo start --ios", web: "expo start --web" },
              dependencies: { expo: "^52.0.0", react: "^18.3.0", "react-native": "^0.76.0", "expo-status-bar": "^2.0.0" },
              devDependencies: { "@types/react": "^18.3.0", typescript: "^5.7.0" }
            })],
            ["app.json", "Expo \u914D\u7F6E", archJson({ expo: { name, slug, version: "0.1.0", orientation: "portrait", userInterfaceStyle: "automatic", newArchEnabled: true } })],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ extends: "expo/tsconfig.base", compilerOptions: { strict: true } })],
            ["babel.config.js", "Babel \u914D\u7F6E", `module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
`],
            ["App.tsx", "\u5E94\u7528\u5165\u53E3", `import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>${name}</Text>
      <Text>\u5F00\u59CB\u5B9E\u73B0\u9875\u9762\uFF1A\u5728 src/screens \u6DFB\u52A0\u5C4F\u5E55\u3002</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  title: { fontSize: 22, fontWeight: "700" },
});
`],
            ["src/screens/.gitkeep", "\u5C4F\u5E55\u76EE\u5F55", ""],
            ["src/components/.gitkeep", "\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["assets/.gitkeep", "\u8D44\u6E90\u76EE\u5F55", ""],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", archReadme(name, "Expo + React Native + TypeScript", "npm install\nnpx expo start")]
          ];
        }
      }
    }
  },
  backend: {
    label: "\u540E\u7AEF\u670D\u52A1",
    frameworks: {
      nest: {
        label: "NestJS",
        summary: "NestJS + TypeScript \u670D\u52A1\uFF1A\u6A21\u5757 / \u63A7\u5236\u5668 / \u670D\u52A1\u5206\u5C42\uFF0C\u9ED8\u8BA4\u76D1\u542C 3000\u3002",
        dirs: ["src/common", "src/modules"],
        commands: { install: "npm install", dev: "npm run start:dev", build: "npm run build" },
        options: {
          test: [["none", "\u65E0\u6D4B\u8BD5"], ["jest", "Jest"]]
        },
        defaults: { test: "none" },
        files: (name, o) => {
          const deps = { "@nestjs/common": "^10.4.0", "@nestjs/core": "^10.4.0", "@nestjs/platform-express": "^10.4.0", "reflect-metadata": "^0.2.2", rxjs: "^7.8.1" };
          const devDeps = { "@nestjs/cli": "^10.4.0", "@types/node": "^22.10.0", "ts-node": "^10.9.2", typescript: "^5.7.0" };
          const scripts = { "start:dev": "nest start --watch", build: "nest build", start: "node dist/main.js" };
          const extra = [];
          if (o.test === "jest") {
            devDeps.jest = "^29.7.0";
            devDeps["ts-jest"] = "^29.2.0";
            devDeps["@types/jest"] = "^29.5.0";
            scripts.test = "jest";
            extra.push(["src/app.service.spec.ts", "\u793A\u4F8B\u5355\u6D4B", `import { AppService } from "./app.service";

describe("AppService", () => {
  it("health ok", () => {
    const svc = new AppService();
    expect(svc.health().ok).toBe(true);
  });
});
`]);
          }
          return [
            ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, { type: "", scripts, deps, devDeps })],
            ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2022", module: "commonjs", moduleResolution: "node", experimentalDecorators: true, emitDecoratorMetadata: true, outDir: "dist", strict: true, skipLibCheck: true }, include: ["src/**/*.ts"] })],
            ["nest-cli.json", "Nest CLI \u914D\u7F6E", archJson({ collection: "@nestjs/schematics", sourceRoot: "src" })],
            ["src/main.ts", "\u670D\u52A1\u5165\u53E3", `import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
`],
            ["src/app.module.ts", "\u6839\u6A21\u5757", `import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`],
            ["src/app.controller.ts", "\u6839\u63A7\u5236\u5668", `import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("healthz")
  health() {
    return this.appService.health();
  }
}
`],
            ["src/app.service.ts", "\u6839\u670D\u52A1", `import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return { ok: true, service: "${name}" };
  }
}
`],
            [".env.example", "\u73AF\u5883\u53D8\u91CF\u6837\u4F8B", `PORT=3000
`],
            ["src/common/.gitkeep", "\u516C\u5171\u7EC4\u4EF6\u76EE\u5F55", ""],
            ["src/modules/.gitkeep", "\u4E1A\u52A1\u6A21\u5757\u76EE\u5F55", ""],
            ...extra,
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

NestJS \u670D\u52A1\u3002

\`\`\`bash
npm install
npm run start:dev
curl http://127.0.0.1:3000/healthz
\`\`\`
`]
          ];
        }
      },
      "go-gin": {
        label: "Go + Gin",
        summary: "Go + Gin HTTP \u670D\u52A1\uFF1Acmd / internal \u5206\u5C42\uFF0C\u9ED8\u8BA4\u76D1\u542C 8080\u3002",
        dirs: ["cmd/server", "internal/handler", "internal/service", "internal/store"],
        commands: { install: "go mod tidy", dev: "go run ./cmd/server", build: "go build -o bin/server ./cmd/server" },
        options: {},
        defaults: {},
        files: (name) => {
          const mod = archSlug(name);
          return [
            ["go.mod", "\u6A21\u5757\u5B9A\u4E49", `module ${mod}

go 1.22

require github.com/gin-gonic/gin v1.10.0
`],
            ["cmd/server/main.go", "\u670D\u52A1\u5165\u53E3", `package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "service": "${name}"})
	})
	_ = r.Run(":8080")
}
`],
            ["internal/handler/.gitkeep", "HTTP \u5904\u7406\u5668\u76EE\u5F55", ""],
            ["internal/service/.gitkeep", "\u4E1A\u52A1\u903B\u8F91\u76EE\u5F55", ""],
            ["internal/store/.gitkeep", "\u6570\u636E\u8BBF\u95EE\u76EE\u5F55", ""],
            ["Makefile", "\u5E38\u7528\u547D\u4EE4", `.PHONY: run build
run:
	go run ./cmd/server
build:
	go build -o bin/server ./cmd/server
`],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

Go + Gin \u670D\u52A1\u3002

\`\`\`bash
go mod tidy
go run ./cmd/server
curl http://127.0.0.1:8080/healthz
\`\`\`
`]
          ];
        }
      },
      express: {
        label: "Express + TS",
        summary: "Express + TypeScript \u8F7B\u91CF\u670D\u52A1\uFF1Asrc/routes \u5206\u5C42\uFF0C\u9ED8\u8BA4\u76D1\u542C 3000\uFF0Ctsx \u70ED\u66F4\u65B0\u3002",
        dirs: ["src/routes", "src/middleware"],
        commands: { install: "npm install", dev: "npm run dev", build: "npm run build" },
        options: {},
        defaults: {},
        files: (name) => [
          ["package.json", "\u4F9D\u8D56\u4E0E\u811A\u672C", archPkg(name, {
            scripts: { dev: "tsx watch src/main.ts", build: "tsc -p tsconfig.json", start: "node dist/main.js" },
            deps: { express: "^4.21.0", cors: "^2.8.5" },
            devDeps: { "@types/express": "^5.0.0", "@types/cors": "^2.8.17", "@types/node": "^22.10.0", tsx: "^4.19.0", typescript: "^5.7.0" }
          })],
          ["tsconfig.json", "TypeScript \u914D\u7F6E", archJson({ compilerOptions: { target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", outDir: "dist", strict: true, skipLibCheck: true, esModuleInterop: true }, include: ["src"] })],
          ["src/main.ts", "\u670D\u52A1\u5165\u53E3", `import express from "express";
import cors from "cors";
import { healthRouter } from "./routes/health.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(healthRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log("${name} api on :" + port));
`],
          ["src/routes/health.ts", "\u5065\u5EB7\u68C0\u67E5\u8DEF\u7531", `import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "${name}" });
});
`],
          ["src/middleware/.gitkeep", "\u4E2D\u95F4\u4EF6\u76EE\u5F55", ""],
          [".env.example", "\u73AF\u5883\u53D8\u91CF\u6837\u4F8B", `PORT=3000
`],
          ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

Express + TypeScript \u670D\u52A1\u3002

\`\`\`bash
npm install
npm run dev
curl http://127.0.0.1:3000/healthz
\`\`\`
`]
        ]
      },
      fastapi: {
        label: "Python FastAPI",
        summary: "FastAPI + Uvicorn\uFF1Aapp/routers \u5206\u5C42\uFF0C\u81EA\u5E26 OpenAPI \u6587\u6863\uFF08/docs\uFF09\u3002",
        dirs: ["app/routers", "app/models", "tests"],
        commands: { install: "pip install -r requirements.txt", dev: "uvicorn app.main:app --reload", build: "\u65E0\u9700\u6784\u5EFA\uFF08\u6E90\u7801\u90E8\u7F72\uFF09" },
        options: {},
        defaults: {},
        files: (name) => [
          ["requirements.txt", "Python \u4F9D\u8D56", `fastapi>=0.115.0
uvicorn[standard]>=0.32.0
pydantic>=2.9.0
`],
          ["app/__init__.py", "\u5305\u6807\u8BB0", ""],
          ["app/main.py", "\u670D\u52A1\u5165\u53E3", `from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="${name}")
app.include_router(health.router)
`],
          ["app/routers/__init__.py", "\u8DEF\u7531\u5305", ""],
          ["app/routers/health.py", "\u5065\u5EB7\u68C0\u67E5\u8DEF\u7531", `from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
def healthz():
    return {"ok": True, "service": "${name}"}
`],
          ["app/models/__init__.py", "\u6570\u636E\u6A21\u578B\u5305", ""],
          ["tests/__init__.py", "\u6D4B\u8BD5\u5305", ""],
          [".env.example", "\u73AF\u5883\u53D8\u91CF\u6837\u4F8B", `PORT=8000
`],
          ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

FastAPI \u670D\u52A1\u3002

\`\`\`bash
pip install -r requirements.txt
uvicorn app.main:app --reload
# http://127.0.0.1:8000/docs
\`\`\`
`]
        ]
      },
      "spring-boot": {
        label: "Spring Boot",
        summary: "Spring Boot 3 + Java 21\uFF1AMaven \u6784\u5EFA\uFF0Ccontroller \u5206\u5C42\uFF0C\u9ED8\u8BA4\u76D1\u542C 8080\u3002",
        dirs: ["src/main/java/com/example/demo", "src/main/resources"],
        commands: { install: "mvn -q dependency:resolve", dev: "mvn spring-boot:run", build: "mvn -q package" },
        options: {},
        defaults: {},
        files: (name) => [
          ["pom.xml", "Maven \u4F9D\u8D56", `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>${archSlug(name)}</artifactId>
  <version>0.1.0</version>
  <properties><java.version>21</java.version></properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
`],
          ["src/main/java/com/example/demo/DemoApplication.java", "\u5E94\u7528\u5165\u53E3", `package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
`],
          ["src/main/java/com/example/demo/HealthController.java", "\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3", `package com.example.demo;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "${name}");
    }
}
`],
          ["src/main/resources/application.yml", "\u5E94\u7528\u914D\u7F6E", `server:
  port: 8080
`],
          ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

Spring Boot 3 \u670D\u52A1\u3002

\`\`\`bash
mvn spring-boot:run
curl http://127.0.0.1:8080/healthz
\`\`\`
`]
        ]
      }
    }
  },
  monorepo: {
    label: "Monorepo \u5168\u6808",
    frameworks: {
      "pnpm-workspace": {
        label: "pnpm workspace",
        summary: "pnpm monorepo\uFF1Aapps/web + apps/api + packages/ui \u4E09\u5305\u7ED3\u6784\uFF0C\u5171\u4EAB\u4F9D\u8D56\u4E0E\u811A\u672C\u3002",
        dirs: ["apps/web", "apps/api", "packages/ui"],
        commands: { install: "pnpm install", dev: "pnpm -r dev", build: "pnpm -r build" },
        options: {},
        defaults: {},
        files: (name) => {
          const scope = archSlug(name);
          return [
            ["package.json", "\u6839\u4F9D\u8D56\u4E0E\u811A\u672C", archJson({ name: scope, private: true, version: "0.1.0", packageManager: "pnpm@9.12.0", scripts: { dev: "pnpm -r dev", build: "pnpm -r build", lint: "pnpm -r lint" } })],
            ["pnpm-workspace.yaml", "workspace \u58F0\u660E", `packages:
  - "apps/*"
  - "packages/*"
`],
            ["apps/web/package.json", "Web \u5E94\u7528\u5305", archJson({ name: `@${scope}/web`, private: true, version: "0.1.0", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" }, devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.3.0" } })],
            ["apps/web/index.html", "Web \u5165\u53E3 HTML", `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><title>${name}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`],
            ["apps/web/src/main.tsx", "Web \u5165\u53E3", `import React from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(<h1>${name}</h1>);
`],
            ["apps/api/package.json", "API \u5E94\u7528\u5305", archJson({ name: `@${scope}/api`, private: true, version: "0.1.0", scripts: { dev: "tsx watch src/main.ts", build: "tsc -p tsconfig.json" }, dependencies: { express: "^4.21.0" }, devDependencies: { "@types/express": "^5.0.0", "@types/node": "^22.10.0", tsx: "^4.19.0", typescript: "^5.7.0" } })],
            ["apps/api/src/main.ts", "API \u5165\u53E3", `import express from "express";

const app = express();
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.listen(3000, () => console.log("api on :3000"));
`],
            ["packages/ui/package.json", "\u5171\u4EAB UI \u5305", archJson({ name: `@${scope}/ui`, private: true, version: "0.1.0", main: "src/index.ts" })],
            ["packages/ui/src/index.ts", "\u5171\u4EAB\u7EC4\u4EF6\u51FA\u53E3", `export const version = "0.1.0";
`],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

pnpm monorepo\uFF1Aapps/web\u3001apps/api\u3001packages/ui\u3002

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`]
          ];
        }
      },
      turbo: {
        label: "Turborepo",
        summary: "Turborepo + pnpm\uFF1A\u5E26\u4EFB\u52A1\u7F13\u5B58\u4E0E\u4F9D\u8D56\u62D3\u6251\u7684 monorepo\uFF0C\u9002\u5408\u591A\u5E94\u7528/\u591A\u5305\u534F\u4F5C\u3002",
        dirs: ["apps/web", "apps/api", "packages/ui"],
        commands: { install: "pnpm install", dev: "pnpm dev", build: "pnpm build" },
        options: {},
        defaults: {},
        files: (name) => {
          const scope = archSlug(name);
          return [
            ["package.json", "\u6839\u4F9D\u8D56\u4E0E\u811A\u672C", archJson({ name: scope, private: true, version: "0.1.0", packageManager: "pnpm@9.12.0", scripts: { dev: "turbo dev", build: "turbo build", lint: "turbo lint" }, devDependencies: { turbo: "^2.1.0" } })],
            ["turbo.json", "Turbo \u4EFB\u52A1\u914D\u7F6E", archJson({ $schema: "https://turbo.build/schema.json", tasks: { build: { dependsOn: ["^build"], outputs: ["dist/**"] }, dev: { cache: false, persistent: true }, lint: {} } })],
            ["pnpm-workspace.yaml", "workspace \u58F0\u660E", `packages:
  - "apps/*"
  - "packages/*"
`],
            ["apps/web/package.json", "Web \u5E94\u7528\u5305", archJson({ name: `@${scope}/web`, private: true, version: "0.1.0", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" }, devDependencies: { vite: "^6.0.0", "@vitejs/plugin-react": "^4.3.0" } })],
            ["apps/web/index.html", "Web \u5165\u53E3 HTML", `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8" /><title>${name}</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>
`],
            ["apps/web/src/main.tsx", "Web \u5165\u53E3", `import React from "react";
import ReactDOM from "react-dom/client";

ReactDOM.createRoot(document.getElementById("root")!).render(<h1>${name}</h1>);
`],
            ["apps/api/package.json", "API \u5E94\u7528\u5305", archJson({ name: `@${scope}/api`, private: true, version: "0.1.0", scripts: { dev: "tsx watch src/main.ts", build: "tsc -p tsconfig.json" }, dependencies: { express: "^4.21.0" }, devDependencies: { "@types/express": "^5.0.0", "@types/node": "^22.10.0", tsx: "^4.19.0", typescript: "^5.7.0" } })],
            ["apps/api/src/main.ts", "API \u5165\u53E3", `import express from "express";

const app = express();
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.listen(3000, () => console.log("api on :3000"));
`],
            ["packages/ui/package.json", "\u5171\u4EAB UI \u5305", archJson({ name: `@${scope}/ui`, private: true, version: "0.1.0", main: "src/index.ts" })],
            ["packages/ui/src/index.ts", "\u5171\u4EAB\u7EC4\u4EF6\u51FA\u53E3", `export const version = "0.1.0";
`],
            ["README.md", "\u9879\u76EE\u8BF4\u660E", `# ${name}

Turborepo + pnpm monorepo\u3002

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`]
          ];
        }
      }
    }
  }
};
function resolveArchOptions(fwPreset, input = {}) {
  const supported = fwPreset.options ?? {};
  const out = { ...fwPreset.defaults ?? {} };
  for (const key of Object.keys(input ?? {})) {
    if (!supported[key]) throw new Error(`\u8BE5\u6846\u67B6\u4E0D\u652F\u6301\u9009\u9879 ${key}\uFF08\u652F\u6301\uFF1A${Object.keys(supported).join("\u3001") || "\u65E0"}\uFF09`);
  }
  for (const key of Object.keys(supported)) {
    const val = input?.[key];
    if (val === void 0 || val === null || val === "") continue;
    if (!supported[key].some(([id]) => id === val)) {
      throw new Error(`\u9009\u9879 ${key} \u4E0D\u652F\u6301\u53D6\u503C ${val}\uFF08\u53EF\u9009\uFF1A${supported[key].map(([id]) => id).join("\u3001")}\uFF09`);
    }
    out[key] = val;
  }
  return out;
}
function archStackLabels(fwPreset, options) {
  const labels = [fwPreset.label];
  for (const [key, choices] of Object.entries(fwPreset.options ?? {})) {
    const val = options?.[key];
    const found = choices.find(([id]) => id === val);
    if (found && found[1] && !String(found[1]).startsWith("\u65E0") && found[1] !== "none") labels.push(found[1]);
  }
  return labels;
}
function archTreeText(dirs, filePaths) {
  const dirSet = new Set(dirs);
  for (const p of [...dirs, ...filePaths]) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) dirSet.add(parts.slice(0, i).join("/"));
  }
  const all = [.../* @__PURE__ */ new Set([...dirSet, ...filePaths])].sort();
  return all.map((p) => {
    const depth = Math.max(0, p.split("/").length - 1);
    return `${"  ".repeat(depth)}${p.split("/").pop()}${dirSet.has(p) ? "/" : ""}`;
  }).join("\n");
}
function archDocMd(plan) {
  const cmd = plan.commands ?? {};
  return `# ${plan.name} \xB7 \u67B6\u6784\u8BF4\u660E

> \u72B6\u6001\uFF1A${plan.status === "scaffolded" ? "\u9AA8\u67B6\u5DF2\u5199\u5165" : "\u5DF2\u89C4\u5212\uFF08\u5C1A\u672A\u5199\u5165\u9AA8\u67B6\uFF09"}
> \u6280\u672F\u6808\uFF1A${(plan.stack ?? []).join(" \xB7 ")}
> \u751F\u6210\u65F6\u95F4\uFF1A${plan.generatedAt}

## \u76EE\u5F55\u7ED3\u6784

\`\`\`
${archTreeText(plan.dirs ?? [], (plan.files ?? []).map((f) => f.path))}
\`\`\`

## \u5E38\u7528\u547D\u4EE4

| \u7528\u9014 | \u547D\u4EE4 |
| --- | --- |
| \u5B89\u88C5 | \`${cmd.install ?? "-"}\` |
| \u5F00\u53D1 | \`${cmd.dev ?? "-"}\` |
| \u6784\u5EFA | \`${cmd.build ?? "-"}\` |

## \u6280\u672F\u6808\u7EC4\u5408

${(plan.stack ?? []).map((s) => `- ${s}`).join("\n")}

## \u51B3\u7B56\u8BB0\u5F55

- [\u6280\u672F\u6808\u9009\u578B](decisions/0001-tech-stack.md)
- [\u76EE\u5F55\u7ED3\u6784](decisions/0002-directory-layout.md)

## \u7EA6\u5B9A

- \u65B0\u6A21\u5757\u9075\u5FAA\u4E0A\u9762\u7684\u5206\u5C42\u4E0E\u76EE\u5F55\u804C\u8D23\uFF1B
- \u4FEE\u6539\u67B6\u6784\u65F6\u540C\u6B65\u66F4\u65B0\u672C\u6587\u4EF6\uFF0C\u5E76\u8FFD\u52A0\u65B0\u7684 ADR\uFF1B
- \u9AA8\u67B6\u5199\u5165\u540E\u53EF\u7528 \`wudi_architecture\` \u590D\u6838\u7ED3\u6784\u4E0E\u6280\u672F\u6808\u3002
`;
}
function archAdrStackMd(plan) {
  const opts = Object.entries(plan.options ?? {}).filter(([, v]) => v && v !== "none").map(([k, v]) => `- ${k}\uFF1A${v}`);
  return `# ADR 0001\uFF1A\u6280\u672F\u6808\u9009\u578B

- \u72B6\u6001\uFF1A\u5DF2\u63A5\u53D7
- \u65E5\u671F\uFF1A${String(plan.generatedAt ?? "").slice(0, 10)}
- \u51B3\u7B56\uFF1A${(plan.stack ?? []).join(" \xB7 ")}

## \u80CC\u666F

\u9879\u76EE\u521D\u59CB\u4E3A\u7A7A\uFF0C\u9700\u8981\u4E00\u5957\u53EF\u76F4\u63A5\u542F\u52A8\u3001\u4FBF\u4E8E\u6269\u5C55\u7684\u6280\u672F\u6808\u3002

## \u51B3\u7B56

- \u9879\u76EE\u7C7B\u578B\uFF1A${plan.kindLabel}
- \u6846\u67B6\uFF1A${plan.frameworkLabel}
${opts.length ? opts.join("\n") : "- \u672A\u542F\u7528\u989D\u5916\u7EC4\u5408\u9879"}

## \u5F71\u54CD

- \u4F9D\u8D56\u4E0E\u811A\u672C\u5199\u5165 package.json\uFF08\u5982\u9002\u7528\uFF09\uFF1B
- \u76EE\u5F55\u6309 ${plan.kindLabel} \u7EA6\u5B9A\u5206\u5C42\uFF1B
- \u66FF\u6362\u4EFB\u4E00\u7EC4\u4EF6\u9700\u8FFD\u52A0\u65B0\u7684 ADR\u3002
`;
}
function archAdrLayoutMd(plan) {
  return `# ADR 0002\uFF1A\u76EE\u5F55\u7ED3\u6784

- \u72B6\u6001\uFF1A\u5DF2\u63A5\u53D7
- \u65E5\u671F\uFF1A${String(plan.generatedAt ?? "").slice(0, 10)}
- \u51B3\u7B56\uFF1A\u91C7\u7528\u4EE5\u4E0B\u9876\u5C42\u76EE\u5F55\u4E0E\u5206\u5C42

## \u76EE\u5F55

${(plan.dirs ?? []).map((d) => `- \`${d}/\``).join("\n") || "- \uFF08\u65E0\u989D\u5916\u76EE\u5F55\uFF09"}

## \u6587\u4EF6\u804C\u8D23

${(plan.files ?? []).map((f) => `- \`${f.path}\` \u2014 ${f.purpose || "\u521D\u59CB\u6587\u4EF6"}`).join("\n")}

## \u5F71\u54CD

- \u65B0\u589E\u4EE3\u7801\u5E94\u653E\u5165\u5BF9\u5E94\u76EE\u5F55\uFF0C\u907F\u514D\u5728\u6839\u76EE\u5F55\u5806\u6587\u4EF6\uFF1B
- \u516C\u5171\u80FD\u529B\u653E\u516C\u5171\u76EE\u5F55\uFF0C\u4E1A\u52A1\u653E\u6A21\u5757\u76EE\u5F55\u3002
`;
}
function archDiagramsMd(plan) {
  const mods = (plan.dirs ?? []).filter((d) => !d.includes("/")).slice(0, 6);
  const edges = mods.map((m, i) => `  App --> M${i}[${m}/]`).join("\n");
  return `# \u6A21\u5757\u4E0E\u5206\u5C42

\`\`\`mermaid
flowchart LR
  Entry[\u5165\u53E3] --> App[\u5E94\u7528\u5C42]
${edges}
${mods.length ? "  M0 --> Shared[\u516C\u5171/\u7EC4\u4EF6]" : "  App --> Shared[\u516C\u5171/\u7EC4\u4EF6]"}
\`\`\`

## \u9876\u5C42\u76EE\u5F55

${(plan.dirs ?? []).map((d) => `- \`${d}/\``).join("\n") || "- \uFF08\u65E0\uFF09"}
`;
}
function archModel(plan, relDir, status, extra = {}) {
  return {
    version: 1,
    name: plan.name,
    kind: plan.kind,
    kindLabel: plan.kindLabel,
    framework: plan.framework,
    frameworkLabel: plan.frameworkLabel,
    stack: plan.stack ?? [],
    options: plan.options ?? {},
    status,
    summary: plan.summary ?? "",
    commands: plan.commands ?? {},
    dirs: plan.dirs ?? [],
    planFile: `${relDir}/plan.json`,
    docs: plan.docs ?? [],
    ...extra,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var ARCH_DEPLOY_META = {
  "vue-vite": { packagePath: "dist", port: 80, healthPath: "/", docker: "nginx" },
  "react-vite": { packagePath: "dist", port: 80, healthPath: "/", docker: "nginx" },
  "next-app": { packagePath: ".next", port: 3e3, healthPath: "/", docker: "node-next" },
  nuxt: { packagePath: ".output", port: 3e3, healthPath: "/", docker: "node-nuxt" },
  "svelte-kit": { packagePath: "build", port: 3e3, healthPath: "/", docker: "node-svelte" },
  static: { packagePath: ".", port: 80, healthPath: "/", docker: "static" },
  taro: { packagePath: "dist", port: 0, healthPath: "" },
  "uni-app": { packagePath: "dist", port: 0, healthPath: "" },
  "native-wechat": { packagePath: "", port: 0, healthPath: "" },
  flutter: { packagePath: "build", port: 0, healthPath: "" },
  swiftui: { packagePath: "", port: 0, healthPath: "" },
  expo: { packagePath: "dist", port: 0, healthPath: "" },
  nest: { packagePath: "dist", port: 3e3, healthPath: "/healthz", docker: "node-ts" },
  "go-gin": { packagePath: "bin", port: 8080, healthPath: "/healthz", docker: "go" },
  express: { packagePath: "dist", port: 3e3, healthPath: "/healthz", docker: "node-ts" },
  fastapi: { packagePath: ".", port: 8e3, healthPath: "/healthz", docker: "python" },
  "spring-boot": { packagePath: "target", port: 8080, healthPath: "/healthz", docker: "java" },
  "pnpm-workspace": { packagePath: "apps/web/dist", port: 80, healthPath: "/", docker: "nginx-workspace" },
  turbo: { packagePath: "apps/web/dist", port: 80, healthPath: "/", docker: "nginx-workspace" }
};
function archDeployFiles(plan) {
  const meta = ARCH_DEPLOY_META[plan.framework];
  if (!meta?.docker) return [];
  const port = meta.port || 80;
  const dockerfile = (() => {
    switch (meta.docker) {
      case "nginx":
        return `FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/${meta.packagePath} /usr/share/nginx/html
EXPOSE 80
`;
      case "nginx-workspace":
        return `FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./ 
COPY . .
RUN pnpm install
RUN pnpm -r build

FROM nginx:alpine
COPY --from=build /app/${meta.packagePath} /usr/share/nginx/html
EXPOSE 80
`;
      case "static":
        return `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;
      case "node-next":
        return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE ${port}
CMD ["npm", "run", "start"]
`;
      case "node-nuxt":
        return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE ${port}
CMD ["node", ".output/server/index.mjs"]
`;
      case "node-svelte":
        return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE ${port}
CMD ["node", "build"]
`;
      case "node-ts":
        return `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE ${port}
CMD ["node", "dist/main.js"]
`;
      case "go":
        return `FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/server /app/server
EXPOSE ${port}
CMD ["/app/server"]
`;
      case "python":
        return `FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE ${port}
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"]
`;
      case "java":
        return `FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml ./
RUN mvn -q dependency:go-offline
COPY . .
RUN mvn -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar /app/app.jar
EXPOSE ${port}
CMD ["java", "-jar", "/app/app.jar"]
`;
      default:
        return "";
    }
  })();
  if (!dockerfile) return [];
  const compose = `services:
  app:
    build: .
    ports:
      - "${port}:${port}"
    restart: unless-stopped
`;
  const ignore = `node_modules
dist
build
.next
.output
.git
.wudi
`;
  return [
    ["Dockerfile", "\u5BB9\u5668\u955C\u50CF\uFF08\u90E8\u7F72\u7528\uFF09", dockerfile],
    ["docker-compose.yml", "\u672C\u5730/\u670D\u52A1\u5668\u7F16\u6392\uFF08\u90E8\u7F72\u7528\uFF09", compose],
    [".dockerignore", "\u955C\u50CF\u6784\u5EFA\u6392\u9664\u9879", ignore]
  ];
}
function archSyncDeployAndDocs(root, plan, status = "planned") {
  const base = projectBaseName(root);
  const relData = `.wudi/${base}`;
  const meta = ARCH_DEPLOY_META[plan.framework] ?? {};
  let profile = null;
  try {
    const current = loadProjectAt(root) ?? {};
    const patch = {};
    if (!current.build) patch.build = plan.commands?.build ?? "";
    if (!current.techStack) patch.techStack = (plan.stack ?? []).join(" + ");
    if (!current.package?.path) patch.package = { type: "dir", path: meta.packagePath || "dist" };
    if (!current.deployRoot) patch.deployRoot = `/srv/${archSlug(plan.name)}`;
    if (meta.port && !current.healthCheck?.url) {
      patch.healthCheck = { url: `http://127.0.0.1:${meta.port}${meta.healthPath || "/"}`, expect: 200, checkFrom: "remote" };
    }
    profile = saveProjectAt(root, patch).project;
  } catch {
  }
  try {
    const deployDir = join3(projectDataDirFor(root), "deploys");
    mkdirSync2(deployDir, { recursive: true });
    if (!existsSync3(join3(deployDir, "history.json"))) writeFileSync2(join3(deployDir, "history.json"), "[]\n");
    if (profile) writeDeployConfig(root, profile);
  } catch {
  }
  const docsDir = join3(projectDataDirFor(root), "docs");
  mkdirSync2(docsDir, { recursive: true });
  const build = plan.commands?.build ?? "-";
  const install = plan.commands?.install ?? "-";
  const dev = plan.commands?.dev ?? "-";
  const moduleLines = (plan.dirs ?? []).map((d) => `- \`${d}/\``).join("\n") || "- \uFF08\u65E0\u989D\u5916\u76EE\u5F55\uFF09";
  const stackLine = (plan.stack ?? []).join(" \xB7 ");
  const dockerLine = meta.docker ? "\u672C\u9879\u76EE\u5DF2\u751F\u6210 `Dockerfile` \u4E0E `docker-compose.yml`\uFF1A`docker compose up -d --build` \u5373\u53EF\u672C\u5730/\u670D\u52A1\u5668\u8FD0\u884C\u3002" : "\u672C\u9879\u76EE\u4E3A\u79FB\u52A8\u7AEF/\u5C0F\u7A0B\u5E8F\u9884\u8BBE\uFF0C\u4E0D\u4F7F\u7528 Docker\uFF1B\u53D1\u5E03\u8BF7\u6309\u5BF9\u5E94\u5E73\u53F0\u6D41\u7A0B\uFF08\u5E94\u7528\u5546\u5E97 / \u5FAE\u4FE1\u5F00\u53D1\u8005\u5DE5\u5177\u4E0A\u4F20\uFF09\u3002";
  const docs = {
    "architecture.md": `# ${plan.name} \xB7 \u67B6\u6784

> \u72B6\u6001\uFF1A${status === "scaffolded" ? "\u9AA8\u67B6\u5DF2\u5199\u5165" : "\u5DF2\u89C4\u5212"}
> \u6280\u672F\u6808\uFF1A${stackLine}

\u5B8C\u6574\u67B6\u6784\u6587\u6863\u89C1 [../architecture/ARCHITECTURE.md](../architecture/ARCHITECTURE.md)\u3002

## \u9876\u5C42\u76EE\u5F55

${moduleLines}
`,
    "development.md": `# ${plan.name} \xB7 \u672C\u5730\u5F00\u53D1

\`\`\`bash
${install}
${dev}
\`\`\`

## \u547D\u4EE4

| \u7528\u9014 | \u547D\u4EE4 |
| --- | --- |
| \u5B89\u88C5 | \`${install}\` |
| \u5F00\u53D1 | \`${dev}\` |
| \u6784\u5EFA | \`${build}\` |

## \u7EA6\u5B9A

- \u65B0\u6A21\u5757\u6309\u67B6\u6784\u6587\u6863\u7684\u5206\u5C42\u653E\u7F6E\uFF1B
- \u63D0\u4EA4\u524D\u5148\u672C\u5730\u6784\u5EFA\u901A\u8FC7\uFF1B
- \u67B6\u6784\u53D8\u66F4\u540C\u6B65\u66F4\u65B0 ${relData}/architecture/ \u5E76\u8FFD\u52A0 ADR\u3002
`,
    "deploy.md": `# ${plan.name} \xB7 \u90E8\u7F72\u624B\u518C

> \u6280\u672F\u6808\uFF1A${stackLine}
> \u90E8\u7F72\u6839\uFF08\u6863\u6848\u9884\u586B\uFF09\uFF1A${profile?.deployRoot || `/srv/${archSlug(plan.name)}`}

## \u6D41\u6C34\u7EBF

1. \u6784\u5EFA\uFF1A\`${build}\`
2. \u6253\u5305\uFF1A\`${meta.packagePath || "dist"}\`\uFF08\u76EE\u5F55\u4EA7\u7269\uFF09
3. \u4E0A\u4F20\uFF1ASSH \u4F20\u5230\u90E8\u7F72\u6839 releases/
4. \u5207\u6362\uFF1A\u8F6F\u94FE current \u2192 \u6700\u65B0 release
5. \u9A8C\u8BC1\uFF1A\u5065\u5EB7\u68C0\u67E5 ${profile?.healthCheck?.url ? `\`${profile.healthCheck.url}\`` : "\uFF08\u5F85\u914D\u7F6E\uFF09"}

${dockerLine}

## \u56DE\u6EDA

\u5728\u300C\u90E8\u7F72\u300D\u9875\u9009\u62E9\u5386\u53F2 release \u6267\u884C\u56DE\u6EDA\uFF1B\u5FC5\u8981\u65F6\u624B\u52A8\u628A current \u8F6F\u94FE\u6307\u56DE\u4E0A\u4E00\u7248\u3002

## \u73AF\u5883

\u5728\u300C\u603B\u89C8\u300D\u9875\u6216 \`wudi_env_set\` \u914D\u7F6E staging / prod \u7684\u90E8\u7F72\u6839\u4E0E\u5065\u5EB7\u68C0\u67E5\u3002
`,
    ...plan.kind === "backend" ? { "api.md": `# ${plan.name} \xB7 API

> \u6846\u67B6\uFF1A${plan.frameworkLabel}

## \u5DF2\u5B9E\u73B0

| \u65B9\u6CD5 | \u8DEF\u5F84 | \u8BF4\u660E |
| --- | --- | --- |
| GET | /healthz | \u5065\u5EB7\u68C0\u67E5\uFF0C\u8FD4\u56DE\u670D\u52A1\u540D\u4E0E ok \u72B6\u6001 |

${plan.framework === "fastapi" ? "\u542F\u52A8\u540E\u8BBF\u95EE `/docs` \u67E5\u770B\u81EA\u52A8\u751F\u6210\u7684 OpenAPI \u6587\u6863\u3002\n" : "\u65B0\u589E\u63A5\u53E3\u540E\u5728\u6B64\u767B\u8BB0\uFF0C\u5E76\u8865\u8BF7\u6C42/\u54CD\u5E94\u793A\u4F8B\u3002\n"}` } : {}
  };
  const registered = [];
  for (const [name, content] of Object.entries(docs)) {
    try {
      writeFileSync2(join3(docsDir, name), content);
      const rel = `${relData}/docs/${name}`;
      const type = name === "deploy.md" ? "runbook" : name === "architecture.md" ? "architecture" : "doc";
      try {
        registerDocAt(root, { path: rel, type, title: `${plan.name} \xB7 ${name.replace(/\.md$/, "")}`, source: "wudi_arch_plan" });
      } catch {
      }
      registered.push(rel);
    } catch {
    }
  }
  return { docs: registered, profile };
}
function toolArchPlan(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const kind = String(args.kind ?? "web").trim();
  const preset = ARCH_PRESETS[kind];
  if (!preset) return fail(`\u4E0D\u652F\u6301\u7684 kind\uFF1A${kind}\uFF08\u53EF\u9009\uFF1A${Object.keys(ARCH_PRESETS).join("\u3001")}\uFF09`);
  const fwId = String(args.framework ?? "").trim() || Object.keys(preset.frameworks)[0];
  const fwPreset = preset.frameworks[fwId];
  if (!fwPreset) return fail(`\u4E0D\u652F\u6301\u7684 framework\uFF1A${fwId}\uFF08${preset.label} \u53EF\u9009\uFF1A${Object.keys(preset.frameworks).join("\u3001")}\uFF09`);
  let options;
  try {
    options = resolveArchOptions(fwPreset, args.options ?? {});
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const name = String(args.name ?? "").trim() || loadProjectAt(root)?.name || projectBaseName(root);
  const baseFiles = fwPreset.files(name, options);
  const deployFiles = archDeployFiles({ kind, framework: fwId, kindLabel: preset.label, frameworkLabel: fwPreset.label, name, commands: fwPreset.commands });
  const files = [...baseFiles, ...deployFiles].map(([path2, purpose, content]) => ({ path: path2, purpose, content }));
  const plan = {
    kind,
    kindLabel: preset.label,
    framework: fwId,
    frameworkLabel: fwPreset.label,
    name,
    summary: fwPreset.summary,
    options,
    stack: archStackLabels(fwPreset, options),
    dirs: fwPreset.dirs ?? [],
    files,
    commands: fwPreset.commands,
    notes: fwPreset.notes ?? [],
    status: "planned",
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const relDir = `.wudi/${projectBaseName(root)}/architecture`;
  const archDir = architectureDirFor(root);
  plan.savedPath = `${relDir}/plan.json`;
  plan.architectureDir = relDir;
  plan.docs = ["plan.json", "architecture.json", "ARCHITECTURE.md", "diagrams.md", "decisions/0001-tech-stack.md", "decisions/0002-directory-layout.md"].map((f) => `${relDir}/${f}`);
  try {
    migrateArchPlanFor(root);
    mkdirSync2(join3(archDir, "decisions"), { recursive: true });
    writeFileSync2(join3(archDir, "plan.json"), JSON.stringify(plan, null, 2));
    writeFileSync2(join3(archDir, "architecture.json"), JSON.stringify(archModel(plan, relDir, "planned"), null, 2));
    writeFileSync2(join3(archDir, "ARCHITECTURE.md"), archDocMd(plan));
    writeFileSync2(join3(archDir, "diagrams.md"), archDiagramsMd(plan));
    writeFileSync2(join3(archDir, "decisions", "0001-tech-stack.md"), archAdrStackMd(plan));
    writeFileSync2(join3(archDir, "decisions", "0002-directory-layout.md"), archAdrLayoutMd(plan));
  } catch (err) {
    return fail(`\u67B6\u6784\u65B9\u6848\u5DF2\u751F\u6210\u4F46\u4FDD\u5B58\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
  }
  let sync = { docs: [], profile: null };
  try {
    sync = archSyncDeployAndDocs(root, plan, "planned");
  } catch {
  }
  plan.projectDocs = sync.docs;
  plan.deploy = sync.profile ? {
    build: sync.profile.build ?? "",
    packagePath: sync.profile.package?.path ?? "",
    deployRoot: sync.profile.deployRoot ?? "",
    healthCheck: sync.profile.healthCheck?.url ?? ""
  } : null;
  const text = [
    `\u2550\u2550\u2550 \u67B6\u6784\u65B9\u6848\uFF1A${preset.label} \xB7 ${plan.stack.join(" \xB7 ")}\uFF08${name}\uFF09\u2550\u2550\u2550`,
    fwPreset.summary,
    `\u6280\u672F\u6808\u7EC4\u5408\uFF1A${plan.stack.join(" \xB7 ")}`,
    `\u76EE\u5F55\u4E0E\u6587\u4EF6\uFF08${plan.files.length} \u4E2A\u6587\u4EF6\uFF09\uFF1A`,
    archTreeText(plan.dirs, plan.files.map((f) => f.path)),
    `\u547D\u4EE4\uFF1A\u5B89\u88C5 ${plan.commands.install}\uFF5C\u5F00\u53D1 ${plan.commands.dev}\uFF5C\u6784\u5EFA ${plan.commands.build}`,
    plan.notes.length ? `\u6CE8\u610F\uFF1A
- ${plan.notes.join("\n- ")}` : "",
    `\u67B6\u6784\u76EE\u5F55\uFF1A${relDir}/\uFF08ARCHITECTURE.md\u3001architecture.json\u3001plan.json\u3001decisions/\u3001diagrams.md\uFF09`,
    sync.profile ? `\u90E8\u7F72\u6863\u6848\u5DF2\u9884\u586B\uFF1A\u6784\u5EFA ${sync.profile.build || "-"}\uFF5C\u4EA7\u7269 ${sync.profile.package?.path || "-"}\uFF5C\u90E8\u7F72\u6839 ${sync.profile.deployRoot || "-"}\uFF5C\u5065\u5EB7\u68C0\u67E5 ${sync.profile.healthCheck?.url || "-"}` : "",
    sync.docs.length ? `\u9879\u76EE\u6587\u6863\u5DF2\u751F\u6210\u5E76\u767B\u8BB0\uFF1A
- ${sync.docs.join("\n- ")}` : "",
    deployFiles.length ? `\u90E8\u7F72\u6587\u4EF6\uFF1A${deployFiles.map(([f]) => f).join("\u3001")}` : "",
    "\u4E0B\u4E00\u6B65\uFF1A\u70B9\u300C\u5199\u5165\u9AA8\u67B6\u300D\u521B\u5EFA\u76EE\u5F55\u4E0E\u521D\u59CB\u6587\u4EF6\uFF0C\u6216\u8BA9 Agent \u6309\u65B9\u6848\u642D\u5EFA\u5E76\u5B9E\u73B0\u5404\u6A21\u5757\u3002"
  ].filter(Boolean).join("\n");
  return ok(text, plan);
}
function toolArchScaffold(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (args.confirm !== true) {
    return fail("\u5199\u5165\u9879\u76EE\u9AA8\u67B6\u9700\u8981\u786E\u8BA4\uFF1A\u8BF7\u4F20 confirm: true\uFF08\u53EA\u521B\u5EFA\u7F3A\u5931\u7684\u76EE\u5F55\u4E0E\u6587\u4EF6\uFF0C\u4E0D\u8986\u76D6\u5DF2\u6709\u6587\u4EF6\uFF09\u3002");
  }
  let plan = args.plan;
  if (!plan || typeof plan !== "object") {
    try {
      plan = JSON.parse(readFileSync2(migrateArchPlanFor(root), "utf-8"));
    } catch {
      return fail(`\u6CA1\u6709\u67B6\u6784\u65B9\u6848\uFF1A\u5148\u8C03\u7528 wudi_arch_plan \u751F\u6210\u65B9\u6848\uFF08\u4F1A\u4FDD\u5B58\u5230 .wudi/${projectBaseName(root)}/architecture/plan.json\uFF09\uFF0C\u6216\u5728 plan \u53C2\u6570\u91CC\u4F20\u65B9\u6848\u5BF9\u8C61\u3002`);
    }
  }
  const files = Array.isArray(plan.files) ? plan.files : [];
  if (!files.length) return fail("\u67B6\u6784\u65B9\u6848\u7F3A\u5C11 files \u6E05\u5355\uFF0C\u65E0\u6CD5\u5199\u5165\u9AA8\u67B6\u3002");
  if (files.length > 120) return fail(`\u65B9\u6848\u5305\u542B ${files.length} \u4E2A\u6587\u4EF6\uFF0C\u8D85\u8FC7\u4E0A\u9650 120\uFF0C\u62D2\u7EDD\u5199\u5165\u3002`);
  const rootAbs = resolve3(root);
  const created = [];
  const skipped = [];
  const failed = [];
  for (const f of files) {
    const rel = String(f?.path ?? "").replace(/^\/+/, "").trim();
    if (!rel || rel.includes("..") || rel.includes("\\") || rel.startsWith(".wudi/") || /^[A-Za-z]:/.test(rel)) {
      failed.push(rel || "(\u7A7A\u8DEF\u5F84)");
      continue;
    }
    const abs = resolve3(rootAbs, rel);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + "/")) {
      failed.push(rel);
      continue;
    }
    try {
      mkdirSync2(_dirname(abs), { recursive: true });
      if (existsSync3(abs)) {
        skipped.push(rel);
        continue;
      }
      writeFileSync2(abs, String(f?.content ?? ""));
      created.push(rel);
    } catch {
      failed.push(rel);
    }
  }
  const relDir = `.wudi/${projectBaseName(root)}/architecture`;
  const archDir = architectureDirFor(root);
  let detected = { languages: [], modules: [] };
  try {
    const scan = archScan(root);
    const total = [...scan.languages.values()].reduce((a, b) => a + b, 0) || 1;
    detected.languages = [...scan.languages.entries()].map(([n, c]) => ({ name: n, files: c, pct: Math.round(c / total * 100) })).sort((a, b) => b.files - a.files).slice(0, 8);
    detected.modules = scan.modules.map((m) => ({ name: m.name, files: m.files })).sort((a, b) => b.files - a.files).slice(0, 12);
  } catch {
  }
  try {
    mkdirSync2(join3(archDir, "decisions"), { recursive: true });
    plan.status = "scaffolded";
    plan.stack = plan.stack ?? [];
    writeFileSync2(join3(archDir, "architecture.json"), JSON.stringify(archModel(plan, relDir, "scaffolded", detected), null, 2));
    if (Array.isArray(plan.files) && plan.files.length) writeFileSync2(join3(archDir, "plan.json"), JSON.stringify(plan, null, 2));
    writeFileSync2(join3(archDir, "ARCHITECTURE.md"), archDocMd(plan));
  } catch {
  }
  let sync = { docs: [], profile: null };
  try {
    sync = archSyncDeployAndDocs(root, plan, "scaffolded");
  } catch {
  }
  const summary = {
    root,
    name: plan.name ?? "",
    framework: plan.framework ?? "",
    frameworkLabel: plan.frameworkLabel ?? "",
    planPath: `${relDir}/plan.json`,
    architectureDir: relDir,
    docs: plan.docs ?? [],
    projectDocs: sync.docs,
    created,
    skipped,
    failed,
    commands: plan.commands ?? {}
  };
  const lines = [
    `\u2550\u2550\u2550 \u9AA8\u67B6\u5DF2\u5199\u5165\uFF1A${plan.frameworkLabel ?? plan.framework ?? "?"}\uFF08${plan.name ?? ""}\uFF09\u2550\u2550\u2550`,
    `\u6280\u672F\u6808\uFF1A${(plan.stack ?? []).join(" \xB7 ") || "\uFF08\u672A\u8BB0\u5F55\uFF09"}`,
    `\u65B0\u5EFA ${created.length} \u4E2A\u6587\u4EF6${skipped.length ? `\uFF0C\u8DF3\u8FC7\u5DF2\u5B58\u5728 ${skipped.length} \u4E2A` : ""}${failed.length ? `\uFF0C\u5931\u8D25 ${failed.length} \u4E2A` : ""}`,
    created.length ? `\u65B0\u5EFA\uFF1A
- ${created.slice(0, 40).join("\n- ")}${created.length > 40 ? `
- \u2026\uFF08\u5171 ${created.length} \u4E2A\uFF09` : ""}` : "",
    skipped.length ? `\u8DF3\u8FC7\uFF08\u5DF2\u5B58\u5728\uFF0C\u672A\u8986\u76D6\uFF09\uFF1A
- ${skipped.slice(0, 20).join("\n- ")}${skipped.length > 20 ? "\n- \u2026" : ""}` : "",
    failed.length ? `\u5931\u8D25\uFF1A
- ${failed.join("\n- ")}` : "",
    `\u67B6\u6784\u76EE\u5F55\uFF1A${relDir}/\uFF08\u67B6\u6784\u6A21\u578B\u4E0E\u6587\u6863\u5DF2\u66F4\u65B0\u4E3A scaffolded\uFF09`,
    sync.profile ? `\u90E8\u7F72\u6863\u6848\uFF1A\u6784\u5EFA ${sync.profile.build || "-"}\uFF5C\u4EA7\u7269 ${sync.profile.package?.path || "-"}\uFF5C\u90E8\u7F72\u6839 ${sync.profile.deployRoot || "-"}\uFF5C\u5065\u5EB7\u68C0\u67E5 ${sync.profile.healthCheck?.url || "-"}` : "",
    sync.docs.length ? `\u9879\u76EE\u6587\u6863\uFF1A
- ${sync.docs.join("\n- ")}` : "",
    plan.commands?.install ? `\u4E0B\u4E00\u6B65\uFF1A
1. ${plan.commands.install}
2. ${plan.commands.dev}` : "\u4E0B\u4E00\u6B65\uFF1A\u5B89\u88C5\u4F9D\u8D56\u5E76\u542F\u52A8\u9879\u76EE\u3002",
    "Agent \u53EF\u7EE7\u7EED\u6309\u65B9\u6848\u5B9E\u73B0\u9875\u9762/\u6A21\u5757\uFF0C\u5E76\u7528 wudi_architecture \u590D\u67E5\u7ED3\u6784\u3002"
  ].filter(Boolean).join("\n");
  return ok(lines, summary);
}
var PAGE_FORMATS = /* @__PURE__ */ new Set(["jsx", "vue", "html"]);
function relFromWorkspace(absPath) {
  return relative(projectRoot(), absPath).split(sep).join("/");
}
async function toolPageFromDesign(args = {}) {
  let root;
  let figFile;
  let figBase;
  try {
    root = toolRoot(args);
    const r = resolveDesignFile(String(args?.path ?? ""), root);
    figFile = r.file;
    figBase = r.base.replace(/\.(fig|pen)$/i, "");
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!existsSync3(figFile)) return fail(`\u8BBE\u8BA1\u7A3F\u4E0D\u5B58\u5728\uFF1A${args?.path}`);
  const format = String(args?.format ?? "jsx").trim().toLowerCase();
  if (!PAGE_FORMATS.has(format)) return fail(`\u4E0D\u652F\u6301\u7684 format\uFF1A${format}\uFF08\u53EF\u9009 jsx / vue / html\uFF09`);
  const outRel = (String(args?.output ?? "").trim().replace(/^\/+/, "") || `generated/${figBase}.${format}`).replace(/\\/g, "/");
  if (outRel.includes("..") || /^[A-Za-z]:/.test(outRel)) return fail(`\u975E\u6CD5\u8F93\u51FA\u8DEF\u5F84\uFF1A${outRel}`);
  const outAbs = resolve3(root, outRel);
  if (!outAbs.startsWith(resolve3(root) + "/")) return fail(`\u8F93\u51FA\u8DEF\u5F84\u5FC5\u987B\u5728\u9879\u76EE\u6839\u5185\uFF1A${outRel}`);
  const ext = outRel.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== format) return fail(`\u8F93\u51FA\u6587\u4EF6\u6269\u5C55\u540D\u5FC5\u987B\u662F .${format}\uFF1A${outRel}`);
  if (existsSync3(outAbs) && args?.overwrite !== true) {
    return fail(`\u8F93\u51FA\u6587\u4EF6\u5DF2\u5B58\u5728\uFF1A${outRel}\uFF08\u4F20 overwrite: true \u8986\u76D6\uFF09`);
  }
  const figRel = relFromWorkspace(figFile);
  try {
    await openpencilCall(void 0, "open_design", { path: figRel });
  } catch {
  }
  if (format === "jsx") {
    const relOut = relFromWorkspace(outAbs);
    try {
      const res = await openpencilCall(void 0, "export_design", {
        format: "jsx",
        path: relOut,
        overwrite: args?.overwrite === true
      });
      const sc = res?.structuredContent ?? {};
      const written = sc.path ?? sc.file ?? relOut;
      const bytes = existsSync3(outAbs) ? statSync(outAbs).size : 0;
      return ok(
        `\u5DF2\u7531 ${figRel} \u751F\u6210 React \u9875\u9762\uFF08JSX + Tailwind\uFF09
- \u8F93\u51FA\uFF1A${written}${bytes ? `\uFF08${(bytes / 1024).toFixed(1)} KB\uFF09` : ""}
- \u4E0B\u4E00\u6B65\uFF1A\u628A\u7EC4\u4EF6\u6302\u5230\u8DEF\u7531/\u9875\u9762\uFF0C\u8FD0\u884C\u9879\u76EE\u5373\u53EF\u770B\u5230\uFF1B\u9700\u8981\u62C6\u5206\u7EC4\u4EF6\u6216\u8865\u4EA4\u4E92\u65F6\u8BA9 Agent \u7EE7\u7EED\u3002`,
        { path: written, format, source: figRel, bytes }
      );
    } catch (err) {
      return fail(`\u751F\u6210 JSX \u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 500)}\uFF08\u8BF7\u5148\u5728\u300C\u8BBE\u8BA1\u300D\u9875\u6253\u5F00\u8BE5\u753B\u5E03\u7F16\u8F91\u5668\u518D\u91CD\u8BD5\uFF09`);
    }
  }
  let svg = "";
  try {
    const res = await openpencilCall(void 0, "export_svg", {});
    svg = String(res?.structuredContent?.svg ?? "");
    if (!svg) {
      try {
        const parsed = JSON.parse(res?.content?.[0]?.text ?? "{}");
        svg = String(parsed?.svg ?? "");
      } catch {
      }
    }
    if (!svg) throw new Error("export_svg \u672A\u8FD4\u56DE\u5185\u5BB9\uFF08\u753B\u5E03\u53EF\u80FD\u4E3A\u7A7A\uFF0C\u6216\u7F16\u8F91\u5668\u672A\u8FDE\u63A5\uFF09");
  } catch (err) {
    return fail(`\u5BFC\u51FA\u753B\u5E03\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 500)}\uFF08\u8BF7\u5148\u5728\u300C\u8BBE\u8BA1\u300D\u9875\u6253\u5F00\u8BE5\u753B\u5E03\u7F16\u8F91\u5668\u518D\u91CD\u8BD5\uFF09`);
  }
  svg = svg.replace(/<\?xml[^>]*\?>\s*/i, "");
  const header = `<!-- \u7531 ${figRel} \u751F\u6210 \xB7 ${(/* @__PURE__ */ new Date()).toISOString()} -->`;
  let content;
  if (format === "html") {
    content = `${header}
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${figBase}</title>
<style>html,body{margin:0;padding:0;background:#fff}body{display:flex;justify-content:center}.op-page{width:100%;max-width:1440px;padding:24px;box-sizing:border-box}.op-page svg{width:100%;height:auto;display:block}</style>
</head>
<body>
<div class="op-page">
${svg}
</div>
</body>
</html>
`;
  } else {
    const jsSvg = svg.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    content = `${header}
<script setup lang="ts">
const svg = \`${jsSvg}\`;
</script>

<template>
  <div class="op-page" v-html="svg" />
</template>

<style scoped>
.op-page { width: 100%; max-width: 1440px; margin: 0 auto; padding: 24px; box-sizing: border-box; }
.op-page :deep(svg) { width: 100%; height: auto; display: block; }
</style>
`;
  }
  try {
    mkdirSync2(_dirname(outAbs), { recursive: true });
    writeFileSync2(outAbs, content);
  } catch (err) {
    return fail(`\u5199\u5165\u9875\u9762\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
  }
  return ok(
    `\u5DF2\u7531 ${figRel} \u751F\u6210${format === "html" ? " HTML \u9875\u9762" : " Vue \u9875\u9762"}\uFF08\u6574\u9875 SVG\uFF0C\u89C6\u89C9 1:1\uFF09
- \u8F93\u51FA\uFF1A${outRel}\uFF08${(Buffer.byteLength(content) / 1024).toFixed(1)} KB\uFF09
- \u63D0\u793A\uFF1A\u9700\u8981\u8BED\u4E49\u5316\u7EC4\u4EF6/\u53EF\u4EA4\u4E92\u4EE3\u7801\u65F6\uFF0C\u7528 format=jsx \u751F\u6210 JSX \u540E\u518D\u62C6\u5206\u7EC4\u4EF6\u3002`,
    { path: outRel, format, source: figRel, bytes: Buffer.byteLength(content) }
  );
}
var DEV_PROCS = /* @__PURE__ */ new Map();
var DEV_SEQ = 0;
var DEV_MAX_LOG = 300;
function devPm(root) {
  const has = (f) => existsSync3(join3(root, f));
  if (has("pnpm-lock.yaml") || has("pnpm-workspace.yaml")) return "pnpm";
  if (has("yarn.lock")) return "yarn";
  if (has("bun.lockb") || has("bun.lock")) return "bun";
  return "npm";
}
function devNodeScripts(root) {
  try {
    const pkg = JSON.parse(readFileSync2(join3(root, "package.json"), "utf-8"));
    return pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  } catch {
    return {};
  }
}
function devActionLabel(script) {
  const map = {
    dev: "\u5F00\u53D1\u670D\u52A1\u5668",
    start: "\u542F\u52A8\u670D\u52A1",
    serve: "\u542F\u52A8\u670D\u52A1",
    preview: "\u9884\u89C8\u6784\u5EFA\u4EA7\u7269",
    build: "\u6784\u5EFA",
    test: "\u6D4B\u8BD5",
    lint: "\u4EE3\u7801\u68C0\u67E5",
    "start:dev": "\u5F00\u53D1\u670D\u52A1\u5668"
  };
  return map[script] ?? `\u8FD0\u884C ${script}`;
}
function devRunCommand(pm, script) {
  if (pm === "yarn") return `yarn ${script}`;
  if (pm === "pnpm") return `pnpm ${script}`;
  if (pm === "bun") return `bun run ${script}`;
  return `npm run ${script}`;
}
function devInstallCommand(pm) {
  if (pm === "yarn") return "yarn";
  if (pm === "pnpm") return "pnpm install";
  if (pm === "bun") return "bun install";
  return "npm install";
}
function devActionsFor(root) {
  const actions = [];
  const has = (f) => existsSync3(join3(root, f));
  const scripts = devNodeScripts(root);
  const pm = devPm(root);
  if (Object.keys(scripts).length) {
    if (!has("node_modules")) actions.push({ id: "install", label: "\u5B89\u88C5\u4F9D\u8D56", command: devInstallCommand(pm), kind: "task" });
    for (const script of Object.keys(scripts).slice(0, 20)) {
      const kind = /^(dev|start|serve|watch)|start:dev/i.test(script) ? "server" : "task";
      actions.push({ id: `script:${script}`, script, label: devActionLabel(script), command: devRunCommand(pm, script), kind });
    }
    return actions;
  }
  if (has("go.mod")) {
    actions.push({ id: "install", label: "\u6574\u7406\u4F9D\u8D56", command: "go mod tidy", kind: "task" });
    actions.push({ id: "run", label: "\u8FD0\u884C\u670D\u52A1", command: "go run ./cmd/server", kind: "server", port: 8080 });
    actions.push({ id: "test", label: "\u6D4B\u8BD5", command: "go test ./...", kind: "task" });
    actions.push({ id: "build", label: "\u6784\u5EFA", command: "go build -o bin/server ./cmd/server", kind: "task" });
    return actions;
  }
  if (has("pubspec.yaml")) {
    actions.push({ id: "install", label: "\u83B7\u53D6\u4F9D\u8D56", command: "flutter pub get", kind: "task" });
    actions.push({ id: "run", label: "\u8FD0\u884C App", command: "flutter run", kind: "server" });
    actions.push({ id: "test", label: "\u6D4B\u8BD5", command: "flutter test", kind: "task" });
    return actions;
  }
  if (has("requirements.txt") || has("pyproject.toml")) {
    if (has("requirements.txt")) actions.push({ id: "install", label: "\u5B89\u88C5\u4F9D\u8D56", command: "pip install -r requirements.txt", kind: "task" });
    if (has("app/main.py")) {
      actions.push({ id: "run", label: "\u8FD0\u884C\u670D\u52A1", command: "uvicorn app.main:app --reload", kind: "server", port: 8e3 });
      actions.push({ id: "test", label: "\u6D4B\u8BD5", command: "pytest -q", kind: "task" });
    }
    return actions;
  }
  if (has("Makefile")) {
    actions.push({ id: "run", label: "\u8FD0\u884C\uFF08make run\uFF09", command: "make run", kind: "server" });
    actions.push({ id: "build", label: "\u6784\u5EFA\uFF08make build\uFF09", command: "make build", kind: "task" });
  }
  return actions;
}
function devProcSummary(p, tailLines = 30) {
  return {
    id: p.id,
    name: p.name,
    command: p.command,
    status: p.status,
    pid: p.pid ?? 0,
    startedAt: p.startedAt,
    endedAt: p.endedAt ?? "",
    exitCode: p.exitCode ?? null,
    port: p.port ?? 0,
    url: p.url ?? "",
    kind: p.kind,
    tail: p.logs.slice(-tailLines)
  };
}
function devListFor(root) {
  const rr = resolve3(root);
  return [...DEV_PROCS.values()].filter((p) => p.root === rr).map((p) => devProcSummary(p));
}
function devAppend(p, chunk) {
  for (const rawLine of String(chunk).split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    p.logs.push(line.slice(0, 600));
    if (p.logs.length > DEV_MAX_LOG) p.logs.splice(0, p.logs.length - DEV_MAX_LOG);
    const urlMatch = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d+)/i);
    if (urlMatch) {
      p.port = Number(urlMatch[1]);
      p.url = urlMatch[0].replace("0.0.0.0", "localhost");
    }
  }
}
function devStart(root, action) {
  const key = `${resolve3(root)}::${action.id}`;
  const existing = DEV_PROCS.get(key);
  if (existing && (existing.status === "running" || existing.status === "starting")) return { proc: existing, reused: true };
  const id = `dev-${++DEV_SEQ}-${Date.now().toString(36)}`;
  const proc = {
    key,
    id,
    root: resolve3(root),
    name: action.id,
    command: action.command,
    kind: action.kind ?? "task",
    logs: [],
    status: "starting",
    pid: null,
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    exitCode: null,
    port: action.port ?? 0,
    url: ""
  };
  const child = spawn2(action.command, {
    cwd: proc.root,
    shell: true,
    detached: true,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  proc.pid = child.pid ?? null;
  proc.status = "running";
  child.stdout.on("data", (c) => devAppend(proc, c));
  child.stderr.on("data", (c) => devAppend(proc, c));
  child.on("exit", (code, signal) => {
    proc.status = "exited";
    proc.exitCode = code;
    proc.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (signal) proc.logs.push(`[wudi] \u8FDB\u7A0B\u7ED3\u675F\uFF1A${signal}`);
  });
  child.on("error", (err) => {
    proc.status = "failed";
    proc.exitCode = -1;
    proc.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    proc.logs.push(`[wudi] \u542F\u52A8\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
  });
  DEV_PROCS.set(key, proc);
  return { proc, reused: false };
}
function devStop(proc) {
  if (!proc || proc.status !== "running" && proc.status !== "starting") return false;
  try {
    if (proc.pid) process.kill(-proc.pid, "SIGTERM");
  } catch {
    try {
      if (proc.pid) process.kill(proc.pid, "SIGTERM");
    } catch {
    }
  }
  proc.logs.push("[wudi] \u5DF2\u53D1\u9001\u505C\u6B62\u4FE1\u53F7");
  const timer = setTimeout(() => {
    if (proc.status === "running" && proc.pid) {
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch {
      }
    }
  }, 3e3);
  timer.unref?.();
  return true;
}
process.on("exit", () => {
  for (const p of DEV_PROCS.values()) {
    if (p.pid && (p.status === "running" || p.status === "starting")) {
      try {
        process.kill(-p.pid, "SIGTERM");
      } catch {
      }
    }
  }
});
function toolDevActions(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const actions = devActionsFor(root);
  const processes = devListFor(root);
  const text = [
    `\u2550\u2550\u2550 \u5F00\u53D1\u52A8\u4F5C\uFF1A${projectBaseName(root)} \u2550\u2550\u2550`,
    actions.length ? actions.map((a) => `- ${a.label}\uFF1A\`${a.command}\`\uFF08${a.kind === "server" ? "\u5E38\u9A7B" : "\u4EFB\u52A1"}\uFF09`).join("\n") : "\uFF08\u672A\u53D1\u73B0\u53EF\u7528\u52A8\u4F5C\uFF1A\u9700\u8981 package.json / go.mod / pubspec.yaml / Makefile \u7B49\uFF09",
    processes.length ? `\u8FDB\u7A0B\uFF1A
${processes.map((p) => `- ${p.name} \xB7 ${p.status} \xB7 pid ${p.pid || "-"}${p.url ? ` \xB7 ${p.url}` : ""}`).join("\n")}` : "\uFF08\u65E0\u8FD0\u884C\u4E2D\u7684\u8FDB\u7A0B\uFF09"
  ].join("\n\n");
  return ok(text, { root, actions, processes });
}
function toolDevRun(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const name = String(args.name ?? "").trim();
  const rawCommand = String(args.command ?? "").trim();
  const actions = devActionsFor(root);
  let action = null;
  if (name) {
    action = actions.find((a) => a.id === name || a.script === name || a.label === name);
    if (!action) return fail(`\u672A\u77E5\u52A8\u4F5C\uFF1A${name}\uFF08\u53EF\u9009\uFF1A${actions.map((a) => a.id).join("\u3001") || "\u65E0"}\uFF09`);
  } else if (rawCommand) {
    const matched = actions.find((a) => a.command === rawCommand);
    if (matched) action = matched;
    else if (args.confirm === true) {
      action = { id: `custom:${rawCommand.slice(0, 40)}`, label: rawCommand, command: rawCommand, kind: args.kind === "server" ? "server" : "task", port: args.port };
    } else {
      return fail("\u81EA\u5B9A\u4E49\u547D\u4EE4\u9700\u8981\u786E\u8BA4\uFF1A\u4F20 confirm: true\uFF0C\u6216\u4F7F\u7528 wudi_dev_actions \u8FD4\u56DE\u7684\u52A8\u4F5C name\u3002");
    }
  } else {
    const fallback = actions.find((a) => a.kind === "server") ?? actions[0];
    if (!fallback) return fail("\u6CA1\u6709\u53EF\u8FD0\u884C\u7684\u5F00\u53D1\u52A8\u4F5C\uFF08\u672A\u53D1\u73B0 package.json / go.mod / pubspec.yaml / Makefile\uFF09\u3002");
    action = fallback;
  }
  if (String(action.command).length > 500) return fail("\u547D\u4EE4\u8FC7\u957F\u3002");
  const { proc, reused } = devStart(root, action);
  return ok(
    `${reused ? "\u5DF2\u5728\u8FD0\u884C" : "\u5DF2\u542F\u52A8"}\uFF1A${action.label}\uFF08${proc.status}\uFF09
- \u547D\u4EE4\uFF1A${proc.command}
- PID\uFF1A${proc.pid ?? "-"}
${proc.url ? `- \u5730\u5740\uFF1A${proc.url}
` : ""}\u7528 wudi_dev_logs \u67E5\u770B\u8F93\u51FA\uFF0Cwudi_dev_stop \u505C\u6B62\u3002`,
    { process: devProcSummary(proc) }
  );
}
function toolDevStop(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const id = String(args.id ?? args.name ?? "").trim();
  const rr = resolve3(root);
  const targets = [...DEV_PROCS.values()].filter((p) => p.root === rr && (args.all === true || !id || p.id === id || p.name === id));
  if (!targets.length) return fail("\u6CA1\u6709\u5339\u914D\u7684\u8FD0\u884C\u8FDB\u7A0B\u3002");
  const stopped = [];
  for (const p of targets) {
    if (devStop(p)) stopped.push(p.id);
  }
  return ok(`\u5DF2\u53D1\u9001\u505C\u6B62\u4FE1\u53F7\uFF1A${stopped.join("\u3001") || "\uFF08\u65E0\u8FD0\u884C\u4E2D\u8FDB\u7A0B\uFF09"}`, { stopped, processes: devListFor(root) });
}
function toolDevLogs(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const id = String(args.id ?? args.name ?? "").trim();
  const lines = Math.min(500, Math.max(1, Number(args.lines ?? 80)));
  const rr = resolve3(root);
  const proc = [...DEV_PROCS.values()].find((p) => p.root === rr && (id ? p.id === id || p.name === id : true)) ?? null;
  if (!proc) return fail(`\u6CA1\u6709\u627E\u5230\u8FDB\u7A0B${id ? `\uFF1A${id}` : ""}\uFF08\u5148\u7528 wudi_dev_actions \u67E5\u770B\uFF09\u3002`);
  return ok(
    `\u2550\u2550\u2550 ${proc.name} \xB7 ${proc.status}${proc.url ? ` \xB7 ${proc.url}` : ""} \u2550\u2550\u2550
${proc.logs.slice(-lines).join("\n") || "\uFF08\u6682\u65E0\u8F93\u51FA\uFF09"}`,
    { process: devProcSummary(proc, lines) }
  );
}
function toolProjectsList() {
  const root = projectRoot();
  try {
    ensureProfileAt(root);
    if (!isProjectRootHidden(root)) {
      const exists = loadRegistry().some((e) => resolve3(e.path) === resolve3(root));
      if (!exists) registryAdd(root, loadProject()?.name || "");
    }
  } catch {
  }
  const projects = registrySummaries(root);
  const lines = projects.map((p) => {
    const last = p.lastDeploy ? `${p.lastDeploy.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}@${p.lastDeploy.env ?? "default"} ${p.lastDeploy.release}\uFF08${p.lastDeploy.status}\uFF09` : "\u65E0\u90E8\u7F72";
    return `- ${p.isCurrent ? "\u2605\u5F53\u524D " : ""}${p.name}\uFF5C${p.path}
  \u6280\u672F\u6808 ${p.techStack || "?"}\uFF5C\u73AF\u5883 ${(p.envNames || ["\u2014"]).join("\u3001")}\uFF5C${last}\uFF5C\u6587\u6863 ${p.docsCount}\uFF5C\u753B\u5E03 ${p.designCount}`;
  }).join("\n");
  return ok(`\u2550\u2550\u2550 \u9879\u76EE\u6CE8\u518C\u8868\uFF08${projects.length}\uFF09\u2550\u2550\u2550
${lines || "\uFF08\u7A7A\uFF09"}`, { projects });
}
function toolRoot(args = {}) {
  const raw = String(args?.root ?? "").trim();
  if (!raw) return projectRoot();
  const abs = resolve3(raw);
  if (!withinProjectRoot(abs)) throw new Error(`\u9879\u76EE\u6839\u4E0D\u5728\u5F53\u524D\u9879\u76EE\u8303\u56F4\u5185\uFF1A${raw}`);
  if (!existsSync3(abs) || !statSync(abs).isDirectory()) throw new Error(`\u9879\u76EE\u6839\u4E0D\u5B58\u5728\uFF1A${raw}`);
  return abs;
}
function currentProjectRoot() {
  return resolve3(projectRoot());
}
function withinProjectRoot(p) {
  const root = currentProjectRoot();
  const abs = resolve3(String(p ?? ""));
  return abs === root || abs.startsWith(root + "/");
}
function toolFsListDirs(args = {}) {
  const root = currentProjectRoot();
  const target = args?.path ? resolve3(String(args.path)) : root;
  if (target !== root && !target.startsWith(root + "/")) {
    return fail(`\u53EA\u80FD\u6D4F\u89C8\u5F53\u524D\u9879\u76EE\uFF08${root}\uFF09\u53CA\u5176\u5B50\u6587\u4EF6\u5939\u5185\u7684\u8DEF\u5F84\u3002`);
  }
  if (!existsSync3(target) || !statSync(target).isDirectory()) return fail(`\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${target}`);
  let dirs = [];
  try {
    dirs = readdirSync2(target, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => ({ name: d.name, path: join3(target, d.name) })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    return fail(`\u8BFB\u53D6\u76EE\u5F55\u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
  }
  const parent = target !== root ? resolve3(target, "..") : "";
  return ok(
    `\u76EE\u5F55\uFF1A${target}
\u5B50\u6587\u4EF6\u5939\uFF08${dirs.length}\uFF09\uFF1A${dirs.map((d) => d.name).join("\u3001") || "\uFF08\u65E0\uFF09"}`,
    { root, path: target, parent, dirs }
  );
}
function toolProjectsRename(args = {}) {
  const id = String(args?.id ?? "").trim();
  const name = String(args?.name ?? "").trim();
  if (!id || !name) return fail("\u7F3A\u5C11\u53C2\u6570\uFF1Aid\uFF08\u9879\u76EE id\uFF09\u4E0E name\uFF08\u65B0\u663E\u793A\u540D\uFF09\u3002");
  let entry;
  try {
    entry = registryRename(id, name);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!entry) return fail(`\u6CE8\u518C\u8868\u4E2D\u627E\u4E0D\u5230 ${id}\uFF08\u7528 wudi_projects_list \u67E5 id\uFF09\u3002`);
  return ok(`\u5DF2\u91CD\u547D\u540D\u9879\u76EE\uFF1A${entry.name}\uFF08${entry.path}\uFF09`, { project: entry });
}
function toolProjectsAdd(args) {
  const path2 = String(args.path ?? "").trim();
  if (!path2) return fail("\u7F3A\u5C11 path\uFF1A\u8981\u767B\u8BB0\u7684\u9879\u76EE\u6839\u76EE\u5F55\u7EDD\u5BF9\u8DEF\u5F84\u3002");
  if (!existsSync3(path2)) return fail(`\u76EE\u5F55\u4E0D\u5B58\u5728\uFF1A${path2}`);
  if (!statSync(path2).isDirectory()) return fail(`\u4E0D\u662F\u76EE\u5F55\uFF1A${path2}`);
  if (!withinProjectRoot(path2)) {
    return fail(`\u53EA\u80FD\u767B\u8BB0\u5F53\u524D\u9879\u76EE\uFF08${currentProjectRoot()}\uFF09\u672C\u8EAB\u6216\u5176\u5B50\u6587\u4EF6\u5939\uFF1B${path2} \u4E0D\u5728\u8303\u56F4\u5185\u3002`);
  }
  let res;
  try {
    res = registryAdd(path2, args.name ? String(args.name) : "");
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  unhideProjectRoot(res.entry.path);
  try {
    migrateDesignsFor(res.entry.path);
  } catch {
  }
  try {
    ensureProfileAt(res.entry.path, res.entry.name);
  } catch (err) {
    return fail(`\u5DF2\u767B\u8BB0\u4F46\u521B\u5EFA .wudi \u5931\u8D25\uFF1A${String(err?.message ?? err)}`);
  }
  const s = registrySummaries(projectRoot()).find((x) => x.id === res.entry.id);
  return ok(
    `${res.added ? "\u5DF2\u767B\u8BB0\u9879\u76EE" : "\u9879\u76EE\u5DF2\u5728\u6CE8\u518C\u8868"}\uFF1A${res.entry.name}\uFF08${res.entry.path}\uFF09\uFF0C\u5DF2\u521D\u59CB\u5316 .wudi/project.json`,
    { project: s }
  );
}
function toolProjectsRemove(args) {
  const id = String(args.id ?? "").trim();
  const removed = registryRemove(id);
  if (!removed) return fail(`\u6CE8\u518C\u8868\u4E2D\u627E\u4E0D\u5230 ${id}\uFF08\u7528 wudi_projects_list \u67E5 id\uFF09\u3002`);
  if (resolve3(removed.path) === resolve3(projectRoot())) {
    hideProjectRoot(removed.path);
    return ok(
      `\u5DF2\u4ECE\u5DE5\u4F5C\u53F0\u79FB\u9664\u5F53\u524D\u9879\u76EE\uFF1A${removed.name}\uFF08${removed.path}\uFF09\u3002\u9879\u76EE\u6587\u4EF6\u4E0E .wudi \u672A\u5220\u9664\uFF1B\u91CD\u65B0\u300C\u767B\u8BB0\u9879\u76EE\u300D\u6307\u5411\u8BE5\u76EE\u5F55\u5373\u53EF\u6062\u590D\u3002`,
      { removed, hiddenCurrent: true }
    );
  }
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
  const absPath = join3(projectRoot(), relPath);
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
    mkdirSync3(join3(projectRoot(), "docs", "weekly"), { recursive: true });
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
    const outDir = join3(wudiDir(), "design", "figma");
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
      const abs = join3(outDir, fname);
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
      content = readFileSync2(join3(designDir(), "tokens.css"), "utf-8");
    } catch {
      content = "";
    }
    if (!content) return fail("tokens.css \u4E0D\u5B58\u5728\uFF08tokens \u53EF\u80FD\u662F\u65E7\u7248\u5199\u5165\uFF09\uFF0C\u91CD\u8DD1\u4E00\u6B21 wudi_design_tokens_set \u751F\u6210\u540E\u518D\u5BFC\u51FA\u3002");
    fname = "tokens.css";
  }
  const exportsDir = join3(designDir(), "exports");
  mkdirSync2(exportsDir, { recursive: true });
  const outPath = join3(exportsDir, fname);
  writeFileSync2(outPath, content, "utf-8");
  return ok(
    [`tokens \u5DF2\u5BFC\u51FA\uFF08${format}\uFF09\uFF1A`, `- ${outPath}`, "", "```", clip(content, 1200), "```", "\u8F6C\u7EC4\u4EF6\u4EE3\u7801\u65F6\u5F15\u7528\u8BE5\u6587\u4EF6\uFF0C\u4E0D\u518D\u51FA\u73B0\u9B54\u6CD5\u503C\u3002"].join("\n"),
    { format, path: `.wudi/design/exports/${fname}`, content }
  );
}
async function toolNotifyTest(args = {}) {
  const project = loadProject();
  if (!project) return fail("\u9879\u76EE\u6863\u6848\u7F3A\u5931\uFF0C\u5148 wudi_project_init\u3002");
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
function validDesignName(name) {
  const base = String(name ?? "").trim();
  if (!base) return false;
  if (/[/\\]/.test(base)) return false;
  if (base.includes("..")) return false;
  if (/^[\x00-\x1f]/.test(base) || /[\x00-\x1f]/.test(base)) return false;
  if (!/\.(fig|pen)$/i.test(base)) return false;
  return base.replace(/\.(fig|pen)$/i, "").trim().length > 0;
}
function resolveDesignFile(p, root) {
  const projRoot = resolve3(root || projectRoot());
  const base = projectBaseName(projRoot);
  const dir = designsDirFor(projRoot);
  const clean = String(p ?? "").trim().replace(/^\.wudi\/[^/]+\/designs\//i, "").replace(/^\.wudi\/designs\//i, "").replace(/^designs\//i, "");
  if (!validDesignName(clean)) throw new Error(`\u975E\u6CD5\u8BBE\u8BA1\u7A3F\u540D\uFF1A${p}\uFF08\u4EC5\u5141\u8BB8 designs/<\u540D\u79F0>.fig/.pen\uFF0C\u652F\u6301\u4E2D\u6587\uFF09`);
  const file = resolve3(dir, clean);
  if (!file.startsWith(dir + "/")) throw new Error(`\u975E\u6CD5\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF1A${p}`);
  return { dir, file, base: clean };
}
async function toolDesignDelete(args = {}) {
  const path2 = String(args?.path ?? "").trim();
  if (!path2) return fail("\u7F3A\u5C11 path\uFF1A\u8981\u5220\u9664\u7684\u8BBE\u8BA1\u7A3F\u8DEF\u5F84\uFF0C\u5982 designs/old.fig\u3002");
  let file;
  try {
    file = resolveDesignFile(path2, toolRoot(args)).file;
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!await waitForDesignFile(file, 1500)) return fail(`\u8BBE\u8BA1\u7A3F\u4E0D\u5B58\u5728\uFF1A${path2}`);
  rmSync2(file);
  return ok(`\u5DF2\u5220\u9664\u8BBE\u8BA1\u7A3F\uFF1A${path2}`);
}
async function waitForDesignFile(file, ms = 3e3) {
  const deadline = Date.now() + ms;
  while (!existsSync3(file) && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 120));
  }
  return existsSync3(file);
}
async function toolDesignRename(args = {}) {
  const path2 = String(args?.path ?? "").trim();
  const name = String(args?.name ?? "").trim();
  if (!path2 || !name) return fail("\u7F3A\u5C11\u53C2\u6570\uFF1Apath\uFF08\u73B0\u6709\u8BBE\u8BA1\u7A3F\uFF09\u4E0E name\uFF08\u65B0\u6587\u4EF6\u540D\uFF0C\u5982 new.fig\uFF09\u3002");
  let dir, file, base;
  try {
    ({ dir, file, base } = resolveDesignFile(path2, toolRoot(args)));
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!validDesignName(name)) return fail(`\u975E\u6CD5\u65B0\u6587\u4EF6\u540D\uFF1A${name}\uFF08\u4EC5\u5141\u8BB8 <\u540D\u79F0>.fig/.pen\uFF0C\u652F\u6301\u4E2D\u6587\uFF09`);
  if (!await waitForDesignFile(file)) return fail(`\u8BBE\u8BA1\u7A3F\u4E0D\u5B58\u5728\uFF08\u53EF\u80FD\u4ECD\u5728\u843D\u76D8\uFF0C\u7A0D\u540E\u91CD\u8BD5\uFF09\uFF1A${path2}`);
  const target = resolve3(dir, name);
  if (!target.startsWith(dir + "/")) return fail(`\u975E\u6CD5\u76EE\u6807\u8DEF\u5F84\uFF1A${name}`);
  if (existsSync3(target)) return fail(`\u76EE\u6807\u5DF2\u5B58\u5728\uFF1Adesigns/${name}`);
  renameSync2(file, target);
  return ok(`\u5DF2\u91CD\u547D\u540D\uFF1A${base} \u2192 designs/${name}`, { path: `designs/${name}` });
}
async function toolDesignCreate(args = {}) {
  let root;
  try {
    root = toolRoot(args);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const base = projectBaseName(root);
  const name = String(args?.name ?? "").trim() || "ui";
  const rel = `.wudi/${base}/designs/${name}.fig`;
  let file;
  try {
    file = resolveDesignFile(rel, root).file;
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (existsSync3(file)) {
    return ok(`\u753B\u5E03\u5DF2\u5B58\u5728\uFF1A${rel}\uFF08\u76F4\u63A5\u6253\u5F00\uFF09`, { path: rel });
  }
  await openpencilCall(void 0, "new_design", { path: rel });
  const deadline = Date.now() + 5e3;
  while (!existsSync3(file) && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 120));
  }
  if (!existsSync3(file)) return fail(`\u753B\u5E03\u521B\u5EFA\u8D85\u65F6\uFF08\u6587\u4EF6\u672A\u843D\u76D8\uFF09\uFF1A${rel}`);
  return ok(`\u5DF2\u521B\u5EFA\u753B\u5E03\uFF1A${rel}`, { path: rel });
}
function toolDesignsList(args = {}) {
  const root = toolRoot(args);
  const dir = designsDirFor(root);
  try {
    migrateDesignsFor(root);
  } catch {
  }
  const designs = [];
  try {
    for (const f of readdirSync2(dir)) {
      if (!/\.(fig|pen)$/i.test(f)) continue;
      const st = statSync(join3(dir, f));
      designs.push({
        name: f,
        path: `.wudi/${projectBaseName(root)}/designs/${f}`,
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
  const dir = join3(wudiDir(), "artifacts");
  if (!existsSync3(dir)) return [];
  return readdirSync2(dir).filter((f) => /\.(tar|tar\.gz)$/.test(f)).sort().reverse().slice(0, 10).map((name) => {
    const sizeMB = (statSync(join3(dir, name)).size / 1024 / 1024).toFixed(1);
    return { name, sizeMB: Number(sizeMB) };
  });
}
async function pruneReleases(envObj) {
  const releasesDir = join3(envObj.deployRoot, "releases");
  const { stdout } = await sshRun(`ls -1 ${q(releasesDir)}`, { timeoutMs: 3e4, overrides: envObj.ssh });
  const all = parseRemoteReleases(stdout);
  const keep = all.slice(0, 5);
  const toDelete = all.filter((r) => !keep.includes(r));
  if (!toDelete.length) return "\u65E7\u7248\u672C\u6E05\u7406\uFF1A\u65E0\u9700\u6E05\u7406\uFF08\u5171 " + all.length + " \u4E2A\u7248\u672C\uFF09\u3002";
  for (const r of toDelete) {
    await sshRun(`rm -rf -- ${q(join3(releasesDir, r))}`, { timeoutMs: 12e4, overrides: envObj.ssh });
  }
  return `\u65E7\u7248\u672C\u6E05\u7406\uFF1A\u5DF2\u5220\u9664 ${toDelete.length} \u4E2A\uFF08${toDelete.join(", ")}\uFF09\uFF0C\u4FDD\u7559\u6700\u8FD1 5 \u4E2A\uFF08${keep.join(", ")}\uFF09\u3002`;
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
var SERVER_INFO = { name: "wudi-coding", version: "0.44.0" };
try {
  ensureWudiDir();
  ensureProfileAt(projectRoot());
  migrateDesignsFor(projectRoot());
} catch {
}
var PANEL_URI = "ui://wudi-coding/panel.html";
var PANEL_MIME = "text/html;profile=mcp-app";
var panelPath = resolve4(join4(dirname3(fileURLToPath2(import.meta.url)), "ui", "panel.html"));
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
var buffer = "";
var inFlight = 0;
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
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
        let cleanUri = uri;
        let root = "";
        try {
          const u = new URL(uri);
          const r = u.searchParams.get("wudiRoot");
          if (r) {
            root = r;
            u.search = "";
            cleanUri = u.toString();
          }
        } catch {
        }
        openpencilReadResource(root || void 0, cleanUri).then((result) => send(id, result)).catch((err) => sendError(id, -32602, `OpenPencil \u8D44\u6E90\u8BFB\u53D6\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 200)}`));
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
    const callPromise = isWudiTool ? callTool(toolName, params?.arguments ?? {}) : (() => {
      return openpencilCall(void 0, toolName, params?.arguments ?? {}).then((r) => {
        const sc = r.structuredContent;
        if (toolName === "get_design_status" && sc?.bridge?.url) {
          sc.bridge = { ...sc.bridge, url: opWsProxyUrl(sc.bridge.url) };
        }
        return {
          content: (r.content ?? []).map((c) => ({ type: "text", text: c.text ?? "" })),
          isError: !!r.isError,
          structuredContent: sc
        };
      });
    })();
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
