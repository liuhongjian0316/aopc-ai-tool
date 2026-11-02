#!/usr/bin/env node
// 观己 · 观察器 hook —— 每个事件一个进程,快进快出(目标 <200ms)
//
// 职责:① append 事件到 events/<sid>.jsonl(真源);② 更新 state.json 缓存;
//      ③ 按节流策略输出 {"additionalContext": "..."} 注入(设计 §4.3)。
// 铁律:观察器绝不阻断会话 —— 任何内部错误都静默降级、exit 0。
//
// stdin:hook 契约单行 JSON(session_id / hook_event_name / source / prompt /
//        tool_name / error / is_interrupt / stop_hook_active ...)

import fs from "node:fs";
import path from "node:path";
import {
  loadConfig, loadState, saveState, appendEvent, emptySession,
  selfModelPath, playbooksDir, eventsDir,
} from "../lib/state.mjs";
import { updateBudget } from "../lib/budget.mjs";
import { redact, errorSignature } from "../lib/redact.mjs";
import { SELF_MODEL_SKELETON, PLAYBOOK_README } from "../lib/templates.mjs";

/** 会改工作区文件的工具(0.3.0:用于编辑量统计与 critic 提醒)——必须先于 main() 声明 */
const FILE_TOOLS = new Set(["Edit", "Write", "ApplyPatch", "MultiEdit", "NotebookEdit"]);

main();

function main() {
  try {
    run();
  } catch {
    process.exitCode = 0; // 静默降级
  }
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return null;
    return JSON.parse(fs.readFileSync(0, "utf8").trim());
  } catch {
    return null;
  }
}

function run() {
  const input = readStdin();
  if (!input) return;
  const event = input.hook_event_name || input.hookEventName;
  if (!event) return;
  const sid = String(input.session_id || input.sessionId || "unknown");
  const isSub = sid.startsWith("sess_subagent_");
  const cfg = loadConfig();
  const st = loadState();
  const sess = st.sessions[sid] || (st.sessions[sid] = emptySession(sid));
  sess.sub = isSub; // 0.2.0 修复:显式标记,防 self_state 把子代理会话误选为主会话
  sess.lastActiveAt = Date.now();

  let inject = "";

  switch (event) {
    case "SessionStart": {
      const source = String(input.source || "startup");
      if (isSub) {
        appendEvent(sid, { ev: "session_start", source, sub: true });
        break;
      }
      appendEvent(sid, { ev: "session_start", source });
      if (source === "startup") pruneEvents(cfg); // 0.7.0:保留期惰性清理(仅 startup,避开 resume/compact 热路径)
      inject = source === "compact" ? compactBanner() : startBanner(st, bootstrapSelf());
      break;
    }

    case "UserPromptSubmit": {
      if (isSub) break;
      sess.turns += 1;
      appendEvent(sid, { ev: "user_prompt", turn: sess.turns, chars: String(input.prompt ?? "").length });
      updateBudget(sid, sess, cfg);
      appendEvent(sid, { ev: "budget", used: sess.budget?.used ?? 0, src: sess.budget?.src ?? "none" });
      if (cfg.injectBudget) inject = budgetLine(sess, cfg);
      break;
    }

    case "PostToolUse": {
      const tool = String(input.tool_name || input.toolName || "?");
      sess.toolCalls[tool] = (sess.toolCalls[tool] || 0) + 1;
      delete sess.streaks[tool]; // 成功即清连败
      appendEvent(sid, { ev: "tool_done", tool, ok: true });
      // 0.3.0:文件改动计数 → 编辑量大时一次性提醒派 critic 对抗审查
      if (cfg.injectCriticNudge && !isSub && FILE_TOOLS.has(tool)) {
        sess.fileEdits = (sess.fileEdits || 0) + 1;
        const at = (cfg.criticNudge || {}).atEdits ?? 10;
        if (sess.fileEdits === at) {
          inject = `<self-state> 本会话我已改动 ${sess.fileEdits} 处文件。收尾之前,要不要先派 critic 做一轮对抗性审查(重点:未验证假设与证据缺口)?</self-state>`;
        }
      }
      break;
    }

    case "PostToolUseFailure": {
      const tool = String(input.tool_name || input.toolName || "?");
      if (input.is_interrupt) {
        // 用户打断不算我的失败,只留痕
        appendEvent(sid, { ev: "tool_done", tool, ok: false, interrupt: true });
        break;
      }
      sess.toolCalls[tool] = (sess.toolCalls[tool] || 0) + 1;
      sess.errors[tool] = (sess.errors[tool] || 0) + 1;
      sess.failuresSinceReflect += 1;
      const err = String(input.error ?? "");
      const sig = errorSignature(err);
      let streak = sess.streaks[tool];
      if (!streak || streak.sig !== sig) streak = { count: 0, sig, warned: false };
      streak.count += 1;
      streak.lastAt = Date.now();
      sess.streaks[tool] = streak;
      appendEvent(sid, { ev: "tool_done", tool, ok: false, sig, msgHead: redact(err, 300) });
      if (cfg.injectErrorWarn && !isSub && streak.count >= 3 && !streak.warned) {
        streak.warned = true;
        inject = `<self-state> 同类失败我已连吃 ${streak.count} 次(${tool}),已记入错误史。先调 self_errors 看看模式,别原样重试。</self-state>`;
      }
      break;
    }

    case "Stop": {
      if (isSub) break;
      sess.segments += 1;
      // 0.3.0:存叙事片段(我自己最后说的话,脱敏截断)——self_history 的"最近在做"由此而来
      const lastMsg = redact(String(input.last_assistant_message ?? input.lastAssistantMessage ?? ""), 200);
      appendEvent(sid, { ev: "segment_end", segments: sess.segments, lastMsg });
      // 0.4.0 修复:rollout 在本 turn 结束时已落盘(V1 真机实测),Stop 时刷新预算,
      // 否则首 turn/单 turn 会话的预算永远为 null
      updateBudget(sid, sess, cfg);
      const rn = cfg.reflectNudge || {};
      if (cfg.injectReflectNudge && sess.segments >= (rn.minSegments ?? 8) && sess.failuresSinceReflect >= (rn.minFailures ?? 3)) {
        sess.segments = 0;
        sess.failuresSinceReflect = 0; // 触发后清零,下次重新积累
        sess.carried = 0;
        inject = `<self-state> 这个会话我已积累复盘债(连续多段工作且有失败)。建议跑一次 /reflect 轻量复盘;若正在冲刺,继续也行。</self-state>`;
      }
      // 0.4.0:把未复盘失败增量并入全局复盘债(journal 落账时清零)。
      // 注意:Stop 每轮都触发,只能搬增量,否则会话内的 nudge 计数会被搬空(T5 教训)
      if (sess.failuresSinceReflect > (sess.carried || 0)) {
        st.outstandingDebt = (st.outstandingDebt || 0) + (sess.failuresSinceReflect - (sess.carried || 0));
        sess.carried = sess.failuresSinceReflect;
      }
      break;
    }
  }

  saveState(st);
  if (inject) emit({ additionalContext: inject });
}

// ---------- 注入文案(第一人称,拍板 #1) ----------

/** 0.7.0:事件日志保留期——超过 retentionDays 的会话事件文件在首个 startup 会话惰性清理(0 = 永久) */
function pruneEvents(cfg) {
  try {
    const days = Number(cfg.retentionDays ?? 90);
    if (!Number.isFinite(days) || days <= 0) return;
    const cutoff = Date.now() - days * 86400000;
    for (const f of fs.readdirSync(eventsDir())) {
      if (!f.endsWith(".jsonl")) continue;
      const p = path.join(eventsDir(), f);
      try {
        if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p);
      } catch {}
    }
  } catch {}
}

/** 首次会话自动播种自我档案与 playbooks 骨架(只创建,不覆盖);返回是否新建过 */
function bootstrapSelf() {
  let created = false;
  try {
    if (!fs.existsSync(selfModelPath())) {
      fs.mkdirSync(path.dirname(selfModelPath()), { recursive: true });
      fs.writeFileSync(selfModelPath(), SELF_MODEL_SKELETON);
      created = true;
    }
    if (!fs.existsSync(playbooksDir())) {
      fs.mkdirSync(playbooksDir(), { recursive: true });
      fs.writeFileSync(path.join(playbooksDir(), "README.md"), PLAYBOOK_README);
      created = true;
    }
  } catch {
    created = false;
  }
  return created;
}

/** 聚合 playbook 规则注入横幅(≤600 字符预算;P1 优先;规则躺文件里不读等于没有) */
function playbookDigest() {
  try {
    const files = fs.readdirSync(playbooksDir()).filter((f) => f.endsWith(".md") && f !== "README.md");
    const rules = [];
    for (const f of files) {
      for (const line of fs.readFileSync(path.join(playbooksDir(), f), "utf8").split("\n")) {
        const t = line.trim();
        if (/^-\s*\[P([123])\]/.test(t)) rules.push({ t, p: Number(RegExp.$1) });
      }
    }
    if (!rules.length) return "";
    rules.sort((a, b) => a.p - b.p); // 0.4.0:P1 必须遵守的先进预算
    let out = "";
    let used = 0;
    for (const r of rules) {
      if ((out + " " + r.t).length > 600) break;
      out += (out ? " " : "") + r.t;
      used += 1;
    }
    const more = used < rules.length ? ` …其余 ${rules.length - used} 条见 ${playbooksDir()}` : "";
    return ` 我的历史 playbook 规则:${out}${more}`;
  } catch {
    return "";
  }
}

function startBanner(st, bootstrapped) {
  let digest = "";
  try {
    const md = fs.readFileSync(selfModelPath(), "utf8");
    const m = md.match(/##\s*我是谁\s*\n+([^\n#>]+)/);
    if (m) digest = `档案摘要:${m[1].trim().slice(0, 160)}`;
  } catch {}
  const last = st.reflect?.lastDeepAt
    ? `上次深度复盘:${Math.max(1, Math.round((Date.now() - st.reflect.lastDeepAt) / 86400000))} 天前。`
    : "尚无深度复盘记录(跑 /reflect 可建立与修订自我档案)。";
  const debt = st.outstandingDebt || 0;
  const debtLine = debt > 0 ? `跨会话未复盘失败累计 ${debt} 次(跑 /reflect 清账)。` : "";
  const init = bootstrapped ? "首次挂载,已自动初始化自我档案与 playbooks 骨架。" : "";
  return (
    `<self-state> 观己已挂载:本会话中我能感知自己的状态。${init}${last}${debtLine}` +
    `自我档案与 playbook 在 ${selfModelPath()}(按需 Read;更新只走复盘)。` +
    `查自身状态/错误史/上下文/跨会话历史:调 self_state / self_errors / self_usage / self_history。` +
    `${digest}${playbookDigest()}</self-state>`
  );
}

function compactBanner() {
  return `<self-state> 我的上下文刚被压缩:此前对话已成摘要,压缩前的状态已存档进事件日志;我的自我档案(self-model)不受影响。接下来几轮我会先确认关键上下文仍在,再继续。</self-state>`;
}

function budgetLine(sess, cfg) {
  const b = sess.budget;
  if (!b) return "";
  const th = cfg.budgetThrottle || {};
  const p = b.percent / 100;
  const mid = th.mid ?? 0.3;
  const high = th.high ?? 0.6;
  const critical = th.critical ?? 0.85;
  const due =
    p >= high ||
    (p >= mid && sess.turns - sess.lastInject.budgetTurn >= (th.midEveryTurns ?? 10));
  if (!due) return "";
  sess.lastInject.budgetTurn = sess.turns;
  const usedK = Math.round(b.used / 100) / 10;
  const winK = Math.round(b.window / 100) / 10;
  const srcTag = b.src === "provider" ? "provider 实测" : `估算·${b.confidence}`;
  const tail =
    p >= critical
      ? "我快满了:立即收敛范围、把中间产物落盘,或主动请求压缩。"
      : "要不要收敛范围,或先把中间产物落盘?";
  return (
    `<self-state> 我的上下文已用约 ${b.percent}%(${usedK}k/${winK}k,${srcTag}),` +
    `近几轮平均每轮多耗 ${b.burn || 0} tokens;到目前为止我调用了 ${sum(sess.toolCalls)} 次工具、失败 ${sum(sess.errors)} 次。${tail}</self-state>`
  );
}

// ---------- 工具 ----------

function sum(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + b, 0);
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
