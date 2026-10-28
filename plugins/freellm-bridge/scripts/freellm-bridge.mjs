#!/usr/bin/env node
/**
 * freellm-bridge.mjs — AOPC × FreeLLMAPI 桥接脚本
 *
 * 供 AOPC 插件 /freellm 命令调用,子命令:
 *   status                     网关健康 + token 来源 + AOPC 当前默认模型
 *   models [filter]            网关当前可调用(available=true)的模型清单,可子串过滤
 *   use <modelId|auto[:策略]> [--token <key>]
 *                              把 FreeLLMAPI 写入 AOPC(个人 Provider)并设为默认模型;
 *                              auto / auto:smart|fast|cheap|reliable|balanced 走网关自动路由
 *   doctor                     端到端体检
 *
 * 安全约束: 输出统一脱敏(sk-... 与 freellmapi-... 统一 token);AOPC provider_config.json
 * 只在本机写入,token 支持命令行 --token、环境变量 FREELLMAPI_API_KEY 或复用已保存值。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const HOME = os.homedir();
// 用 127.0.0.1 而非 localhost：FreeLLMAPI 默认双栈监听,但某些环境 ::1 优先解析会造成
// 无谓回退;与 fcm-bridge 同理统一走 IPv4 回环。
const ROUTER_BASE = "http://127.0.0.1:3001";
const DASHBOARD_URL = `${ROUTER_BASE}/`;
const CATALOG_URL = "https://api.freellmapi.co/v1/latest";
const PROVIDER_ID = "freellmapi";
const PROVIDER_NAME = "FreeLLMAPI 免费模型聚合";
// auto/fusion 由网关按请求路由,模型不固定;上下文按保守值声明,实际以路由结果为准。
const AUTO_MODEL_IDS = ["auto", "auto:smart", "auto:fast", "auto:cheap", "auto:reliable", "auto:balanced"];
const DEFAULT_CONTEXT_WINDOW = 131072;
const DATA_BASE_DIR = process.env.AOPC_DATA_BASE_DIR?.trim() || HOME;
const AOPC_PROVIDER_FILE = path.join(DATA_BASE_DIR, ".aopc", "v2", "provider_config.json");
const FETCH_TIMEOUT_MS = 15000;
const CATALOG_TIMEOUT_MS = 20000;
const MAX_MODEL_ROWS = 25;

const OUT = [];

function say(text = "") {
  // freellmapi- 统一 token 与 sk- 类 key 一律就地脱敏,其余文本原样输出。
  OUT.push(
    String(text).replace(/(sk-[A-Za-z0-9]{8,}|freellmapi-[A-Za-z0-9][A-Za-z0-9_-]{6,})/g, "[已脱敏]"),
  );
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readJsonStrict(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${label} 解析失败(${error.message});文件保持原样,请修复或还原备份后重试`);
  }
}

/** 与 AOPC 自身写入路径一致:备份 + 临时文件 + rename 原子替换,避免 1s 轮询读到半写状态。 */
function writeJsonAtomic(file, data) {
  const backup = `${file}.bak-bridge-${Date.now()}`;
  fs.copyFileSync(file, backup);
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, json, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return path.basename(backup);
}

function savedToken() {
  const aopc = readJsonSafe(AOPC_PROVIDER_FILE);
  const rule = aopc?.config?.providerConfigRules?.providerRules?.find(
    (item) => item.providerId === PROVIDER_ID && item.config,
  );
  return typeof rule?.config?.access?.apiKey === "string" && rule.config.access.apiKey
    ? rule.config.access.apiKey
    : null;
}

/** token 解析顺序: --token > 环境变量 > AOPC 已保存值;都不存在时返回 null 并给出指引。 */
function resolveToken(argToken) {
  if (argToken) return { key: argToken, source: "命令行 --token" };
  if (process.env.FREELLMAPI_API_KEY?.trim())
    return { key: process.env.FREELLMAPI_API_KEY.trim(), source: "环境变量 FREELLMAPI_API_KEY" };
  const saved = savedToken();
  if (saved) return { key: saved, source: "AOPC 已保存配置" };
  return null;
}

/**
 * 探测网关:任意 HTTP 响应都证明进程在监听;200 = token 有效,401/403 = token 缺失或无效。
 * 返回 {running, authOk, error}。
 */
async function probeRouter(token) {
  const attempts = token
    ? [`${ROUTER_BASE}/v1/models?available=true`, `${ROUTER_BASE}/v1/models`]
    : [`${ROUTER_BASE}/v1/openapi.json`, `${ROUTER_BASE}/`];
  let lastError = null;
  for (const url of attempts) {
    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.ok) return { running: true, authOk: Boolean(token), status: response.status };
      if (response.status === 401 || response.status === 403) {
        return { running: true, authOk: false, status: response.status };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.cause?.code ?? error.message;
    }
  }
  return { running: false, authOk: false, error: lastError };
}

async function fetchRouterModels(token) {
  const response = await fetch(`${ROUTER_BASE}/v1/models?available=true`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} /v1/models`);
  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : [];
}

/** 线上公开目录(contextWindow/supportsVision 等能力事实);失败不阻塞切换。 */
async function catalogModelMeta(modelId) {
  try {
    const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS) });
    if (!response.ok) return null;
    const catalog = await response.json();
    const hit = (catalog?.models ?? []).find((item) => item?.modelId === modelId);
    if (!hit) return null;
    return {
      contextWindow: Number.isFinite(hit.contextWindow) ? hit.contextWindow : null,
      supportsImage: hit.supportsVision === true,
    };
  } catch {
    return null;
  }
}

function aopcDefaultSelection(aopc) {
  const selection = aopc?.config?.defaultModelSelection;
  return selection?.providerId && selection?.modelId
    ? `${selection.providerId}/${selection.modelId}`
    : "未设置(由 AOPC 内部规则决定)";
}

function findSavedProviderRule(aopc) {
  return aopc?.config?.providerConfigRules?.providerRules?.find(
    (rule) => rule.providerId === PROVIDER_ID && rule.config,
  );
}

async function cmdStatus() {
  const token = resolveToken();
  const probe = await probeRouter(token?.key);
  if (!probe.running) {
    say(`▶ FreeLLMAPI 网关: 未运行(${probe.error ?? "无响应"})`);
    say("  启动: 按 FreeLLMAPI 官方文档安装并启动(默认端口 3001),例如 Docker 一键脚本或 npm 方式");
  } else if (!probe.authOk) {
    say(`▶ FreeLLMAPI 网关: 运行中,但还没有有效 token(HTTP ${probe.status})`);
    say(`  打开仪表盘 ${DASHBOARD_URL} → Keys 页复制统一 token,然后`);
    say("  export FREELLMAPI_API_KEY=freellmapi-... 或在 use 时加 --token <key>");
  } else {
    say(`▶ FreeLLMAPI 网关: 运行中,token 有效(来源: ${token.source})`);
  }
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  say(`▶ AOPC 默认模型: ${aopcDefaultSelection(aopc)}`);
  const saved = findSavedProviderRule(aopc);
  const modelCount = saved?.config?.personalModelIds?.length ?? 0;
  say(
    saved
      ? `▶ AOPC 内 FreeLLMAPI Provider: 已存在(${PROVIDER_ID},已收录 ${modelCount} 个模型)`
      : `▶ AOPC 内 FreeLLMAPI Provider: 未写入(用 /freellm use <modelId> 一键接入)`,
  );
}

function isRouterEntry(modelId) {
  return modelId === "auto" || modelId === "fusion" || modelId.startsWith("auto:");
}

function modelContextWindow(row) {
  const value = row.context_window ?? row.contextWindow;
  return Number.isFinite(value) ? value : null;
}

async function cmdModels(filter) {
  const token = resolveToken();
  if (!token) {
    say("未找到 token,无法列出模型。");
    say(`  打开仪表盘 ${DASHBOARD_URL} → Keys 页复制统一 token,然后:`);
    say("  export FREELLMAPI_API_KEY=freellmapi-... 后重跑本命令");
    process.exitCode = 3;
    return;
  }
  const probe = await probeRouter(token.key);
  if (!probe.running) {
    say(`▶ FreeLLMAPI 网关: 未运行(${probe.error ?? "无响应"});先启动网关再查看模型`);
    process.exitCode = 4;
    return;
  }
  if (!probe.authOk) {
    say(`▶ token 无效(HTTP ${probe.status});重新复制统一 token 后重试`);
    process.exitCode = 3;
    return;
  }
  const rows = await fetchRouterModels(token.key);
  const routerEntries = rows.map((row) => row?.id).filter((id) => typeof id === "string" && isRouterEntry(id));
  const modelRows = rows.filter((row) => typeof row?.id === "string" && !isRouterEntry(row.id));
  const keyword = filter?.trim().toLowerCase();
  const filtered = keyword
    ? modelRows.filter((row) => row.id.toLowerCase().includes(keyword))
    : modelRows;
  say(`▶ 路由入口: ${routerEntries.length ? routerEntries.join(", ") : "(无)"}`);
  say(
    `▶ 可调用模型 ${filtered.length}/${modelRows.length} 个${keyword ? `(过滤: ${keyword})` : ""},示例:`,
  );
  filtered.slice(0, MAX_MODEL_ROWS).forEach((row, index) => {
    const context = modelContextWindow(row);
    const contextLabel = context ? `  ctx=${context >= 1000 ? `${Math.round(context / 1000)}k` : context}` : "";
    say(`  ${index + 1}. ${row.id}${contextLabel}`);
  });
  if (filtered.length > MAX_MODEL_ROWS) say(`  …其余 ${filtered.length - MAX_MODEL_ROWS} 个请加过滤词,如 /freellm models gemini`);
  say(`  切换: /freellm use <modelId>(或 use auto 走自动路由)`);
}

/** 确保 AOPC 侧存在 FreeLLMAPI Provider 条目;存在时仅覆盖连接字段,保留其余 user 修改。 */
function upsertProviderRule(aopc, apiKey, modelId) {
  const rules = (aopc.config.providerConfigRules ??= { providerRules: [] });
  rules.providerRules ??= [];
  const existing = findSavedProviderRule(aopc);
  if (existing) {
    existing.providerName = PROVIDER_NAME;
    existing.config.access = { type: "api-key", apiKey };
    existing.config.api = { type: "openai-chat-completions", baseUrl: `${ROUTER_BASE}/v1` };
    const modelIds = (existing.config.personalModelIds ?? []).filter((id) => id !== modelId);
    modelIds.push(modelId);
    existing.config.personalModelIds = modelIds;
    existing.config.modelOrder = modelIds;
  } else {
    rules.providerRules.push({
      providerId: PROVIDER_ID,
      providerName: PROVIDER_NAME,
      config: {
        group: "standard-personal",
        access: { type: "api-key", apiKey },
        api: { type: "openai-chat-completions", baseUrl: `${ROUTER_BASE}/v1` },
        personalModelIds: [modelId],
        modelOrder: [modelId],
      },
    });
  }
  if (!aopc.config.providerOrder?.includes(PROVIDER_ID)) {
    // CLI 端默认模型解析会回退到 providerOrder 首个可用项；插到最前保证优先命中。
    (aopc.config.providerOrder ??= []).unshift(PROVIDER_ID);
  }
}

/** sync 用:整体替换 personalModelIds/modelOrder,一次写入全部可用模型。 */
function replaceProviderModelIds(aopc, modelIds) {
  const rules = (aopc.config.providerConfigRules ??= { providerRules: [] });
  rules.providerRules ??= [];
  const existing = findSavedProviderRule(aopc);
  if (existing) {
    existing.providerName = PROVIDER_NAME;
    existing.config.personalModelIds = modelIds;
    existing.config.modelOrder = modelIds;
  } else {
    rules.providerRules.push({
      providerId: PROVIDER_ID,
      providerName: PROVIDER_NAME,
      config: {
        group: "standard-personal",
        personalModelIds: modelIds,
        modelOrder: modelIds,
      },
    });
  }
  if (!aopc.config.providerOrder?.includes(PROVIDER_ID)) {
    (aopc.config.providerOrder ??= []).unshift(PROVIDER_ID);
  }
}

function upsertModelRule(aopc, modelId, contextWindow, supportsImage) {
  const modelRules = (aopc.config.modelConfigRules ??= {
    providerModelRules: [],
    manualProviderModelRules: [],
  });
  modelRules.providerModelRules ??= [];
  const existing = modelRules.providerModelRules.find(
    (rule) => rule.providerId === PROVIDER_ID && rule.modelId === modelId,
  );
  const properties = { contextWindow };
  if (supportsImage) properties.inputFormat = { supportsImage: true };
  if (existing) {
    existing.config = { enabled: true, properties };
  } else {
    modelRules.providerModelRules.push({
      providerId: PROVIDER_ID,
      modelId,
      config: { enabled: true, properties },
    });
  }
}

async function cmdUse(modelId, argToken) {
  if (!modelId || modelId.startsWith("--")) {
    say("用法: /freellm use <modelId|auto[:strategy]> [--token <key>]");
    say(`  auto 策略: ${AUTO_MODEL_IDS.slice(1).join(", ")}(或直接 auto)`);
    process.exitCode = 2;
    return;
  }
  const token = resolveToken(argToken);
  if (!token) {
    say("未找到 FreeLLMAPI 统一 token。");
    say(`  方式一: 打开仪表盘 ${DASHBOARD_URL} → Keys 页复制 token,重跑 /freellm use ${modelId} --token freellmapi-...`);
    say("  方式二: 终端里 export FREELLMAPI_API_KEY=freellmapi-... 后再运行本插件");
    process.exitCode = 3;
    return;
  }
  const probe = await probeRouter(token.key);
  if (!probe.running) {
    say(`✗ FreeLLMAPI 网关未运行(${probe.error ?? "无响应"});先启动网关(默认端口 3001)再切换`);
    process.exitCode = 4;
    return;
  }
  if (!probe.authOk) {
    say(`✗ token 无效(HTTP ${probe.status});打开仪表盘 ${DASHBOARD_URL} → Keys 页重新复制`);
    process.exitCode = 3;
    return;
  }
  say(`▶ 网关连接 OK,token 有效(来源: ${token.source})`);

  const isRouterEntryId = isRouterEntry(modelId);
  let contextWindow = DEFAULT_CONTEXT_WINDOW;
  let supportsImage = false;
  if (isRouterEntryId) {
    say(`▶ ${modelId} 为网关自动路由入口,能力按保守值声明,实际以路由结果为准`);
  } else {
    const meta = await catalogModelMeta(modelId);
    if (meta) {
      contextWindow = meta.contextWindow ?? DEFAULT_CONTEXT_WINDOW;
      supportsImage = meta.supportsImage;
      say(`▶ 目录已核对 ${modelId}: 上下文 ${contextWindow}${supportsImage ? ",支持图片输入" : ""}`);
    } else {
      say(`▶ 目录未命中 ${modelId},按默认上下文 ${contextWindow} 声明;仍会校验网关是否可调用该模型`);
    }
    const rows = await fetchRouterModels(token.key);
    if (!rows.some((row) => row?.id === modelId)) {
      say(`✗ 网关可调用列表中没有 ${modelId};用 /freellm models 查看当前可用模型(或直接 use auto)`);
      process.exitCode = 5;
      return;
    }
  }

  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  upsertProviderRule(aopc, token.key, modelId);
  upsertModelRule(aopc, modelId, contextWindow, supportsImage);
  aopc.config.defaultModelSelection = { providerId: PROVIDER_ID, modelId };
  const backup = writeJsonAtomic(AOPC_PROVIDER_FILE, aopc);
  say(`✓ AOPC 已切换默认模型: ${PROVIDER_ID}/${modelId}`);
  say(`  端点: ${ROUTER_BASE}/v1(OpenAI 兼容;token 明文写入 AOPC 本机配置,勿外传)`);
  say(`  备份: ${backup};AOPC 1s 轮询内热生效,/model 可见`);
}

async function cmdDoctor() {
  await cmdStatus();
  say("▶ 建议链路: AOPC 谈话 → 127.0.0.1:3001/v1(统一 token) → FreeLLMAPI 路由 → 上游免费模型");
  const token = resolveToken();
  if (token?.key) {
    try {
      const rows = await fetchRouterModels(token.key);
      const ready = rows.filter((row) => typeof row?.id === "string" && !isRouterEntry(row.id));
      say(`▶ 当前可调用模型 ${ready.length} 个;自动路由入口: auto / auto:smart / auto:fast 等`);
      const noContext = ready.filter((row) => !modelContextWindow(row)).length;
      if (noContext) say(`  (其中 ${noContext} 个未携带上下文字段,切换时按默认值声明)`);
    } catch (error) {
      say(`▶ 模型清单获取失败(${error.message});不影响已写入配置的使用`);
    }
  } else {
    say(`▶ 尚未配置 token: 打开仪表盘 ${DASHBOARD_URL} → Keys 页,或 export FREELLMAPI_API_KEY=...`);
  }
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  const saved = findSavedProviderRule(aopc);
  if (saved) {
    const endpoint = saved.config?.api?.baseUrl;
    if (endpoint && endpoint !== `${ROUTER_BASE}/v1`) {
      say(`⚠ AOPC 内 ${PROVIDER_ID} 的端点为 ${endpoint},与本插件默认(${ROUTER_BASE}/v1)不同;如为自定义端口属正常`);
    }
    say(`▶ FreeLLMAPI 已收录模型: ${(saved.config?.personalModelIds ?? []).join(", ") || "(无)"}`);
  }
}

/** 把网关当前全部可调用模型(含 auto 路由入口)一次性同步进 AOPC,并保持默认选择有效。 */
async function cmdSync(argToken) {
  const token = resolveToken(argToken);
  if (!token) {
    say("未找到 FreeLLMAPI 统一 token。");
    say(`  打开仪表盘 ${DASHBOARD_URL} → Keys 页复制 token,重跑 /freellm sync --token freellmapi-...`);
    say("  或终端里 export FREELLMAPI_API_KEY=freellmapi-... 后再运行本插件");
    process.exitCode = 3;
    return;
  }
  const probe = await probeRouter(token.key);
  if (!probe.running) {
    say(`✗ FreeLLMAPI 网关未运行(${probe.error ?? "无响应"});先启动网关再同步`);
    process.exitCode = 4;
    return;
  }
  if (!probe.authOk) {
    say(`✗ token 无效(HTTP ${probe.status});打开仪表盘 ${DASHBOARD_URL} → Keys 页重新复制`);
    process.exitCode = 3;
    return;
  }
  const rows = await fetchRouterModels(token.key);
  const ids = rows.map((row) => row?.id).filter((id) => typeof id === "string" && id);
  const routerEntryIds = ids.filter(isRouterEntry);
  const modelIds = ids.filter((id) => !isRouterEntry(id));
  // 路由入口放最前(auto 兜底永远在),普通模型按网关返回顺序(可用性优先)。
  const allIds = ["auto", ...routerEntryIds.filter((id) => id !== "auto"), ...modelIds];
  // 能力声明:逐模型查公开目录,未命中的回退保守默认;目录失败不阻塞同步。
  const catalog = await fetchCatalogModels();
  const aopc = readJsonStrict(AOPC_PROVIDER_FILE, "AOPC provider_config.json");
  for (const modelId of allIds) {
    const meta = catalog?.get(modelId);
    upsertModelRule(aopc, modelId, meta?.contextWindow ?? DEFAULT_CONTEXT_WINDOW, meta?.supportsImage === true);
  }
  // 清掉已不可调用的旧成员,保持列表与网关一致。
  const stale = findSavedProviderRule(aopc)?.config?.personalModelIds?.filter((id) => !allIds.includes(id)) ?? [];
  replaceProviderModelIds(aopc, allIds);
  const selection = aopc.config.defaultModelSelection;
  if (selection?.providerId === PROVIDER_ID && !allIds.includes(selection.modelId)) {
    aopc.config.defaultModelSelection = { providerId: PROVIDER_ID, modelId: allIds[0] };
  }
  const backup = writeJsonAtomic(AOPC_PROVIDER_FILE, aopc);
  say(`✓ 已同步 ${allIds.length} 个模型进 AOPC(${modelIds.length} 个模型 + ${routerEntryIds.length} 个路由入口)`);
  say(`  目录核对: ${catalog ? `${catalog.size} 条能力记录` : "未命中(全部按默认 131072 声明)"}`);
  if (stale.length) say(`  移除已下线: ${stale.join(", ")}`);
  say(`  默认模型: ${PROVIDER_ID}/${aopc.config.defaultModelSelection.modelId}`);
  say(`  备份: ${backup};AOPC 1s 轮询内热生效,/model 可见`);
}

/** 拉取线上公开目录,返回 modelId -> {contextWindow, supportsImage};失败返回 null。 */
async function fetchCatalogModels() {
  try {
    const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS) });
    if (!response.ok) return null;
    const catalog = await response.json();
    const map = new Map();
    for (const item of catalog?.models ?? []) {
      if (typeof item?.modelId !== "string") continue;
      map.set(item.modelId, {
        contextWindow: Number.isFinite(item.contextWindow) ? item.contextWindow : DEFAULT_CONTEXT_WINDOW,
        supportsImage: item.supportsVision === true,
      });
    }
    return map;
  } catch {
    return null;
  }
}

const [command, ...rest] = process.argv.slice(2);
const HELP =
  "用法: freellm-bridge.mjs <status|models [filter]|use <modelId|auto[:strategy]> [--token <key>]|sync [--token <key>]|doctor>\n" +
  "  sync: 把网关当前全部可调用模型一次性同步进 AOPC\n" +
  `  网关: ${ROUTER_BASE}(默认端口 3001);token: 仪表盘 Keys 页 / $FREELLMAPI_API_KEY / --token`;

/** 拆出 --token <key>,其余第一个非 flag 参数视为 modelId 或过滤词。 */
function parseArgs(args) {
  let token;
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--token") {
      token = args[index + 1];
      index += 1;
    } else if (value.startsWith("--token=")) {
      token = value.slice("--token=".length);
    } else if (!value.startsWith("--")) {
      positional.push(value);
    }
  }
  return { token, positional };
}

try {
  const { token: argToken, positional } = parseArgs(rest);
  switch (command) {
    case "status":
      await cmdStatus();
      break;
    case "models":
      await cmdModels(positional[0]);
      break;
    case "use":
      await cmdUse(positional[0], argToken);
      break;
    case "sync":
      await cmdSync(argToken);
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
