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
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

// 面板资源(0.8.0):panel.html 以 ui:// 资源分发(text/html;profile=mcp-app,MCP App 规范),
// 模式照搬 wudi-coding / obsidian-kb:manifest ui.surfaces → resources/list+read → 自包含单文件。
const PANEL_URI = "ui://selfaware/panel.html";
const PANEL_MIME = "text/html;profile=mcp-app";
const panelPath = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), "panel.html"));
function readPanel() {
  if (!fs.existsSync(panelPath)) throw new Error(`面板文件缺失:${panelPath}(先运行 scripts/build-panel.mjs)`);
  return fs.readFileSync(panelPath, "utf-8");
}
import {
  dataRoot, configPath, loadConfig, loadState, saveState, journalPath,
  selfModelPath, selfDir, playbooksDir, listEventSids, readEvents,
  missionPath, readMission, writeMission, missionDay,
} from "./lib/state.mjs";
import { updateBudget, rolloutExists } from "./lib/budget.mjs";

const VERSION = "2.3.0";

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
    name: "self_mission",
    description:
      "观己:使命管理——跨会话的持久目标意识。action=start 立一项使命(如『自主运营抖音号』);action=note 记一笔工作日志(开工/收工/里程碑);action=close 结项;action=get 查看当前使命与近期记录。自主运营场景(长期托管某项事务)必须用:它会出现在每次会话开场横幅,让 agent 睁眼就知道自己有一项进行中的事。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["get", "start", "note", "close", "obstacle", "resolve", "publish", "measure", "void"] },
        title: { type: "string", description: "start:使命标题(一句话);resolve:已研究的困难知识标题(将写入知识库);publish:发布的内容标题" },
        goal: { type: "string", description: "start:完成判据/目标(可选)" },
        autonomy: { type: "string", enum: ["supervised", "full"], description: "start:自主等级。full=完全自主(日常发布与数据分析无需逐条请示,红线仍须请示);supervised=受监督(默认)" },
        text: { type: "string", description: "note/close/obstacle:本条记录内容(obstacle 描述遇到的困难与已尝试的方案)" },
        ref: { type: "string", description: "publish:内容引用标识(视频 ID/链接/文件名)" },
        id: { type: "string", description: "resolve:要消化的困难条目 id(d001…);measure:要回访度量的台账条目 id(v001…)" },
        stats: { type: "string", description: "measure:度量结果(一段话;若能拿到数字,优先用下面的结构化字段)" },
        views: { type: "number", description: "measure:播放数(结构化,面板趋势用)" },
        likes: { type: "number", description: "measure:点赞数" },
        comments: { type: "number", description: "measure:评论数" },
        completion: { type: "number", description: "measure:完播率 0-100(%)" },
        follows: { type: "number", description: "measure:新增关注数" },
        body: { type: "string", description: "resolve:研究正文——机制是什么、为什么会这样、下次怎么更快(写入知识库)" },
        tags: { type: "string", description: "resolve:附加标签(自动追加 troubleshooting)" },
        id: { type: "string", description: "resolve:要消化的困难条目 id(d001…)" },
        body: { type: "string", description: "resolve:研究正文——机制是什么、为什么会这样、下次怎么更快(写入知识库)" },
        tags: { type: "string", description: "resolve:附加标签(自动追加 troubleshooting)" },
      },
      required: ["action"],
    },
  },
  {
    name: "self_learn",
    description:
      "观己:每日学习时刻——把学到的新知识/亲历的经验写入用户的 Obsidian 知识库(带 agent 标识 frontmatter + git 自动提交 + 自动关联相关旧笔记)。每天至少 1 条。type=knowledge:机制/原理/资料要点(来源必须真实);type=experience:亲历经验——背景/做法/结果/教训(来自使命与日常运营)。写入前建议先 self_recall 查重。action=list 查看已写入的。知识库路径未配置时,先用 self_config 设 knowledgeBase.path。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["record", "list"] },
        type: { type: "string", enum: ["knowledge", "experience"], description: "record:条目类型,默认 knowledge" },
        title: { type: "string", description: "record:条目标题(一句话说清学到了什么/这条经验关于什么)" },
        body: { type: "string", description: "record:正文。knowledge 写来源/证据/怎么用;experience 写背景/做法/结果/教训与下次怎么做" },
        tags: { type: "string", description: "record:附加标签,逗号分隔(自动附加 观己/agent-written,experience 另加 agent-experience)" },
      },
      required: ["action"],
    },
  },
  {
    name: "self_recall",
    description:
      "观己:知识复利——从我自己写入知识库的笔记里按关键词召回相关内容。开工时用今日任务关键词回查(昨天学的今天用);研究困难前先查(可能已经学过相关);避免重复学习已掌握的内容。返回按匹配度排序的笔记标题、路径与命中行。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "关键词(可多个,空格/逗号分隔;命中任一即计分,命中越多越靠前)" },
        limit: { type: "number", description: "返回条数,默认 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "self_journal",

    description:
      "观己:读写我的反思日志。action=append 记录失败复盘/置信度自评/自省报告/playbook 提案;action=query 查询近期条目与提案状态;action=update 把提案状态流转为 landed/rejected(1.9.0 落地闭环:playbook 真正落进文件后必须回写状态,否则 ⚠ 过期提醒会一直挂着)。复盘与教训必须落在这里,否则自我模型无法引用。",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["append", "query", "update"] },
        id: { type: "string", description: "update:要流转状态的条目 id(j001…)" },
        status: { type: "string", enum: ["landed", "rejected"], description: "update:目标状态(landed=已落进 playbook,rejected=评估后放弃)" },
        note: { type: "string", description: "update:一句话说明(落到哪个文件/为何放弃)" },
        entry: {
          type: "object",
          description: "append 时的条目内容",
          properties: {
            kind: { type: "string", enum: ["failure_postmortem", "confidence_review", "critic_verdict", "guanji_report", "playbook_proposal", "playbook_landed", "user_feedback"] },
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
    send({ jsonrpc: "2.0", id: msg.id, error: { code: e?.code || -32603, message: String(e?.message || e) } });
    return;
  }
  send({ jsonrpc: "2.0", id: msg.id, result });
}

function dispatch(msg) {
  const { method, params } = msg;
  if (method === "initialize") {
    return {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: "selfaware", version: VERSION },
    };
  }
  if (method === "ping") return {};
  if (method === "resources/list") {
    return {
      resources: [
        {
          uri: PANEL_URI,
          name: "观己 · 自我仪表盘",
          title: "观己 · 自我仪表盘",
          description: "上下文预算、会话统计、慢性错误、跨会话历史与反思日志",
          mimeType: PANEL_MIME,
        },
      ],
    };
  }
  if (method === "resources/read") {
    const uri = params?.uri;
    if (uri !== PANEL_URI) {
      throw Object.assign(new Error(`未知资源:${uri}(可用:${PANEL_URI})`), { code: -32602 });
    }
    return { contents: [{ uri: PANEL_URI, mimeType: PANEL_MIME, text: readPanel() }] };
  }
  if (method === "tools/list") return { tools: TOOLS };
  if (method === "tools/call") return callTool(params);
  throw new Error(`method not found: ${method}`);
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function textResult(text, isError = false, structured = undefined) {
  return {
    content: [{ type: "text", text }],
    ...(structured !== undefined ? { structuredContent: structured } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

// ---------- 工具实现 ----------

function callTool(params) {
  const name = params?.name;
  const args = params?.arguments || {};
  try {
    let r;
    switch (name) {
      case "self_state":
        r = selfState();
        break;
      case "self_errors":
        r = selfErrors(Number(args.limit) || 20);
        break;
      case "self_usage":
        r = selfUsage();
        break;
      case "self_history":
        r = selfHistory(Number(args.limit) || 10);
        break;
      case "self_config":
        r = selfConfig(args);
        break;
      case "self_learn":
        r = selfLearn(args);
        break;
      case "self_recall":
        r = selfRecall(args);
        break;
      case "self_mission":
        r = selfMission(args);
        break;
      case "self_journal":
        r = selfJournal(args);
        break;
      default:
        return textResult(`unknown tool: ${name}`, true);
    }
    return typeof r === "string" ? textResult(r) : textResult(r.text, false, r.structured);
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

/** playbook 规则读取(P1 优先;面板 structuredContent 用) */
function readPlaybookRules() {
  const rules = [];
  try {
    for (const f of fs.readdirSync(playbooksDir()).filter((f) => f.endsWith(".md") && f !== "README.md")) {
      for (const line of fs.readFileSync(path.join(playbooksDir(), f), "utf8").split("\n")) {
        const t = line.trim();
        const m = t.match(/^-\s*\[P([123])\]/);
        if (m) rules.push({ p: Number(m[1]), text: t });
      }
    }
  } catch {}
  return rules.sort((a, b) => a.p - b.p).map((r) => r.text);
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
  const dispatches = cur ? cur.toolCalls?.Agent || 0 : 0;
  const health = selfModelHealth();
  const playbookRules = readPlaybookRules();
  const mission = readMission();
  const knowledge = kbStats(cfg); // 1.4.0:知识库(每日学习时刻的落点)
  const openDifficulties = (mission.open || []).filter((d) => d.status === "open");
  // 1.9.0:提案生命周期 + 困难老化——L4 账务仪表
  const journalEntries = readJournalEntries();
  const proposedEntries = journalEntries.filter((e) => e.status === "proposed");
  const staleProposals = proposedEntries.filter((e) => Date.now() - (e.t || 0) > 7 * 86400000).length;
  const oldestOpen = openDifficulties.slice().sort((a, b) => (a.t || 0) - (b.t || 0))[0];
  const difficultyAgingDays = oldestOpen ? Math.floor((Date.now() - (oldestOpen.t || 0)) / 86400000) : 0;
  const nowMs = Date.now();
  const ledgerAll = mission.ledger || [];
  const ledgerView = {
    awaiting: ledgerAll.filter((l) => l.status === "awaiting").length,
    due: ledgerAll.filter((l) => l.status === "awaiting" && nowMs - l.t >= 48 * 3600000).map((l) => ({ id: l.id, title: l.title, t: l.t })),
    voided: ledgerAll.filter((l) => l.status === "void").map((l) => ({ id: l.id, reason: l.voidReason })),
    recent: ledgerAll.slice(-5).reverse(),
    measuredAgg: ledgerAgg(ledgerAll),
  };
  // 1.3.0:自扩展资产清单——能力自扩展协议的可见性基础设施
  const playbookFiles = (() => {
    try {
      return fs.readdirSync(playbooksDir()).filter((f) => f.endsWith(".md"));
    } catch {
      return [];
    }
  })();
  const opsScripts = (() => {
    try {
      return fs.readdirSync(path.join(selfDir(), "ops", "scripts")).filter((f) => !f.startsWith("."));
    } catch {
      return [];
    }
  })();
  const structured = {
    session: cur
      ? {
          sid: cur.sid,
          turns: cur.turns,
          segments: cur.segments,
          failures: cur.failuresSinceReflect,
          toolCalls: cur.toolCalls || {},
          errors: cur.errors || {},
          streaks: Object.fromEntries(Object.entries(cur.streaks || {}).filter(([, v]) => v.count >= 2)),
          dispatches,
          budget: cur.budget,
          trail: (cur.trail || []).slice(-240),
        }
      : null,
    debt: st.outstandingDebt || 0,
    health,
    lastDeepAt: st.reflect?.lastDeepAt || 0,
    playbookRules,
    playbookFiles,
    knowledge,
    journal: { total: journalEntries.length, proposed: proposedEntries.length, staleProposals, landed: journalEntries.filter((e) => e.status === "landed").length },
    difficultyAgingDays,
    opsScripts,
    mission: {
      active: mission.active ? { ...mission.active, day: missionDay(mission.active) } : null,
      recentLog: mission.log.slice(-5).reverse(),
      openDifficulties,
      ledger: ledgerView,
    },
    paths: { data: dataRoot(), selfModel: selfModelPath(), playbooks: playbooksDir(), journal: journalPath() },
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
  // 0.4.0 适配 C3 真机结论:子代理内部工具调用不触发 hook,合并视角降级为派发计数
  lines.push(`子代理派发:本会话 ${dispatches} 次(经 Agent 工具计数;子代理内部调用不经过 hook——C3 真机实测)`);
  if (st.outstandingDebt > 0) lines.push(`跨会话复盘债:${st.outstandingDebt} 次失败未复盘(跑 /reflect 清账)`);
  if (mission.active) lines.push(`当前使命:「${mission.active.title}」(第 ${missionDay(mission.active)} 天)`);
  if (openDifficulties.length) lines.push(`待研究困难:${openDifficulties.length} 条(最老已挂 ${difficultyAgingDays} 天)——每日学习时刻消化`);
  lines.push(`提案生命周期:proposed ${proposedEntries.length}${staleProposals ? `(⚠ 超 7 天 ${staleProposals} 条)` : ""} / landed ${journalEntries.filter((e) => e.status === "landed").length}——update 流转闭环`);
  lines.push(`自扩展资产:自造脚本 ${opsScripts.length} 个 / playbook ${playbookFiles.length} 个(含 ${playbookFiles.filter((f) => f.endsWith("-ops.md")).length} 份领域手册);明细见 structured`);
  lines.push(`知识库:${knowledge.configured ? `累计 ${knowledge.total} 条 / 今日 ${knowledge.today} 条(${knowledge.path})` : "未配置——self_config set knowledgeBase.path 后,每日学习写入 Obsidian"}`);
  lines.push(`自我档案健康:${health}`);
  lines.push(`自我档案:${selfModelPath()}${fs.existsSync(selfModelPath()) ? "" : "(尚未创建——首次 /reflect 时建立)"}`);
  lines.push(`playbook 目录:${playbooksDir()}`);
  lines.push(`反思日志:${journalPath()}`);
  lines.push("</self-state>");
  return { text: lines.join("\n"), structured };
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
  const chronicArr = [...groups.values()].filter((g) => g.sids.size >= 3).sort((a, b) => b.sids.size - a.sids.size || b.count - a.count)
    .map((g) => ({ tool: g.tool, sig: g.sig, count: g.count, sessions: g.sids.size, lastMsgHead: g.lastMsgHead }));
  const groupsArr = [...groups.values()].sort((a, b) => b.count - a.count).map((g) => ({ tool: g.tool, sig: g.sig, count: g.count, sessions: g.sids.size, lastMsgHead: g.lastMsgHead }));
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
  return { text: lines.join("\n"), structured: { chronic: chronicArr, groups: groupsArr, rawCount: raw.length } };
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
  const dayMap = new Map(); // 0.9.0:按本地日聚合(图表数据源)
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
      const dkey = dayKey(ev.t);
      if (dkey) {
        if (!dayMap.has(dkey)) dayMap.set(dkey, { date: dkey, calls: 0, errors: 0, turns: 0 });
        const bucket = dayMap.get(dkey);
        if (ev.ev === "user_prompt") {
          r.turns += 1;
          bucket.turns += 1;
        } else if (ev.ev === "tool_done") {
          if (ev.ok) {
            r.calls += 1;
            bucket.calls += 1;
          } else if (!ev.interrupt) {
            r.errors += 1;
            bucket.errors += 1;
          }
        } else if (ev.ev === "segment_end" && ev.lastMsg) {
          r.lastMsg = ev.lastMsg; // 0.3.0:取最近一段叙事
        }
      }
    }
    rows.push(r);
  }
  rows.sort((a, b) => b.lastAt - a.lastAt);
  const picked = rows.slice(0, limit);
  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
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
  lines.push(`近 ${daily.length} 天活跃:${daily.map((d) => `${d.date.slice(5)}:${d.calls}+${d.errors}败`).join(" ")}`);
  lines.push("</self-history>");
  return {
    text: lines.join("\n"),
    structured: {
      totalSessions: rows.length,
      sessions: picked.map((r) => ({ sid: r.sid, sub: r.sub, lastAt: r.lastAt, turns: r.turns, calls: r.calls, errors: r.errors, lastMsg: r.lastMsg })),
      totals: tot,
      daily,
    },
  };
}

/** 本地日期键(YYYY-MM-DD) */
function dayKey(t) {
  if (!t) return "";
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

// ---------- 配置读写(0.6.0:白名单键,hook 与 MCP 共用 config.json;1.4.0 增 knowledgeBase.* 与 retentionDays) ----------

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
  if (rule.values && !rule.values.includes(v)) throw new Error(`${key} 只接受:${rule.values.join("/")},收到:${JSON.stringify(v)}`);
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

// ---------- 使命(0.9.0:跨会话持久目标) ----------

function selfMission(args) {
  const action = args?.action || "get";
  const m = readMission();
  if (action === "get") {
    const st = loadState();
    return { text: missionText(m), structured: missionStructured(m, st) };
  }
  if (action === "start") {
    const title = String(args.title || "").trim();
    if (!title) throw new Error("start 需要 title(一句话说清这项使命)");
    const autonomy = args.autonomy === "full" ? "full" : "supervised";
    const st = loadState();
    if (m.active) {
      m.log.push({ t: Date.now(), kind: "close", text: `(被新使命顶替)${m.active.title}` });
    }
    m.active = {
      title: title.slice(0, 80),
      goal: String(args.goal || "").slice(0, 200),
      autonomy,
      startedAt: Date.now(),
    };
    m.log.push({ t: Date.now(), kind: "start", text: `${m.active.title}(自主等级:${autonomy === "full" ? "完全自主" : "受监督"})` });
    writeMission(m);
    const autoLine =
      autonomy === "full"
        ? "自主等级:完全自主——日常发布与数据分析无需逐条请示;删号/改账号定位/敏感内容/大额投放仍须先请示。"
        : "自主等级:受监督——对外动作(发布/回复)先过目再执行。";
    return {
      text: `使命已立:「${m.active.title}」(第 1 天)。${autoLine}它会出现在每次会话开场横幅——日常推进请用 action=note 记日志,阶段性用 /reflect 复盘。`,
      structured: missionStructured(m, st),
    };
  }
  if (action === "note") {
    const text = String(args.text || "").trim();
    if (!text) throw new Error("note 需要 text(今天做了什么/卡在哪)");
    const st = loadState();
    if (!m.active) throw new Error("当前没有进行中的使命;先 action=start 立项");
    m.log.push({ t: Date.now(), kind: "note", text: text.slice(0, 300) });
    writeMission(m);
    return { text: `已记入使命日志(「${m.active.title}」第 ${missionDay(m.active)} 天):${text.slice(0, 100)}`, structured: missionStructured(m, st) };
  }
  if (action === "close") {
    const st = loadState();
    if (!m.active) throw new Error("当前没有进行中的使命");
    const title = m.active.title;
    const startedAt = m.active.startedAt;
    const autonomy = m.active.autonomy;
    m.log.push({ t: Date.now(), kind: "close", text: `${title}——${String(args.text || "结项").slice(0, 200)}` });
    m.active = null;
    writeMission(m);
    // 1.6.0:结项自动沉淀经验到知识库(用户提供 experience 正文时)
    let kbLine = "";
    const exp = String(args.experience || "").trim();
    if (exp) {
      try {
        const cfg = loadConfig();
        const rec = kbRecord(cfg, {
          title: `使命经验:「${title}」(运行 ${missionDay({ startedAt })} 天)`,
          body: exp,
          tags: "mission-close",
          type: "experience",
        });
        kbLine = `\n经验已沉淀到知识库:${rec.file}${rec.git.committed ? "(已 git 提交)" : ""}`;
      } catch (e) {
        kbLine = `\n经验入库失败:${String(e?.message || e).slice(0, 120)}(正文已保留在本 note,可稍后手动 self_learn 补录)`;
      }
    }
    const autoLine = autonomy === "full" ? "本次为完全自主运行。" : "";
    return { text: `使命「${title}」已结项。${autoLine}建议跑 /reflect 把这段运营的经验教训固化进自我模型。${kbLine}`, structured: missionStructured(m, loadState()) };
  }
  if (action === "obstacle") {
    // 1.5.0:困难入队——遇到没把握的困难先记录,学习时刻研究消化
    const text = String(args.text || "").trim();
    if (!text) throw new Error("obstacle 需要 text(描述困难与已尝试的方案)");
    const seq = m.openSeq = (m.openSeq || 0) + 1;
    m.open = m.open || [];
    const item = { id: `d${String(seq).padStart(3, "0")}`, t: Date.now(), text: text.slice(0, 300), status: "open" };
    m.open.push(item);
    m.log.push({ t: Date.now(), kind: "obstacle", text: text.slice(0, 120) });
    writeMission(m);
    return { text: `困难已入队(${item.id}):${text.slice(0, 100)}\n当日学习时刻会研究它:机制是什么/为什么/下次怎么更快;研究完用 action=resolve 写入知识库并消化本条。`, structured: missionStructured(m, loadState()) };
  }
  if (action === "resolve") {
    // 1.5.0:消化困难——研究完成,知识写入知识库(带 agent 标识),队列标记 learned
    const item = (m.open || []).find((d) => d.id === String(args.id || "") && d.status === "open");
    if (!item) throw new Error(`未找到待研究的困难:${args.id || "(未传 id)"}(action=get 查看队列)`);
    const title = String(args.title || `困难研究:${item.text.slice(0, 40)}`).trim();
    const body = String(args.body || "").trim();
    if (!body) throw new Error("resolve 需要 body(研究正文:机制是什么、为什么会这样、下次怎么更快)");
    const cfg = loadConfig();
    const rec = kbRecord(cfg, { title, body, tags: `${args.tags || ""},troubleshooting` });
    item.status = "learned";
    item.resolvedAt = Date.now();
    item.kbNote = rec.file;
    m.log.push({ t: Date.now(), kind: "learned", text: `${item.id} → ${rec.file}` });
    writeMission(m);
    return {
      text: `困难 ${item.id} 已研究消化:${rec.mode === "append" ? "补充到" : "写入"}知识库 ${rec.file}${rec.git.committed ? "(已 git 提交)" : ""}。队列剩余 ${(m.open || []).filter((d) => d.status === "open").length} 条待研究。`,
      structured: missionStructured(m, loadState()),
    };
  }
  if (action === "publish") {
    // 1.8.0:内容实验台账——发布即立"假设",48h 后回访度量,周进化找模式
    const title = String(args.title || "").trim();
    if (!title) throw new Error("publish 需要 title(发布的内容标题)");
    const seq = m.ledgerSeq = (m.ledgerSeq || 0) + 1;
    m.ledger = m.ledger || [];
    const item = { id: `v${String(seq).padStart(3, "0")}`, t: Date.now(), title: title.slice(0, 120), ref: String(args.ref || "").slice(0, 160), status: "awaiting" };
    m.ledger.push(item);
    m.log.push({ t: Date.now(), kind: "publish", text: `${item.id} ${title.slice(0, 100)}` });
    writeMission(m);
    return { text: `台账已记(${item.id}):${title.slice(0, 80)}。≥48h 后用 action=measure(id=${item.id},stats=播放/完播/互动)回访度量——发布不是终点,度量出结论才是。`, structured: missionStructured(m, loadState()) };
  }
  if (action === "measure") {
    const item = (m.ledger || []).find((l) => l.id === String(args.id || "") && l.status === "awaiting");
    if (!item) throw new Error(`未找到待度量的台账条目:${args.id || "(未传 id)"}(action=get 查看台账)`);
    const stats = String(args.stats || "").trim();
    // 2.0.0:结构化度量——显式提供但非法的数字直接报错,不静默丢弃
    const mtr = {};
    for (const k of ["views", "likes", "comments", "completion", "follows"]) {
      if (args[k] === undefined) continue;
      const n = Number(args[k]);
      if (args[k] === "" || !Number.isFinite(n)) throw new Error(`${k} 需要数字,收到:${JSON.stringify(args[k])}`);
      mtr[k] = n;
    }
    if (!stats && !Object.keys(mtr).length) throw new Error("measure 需要 stats(自由文本)或结构化数字(views/likes/comments/completion/follows)");
    item.status = "measured";
    item.stats = stats.slice(0, 300);
    if (Object.keys(mtr).length) item.m = mtr;
    item.measuredAt = Date.now();
    m.log.push({ t: Date.now(), kind: "measure", text: `${item.id} ${stats.slice(0, 100)}` });
    writeMission(m);
    return { text: `已度量 ${item.id}「${item.title.slice(0, 60)}」:${stats.slice(0, 120)}\n对照定位假设:胜出模式值得在下周复制,证伪的写「洞察:」note 进周进化。`, structured: missionStructured(m, loadState()) };
  }
  if (action === "void") {
    // 2.2.0:假阳性账目作废——账要平,更要真实(v002 首发时发现 v001 的"已发布"是假阳性,当时无状态可标)
    const item = (m.ledger || []).find((l) => l.id === String(args.id || "") && l.status !== "void");
    if (!item) throw new Error(`未找到可作废的台账条目:${args.id || "(未传 id)"}`);
    const reason = String(args.reason || "").trim();
    if (!reason) throw new Error("void 需要 reason(作废依据——管理页实测/证据),账面不容含糊");
    item.status = "void";
    item.voidedAt = Date.now();
    item.voidReason = reason.slice(0, 200);
    m.log.push({ t: Date.now(), kind: "void", text: `${item.id} ${reason.slice(0, 100)}` });
    writeMission(m);
    return { text: `台账 ${item.id} 已作废:${reason.slice(0, 100)}\n诚实账本 > 好看账本——假阳性留着会污染每一次模式分析。`, structured: missionStructured(m, loadState()) };
  }
  throw new Error(`未知 action:${action}`);
}

function missionText(m) {
  const lines = ["<self-mission>"];
  if (m.active) {
    lines.push(`当前使命:「${m.active.title}」(第 ${missionDay(m.active)} 天)${m.active.goal ? `\n目标:${m.active.goal}` : ""}`);
  } else {
    lines.push("当前无进行中的使命(self_mission action=start 立项)");
  }
  const openDiff = (m.open || []).filter((d) => d.status === "open");
  if (openDiff.length) {
    lines.push(`待研究困难(${openDiff.length} 条,每日学习时刻消化):`);
    for (const d of openDiff.slice(-5)) lines.push(`- [${d.id}] ${d.text.slice(0, 80)}`);
  }
  // 1.8.0:内容实验台账——到期未度量的先回访;2.2.0:void 条目如实展示(诚实账本)
  const now = Date.now();
  const awaiting = (m.ledger || []).filter((l) => l.status === "awaiting");
  const due = awaiting.filter((l) => now - l.t >= 48 * 3600000);
  const voided = (m.ledger || []).filter((l) => l.status === "void");
  if (awaiting.length) {
    lines.push(`内容台账:待度量 ${awaiting.length} 条${due.length ? `(其中 ${due.length} 条已 ≥48h,优先回访)` : ""}:`);
    for (const l of awaiting.slice(-3)) lines.push(`- [${l.id}] ${l.title.slice(0, 60)}(发布于 ${fmtDate(l.t)})`);
  }
  if (voided.length) lines.push(`已作废 ${voided.length} 条(假阳性,不计入模式分析):${voided.slice(-3).map((l) => `${l.id}(${(l.voidReason || "").slice(0, 30)})`).join("; ")}`);
  const recent = m.log.slice(-8).reverse();
  if (recent.length) {
    lines.push("近期记录:");
    for (const e of recent) lines.push(`- [${e.kind}] ${fmtDate(e.t)} ${e.text}`);
  }
  lines.push("</self-mission>");
  return lines.join("\n");
}

function missionStructured(m, st) {
  const now = Date.now();
  const ledger = m.ledger || [];
  const openD = (m.open || []).filter((d) => d.status === "open");
  const agingD = openD.length ? Math.floor((now - Math.min(...openD.map((d) => d.t || now))) / 86400000) : 0;
  return {
    mission: {
      active: m.active
        ? { ...m.active, day: missionDay(m.active) }
        : null,
      recentLog: m.log.slice(-8).reverse(),
      openDifficulties: openD,
      difficultyAgingDays: agingD,
      ledger: {
        awaiting: ledger.filter((l) => l.status === "awaiting").length,
        due: ledger.filter((l) => l.status === "awaiting" && now - l.t >= 48 * 3600000).map((l) => ({ id: l.id, title: l.title, t: l.t })),
        voided: ledger.filter((l) => l.status === "void").map((l) => ({ id: l.id, reason: l.voidReason })),
        recent: ledger.slice(-5).reverse(),
        measuredAgg: ledgerAgg(ledger),
      },
    },
    sessionId: currentSid(st)?.sid || "",
  };
}

// ---------- 每日学习时刻(1.4.0:学新知识 → Obsidian 知识库,带 agent 标识) ----------

const CONFIG_SCHEMA = {
  injectBudget: { type: "boolean" },
  injectErrorWarn: { type: "boolean" },
  injectReflectNudge: { type: "boolean" },
  injectCriticNudge: { type: "boolean" },
  contextWindow: { type: "int", min: 1000 },
  retentionDays: { type: "int", min: 0 },
  "knowledgeBase.searchScope": { type: "string", values: ["own", "all"] },
  "budgetThrottle.mid": { type: "num", min: 0, max: 1 },
  "budgetThrottle.high": { type: "num", min: 0, max: 1 },
  "budgetThrottle.critical": { type: "num", min: 0, max: 1 },
  "budgetThrottle.midEveryTurns": { type: "int", min: 1 },
  "reflectNudge.minSegments": { type: "int", min: 1 },
  "reflectNudge.minFailures": { type: "int", min: 1 },
  "criticNudge.atEdits": { type: "int", min: 1 },
  rolloutDir: { type: "string" },
  "knowledgeBase.path": { type: "string" },
  "knowledgeBase.folder": { type: "string" },
  "knowledgeBase.dailyLearning": { type: "boolean" },
  "knowledgeBase.autoCommit": { type: "boolean" },
  "knowledgeBase.autoPush": { type: "boolean" },
};

/** 知识库目录(cfg 未配路径或目录不存在 → null) */
function kbDir(cfg) {
  const root = cfg.knowledgeBase?.path;
  if (!root || !fs.existsSync(root)) return null;
  return path.join(root, cfg.knowledgeBase?.folder || "观己学习");
}

function kbSlug(title) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const t = String(title).trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";
  return `${today}-${t}.md`;
}

function kbGitCommit(root, message) {
  try {
    if (!fs.existsSync(path.join(root, ".git"))) return { committed: false, reason: "非 git 仓库" };
    execSync(`git add -A && git commit -m ${JSON.stringify(message)}`, { cwd: root, timeout: 30000, stdio: "pipe" });
    return { committed: true };
  } catch (e) {
    return { committed: false, reason: String(e?.message || e).slice(0, 160) };
  }
}

function kbStats(cfg) {
  const dir = kbDir(cfg);
  if (!dir) return { configured: !!cfg.knowledgeBase?.path, path: cfg.knowledgeBase?.path || "" };
  const p = (n) => String(n).padStart(2, "0");
  const todayPrefix = `${new Date().getFullYear()}-${p(new Date().getMonth() + 1)}-${p(new Date().getDate())}`;
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {}
  return {
    configured: true,
    path: cfg.knowledgeBase?.path,
    folder: cfg.knowledgeBase?.folder || "观己学习",
    total: files.length,
    today: files.filter((f) => f.startsWith(todayPrefix)).length,
    recent: files.slice(-3).reverse(),
  };
}

/** 标题/查询分词(中英文通用:按标点与空白切;ASCII 片段 ≥2,非 ASCII(中文单字)≥1——T37 教训:"锁"是有意义的查询) */
function kbTokens(text) {
  return String(text || "")
    .split(/[\s,，。;；:：!！?？、()()【】\[\]{}"'`·…—/\\|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 || /[^\x00-\x7F]/.test(t));
}

/** 递归收集目录下 .md(1.9.0 全库模式:跳过隐藏/node_modules/.git,文件数与单文件大小封顶) */
function walkMarkdown(root, cap = 300) {
  const out = [];
  const skip = new Set([".git", "node_modules", ".obsidian", ".trash"]);
  const walk = (dir, depth) => {
    if (out.length >= cap || depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (out.length >= cap) return;
      if (ent.name.startsWith(".")) continue;
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!skip.has(ent.name)) walk(p, depth + 1);
      } else if (ent.name.endsWith(".md")) {
        try {
          if (fs.statSync(p).size <= 512 * 1024) out.push(p);
        } catch {}
      }
    }
  };
  walk(root, 0);
  return out;
}

/** 2.0.0:台账聚合——结构化度量数字 → 可计算的模式(周进化的燃料);2.2.0 void 条目不计入 */
function ledgerAgg(ledger) {
  const measured = (ledger || []).filter((l) => l.status === "measured" && l.m && Number.isFinite(l.m.views));
  if (!measured.length) return null;
  const sorted = measured.slice().sort((a, b) => b.m.views - a.m.views);
  return {
    count: measured.length,
    avgViews: Math.round(measured.reduce((a, l) => a + l.m.views, 0) / measured.length),
    best: { id: sorted[0].id, title: sorted[0].title, views: sorted[0].m.views },
    worst: { id: sorted[sorted.length - 1].id, title: sorted[sorted.length - 1].title, views: sorted[sorted.length - 1].m.views },
  };
}

/** 1.7.0 知识复利;1.8.0 全域化;1.9.0 searchScope(own=只搜观己学习,all=整个知识库仓库)——自己写的知识资产全部可检索 */
function selfRecall(args) {
  const cfg = loadConfig();
  const query = String(args?.query || "").trim();
  if (!query) throw new Error("recall 需要 query(关键词,可多个)");
  const tokens = kbTokens(query);
  const docs = []; // {source, name, path}
  const kb = kbDir(cfg);
  const scopeAll = cfg.knowledgeBase?.searchScope === "all" && cfg.knowledgeBase?.path;
  if (kb) {
    try {
      for (const f of fs.readdirSync(kb).filter((f) => f.endsWith(".md"))) docs.push({ source: "知识库", name: f, path: path.join(kb, f) });
    } catch {}
  } else if (cfg.knowledgeBase?.path) {
    // 配置了但目录还没建:不报错,其他源照扫
  }
  if (scopeAll && cfg.knowledgeBase?.path) {
    // 全库模式:召回用户知识库的既有知识(观己学习已入列,去重靠 path)
    const seen = new Set(docs.map((d) => d.path));
    for (const p of walkMarkdown(cfg.knowledgeBase?.path)) {
      if (!seen.has(p)) docs.push({ source: "知识库(全库)", name: path.relative(cfg.knowledgeBase.path, p), path: p });
    }
  }
  try {
    for (const f of fs.readdirSync(playbooksDir()).filter((f) => f.endsWith(".md"))) docs.push({ source: "playbook", name: f, path: path.join(playbooksDir(), f) });
  } catch {}
  if (fs.existsSync(selfModelPath())) docs.push({ source: "自我模型", name: "self-model.md", path: selfModelPath() });
  // 2.0.0:反思日志入召回源(复盘标题与教训可检索)
  try {
    const jEntries = readJournalEntries();
    if (jEntries.length) {
      docs.push({
        source: "反思日志",
        name: `journal(${jEntries.length} 条)`,
        path: null,
        content: jEntries.map((e) => `${e.title}\n${e.lesson || ""}`).join("\n"),
      });
    }
  } catch {}
  if (!docs.length) {
    return { text: `<self-recall> 暂无可检索的知识资产(知识库未配置且 playbook/自我模型未创建)。配置后我的学习笔记、规则手册与自我档案都能被召回。</self-recall>`, structured: { query, matches: [] } };
  }
  const scored = [];
  for (const doc of docs) {
    let content = doc.content;
    if (content === undefined) {
      try {
        content = fs.readFileSync(doc.path, "utf8");
      } catch {
        continue;
      }
    }
    let score = 0;
    const hitLines = [];
    for (const line of content.split("\n")) {
      const hits = tokens.filter((t) => line.toLowerCase().includes(t.toLowerCase())).length;
      if (hits > 0) {
        score += hits;
        if (hitLines.length < 2 && !line.startsWith("#") && line.trim()) hitLines.push(line.trim().slice(0, 100));
      }
    }
    if (score > 0) scored.push({ source: doc.source, file: doc.name, title: doc.name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""), score, hitLines });
  }
  scored.sort((a, b) => b.score - a.score);
  const limit = Number(args?.limit) || 5;
  const picked = scored.slice(0, limit);
  const lines = [`<self-recall> 关键词「${query}」全域命中 ${scored.length} 条(知识库 ${docs.filter((d) => d.source === "知识库").length} + playbook ${docs.filter((d) => d.source === "playbook").length} + 自我模型 ${docs.filter((d) => d.source === "自我模型").length} + 反思日志 ${docs.filter((d) => d.source === "反思日志").length}):`];
  if (!picked.length) lines.push("无命中——这个主题我还没学过,值得作为今日学习时刻的候选。");
  for (const s of picked) {
    lines.push(`- [${s.score} 分][${s.source}] ${s.title}(${s.file})`);
    for (const hl of s.hitLines) lines.push(`    · ${hl}`);
  }
  lines.push("</self-recall>");
  return {
    text: lines.join("\n"),
    structured: { query, totalDocs: docs.length, matches: picked },
  };
}

/** 知识库写入(1.5.0 抽取;1.6.0 支持 type=knowledge|experience;1.7.0 自动关联旧笔记;同题补学追加,git 按 autoCommit/autoPush) */
function kbRecord(cfg, { title, body, tags, type }) {
  const kind = type === "experience" ? "experience" : "knowledge";
  const dir = kbDir(cfg);
  if (!dir) throw new Error("知识库路径未配置:self_config set knowledgeBase.path=<Obsidian 仓库本地路径>");
  fs.mkdirSync(dir, { recursive: true });
  const mission = readMission();
  const file = path.join(dir, kbSlug(title));
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const time = `${p2(now.getHours())}:${p2(now.getMinutes())}`;
  const tagArr = ["观己", "agent-written", ...(kind === "experience" ? ["agent-experience"] : []), ...String(tags || "").split(/[,，\s]+/).filter(Boolean)];
  let mode;
  if (fs.existsSync(file)) {
    fs.appendFileSync(file, `\n\n## 补充(${time})\n\n${body}\n`);
    mode = "append";
  } else {
    const fm = [
      "---",
      `title: ${title}`,
      "source: agent-selfaware",
      `agent: 观己 (selfaware v${VERSION})`,
      "author: 观己(自主 agent)",
      "agent-written: true",
      `type: ${kind}`,
      `learned_at: ${now.toISOString().slice(0, 10)}`,
      `mission: ${mission.active?.title || "无"}`,
      `tags: [${tagArr.join(", ")}]`,
      "---",
      "",
      banner(),
      "",
      `# ${title}`,
      kind === "experience" ? "\n> 经验条目 = 亲历的「做法 → 结果 → 教训」,与知识条目(机制原理)互补;请结合上下文取用。\n" : "",
      body,
      "",
    ].join("\n");
    fs.writeFileSync(file, fm);
    mode = "create";
    // 1.7.0:自动关联——标题与既有笔记文件名求 2-gram 交集,Obsidian 双链串起知识网络
    try {
      const grams = (s) => {
        const out = [];
        const t = s.toLowerCase();
        for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
        return out;
      };
      const titleGrams = new Set(kbTokens(title).flatMap(grams));
      const related = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".md") && path.basename(file) !== f)
        .filter((f) => kbTokens(f).some((t) => grams(t).some((g) => titleGrams.has(g))))
        .slice(0, 4);
      if (related.length) {
        fs.appendFileSync(file, `\n相关笔记: ${related.map((f) => `[[${f.replace(/\.md$/, "")}]]`).join(" · ")}\n`);
      }
    } catch {}
  }
  let git = { committed: false };
  const root = cfg.knowledgeBase?.path;
  if (cfg.knowledgeBase?.autoCommit) {
    git = kbGitCommit(root, `agent(观己): ${kind === "experience" ? "经验沉淀" : "学习记录"} ${title}`);
    if (cfg.knowledgeBase?.autoPush && git.committed) {
      try {
        execSync("git push", { cwd: root, timeout: 60000, stdio: "pipe" });
        git.pushed = true;
      } catch (e) {
        git.reason = `push 失败:${String(e?.message || e).slice(0, 120)}`;
      }
    }
  }
  return { file: path.basename(file), mode, git };
}

function selfLearn(args) {
  const action = args?.action || "list";
  const cfg = loadConfig();
  if (action === "list") {
    const dir = kbDir(cfg);
    if (!dir) return { text: `<self-learn> 知识库未配置或路径不存在。用 self_config 设 knowledgeBase.path(本地路径)与 knowledgeBase.folder(子文件夹,默认 观己学习)。</self-learn>`, structured: { kb: kbStats(cfg) } };
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => ({ file: f, t: fs.statSync(path.join(dir, f)).mtimeMs }));
    } catch {}
    files.sort((a, b) => b.t - a.t);
    const lines = [`<self-learn> 知识库已写入 ${files.length} 条(目录:${dir}),最近 ${Math.min(10, files.length)} 条:`];
    for (const f of files.slice(0, 10)) lines.push(`- ${f.file}`);
    lines.push("</self-learn>");
    return { text: lines.join("\n"), structured: { kb: { ...kbStats(cfg), recent: files.slice(0, 3).map((f) => f.file) } } };
  }
  // record
  const title = String(args?.title || "").trim();
  const body = String(args?.body || "").trim();
  if (!title) throw new Error("record 需要 title(一句话说清学到了什么)");
  if (!body) throw new Error("record 需要 body(学到了什么、来源/证据、怎么用——不编造)");
  const rec = kbRecord(cfg, { title, body, tags: args?.tags, type: args?.type });
  const st = loadState();
  return {
    text: `${rec.mode === "append" ? `已补充到已有笔记:${rec.file}(同题补学)` : `已写入知识库:${rec.file}`}${rec.git.committed ? "(已 git 提交)" : rec.git.reason ? `(git 未提交:${rec.git.reason})` : ""}。知识库累计 ${kbStats(cfg).total} 条。`,
    structured: { kb: kbStats(cfg), file: rec.file, title, git: rec.git },
  };
}

function banner() {
  return `> 🤖 本文由自主 agent「观己」(selfaware)自动学习并写入,标签 #agent-written。来源与证据见正文;如有错误,责任在 agent 而非知识库主人。`;
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
  if (args.action === "update") {
    // 1.9.0:提案生命周期闭环——落地/放弃必须回写,⚠ 过期提醒才有意义
    const id = String(args.id || "");
    const status = String(args.status || "");
    if (!id || !["landed", "rejected"].includes(status)) throw new Error("update 需要 id 与 status(landed|rejected)");
    const entries = readJournalEntries();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx < 0) throw new Error(`未找到条目:${id}(action=query 查看现有 id)`);
    if (entries[idx].status === status) return `条目 ${id} 已是 ${status},无需变更。`;
    entries[idx].status = status;
    entries[idx].resolvedAt = Date.now();
    if (args.note) entries[idx].resolution = String(args.note).slice(0, 200);
    fs.mkdirSync(dataRoot(), { recursive: true });
    const tmp = journalPath() + ".tmp-" + process.pid;
    fs.writeFileSync(tmp, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
    fs.renameSync(tmp, journalPath());
    const line = status === "landed" ? `已落地${args.note ? `(${String(args.note).slice(0, 80)})` : ""}——⚠ 过期提醒随之解除` : `已标记放弃${args.note ? `(${String(args.note).slice(0, 80)})` : ""}`;
    return `提案 ${id} ${line}。`;
  }
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
    return { text: lines.join("\n"), structured: { total: entries.length, entries: entries.slice(-limit).reverse() } };
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
