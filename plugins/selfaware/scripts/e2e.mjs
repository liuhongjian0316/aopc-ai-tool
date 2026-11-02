#!/usr/bin/env node
// 观己 · 真机端到端回归(e2e)
//
// 把 2026-11-02 的手工无头验证(V1/V2/V3,见 docs/notes.md §四)固化为可复跑断言。
// 与 smoke.mjs 的区别:smoke 全程本地伪造;e2e 走真实宿主(会消耗少量真实 API token)。
//
// 前置:aopc 在 PATH、selfaware 已安装且 ≥0.4.0(Stop 刷预算行为才存在)。
// 用法:node scripts/e2e.mjs [--skip-subagent](--skip-subagent 省 token,跳过 V2/V3)
// 数据落点:真实 ~/.aopc 数据目录(不清理——那是真会话,也是 self_history 的养料)。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA = path.join(os.homedir(), ".aopc/cli/plugins/data/selfaware@aopc-ai-tool");
const EVENTS = path.join(DATA, "events");
const STATE = path.join(DATA, "state.json");

let passed = 0;
let failed = 0;
const check = (name, cond, detail = "") => {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

function snapshots() {
  const files = fs.existsSync(EVENTS) ? fs.readdirSync(EVENTS).filter((f) => f.endsWith(".jsonl")) : [];
  const known = new Set(files);
  const state = (() => {
    try {
      return JSON.parse(fs.readFileSync(STATE, "utf8"));
    } catch {
      return {};
    }
  })();
  return { known, state };
}

function runAopc(prompt, cwd, timeoutMs = 240000) {
  const r = spawnSync("aopc", ["-p", prompt, "--cwd", cwd], { encoding: "utf8", timeout: timeoutMs });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function eventsFor(sid) {
  try {
    return fs.readFileSync(path.join(EVENTS, `${sid}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

// ---------- 前置 ----------

console.log("[前置] aopc 与插件安装检查");
const v = spawnSync("aopc", ["--version"], { encoding: "utf8", timeout: 15000 });
check("aopc 可用", v.status === 0, v.stderr?.split("\n")[0]);
const installed = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".aopc/cli/plugins/installed_plugins.json"), "utf8"));
  } catch {
    return {};
  }
})();
const versionStr = JSON.stringify(installed).match(/selfaware[^,"]*\/?"?\s*:\s*"?([\d.]+)?/)?.[1] || JSON.stringify(installed).match(/selfaware\/([\d.]+)/)?.[1] || "?";
console.log(`  已安装版本探测:${versionStr}(断言要求 ≥0.4.0 的行为)`);
check("插件数据目录存在", fs.existsSync(DATA));

// ---------- V1:最小提示 → hook 全链 ----------

console.log("\n[V1] 最小提示:SessionStart→UserPromptSubmit→Stop 全链 + provider 预算(需 ≥0.4.0)");
{
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sa-e2e-"));
  const before = snapshots();
  const r = runAopc("只回复两个字:就绪。不要调用任何工具。", cwd);
  check("aopc 退出码 0", r.status === 0, r.out.slice(-200));
  const after = snapshots();
  const newSid = [...after.known].filter((f) => !before.known.has(f)).sort((a, b) => b.localeCompare(a))[0]?.replace(/\.jsonl$/, "");
  check("产生了新会话事件文件", !!newSid, JSON.stringify([...after.known]));
  if (newSid) {
    const evs = eventsFor(newSid);
    const kinds = evs.map((e) => e.ev);
    check("session_start 在场", kinds.includes("session_start"));
    check("user_prompt 在场(隐私:只记长度)", evs.some((e) => e.ev === "user_prompt" && typeof e.chars === "number"));
    check("segment_end 在场", kinds.includes("segment_end"));
    const st = after.state.sessions?.[newSid];
    check("state 有该会话", !!st);
    check("Stop 刷新预算生效(v0.4.0 行为):src=provider", st?.budget?.src === "provider", JSON.stringify(st?.budget));
    if (st?.budget?.src !== "provider" && String(versionStr).startsWith("0.")) {
      console.log(`  (提示:若安装版本 <0.4.0,此断言预期失败;请 marketplace update + install 后重跑)`);
    }
  }
  fs.rmSync(cwd, { recursive: true, force: true });
}

if (!process.argv.includes("--skip-subagent")) {
  // ---------- V2:子代理派发 → Agent 计数(C3 适配) ----------

  console.log("\n[V2] 子代理派发:主会话记录 Agent 计数;确认无 sess_subagent_ 事件(C3 负结果复现)");
  {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sa-e2e-"));
    const before = snapshots();
    const r = runAopc(
      "用 Agent 工具派出 Explore 类型子代理,任务『报告当前目录是否为空,一行完成』。完成后只汇报子代理是否派出成功。",
      cwd
    );
    check("aopc 退出码 0", r.status === 0, r.out.slice(-200));
    const after = snapshots();
    const newSid = [...after.known].filter((f) => !before.known.has(f)).sort((a, b) => b.localeCompare(a))[0]?.replace(/\.jsonl$/, "");
    if (newSid) {
      const st = after.state.sessions?.[newSid];
      check("Agent 派发计数 ≥1", (st?.toolCalls?.Agent || 0) >= 1, JSON.stringify(st?.toolCalls));
      const subFiles = [...after.known].filter((f) => f.startsWith("sess_subagent_"));
      check("确无子代理事件文件(C3 事实)", subFiles.length === 0, JSON.stringify(subFiles));
    } else {
      check("产生新会话事件文件", false);
    }
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  // ---------- V3:self_state 端到端 ----------

  console.log("\n[V3] MCP 端到端:主 agent 调 self_state 并回传");
  {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "sa-e2e-"));
    const r = runAopc("调用 selfaware 的 self_state 工具一次,然后把返回原文完整汇报,不要加工。", cwd);
    check("aopc 退出码 0", r.status === 0, r.out.slice(-200));
    check("self-state 结构化输出出现在汇报中", r.out.includes("<self-state>") && r.out.includes("主会话"), r.out.slice(-400));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

// ---------- 汇总 ----------

console.log(`\n结果:${passed} 通过,${failed} 失败${failed ? "(注意:e2e 依赖已安装版本 ≥0.4.0;先 marketplace update + install 再重跑)" : ""}`);
process.exit(failed ? 1 : 0);
