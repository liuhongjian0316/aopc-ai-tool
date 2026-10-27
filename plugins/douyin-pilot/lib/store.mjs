/**
 * 本地数据存储：${AOPC_PLUGIN_DATA}/douyin-pilot/ 下的 JSON 文件。
 * 原子写入（tmp + rename），供账号凭证、发布队列、数据快照、私信规则共用。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DATA_DIR = process.env.AOPC_PLUGIN_DATA
  ? join(process.env.AOPC_PLUGIN_DATA, "douyin-pilot")
  : join(homedir(), ".aopc", "douyin-pilot");

const FILES = {
  config: "config.json",
  accounts: "accounts.json",
  queue: "queue.json",
  snapshots: "snapshots.json",
  dmRules: "dm-rules.json",
};

function path(name) {
  return join(DATA_DIR, FILES[name] ?? name);
}

export function readJSON(name, fallback) {
  const p = path(name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (err) {
    console.error(`[douyin-pilot] ${p} 解析失败，使用默认值：${err.message}`);
    return fallback;
  }
}

export function writeJSON(name, value) {
  mkdirSync(DATA_DIR, { recursive: true });
  const p = path(name);
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, p);
}

/* ---------------- 配置 ---------------- */

export function defaultConfig() {
  return {
    clientKey: process.env.DOUYIN_CLIENT_KEY || "",
    clientSecret: process.env.DOUYIN_CLIENT_SECRET || "",
    redirectUri: process.env.DOUYIN_REDIRECT_URI || "http://127.0.0.1:8765/callback",
    scopes: process.env.DOUYIN_SCOPES || "user_info,video.create,video.data,video.list,comment.list,comment.manage",
    apiMode: process.env.DOUYIN_API_MODE === "legacy" ? "legacy" : "v1",
    dailyPublishCap: Number(process.env.DOUYIN_DAILY_PUBLISH_CAP || 5),
    minPublishIntervalMin: Number(process.env.DOUYIN_MIN_PUBLISH_INTERVAL_MIN || 30),
  };
}

/** 配置优先级：config.json（dy_config_set 写入）> 插件 userConfig 环境变量 > 默认值。 */
export function loadConfig() {
  const saved = readJSON("config", {});
  return { ...defaultConfig(), ...saved };
}

/* ---------------- 账号 ---------------- */

export function loadAccounts() {
  return readJSON("accounts", {});
}

export function saveAccount(account) {
  const all = loadAccounts();
  all[account.openId] = { ...all[account.openId], ...account, updatedAt: new Date().toISOString() };
  writeJSON("accounts", all);
  return all[account.openId];
}

/* ---------------- 发布队列 ---------------- */

export function loadQueue() {
  return readJSON("queue", { tasks: [] });
}

export function saveQueue(queue) {
  writeJSON("queue", queue);
}

/** 当日已发布条数与最近一次发布时间（风控守卫用）。 */
export function publishGuardStats(openId) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = loadQueue().tasks.filter(
    (t) => t.accountId === openId && t.status === "published" && (t.publishedAt ?? "").slice(0, 10) === today
  );
  const times = tasks.map((t) => Date.parse(t.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a);
  return { publishedToday: tasks.length, lastPublishedAt: times[0] ?? null };
}

/* ---------------- 数据快照 ---------------- */

export function loadSnapshots() {
  return readJSON("snapshots", {});
}

export function saveSnapshot(dateKey, value) {
  const all = loadSnapshots();
  all[dateKey] = { ...(all[dateKey] ?? {}), ...value, savedAt: new Date().toISOString() };
  writeJSON("snapshots", all);
  return all[dateKey];
}

/* ---------------- 私信规则 ---------------- */

export function loadDmRules() {
  return readJSON("dmRules", { rules: [] });
}

export function saveDmRules(value) {
  writeJSON("dmRules", value);
}
