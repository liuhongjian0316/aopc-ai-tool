/**
 * 网关侧 RPA worker 客户端：按需 spawn rpa/worker.mjs，换行 JSON 协议通信。
 * worker 常驻（浏览器不重复启动）；网关进程退出时一并回收。
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR } from "./store.mjs";

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const RPA_DIR = join(PLUGIN_ROOT, "rpa");

export const PLUGIN_ROOT_DIR = PLUGIN_ROOT;
export const rpaDir = () => RPA_DIR;
export const rpaProfileDir = () => join(DATA_DIR, "rpa-profile");
export const rpaDebugDir = () => join(DATA_DIR, "rpa-debug");

export function rpaInstalled() {
  return existsSync(join(RPA_DIR, "node_modules", "playwright"));
}

export function rpaInstallHint() {
  return [
    "RPA 通道依赖 Playwright，尚未安装。两种方式：",
    `1) 对 Agent 说「安装抖音 RPA 依赖」（会调用 dy_rpa_setup，自动走国内镜像）`,
    `2) 手动执行：`,
    `   cd ${RPA_DIR}`,
    `   npm install --registry=https://registry.npmmirror.com`,
    `   PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright npx playwright install chromium`,
  ].join("\n");
}

let proc = null;
let seq = 0;
const pending = new Map();
let buffer = "";

function ensureProc() {
  if (proc && proc.exitCode === null) return proc;
  if (!existsSync(join(RPA_DIR, "worker.mjs"))) throw new Error(`找不到 RPA worker：${join(RPA_DIR, "worker.mjs")}`);
  pending.clear();
  buffer = "";
  proc = spawn(process.execPath, [join(RPA_DIR, "worker.mjs")], {
    env: {
      ...process.env,
      DOUYIN_RPA_PROFILE_DIR: rpaProfileDir(),
      DOUYIN_RPA_DEBUG_DIR: rpaDebugDir(),
      DOUYIN_RPA_HEADLESS: process.env.DOUYIN_RPA_HEADLESS || "false",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  proc.stdout.setEncoding("utf-8");
  proc.stdout.on("data", (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        clearTimeout(waiter.timer);
        if (msg.ok) waiter.resolve(msg.result);
        else waiter.reject(new Error(msg.error || "RPA worker 返回未知错误"));
      }
    }
  });
  proc.on("exit", (code) => {
    console.error(`[rpa-client] worker 退出 code=${code}`);
    for (const [id, waiter] of pending) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("RPA worker 已退出"));
    }
    pending.clear();
    proc = null;
  });
  return proc;
}

export async function rpaCommand(cmd, args = {}, timeoutMs = 120000) {
  if (!rpaInstalled()) throw new Error("RPA_NOT_INSTALLED");
  const p = ensureProc();
  const id = `c${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`RPA 命令「${cmd}」超时（${Math.round(timeoutMs / 1000)}s）`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    p.stdin.write(`${JSON.stringify({ id, cmd, args })}\n`);
  });
}

export function rpaTeardown() {
  if (proc && proc.exitCode === null) {
    try {
      proc.kill("SIGTERM");
    } catch {}
  }
  proc = null;
}
process.on("exit", rpaTeardown);
