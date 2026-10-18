#!/usr/bin/env node
/**
 * fcm-bridge.mjs — AOPC × free-coding-models (FCM) 桥接脚本
 *
 * 供 AOPC 插件 /fcm 命令调用,子命令:
 *   status                 网关健康 + AOPC 当前默认模型 + key 配置概况
 *   models                 当前 active set 的模型清单(优先级/健康/延迟)
 *   use <provider> [modelId]  把某家免费 provider 写入 AOPC(直连模式)并设为默认
 *   use-router [modelId]   把 AOPC 默认模型切到 FCM 网关(默认 fcm)
 *   doctor                 端到端体检
 *
 * 安全约束: 输出绝不打印 apiKey 原文;AOPC provider_config.json 只存 fcm-local 和
 * 从本机 FCM 配置解析出的真实 key(AOPC 不支持 {env:VAR} 替换)。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const HOME = os.homedir();
// 用 127.0.0.1 而非 localhost：daemon 只绑 IPv4，localhost 可能先解析到 ::1
// （/etc/hosts 两条都在时 DNS 返回 ::1 优先），在禁用 Happy Eyeballs 的环境里直接 ECONNREFUSED。
const ROUTER_BASE = "http://127.0.0.1:19280";
const ROUTER_API_KEY = "fcm-local";
const ROUTER_PROVIDER_ID = "fcm-router";
const ROUTER_MODEL_ID = "fcm";
const DEFAULT_CONTEXT_WINDOW = 131072;
const AOPC_PROVIDER_FILE = path.join(HOME, ".aopc", "v2", "provider_config.json");
const FCM_CONFIG_FILE = path.join(HOME, ".free-coding-models.json");
const FETCH_TIMEOUT_MS = 15000;

/** 免费供应商目录:baseUrl 为各官方 OpenAI 兼容端点;keyEnv 为对应环境变量名。 */
const PROVIDERS = {
  groq: { label: "Groq", envKey: "GROQ_API_KEY", baseUrl: "https://api.groq.com/openai/v1" },
  cerebras: { label: "Cerebras", envKey: "CEREBRAS_API_KEY", baseUrl: "https://api.cerebras.ai/v1" },
  siliconflow: { label: "SiliconFlow 硅基流动", envKey: "SILICONFLOW_API_KEY", baseUrl: "https://api.siliconflow.cn/v1" },
  nvidia: { label: "NVIDIA NIM", envKey: "NVIDIA_API_KEY", baseUrl: "https://integrate.api.nvidia.com/v1" },
  openrouter: { label: "OpenRouter", envKey: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1" },
};

const OUT = [];

function say(text = "") {
  if (typeof text === "string" && /sk-[A-Za-z0-9]{8,}/.test(text)) {
    OUT.push("[安全拦截] 输出疑似包含密钥原文,已脱敏");
    return;
  }
  OUT.push(text);
}

/** 兼容多种 FCM 配置形状,返回 {key, source} 或 null;只在本机内存中流转,不落输出。 */
function resolveFreeKey(providerId) {
  const envKey = PROVIDERS[providerId].envKey;
  if (process.env[envKey]) return { key: process.env[envKey], source: `环境变量 ${envKey}` };
  let fcm = null;
  try {
    fcm = JSON.parse(fs.readFileSync(FCM_CONFIG_FILE, "utf8"));
  } catch {
    return null;
  }
  if (typeof fcm.apiKeys?.[providerId] === "string" && fcm.apiKeys[providerId]) {
    return { key: fcm.apiKeys[providerId], source: "FCM 配置 apiKeys" };
  }
  const p = fcm.providers?.[providerId];
  if (typeof p === "string" && p) return { key: p, source: "FCM 配置 providers" };
  if ((p?.apiKey ?? p?.key) != null && p.apiKey !== "" && p.key !== "") {
    return { key: p.apiKey ?? p.key, source: "FCM 配置 providers" };
  }
  if (typeof fcm.keys?.[providerId] === "string" && fcm.keys[providerId]) {
    return { key: fcm.keys[providerId], source: "FCM 配置 keys" };
  }
  return null;
}

async function fetchJson(urlPath) {
  const response = await fetch(`${ROUTER_BASE}${urlPath}`, {
    headers: { Authorization: `Bearer ${ROUTER_API_KEY}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${urlPath}`);
  return response.json();
}

function readJsonStrict(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} 解析失败(${error.message});文件保持原样,请修复或还原备份后重试`);
  }
}

/** 与 AOPC 自身写入路径一致:临时文件 + rename 原子替换,避免 1s 轮询读到半写状态。 */
function writeJsonAtomic(file, data) {
  const backup = `${file}.bak-bridge-${Date.now()}`;
  fs.copyFileSync(file, backup);
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, json, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return path.basename(backup);
}

async function routerHealth() {
  let health = null;
  for (const urlPath of ["/health", "/stats"]) {
    try {
      health = await fetchJson(urlPath);
      break;
    } catch (error) {
      health = { error: error.message };
    }
  }
  return health;
}

/** 从 daemon 数据中提取 active set 的模型健康行(顺序即优先级)。 */
function extractModelRows(health) {
  const candidates = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      if (value.some((item) => item && typeof item === "object" && "state" in item && ("model" in item || "modelId" in item))) {
        candidates.push(value);
      } else {
        value.forEach(visit);
      }
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(visit);
    }
  };
  visit(health);
  return candidates[0] ?? [];
}

async function cmdStatus() {
  const health = await routerHealth();
  if (!health || health.error) {
    say("▶ FCM 网关: 未运行(" + (health?.error ?? "无响应") + ")");
    say("  启动: free-coding-models --daemon-bg");
  } else {
    const routerConfig = readFcmRouterConfig();
    say(`▶ FCM 网关: 运行中  端口 ${routerConfig.port}  activeSet: ${routerConfig.activeSet}`);
    const rows = extractModelRows(health);
    if (rows.length) {
      say(`  集合内模型 ${rows.length} 个(优先级序):`);
      rows.forEach((row, index) => {
        const model = row.model ?? row.modelId ?? "?";
        const latency = row.last_latency_ms == null ? "—" : `${row.last_latency_ms}ms`;
        say(`    ${index + 1}. [${row.state ?? "?"}] ${row.provider ?? "?"}/${model}  ${latency}`);
      });
    }
  }
  const fcm = readJsonSafe(FCM_CONFIG_FILE);
  const keyProviders = fcm?.apiKeys ? Object.keys(fcm.apiKeys).filter((id) => fcm.apiKeys[id]) : [];
  say(`▶ FCM 已配置 key 的供应商: ${keyProviders.length ? keyProviders.join(", ") : "(无)——在 TUI 按 P 或用环境变量补充"}`);
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  const defaultSelection = aopc.config?.defaultModelSelection;
  say(
    "▶ AOPC 默认模型: " +
      (defaultSelection
        ? `${defaultSelection.providerId}/${defaultSelection.modelId}`
        : "未设置(由 AOPC 内部规则决定)"),
  );
  const rules = aopc.config?.providerConfigRules?.providerRules ?? [];
  say(
    "▶ AOPC 供应商: " +
      rules
        .map((rule) => `${rule.providerId}${rule.enabled === false ? "(已禁用)" : ""}`)
        .join(", "),
  );
}

function readFcmRouterConfig() {
  const fcm = readJsonSafe(FCM_CONFIG_FILE) ?? {};
  const routerValue = fcm.router ?? {};
  return {
    port: routerValue.port ?? 19280,
    activeSet: routerValue.activeSet ?? "auto",
  };
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** 确保 AOPC 侧存在某 provider 条目;存在时仅覆盖关键字段,保留其余 user 修改。 */
function upsertProviderRule(aopc, providerId, providerName, apiKey, baseUrl, modelIds) {
  const rules = (aopc.config.providerConfigRules ??= { providerRules: [] });
  rules.providerRules ??= [];
  const existing = rules.providerRules.find((rule) => rule.providerId === providerId && rule.config);
  if (existing) {
    existing.providerName = providerName;
    existing.config.access = { type: "api-key", apiKey };
    existing.config.api = { type: "openai-chat-completions", baseUrl };
    existing.config.personalModelIds = modelIds;
    existing.config.modelOrder = modelIds;
  } else {
    rules.providerRules.push({
      providerId,
      providerName,
      config: {
        group: "standard-personal",
        access: { type: "api-key", apiKey },
        api: { type: "openai-chat-completions", baseUrl },
        personalModelIds: modelIds,
        modelOrder: modelIds,
      },
    });
  }
  if (!aopc.config.providerOrder?.includes(providerId)) {
    (aopc.config.providerOrder ??= []).push(providerId);
  }
}

function upsertModelRule(aopc, providerId, modelId) {
  const modelRules = (aopc.config.modelConfigRules ??= { providerModelRules: [], manualProviderModelRules: [] });
  modelRules.providerModelRules ??= [];
  const existing = modelRules.providerModelRules.find(
    (rule) => rule.providerId === providerId && rule.modelId === modelId,
  );
  if (!existing) {
    modelRules.providerModelRules.push({
      modelId,
      providerId,
      config: { enabled: true, properties: { contextWindow: DEFAULT_CONTEXT_WINDOW } },
    });
  }
}

async function cmdUse(providerId, modelId) {
  const meta = PROVIDERS[providerId];
  if (!meta) {
    say(`未知供应商: ${providerId};可用: ${Object.keys(PROVIDERS).join(", ")}`);
    process.exitCode = 2;
    return;
  }
  const resolved = resolveFreeKey(providerId);
  if (!resolved) {
    say(`未找到 ${meta.label} 的 key。`);
    say(`  方式一: 终端里 export ${meta.envKey}=sk-... 后再运行本插件`);
    say("  方式二: free-coding-models 打开 TUI 按 P 粘贴 key(TUI 不能在此运行)");
    process.exitCode = 3;
    return;
  }
  let upstreamModels = null;
  try {
    const response = await fetch(`${meta.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${resolved.key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    upstreamModels = (body.data ?? []).map((item) => item.id);
    say(`▶ ${meta.label} 连接 OK,key 有效,上游模型 ${upstreamModels.length} 个`);
  } catch (error) {
    say(`▶ ${meta.label} 连接失败(${error.message});继续执行但请确认 key/网络`);
  }
  if (!modelId) {
    if (upstreamModels?.length) {
      say("  可选模型(示例,完整列表再传 --list):");
      say("  " + upstreamModels.slice(0, 15).join("\n  "));
      say(`  用法补全: /fcm use ${providerId} <从上面选一个 id>`);
    } else {
      say(`  用法: /fcm use ${providerId} <modelId>`);
    }
    say("  (未指定 modelId,未做任何写入)");
    return;
  }
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  const bridgeProviderId = `fcm-${providerId}`;
  upsertProviderRule(aopc, bridgeProviderId, `FCM · ${meta.label}`, resolved.key, meta.baseUrl, [modelId]);
  upsertModelRule(aopc, bridgeProviderId, modelId);
  aopc.config.defaultModelSelection = { providerId: bridgeProviderId, modelId };
  const backup = writeJsonAtomic(AOPC_PROVIDER_FILE, aopc);
  say(`✓ AOPC 已切换默认模型: ${bridgeProviderId}/${modelId}`);
  say(`  key 来源: ${resolved.source}(明文写入 AOPC 配置,勿外传)`);
  say(`  备份: ${backup};AOPC 1s 轮询内热生效,/model 可见`)
}

async function cmdUseRouter() {
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  upsertProviderRule(
    aopc,
    ROUTER_PROVIDER_ID,
    "FCM 免费模型网关",
    ROUTER_API_KEY,
    `${ROUTER_BASE}/v1`,
    [ROUTER_MODEL_ID],
  );
  upsertModelRule(aopc, ROUTER_PROVIDER_ID, ROUTER_MODEL_ID);
  aopc.config.defaultModelSelection = { providerId: ROUTER_PROVIDER_ID, modelId: ROUTER_MODEL_ID };
  const backup = writeJsonAtomic(AOPC_PROVIDER_FILE, aopc);
  say(`✓ AOPC 默认模型已切到网关: ${ROUTER_PROVIDER_ID}/${ROUTER_MODEL_ID}`);
  say(`  备份: ${backup};1s 内热生效`);
}

async function cmdDoctor() {
  await cmdStatus();
  say("▶ 建议链路: AOPC 谈话 → localhost:19280(fcm-local) → FCM Router → 上游免费模型");
  const fcm = readJsonSafe(FCM_CONFIG_FILE);
  const missing = Object.keys(PROVIDERS).filter((id) => !resolveFreeKey(id));
  say(`▶ 未配 key 的供应商: ${missing.length ? missing.join(", ") : "(无)"}`);
  if (!fcm) say("  提示: FCM 配置文件不存在,先运行一次 free-coding-models 完成首次配置");
}

async function cmdModels() {
  const health = await routerHealth();
  if (!health || health.error) {
    say("FCM 网关未运行;先执行: free-coding-models --daemon-bg");
    process.exitCode = 4;
    return;
  }
  const rows = extractModelRows(health);
  if (!rows.length) {
    say("网关 active set 为空;运行 free-coding-models --sync-set fast-coding 重建集合");
    return;
  }
  say("active set 模型(优先级序):");
  rows.forEach((row, index) => {
    const model = row.model ?? row.modelId ?? "?";
    const latency = row.last_latency_ms == null ? "—" : `${row.last_latency_ms}ms`;
    say(
      `  ${index + 1}. [${row.state ?? "?"}] ${row.provider ?? "?"}/${model}  ${latency}  ${
        row.last_error ? `err: ${String(row.last_error).slice(0, 80)}` : ""
      }`.trimEnd(),
    );
  });
}

const [command, ...rest] = process.argv.slice(2);
const HELP =
  "用法: fcm-bridge.mjs <status|models|use <provider> [modelId]|use-router|doctor>\n" +
  `  provider: ${Object.keys(PROVIDERS).join(" | ")}`;

try {
  switch (command) {
    case "status":
      await cmdStatus();
      break;
    case "models":
      await cmdModels();
      break;
    case "use":
      if (!rest[0]) {
        say(HELP);
        process.exitCode = 2;
        break;
      }
      await cmdUse(rest[0], rest[1] && !rest[1].startsWith("--") ? rest[1] : undefined);
      break;
    case "use-router":
      await cmdUseRouter();
      break;
    case "doctor":
      await cmdDoctor();
      break;
    default:
      say(HELP);
      process.exitCode = command ? 2 : 0;
  }
} catch (error) {
  say(`✗ ${error.message}`);
  process.exitCode = 1;
}

console.log(OUT.join("\n"));
