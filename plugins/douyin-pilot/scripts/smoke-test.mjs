/**
 * douyin-pilot 冒烟测试：真实拉起 MCP server，走握手 → tools/list → 关键工具调用。
 * 用法：node scripts/smoke-test.mjs（数据目录自动用临时目录，不污染真实数据）
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = mkdtempSync(join(tmpdir(), "dy-smoke-"));
const proc = spawn("node", [join(PLUGIN_ROOT, "mcp-server", "server.mjs")], {
  env: { ...process.env, AOPC_PLUGIN_DATA: dataDir },
  stdio: ["pipe", "pipe", "pipe"],
});
let stderr = "";
proc.stderr.on("data", (d) => (stderr += d));

const pending = new Map();
let buf = "";
proc.stdout.setEncoding("utf-8");
proc.stdout.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

function rpc(method, params) {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
const text = (r) => r?.result?.content?.[0]?.text ?? JSON.stringify(r);
const assert = (label, cond, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${cond || !detail ? "" : ` → ${detail}`}`);
  if (!cond) process.exitCode = 1;
};

const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
assert("initialize 握手", Boolean(init.result?.serverInfo?.name === "douyin-pilot"));
proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

const list = await rpc("tools/list", {});
const names = list.result?.tools?.map((t) => t.name) ?? [];
assert("tools/list 返回 24 个工具", names.length === 24, `实际 ${names.length}`);

assert(
  "dy_config_get 初始未配置",
  text(await rpc("tools/call", { name: "dy_config_get", arguments: {} })).includes("未配置")
);
const setRes = text(await rpc("tools/call", { name: "dy_config_set", arguments: { clientKey: "aw_test_key", clientSecret: "test_secret" } }));
assert("dy_config_set 保存", setRes.includes("配置已保存"), setRes);
assert(
  "配置落盘可复查",
  text(await rpc("tools/call", { name: "dy_config_get", arguments: {} })).includes("已配置")
);

assert("dy_accounts 未授权友好提示", text(await rpc("tools/call", { name: "dy_accounts", arguments: {} })).includes("暂无已授权账号"));
assert(
  "dy_account_stats 无账号报错可读",
  text(await rpc("tools/call", { name: "dy_account_stats", arguments: {} })).includes("授权")
);

const dmSet = text(await rpc("tools/call", { name: "dy_dm_rules", arguments: { set: [{ keyword: "价格", reply: "亲，价格在主页橱窗哦～", enabled: true }] } }));
const dmGet = text(await rpc("tools/call", { name: "dy_dm_rules", arguments: {} }));
assert("dy_dm_rules 读写", dmSet.startsWith("✅") && dmGet.includes("价格"), dmSet + dmGet);

const q = text(await rpc("tools/call", {
  name: "dy_queue_add",
  arguments: { videoPath: "/tmp/x.mp4", title: "测试任务", dueAt: new Date(Date.now() + 86400000).toISOString() },
}));
const ql = text(await rpc("tools/call", { name: "dy_queue_list", arguments: {} }));
assert("dy_queue_add 未授权也可占坑入队", q.includes("已入队") && ql.includes("测试任务"), q + ql);
assert("dy_queue_run 无到期任务", text(await rpc("tools/call", { name: "dy_queue_run", arguments: {} })).includes("没有到期任务"));

// OAuth 本机监听：不真实换 token，只验证监听器起得来、超时路径可退出
const listen = text(await rpc("tools/call", { name: "dy_auth_listen", arguments: { timeoutSec: 2 } }));
assert("dy_auth_listen 超时路径可退出", listen.includes("超时"), listen);

// ===== RPA 通道（本机已装 playwright 时为真实无头探测） =====

const rpaPub0 = text(await rpc("tools/call", { name: "dy_rpa_publish", arguments: { videoPath: "/tmp/不存在.mp4", title: "x" } }));
assert("dy_rpa_publish 文件不存在拦截", rpaPub0.includes("视频文件不存在"), rpaPub0);

const qRpa = text(await rpc("tools/call", {
  name: "dy_queue_add",
  arguments: { videoPath: "/tmp/x.mp4", title: "RPA队列", dueAt: new Date(Date.now() + 3600000).toISOString(), channel: "rpa" },
}));
assert("dy_queue_add channel=rpa", qRpa.includes("通道=rpa"), qRpa);

const rpaClose = text(await rpc("tools/call", { name: "dy_rpa_close", arguments: {} }));
assert("dy_rpa_close 可关闭", rpaClose.includes("已关闭") || rpaClose.includes("出错"), rpaClose);

// 真实无头探测（未登录 profile → 预期 loggedIn=false）
const rpaStatus = text(await rpc("tools/call", { name: "dy_rpa_status", arguments: {} }));
assert(
  "dy_rpa_status 真实探测",
  rpaStatus.includes("Playwright：✅ 已安装") && rpaStatus.includes("未登录"),
  rpaStatus
);

if (stderr.trim()) console.log("server stderr:", stderr.trim());
proc.kill();
console.log(process.exitCode ? "\n有失败项" : "\n冒烟测试全部通过");
