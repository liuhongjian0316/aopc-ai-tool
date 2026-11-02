// 观己 · 数据层:路径解析、配置、状态缓存、事件真源
//
// 目录布局(${AOPC_PLUGIN_DATA} 下,由宿主注入):
//   state.json      观察器状态缓存(可由 events/ 重建)
//   config.json     用户开关(手动编辑;hooks 进程拿不到 user_config,故走文件)
//   events/<sid>.jsonl  事件真源(append-only,单行 JSON)
//   journal.jsonl   反思日志(L2 写,L3/L4 读)
//   self/self-model.md  自我模型;self/playbooks/  自我改写手册

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STATE_VERSION = 2;

export function dataRoot() {
  const d = process.env.AOPC_PLUGIN_DATA || "";
  if (d) return d;
  // 兜底:脱离宿主直跑(本地测试)时的默认位置;os.homedir() 跨平台(Win 用 USERPROFILE)
  return path.join(os.homedir(), ".aopc/cli/plugins/data/selfaware@aopc-ai-tool");
}

export const eventsDir = () => path.join(dataRoot(), "events");
export const statePath = () => path.join(dataRoot(), "state.json");
export const configPath = () => path.join(dataRoot(), "config.json");
export const journalPath = () => path.join(dataRoot(), "journal.jsonl");
export const missionPath = () => path.join(dataRoot(), "mission.json");
export const selfDir = () => path.join(dataRoot(), "self");
export const selfModelPath = () => path.join(selfDir(), "self-model.md");
export const playbooksDir = () => path.join(selfDir(), "playbooks");

/** rollout 目录:AOPC_PLUGIN_DATA = <cli>/plugins/data/<id> → <cli> = 上溯三级 */
export function rolloutDir() {
  const cfg = loadConfig();
  if (cfg.rolloutDir) return cfg.rolloutDir;
  return path.join(path.resolve(dataRoot(), "..", "..", ".."), "rollout");
}

export const DEFAULT_CONFIG = {
  injectBudget: true,
  injectErrorWarn: true,
  injectReflectNudge: true,
  injectCriticNudge: true,
  contextWindow: 200000,
  retentionDays: 90, // 0 = 永久保留;过期 events/*.jsonl 在 SessionStart 惰性清理
  budgetThrottle: { mid: 0.3, high: 0.6, critical: 0.85, midEveryTurns: 10 },
  reflectNudge: { minSegments: 8, minFailures: 3 },
  criticNudge: { atEdits: 10 },
  knowledgeBase: { path: "", folder: "观己学习", dailyLearning: true, autoCommit: true, autoPush: false },
};

export function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      budgetThrottle: { ...DEFAULT_CONFIG.budgetThrottle, ...(raw.budgetThrottle || {}) },
      reflectNudge: { ...DEFAULT_CONFIG.reflectNudge, ...(raw.reflectNudge || {}) },
      criticNudge: { ...DEFAULT_CONFIG.criticNudge, ...(raw.criticNudge || {}) },
      knowledgeBase: { ...DEFAULT_CONFIG.knowledgeBase, ...(raw.knowledgeBase || {}) },
    };
  } catch {
    return {
      ...DEFAULT_CONFIG,
      budgetThrottle: { ...DEFAULT_CONFIG.budgetThrottle },
      reflectNudge: { ...DEFAULT_CONFIG.reflectNudge },
      criticNudge: { ...DEFAULT_CONFIG.criticNudge },
      knowledgeBase: { ...DEFAULT_CONFIG.knowledgeBase },
    };
  }
}

export function emptySession(sid) {
  return {
    sid,
    startedAt: Date.now(),
    lastActiveAt: Date.now(),
    turns: 0,
    toolCalls: {},
    errors: {},
    streaks: {}, // tool -> { count, sig, warned, lastAt }
    segments: 0,
    rolloutOffset: 0,
    budget: null,
    samples: [],
    lastInject: { budgetTurn: -1, errorStreakKey: "" },
    failuresSinceReflect: 0,
    carried: 0,
    fileEdits: 0,
    trail: [], // 0.9.0:本会话预算轨迹 [{t, pct}](UserPromptSubmit 时追加,封顶 240 点)
    sub: false,
  };
}

export function loadState() {
  try {
    const j = JSON.parse(fs.readFileSync(statePath(), "utf8"));
    if (j && j.version === STATE_VERSION && j.sessions) return j;
  } catch {}
  return { version: STATE_VERSION, sessions: {}, reflect: { lastDeepAt: 0, lastLiteAt: 0 }, outstandingDebt: 0 };
}

/** 原子重写(temp + rename);并发 hook 进程 last-writer-wins 可接受 */
export function saveState(st) {
  // 只保留最近 50 个会话,防无限膨胀
  const entries = Object.values(st.sessions).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  if (entries.length > 50) {
    const keep = new Set(entries.slice(0, 50).map((s) => s.sid));
    for (const sid of Object.keys(st.sessions)) if (!keep.has(sid)) delete st.sessions[sid];
  }
  fs.mkdirSync(dataRoot(), { recursive: true });
  const tmp = statePath() + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(st));
  fs.renameSync(tmp, statePath());
}

export function sanitizeSid(s) {
  return String(s || "unknown").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
}

export function appendEvent(sid, ev) {
  fs.mkdirSync(eventsDir(), { recursive: true });
  ev.t = Date.now();
  ev.sid = sid;
  fs.appendFileSync(path.join(eventsDir(), sanitizeSid(sid) + ".jsonl"), JSON.stringify(ev) + "\n");
}

function parseLine(l) {
  try {
    return JSON.parse(l);
  } catch {
    return null;
  }
}

export function readEvents(sid, tail = Infinity) {
  try {
    const lines = fs.readFileSync(path.join(eventsDir(), sanitizeSid(sid) + ".jsonl"), "utf8").split("\n").filter(Boolean);
    const picked = tail === Infinity ? lines : lines.slice(-tail);
    return picked.map(parseLine).filter(Boolean);
  } catch {
    return [];
  }
}

export function listEventSids() {
  try {
    return fs.readdirSync(eventsDir()).filter((f) => f.endsWith(".jsonl")).map((f) => f.slice(0, -".jsonl".length));
  } catch {
    return [];
  }
}

// ---------- 使命(0.9.0:跨会话的持久目标意识——自主运营场景的地基) ----------

const MISSION_LOG_CAP = 200;

export function readMission() {
  try {
    const j = JSON.parse(fs.readFileSync(missionPath(), "utf8"));
    if (j && typeof j === "object") return { active: j.active || null, log: Array.isArray(j.log) ? j.log : [] };
  } catch {}
  return { active: null, log: [] };
}

export function writeMission(m) {
  fs.mkdirSync(dataRoot(), { recursive: true });
  m.log = (m.log || []).slice(-MISSION_LOG_CAP);
  const tmp = missionPath() + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2) + "\n");
  fs.renameSync(tmp, missionPath());
}

export function missionDay(active) {
  if (!active?.startedAt) return 0;
  return Math.max(1, Math.floor((Date.now() - active.startedAt) / 86400000) + 1);
}
