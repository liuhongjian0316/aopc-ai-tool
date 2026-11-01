#!/usr/bin/env node
// 观己 · P1/P2 冒烟测试(可复跑)
//
// 用法:node scripts/smoke.mjs
// 不依赖真实 AOPC 会话:用临时数据目录 + 伪造 hook stdin 直跑 observer.mjs;
// 另有一组真实 rollout 的 provider 预算读取测试(文件缺失时自动跳过)。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const OBSERVER = path.join(ROOT, "hooks", "observer.mjs");
const SERVER = path.join(ROOT, "server.mjs");
const REAL_ROLLOUT_DIR = path.join(os.homedir(), ".aopc", "cli", "rollout");
const REAL_SID = "sess_cefed5a4-89f0-48af-881d-dbde06e067a5";

let passed = 0;
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function runObserver(dataDir, input, extraEnv = {}) {
  const r = spawnSync("node", [OBSERVER], {
    input: JSON.stringify(input) + "\n",
    env: { ...process.env, AOPC_PLUGIN_DATA: dataDir, ...extraEnv },
    encoding: "utf8",
    timeout: 15000,
  });
  return { status: r.status, stdout: (r.stdout || "").trim(), stderr: r.stderr || "" };
}

function parseOut(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function readState(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, "state.json"), "utf8"));
  } catch {
    return null;
  }
}

function eventsOf(dataDir, sid) {
  try {
    return fs.readFileSync(path.join(dataDir, "events", `${sid}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// ---------- T0 语法检查 ----------

console.log("\n[T0] node --check 语法");
for (const f of ["hooks/observer.mjs", "server.mjs", "lib/state.mjs", "lib/budget.mjs", "lib/redact.mjs", "scripts/smoke.mjs"]) {
  const r = spawnSync("node", ["--check", path.join(ROOT, f)], { encoding: "utf8" });
  check(`${f}`, r.status === 0, r.stderr.split("\n")[0]);
}

// ---------- T1 会话开始横幅 ----------

console.log("\n[T1] SessionStart(startup)→ 自我横幅");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const r = runObserver(dir, { session_id: "sess_t1", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const out = parseOut(r.stdout);
  check("exit 0", r.status === 0, r.stderr);
  check("注入 additionalContext", out?.additionalContext?.includes("观己已挂载"), r.stdout.slice(0, 200));
  check("含 self_state 工具入口", out?.additionalContext?.includes("self_state"));
  check("state 已建会话", !!readState(dir)?.sessions?.sess_t1);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T2 无 rollout 时首轮静默 ----------

console.log("\n[T2] UserPromptSubmit(rollout 缺失)→ 不注入,turn 计数");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const r = runObserver(dir, { session_id: "sess_t2", hook_event_name: "UserPromptSubmit", prompt: "这是一段不该被记录的正文内容" });
  check("exit 0", r.status === 0, r.stderr);
  check("无注入(预算未知保持静默)", r.stdout === "", r.stdout.slice(0, 200));
  check("turn=1", readState(dir)?.sessions?.sess_t2?.turns === 1);
  check("隐私:事件只记长度不记正文", !JSON.stringify(eventsOf(dir, "sess_t2")).includes("不该被记录"), JSON.stringify(eventsOf(dir, "sess_t2")));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T3 真实 rollout 的 provider 预算注入 ----------

console.log("\n[T3] 真实 rollout → provider 实测预算注入(文件缺失则跳过)");
{
  const realFile = path.join(REAL_ROLLOUT_DIR, `model-io-${REAL_SID}.jsonl`);
  if (!fs.existsSync(realFile)) {
    console.log("  SKIP 未找到真实 rollout 样本文件");
  } else {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ rolloutDir: REAL_ROLLOUT_DIR, contextWindow: 100000 }));
    const r = runObserver(dir, { session_id: REAL_SID, hook_event_name: "UserPromptSubmit", prompt: "hi" });
    const out = parseOut(r.stdout);
    check("exit 0", r.status === 0, r.stderr);
    check("注入预算行", out?.additionalContext?.includes("我的上下文已用约"), r.stdout.slice(0, 200));
    check("provider 实测标注", out?.additionalContext?.includes("provider 实测"), r.stdout.slice(0, 300));
    check("百分比 ≈80.6%(80642/100k)", out?.additionalContext?.includes("80.6%"), r.stdout.slice(0, 300));
    check("预算来源已入 state", readState(dir)?.sessions?.[REAL_SID]?.budget?.src === "provider");
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- T4 连败告警与清除 ----------

console.log("\n[T4] PostToolUseFailure ×3 → 告警;成功后清 streak;脱敏生效");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const ev = (n, err) => runObserver(dir, { session_id: "sess_t4", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: err, is_interrupt: false });
  const secretErr = "curl failed with sk-abc123def456ghi789 at line 42";
  const r1 = ev(1, secretErr);
  const r2 = ev(2, secretErr.replace("42", "43"));
  check("第 1 次失败不注入", r1.stdout === "");
  const r3 = ev(3, secretErr.replace("42", "44"));
  const out3 = parseOut(r3.stdout);
  check("第 3 次失败注入告警", out3?.additionalContext?.includes("连吃 3 次"), r3.stdout.slice(0, 200));
  const st = readState(dir)?.sessions?.sess_t4;
  check("错误计数=3", st?.errors?.Bash === 3);
  check("streak 已标记 warned", st?.streaks?.Bash?.warned === true);
  const evs = eventsOf(dir, "sess_t4").filter((e) => e.ev === "tool_done" && e.ok === false);
  check("脱敏:密钥已打码", evs.length > 0 && JSON.stringify(evs).includes("***") && !JSON.stringify(evs).includes("sk-abc123"));
  check("签名归一化数字(3 条同 sig)", new Set(evs.map((e) => e.sig)).size === 1, JSON.stringify(evs.map((e) => e.sig)));
  const r4 = runObserver(dir, { session_id: "sess_t4", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_response: {} });
  check("成功后 streak 清除", readState(dir)?.sessions?.sess_t4?.streaks?.Bash === undefined);
  check("PostToolUse 不注入", r4.stdout === "");
  const r5 = runObserver(dir, { session_id: "sess_t4", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "user hit esc", is_interrupt: true });
  check("用户打断不计失败", readState(dir)?.sessions?.sess_t4?.errors?.Bash === 3 && r5.stdout === "");
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T5 复盘债提醒 ----------

console.log("\n[T5] Stop ×8(失败 ≥3)→ 复盘债提醒并清零");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  for (let i = 0; i < 3; i++) runObserver(dir, { session_id: "sess_t5", hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: {}, error: "string to replace not found in file", is_interrupt: false });
  let last = "";
  for (let i = 0; i < 7; i++) last = runObserver(dir, { session_id: "sess_t5", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "ok" }).stdout;
  check("前 7 段不提醒", last === "", last.slice(0, 200));
  const r8 = runObserver(dir, { session_id: "sess_t5", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "ok" });
  check("第 8 段提醒复盘债", parseOut(r8.stdout)?.additionalContext?.includes("/reflect"), r8.stdout.slice(0, 200));
  const st = readState(dir)?.sessions?.sess_t5;
  check("触发后计数清零", st.segments === 0 && st.failuresSinceReflect === 0);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T6 压缩横幅与静默降级 ----------

console.log("\n[T6] compact 横幅;坏输入静默;TTY 守卫");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const r1 = runObserver(dir, { session_id: "sess_t6", hook_event_name: "SessionStart", source: "compact", cwd: "/tmp" });
  check("compact 横幅", parseOut(r1.stdout)?.additionalContext?.includes("刚被压缩"), r1.stdout.slice(0, 200));
  const r2 = spawnSync("node", [OBSERVER], { input: "not json at all", env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 15000 });
  check("坏输入 exit 0 且无输出", r2.status === 0 && (r2.stdout || "").trim() === "", `status=${r2.status} stdout=${r2.stdout}`);
  const r3 = spawnSync("node", [OBSERVER], { env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
  check("无 stdin(TTY/ignore)静默", r3.status === 0 && (r3.stdout || "").trim() === "");
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T7 MCP server ----------

console.log("\n[T7] MCP server:握手 / 工具列表 / 四工具调用");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  // 先造一点观察数据
  runObserver(dir, { session_id: "sess_t7", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t7", hook_event_name: "PostToolUseFailure", tool_name: "Grep", tool_input: {}, error: "No files found", is_interrupt: false });
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {} } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "self_state", arguments: {} } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "self_journal", arguments: { action: "append", entry: { kind: "failure_postmortem", title: "Grep 空结果当失败处理", lesson: "先确认匹配模式再怪工具", playbookTarget: "verification-habits.md" } } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "self_journal", arguments: { action: "query", limit: 5 } } },
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "self_errors", arguments: { limit: 10 } } },
    { jsonrpc: "2.0", id: 7, method: "ping" },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const replies = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const byId = new Map(replies.filter((m) => m.id !== undefined).map((m) => [m.id, m]));
  check("exit 0", r.status === 0, (r.stderr || "").split("\n")[0]);
  check("initialize 回显协议版本", byId.get(1)?.result?.protocolVersion === "2025-06-18", JSON.stringify(byId.get(1)));
  check("serverInfo=selfaware", byId.get(1)?.result?.serverInfo?.name === "selfaware");
  const tools = byId.get(2)?.result?.tools || [];
  check("5 个工具", tools.length === 5 && ["self_state", "self_errors", "self_usage", "self_history", "self_journal"].every((n) => tools.some((t) => t.name === n)), JSON.stringify(tools.map((t) => t.name)));
  const stTxt = byId.get(3)?.result?.content?.[0]?.text || "";
  check("self_state 返回主会话状态", stTxt.includes("sess_t7") && stTxt.includes("<self-state>"), stTxt.slice(0, 200));
  const jApp = byId.get(4)?.result?.content?.[0]?.text || "";
  check("journal append 得 j001", jApp.includes("j001"), jApp.slice(0, 200));
  const jQry = byId.get(5)?.result?.content?.[0]?.text || "";
  check("journal query 可读回", jQry.includes("Grep 空结果当失败处理"), jQry.slice(0, 200));
  check("复盘条目清复盘债", readState(dir)?.reflect?.lastLiteAt > 0);
  const errTxt = byId.get(6)?.result?.content?.[0]?.text || "";
  check("self_errors 聚合到失败", errTxt.includes("Grep") && errTxt.includes("No files found"), errTxt.slice(0, 200));
  check("ping 应答 {}", JSON.stringify(byId.get(7)?.result) === "{}", JSON.stringify(byId.get(7)));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T8 子代理标记与主/子分列 ----------

console.log("\n[T8] 子代理会话 sub 标记;self_state 主/子分列不串");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t8main", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t8main", hook_event_name: "UserPromptSubmit", prompt: "hi" });
  runObserver(dir, { session_id: "sess_subagent_agent_x1", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "command not found: foo", is_interrupt: false });
  runObserver(dir, { session_id: "sess_subagent_agent_x1", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_response: {} });
  const st = readState(dir);
  check("子会话标记 sub=true", st?.sessions?.sess_subagent_agent_x1?.sub === true);
  check("主会话标记 sub=false", st?.sessions?.sess_t8main?.sub === false);
  // 子会话更新更晚,主会话仍应被 currentSid 选中(self_state 输出主 sid)
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_state", arguments: {} } },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const txt = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("self_state 选中主会话(而非更晚的子会话)", txt.includes("sess_t8main"), txt.slice(0, 200));
  check("子代理聚合可见", txt.includes("子代理") && txt.includes("1 个会话"), txt.slice(0, 300));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T9 自动初始化骨架 ----------

console.log("\n[T9] SessionStart 自动播种 self-model / playbooks 骨架;不覆盖已有");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t9", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const sm = path.join(dir, "self", "self-model.md");
  const pb = path.join(dir, "self", "playbooks", "README.md");
  check("self-model.md 已创建", fs.existsSync(sm));
  check("playbooks/README.md 已创建", fs.existsSync(pb));
  check("骨架含五段式", fs.readFileSync(sm, "utf8").includes("## 我的教训") && fs.readFileSync(sm, "utf8").includes("## 变更记录"));
  // 用户/复盘改过之后,再次 SessionStart 不许覆盖
  fs.appendFileSync(sm, "\n<!-- 用户修订痕迹 -->");
  runObserver(dir, { session_id: "sess_t9", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("已有档案不被覆盖", fs.readFileSync(sm, "utf8").includes("用户修订痕迹"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T10 playbook 规则注入横幅 ----------

console.log("\n[T10] playbook 规则注入 SessionStart 横幅(带截断预算)");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t10", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" }); // 先播种
  fs.mkdirSync(path.join(dir, "self", "playbooks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "self", "playbooks", "bash-pitfalls.md"), "# Bash 坑\n\n- [P1][2026-11-02] 跑 git 命令前先确认非裸仓 ← journal#j001\n- [P2][2026-11-02] 长命令先 echo 预览再执行\n");
  const r = runObserver(dir, { session_id: "sess_t10", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const ctx = parseOut(r.stdout)?.additionalContext || "";
  check("横幅含规则原文", ctx.includes("跑 git 命令前先确认非裸仓"), ctx.slice(0, 300));
  check("非规则行不注入", !ctx.includes("Bash 坑"));
  // 超预算截断:灌 50 条长规则,横幅仍 ≤ 合理长度并带"其余"
  const many = Array.from({ length: 50 }, (_, i) => `- [P2][2026-11-02] 规则${i}:${"x".repeat(40)}`).join("\n");
  fs.writeFileSync(path.join(dir, "self", "playbooks", "many.md"), many);
  const r2 = runObserver(dir, { session_id: "sess_t10", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const ctx2 = parseOut(r2.stdout)?.additionalContext || "";
  check("截断并提示其余条数", ctx2.includes("其余") && ctx2.length < 2200, `len=${ctx2.length}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T11 self_history 跨会话自传体记忆 ----------

console.log("\n[T11] MCP self_history:多会话聚合与累计统计");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  for (const [sid, fails] of [["sess_t11a", 1], ["sess_t11b", 0]]) {
    runObserver(dir, { session_id: sid, hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
    runObserver(dir, { session_id: sid, hook_event_name: "UserPromptSubmit", prompt: "hi" });
    runObserver(dir, { session_id: sid, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_response: {} });
    for (let i = 0; i < fails; i++) runObserver(dir, { session_id: sid, hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "boom 42", is_interrupt: false });
    runObserver(dir, { session_id: sid, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" });
  }
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "self_history", arguments: { limit: 5 } } },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const replies = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const tools = replies.find((m) => m.id === 1)?.result?.tools || [];
  check("5 个工具(含 self_history)", tools.some((t) => t.name === "self_history"), JSON.stringify(tools.map((t) => t.name)));
  const txt = replies.find((m) => m.id === 2)?.result?.content?.[0]?.text || "";
  check("两个会话都列出", txt.includes("sess_t11a") && txt.includes("sess_t11b"), txt.slice(0, 200));
  check("失败率入账(1/2 工具事件 → 50%)", txt.includes("失败率 50%"), txt.slice(0, 300));
  check("累计统计行", txt.includes("累计:") && txt.includes("2 轮"), txt.slice(0, 300));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- 汇总 ----------

console.log(`\n结果:${passed} 通过,${failed} 失败`);
process.exit(failed ? 1 : 0);
