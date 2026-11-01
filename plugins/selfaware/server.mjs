#!/usr/bin/env node
// 观己 · MCP stdio server(最小实现:initialize / tools/list / tools/call / ping)
// 零依赖,JSON-RPC 按行分隔,stdout 只写协议,日志走 stderr。
// 写法对照 aopc-ai-tool/plugins/douyin-pilot/mcp-server/server.mjs(P1 确认的稳定范本)。
//
// 工具(设计 §4.4):
//   self_state   主/子分列的会话快照
//   self_errors  聚合错误史
//   self_usage   上下文预算详情
//   self_journal 反思日志读写(L2 写,L3/L4 读)

import fs from "node:fs";
import path from "node:path";
import {
  dataRoot, loadConfig, loadState, saveState, journalPath,
  selfModelPath, playbooksDir, listEventSids, readEvents,
} from "./lib/state.mjs";
import { updateBudget, rolloutExists } from "./lib/budget.mjs";

const VERSION = "0.2.0";

const TOOLS = [
  {
    name: "self_state",
    description:
      "观己:读取我(主会话 + 子代理)此刻的自我状态——turn 数、工具调用与失败计数、上下文预算、连败情况、自我档案与 playbook 路径。想了解自己当前状态、被用户问『你现在上下文还剩多少』、或准备评估要不要收敛时调用。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "self_errors",
    description:
      "观己:查询我的聚合错误史(按工具与错误签名分组,含最近原始事件)。失败复盘、判断是否在重复踩同一个坑时调用。",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "返回最近 N 条原始失败事件,默认 20" } },
    },
  },
  {
    name: "self_usage",
    description:
      "观己:查询我的上下文预算详情——已用量、窗口、占比、近几轮燃烧速率、数据来源(provider 实测或估算)。规划剩余工作该不该收敛时调用。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "self_history",
    description:
      "观己:跨会话的自传体记忆——我最近经历过哪些会话(各自轮数、工具调用、失败率、活跃时间)与累计统计。回答『我最近在忙什么』『我的失败率趋势如何』、建立自我叙事时调用。",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "返回最近 N 个会话,默认 10" } },
    },
  },
  {
    name: "self_journal",
    description:
      "观己:读写我的反思日志。action=append 记录失败复盘/置信度自评/自省报告/playbook 提案(entry: {kind, title, body?, lesson?, playbookTarget?});action=query 查询近期条目。复盘与教训必须落在这里,否则自我模型无法引用。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["append", "query"] },
        entry: {
          type: "object",
          description: "append 时的条目内容",
          properties: {
            kind: { type: "string", enum: ["failure_postmortem", "confidence_review", "critic_verdict", "guanji_report", "playbook_proposal", "playbook_landed"] },
            title: { type: "string" },
            body: { type: "string" },
            lesson: { type: "string", description: "提炼出的一条可执行规则" },
            playbookTarget: { type: "string", description: "建议落进的 playbook 文件名" },
            refs: { type: "array", items: { type: "string" }, description: "出处引用(会话/轮次/journal id)" },
          },
          required: ["kind", "title"],
        },
        limit: { type: "number" },
      },
      required: ["action"],
    },
  },
];

// ---------- JSON-RPC over stdio ----------

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    handleMessage(line);
  }
});
process.stdin.on("end", () => {
  // 不主动 exit:等 stdout 把待发响应 flush 完,事件循环空了自然退出
});

function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (!msg || typeof msg !== "object") return;
  if (msg.id === undefined || msg.id === null) return; // notification,忽略

  let result;
  try {
    result = dispatch(msg);
  } catch (e) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e?.message || e) } });
    return;
  }
  send({ jsonrpc: "2.0", id: msg.id, result });
}

function dispatch(msg) {
  const { method, params } = msg;
  if (method === "initialize") {
    return {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "selfaware", version: VERSION },
    };
  }
  if (method === "ping") return {};
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") return callTool(params);
  throw new Error(`method not found: ${method}`);
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

// ---------- 工具实现 ----------

function callTool(params) {
  const name = params?.name;
  const args = params?.arguments || {};
  try {
    switch (name) {
      case "self_state":
        return textResult(selfState());
      case "self_errors":
        return textResult(selfErrors(Number(args.limit) || 20));
      case "self_usage":
        return textResult(selfUsage());
      case "self_history":
        return textResult(selfHistory(Number(args.limit) || 10));
      case "self_journal":
        return textResult(selfJournal(args));
      default:
        return textResult(`unknown tool: ${name}`, true);
    }
  } catch (e) {
    return textResult(`selfaware 工具执行失败:${e?.message || e}(数据目录:${dataRoot()})`, true);
  }
}

/** 最近活跃的主会话(子代理除外) */
function currentSid(st) {
  const mains = Object.values(st.sessions).filter((s) => !s.sub);
  mains.sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
  return mains[0] || null;
}

function fmtBudget(b) {
  if (!b) return "尚无数据(尚未发生 UserPromptSubmit,或 rollout 文件不可读)";
  const srcTag = b.src === "provider" ? "provider 实测" : `字节估算`;
  return `已用约 ${b.percent}%(${fmtK(b.used)}/${fmtK(b.window)} tokens,${srcTag},confidence=${b.confidence}),近几轮平均每轮多耗 ${b.burn} tokens`;
}

function fmtK(n) {
  return Math.round((n || 0) / 100) / 10 + "k";
}

function selfState() {
  const st = loadState();
  const cfg = loadConfig();
  const cur = currentSid(st);
  // 尝试刷新预算( server 常驻,可以做稍重的活)
  if (cur) {
    try {
      updateBudget(cur.sid, cur, cfg);
    } catch {}
  }
  const subs = Object.values(st.sessions).filter((s) => s.sub);
  const subAgg = {
    sessions: subs.length,
    toolCalls: subs.reduce((a, s) => a + sumVal(s.toolCalls), 0),
    errors: subs.reduce((a, s) => a + sumVal(s.errors), 0),
  };
  const lines = [];
  lines.push("<self-state>");
  if (cur) {
    lines.push(`主会话 ${cur.sid}(turns=${cur.turns},工作段=${cur.segments},自上次复盘失败累计=${cur.failuresSinceReflect})`);
    lines.push(`上下文预算:${fmtBudget(cur.budget)}`);
    const calls = Object.entries(cur.toolCalls).sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push(`工具调用 TOP:${calls.length ? calls.map(([t, n]) => `${t}×${n}`).join(", ") : "尚无"}`);
    const errs = Object.entries(cur.errors);
    lines.push(`本会话失败:${errs.length ? errs.map(([t, n]) => `${t}×${n}`).join(", ") : "无"}`);
    const streaks = Object.entries(cur.streaks).filter(([, v]) => v.count >= 2);
    if (streaks.length) lines.push(`连败告警:${streaks.map(([t, v]) => `${t}×${v.count}(${v.sig})`).join("; ")}`);
  } else {
    lines.push("主会话:暂无观察数据(观己 hook 尚未在本会话运行,或为新装插件)");
  }
  lines.push(`子代理(合并视角):${subAgg.sessions} 个会话、${subAgg.toolCalls} 次工具调用、${subAgg.errors} 次失败`);
  lines.push(`自我档案:${selfModelPath()}${fs.existsSync(selfModelPath()) ? "" : "(尚未创建——首次 /reflect 时建立)"}`);
  lines.push(`playbook 目录:${playbooksDir()}`);
  lines.push(`反思日志:${journalPath()}`);
  lines.push("</self-state>");
  return lines.join("\n");
}

function selfErrors(limit) {
  const st = loadState();
  const cfg = loadConfig();
  const cur = currentSid(st);
  if (cur) {
    try {
      updateBudget(cur.sid, cur, cfg);
    } catch {}
  }
  // 聚合全部会话的失败事件
  const groups = new Map(); // tool|sig -> {tool, sig, count, lastAt, lastMsgHead, sids:Set}
  const raw = [];
  for (const sid of listEventSids()) {
    for (const ev of readEvents(sid)) {
      if (ev.ev !== "tool_done" || ev.ok !== false || ev.interrupt) continue;
      const key = `${ev.tool}|${ev.sig || "?"}`;
      const g = groups.get(key) || { tool: ev.tool, sig: ev.sig || "?", count: 0, lastAt: 0, lastMsgHead: "", sids: new Set() };
      g.count += 1;
      g.lastAt = Math.max(g.lastAt, ev.t || 0);
      g.lastMsgHead = ev.msgHead || g.lastMsgHead;
      g.sids.add(sid);
      groups.set(key, g);
      raw.push(ev);
    }
  }
  raw.sort((a, b) => (b.t || 0) - (a.t || 0));
  const lines = ["<self-errors>"];
  if (!groups.size) {
    lines.push("错误史为空:本机观察范围内没有记录到工具失败。");
  } else {
    lines.push("按 工具×签名 分组(降序):");
    for (const g of [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 12)) {
      lines.push(`- ${g.tool} ×${g.count} [${g.sig}] 最近:"${(g.lastMsgHead || "").slice(0, 120)}"(${g.sids.size} 个会话)`);
    }
    lines.push(`最近 ${Math.min(limit, raw.length)} 条原始事件:`);
    for (const ev of raw.slice(0, limit)) {
      lines.push(`  ${new Date(ev.t).toISOString().slice(5, 16)} ${ev.tool} [${ev.sig || "?"}] ${(ev.msgHead || "").slice(0, 100)}`);
    }
  }
  lines.push("</self-errors>");
  return lines.join("\n");
}

function selfUsage() {
  const st = loadState();
  const cfg = loadConfig();
  const cur = currentSid(st);
  if (!cur) return "<self-usage> 暂无会话数据。</self-usage>";
  let budget;
  try {
    budget = updateBudget(cur.sid, cur, cfg);
  } catch {}
  const lines = ["<self-usage>"];
  lines.push(`会话:${cur.sid}`);
  lines.push(`预算:${fmtBudget(budget)}`);
  lines.push(`窗口假设:${cfg.contextWindow} tokens(可在 ${path.join(dataRoot(), "config.json")} 的 contextWindow 调整)`);
  lines.push(`rollout 增量读偏移:${cur.rolloutOffset} 字节,rollout 存在=${rolloutExists(cur.sid)}`);
  if ((cur.samples || []).length >= 2) {
    lines.push("最近样本:" + cur.samples.map((s) => `${fmtK(s.used)}@${new Date(s.t).toISOString().slice(11, 19)}`).join(" → "));
  }
  lines.push("</self-usage>");
  return lines.join("\n");
}

function selfHistory(limit) {
  const rows = [];
  for (const sid of listEventSids()) {
    const evs = readEvents(sid);
    if (!evs.length) continue;
    const r = {
      sid,
      startedAt: evs[0].t || 0,
      lastAt: evs[evs.length - 1].t || 0,
      turns: 0,
      calls: 0,
      errors: 0,
      sub: sid.startsWith("sess_subagent_"),
    };
    for (const ev of evs) {
      if (ev.ev === "user_prompt") r.turns += 1;
      else if (ev.ev === "tool_done") {
        if (ev.ok) r.calls += 1;
        else if (!ev.interrupt) r.errors += 1;
      }
    }
    rows.push(r);
  }
  rows.sort((a, b) => b.lastAt - a.lastAt);
  const picked = rows.slice(0, limit);
  const lines = [`<self-history> 共 ${rows.length} 个有记录的会话,最近 ${picked.length} 个(按活跃时间):`];
  for (const r of picked) {
    const total = r.calls + r.errors;
    const rate = total ? Math.round((r.errors / total) * 100) : 0;
    lines.push(`- ${r.sub ? "[子] " : ""}${r.sid} ${fmtDate(r.lastAt)} · ${r.turns} 轮 · ${r.calls} 次工具 · ${r.errors} 败${total ? `(失败率 ${rate}%)` : ""}`);
  }
  const tot = rows.reduce((a, r) => ({ turns: a.turns + r.turns, calls: a.calls + r.calls, errors: a.errors + r.errors }), { turns: 0, calls: 0, errors: 0 });
  const totAll = tot.calls + tot.errors;
  lines.push(`累计:${tot.turns} 轮 / ${tot.calls} 次工具调用 / ${tot.errors} 次失败${totAll ? `(失败率 ${Math.round((tot.errors / totAll) * 100)}%)` : ""}`);
  lines.push("</self-history>");
  return lines.join("\n");
}

function fmtDate(t) {
  try {
    return new Date(t).toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return "?";
  }
}

function selfJournal(args) {
  if (args.action === "query") {
    const limit = Number(args.limit) || 15;
    let entries = [];
    try {
      entries = fs.readFileSync(journalPath(), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch {}
    const lines = [`<self-journal> 共 ${entries.length} 条,最近 ${Math.min(limit, entries.length)} 条:`];
    for (const e of entries.slice(-limit).reverse()) {
      lines.push(`- [${e.id}] ${new Date(e.t).toISOString().slice(0, 10)} ${e.kind}「${e.title}」${e.lesson ? ` 规则:${e.lesson}` : ""}${e.playbookTarget ? ` → ${e.playbookTarget}` : ""}${e.status ? ` (${e.status})` : ""}`);
    }
    lines.push("</self-journal>");
    return lines.join("\n");
  }
  // append
  const entry = args.entry || {};
  if (!entry.kind || !entry.title) throw new Error("append 需要 entry.kind 与 entry.title");
  const st = loadState();
  const seq = (st.journalSeq || 0) + 1;
  st.journalSeq = seq;
  const rec = {
    id: `j${String(seq).padStart(3, "0")}`,
    t: Date.now(),
    kind: entry.kind,
    title: String(entry.title).slice(0, 200),
    body: entry.body ? String(entry.body).slice(0, 4000) : "",
    lesson: entry.lesson ? String(entry.lesson).slice(0, 300) : "",
    playbookTarget: entry.playbookTarget ? String(entry.playbookTarget).replace(/[^\w.-]/g, "") : "",
    refs: Array.isArray(entry.refs) ? entry.refs.map(String).slice(0, 8) : [],
    status: ["playbook_proposal", "playbook_landed"].includes(entry.kind) ? "proposed" : "",
    sessionId: currentSid(st)?.sid || "",
  };
  fs.mkdirSync(dataRoot(), { recursive: true });
  fs.appendFileSync(journalPath(), JSON.stringify(rec) + "\n");
  // 复盘产出会清复盘债(设计 §7.2)
  if (rec.kind === "failure_postmortem" || rec.kind === "guanji_report") {
    st.reflect.lastLiteAt = rec.t;
    if (rec.kind === "guanji_report") st.reflect.lastDeepAt = rec.t;
    for (const s of Object.values(st.sessions)) s.failuresSinceReflect = 0;
  }
  saveState(st);
  return `已记入反思日志:${rec.id} ${rec.kind}「${rec.title}」${rec.lesson ? `\n提炼规则:${rec.lesson}` : ""}\n自我模型与 playbook 的修订请用 Edit 直接改文件(会走权限审批,人审即安全边界)。`;
}

// ---------- 共享小工具 ----------

function sumVal(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + b, 0);
}

process.on("uncaughtException", (e) => {
  process.stderr.write(`[selfaware] ${e?.stack || e}\n`);
});
