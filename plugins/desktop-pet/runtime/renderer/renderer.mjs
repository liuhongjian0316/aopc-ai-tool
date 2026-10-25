// 渲染端：动画引擎 + 物理交互。功能语义复刻 dsh-pet client/pet.ts（浏览器端），
// 事件通道从 HTTP 长轮询换成 Electron IPC；物理与随机链用移植的 shared-core（与上游一致）。
import {
  HIT_BOX,
  PET_REF_WIDTH,
  DRAG_THRESHOLD,
  SLINGSHOT_DOUBLE_MS,
  TRAIL_KEEP_MS,
  trimTrail,
  estimateReleaseVelocity,
  throwVelocity,
  throwStepRegion,
  throwSubsteps,
  throwSpace,
  throwBoundsIn,
  springStep,
  squashScale,
  landingSquash,
  rollKind,
  pickCategoryAction,
  pickSlot,
  slingshotPower,
  pullAngle,
  slingshotVelocity,
} from "../../shared/dist/shared-core.mjs";
import { BuiltinPainter, BUILTIN_DURATIONS } from "./builtin-pet.mjs";

const stage = document.getElementById("stage");
const bubbleEl = document.getElementById("bubble");
const tooltipEl = document.getElementById("tooltip");

// 悬浮名字提示：优先光标右下，装不下翻左侧/上方，越界夹回（dsh tooltipPlacement 同款）
function showNameTip(clientX, clientY) {
  if (!session) return;
  tooltipEl.textContent = session.pet.name || session.pet.id;
  tooltipEl.classList.add("show");
  const gap = session.pet.size * 0.022;
  const w = tooltipEl.offsetWidth;
  const h = tooltipEl.offsetHeight;
  const maxX = window.innerWidth;
  const maxY = window.innerHeight;
  let x = clientX + gap;
  if (x + w > maxX) x = clientX - gap - w;
  x = Math.min(Math.max(x, 0), Math.max(0, maxX - w));
  let y = clientY + gap;
  if (y + h > maxY) y = clientY - gap - h;
  y = Math.min(Math.max(y, 0), Math.max(0, maxY - h));
  tooltipEl.style.left = x + "px";
  tooltipEl.style.top = y + "px";
}
function hideNameTip() {
  tooltipEl.classList.remove("show");
}

let session = null; // { pet, animations, physics, weights, displays, pack }
let facing = "left";
let currentAnim = null;
let currentClip = null; // { kind, name, loop, finite, painter?, video? , duration, startedAt, src }
let workStatusTier = null; // { eventName, tier, state }
let lockUntil = 0;

let displays = null;
let space = null; // throwSpace（逐屏 AABB）
const pos = { x: 0, y: 0, vx: 0, vy: 0 };
let mode = "idle"; // idle | drag | throw | line
let drag = null; // { grabOffsetX, grabOffsetY, trail[], lastKindTs, moved }
let linePlan = null; // { from{x,y}, to{x,y}, durationMs, startedAt, animName }
let lastBodyInside = false;
let squashRaf = null;
let squashToken = 0;
// Q 弹挤压（dsh startSquash 同构）：前台元素垂直压扁（贴地锚定）再回弹，曲线 = squashScale
function startSquash(el, depth = 0.55) {
  if (reducedMotion) return;
  const token = ++squashToken;
  if (squashRaf) cancelAnimationFrame(squashRaf);
  el.style.transformOrigin = "bottom";
  const t0 = performance.now();
  const step = () => {
    if (token !== squashToken) return;
    const u = Math.min((performance.now() - t0) / 220, 1);
    el.style.transform = `scaleY(${squashScale(u, depth)})`;
    if (u < 1) squashRaf = requestAnimationFrame(step);
    else {
      squashRaf = null;
      el.style.transformOrigin = "";
      el.style.transform = "";
    }
  };
  squashRaf = requestAnimationFrame(step);
}
function frontElement() {
  return currentClip?.kind === "builtin" ? builtinCanvas : frontVideo === "A" ? videoA : frontVideo === "B" ? videoB : null;
}
let reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------- 画布 / 视频载体
const builtinCanvas = document.createElement("canvas");
builtinCanvas.width = 640;
builtinCanvas.height = 360;
stage.appendChild(builtinCanvas);
const painter = new BuiltinPainter(builtinCanvas.getContext("2d"));

const videoA = document.createElement("video");
const videoB = document.createElement("video");
for (const v of [videoA, videoB]) {
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  stage.appendChild(v);
}
let frontVideo = null; // 'A' | 'B'
let lastVideoName = null;

// ---------------------------------------------------------------- 几何换算
// 窗口 = 宠物包围盒 + 气泡余量（mx/mt/mb 由宿主下发）。所有 clientX/Y 都是窗口局部：
// 宠物包围盒局部坐标 = client - 边距；命中框上报为窗口局部（主进程兜底轮询直接用）。
function bodyBoxWindowLocal() {
  const s = session.pet.size / 640;
  const h = (session.pet.size * 9) / 16;
  return {
    x: session.mx + (HIT_BOX.x0 / 640) * session.pet.size,
    y: session.mt + (HIT_BOX.y0 / 360) * h,
    w: ((HIT_BOX.x1 - HIT_BOX.x0) / 640) * session.pet.size,
    h: ((HIT_BOX.y1 - HIT_BOX.y0) / 360) * h,
  };
}
function hitBoxPx() {
  return bodyBoxWindowLocal();
}
function eventBoxPx() {
  return bodyBoxWindowLocal();
}
function reportPose(inputBusy = mode === "drag") {
  window.petHost.pose({
    x: pos.x,
    y: pos.y,
    facing,
    vx: pos.vx,
    vy: pos.vy,
    bodyBox: bodyBoxWindowLocal(),
    inputBusy,
  });
}
function moveWindow() {
  window.petHost.pos(pos.x, pos.y);
}

// ---------------------------------------------------------------- 动画引擎
function isFiniteClip(name) {
  const a = session.animations;
  return (
    a.clicks.includes(name) ||
    a.categories.some((c) => c.actions.includes(name)) ||
    a.moves.actions.some((m) => m.name === name) ||
    a.turn.includes(name)
  );
}
function eventSlots(name) {
  return session.animations.events?.[name] ?? null;
}

function stopCurrentClip() {
  if (currentClip?.video) {
    currentClip.video.onended = null;
    currentClip.video.pause();
    currentClip.video.classList.remove("is-front");
  }
  currentClip = null;
}

function playBuiltin(name, { loop = false, duration = null } = {}, seq = null) {
  if (seq !== null && seq !== playSeq) return null; // 已有更新的播放请求，本次作废
  stopCurrentClip();
  builtinCanvas.classList.add("is-front");
  for (const v of [videoA, videoB]) v.classList.remove("is-front");
  frontVideo = null;
  painter.start(name);
  currentClip = {
    kind: "builtin",
    name,
    loop,
    duration: loop ? null : (duration ?? BUILTIN_DURATIONS[name] ?? null),
    startedAt: performance.now(),
  };
  currentAnim = name;
  window.petHost.animEnded(name);
  return currentClip;
}

let playSeq = 0; // 播放代序号：连续触发播放时，旧的加载/回落一律作废（防 video 抢占竞态）

async function play(name, { loop = false, url = null } = {}) {
  const seq = ++playSeq;
  if (session.packType === "builtin" && !url) return playBuiltin(name, { loop }, seq);
  return playVideo(name, { loop, url }, seq);
}

async function playVideo(name, { loop = false, url = null } = {}, seq = null) {
  const idleVideo = frontVideo === "A" ? videoB : videoA;
  const frontEl = frontVideo === "A" ? videoA : frontVideo === "B" ? videoB : null;
  // 扩展名回退链：macOS 先试 HEVC-alpha .mov，失败退 VP9-alpha .webm（dsh 素材发布格式），再退内置画布
  const candidates = url
    ? [url]
    : navigator.platform.toLowerCase().includes("mac")
      ? [".mov", ".webm"]
      : [".webm"];
  const base = `${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/webm/${encodeURIComponent(name)}`;
  let loadedSrc = null;
  for (const candidate of candidates) {
    if (seq !== null && seq !== playSeq) return null; // 过期请求：立即放弃，不做任何切换
    const src = url ?? base + candidate;
    try {
      idleVideo.src = src;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("load timeout")), 10000);
        idleVideo.onloadeddata = () => {
          clearTimeout(timer);
          resolve();
        };
        idleVideo.onerror = () => {
          clearTimeout(timer);
          reject(new Error("video load failed"));
        };
        idleVideo.load();
      });
      loadedSrc = src;
      break;
    } catch {
      idleVideo.onerror = null;
      idleVideo.onloadeddata = null;
    }
  }
  if (seq !== null && seq !== playSeq) return null;
  if (!loadedSrc) {
    console.warn("[pet] video missing for", name, "→ builtin fallback");
    return playBuiltin(name, { loop }, seq);
  }
  if (frontEl) {
    frontEl.onended = null;
    frontEl.pause();
    frontEl.classList.remove("is-front");
  }
  // 视频接管画面：清掉可能残留的内置画布标记（此前回落会把它点亮且从不清除）
  builtinCanvas.classList.remove("is-front");
  idleVideo.classList.add("is-front");
  frontVideo = idleVideo === videoA ? "A" : "B";
  idleVideo.loop = loop;
  currentClip = { kind: "video", name, loop, video: idleVideo, startedAt: performance.now() };
  currentAnim = name;
  lastVideoName = name;
  window.petHost.animEnded(name);
  try {
    await idleVideo.play();
  } catch (error) {
    console.warn("[pet] video play() rejected:", name, error?.name);
  }
  return currentClip;
}

// 播完一个 once 动画后的下一步（随机动画链，语义同 dsh pickNext）
async function afterOnce(name) {
  if (lockUntil > Date.now()) {
    await play(session.animations.idle[0] || "待机", { loop: true });
    return;
  }
  // 状态动画优先（工作状态非终态档循环）
  if (workStatusTier) {
    await playWorkStatus();
    return;
  }
  const kind = reducedMotion
    ? "idle"
    : rollKind(Math.random(), session.weights, { fixed: session.pet.fixedEnabled === true });
  if (kind === "idle") {
    await play(pick(session.animations.idle, currentAnim) || "待机", { loop: true });
    return;
  }
  if (kind === "turn") {
    facing = facing === "left" ? "right" : "left";
    const turnAnim = pick(session.animations.turn, currentAnim) || "转身";
    await play(turnAnim, { loop: false });
    return;
  }
  if (kind === "move") {
    const planned = planMove();
    if (!planned) {
      await afterOnce(name); // 越界回落再抽
      return;
    }
    startLine(planned);
    return;
  }
  // 分类动作（pickCategoryAction 内含 noMirror/facing 过滤与权重抽取）
  const chosen = pickCategoryAction(session.animations.categories, session.animations.idle, facing, currentAnim);
  await play(chosen.name, { loop: false });
}

function pick(pool, exclude) {
  const list = (pool || []).filter(Boolean);
  if (list.length === 0) return null;
  const filtered = list.length > 1 && exclude ? list.filter((p) => p !== exclude) : list;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function rollCategory(categories) {
  const total = categories.reduce((s, c) => s + (c.weight || 0), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const c of categories) {
    roll -= c.weight || 0;
    if (roll <= 0) {
      // noMirror 分类在 facing=right 时跳过（素材镜像会颠倒），语义同 dsh
      if (c.noMirror && facing === "right") continue;
      return c;
    }
  }
  return categories[0];
}

function planMove() {
  const moves = session.animations.moves;
  const action = pick(moves.actions);
  if (!action) return null;
  const scale = session.pet.size / PET_REF_WIDTH;
  const dflt = moves.default || {};
  const minDist = (dflt.minDist ?? 60) * scale;
  const maxDist = (dflt.maxDist ?? 240) * scale;
  const dist = minDist + Math.random() * Math.max(maxDist - minDist, 0);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const bounds = throwBoundsIn(displays.areas[screenIndexOf(pos)], session.pet.size, 20);
  let targetX = pos.x + dir * dist;
  if (targetX < bounds.minX || targetX > bounds.maxX) targetX = pos.x - dir * dist;
  if (targetX < bounds.minX || targetX > bounds.maxX) return null;
  return { to: { x: targetX, y: pos.y }, durationMs: (dflt.duration ?? 3) * 1000, animName: action.name };
}

function screenIndexOf(p) {
  if (!displays) return 0;
  const cx = p.x + session.pet.size / 2;
  const cy = p.y + (session.pet.size * 9) / 16 / 2;
  const i = displays.areas.findIndex((r) => cx >= r.x && cx < r.x + r.width && cy >= r.y && cy < r.y + r.height);
  return i >= 0 ? i : 0;
}

function startLine({ to, durationMs, animName }) {
  mode = "line";
  linePlan = { from: { ...pos }, to, durationMs, startedAt: performance.now(), animName };
  play(animName || "溜达", { loop: true });
  facing = to.x >= pos.x ? "right" : "left";
}

async function playWorkStatus() {
  if (!workStatusTier) return;
  const slots = eventSlots("workStatus");
  if (!slots) return;
  const slot = slots[Math.min(workStatusTier.tier, slots.length - 1)];
  const name = pickSlot(slot, currentAnim);
  if (!name) return;
  const terminal = ["result", "success", "error"].includes(workStatusTier.state);
  await play(name, { loop: !terminal });
}

// ---------------------------------------------------------------- 气泡（dsh 风格卡：图 + 文 + 复制）
let bubbleTimer = null;
let bubbleText = "";

function showBubble({ text, image, duration = 10000, variant = "say" }) {
  if (!text) {
    hideBubble();
    return;
  }
  bubbleText = text;
  bubbleEl.innerHTML = "";
  bubbleEl.classList.toggle("dsh-whisper", variant === "whisper");
  if (image && /^https?:\/\//.test(image)) {
    const img = document.createElement("img");
    img.className = "pet-bub-img";
    img.src = image;
    img.alt = "";
    bubbleEl.appendChild(img);
    bubbleEl.classList.add("has-img");
  } else {
    bubbleEl.classList.remove("has-img");
  }
  const textEl = document.createElement("div");
  textEl.className = "pet-bub-text";
  textEl.textContent = text;
  bubbleEl.appendChild(textEl);
  // 字号锚：--f = 宠物宽 × 0.0455（dsh 原系数），整个卡片的尺寸随宠物缩放
  bubbleEl.style.setProperty("--f", session.pet.size * 0.0455 + "px");
  bubbleEl.classList.add("show");
  clearTimeout(bubbleTimer);
  if (duration > 0) {
    bubbleTimer = setTimeout(hideBubble, duration);
  }
}
// 消失动画：先淡出（.25s，dsh is-fading 同款两段式），动画结束再摘 show
function hideBubble() {
  if (!bubbleEl.classList.contains("show")) return;
  bubbleEl.classList.add("is-fading");
  setTimeout(() => {
    bubbleEl.classList.remove("show");
    bubbleEl.classList.remove("is-fading");
  }, 260);
}

// ---------------------------------------------------------------- 物理：rAF 循环
let lastFrame = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  // 内置画布：持续推进并重绘（Q 弹统一由元素级 transform 承担）
  if (currentClip?.kind === "builtin") {
    const elapsed = (now - currentClip.startedAt) / 1000;
    painter.draw(elapsed, facing, 1);
    if (!currentClip.loop && currentClip.duration && elapsed * 1000 >= currentClip.duration) {
      const done = currentClip.name;
      currentClip = null;
      onClipEnded(done);
    }
  }

  if (mode === "drag" && drag) {
    // 过阻尼弹簧跟手（手感与 dsh 一致）；目标异常时跳过本帧（防 NaN 传染窗口坐标）
    if (!Number.isFinite(drag.targetX) || !Number.isFinite(drag.targetY)) {
      reportPose(true);
      return;
    }
    const power = session.physics?.throwPower ?? 1;
    pos.vx = springStep(pos.vx, pos.x, drag.targetX, dt, power);
    pos.vy = springStep(pos.vy, pos.y, drag.targetY, dt, power);
    pos.x += pos.vx * dt;
    pos.y += pos.vy * dt;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      pos.x = drag.targetX;
      pos.y = drag.targetY;
      pos.vx = 0;
      pos.vy = 0;
    }
    moveWindow();
    reportPose(true);
    return;
  }
  if (mode === "throw") {
    const steps = throwSubsteps(pos.vx, pos.vy, dt);
    const sub = dt / steps;
    let landed = false;
    for (let i = 0; i < steps; i++) {
      const result = throwStepRegion(pos, sub, space, session.physics, session.pet.confineToScreen ? screenIndexOf(pos) : -1);
      pos.x = result.x;
      pos.y = result.y;
      pos.vx = result.vx;
      pos.vy = result.vy;
      if (result.bounced && !landed && result.atRest === false) {
        // 落地 Q 弹：按冲击速度映射下压幅度（dsh 同款：元素级，贴地锚定）
        const impact = Math.abs(result.vy) || Math.hypot(pos.vx, pos.vy);
        const el = frontElement();
        if (el) startSquash(el, landingSquash(impact));
      }
      if (result.atRest) {
        landed = true;
        break;
      }
    }
    moveWindow();
    reportPose(false);
    if (landed) {
      mode = "idle";
      pos.vx = 0;
      pos.vy = 0;
      reportPose(false);
      if (currentClip?.kind !== "builtin" || !currentClip.loop) afterOnce(currentAnim);
    }
    return;
  }
  if (mode === "line" && linePlan) {
    const t = Math.min((now - linePlan.startedAt) / linePlan.durationMs, 1);
    pos.x = linePlan.from.x + (linePlan.to.x - linePlan.from.x) * t;
    pos.y = linePlan.from.y + (linePlan.to.y - linePlan.from.y) * t;
    moveWindow();
    reportPose(false);
    if (t >= 1) {
      const done = linePlan.animName;
      linePlan = null;
      mode = "idle";
      onClipEnded(done);
    }
    return;
  }
  // 静止时低频上报（点击穿透兜底依赖 bodyBox）
  reportPose(false);
}

function onClipEnded(name) {
  // once 动画播完 → 随机链
  afterOnce(name);
}

// ---------------------------------------------------------------- 抛掷
function startThrow(angle, power) {
  const v = throwVelocity(angle, power * (session.physics?.throwPower ?? 1));
  mode = "throw";
  pos.vx = v.vx;
  pos.vy = v.vy;
  space = throwSpace({
    areas: displays.areas,
    panels: displays.panels,
    size: session.pet.size,
    sideAllow: 20,
  });
  // 抛掷中播拖拽/惊呼表情：取 drag 池首个循环
  play(session.animations.drag[0] || "拖拽", { loop: true });
}

// ---------------------------------------------------------------- 输入
stage.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const now = performance.now();
  const box = eventBoxPx();
  const inBox = e.clientX >= box.x && e.clientX <= box.x + box.w && e.clientY >= box.y && e.clientY <= box.y + box.h;
  if (!inBox) return;
  if (lockUntil > Date.now()) {
    lockUntil = 0;
    window.petHost.pose({ ...pos, facing, bodyBox: hitBoxPx(), inputBusy: false });
  }
  // 飞行中抓取：立即停掉抛掷/漫游（dsh 语义：空中可随时抓住）
  if (mode === "throw" || mode === "line") {
    mode = "idle";
    linePlan = null;
    pos.vx = 0;
    pos.vy = 0;
  }
  // 弹弓判定：两次按下间隔 < SLINGSHOT_DOUBLE_MS（按下即记、按下即比，语义同 dsh）
  const isSlingshot = drag?.lastDownTs && now - drag.lastDownTs < SLINGSHOT_DOUBLE_MS;
  drag = {
    // 抓取偏移用「宠物包围盒局部」坐标（与 screenX/screenY 同口径），否则弹簧目标恒差一个边距
    grabOffsetX: e.clientX - session.mx,
    grabOffsetY: e.clientY - session.mt,
    // 弹簧目标立刻初始化为当前窗口位置（原地抓住不跳变），否则 tick 的 drag 分支会算出 NaN
    targetX: screenX(e) - (e.clientX - session.mx),
    targetY: screenY(e) - (e.clientY - session.mt),
    trail: [{ t: Date.now(), x: screenX(e), y: screenY(e) }],
    lastDownTs: now,
    moved: false,
    slingshot: Boolean(isSlingshot),
    slingshotStart: { x: screenX(e), y: screenY(e) },
  };
  if (mode !== "drag") {
    mode = "drag";
    hideNameTip();
    if (session.packType === "video") {
      stage.style.cursor = `url("${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/pic/${encodeURIComponent("cursor-grabbing.png")}") 12 12, grabbing`;
    }
    play(pick(session.animations.drag) || "拖拽", { loop: true });
  }
});

window.addEventListener("pointermove", (e) => {
  if (!session) return;
  const box = eventBoxPx();
  const inside = e.clientX >= box.x && e.clientX <= box.x + box.w && e.clientY >= box.y && e.clientY <= box.y + box.h;
  if (inside !== lastBodyInside) {
    lastBodyInside = inside;
    window.petHost.cursor(inside);
    // dsh 同款：悬浮宠物显示名字胶囊；离开即隐藏（不重放旧碎碎念）
    if (inside) showNameTip(e.clientX, e.clientY);
    else tooltipEl.classList.remove("show");
  } else if (inside) {
    showNameTip(e.clientX, e.clientY); // 跟随光标（原生 title 的摆法）
  }
  if (mode !== "drag" || !drag) return;
  drag.trail.push({ t: Date.now(), x: screenX(e), y: screenY(e) });
  drag.trail = trimTrail(drag.trail, Date.now());
  if (Math.hypot(e.clientX - drag.grabOffsetX, e.clientY - drag.grabOffsetY) > DRAG_THRESHOLD) drag.moved = true;
  drag.targetX = screenX(e) - drag.grabOffsetX;
  drag.targetY = screenY(e) - drag.grabOffsetY;
});

window.addEventListener("pointerup", (e) => {
  if (mode !== "drag" || !drag) return;
  const trail = drag.trail;
  const wasSlingshot = drag.slingshot && drag.moved;
  const slingshotStart = drag.slingshotStart;
  const moved = drag.moved;
  drag = null;

  if (wasSlingshot) {
    // 弹弓：力度 = 拉距（slingshotPower 随宠物大小缩放），方向 = 拉的反方向（pullAngle），无速度上限
    const dx = screenX(e) - slingshotStart.x;
    const dy = screenY(e) - slingshotStart.y;
    const power = slingshotPower(Math.hypot(dx, dy), session.pet.size);
    const angle = pullAngle(dx, dy);
    mode = "idle";
    const v = slingshotVelocity(angle, Math.max(0.1, power), session.physics?.throwPower ?? 1);
    mode = "throw";
    pos.vx = v.vx;
    pos.vy = v.vy;
    space = throwSpace({ areas: displays.areas, panels: displays.panels, size: session.pet.size, sideAllow: 20 });
    play(session.animations.drag[0] || "拖拽", { loop: true });
    return;
  }
  if (session.packType === "video") {
    stage.style.cursor = `url("${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/pic/${encodeURIComponent("cursor-grab.png")}") 12 12, grab`;
  }
  const release = estimateReleaseVelocity(trail, Date.now(), session.physics);
  if (release && moved) {
    mode = "idle";
    startThrow(
      (Math.atan2(-release.vy, release.vx) * 180) / Math.PI,
      Math.hypot(release.vx, release.vy) / 1200 / (session.physics?.throwPower ?? 1),
    );
    return;
  }
  // 原地放下。没拖动 = click 事件马上会到（点击回应由 click 处理器负责），
  // 这里不再启动随机链，否则竞态会把点击动画盖掉
  mode = "idle";
  pos.vx = 0;
  pos.vy = 0;
  if (moved) afterOnce(currentAnim);
});

stage.addEventListener("click", (e) => {
  if (mode !== "idle") return;
  const box = eventBoxPx();
  const inBox = e.clientX >= box.x && e.clientX <= box.x + box.w && e.clientY >= box.y && e.clientY <= box.y + box.h;
  if (!inBox) return;
  playClickSound();
  const name = pick(session.animations.clicks) || "点击弹跳";
  const sqEl = frontElement();
  if (sqEl) startSquash(sqEl, 0.55);
  play(name, { loop: false });
});

// 点击音效：包里有 sound/click-duck.wav 就播（dsh 同款），失败静默
function playClickSound() {
  if (session.packType !== "video") return;
  try {
    const audio = new Audio(`${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/sound/click-duck.wav`);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

stage.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.petHost.openMenu();
});

// 屏幕坐标（全局 px）= 包围盒左上角 + 窗口内偏移（窗口局部 → 包围盒局部要扣边距）
function screenX(e) {
  return pos.x + (e.clientX - session.mx);
}
function screenY(e) {
  return pos.y + (e.clientY - session.mt);
}

// ---------------------------------------------------------------- 宿主事件接线
let lastThrowSeq = 0;
let lastAnimCounter = 0;
let lastSayCounter = 0;
let lastPositionCounter = 0;

window.petHost.onInit((payload) => {
  session = {
    pet: payload.pet,
    animations: payload.animations,
    physics: payload.physics,
    weights: payload.weights,
    displays: payload.displays,
    margins: payload.margins || { mx: 0, mt: 0, mb: 0 },
    apiBase: `http://127.0.0.1:${payload.apiPort}`,
    apiToken: payload.apiToken,
    packType: payload.pet.pack === "builtin" || !payload.pet.pack ? "builtin" : "video",
  };
  facing = "left";
  session.mx = session.margins.mx;
  session.mt = session.margins.mt;
  session.mb = session.margins.mb;
  applyDisplays(payload.displays);
  // 布局变量 + 软糖体（dsh 官方字体，随包分发；builtin 包无字体走系统回退栈）
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--mx", session.margins.mx + "px");
  rootStyle.setProperty("--mt", session.margins.mt + "px");
  rootStyle.setProperty("--mb", session.margins.mb + "px");
  rootStyle.setProperty("--pw", session.pet.size + "px");
  rootStyle.setProperty("--ph", Math.round((session.pet.size * 9) / 16) + "px");
  if (session.packType === "video") {
    stage.style.cursor = `url("${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/pic/${encodeURIComponent("cursor-grab.png")}") 12 12, grab`;
    const fontUrl = `${session.apiBase}/pack/${encodeURIComponent(session.pet.pack)}/fonts/${encodeURIComponent("上首软糖体.ttf")}`;
    const fontCss = document.createElement("style");
    fontCss.textContent = `@font-face{font-family:"ShangshouSoftCandy";src:url('${fontUrl}') format("truetype");font-display:swap;font-weight:400}`;
    document.head.appendChild(fontCss);
  }
  requestAnimationFrame(tick);
  // 首帧待机
  play(session.animations.idle[0] || "待机", { loop: true });
});

window.petHost.onDisplays((d) => applyDisplays(d));

function applyDisplays(d) {
  displays = d;
  space = throwSpace({
    areas: displays.areas,
    panels: displays.panels,
    size: session?.pet.size ?? 150,
    sideAllow: 20,
  });
}

window.petHost.onState((leaves) => {
  if (!session) return;
  if (leaves.say && leaves.say.counter > lastSayCounter) {
    lastSayCounter = leaves.say.counter ?? lastSayCounter;
    const data = leaves.say.data;
    if (!data || data.kind === "clear") clearBubble();
    else showBubble(data);
  }
  if (leaves.anim && leaves.anim.counter !== lastAnimCounter) {
    lastAnimCounter = leaves.anim.counter;
    const a = leaves.anim.data;
    if (a) {
      if (a.facing) facing = a.facing;
      play(a.name ?? null, { loop: a.once === false, url: a.url ?? null });
    }
  }
  if (leaves.throwLeaf && leaves.throwLeaf.counter > lastThrowSeq) {
    lastThrowSeq = leaves.throwLeaf.counter;
    const t = leaves.throwLeaf.data;
    if (t?.angle != null) startThrow(Number(t.angle), Number(t.power ?? 1));
  }
  if (leaves.lock) {
    const l = leaves.lock.data;
    lockUntil = l?.locked ? (l.expiresAt ?? Date.now() + 30000) : 0;
  }
});

window.petHost.onPosition((p) => {
  if (!session) return;
  if (p.facing) facing = p.facing;
  if (p.mode === "instant") {
    pos.x = p.x;
    pos.y = p.y;
    pos.vx = 0;
    pos.vy = 0;
    moveWindow();
  } else if (p.mode === "spring") {
    mode = "throw"; // 复用抛物物理？不——spring 用 drag 弹簧，但无指针轨迹；直接弹簧跟随
    mode = "line";
    linePlan = { from: { ...pos }, to: { x: p.x, y: p.y }, durationMs: 600, startedAt: performance.now(), animName: currentAnim };
  } else {
    mode = "line";
    linePlan = { from: { ...pos }, to: { x: p.x, y: p.y }, durationMs: 1500, startedAt: performance.now(), animName: "溜达" };
    play("溜达", { loop: true });
  }
});

window.petHost.onThrow(({ angle, power }) => startThrow(angle, power));
window.petHost.onImpulse((impulse) => {
  mode = "throw";
  pos.vx = impulse.vx;
  pos.vy = impulse.vy;
  space = throwSpace({ areas: displays.areas, panels: displays.panels, size: session.pet.size, sideAllow: 20 });
});
window.petHost.onFace((f) => {
  facing = f;
});

// 工作状态：宿主把档位动画写进 anim 叶子（once:false 循环），渲染端无需独立通道。
// 汇报动画结束（内置 clip 走完后由 tick 调 onClipEnded；视频由 ended 事件驱动）。
for (const v of [videoA, videoB]) {
  v.addEventListener("ended", () => {
    if (currentClip?.video === v) {
      const done = currentClip.name;
      currentClip = null;
      onClipEnded(done);
    }
  });
}
