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
for (const f of ["hooks/observer.mjs", "server.mjs", "lib/state.mjs", "lib/budget.mjs", "lib/redact.mjs", "lib/templates.mjs", "scripts/smoke.mjs", "scripts/e2e.mjs"]) {
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
  check("8 个工具", tools.length === 8 && ["self_state", "self_errors", "self_usage", "self_history", "self_config", "self_mission", "self_learn", "self_journal"].every((n) => tools.some((t) => t.name === n)), JSON.stringify(tools.map((t) => t.name)));
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
  runObserver(dir, { session_id: "sess_t8main", hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_response: {} });
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
  check("子代理视图为派发计数(C3 适配)", txt.includes("子代理派发:本会话 1 次"), txt.slice(0, 400));
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

// ---------- T12 编辑量 critic 提醒 ----------

console.log("\n[T12] 文件改动 ×10 → 一次性 critic 提醒;开关可关");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t12", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  let last = "";
  for (let i = 1; i <= 10; i++) last = runObserver(dir, { session_id: "sess_t12", hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: {}, tool_response: {} }).stdout;
  check("第 10 次改动提醒派 critic", parseOut(last)?.additionalContext?.includes("critic"), last.slice(0, 200));
  const r11 = runObserver(dir, { session_id: "sess_t12", hook_event_name: "PostToolUse", tool_name: "Write", tool_input: {}, tool_response: {} });
  check("只提醒一次", r11.stdout === "", r11.stdout.slice(0, 200));
  check("非文件工具不计数", (() => {
    runObserver(dir, { session_id: "sess_t12", hook_event_name: "PostToolUse", tool_name: "Read", tool_input: {}, tool_response: {} });
    return readState(dir)?.sessions?.sess_t12?.fileEdits === 11;
  })());
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  fs.writeFileSync(path.join(dir2, "config.json"), JSON.stringify({ injectCriticNudge: false }));
  runObserver(dir2, { session_id: "sess_t12b", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  let last2 = "";
  for (let i = 0; i < 10; i++) last2 = runObserver(dir2, { session_id: "sess_t12b", hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: {}, tool_response: {} }).stdout;
  check("开关关闭则静默", last2 === "", last2.slice(0, 200));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
}

// ---------- T13 叙事片段与脱敏 ----------

console.log("\n[T13] Stop 叙事入事件与 self_history;密钥脱敏");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t13", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const msg = "已修复登录 bug,token 是 sk-abcdef123456789,改动见 src/auth.ts";
  runObserver(dir, { session_id: "sess_t13", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: msg });
  const evs = eventsOf(dir, "sess_t13").filter((e) => e.ev === "segment_end");
  check("叙事已入事件", evs.length === 1 && evs[0].lastMsg.includes("已修复登录 bug"), JSON.stringify(evs));
  check("叙事中密钥已打码", !JSON.stringify(evs).includes("sk-abcdef") && JSON.stringify(evs).includes("***"));
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_history", arguments: { limit: 5 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const txt = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("self_history 显示最近在做", txt.includes("最近在做") && txt.includes("已修复登录 bug"), txt.slice(0, 300));
  check("history 不含密钥原文", !txt.includes("sk-abcdef"), txt.slice(0, 300));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T14 慢性错误检测 ----------

console.log("\n[T14] self_errors:同签名跨 ≥3 会话 → 慢性错误标记");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  for (const sid of ["sess_t14a", "sess_t14b", "sess_t14c"]) {
    runObserver(dir, { session_id: sid, hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
    runObserver(dir, { session_id: sid, hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "fatal: not a git repository", is_interrupt: false });
  }
  runObserver(dir, { session_id: "sess_t14d", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t14d", hook_event_name: "PostToolUseFailure", tool_name: "Grep", tool_input: {}, error: "No files found", is_interrupt: false });
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_errors", arguments: { limit: 10 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const txt = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("慢性错误区块出现", txt.includes("慢性错误"), txt.slice(0, 200));
  check("git 误用被标记为慢性(跨3会话)", txt.includes("跨 3 个会话"), txt.slice(0, 400));
  check("单会话 Grep 失败不算慢性", !txt.includes("Grep [No files found] 跨") || !txt.split("慢性错误")[1]?.includes("Grep"), txt.slice(0, 400));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T15 Stop 时刷新预算(修首 turn null) ----------

console.log("\n[T15] rollout 在 turn 中途落盘 → Stop 时预算来自 provider");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const rd = fs.mkdtempSync(path.join(os.tmpdir(), "sa-roll-"));
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ rolloutDir: rd, contextWindow: 200000 }));
  const sid = "sess_t15";
  runObserver(dir, { session_id: sid, hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: sid, hook_event_name: "UserPromptSubmit", prompt: "hi" }); // rollout 尚未落盘 → budget null
  check("首 turn 预算确实为 null(复现 V1 现象)", readState(dir)?.sessions?.[sid]?.budget === null);
  // turn 进行中,宿主把 rollout 落盘(带 provider usage)
  fs.writeFileSync(path.join(rd, `model-io-${sid}.jsonl`), JSON.stringify({ response: { usage: { inputTokens: 50000 } } }) + "\n");
  runObserver(dir, { session_id: sid, hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "done" });
  const b = readState(dir)?.sessions?.[sid]?.budget;
  check("Stop 后预算来自 provider 实测", b?.src === "provider" && b?.used === 50000, JSON.stringify(b));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(rd, { recursive: true, force: true });
}

// ---------- T16 慢性错误自动落提案(去重) ----------

console.log("\n[T16] 慢性错误 → 自动 playbook 提案;同签名不重复");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  for (const sid of ["sess_t16a", "sess_t16b", "sess_t16c"]) {
    runObserver(dir, { session_id: sid, hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
    runObserver(dir, { session_id: sid, hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "fatal: not a git repository", is_interrupt: false });
  }
  const call = () => spawnSync("node", [SERVER], {
    input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_errors", arguments: { limit: 10 } } }) + "\n",
    env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000,
  });
  call();
  let entries = fs.readFileSync(path.join(dir, "journal.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const props = entries.filter((e) => e.kind === "playbook_proposal");
  check("自动落 1 条提案", props.length === 1 && props[0].title.includes("慢性错误"), JSON.stringify(props));
  check("提案带 chronic 去重标记", props[0]?.refs?.[0] === "chronic:Bash|fatal: not a git repository", JSON.stringify(props[0]?.refs));
  call();
  entries = fs.readFileSync(path.join(dir, "journal.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  check("再次查询不重复提案", entries.filter((e) => e.kind === "playbook_proposal").length === 1);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T17 跨会话复盘债 ----------

console.log("\n[T17] 未复盘失败跨会话累计;横幅提示;journal 清账");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t17a", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  for (let i = 0; i < 2; i++) runObserver(dir, { session_id: "sess_t17a", hook_event_name: "PostToolUseFailure", tool_name: "Edit", tool_input: {}, error: "string to replace not found", is_interrupt: false });
  runObserver(dir, { session_id: "sess_t17a", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: "ok" });
  check("Stop 后债务并入全局(增量搬运)", readState(dir)?.outstandingDebt === 2, JSON.stringify(readState(dir)?.outstandingDebt));
  check("会话内计数保留(nudge 仍可见)", readState(dir)?.sessions?.sess_t17a?.failuresSinceReflect === 2);
  const rb = runObserver(dir, { session_id: "sess_t17b", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("新会话横幅提示遗留债务", parseOut(rb.stdout)?.additionalContext?.includes("跨会话未复盘失败累计 2 次"), (rb.stdout || "").slice(0, 300));
  // 复盘落账清债
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_journal", arguments: { action: "append", entry: { kind: "failure_postmortem", title: "清债复盘", lesson: "规则Y" } } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  check("journal 落账后全局债务清零", readState(dir)?.outstandingDebt === 0);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T18 playbook P1 优先注入 ----------

console.log("\n[T18] playbook 规则按 P1→P3 排序进入预算");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t18", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  fs.mkdirSync(path.join(dir, "self", "playbooks"), { recursive: true });
  fs.writeFileSync(path.join(dir, "self", "playbooks", "mixed.md"), [
    "- [P3][2026-11-02] 三级规则甲",
    "- [P2][2026-11-02] 二级规则乙",
    "- [P1][2026-11-02] 一级规则丙",
  ].join("\n"));
  const r = runObserver(dir, { session_id: "sess_t18", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const ctx = parseOut(r.stdout)?.additionalContext || "";
  const iP1 = ctx.indexOf("一级规则丙");
  const iP2 = ctx.indexOf("二级规则乙");
  const iP3 = ctx.indexOf("三级规则甲");
  check("三条规则都注入", iP1 >= 0 && iP2 >= 0 && iP3 >= 0, ctx.slice(0, 400));
  check("P1 排在最前", iP1 < iP2 && iP2 < iP3, `顺序 ${iP1}/${iP2}/${iP3}`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T19 自我档案健康度 ----------

console.log("\n[T19] self_state 报告自我档案健康度");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t19", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_state", arguments: {} } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const call = () => spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  let txt = call();
  txt = (txt.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("骨架状态:五段齐 + 占位提示", txt.includes("五段齐") && txt.includes("待 /reflect 填充"), txt.slice(0, 400));
  // 修订档案:把教训写进「我的教训」节、变更记录追加条目,健康度应更新
  const sm = path.join(dir, "self", "self-model.md");
  const md0 = fs.readFileSync(sm, "utf8");
  fs.writeFileSync(sm, md0
    .replace("(待积累,格式:`- [YYYY-MM-DD] 规则一句话 ← journal#<id>`)", "- [2026-11-02] 规则甲 ← journal#j001")
    .replaceAll("(待补", "(").replaceAll("待补", "已填")
    + "- [2026-11-02] 修订教训段与能力清单\n");
  txt = (call().stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("教训计数 1", txt.includes("教训 1 条"), txt.slice(0, 400));
  check("最后变更更新为今天", txt.includes("最后变更:2026-11-02"), txt.slice(0, 400));
  check("占位提示消失", !txt.includes("待 /reflect 填充"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T20 过期提案提醒 ----------

console.log("\n[T20] self_journal 查询:超 7 天未落地提案带 ⚠");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  fs.mkdirSync(dir, { recursive: true });
  const old = Date.now() - 8 * 86400000;
  fs.writeFileSync(path.join(dir, "journal.jsonl"), [
    JSON.stringify({ id: "j001", t: old, kind: "playbook_proposal", title: "陈年提案", lesson: "规则X", status: "proposed", refs: [] }),
    JSON.stringify({ id: "j002", t: Date.now(), kind: "failure_postmortem", title: "新鲜复盘", status: "", refs: [] }),
  ].join("\n") + "\n");
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ version: 2, sessions: {}, reflect: { lastDeepAt: 0, lastLiteAt: 0 }, outstandingDebt: 0, journalSeq: 2 }));
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_journal", arguments: { action: "query", limit: 10 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const txt = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check("陈年提案带 ⚠ 标记", txt.includes("超 7 天未落地") && txt.includes("陈年提案"), txt.slice(0, 300));
  check("汇总行给出清账指引", txt.includes("积压的提案等于没有提案"), txt.slice(0, 300));
  check("新鲜复盘不受影响", !txt.includes("新鲜复盘 ⚠") && txt.includes("新鲜复盘"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T21 self_config 开关读写 ----------

console.log("\n[T21] self_config:get/set 白名单键、类型校验、嵌套路径");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const call = (name, args2) => {
    const r = spawnSync("node", [SERVER], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args2 } }) + "\n",
      env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000,
    });
    const m = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)[0];
    return { text: m?.result?.content?.[0]?.text || "", isError: !!m?.result?.isError };
  };
  const g = call("self_config", { action: "get" });
  check("get 返回默认配置", g.text.includes('"injectBudget": true') && g.text.includes("config.json"), g.text.slice(0, 200));
  const s1 = call("self_config", { action: "set", key: "injectBudget", value: false });
  check("set 布尔开关生效", !s1.isError && s1.text.includes('"injectBudget": false'), s1.text.slice(0, 200));
  check("config.json 已落盘", JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).injectBudget === false);
  const s2 = call("self_config", { action: "set", key: "budgetThrottle.mid", value: 0.5 });
  check("嵌套路径生效", !s2.isError && JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).budgetThrottle.mid === 0.5);
  check("生效配置回显", s2.text.includes('"mid": 0.5'));
  const s3 = call("self_config", { action: "set", key: "notAllowed", value: 1 });
  check("白名单外拒绝", s3.isError && s3.text.includes("白名单"), s3.text.slice(0, 200));
  const s4 = call("self_config", { action: "set", key: "injectBudget", value: "yes" });
  check("类型错误拒绝", s4.isError && s4.text.includes("boolean"), s4.text.slice(0, 200));
  const s5 = call("self_config", { action: "set", key: "contextWindow", value: 128000 });
  check("contextWindow 可调", !s5.isError && s5.text.includes('"contextWindow": 128000'));
  // 开关对 hook 立即生效:关掉预算注入后 UserPromptSubmit 静默
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ injectBudget: false }));
  const r2 = runObserver(dir, { session_id: "sess_t21", hook_event_name: "UserPromptSubmit", prompt: "hi" });
  check("hook 读到新开关(静默)", r2.stdout === "", r2.stdout.slice(0, 100));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T22 事件日志保留期 ----------

console.log("\n[T22] retentionDays:过期事件文件在 SessionStart 清理;0 = 永久");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  fs.mkdirSync(path.join(dir, "events"), { recursive: true });
  const oldF = path.join(dir, "events", "sess_old.jsonl");
  const newF = path.join(dir, "events", "sess_new.jsonl");
  fs.writeFileSync(oldF, "{}\n");
  fs.writeFileSync(newF, "{}\n");
  const oldTime = Date.now() - 91 * 86400000;
  const oldDate = new Date(oldTime); // utimesSync 传数字按秒算,必须传 Date(T22 第一版的坑)
  fs.utimesSync(oldF, oldDate, oldDate); // 模拟 91 天前的旧文件
  runObserver(dir, { session_id: "sess_t22", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("91 天前的文件被清理", !fs.existsSync(oldF));
  check("新文件保留", fs.existsSync(newF));
  check("当前会话事件正常写入", fs.existsSync(path.join(dir, "events", "sess_t22.jsonl")));
  // retentionDays: 0 → 永久
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  fs.mkdirSync(path.join(dir2, "events"), { recursive: true });
  fs.writeFileSync(path.join(dir2, "events", "sess_old2.jsonl"), "{}\n");
  fs.utimesSync(path.join(dir2, "events", "sess_old2.jsonl"), oldTime, oldTime);
  fs.writeFileSync(path.join(dir2, "config.json"), JSON.stringify({ retentionDays: 0 }));
  runObserver(dir2, { session_id: "sess_t22b", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("retentionDays=0 时永久保留", fs.existsSync(path.join(dir2, "events", "sess_old2.jsonl")));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir2, { recursive: true, force: true });
}

// ---------- T23 时间本地化 ----------

console.log("\n[T23] self_history 时间按本地时区展示");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  // 选一个 UTC 与本地(UTC+8)跨日的时刻:2026-11-02T18:30:00Z → 本地 2026-11-03 02:30
  const t = Date.UTC(2026, 10, 2, 18, 30, 0);
  fs.mkdirSync(path.join(dir, "events"), { recursive: true });
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  const localStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  fs.writeFileSync(path.join(dir, "events", "sess_t23.jsonl"), JSON.stringify({ ev: "session_start", source: "startup", t, sid: "sess_t23" }) + "\n");
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_history", arguments: { limit: 5 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const txt = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.content?.[0]?.text || "").join("");
  check(`本地时区时间入列(${localStr})`, txt.includes(localStr), txt.slice(0, 200));
  check("不再是 UTC 串(18:30Z→02:30 本地)", !txt.includes("11-02 18:30"), txt.slice(0, 200));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T24 面板资源(ui.surfaces / mcp-app) ----------

console.log("\n[T24] resources/list+read:panel.html 以 mcp-app MIME 分发");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    { jsonrpc: "2.0", id: 2, method: "resources/list" },
    { jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: "ui://selfaware/panel.html" } },
    { jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "ui://selfaware/nope.html" } },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const replies = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const byId = new Map(replies.filter((m) => m.id !== undefined).map((m) => [m.id, m]));
  check("initialize 声明 resources 能力", !!byId.get(1)?.result?.capabilities?.resources, JSON.stringify(byId.get(1)?.result?.capabilities));
  const res = byId.get(2)?.result?.resources || [];
  check("resources/list 列出面板", res.length === 1 && res[0].uri === "ui://selfaware/panel.html", JSON.stringify(res));
  check("面板 MIME 为 mcp-app", res[0]?.mimeType === "text/html;profile=mcp-app");
  const content = byId.get(3)?.result?.contents?.[0];
  check("resources/read 返回自包含面板", content?.mimeType === "text/html;profile=mcp-app" && content?.text?.startsWith("<!DOCTYPE html>"), String(content?.text || "").slice(0, 80));
  check("面板内联 SDK 与面板逻辑", content?.text?.includes("GUANJI_SDK") && content?.text?.includes("callServerTool") && content?.text?.includes("自我仪表盘"));
  check("未知资源报 -32602", byId.get(4)?.error?.code === -32602, JSON.stringify(byId.get(4)?.error));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T25 工具 structuredContent ----------

console.log("\n[T25] 查询工具附带 structuredContent(面板数据通道)");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  // 先造旧会话(较早活跃),再造当前会话——currentSid 应选后者
  runObserver(dir, { session_id: "sess_t25old", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t25old", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "boom", is_interrupt: false });
  runObserver(dir, { session_id: "sess_t25", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t25", hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: {}, tool_response: {} });
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_state", arguments: {} } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "self_errors", arguments: { limit: 10 } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "self_history", arguments: { limit: 5 } } },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const replies = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const sc1 = replies.find((m) => m.id === 1)?.result?.structuredContent;
  check("self_state 带结构化会话", sc1?.session?.sid === "sess_t25" && sc1?.session?.dispatches === 1, JSON.stringify(sc1?.session));
  check("健康度与 playbook 规则入结构", typeof sc1?.health === "string" && Array.isArray(sc1?.playbookRules) && sc1?.paths?.data, JSON.stringify(sc1?.health));
  const sc2 = replies.find((m) => m.id === 2)?.result?.structuredContent;
  check("self_errors 带分组数组", Array.isArray(sc2?.groups) && sc2.groups[0]?.tool === "Bash", JSON.stringify(sc2));
  const sc3 = replies.find((m) => m.id === 3)?.result?.structuredContent;
  check("self_history 带会话数组与累计", sc3?.totalSessions === 2 && sc3?.totals?.calls === 1 && sc3?.totals?.errors === 1 && Array.isArray(sc3?.sessions), JSON.stringify(sc3?.totals));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T26 使命机制 ----------

console.log("\n[T26] self_mission:立项/记日志/结项;横幅带使命");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const call = (name, args2) => {
    const r = spawnSync("node", [SERVER], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args2 } }) + "\n",
      env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000,
    });
    const m = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)[0];
    return { text: m?.result?.content?.[0]?.text || "", sc: m?.result?.structuredContent, isError: !!m?.result?.isError };
  };
  let r = call("self_mission", { action: "note", text: "无使命时记日志应失败" });
  check("无使命时 note 拒绝", r.isError && r.text.includes("start"), r.text.slice(0, 120));
  r = call("self_mission", { action: "start", title: "自主运营抖音号", goal: "日更 1 条 + 评论 24h 回复" });
  check("立项成功", !r.isError && r.sc?.mission?.active?.title === "自主运营抖音号" && r.sc.mission.active.day === 1, JSON.stringify(r.sc?.mission));
  r = call("self_mission", { action: "note", text: "开工:今日发 1 条 + 回评论" });
  check("note 记日志", !r.isError && r.sc?.mission?.recentLog?.[0]?.kind === "note");
  // 横幅带使命
  const rb = runObserver(dir, { session_id: "sess_t26", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const banner = parseOut(rb.stdout)?.additionalContext || "";
  check("横幅含使命与天数", banner.includes("当前使命") && banner.includes("自主运营抖音号") && banner.includes("第 1 天"), banner.slice(0, 300));
  // self_state 结构化带使命
  const st = call("self_state", {});
  check("self_state 带使命结构", st.sc?.mission?.active?.title === "自主运营抖音号", JSON.stringify(st.sc?.mission));
  r = call("self_mission", { action: "close", text: "验收完成" });
  check("结项后无 active", !r.isError && r.sc?.mission?.active === null);
  const rb2 = runObserver(dir, { session_id: "sess_t26b", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("结项后横幅无使命", !(parseOut(rb2.stdout)?.additionalContext || "").includes("当前使命"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T27 预算轨迹 ----------

console.log("\n[T27] UserPromptSubmit 累积预算轨迹(封顶)");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const rd = fs.mkdtempSync(path.join(os.tmpdir(), "sa-roll-"));
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ rolloutDir: rd, contextWindow: 200000 }));
  const sid = "sess_t27";
  for (let i = 0; i < 6; i++) {
    // 必须 append:同字节数的整行重写会让增量读以为无新内容(rolloutOffset 语义)
    fs.appendFileSync(path.join(rd, `model-io-${sid}.jsonl`), JSON.stringify({ response: { usage: { inputTokens: 20000 * (i + 1) } } }) + "\n");
    runObserver(dir, { session_id: sid, hook_event_name: "UserPromptSubmit", prompt: "hi" });
  }
  const st = readState(dir)?.sessions?.[sid];
  check("轨迹累积 6 点且递增", st?.trail?.length === 6 && st.trail[5].pct === 60 && st.trail[0].pct === 10, JSON.stringify(st?.trail));
  // rpc: self_state structured 带 trail
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_state", arguments: {} } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const sc = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.structuredContent)[0];
  check("structured 带 trail", Array.isArray(sc?.session?.trail) && sc.session.trail.length === 6);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(rd, { recursive: true, force: true });
}

// ---------- T28 按天聚合 ----------

console.log("\n[T28] self_history 按本地日聚合 daily(图表数据)");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t28", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  runObserver(dir, { session_id: "sess_t28", hook_event_name: "UserPromptSubmit", prompt: "hi" });
  runObserver(dir, { session_id: "sess_t28", hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: {}, tool_response: {} });
  runObserver(dir, { session_id: "sess_t28", hook_event_name: "PostToolUseFailure", tool_name: "Bash", tool_input: {}, error: "x 42", is_interrupt: false });
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_history", arguments: { limit: 5 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const sc = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.structuredContent)[0];
  check("daily ≥1 天且当日聚合正确", Array.isArray(sc?.daily) && sc.daily.length >= 1 && sc.daily.at(-1).calls === 1 && sc.daily.at(-1).errors === 1 && sc.daily.at(-1).turns === 1, JSON.stringify(sc?.daily));
  check("text 附近 N 天活跃行", (r.stdout || "").includes("近 1 天活跃"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T29 使命自主等级 ----------

console.log("\n[T29] mission autonomy:full 受横幅与结构化携带;默认 supervised");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const call = (name, args2) => {
    const r = spawnSync("node", [SERVER], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args2 } }) + "\n",
      env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000,
    });
    const m = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)[0];
    return { text: m?.result?.content?.[0]?.text || "", sc: m?.result?.structuredContent };
  };
  runObserver(dir, { session_id: "sess_t29", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const r1 = call("self_mission", { action: "start", title: "自主运营抖音号", goal: "日更", autonomy: "full" });
  check("full 立项回显完全自主", r1.text.includes("完全自主") && r1.sc?.mission?.active?.autonomy === "full", r1.text.slice(0, 150));
  const banner = parseOut(runObserver(dir, { session_id: "sess_t29b", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" }).stdout)?.additionalContext;
  check("横幅带完全自主标记", (banner || "").includes("(完全自主)"), (banner || "").slice(0, 200));
  const st = call("self_state", {});
  check("self_state 结构带 autonomy=full", st.sc?.mission?.active?.autonomy === "full");
  // 结项再立一个默认受监督的
  call("self_mission", { action: "close", text: "换等级" });
  const r2 = call("self_mission", { action: "start", title: "受监督使命" });
  check("默认 supervised", r2.sc?.mission?.active?.autonomy === "supervised" && r2.text.includes("受监督"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T30 ops-fixes 自愈手册种子 ----------

console.log("\n[T30] bootstrap 播种 ops-fixes.md;已有文件不覆盖");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t30", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  const ops = path.join(dir, "self", "playbooks", "ops-fixes.md");
  check("ops-fixes.md 已播种", fs.existsSync(ops));
  check("含障碍三分类种子规则", fs.readFileSync(ops, "utf8").includes("A 类机械障碍"));
  // agent 演化过的文件不被覆盖
  fs.appendFileSync(ops, "\n- [P1][2026-11-03] 我自己修的规则 ← 证据\n");
  runObserver(dir, { session_id: "sess_t30", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  check("演化内容不被覆盖", fs.readFileSync(ops, "utf8").includes("我自己修的规则"));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T31 自扩展资产可见性 ----------

console.log("\n[T31] self_state 暴露 opsScripts 与 playbookFiles");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  runObserver(dir, { session_id: "sess_t31", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  fs.mkdirSync(path.join(dir, "self", "ops", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "self", "ops", "scripts", "resize_video.sh"), "#!/bin/sh\n");
  fs.writeFileSync(path.join(dir, "self", "playbooks", "douyin-ops.md"), "# 领域手册\n");
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_state", arguments: {} } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const sc = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((m) => m?.result?.structuredContent)[0];
  check("自造脚本入清单", sc?.opsScripts?.includes("resize_video.sh"), JSON.stringify(sc?.opsScripts));
  check("领域手册入清单", sc?.playbookFiles?.includes("douyin-ops.md") && sc?.playbookFiles?.includes("ops-fixes.md"), JSON.stringify(sc?.playbookFiles));
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T32 retentionDays 可经 self_config 调整 ----------

console.log("\n[T32] self_config 白名单补 retentionDays");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const rpc = [{ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_config", arguments: { action: "set", key: "retentionDays", value: 30 } } }]
    .map((m) => JSON.stringify(m)).join("\n") + "\n";
  spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  check("retentionDays=30 已落盘", JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).retentionDays === 30);
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- T33/T34 每日学习时刻(self_learn → Obsidian 知识库) ----------

console.log("\n[T33] self_learn record:写入带 agent 标识的 Obsidian 笔记 + git 提交");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), "sa-kb-"));
  spawnSync("git", ["init"], { cwd: kb, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "agent@test"], { cwd: kb, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "guanji-test"], { cwd: kb, encoding: "utf8" });
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ knowledgeBase: { path: kb, autoCommit: true } }));
  const call = (name, args2) => {
    const r = spawnSync("node", [SERVER], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args2 } }) + "\n",
      env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 30000,
    });
    const m = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)[0];
    return { text: m?.result?.content?.[0]?.text || "", sc: m?.result?.structuredContent, isError: !!m?.result?.isError };
  };
  const r1 = call("self_learn", { action: "record", title: "Playwright chromium 自愈安装要点", body: "来源:ops-fixes 首日实践。学习:npx playwright install chromium 可自愈 RPA 前提;装完必须跑验证命令。", tags: "douyin" });
  check("record 写入成功", !r1.isError && r1.text.includes("已写入知识库"), r1.text.slice(0, 200));
  const kbDir = path.join(kb, "观己学习");
  const files = fs.readdirSync(kbDir).filter((f) => f.endsWith(".md"));
  const nowD = new Date();
  const pd = (n) => String(n).padStart(2, "0");
  const localToday = `${nowD.getFullYear()}-${pd(nowD.getMonth() + 1)}-${pd(nowD.getDate())}`; // kbSlug 用本地日期,断言必须同口径(UTC 会差一天)
  check("文件名带日期与标题 slug", files.length === 1 && files[0].startsWith(localToday) && files[0].includes("Playwright-chromium"), JSON.stringify(files));
  const md = fs.readFileSync(path.join(kbDir, files[0]), "utf8");
  check("frontmatter 带 agent 标识", md.includes("source: agent-selfaware") && md.includes("agent-written: true"), md.slice(0, 300));
  check("正文带 🤖 横幅", md.includes("🤖 本文由自主 agent「观己」"));
  check("tags 含 agent-written 与用户标签", md.includes("tags: [观己, agent-written, douyin]"));
  const gl = spawnSync("git", ["log", "--oneline", "--grep=agent(观己)"], { cwd: kb, encoding: "utf8" });
  check("git 已带 agent 标识提交", (gl.stdout || "").trim().length > 0, gl.stdout + gl.stderr);
  const r2 = call("self_learn", { action: "record", title: "Playwright chromium 自愈安装要点", body: "补充:升级 playwright 版本后需重装对应 chromium。" });
  check("同题补学走追加", !r2.isError && r2.text.includes("补充") && fs.readdirSync(kbDir).length === 1);
  check("追加节在文件内", fs.readFileSync(path.join(kbDir, files[0]), "utf8").includes("## 补充("));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(kb, { recursive: true, force: true });
}

console.log("\n[T34] self_learn list + self_state 知识库统计");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), "sa-kb-"));
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ knowledgeBase: { path: kb } }));
  runObserver(dir, { session_id: "sess_t34", hook_event_name: "SessionStart", source: "startup", cwd: "/tmp" });
  fs.mkdirSync(path.join(kb, "观己学习"), { recursive: true });
  fs.writeFileSync(path.join(kb, "观己学习", "2026-11-03-测试知识.md"), "# t\n");
  const rpc = [
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "self_learn", arguments: { action: "list" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "self_state", arguments: {} } },
  ].map((m) => JSON.stringify(m)).join("\n") + "\n";
  const r = spawnSync("node", [SERVER], { input: rpc, env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 20000 });
  const replies = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const listTxt = replies.find((m) => m.id === 1)?.result?.content?.[0]?.text || "";
  check("list 列出已写入笔记", listTxt.includes("2026-11-03-测试知识.md"), listTxt.slice(0, 200));
  const sc2 = replies.find((m) => m.id === 2)?.result?.structuredContent;
  check("self_state 带知识库统计", sc2?.knowledge?.configured === true && sc2.knowledge.total === 1 && sc2.knowledge.today === 1, JSON.stringify(sc2?.knowledge));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(kb, { recursive: true, force: true });
}

// ---------- T35 困难队列:入队/研究消化/知识库双写 ----------

console.log("\n[T35] self_mission obstacle/resolve:困难变成知识库条目");
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sa-test-"));
  const kb = fs.mkdtempSync(path.join(os.tmpdir(), "sa-kb-"));
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ knowledgeBase: { path: kb } }));
  const call = (name, args2) => {
    const r = spawnSync("node", [SERVER], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args2 } }) + "\n",
      env: { ...process.env, AOPC_PLUGIN_DATA: dir }, encoding: "utf8", timeout: 30000,
    });
    const m = (r.stdout || "").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)[0];
    return { text: m?.result?.content?.[0]?.text || "", sc: m?.result?.structuredContent, isError: !!m?.result?.isError };
  };
  call("self_mission", { action: "start", title: "自主运营测试场", autonomy: "full" });
  let r = call("self_mission", { action: "obstacle", text: "dy_queue_run 报 queue locked,原因未知,已重试 2 次" });
  check("困难入队得 d001", !r.isError && r.text.includes("d001"), r.text.slice(0, 150));
  check("structured 带待研究队列", r.sc?.mission?.openDifficulties?.length === 1 && r.sc.mission.openDifficulties[0].status === "open");
  // missionText 体现待研究
  const g = call("self_mission", { action: "get" });
  check("get 文本列出待研究", g.text.includes("待研究困难(1 条") && g.text.includes("queue locked"), g.text.slice(0, 300));
  // resolve:研究完成 → 知识库 + 队列消化
  r = call("self_mission", { action: "resolve", id: "d001", title: "dy_queue_run 队列锁机制研究", body: "机制:队列文件被并发进程持有 flock;为什么会这样:两个开工循环并发;下次:开工前先 dy_queue_status 检测锁。来源:源码 dy-queue.mjs + 复现实验。", tags: "douyin" });
  check("resolve 写入知识库", !r.isError && r.text.includes("已研究消化") && r.text.includes("写入知识库"), r.text.slice(0, 200));
  const kbDir = path.join(kb, "观己学习");
  const kbFiles = fs.readdirSync(kbDir).filter((f) => f.endsWith(".md"));
  check("KB 笔记带 troubleshooting 标签", kbFiles.length === 1 && fs.readFileSync(path.join(kbDir, kbFiles[0]), "utf8").includes("troubleshooting"));
  check("队列条目标记 learned", r.sc?.mission?.openDifficulties?.length === 0);
  // 无 id 的 resolve 报错
  r = call("self_mission", { action: "resolve", body: "x" });
  check("resolve 无待研究条目时报错", r.isError && r.text.includes("未找到待研究的困难"), r.text.slice(0, 150));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(kb, { recursive: true, force: true });
}

// ---------- 汇总 ----------

console.log(`\n结果:${passed} 通过,${failed} 失败`);
process.exit(failed ? 1 : 0);
