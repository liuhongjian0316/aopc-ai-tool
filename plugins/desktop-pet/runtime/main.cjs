/**
 * desktop-pet Electron 运行壳（宿主）——功能复刻自 dsh-pet，面向 AOPC 插件体系重写。
 *
 * 一个 Electron 进程承载全部宿主逻辑：
 *   - 每只宠物一个透明置顶窗口（一窗一宠，dsh-pet 同款）
 *   - 状态存储（counter 严格递增叶子，语义同 dsh-pet host/state.ts）
 *   - 127.0.0.1 HTTP API（MCP server 与第三方都走它；token 鉴权）
 *   - 多屏几何（工作区并集 + 空洞语义，边界判定一律用并集）
 *   - 工作状态六档归约、碎碎念调度、系统通知、托盘、右键菜单
 *
 * 与渲染端的分工：渲染端拥有运动中的窗口位置（拖拽/甩抛/漫游逐帧 setPosition），
 * 宿主拥有静态位置（初始落点、/position 指令、显示器拓扑变化重定位）。
 */
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  screen,
  ipcMain,
  Notification,
  nativeImage,
} = require("electron");

// 透明窗口 + 视频的关键：硬件解码视频在透明窗口上会合成出不透明黑底（GPU 直通合成不走 alpha）。
// dsh-pet 同款解法：关硬件加速（软件合成保留 alpha），并关 GPU 沙箱避免 "GPU process isn't usable" 崩溃。
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu-sandbox");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { WORK_STATUS_STATES, WORK_STATUS_INDEX, nextWorkStatusAnim, pickSlot } = require("../shared/dist/shared-core.cjs");
// ---------------------------------------------------------------- 环境与路径
const PLUGIN_ROOT = process.env.AOPC_PLUGIN_ROOT || path.join(__dirname, "..");
const DATA_DIR = process.env.AOPC_PLUGIN_DATA || path.join(PLUGIN_ROOT, ".data");
const CONFIG_DIR = process.env.AOPC_PET_USER_CONFIG_DIR || DATA_DIR; // MCP server 传 user_config 落盘目录
const AUTO_START = !["0", "false"].includes(String(process.env.AOPC_PET_AUTO_START ?? "true").toLowerCase());
// 插件设置「显示宠物」：false = 默认全部隐藏（工具/托盘仍可临时唤出）
let SHOW_PETS = !["0", "false"].includes(String(process.env.AOPC_PET_SHOW ?? "true").toLowerCase());
// 插件设置「宠物名字」：空串 = 不覆盖（用配置文件里的名字）
let PET_NAME = String(process.env.AOPC_PET_PET_NAME ?? "").trim();
let PHYSICS_POWER = Number(process.env.AOPC_PET_PHYSICS_POWER || "1") || 1;

fs.mkdirSync(DATA_DIR, { recursive: true });
const RUNTIME_FILE = path.join(DATA_DIR, "runtime.json");
const PLUGIN_VERSION = JSON.parse(
  fs.readFileSync(path.join(PLUGIN_ROOT, ".aopc-plugin", "plugin.json"), "utf-8"),
).version;
const USER_CONFIG_FILE = path.join(CONFIG_DIR, "config.jsonc");
const PACKS_DIR = path.join(PLUGIN_ROOT, "packs");

// ---------------------------------------------------------------- JSONC 解析
function stripJsonComments(text) {
  let out = "";
  let inStr = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && n === "/") {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += n ?? "";
        i++;
      } else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      continue;
    }
    if (c === "/" && n === "/") {
      inLine = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

function readJsonc(file) {
  try {
    return JSON.parse(stripJsonComments(fs.readFileSync(file, "utf-8")));
  } catch (error) {
    if (error?.code !== "ENOENT") console.error(`[pet] config parse failed: ${file}`, error?.message);
    return null;
  }
}

// ---------------------------------------------------------------- 配置合并
// 内置默认（assets/config.jsonc）← 用户层（data/config.jsonc，顶层键整段覆盖）
//                          ← 种类条目（packs/<pack>-config.json，覆盖同名宠物条目字段）
const DEFAULT_CONFIG = readJsonc(path.join(PLUGIN_ROOT, "assets", "config.jsonc")) || {};
let config = null;
let configRev = 0;

function loadConfig() {
  const userLayer = readJsonc(USER_CONFIG_FILE) || {};
  const merged = { ...structuredClone(DEFAULT_CONFIG) };
  for (const [key, value] of Object.entries(userLayer)) {
    if (key === "pets" && Array.isArray(value)) {
      // 用户层 pets 按 id 合并进默认条目（新增 id 追加；display:"none" 支持隐藏内置宠物）
      for (const up of value) {
        const base = merged.pets.find((p) => p.id === up.id);
        if (base) Object.assign(base, up);
        else merged.pets.push(structuredClone(up));
      }
    } else {
      merged[key] = structuredClone(value);
    }
  }
  // 种类条目级覆盖
  for (const pet of merged.pets) {
    if (!pet.pack) continue;
    const packCfg = readJsonc(path.join(PACKS_DIR, `${pet.pack}-config.json`));
    if (packCfg) Object.assign(pet, packCfg);
  }
  // userConfig 注入
  for (const pet of merged.pets) {
    if (!SHOW_PETS) pet.display = "none";
    if (PET_NAME) pet.name = PET_NAME;
    if (pet.physics) pet.physics = { ...pet.physics, throwPower: pet.physics.throwPower ?? PHYSICS_POWER };
    else pet.physics = { ...DEFAULT_CONFIG.physics, throwPower: PHYSICS_POWER };
  }
  if (Number(process.env.AOPC_PET_WHISPER_INTERVAL ?? "") !== 0) {
    const interval = Number(process.env.AOPC_PET_WHISPER_INTERVAL);
    if (Number.isFinite(interval) && interval > 0) merged.eventsRefreshSec.whisper = interval;
  }
  config = merged;
  configRev++;
}

// ---------------------------------------------------------------- 状态存储
// 语义移植自 dsh-pet host/state.ts：叶子 = {counter, data}，counter = max(Date.now(), last+1)。
const state = {
  counter: 0,
  sections: {
    workStatus: { counter: 0, data: null },
    notify: { counter: 0, data: null },
    config: { counter: 0, data: {} }, // 纯信号叶子：变了就让客户端重拉 /config
    menu: { counter: 0, data: null },
  },
  pets: {}, // id -> { say, anim, position, throw, lock } 各为 {counter, data}
};

function bumpCounter() {
  state.counter = Math.max(Date.now(), state.counter + 1);
  return state.counter;
}
function writeSection(name, data) {
  state.sections[name] = { counter: bumpCounter(), data };
}
function petLeaves(id) {
  if (!state.pets[id]) state.pets[id] = {};
  return state.pets[id];
}
function writePet(id, leaf, data) {
  petLeaves(id)[leaf] = { counter: bumpCounter(), data };
}
function snapshotState() {
  return { counter: state.counter, sections: state.sections, pets: state.pets };
}

// ---------------------------------------------------------------- 宠物运行态
const pets = new Map(); // id -> { id, cfg, win, pose{x,y,facing,vx,vy}, inside, whisperTimer, workStatus:{state,until} }
let displays = null; // { hull, areas, panels }
let httpServer = null;
let apiPort = 0;
let apiToken = "";
let workStatus = { state: null, until: 0, perPet: false };

const persist = debounce(saveRuntimeState, 800);

function debounce(fn, ms) {
  let timer = null;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  return wrapped;
}

function loadRuntimeState() {
  return readJsonc(RUNTIME_FILE) || {};
}
function saveRuntimeState() {
  // 保留 apiPort/apiToken（MCP server 单实例握手/版本检查都依赖它），只更新 pets 段
  const data = { ...loadRuntimeState(), pets: {} };
  for (const [id, pet] of pets) {
    if (pet.pose) {
      data.pets[id] = { x: pet.pose.x, y: pet.pose.y, facing: pet.pose.facing ?? "left", display: pet.cfg.display };
    }
  }
  try {
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("[pet] persist failed:", error?.message);
  }
}

// ---------------------------------------------------------------- 多屏几何
function buildDeskGeometry() {
  const displaysList = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const originX = Math.min(...displaysList.map((d) => d.workArea.x));
  const originY = Math.min(...displaysList.map((d) => d.workArea.y));
  const area = (d) => {
    const wa = { ...d.workArea };
    if (process.platform === "darwin") {
      // macOS 工作区顶部从菜单栏下沿起算；宠物可以站进菜单栏区域之外的面板顶
      wa.y = d.bounds.y;
      wa.height = d.bounds.height - (primary.workArea.y - primary.bounds.y) - (d.bounds.height - d.workArea.height);
      wa.height = Math.max(wa.height, d.workArea.height);
    }
    return wa;
  };
  const panels = displaysList.map((d) => ({ ...d.bounds }));
  const areas = displaysList.map((d) => area(d));
  const hull = {
    x: Math.min(...areas.map((r) => r.x)),
    y: Math.min(...areas.map((r) => r.y)),
    width: Math.max(...areas.map((r) => r.x + r.width)) - Math.min(...areas.map((r) => r.x)),
    height: Math.max(...areas.map((r) => r.y + r.height)) - Math.min(...areas.map((r) => r.y)),
  };
  return { hull: { x: originX, y: originY, width: hull.width, height: hull.height }, areas, panels };
}

let displayDebounce = null;
function scheduleDisplays() {
  clearTimeout(displayDebounce);
  displayDebounce = setTimeout(() => {
    displays = buildDeskGeometry();
    for (const pet of pets.values()) {
      if (pet.win && !pet.win.isDestroyed()) pet.win.webContents.send("pet:displays", displays);
    }
    // 拓扑变化后按「世界坐标守恒」重定位（越界才夹到最近屏）
    for (const pet of pets.values()) {
      if (!pet.pose) continue;
      const cx = pet.pose.x + pet.cfg.size / 2;
      const cy = pet.pose.y + (pet.cfg.size * 9) / 16 / 2;
      const hit = displays.areas.find(
        (r) => cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height,
      );
      if (!hit) {
        const nearest = nearestArea(cx, cy);
        const nx = Math.min(Math.max(cx, nearest.x), nearest.x + nearest.width - pet.cfg.size);
        const ny = Math.min(Math.max(cy, nearest.y), nearest.y + nearest.height - (pet.cfg.size * 9) / 16);
        applyPosition(pet, { x: nx, y: ny, mode: "instant" });
      }
    }
  }, 300);
}
function nearestArea(x, y) {
  let best = displays.areas[0];
  let bestD = Infinity;
  for (const r of displays.areas) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
function initialPosition(cfg) {
  const areas = displays.areas;
  const areaFor = cfg.display && pets.size ? areas[0] : areas[0];
  const wa = areaFor;
  const h = (cfg.size * 9) / 16;
  const corner = cfg.position?.corner || "bottom-right";
  const mx = cfg.position?.marginX ?? 60;
  const my = cfg.position?.marginY ?? 40;
  const x = corner.endsWith("right") ? wa.x + wa.width - cfg.size - mx : wa.x + mx;
  const y = corner.startsWith("bottom") ? wa.y + wa.height - h - my : wa.y + my;
  return { x, y };
}

/** 把包围盒左上角钳进当前工作区并集（含中心归属判定；找不到最近屏兜底），返回钳制后的位置 */
function clampIntoWorkAreas(pos, size) {
  const h = (size * 9) / 16;
  const cx = pos.x + size / 2;
  const cy = pos.y + h / 2;
  let area = displays.areas.find((r) => cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height);
  if (!area) {
    let bestD = Infinity;
    for (const r of displays.areas) {
      const dx = Math.max(r.x - cx, 0, cx - (r.x + r.width));
      const dy = Math.max(r.y - cy, 0, cy - (r.y + r.height));
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        area = r;
      }
    }
  }
  if (!area) return pos;
  const dims = petMetrics(size);
  return {
    x: Math.min(Math.max(pos.x, area.x + dims.mx), Math.max(area.x + dims.mx, area.x + area.width - size - dims.mx)),
    y: Math.min(Math.max(pos.y, area.y + dims.mt), Math.max(area.y + dims.mt, area.y + area.height - h)),
  };
}

// ---------------------------------------------------------------- 窗口管理
const WINDOW_MARGIN = Math.round(0.25 * 360); // 渲染端舞台余量（与 dsh 一致的 16:9 画布 + 底部脚线垫高）

// 窗口比宠物包围盒大一圈：顶部留给碎碎念卡，左右留给挤压/转向溢出（dsh 同思路）。
// 坐标契约：pose/position/throw 用的 (x,y) 永远是「宠物包围盒左上角」，
// 窗口位置 = 包围盒左上角 - 左边距/上边距。
function petMetrics(size) {
  return {
    mx: Math.round(size * 0.3),
    mt: Math.round(size * 0.52),
    mb: Math.round(size * 0.06),
    h: Math.round((size * 9) / 16),
  };
}

function createPetWindow(pet) {
  const { size } = pet.cfg;
  const dims = petMetrics(size);
  const win = new BrowserWindow({
    width: size + dims.mx * 2,
    height: dims.h + dims.mt + dims.mb,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false, // 位置由 setPosition 控制（渲染端运动帧 / 宿主静态指令）
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, "renderer", "pet.html"));
  win.on("closed", () => {
    if (pet.win === win) pet.win = null;
  });
  pet.win = win;
  win.webContents.once("did-finish-load", () => {
    win.webContents.send("pet:init", {
      pet: pet.cfg,
      configRev,
      apiPort,
      apiToken,
      displays,
      margins: { mx: dims.mx, mt: dims.mt, mb: dims.mb },
      animations: animationsFor(pet.cfg),
      physics: pet.cfg.physics,
      weights: pet.cfg.animationWeights || DEFAULT_CONFIG.animationWeights,
      eventsRefreshSec: config.eventsRefreshSec || {},
      reducedMotionNote: true,
    });
    // 位置恢复优先级：内存 pose（隐藏/重启前的实时位置）> 持久化文件 > 配置初始落点，
    // 再钳进当前工作区（窗口尺寸可能比上次大或显示器拓扑变化）
    const saved = pet.pose
      ? { x: pet.pose.x, y: pet.pose.y, facing: pet.pose.facing }
      : loadRuntimeState().pets?.[pet.id];
    let pos = saved && Number.isFinite(saved.x) ? { x: saved.x, y: saved.y } : initialPosition(pet.cfg);
    pos = clampIntoWorkAreas(pos, pet.cfg.size);
    pet.pose = { x: pos.x, y: pos.y, facing: saved?.facing || "left", vx: 0, vy: 0 };
    win.webContents.send("pet:position", { ...pos, mode: "instant", facing: pet.pose.facing });
    win.showInactive();
    win.setPosition(Math.round(pos.x - dims.mx), Math.round(pos.y - dims.mt));
    const leaves = petLeaves(pet.id);
    win.webContents.send("pet:state", {
      say: leaves.say ?? null,
      anim: leaves.anim ?? null,
      lock: leaves.lock ?? null,
      throwLeaf: leaves.throw ?? null,
    });
  });
  return win;
}

function animationsFor(cfg) {
  return {
    idle: cfg.animations?.idle ?? ["待机"],
    turn: cfg.animations?.turn ?? ["转身"],
    drag: cfg.animations?.drag ?? ["拖拽"],
    clicks: cfg.animations?.clicks ?? ["点击弹跳", "摇摆"],
    moves: cfg.animations?.moves ?? { default: { minDist: 60, maxDist: 240, duration: 3 }, actions: [{ name: "溜达" }] },
    categories: cfg.animations?.categories ?? [{ id: "卖萌", weight: 80, actions: ["点击弹跳", "摇摆", "转圈"] }],
    events: cfg.animations?.events ?? DEFAULT_CONFIG.animations?.events ?? {},
  };
}

function destroyPetWindow(pet) {
  if (pet.win && !pet.win.isDestroyed()) pet.win.destroy();
  pet.win = null;
}

function syncPetWindows() {
  const wanted = new Map();
  for (const cfg of config.pets) {
    if (cfg.display === "desktop") wanted.set(cfg.id, cfg);
  }
  for (const [id, pet] of pets) {
    if (!wanted.has(id) && pet.win) {
      clearTimeout(pet.whisperTimer);
      destroyPetWindow(pet);
    }
  }
  for (const [id, cfg] of wanted) {
    const existing = pets.get(id);
    if (!existing) {
      const pet = { id, cfg, win: null, pose: null, whisperTimer: null };
      pets.set(id, pet);
      createPetWindow(pet);
    } else {
      existing.cfg = cfg;
      // 隐藏（display:none）只销毁了窗口，宠物对象还在：重新显示必须把窗口建回来
      if (!existing.win || existing.win.isDestroyed()) createPetWindow(existing);
    }
  }
  rebuildTray();
  persist();
}

function applyPosition(pet, { x, y, mode = "instant" }) {
  pet.pose = { ...(pet.pose || { facing: "left", vx: 0, vy: 0 }), x, y };
  pet.win?.webContents.send("pet:position", { x, y, mode });
  if (mode === "instant") pet.win?.setPosition(Math.round(x), Math.round(y));
  persist();
}

// ---------------------------------------------------------------- 点击穿透兜底
// macOS 上窗口 ignore 鼠标后渲染端收不到任何事件（forward 不可用），无法自行翻回，
// 所以主进程指针轮询是主判定：全局光标 vs 窗口位置 + 渲染端上报的窗口局部命中框。
setInterval(() => {
  const cursor = screen.getCursorScreenPoint();
  for (const pet of pets.values()) {
    if (!pet.win || pet.win.isDestroyed() || !pet.lastBodyBox) continue;
    const wb = pet.win.getBounds();
    const box = pet.lastBodyBox; // 窗口局部 px（渲染端上报，已合并气泡可点区）
    const gx = wb.x + box.x;
    const gy = wb.y + box.y;
    const inside =
      cursor.x >= gx && cursor.x <= gx + box.w && cursor.y >= gy && cursor.y <= gy + box.h;
    if (inside && pet.ignoringMouse !== false) {
      pet.ignoringMouse = false;
      pet.win.setIgnoreMouseEvents(false);
      if (process.env.AOPC_PET_DEBUG) console.log(`[pet] ${pet.id} interactive=true`);
    } else if (!inside && pet.ignoringMouse === false && pet.rendererLockInput !== true) {
      pet.ignoringMouse = true;
      pet.win.setIgnoreMouseEvents(true, { forward: true });
      if (process.env.AOPC_PET_DEBUG) console.log(`[pet] ${pet.id} interactive=false`);
    }
  }
}, 100).unref();

// ---------------------------------------------------------------- 碎碎念 / 工作状态 / 通知
function pickFrom(pool, exclude) {
  const candidates = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (candidates.length === 0) return null;
  const filtered = candidates.length > 1 && exclude != null ? candidates.filter((p) => p !== exclude) : candidates;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function whisper(pet, text) {
  const phrase = text ?? pickFrom(pet.cfg.whisperPhrases ?? config.whisperPhrases, pet.lastWhisper);
  if (!phrase) return null;
  pet.lastWhisper = phrase;
  // 碎碎念随机配图（dsh whisperImageEnabled 语义）：从包的 memes 图池随机抽 1 张
  let image;
  if (pet.cfg.whisperImageEnabled !== false && pet.cfg.memes && pet.win) {
    const keys = Object.keys(pet.cfg.memes);
    if (keys.length > 0) {
      const key = keys[Math.floor(Math.random() * keys.length)];
      image = `http://127.0.0.1:${apiPort}/pack/${pet.cfg.pack}/memes/${encodeURIComponent(key)}.png`;
    }
  }
  writePet(pet.id, "say", { kind: "say", text: phrase, image, duration: 10000, variant: "whisper" });
  pushPetState(pet, ["say"]);
  playEventAnim(pet, "whisper");
  return phrase;
}

function scheduleWhisper(pet) {
  clearTimeout(pet.whisperTimer);
  if (!pet.cfg.whisperEnabled) return;
  const userInterval = Number(process.env.AOPC_PET_WHISPER_INTERVAL);
  const interval = Number.isFinite(userInterval)
    ? userInterval
    : (config.eventsRefreshSec?.whisper ?? 300);
  if (interval <= 0) return;
  const jitter = interval * 0.2;
  const delay = (interval - jitter + Math.random() * jitter * 2) * 1000;
  pet.whisperTimer = setTimeout(() => {
    whisper(pet);
    scheduleWhisper(pet);
  }, delay);
  pet.whisperTimer.unref?.();
}

function playEventAnim(pet, eventName, index) {
  const slots = pet.cfg.animations?.events?.[eventName] ?? animationsFor(pet.cfg).events[eventName];
  if (!Array.isArray(slots) || slots.length === 0) return null;
  const tier = typeof index === "number" ? Math.min(Math.max(index, 0), slots.length - 1) : slots.length - 1;
  const name = pickFrom([].concat(slots[tier]), pet.currentAnim);
  if (!name) return null;
  writePet(pet.id, "anim", { name, once: true });
  pushPetState(pet, ["anim"]);
  return name;
}

function setWorkStatus(next, { originText } = {}) {
  const now = Date.now();
  workStatus = { state: next, until: now, perPet: false };
  writeSection("workStatus", { state: next, at: now });
  for (const pet of pets.values()) {
    if (!pet.cfg.workStatusEnabled) continue;
    if (next == null) {
      pet.workStatus = null;
      // 回空闲：清掉状态气泡（写 clear）
      writePet(pet.id, "say", { kind: "clear" });
      pushPetState(pet, ["say"]);
      continue;
    }
    const idx = WORK_STATUS_INDEX[next];
    if (idx == null) continue;
    pet.workStatus = { state: next, since: now };
    // 档位动画：新状态 = 档内随机抽；同状态重入 = 档内轮换（nextWorkStatusAnim 语义同上游）
    const slots = (pet.cfg.animations?.events ?? animationsFor(pet.cfg).events).workStatus;
    const tierSlots = Array.isArray(slots) ? slots[idx] : undefined;
    const anim = pet.workStatus?.state === next
      ? nextWorkStatusAnim(tierSlots ?? [], pet.currentAnim)
      : (tierSlots != null ? pickSlot(tierSlots, pet.currentAnim) : null);
    if (anim) {
      writePet(pet.id, "anim", { name: anim, once: false });
      pushPetState(pet, ["anim"]);
    }
    const texts = pet.cfg.workStatusTexts ?? config.workStatusTexts;
    const line = originText ?? (Array.isArray(texts?.[idx]) ? pickFrom(texts[idx]) : null);
    if (line) {
      const terminal = next === "success" || next === "error" || next === "result";
      writePet(pet.id, "say", { kind: "say", text: line, duration: terminal ? 10000 : 0 });
      pushPetState(pet, ["say"]);
    }
  }
  // 终态自动回落
  clearTimeout(setWorkStatus._clearTimer);
  if (next === "success" || next === "error" || next === "result") {
    setWorkStatus._clearTimer = setTimeout(() => {
      if (workStatus.state === next) setWorkStatus(null);
    }, 10000);
    setWorkStatus._clearTimer.unref?.();
  }
}

function pushPetState(pet, leaves) {
  if (!pet.win || pet.win.isDestroyed()) return;
  const all = petLeaves(pet.id);
  const payload = {};
  for (const leaf of leaves ?? Object.keys(all)) payload[leaf === "throwLeaf" ? "throwLeaf" : leaf] = all[leaf] ?? null;
  pet.win.webContents.send("pet:state", payload);
}

// ---------------------------------------------------------------- 右键菜单（原生）+ 第三方注册表
const thirdPartyMenu = new Map(); // owner -> [{id,label}]
const menuClickQueue = new Map(); // owner -> [items]
const menuWaiters = new Map(); // owner -> [resolve]

function buildContextMenu(pet) {
  const anims = animationsFor(pet.cfg);
  const playItem = (label, name) => ({
    label,
    click: () => {
      writePet(pet.id, "anim", { name, once: true });
      pushPetState(pet, ["anim"]);
    },
  });
  const actionSub = [
    playItem("待机", pickFrom(anims.idle) || "待机"),
    {
      label: "转向",
      click: () => pet.win?.webContents.send("pet:face", pet.pose?.facing === "left" ? "right" : "left"),
    },
    playItem("点击回应", pickFrom(anims.clicks) || "点击弹跳"),
  ];
  for (const cat of anims.categories || []) {
    actionSub.push({
      label: cat.id,
      submenu: (cat.actions || []).map((name) => playItem(name, name)),
    });
  }
  // 事件项用中文标签（workStatus/whisper/balance → 工作状态/碎碎念/余额）
  const EVENT_LABELS = { workStatus: "工作状态", whisper: "碎碎念", balance: "余额" };
  for (const [event, slots] of Object.entries(anims.events || {})) {
    actionSub.push({
      label: EVENT_LABELS[event] ?? event,
      submenu: slots.map((slot, idx) => playItem([slot].flat().join("/") || `档位${idx + 1}`, [].concat(slot)[0])),
    });
  }
  const template = [
    { label: "动作", submenu: actionSub },
    {
      label: "碎碎念",
      click: () => whisper(pet),
    },
    {
      label: "回到初始位置",
      click: () => {
        const pos = initialPosition(pet.cfg);
        applyPosition(pet, { ...pos, mode: "spring" });
      },
    },
    {
      label: "重载配置",
      click: () => restartAllPets(),
    },
  ];
  if ((config.links || []).length > 0) {
    template.push({
      label: "打开网站",
      submenu: config.links.map((l) => ({
        label: l.title,
        click: () => require("electron").shell.openExternal(l.url),
      })),
    });
  }
  const third = [...thirdPartyMenu.entries()].flatMap(([owner, items]) =>
    items.map((item) => ({
      label: item.label,
      click: () => {
        const entry = { owner, id: item.id, label: item.label, at: Date.now() };
        const queue = menuClickQueue.get(owner) || [];
        queue.push(entry);
        menuClickQueue.set(owner, queue);
        const waiters = menuWaiters.get(owner);
        if (waiters?.length) {
          menuWaiters.delete(owner);
          for (const resolve of waiters) resolve(queue.shift());
        }
      },
    })),
  );
  if (third.length > 0) template.push({ label: "更多", submenu: third });
  template.push({
    label: "隐藏",
    click: () => {
      pet.cfg.display = "none";
      syncPetWindows();
    },
  });
  return Menu.buildFromTemplate(template);
}

/**
 * 重载配置并整体重启宠物：渲染端持有旧动画配置，只热更新 cfg 不够，必须销毁重建全部窗口。
 */
function restartAllPets() {
  loadConfig();
  for (const p of pets.values()) {
    clearTimeout(p.whisperTimer);
    destroyPetWindow(p);
  }
  pets.clear();
  syncPetWindows();
  writeSection("config", {});
  if (process.env.AOPC_PET_DEBUG) console.log(`[pet] all pets restarted (${pets.size})`);
}

// Electron 经典坑：popup 返回后 Menu 的 JS 包装若被 GC，菜单项 click 回调不会再触发。
// 模块级持有当前弹出的 Menu 引用，直到下次弹出替换。
let tray = null;
let activePetMenu = null;
function popupPetMenu(pet, x, y) {
  activePetMenu = buildContextMenu(pet);
  activePetMenu.popup({ window: pet.win, ...(x != null ? { x, y } : {}) });
}


function trayIcon() {
  // dsh-pet 同款托盘图标：assets/logo.png 缩到 16×16；macOS 按模板图处理（菜单栏深浅色自动反色）
  let img = nativeImage.createFromPath(path.join(PLUGIN_ROOT, "assets", "logo.png"));
  if (img.isEmpty()) {
    console.error("[pet] tray icon missing or unreadable: " + path.join(PLUGIN_ROOT, "assets", "logo.png"));
    return img;
  }
  img = img.resize({ width: 16, height: 16 });
  if (process.platform === "darwin") img.setTemplateImage(true);
  return img;
}

// 托盘 = 显示/隐藏控制台：逐宠切换显示状态（含当前隐藏的）+ 重载配置 + 退出。
function rebuildTray() {
  if (process.platform === "darwin" && app.dock) app.dock.hide();
  if (!tray) {
    try {
      const icon = trayIcon();
      if (icon.isEmpty()) {
        console.error("[pet] tray icon empty, skip tray");
        return;
      }
      tray = new Tray(icon);
      // Windows 的 setContextMenu 只接管右键，左键需手动弹菜单（dsh tray-platform 同款判定）；
      // macOS 左键自动弹菜单，Linux click 不可靠只能依赖 setContextMenu
      if (process.platform === "win32") {
        tray.on("click", () => {
          if (!tray) return;
          rebuildTray(); // 先刷新显示状态再弹
          tray.popUpContextMenu();
        });
      }
      if (process.env.AOPC_PET_DEBUG) console.log("[pet] tray ready");
    } catch (error) {
      console.error("[pet] tray create failed:", error?.message);
      return; // 无托盘环境（部分 Linux）
    }
  }
  const items = [];
  for (const cfg of config.pets) {
    items.push({
      label: `${cfg.name || cfg.id}：${cfg.display === "desktop" ? "显示中" : "已隐藏"}`,
      click: () => {
        cfg.display = cfg.display === "desktop" ? "none" : "desktop";
        syncPetWindows();
      },
    });
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "AOPC 桌宠", enabled: false },
      { type: "separator" },
      ...items,
      { type: "separator" },
      { label: "重载配置（重启宠物）", click: () => restartAllPets() },
      { label: "退出", click: () => app.quit() },
    ]),
  );
  tray.setToolTip("AOPC 桌宠");
}

// macOS 上不进 Dock（宠物应用没有主窗口语义）。

// ---------------------------------------------------------------- HTTP API
function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "null",
  });
  res.end(body);
}
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf-8");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function requireAuth(req) {
  if (!apiToken) return true;
  return req.headers["x-aopc-pet-token"] === apiToken;
}

const stateWaiters = new Set();
function notifyStateWatchers() {
  for (const resolve of [...stateWaiters]) resolve();
  stateWaiters.clear();
}

function startHttpApi() {
  apiToken = require("node:crypto").randomBytes(16).toString("hex");
  httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${apiPort}`);
    const route = `${req.method} ${url.pathname}`;
    try {
      // 静态素材（pack webm/mov/memes/音效；builtin 无素材）
      if (req.method === "GET" && url.pathname.startsWith("/pack/")) {
        const rel = decodeURIComponent(url.pathname.slice("/pack/".length));
        const base = path.join(PACKS_DIR);
        const file = path.normalize(path.join(base, rel));
        if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return json(res, 404, { error: "not found" });
        }
        const types = {
          ".webm": "video/webm",
          ".mov": "video/quicktime",
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".wav": "audio/wav",
          ".mp3": "audio/mpeg",
        };
        res.writeHead(200, {
          "content-type": types[path.extname(file).toLowerCase()] ?? "application/octet-stream",
          "cache-control": "max-age=3600",
        });
        return fs.createReadStream(file).pipe(res);
      }
      if (!requireAuth(req)) return json(res, 401, { error: "unauthorized" });

      switch (route) {
        case "GET /state": {
          const since = Number(url.searchParams.get("since") || "0");
          const timeout = Math.min(Number(url.searchParams.get("timeout") || "0"), 10000);
          if (since && timeout && state.counter <= since) {
            await new Promise((resolve) => {
              const timer = setTimeout(resolve, timeout);
              timer.unref?.();
              stateWaiters.add(() => {
                clearTimeout(timer);
                resolve();
              });
            });
          }
          return json(res, 200, snapshotState());
        }
        case "POST /work-status": {
          const body = await readBody(req);
          const s = body.state === "clear" || body.state === null ? null : String(body.state);
          if (s != null && !WORK_STATUS_STATES.includes(s)) return json(res, 400, { error: `state must be one of ${WORK_STATUS_STATES.join("|")}|clear` });
          setWorkStatus(s, { originText: body.text });
          return json(res, 200, { ok: true, state: s });
        }
        case "POST /say":
        case "POST /broadcast": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          writePet(pet.id, "say", {
            kind: "say",
            text: String(body.text ?? "").slice(0, 2000),
            image: body.image ? String(body.image) : undefined,
            url: body.url ? String(body.url) : undefined,
            duration: Number(body.duration ?? 10000) || 0,
            anim: body.anim === false ? false : undefined,
          });
          pushPetState(pet, ["say"]);
          if (body.anim !== false) playEventAnim(pet, "whisper");
          return json(res, 200, { ok: true });
        }
        case "POST /bubble/clear": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          writePet(pet.id, "say", { kind: "clear" });
          pushPetState(pet, ["say"]);
          return json(res, 200, { ok: true });
        }
        case "POST /whisper": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const phrase = whisper(pet, body.text ? String(body.text) : undefined);
          return phrase ? json(res, 200, { ok: true, text: phrase }) : json(res, 400, { error: "no whisper phrase configured" });
        }
        case "POST /anim": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const hasName = typeof body.name === "string" && body.name.length > 0;
          const hasUrl = typeof body.url === "string" && /^https?:\/\//.test(body.url);
          if (hasName === hasUrl) return json(res, 400, { error: "exactly one of name|url required" });
          const facing = body.facing === "left" || body.facing === "right" ? body.facing : undefined;
          writePet(pet.id, "anim", hasName ? { name: body.name, facing, once: true } : { url: body.url, facing, once: true });
          pushPetState(pet, ["anim"]);
          return json(res, 200, { ok: true });
        }
        case "POST /position": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          applyPosition(pet, { x: Number(body.x), y: Number(body.y), mode: body.mode === "spring" || body.mode === "line" ? body.mode : "instant" });
          return json(res, 200, { ok: true });
        }
        case "POST /throw": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const angle = Number(body.angle ?? 80);
          const power = Number(body.power ?? 1);
          pet.win?.webContents.send("pet:throw", { angle, power });
          return json(res, 200, { ok: true });
        }
        case "POST /lock": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const seconds = Math.max(1, Number(body.seconds ?? 30));
          writePet(pet.id, "lock", { locked: true, expiresAt: Date.now() + seconds * 1000 });
          pushPetState(pet, ["lock"]);
          return json(res, 200, { ok: true });
        }
        case "POST /lock/release": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          writePet(pet.id, "lock", { locked: false });
          pushPetState(pet, ["lock"]);
          return json(res, 200, { ok: true });
        }
        case "POST /debug/click": {
          // 测试专用：用 sendInputEvent 直接向渲染端注入鼠标事件（绕过 OS 合成事件的权限问题）
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet?.win) return json(res, 400, { error: "pet window not ready" });
          // 用「纯身体」命中框中心（气泡可见时 lastBodyBox 是合并区，中心会偏到气泡上）
          const dims = petMetrics(pet.cfg.size);
          const box = {
            x: dims.mx + (200 / 640) * pet.cfg.size,
            y: dims.mt + (50 / 360) * dims.h,
            w: ((440 - 200) / 640) * pet.cfg.size,
            h: ((335 - 50) / 360) * dims.h,
          };
          const cx = Math.round(box.x + box.w / 2);
          const cy = Math.round(box.y + box.h / 2);
          const wc = pet.win.webContents;
          for (const type of ["mouseEnter", "mouseMove", "mouseDown", "mouseUp", "mouseLeave"]) {
            wc.sendInputEvent({ type, x: cx, y: cy, button: "left", clickCount: 1 });
          }
          return json(res, 200, { ok: true, at: { cx, cy } });
        }
        case "GET /pose": {
          const out = {};
          for (const [id, pet] of pets) {
            out[id] = pet.pose ? { ...pet.pose, anim: pet.currentAnim ?? null, interactive: pet.ignoringMouse === false } : null;
          }
          return json(res, 200, { pets: out });
        }
        case "POST /pose/report": {
          const body = await readBody(req);
          const pet = pets.get(String(body.pet || ""));
          if (pet) {
            pet.pose = { x: Number(body.x), y: Number(body.y), facing: body.facing ?? pet.pose?.facing, vx: Number(body.vx ?? 0), vy: Number(body.vy ?? 0) };
            pet.lastBodyBox = body.bodyBox ?? pet.lastBodyBox;
            pet.rendererLockInput = Boolean(body.inputBusy);
          }
          return json(res, 200, { ok: true });
        }
        case "POST /balance": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const percent = Math.max(0, Math.min(100, Number(body.percent ?? 0)));
          playEventAnim(pet, "balance", percent >= 100 ? 5 : Math.floor(percent / 20));
          writePet(pet.id, "say", { kind: "say", text: body.text ?? `余额 ${percent}%`, duration: 10000 });
          pushPetState(pet, ["say"]);
          return json(res, 200, { ok: true });
        }
        case "POST /notify": {
          const body = await readBody(req);
          if (config.notificationsEnabled !== false && Notification.isSupported()) {
            new Notification({ title: body.title || "AOPC 桌宠", body: String(body.text ?? "").slice(0, 300) }).show();
          }
          return json(res, 200, { ok: true });
        }
        case "POST /menu/item": {
          const body = await readBody(req);
          const owner = String(body.owner || "").slice(0, 64);
          if (!owner) return json(res, 400, { error: "owner required" });
          const items = (Array.isArray(body.items) ? body.items : [])
            .slice(0, 20)
            .map((i) => ({ id: String(i.id || "").slice(0, 64), label: String(i.label || "").slice(0, 32) }))
            .filter((i) => i.id && i.label);
          thirdPartyMenu.set(owner, items);
          return json(res, 200, { ok: true });
        }
        case "DELETE /menu/item": {
          const owner = url.searchParams.get("owner") || "";
          thirdPartyMenu.delete(owner);
          return json(res, 200, { ok: true });
        }
        case "GET /menu/events": {
          const owner = url.searchParams.get("owner") || "";
          const wait = Math.min(Number(url.searchParams.get("wait") || "0"), 10000);
          const queue = menuClickQueue.get(owner);
          if (queue?.length) return json(res, 200, { items: queue.splice(0) });
          if (wait > 0) {
            const item = await new Promise((resolve) => {
              const timer = setTimeout(() => resolve(null), wait);
              timer.unref?.();
              const waiters = menuWaiters.get(owner) || [];
              waiters.push(resolve);
              menuWaiters.set(owner, waiters);
            });
            return json(res, 200, { items: item ? [item] : [] });
          }
          return json(res, 200, { items: [] });
        }
        case "POST /menu/click": {
          // 供外部（无真实菜单环境）触发宠物菜单项：{pet, label}
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          popupPetMenu(pet, Number(body.x ?? 10), Number(body.y ?? 10));
          return json(res, 200, { ok: true });
        }
        case "GET /config":
          return json(res, 200, { rev: configRev, config });
        case "POST /apply-config": {
          const body = await readBody(req);
          if (body.petName !== undefined) process.env.AOPC_PET_PET_NAME = String(body.petName).trim();
          if (body.show !== undefined) process.env.AOPC_PET_SHOW = String(body.show);
          if (body.whisperIntervalSec !== undefined) process.env.AOPC_PET_WHISPER_INTERVAL = String(body.whisperIntervalSec);
          if (body.physicsPower !== undefined) process.env.AOPC_PET_PHYSICS_POWER = String(body.physicsPower);
          SHOW_PETS = !["0", "false"].includes(String(process.env.AOPC_PET_SHOW ?? "true").toLowerCase());
          PET_NAME = String(process.env.AOPC_PET_PET_NAME ?? "").trim();
          PHYSICS_POWER = Number(process.env.AOPC_PET_PHYSICS_POWER || "1") || 1;
          restartAllPets();
          return json(res, 200, { ok: true, rev: configRev });
        }
        case "POST /reload": {
          restartAllPets();
          return json(res, 200, { ok: true, rev: configRev });
        }
        case "POST /pet-display": {
          const body = await readBody(req);
          const pet = resolvePet(body.pet, res);
          if (!pet) return;
          const display = ["desktop", "none"].includes(body.display) ? body.display : "desktop";
          pet.cfg.display = display;
          syncPetWindows();
          return json(res, 200, { ok: true, display });
        }
        case "POST /open-url": {
          const body = await readBody(req);
          if (!/^https?:\/\//.test(String(body.url || ""))) return json(res, 400, { error: "http(s) url required" });
          require("electron").shell.openExternal(body.url);
          return json(res, 200, { ok: true });
        }
        case "GET /version":
          return json(res, 200, { version: PLUGIN_VERSION });
        case "GET /quit":
          return json(res, 200, { ok: true });
        case "POST /quit":
          json(res, 200, { ok: true });
          setTimeout(() => app.quit(), 50);
          return;
        default:
          return json(res, 404, { error: "no route", route });
      }
    } catch (error) {
      console.error("[pet] api error:", route, error);
      return json(res, 500, { error: error?.message ?? "internal" });
    }
  });
  return new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      apiPort = httpServer.address().port;
      resolve(apiPort);
    });
  });
}

function resolvePet(id, res) {
  const petId = id || config.pets.find((p) => p.display === "desktop")?.id;
  const pet = petId ? pets.get(petId) : null;
  if (!pet) {
    json(res, 404, { error: `pet not found: ${id ?? "(default)"}`, known: [...pets.keys()] });
    return null;
  }
  return pet;
}

// ---------------------------------------------------------------- 宠物互撞仲裁
// 渲染端飞行中逐帧上报 pose（含速度）；宿主 50ms 一拍检测重叠并交换冲量。
setInterval(() => {
  const flying = [...pets.values()].filter((p) => p.pose && Math.hypot(p.pose.vx ?? 0, p.pose.vy ?? 0) > 60);
  if (flying.length < 1) return;
  for (const a of flying) {
    for (const b of pets.values()) {
      if (a === b || !b.pose || !b.win) continue;
      const wa = a.cfg.size;
      const wb = b.cfg.size;
      const overlap =
        a.pose.x < b.pose.x + wb &&
        a.pose.x + wa > b.pose.x &&
        a.pose.y < b.pose.y + (wb * 9) / 16 &&
        a.pose.y + (wa * 9) / 16 > b.pose.y;
      if (!overlap) continue;
      const speed = Math.hypot(a.pose.vx, a.pose.vy);
      if (speed < 60) continue;
      const e = 0.995;
      const dx = a.pose.x - b.pose.x;
      const dirX = dx === 0 ? 1 : Math.sign(dx);
      const impulse = { vx: a.pose.vx * -e + dirX * speed * 0.3, vy: a.pose.vy * -e };
      a.win?.webContents.send("pet:impulse", impulse);
      b.win?.webContents.send("pet:impulse", { vx: dirX * speed * 0.15, vy: 0 });
      a.pose.vx = impulse.vx;
      a.pose.vy = impulse.vy;
    }
  }
}, 50).unref();

// ---------------------------------------------------------------- IPC
function wireIpc() {
  ipcMain.on("pet:pos", (event, { pet, x, y }) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (!target) return;
    void pet;
    if (process.env.AOPC_PET_DEBUG && !target._posLogged) {
      target._posLogged = true;
      console.log(`[pet] ${target.id} renderer pos IPC first seen: ${x},${y}`);
    }
    target.pose = { ...(target.pose || { facing: "left", vx: 0, vy: 0 }), x, y };
    const dims = petMetrics(target.cfg.size);
    target.win?.setPosition(Math.round(x - dims.mx), Math.round(y - dims.mt));
  });
  ipcMain.on("pet:pose", (event, payload) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (!target) return;
    target.pose = { x: payload.x, y: payload.y, facing: payload.facing ?? target.pose?.facing, vx: payload.vx ?? 0, vy: payload.vy ?? 0 };
    target.lastBodyBox = payload.bodyBox ?? target.lastBodyBox;
    target.rendererLockInput = Boolean(payload.inputBusy);
  });
  ipcMain.on("pet:cursor", (event, { inside }) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (!target || target.win?.isDestroyed()) return;
    target.ignoringMouse = !inside;
    if (inside) target.win.setIgnoreMouseEvents(false);
    else if (!target.rendererLockInput) target.win.setIgnoreMouseEvents(true, { forward: true });
  });
  ipcMain.on("pet:menu", (event) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (target) popupPetMenu(target);
  });
  ipcMain.on("pet:playback", (event, payload) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (target) target.lastPlayback = payload; // /playback/{id} 查询走 lastPlayback 简化实现
  });
  ipcMain.on("pet:anim-ended", (event, { name }) => {
    const target = [...pets.values()].find((p) => p.win?.webContents === event.sender);
    if (target) target.currentAnim = name;
  });
}

// ---------------------------------------------------------------- 单实例握手
async function probeExistingRuntime() {
  const saved = loadRuntimeState();
  if (!saved.apiPort || !saved.apiToken) return null;
  try {
    const res = await fetch(`http://127.0.0.1:${saved.apiPort}/quit`, {
      headers: { "x-aopc-pet-token": saved.apiToken },
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) return { port: saved.apiPort, token: saved.apiToken };
  } catch {
    // 不可达：上一次运行壳已退出
  }
  return null;
}

// ---------------------------------------------------------------- 启动
app.whenReady().then(async () => {
  const existing = await probeExistingRuntime();
  if (existing) {
    // 已有运行壳活着：直接把端口交给 MCP server，本进程退出
    console.log(`AOPC_PET_READY port=${existing.port} token=${existing.token}`);
    app.exit(0);
    return;
  }
  loadConfig();
  displays = buildDeskGeometry();
  wireIpc();
  screen.on("display-added", scheduleDisplays);
  screen.on("display-removed", scheduleDisplays);
  screen.on("display-metrics-changed", scheduleDisplays);
  await startHttpApi();
  if (AUTO_START) syncPetWindows();
  // 先落盘端口与 token（MCP server 的单实例握手与后续工具调用都要读），再广播 READY
  const saved = loadRuntimeState();
  saved.apiPort = apiPort;
  saved.apiToken = apiToken;
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(saved, null, 2));
  console.log(`AOPC_PET_READY port=${apiPort} token=${apiToken}`);
  rebuildTray();
  // macOS：不进 Dock（宠物应用没有主窗口语义）
  if (process.platform === "darwin" && app.dock) app.dock.hide();
});

app.on("window-all-closed", () => {
  // 隐藏全部宠物 / 重启销毁窗口都不能退出：运行壳生命周期由 MCP server 管理，显式退出只走托盘「退出」或 /quit
  saveRuntimeState();
});
app.on("before-quit", () => saveRuntimeState());
// 渲染端异常数据（如 NaN 坐标）不应打死宿主：记录并继续
process.on("uncaughtException", (error) => {
  console.error("[pet] uncaught exception:", error?.stack || error);
});
// 运行壳生命周期独立于拉起它的 MCP server：server 退出（禁用插件/会话结束）后，
// stdout/stderr 管道断裂会以 EPIPE 异常冒出，吞掉它让宠物继续存活
for (const stream of [process.stdout, process.stderr]) {
  stream?.on?.("error", (error) => {
    if (error?.code === "EPIPE") return;
    throw error;
  });
}
