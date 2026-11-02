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
  dataRoot, configPath, loadConfig, loadState, saveState, journalPath,
  selfModelPath, playbooksDir, listEventSids, readEvents,
} from "./lib/state.mjs";
import { updateBudget, rolloutExists } from "./lib/budget.mjs";

const VERSION = "0.7.0";

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
    name: "self_config",
    description:
      "观己:查看或修改我的配置(注入开关/节流参数/上下文窗口/rolloutDir)。用户要求调整观己行为(『别再注入预算了』『复盘提醒关掉』)时使用;set 只接受白名单键且立即生效(hook 与 MCP 共用),无需手改 config.json。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "set"] },
        key: {
          type: "string",
          description:
            "set 时的键名,白名单:injectBudget / injectErrorWarn / injectReflectNudge / injectCriticNudge / contextWindow / budgetThrottle.mid|high|critical|midEveryTurns / reflectNudge.minSegments|minFailures / criticNudge.atEdits / rolloutDir",
        },
        value: { type: ["boolean", "number", "string"], description: "set 时的值" },
      },
      required: ["action"],
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
      case "self_config":
        return textResult(selfConfig(args));
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

/** 自我档案健康度(0.5.0):五段完整性、教训条数、最后变更——防复盘漂移的仪表 */
function selfModelHealth() {
  try {
    const md = fs.readFileSync(selfModelPath(), "utf8");
    // 按 "## " 标题切片取节内容(/m 的 $ 只匹配到行尾,正则版会在标题行截断——T19 教训)
    const section = (name) => {
      const lines = md.split("\n");
      const start = lines.findIndex((l) => l.trim() === `## ${name}`);
      if (start < 0) return "";
      let end = lines.length;
      for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ")) {
          end = i;
          break;
        }
      }
      return lines.slice(start + 1, end).join("\n");
    };
    const sections = ["我是谁", "我能做什么", "我的教训", "我与用户", "我的叙事"];
    const missing = sections.filter((s) => !section(s));
    const lessons = (section("我的教训").match(/^- /gm) || []).length;
    const changes = [...section("变更记录").matchAll(/^- \[([^\]]+)\]/gm)].map((m) => m[1]).filter((x) => x !== "初始化");
    const lastChange = changes[changes.length - 1] || "无";
    const pending = md.includes("待补") ? ",尚有占位待 /reflect 填充" : "";
    return `五段${missing.length ? "缺 " + missing.join("/") : "齐"},教训 ${lessons} 条,最后变更:${lastChange}${pending}`;
  } catch {
    return "不存在(下次 SessionStart 自动播种)";
  }
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
  // 0.4.0 适配 C3 真机结论:子代理内部工具调用不触发 hook,合并视角降级为派发计数
  const dispatches = cur ? cur.toolCalls?.Agent || 0 : 0;
  lines.push(`子代理派发:本会话 ${dispatches} 次(经 Agent 工具计数;子代理内部调用不经过 hook——C3 真机实测)`);
  if (st.outstandingDebt > 0) lines.push(`跨会话复盘债:${st.outstandingDebt} 次失败未复盘(跑 /reflect 清账)`);
  lines.push(`自我档案健康:${selfModelHealth()}`);
  lines.push(`自我档案:${selfModelPath()}${fs.existsSync(selfModelPath()) ? "" : "(尚未创建——首次 /reflect 时建立)"}`);
  lines.push(`playbook 目录:${playbooksDir()}`);
  lines.push(`反思日志:${journalPath()}`);
  lines.push("</self-state>");
  return lines.join("\n");
}

function selfErrors(limit) {
  const st = loadState();
  const cur = currentSid(st);
  const cfg = loadConfig();
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
    // 0.3.0 慢性错误:同一 工具×签名 跨 ≥3 个会话复发 → 这是习惯性问题,不是偶发
    const chronic = [...groups.values()].filter((g) => g.sids.size >= 3).sort((a, b) => b.sids.size - a.sids.size || b.count - a.count);
    if (chronic.length) {
      lines.push("⚠ 慢性错误(同一签名跨 ≥3 个会话复发——这是我的习惯性问题,建议按 self-review 流程固化为 playbook 规则):");
      for (const g of chronic.slice(0, 5)) {
        lines.push(`- ${g.tool} [${g.sig}] 跨 ${g.sids.size} 个会话共 ${g.count} 次,最近:"${(g.lastMsgHead || "").slice(0, 100)}"`);
      }
      // 0.4.0:惰性落提案到反思日志(同签名已有未拒提案则跳过),/reflect 时落地
      let proposed = 0;
      for (const g of chronic.slice(0, 5)) {
        const marker = `chronic:${g.tool}|${g.sig}`;
        const entries = readJournalEntries();
        if (entries.some((e) => e.kind === "playbook_proposal" && (e.refs || []).includes(marker) && e.status !== "rejected")) continue;
        appendJournalRecord(st, {
          t: Date.now(),
          kind: "playbook_proposal",
          title: `慢性错误:${g.tool} [${g.sig}] 跨 ${g.sids.size} 个会话复发`,
          body: `同一错误签名跨 ${g.sids.size} 个会话共 ${g.count} 次,最近:"${(g.lastMsgHead || "").slice(0, 120)}"。这是习惯性问题而非偶发,建议在下次 /reflect 时固化为 playbook 规则。`,
          lesson: `使用 ${g.tool} 遇到 [${g.sig}] 时,先检查已知诱因再重试`,
          playbookTarget: "",
          refs: [marker],
          status: "proposed",
          sessionId: cur?.sid || "",
        });
        proposed += 1;
      }
      if (proposed) lines.push(`  → 已自动记入 ${proposed} 条 playbook 提案(同签名去重),跑 /reflect 落地`);
    }
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
      lastMsg: "",
      sub: sid.startsWith("sess_subagent_"),
    };
    for (const ev of evs) {
      if (ev.ev === "user_prompt") r.turns += 1;
      else if (ev.ev === "tool_done") {
        if (ev.ok) r.calls += 1;
        else if (!ev.interrupt) r.errors += 1;
      } else if (ev.ev === "segment_end" && ev.lastMsg) {
        r.lastMsg = ev.lastMsg; // 0.3.0:取最近一段叙事
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
    lines.push(
      `- ${r.sub ? "[子] " : ""}${r.sid} ${fmtDate(r.lastAt)} · ${r.turns} 轮 · ${r.calls} 次工具 · ${r.errors} 败${total ? `(失败率 ${rate}%)` : ""}` +
        (r.lastMsg ? `\n    最近在做:"${r.lastMsg.slice(0, 80)}"` : "")
    );
  }
  const tot = rows.reduce((a, r) => ({ turns: a.turns + r.turns, calls: a.calls + r.calls, errors: a.errors + r.errors }), { turns: 0, calls: 0, errors: 0 });
  const totAll = tot.calls + tot.errors;
  lines.push(`累计:${tot.turns} 轮 / ${tot.calls} 次工具调用 / ${tot.errors} 次失败${totAll ? `(失败率 ${Math.round((tot.errors / totAll) * 100)}%)` : ""}`);
  lines.push("</self-history>");
  return lines.join("\n");
}

function fmtDate(t) {
  // 0.7.0:本地时区展示(此前是 UTC,对 UTC+8 的用户傍晚后的会话会显示成"明天凌晨")
  try {
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "?";
  }
}

// ---------- 配置读写(0.6.0:白名单键,hook 与 MCP 共用 config.json) ----------

const CONFIG_SCHEMA = {
  injectBudget: { type: "boolean" },
  injectErrorWarn: { type: "boolean" },
  injectReflectNudge: { type: "boolean" },
  injectCriticNudge: { type: "boolean" },
  contextWindow: { type: "int", min: 1000 },
  "budgetThrottle.mid": { type: "num", min: 0, max: 1 },
  "budgetThrottle.high": { type: "num", min: 0, max: 1 },
  "budgetThrottle.critical": { type: "num", min: 0, max: 1 },
  "budgetThrottle.midEveryTurns": { type: "int", min: 1 },
  "reflectNudge.minSegments": { type: "int", min: 1 },
  "reflectNudge.minFailures": { type: "int", min: 1 },
  "criticNudge.atEdits": { type: "int", min: 1 },
  rolloutDir: { type: "string" },
};

function readRawConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeRawConfig(raw) {
  fs.mkdirSync(dataRoot(), { recursive: true });
  const tmp = configPath() + ".tmp-" + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2) + "\n");
  fs.renameSync(tmp, configPath());
}

function setConfigPath(raw, keyPath, value) {
  const parts = keyPath.split(".");
  let node = raw;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof node[parts[i]] !== "object" || node[parts[i]] === null) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

function selfConfig(args) {
  if (args.action === "get") {
    const cfg = loadConfig();
    return ["<self-config>", JSON.stringify(cfg, null, 2), `配置文件:${configPath()}(也可直接手改,立即生效)`, "</self-config>"].join("\n");
  }
  // set
  const key = String(args.key || "");
  const rule = CONFIG_SCHEMA[key];
  if (!rule) {
    throw new Error(`未知或不可配置的键:${key}。白名单:${Object.keys(CONFIG_SCHEMA).join(", ")}`);
  }
  const v = args.value;
  if (rule.type === "boolean" && typeof v !== "boolean") throw new Error(`${key} 需要 boolean,收到:${JSON.stringify(v)}`);
  if (rule.type === "int" && (!Number.isFinite(v) || !Number.isInteger(v) || v < rule.min)) throw new Error(`${key} 需要 ≥${rule.min} 的整数,收到:${JSON.stringify(v)}`);
  if (rule.type === "num" && (!Number.isFinite(v) || v < rule.min || v > rule.max)) throw new Error(`${key} 需要 ${rule.min}–${rule.max} 的数,收到:${JSON.stringify(v)}`);
  if (rule.type === "string" && typeof v !== "string") throw new Error(`${key} 需要 string,收到:${JSON.stringify(v)}`);
  const raw = readRawConfig();
  setConfigPath(raw, key, v);
  writeRawConfig(raw);
  const cfg = loadConfig();
  return [
    `已更新 ${key} = ${JSON.stringify(v)},立即生效(新 hook 进程与 MCP 共用此文件)。`,
    "当前生效配置:",
    JSON.stringify(cfg, null, 2),
  ].join("\n");
}

// ---------- journal 助手(0.4.0:供 self_journal 与慢性错误自提案共用) ----------

function readJournalEntries() {
  try {
    return fs
      .readFileSync(journalPath(), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function appendJournalRecord(st, rec) {
  st.journalSeq = (st.journalSeq || 0) + 1;
  rec.id = `j${String(st.journalSeq).padStart(3, "0")}`;
  fs.mkdirSync(dataRoot(), { recursive: true });
  fs.appendFileSync(journalPath(), JSON.stringify(rec) + "\n");
  saveState(st);
  return rec;
}

/** 复盘产出(失败复盘/自省报告/规则落地)清全部复盘债 */
function clearReflectDebt(st) {
  st.outstandingDebt = 0;
  for (const s of Object.values(st.sessions)) {
    s.failuresSinceReflect = 0;
    s.carried = 0;
  }
}

function selfJournal(args) {
  if (args.action === "query") {
    const limit = Number(args.limit) || 15;
    const entries = readJournalEntries();
    const lines = [`<self-journal> 共 ${entries.length} 条,最近 ${Math.min(limit, entries.length)} 条:`];
    let stale = 0;
    const STALE_MS = 7 * 86400000;
    for (const e of entries.slice(-limit).reverse()) {
      const isStale = e.status === "proposed" && Date.now() - (e.t || 0) > STALE_MS;
      if (isStale) stale += 1;
      lines.push(
        `- ${isStale ? "⚠ 超 7 天未落地 " : ""}[${e.id}] ${new Date(e.t).toISOString().slice(0, 10)} ${e.kind}「${e.title}」` +
          `${e.lesson ? ` 规则:${e.lesson}` : ""}${e.playbookTarget ? ` → ${e.playbookTarget}` : ""}${e.status ? ` (${e.status})` : ""}`
      );
    }
    if (stale) lines.push(`⚠ ${stale} 条提案超过 7 天未落地:跑 /reflect 落地,或明确拒绝(status=rejected)——积压的提案等于没有提案`);
    lines.push("</self-journal>");
    return lines.join("\n");
  }
  // append
  const entry = args.entry || {};
  if (!entry.kind || !entry.title) throw new Error("append 需要 entry.kind 与 entry.title");
  const st = loadState();
  const rec = appendJournalRecord(st, {
    t: Date.now(),
    kind: entry.kind,
    title: String(entry.title).slice(0, 200),
    body: entry.body ? String(entry.body).slice(0, 4000) : "",
    lesson: entry.lesson ? String(entry.lesson).slice(0, 300) : "",
    playbookTarget: entry.playbookTarget ? String(entry.playbookTarget).replace(/[^\w.-]/g, "") : "",
    refs: Array.isArray(entry.refs) ? entry.refs.map(String).slice(0, 8) : [],
    status: ["playbook_proposal", "playbook_landed"].includes(entry.kind) ? "proposed" : "",
    sessionId: currentSid(st)?.sid || "",
  });
  // 复盘产出会清复盘债(设计 §7.2;0.4.0 起含跨会话债)
  if (rec.kind === "failure_postmortem" || rec.kind === "guanji_report" || rec.kind === "playbook_landed") {
    if (rec.kind === "failure_postmortem") st.reflect.lastLiteAt = rec.t;
    if (rec.kind === "guanji_report") st.reflect.lastDeepAt = rec.t;
    clearReflectDebt(st);
    saveState(st);
  }
  return `已记入反思日志:${rec.id} ${rec.kind}「${rec.title}」${rec.lesson ? `\n提炼规则:${rec.lesson}` : ""}\n自我模型与 playbook 的修订请用 Edit 直接改文件(会走权限审批,人审即安全边界)。`;
}

// ---------- 共享小工具 ----------

function sumVal(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + b, 0);
}

process.on("uncaughtException", (e) => {
  process.stderr.write(`[selfaware] ${e?.stack || e}\n`);
});
