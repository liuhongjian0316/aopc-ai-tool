// @ts-nocheck —— 由 JS 迁移（tools/store/ssh/figma/notify/openpencil 为动态工具实现，类型逐步收紧；入口 src/server.ts 全量检查）
/**
 * wudi-coding MCP 工具定义与分发（M2：项目档案 + 部署流水线 + 回滚 + 健康检查 + 受控远程执行）。
 * 约定（与 douyin-pilot 一致）：所有工具返回中文文本，直接面向 Agent 阅读；
 * 需要用户介入的步骤在返回里明确写出下一步；需要确认的高危操作以 confirm 参数把关。
 * 状态存储：项目根 .wudi/（见 src/store.ts）；SSH 执行：src/ssh.ts（系统命令，仅密钥认证）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as store from "./store";
import { sshRun, localRun, uploadFile, sshPing, sshConfig } from "./ssh";
import { figmaToken, parseFigmaRef, fetchFigmaStructure, fetchFigmaImages, extractStyles } from "./figma";
import { getFigmaUrl, setFigmaUrl } from "./store";
import { openpencilTools, openpencilCall, openpencilReadResource, openpencilResourcesList, openpencilBridgeEndpoint } from "./openpencil";
import { resolveNotify, sendNotify } from "./notify";

const ok = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  isError: false,
  ...(structuredContent !== undefined ? { structuredContent } : {}),
});
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });
const j = (v) => JSON.stringify(v, null, 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 单引号包裹，防注入远端 shell 的路径/URL 拼接。 */
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const clip = (s, n = 1500) => String(s ?? "").trim().slice(-n);

/* ---- 实时协同桥：canvas 变更 SSE 广播（OpenPencil 式 agent↔面板活同步） ---- */
import http from "node:http";
import net from "node:net";
import { dirname as _dirname, join as _join } from "node:path";
import { fileURLToPath as _fURL } from "node:url";

/** 内嵌 OpenPencil 编辑器 loader（vendor 官方 dist，经 MCP postMessage 桥取资产、WS 桥连文档）。 */
const OP_FRAME_HTML = _join(_dirname(_fURL(import.meta.url)), "..", "vendor", "openpencil", "dist", "ui", "panel.html");

const bridgeSubscribers = new Set();
let bridgePort = 0;
const bridgeServer = http.createServer((req, res) => {
  if (req.url === "/openpencil/frame") {
    // 工作台面板的内嵌编辑器 iframe 文档：不注入 CSP（编辑器需 WS/wasm/字体全量能力，隔离边界是本机随机端口 + token）
    try {
      const html = readFileSync(OP_FRAME_HTML, "utf-8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end(`编辑器加载失败：${String(err?.message ?? err)}`);
    }
    return;
  }
  if (req.url !== "/bridge") {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
  bridgeSubscribers.add(res);
  req.on("close", () => bridgeSubscribers.delete(res));
});
bridgeServer.listen(0, "127.0.0.1", () => {
  bridgePort = bridgeServer.address().port;
});

/** 把 openpencil 子进程的 WS 端点包装成经 wudi 协同桥的代理 URL（面板 CSP 只需放行桥 origin）。 */
export function opWsProxyUrl(target) {
  if (!bridgePort || !target) return target;
  return `ws://127.0.0.1:${bridgePort}/op-ws?target=${encodeURIComponent(target)}`;
}

/* 透明 WS 反代：/op-ws?target=ws://127.0.0.1:PORT → 转发握手与字节流到目标编辑器服务 */
bridgeServer.on("upgrade", (req, socket, head) => {
  let target = null;
  try {
    const u = new URL(req.url ?? "/", "http://127.0.0.1");
    if (u.pathname !== "/op-ws") throw new Error("not ws proxy");
    target = new URL(u.searchParams.get("target") ?? "");
  } catch {
    socket.destroy();
    return;
  }
  const host = target.hostname;
  const port = Number(target.port || 80);
  if (host !== "127.0.0.1" || !port) { socket.destroy(); return; }
  const upstream = net.connect(port, host, () => {
    const lines = [];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() === "host") continue;
      lines.push(`${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
    }
    lines.push(`Host: 127.0.0.1:${port}`);
    upstream.write(`${req.method} / HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
});

/** 向所有已连接面板广播画布变更。 */
function broadcastCanvasChanged() {
  for (const res of bridgeSubscribers) {
    try {
      res.write(`data: ${JSON.stringify({ type: "canvas-changed" })}\n\n`);
    } catch { /* 断开的连接下次遍历时移除 */ }
  }
}

/** 面板资源 CSP：放行本机协同桥连接与内嵌编辑器 iframe（同一 origin）。 */
export function bridgeConnectDomains() {
  return bridgePort ? [`http://127.0.0.1:${bridgePort}`] : [];
}

export function frameDomains() {
  return bridgePort ? [`http://127.0.0.1:${bridgePort}`] : [];
}

/** 内嵌编辑器字体兜底：unifont 从 fontsource（jsdelivr）按需下载 Noto 等字形包（中文等非内置字体）。 */
export function fontCdnDomains() {
  return ["https://cdn.jsdelivr.net"];
}

/** Gen UI：工具结果内联渲染工作台面板（MCP Apps _meta.ui 绑定）。 */
const UI_META = { ui: { resourceUri: "ui://wudi-coding/panel.html", surface: "wudi", visibility: ["model", "app"] } };

/* ================= 工具清单 ================= */

export const TOOLS = [
  {
    name: "wudi_project_get",
    description: "读取当前项目的无敌编程档案（.wudi/project.json：技术栈/构建命令/打包方式/部署根目录/远端脚本/健康检查）。档案不存在时返回缺失说明与建档字段模板。",
    inputSchema: { type: "object", properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },} },
  },
  {
    name: "wudi_project_init",
    description: "建立或更新项目档案。信息不全时可只传已有字段（浅合并，不影响其他字段）；缺关键字段（build/deployRoot/healthCheck.url）时返回体里会提示还缺什么。建议通过与用户问答收集后调用。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "项目名（用于产物命名，建议短横线小写）" },
        techStack: { type: "string", description: "技术栈一句话，如 go-service / vite-spa / node-nest / docker-compose" },
        build: { type: "string", description: "本地构建命令，在项目根执行，如 npm run build" },
        packageType: { type: "string", enum: ["dir", "docker-image"], description: "打包方式：dir=产物目录打 tar（软链发布）；docker-image=镜像 tar（docker load）" },
        packagePath: { type: "string", description: "packageType=dir 时的产物目录（相对项目根，如 dist）" },
        dockerImage: { type: "string", description: "packageType=docker-image 时的本地镜像名，如 myapp:latest" },
        deployRoot: { type: "string", description: "服务器上的部署根目录，如 /srv/myapp（其下 releases/ 按时间戳放版本）" },
        remoteScript: { type: "string", description: "版本切换后在服务器上执行的命令（cwd=deployRoot），如 docker compose up -d；静态站可留空" },
        logCommand: { type: "string", description: "服务日志命令（wudi_deploy_logs 用），如 docker compose logs --tail 200；各环境可在 wudi_env_set 里覆盖" },
        notifyWebhook: { type: "string", description: "部署/回滚终态通知的 webhook URL（飞书机器人、企微机器人或通用接收器）；各环境可覆盖" },
        notifyFormat: { type: "string", enum: ["feishu", "wecom", "generic"], description: "通知报文格式，缺省 generic" },
        confirmWord: { type: "string", description: "部署确认词（如给 prod 配）：设置后 wudi_deploy 对该环境必须传匹配的 confirmWord 才执行；各环境可覆盖" },
        deployPolicy: { type: "string", enum: ["confirm", "direct"], description: "部署审批策略：confirm=两步流（预检→确认，默认）；direct=一键直发（面板跳过确认对话框，宿主审批兜底；建议只给 staging 用）。各环境可覆盖" },
        defaultEnv: { type: "string", description: "默认环境名（多环境时用）" },
        remoteWhitelist: { type: "string", description: "逗号分隔的远端命令白名单前缀，供 wudi_remote_exec 校验，如 docker compose,df -h,journalctl" },
        healthCheckUrl: { type: "string", description: "健康检查 URL（默认在服务器本机 curl）" },
        healthExpect: { type: "number", description: "期望 HTTP 状态码，默认 200" },
        healthCheckFrom: { type: "string", enum: ["remote", "local"], description: "健康检查执行位置：remote=服务器上 curl（默认，适合 localhost 地址）；local=本机 fetch（适合公网域名）" },
        notes: { type: "string", description: "备注（环境变量清单、注意事项等）" },
      },
    },
  },
  {
    name: "wudi_projects_list",
    description: "项目注册表：列出所有已登记项目（自动含当前工作区）及各自概览——技术栈、环境、最近部署、文档/设计产物数。项目管理 landing 的数据源。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wudi_projects_add",
    description: "把一个项目根目录登记进项目注册表（按 path 去重；登记后可在工作台面板统一管理，概览只读，部署操作仍需在该项目工作区进行）。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "项目根目录绝对路径" },
        name: { type: "string", description: "显示名，缺省取目录名" },
      },
      required: ["path"],
    },
  },
  {
    name: "wudi_projects_remove",
    description: "从项目注册表移除一个项目（只移除登记，不删项目文件）。",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "项目 id（wudi_projects_list 里取）" } },
      required: ["id"],
    },
  },
  {
    name: "wudi_fs_list_dirs",
    description: "列出当前项目根目录（或其子目录）下的直接子文件夹，供工作台登记项目时选择路径。仅允许浏览当前项目根目录内的路径。",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "要浏览的目录（缺省为当前项目根）" } },
    },
  },
  {
    name: "wudi_projects_rename",
    description: "重命名工作台里的项目条目（只改显示名，不影响项目目录与文件）。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "项目 id（wudi_projects_list 里取）" },
        name: { type: "string", description: "新的项目显示名" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "wudi_design_create",
    description: "创建画布设计稿（.wudi/<项目>/designs/<名>.fig），返回路径。工作台创建画布用；同名已存在时返回已存在状态（幂等）。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "画布名称（不带扩展名），如 UI / 官网" },
        root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },
      },
      required: ["name"],
    },
  },
  {
    name: "wudi_status",
    description: "项目全景：档案摘要（含环境列表与当前环境解析结果）+ 最近部署 + 文档清单 + SSH 配置状态。/wudi 命令与工作台面板的数据源。",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },
        env: { type: "string", description: "目标环境名；档案配置了多个环境时缺省用 defaultEnv/第一个" },
        deployLimit: { type: "number", description: "返回最近几次部署，默认 5" },
      },
    },
  },
  {
    name: "wudi_docs_register",
    description: "登记/更新一份项目文档到 .wudi/docs.json（工作台文档库可见）。path 相对项目根。",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文档相对项目根路径，如 docs/api.md" },
        type: { type: "string", description: "文档类型：readme/api/prd/runbook/changelog/architecture/doc" },
        title: { type: "string", description: "标题，缺省用路径" },
        source: { type: "string", description: "生成来源说明，如 route scan / git log" },
      },
      required: ["path"],
    },
  },
  {
    name: "wudi_ssh_ping",
    description: "测试 SSH 目标连通性（可按环境覆盖 host/port/user），返回延迟。部署/面板环境状态检查用。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名；环境配置了 sshHost/sshPort/sshUser 覆盖时按该环境测试" },
      },
    },
  },
  {
    name: "wudi_deploy",
    description: "执行五阶段部署流水线：build → package → upload → remote（软链/镜像切换）→ verify（健康检查）。confirm=false 时只返回执行计划（预检）；confirm=true 才真正执行。支持 env 参数选择目标环境（staging/prod 等）。目标环境配置了 confirmWord 时必须同时传入匹配的 confirmWord（生产环境二次确认）。每次部署自动写入 .wudi/deploys.json 历史。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名（档案 envs 里的一个）；未配置多环境时可省略" },
        confirm: { type: "boolean", description: "是否真正执行。false=只出预检计划（默认）" },
        confirmWord: { type: "string", description: "确认词：目标环境/档案配置了 confirmWord 时必传且必须一致" },
        skipBuild: { type: "boolean", description: "跳过 build 阶段（产物已就绪时）" },
        pruneOld: { type: "boolean", description: "部署成功后清理该环境服务器旧版本，仅保留最近 5 个（只删时间戳命名的目录，先列后删并汇报）" },
      },
    },
  },
  {
    name: "wudi_deploy_history",
    description: "查询部署历史（.wudi/deploys.json），含每次的阶段明细与结果。可按环境过滤。",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },
        env: { type: "string", description: "只看某个环境的记录" },
        limit: { type: "number", description: "返回条数，默认 10，最大 50" },
      },
    },
  },
  {
    name: "wudi_rollback",
    description: "回滚到历史版本（软链模式：切 current 软链 + 执行 remoteScript + 健康检查）。docker-image 项目不支持软链回滚，返回指引（用本地保留的旧 artifact 重新部署）。confirm=false 时只返回回滚计划。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名" },
        target: { type: "string", description: "目标版本时间戳（yyyymmdd-hhmmss），缺省=当前版本的上一版" },
        confirm: { type: "boolean", description: "是否真正执行。false=只出计划（默认）" },
      },
    },
  },
  {
    name: "wudi_health_check",
    description: "只做健康检查：按档案 healthCheck 配置（可按环境）重试 3 次（间隔 5 秒），返回每次结果；失败时给出排查建议。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名" },
      },
    },
  },
  {
    name: "wudi_remote_exec",
    description: "在服务器上执行白名单内的命令（档案 remoteWhitelist 前缀匹配；白名单为空则拒绝）。confirm 必须 true。用于查日志、看磁盘等排查动作。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名" },
        command: { type: "string", description: "要执行的单条 shell 命令" },
        confirm: { type: "boolean", description: "必须为 true 才执行" },
        timeoutSec: { type: "number", description: "超时秒数，默认 60，最大 600" },
      },
      required: ["command"],
    },
  },
  {
    name: "wudi_deploy_logs",
    description: "拉取目标环境的服务日志（只读）：按档案的 logCommand 执行（如 docker compose logs --tail 200）。logCommand 未配置时返回设置指引。等价于 remote_exec 但免白名单、免 confirm（命令来自项目档案本身，只读用途）。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名" },
      },
    },
  },
  {
    name: "wudi_env_set",
    description: "新增/更新/删除一个部署环境（档案 envs 数组）。至少给 name；字段缺省回落顶层档案值。常用：staging 与 prod 各指向不同 deployRoot/healthCheckUrl，必要时用 sshHost/sshPort/sshUser 覆盖目标机器。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "环境名，如 staging / prod" },
        deployRoot: { type: "string", description: "该环境的部署根目录（覆盖顶层）" },
        remoteScript: { type: "string", description: "该环境的切换后命令（覆盖顶层）" },
        healthCheckUrl: { type: "string", description: "该环境的健康检查 URL（覆盖顶层）" },
        healthExpect: { type: "number", description: "该环境的期望状态码" },
        healthCheckFrom: { type: "string", enum: ["remote", "local"], description: "该环境的检查位置" },
        logCommand: { type: "string", description: "该环境的服务日志命令，如 docker compose logs --tail 200" },
        sshHost: { type: "string", description: "该环境独立的服务器地址（覆盖插件全局设置）" },
        sshPort: { type: "string", description: "该环境独立端口" },
        sshUser: { type: "string", description: "该环境独立用户" },
        notifyWebhook: { type: "string", description: "该环境独立的部署通知 webhook（覆盖顶层）" },
        notifyFormat: { type: "string", enum: ["feishu", "wecom", "generic"], description: "该环境的通知格式" },
        confirmWord: { type: "string", description: "该环境的部署确认词（覆盖顶层；清空传空字符串）" },
        deployPolicy: { type: "string", enum: ["confirm", "direct"], description: "该环境的部署审批策略（覆盖顶层；direct 建议只给 staging）" },
        setDefault: { type: "boolean", description: "同时把档案 defaultEnv 设为该环境" },
        remove: { type: "boolean", description: "删除该环境（忽略其他字段）" },
      },
      required: ["name"],
    },
  },
  {
    name: "wudi_doctor",
    description: "一键体检：档案完整性、SSH 连通、远端磁盘/内存、releases 数量与 current 软链、健康检查单次快测、通知配置。每项独立判 PASS/WARN/FAIL 并给出汇总，任何单项失败不影响其余检查。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名" },
      },
    },
  },
  {
    name: "wudi_design_tokens_export",
    description: "把 design tokens 导出为指定格式：css（变量文件）、tailwind（tailwind.config.js 的 theme.extend 片段）、json。落盘到 .wudi/design/exports/ 并返回内容。",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["css", "tailwind", "json"], description: "导出格式，默认 css" },
      },
    },
  },
  {
    name: "wudi_notify_test",
    description: "发送一条测试通知验证 webhook 配置（档案 notifyWebhook/notifyFormat，可按环境覆盖）。未配置时返回设置指引。",
    inputSchema: {
      type: "object",
      properties: {
        env: { type: "string", description: "目标环境名（用该环境的通知覆盖配置）" },
      },
    },
  },
  {
    name: "wudi_docs_weekly",
    description: "从 git log 生成周报草稿（默认近 7 天：概览统计 + 逐日 commit 清单 + 待补充事项骨架），写入 docs/weekly/ 并自动登记到文档库。项目不是 git 仓库时返回说明。",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "统计最近几天，默认 7" },
        author: { type: "string", description: "只统计该作者（git author 名，可选）" },
      },
    },
  },
  {
    name: "wudi_figma_fetch",
    description: "（可选能力）拉取 Figma 文件/节点的结构与样式提炼（布局、颜色 hex、字号、文本、flex/gap/padding），供 UI 设计 tokens 提取与设计转代码。需在插件设置配置 figmaToken；未配置时返回启用指引。",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma 链接（https://www.figma.com/file/...?node-id=1-2）或裸 fileKey。带 node-id 拉取该节点子树，不带则列出页面级概览" },
        maxDepth: { type: "number", description: "提炼树最大深度，默认 6" },
        budgetMax: { type: "number", description: "最多提炼的节点数，默认 400（超大文件防爆回复）" },
      },
      required: ["ref"],
    },
  },
  {
    name: "wudi_figma_images",
    description: "（可选能力）把 Figma 节点渲染成 PNG 下载到 .wudi/design/figma/，返回本地路径清单供与实现截图做视觉比对。需配置 figmaToken；nodeIds 缺省时返回用法指引。",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma 链接或裸 fileKey（同 wudi_figma_fetch）" },
        nodeIds: { type: "string", description: "节点 id，逗号分隔（如 12:34,12:35；来自 wudi_figma_fetch 的结构）" },
        scale: { type: "number", description: "导出倍率，默认 2（0.01~4）" },
      },
      required: ["ref", "nodeIds"],
    },
  },
  {
    name: "wudi_figma_tokens_diff",
    description: "（可选能力）拉取 Figma 画板样式并与本地 design tokens 比对：报告设计稿出现但 tokens 缺失的颜色/字号、tokens 中存在但设计稿未使用的项。只出报告不自动改 tokens。需配置 figmaToken；本地无 tokens 时提示先建。",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Figma 链接或裸 fileKey；强烈建议带 node-id 指向定稿画板（不带则扫整个文件的页面级节点，噪声大）" },
        maxDepth: { type: "number", description: "提取树最大深度，默认 8" },
      },
      required: ["ref"],
    },
  },
  {
    name: "wudi_canvas_bridge",
    description: "获取设计画布实时协同桥端点（SSE）。面板通过它订阅画布变更实现 Agent↔用户实时协同；一般无需主动调用，面板启动时自动连接。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wudi_canvas_get",
    description: "读取设计画布（.wudi/design/canvas.json 的形状列表）。画布是 Agent 可直接操作的设计画板：线框、流程、布局草图先画在这，再导出为设计稿。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wudi_canvas_edit",
    description: "编辑设计画布（Figma 式无限画布 + 多画板，批量操作）。ops 每项：{op:'add', shape:{type,x,y,w,h,fill,stroke,text,fontSize,frameId}} / {op:'update', id, patch} / {op:'delete', ids} / {op:'add_frame', frame:{name,x,y,w,h,background}} / {op:'update_frame', id, patch} / {op:'delete_frame', id, withShapes}。type: rect/ellipse/diamond/arrow/text；形状带 frameId 归入画板。每个 UI 设计建议一个画板（如 首页-1440、详情-375）。",
    inputSchema: {
      type: "object",
      properties: {
        ops: {
          type: "array",
          description: "批量操作数组，按顺序执行",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["add", "update", "delete", "add_frame", "update_frame", "delete_frame"] },
              shape: { type: "object", description: "op=add 时的形状" },
              id: { type: "string", description: "op=update/delete/update_frame/delete_frame 的目标 id" },
              patch: { type: "object", description: "op=update 的字段补丁" },
              ids: { type: "array", items: { type: "string" }, description: "op=delete 的 id 列表" },
              frame: { type: "object", description: "op=add_frame 时的画板（name/x/y/w/h，预设：桌面 1440x900、移动 375x812）" },
              withShapes: { type: "boolean", description: "op=delete_frame 时是否连同形状删除" },
            },
            required: ["op"],
          },
        },
      },
      required: ["ops"],
    },
  },
  {
    name: "wudi_canvas_clear",
    description: "清空设计画布（confirm 必须 true；建议先 wudi_canvas_get 展示现状征得同意）。",
    inputSchema: {
      type: "object",
      properties: { confirm: { type: "boolean", description: "必须为 true" } },
    },
  },
  {
    name: "wudi_canvas_export",
    description: "导出设计画布。format=html（默认）：SVG 设计稿 HTML 落到 mockups/，进面板图库；format=excalidraw：.excalidraw 场景文件落 .wudi/design/canvas/，随后可让 Agent 调官方 Excalidraw 插件的 open_diagram 导入，在完整级白板中继续编辑；format=both 两者都要。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "设计稿文件名（不含扩展名，如 app-wireframe-v1）" },
        format: { type: "string", enum: ["html", "excalidraw", "both"], description: "导出格式，默认 html" },
      },
      required: ["name"],
    },
  },
  {
    name: "wudi_tokens_compare",
    description: "比对一组外部 tokens（如 OpenPencil design_to_tokens 的输出、Figma 变量导出）与当前 design tokens：按扁平键路径报告 新增/变更/移除 三清单。只出报告不改本地；确认合并后用 wudi_design_tokens_set 整体写入。",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        tokens: { type: "object", description: "外部 tokens 对象（结构与 wudi tokens 一致：color/spacing/... 分组）" },
        json: { type: "string", description: "tokens 的 JSON 字符串（与 tokens 二选一）" },
      },
    },
  },
  {
    name: "wudi_designs_list",
    description: "列出工作区 designs/ 目录下的 .fig/.pen 设计稿文件（名称、大小、修改时间）。配合 OpenPencil 插件：Agent 可用 open_design 打开协同编辑、export_image 渲染 PNG 到 .wudi/design/renders/ 进面板图墙。",
    _meta: UI_META,
    inputSchema: { type: "object", properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },} },
  },
  {
    name: "wudi_design_delete",
    description: "删除工作区 designs/ 目录下的设计稿文件（.fig/.pen）。仅允许 designs/ 目录内的文件；若编辑器正打开该设计稿，建议先关闭再删除。",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" }, path: { type: "string", description: "设计稿路径，如 designs/old.fig" } },
      required: ["path"],
    },
  },
  {
    name: "wudi_design_rename",
    description: "重命名工作区 designs/ 目录下的设计稿文件（.fig/.pen）。仅允许 designs/ 目录内操作；目标名已存在时拒绝。",
    inputSchema: {
      type: "object",
      properties: { root: { type: "string", description: "项目根路径（缺省为当前工作区；工作台多项目内容页传入）" },
        path: { type: "string", description: "现有设计稿路径，如 designs/old.fig" },
        name: { type: "string", description: "新文件名，如 new.fig（不含目录）" },
      },
      required: ["path", "name"],
    },
  },
  {
    name: "wudi_figma_link",
    description: "记住/查看项目的 Figma 文件链接（https://www.figma.com/ 开头）。设置后面板设计页可一键在浏览器打开 Figma 完整编辑器。注意：Figma API 只读，Agent 能读设计但改不了 Figma 文件；需要 Agent 写的设计走 Excalidraw。",
    _meta: UI_META,
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Figma 文件链接；缺省为查看当前链接" },
      },
    },
  },
  {
    name: "wudi_design_tokens_get",
    description: "读取项目 design tokens（.wudi/design/tokens.json：color/spacing/radius/shadow/typography 等分组）。不存在时返回结构模板与建立指引。",
    _meta: UI_META,
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "wudi_design_tokens_set",
    description: "写入 design tokens（整体覆盖），并同步生成 tokens.css（CSS 变量 --分组-键名）。传 tokens 对象，或传 json 字符串。",
    inputSchema: {
      type: "object",
      properties: {
        tokens: { type: "object", description: "tokens 对象，如 { color: { primary: '#3b6ef6' }, spacing: { sm: '8px' } }" },
        json: { type: "string", description: "tokens 的 JSON 字符串（与 tokens 二选一）" },
      },
    },
  },
  {
    name: "wudi_design_list",
    description: "列出 .wudi/design/ 下的设计产物（设计稿 HTML 版本、tokens 文件），含大小与修改时间。设计迭代历史一目了然。",
    _meta: UI_META,
    inputSchema: { type: "object", properties: {} },
  },
];

/* ================= 分发 ================= */

export async function callTool(name, args = {}) {
  try {
    switch (name) {
      case "wudi_project_get":
        return toolProjectGet(args);
      case "wudi_project_init":
        return toolProjectInit(args);
      case "wudi_status":
        return await toolStatus(args);
      case "wudi_docs_register":
        return toolDocsRegister(args);
      case "wudi_ssh_ping":
        return await toolSshPing();
      case "wudi_deploy":
        return await toolDeploy(args);
      case "wudi_deploy_history":
        return toolDeployHistory(args);
      case "wudi_rollback":
        return await toolRollback(args);
      case "wudi_health_check":
        return await toolHealthCheck();
      case "wudi_remote_exec":
        return await toolRemoteExec(args);
      case "wudi_figma_fetch":
        return await toolFigmaFetch(args);
      case "wudi_deploy_logs":
        return await toolDeployLogs(args);
      case "wudi_doctor":
        return await toolDoctor(args);
      case "wudi_env_set":
        return toolEnvSet(args);
      case "wudi_design_tokens_get":
        return toolDesignTokensGet();
      case "wudi_design_tokens_set":
        return toolDesignTokensSet(args);
      case "wudi_design_list":
        return toolDesignList();
      case "wudi_design_tokens_export":
        return toolDesignTokensExport(args);
      case "wudi_figma_link":
        return toolFigmaLink(args);
      case "wudi_designs_list":
        return toolDesignsList(args);
      case "wudi_design_delete":
        return toolDesignDelete(args);
      case "wudi_design_rename":
        return toolDesignRename(args);
      case "wudi_design_create":
        return toolDesignCreate(args);
      case "wudi_tokens_compare":
        return toolTokensCompare(args);
      case "wudi_canvas_get":
        return toolCanvasGet();
      case "wudi_canvas_bridge":
        return toolCanvasBridge();
      case "wudi_canvas_edit":
        return toolCanvasEdit(args);
      case "wudi_canvas_clear":
        return toolCanvasClear(args);
      case "wudi_canvas_export":
        return toolCanvasExport(args);
      case "wudi_docs_weekly":
        return await toolDocsWeekly(args);
      case "wudi_notify_test":
        return await toolNotifyTest(args);
      case "wudi_projects_list":
        return toolProjectsList();
      case "wudi_projects_add":
        return toolProjectsAdd(args);
      case "wudi_projects_remove":
        return toolProjectsRemove(args);
      case "wudi_projects_rename":
        return toolProjectsRename(args);
      case "wudi_fs_list_dirs":
        return toolFsListDirs(args);
      case "wudi_figma_images":
        return await toolFigmaImages(args);
      case "wudi_figma_tokens_diff":
        return await toolFigmaTokensDiff(args);
      default:
        return fail(`未知工具：${name}`);
    }
  } catch (err) {
    return fail(`工具 ${name} 执行失败：${String(err?.message ?? err).slice(0, 1500)}`);
  }
}

/* ================= 项目档案 ================= */

function toolProjectGet(args: any = {}) {
  const project = store.loadProjectAt(toolRoot(args));
  if (!project) {
    return ok(
      [
        "当前项目还没有无敌编程档案（.wudi/project.json）。",
        "请通过问答向用户收集以下信息后调用 wudi_project_init 建档：",
        "- name / techStack：项目名与技术栈",
        "- build：本地构建命令",
        "- packageType：dir（产物目录）或 docker-image（镜像 tar）",
        "- deployRoot：服务器部署根目录；remoteScript：版本切换后命令",
        "- healthCheckUrl：健康检查 URL",
        "字段模板：",
        j(store.PROJECT_TEMPLATE),
      ].join("\n")
    );
  }
  const envLine = store.listEnvNames(project).length > 1 || project.envs?.length
    ? `\n环境：${store.listEnvNames(project).join("、")}${project.defaultEnv ? `（默认 ${project.defaultEnv}）` : ""}`
    : "";
  return ok(`项目档案（.wudi/project.json）：\n${j(project)}${envLine}`, { project });
}

/** 新增/更新/删除环境；返回更新后的档案。 */
function toolEnvSet(args) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失，先 wudi_project_init。");
  const name = String(args.name ?? "").trim();
  if (!name) return fail("缺少 name。");
  if (name === "default") return fail("default 是单环境模式的虚拟名，不能作为显式环境名。");
  const envs = Array.isArray(project.envs) ? [...project.envs] : [];
  if (args.remove === true) {
    const next = { ...project, envs: envs.filter((e) => e.name !== name) };
    if (next.defaultEnv === name) next.defaultEnv = "";
    store.saveProject({ envs: next.envs, defaultEnv: next.defaultEnv });
    return ok(`环境「${name}」已删除。当前环境：${store.listEnvNames(next).join("、")}`, { project: next });
  }
  const env = envs.find((e) => e.name === name) ?? { name };
  if (args.deployRoot !== undefined) env.deployRoot = String(args.deployRoot).trim();
  if (args.remoteScript !== undefined) env.remoteScript = String(args.remoteScript);
  if (args.healthCheckUrl !== undefined) env.healthCheck = { ...env.healthCheck, url: String(args.healthCheckUrl).trim() };
  if (args.healthExpect !== undefined) env.healthCheck = { ...env.healthCheck, expect: Number(args.healthExpect) || 200 };
  if (args.healthCheckFrom !== undefined) env.healthCheck = { ...env.healthCheck, checkFrom: args.healthCheckFrom === "local" ? "local" : "remote" };
  if (args.logCommand !== undefined) env.logCommand = String(args.logCommand);
  if (args.sshHost !== undefined) env.sshHost = String(args.sshHost).trim();
  if (args.sshPort !== undefined) env.sshPort = String(args.sshPort).trim();
  if (args.sshUser !== undefined) env.sshUser = String(args.sshUser).trim();
  if (args.notifyWebhook !== undefined) env.notifyWebhook = String(args.notifyWebhook).trim();
  if (args.notifyFormat !== undefined) env.notifyFormat = ["feishu", "wecom", "generic"].includes(String(args.notifyFormat)) ? String(args.notifyFormat) : "generic";
  if (args.confirmWord !== undefined) env.confirmWord = String(args.confirmWord).trim();
  if (args.deployPolicy !== undefined) env.deployPolicy = String(args.deployPolicy) === "direct" ? "direct" : "confirm";
  const idx = envs.findIndex((e) => e.name === name);
  if (idx >= 0) envs[idx] = env;
  else envs.push(env);
  const patch = { envs };
  if (args.setDefault === true) patch.defaultEnv = name;
  const { project: next } = store.saveProject(patch);
  const resolved = store.resolveEnv(next, name);
  return ok(
    [
      `环境「${name}」已${idx >= 0 ? "更新" : "新增"}${args.setDefault ? "（设为默认）" : ""}。`,
      `解析结果（含回落顶层）：\n${j(resolved)}`,
      `当前环境列表：${store.listEnvNames(next).join("、")}`,
    ].join("\n"),
    { project: next, resolved }
  );
}

function toolProjectInit(args) {
  const patch = {};
  if (args.name !== undefined) patch.name = String(args.name);
  if (args.techStack !== undefined) patch.techStack = String(args.techStack);
  if (args.build !== undefined) patch.build = String(args.build);
  if (args.deployRoot !== undefined) patch.deployRoot = String(args.deployRoot).trim();
  if (args.remoteScript !== undefined) patch.remoteScript = String(args.remoteScript);
  if (args.notes !== undefined) patch.notes = String(args.notes);
  if (args.logCommand !== undefined) patch.logCommand = String(args.logCommand);
  if (args.defaultEnv !== undefined) patch.defaultEnv = String(args.defaultEnv);
  if (args.notifyWebhook !== undefined) patch.notifyWebhook = String(args.notifyWebhook).trim();
  if (args.notifyFormat !== undefined) patch.notifyFormat = ["feishu", "wecom", "generic"].includes(String(args.notifyFormat)) ? String(args.notifyFormat) : "generic";
  if (args.confirmWord !== undefined) patch.confirmWord = String(args.confirmWord).trim();
  if (args.deployPolicy !== undefined) patch.deployPolicy = String(args.deployPolicy) === "direct" ? "direct" : "confirm";
  if (args.remoteWhitelist !== undefined) {
    patch.remoteWhitelist = String(args.remoteWhitelist)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (args.packageType !== undefined || args.packagePath !== undefined || args.dockerImage !== undefined) {
    patch.package = {};
    if (args.packageType !== undefined) patch.package.type = args.packageType === "docker-image" ? "docker-image" : "dir";
    if (args.packagePath !== undefined) patch.package.path = String(args.packagePath);
    if (args.dockerImage !== undefined) patch.package.dockerImage = String(args.dockerImage);
  }
  if (args.healthCheckUrl !== undefined || args.healthExpect !== undefined || args.healthCheckFrom !== undefined) {
    patch.healthCheck = {};
    if (args.healthCheckUrl !== undefined) patch.healthCheck.url = String(args.healthCheckUrl).trim();
    if (args.healthExpect !== undefined) patch.healthCheck.expect = Number(args.healthExpect) || 200;
    if (args.healthCheckFrom !== undefined) patch.healthCheck.checkFrom = args.healthCheckFrom === "local" ? "local" : "remote";
  }
  const { project, file } = store.saveProject(patch);
  const missing = [];
  if (!project.build) missing.push("build（本地构建命令）");
  if (!project.deployRoot) missing.push("deployRoot（服务器部署根目录）");
  if (!project.healthCheck.url) missing.push("healthCheckUrl（健康检查 URL，不配则部署只到 verify 跳过）");
  const lines = [`档案已保存：${file}`, j(project)];
  if (missing.length) lines.push(`\n还缺关键字段（不影响建档，但部署前要补）：\n- ${missing.join("\n- ")}`);
  return ok(lines.join("\n"), { project });
}

/* ================= 状态汇总 ================= */

async function toolStatus(args: any = {}) {
  let root;
  try { root = toolRoot(args); } catch (err: any) { return fail(String(err?.message ?? err)); }
  const project = store.loadProjectAt(root);
  const envName = args.env ? String(args.env) : undefined;
  let resolved = null;
  let envErr = null;
  if (project) {
    try {
      resolved = store.resolveEnv(project, envName);
    } catch (err) {
      envErr = String(err?.message ?? err);
    }
  }
  const deployLimit = Math.min(Math.max(Number(args.deployLimit) || 5, 1), 20);
  const deploys = store.loadDeploysAt(root).slice(0, deployLimit);
  const docs = store.loadDocsAt(root);
  let sshLine = "SSH：未配置（插件设置里填 sshHost 等）";
  try {
    const cfg = sshConfig(resolved?.ssh ?? {});
    sshLine = `SSH：${cfg.user}@${cfg.host}:${cfg.port}${cfg.identity ? `（密钥 ${cfg.identity}）` : "（默认密钥/agent）"}${resolved && resolved.name !== "default" ? `（环境 ${resolved.name}）` : ""}`;
  } catch {
    /* 未配置 */
  }
  const envsLine = project ? `环境：${store.listEnvNames(project).join("、")}${resolved ? `｜当前解析：${resolved.name}` : ""}` : "";
  const lines = [
    "═══ 无敌编程 · 项目全景 ═══",
    project
      ? [
          `项目：${project.name || "(未命名)"}｜技术栈：${project.techStack || "?"}`,
          `构建：${project.build || "(未配置)"}`,
          `打包：${project.package.type === "docker-image" ? `镜像 ${project.package.dockerImage || "(未配置镜像名)"}` : `目录 ${project.package.path}`}`,
          envsLine,
          envErr ? `环境解析失败：${envErr}` : resolved ? `部署（${resolved.name}）：${resolved.deployRoot || "(未配置)"}；切换脚本：${resolved.remoteScript || "(无)"}；日志：${resolved.logCommand || "(未配置)"}` : "",
          `健康检查：${resolved?.healthCheck?.url || "(未配置)"}（期望 ${resolved?.healthCheck?.expect ?? 200}，${resolved?.healthCheck?.checkFrom ?? "remote"} 侧检查）`,
        ].filter(Boolean).join("\n")
      : "项目档案：缺失（用 wudi_project_init 或 /wudi 建档）",
    sshLine,
    `最近部署（${deploys.length}）：`,
    deploys.length
      ? deploys
          .map(
            (d) =>
              `- ${d.release ?? d.id}｜${d.type === "rollback" ? "回滚" : "部署"}${d.env && d.env !== "default" ? `@${d.env}` : ""}｜${d.status}｜${d.finishedAt ?? d.startedAt}${
                d.status === "failed" ? `｜卡在 ${d.failedStage ?? "?"}` : ""
              }`
          )
          .join("\n")
      : "  （无部署记录）",
    `文档（${docs.length}）：`,
    docs.length ? docs.slice(0, 10).map((d) => `- [${d.type}] ${d.path}`).join("\n") : "  （无登记文档，用 wudi_docs_register 登记）",
  ];
  return ok(lines.join("\n"), { project, envs: project ? store.listEnvNames(project) : [], currentEnv: resolved?.name ?? null, resolved, deploys, docs: docs.slice(0, 50) });
}

function toolDocsRegister(args) {
  const doc = store.registerDoc({
    path: args.path,
    type: args.type,
    title: args.title,
    source: args.source,
  });
  return ok(`文档已登记：[${doc.type}] ${doc.path}（.wudi/docs.json）`, { doc });
}

async function toolSshPing(args: any = {}) {
  try {
    const project = store.loadProject();
    const overrides = project ? store.resolveEnv(project, args.env ? String(args.env) : undefined).ssh : {};
    const r = await sshPing(overrides);
    return ok(`SSH 连通：${r.host}，延迟 ${r.latencyMs}ms`, { ping: r });
  } catch (err) {
    return fail(`SSH 连通失败：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

/* ================= 部署流水线 ================= */

function artifactsDir() {
  const dir = join(store.wudiDir(), "artifacts");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function artifactName(project, stamp, ext) {
  const safe = String(project.name || "app").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "app";
  return `${safe}-${stamp}.${ext}`;
}

/** 打包产物，返回 {file, sizeBytes, kind}。 */
async function stagePackage(project, stamp) {
  if (project.package.type === "docker-image") {
    if (!project.package.dockerImage) throw new Error("packageType=docker-image 但档案未配置 dockerImage（本地镜像名）。");
    const file = join(artifactsDir(), artifactName(project, stamp, "tar"));
    await localRun(`docker save -o ${q(file)} ${q(project.package.dockerImage)}`, { cwd: store.projectRoot() });
    return { file, kind: "docker-image" };
  }
  const pkgPath = resolve(store.projectRoot(), project.package.path || "dist");
  if (!existsSync(pkgPath)) throw new Error(`产物目录不存在：${pkgPath}（检查档案 package.path 或先完成构建）`);
  const file = join(artifactsDir(), artifactName(project, stamp, "tar.gz"));
  await localRun(
    `tar -czf ${q(file)} --exclude='./.wudi' --exclude='./.env' --exclude='./.git' -C ${q(pkgPath)} .`,
    { cwd: store.projectRoot() }
  );
  return { file, kind: "dir" };
}

async function checkHealthOnce(envObj) {
  const hc = envObj.healthCheck ?? {};
  if (!hc.url) return { skipped: true, reason: "档案未配置 healthCheck.url，跳过健康检查" };
  const expect = Number(hc.expect ?? 200);
  if ((hc.checkFrom ?? "remote") === "local") {
    const res = await fetch(hc.url, { signal: AbortSignal.timeout(8000) });
    return { ok: res.status === expect, status: res.status, expect, via: "local" };
  }
  const { stdout } = await sshRun(`curl -s -o /dev/null -w '%{http_code}' --max-time 8 ${q(hc.url)}`, { timeoutMs: 30_000, overrides: envObj.ssh });
  const status = parseInt(String(stdout).trim(), 10);
  return { ok: status === expect, status, expect, via: "remote" };
}

async function checkHealthWithRetry(envObj, attempts = 3, gapMs = 5000) {
  const results = [];
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(gapMs);
    try {
      results.push(await checkHealthOnce(envObj));
    } catch (err) {
      results.push({ ok: false, error: String(err?.message ?? err).slice(0, 300) });
    }
    const last = results.at(-1);
    if (last.ok || last.skipped) break;
  }
  return results;
}

function formatHealth(results) {
  return results
    .map((r, i) =>
      r.skipped
        ? `第 ${i + 1} 次：跳过（${r.reason}）`
        : r.ok
          ? `第 ${i + 1} 次：HTTP ${r.status} ✓（${r.via} 侧检查）`
          : `第 ${i + 1} 次：${r.status !== undefined ? `HTTP ${r.status}（期望 ${r.expect}）` : `错误：${r.error}`}`
    )
    .join("\n");
}

function planText(lines, confirmHint) {
  return [...lines, "", confirmHint].join("\n");
}

async function toolDeploy(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失，先 wudi_project_init。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.deployRoot) return fail(`环境 ${envObj.name} 缺 deployRoot（wudi_project_init 补顶层或 wudi_env_set 补该环境）。`);
  const confirm = args.confirm === true;
  const skipBuild = args.skipBuild === true;
  const pruneOld = args.pruneOld === true;
  const stamp = store.releaseStamp();
  let cfg;
  try {
    cfg = sshConfig(envObj.ssh);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }

  if (!skipBuild && !project.build) return fail("档案缺 build 命令（或本次调用带 skipBuild=true 跳过构建）。");

  // 生产环境二次确认词：环境/档案配置了 confirmWord 时，confirm=true 还必须带上匹配的词
  if (confirm && envObj.confirmWord) {
    if (String(args.confirmWord ?? "").trim() !== envObj.confirmWord) {
      return fail(
        [
          `环境 ${envObj.name} 配置了部署确认词（confirmWord），本次调用未通过校验，流水线未执行。`,
          "处置：向用户复述预检计划并索取确认词后，带 confirm=true + confirmWord 重新调用。",
        ].join("\n")
      );
    }
  }

  // 预检计划
  if (!confirm) {
    const lines = [
      "═══ 部署预检计划（未执行）═══",
      `环境：${envObj.name}${envObj.confirmWord ? "（需确认词）" : ""}`,
      `目标：${cfg.user}@${cfg.host}:${cfg.port} → ${envObj.deployRoot}`,
      `版本：${stamp}`,
      `阶段：${[!skipBuild && "build", "package", "upload", "remote", envObj.healthCheck.url ? "verify" : "verify(跳过：未配健康检查)"].filter(Boolean).join(" → ")}`,
      `打包：${project.package.type === "docker-image" ? `docker save ${project.package.dockerImage}` : `tar ${project.package.path}`}`,
      envObj.remoteScript ? `切换后执行：${envObj.remoteScript}` : "切换后无远端脚本",
      "上线确认：请向用户复述以上目标并征得同意后，再次调用 wudi_deploy 并带 confirm=true。",
    ];
    return ok(planText(lines, "（本次仅预检，未做任何变更）"));
  }

  const record = {
    id: `dep-${stamp}`,
    type: "deploy",
    env: envObj.name,
    release: stamp,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    failedStage: null,
    stages: [],
  };
  store.appendDeploy(record);

  const stage = async (name, fn) => {
    const entry = { name, status: "running", startedAt: new Date().toISOString(), detail: "", durationMs: 0 };
    record.stages.push(entry);
    store.updateDeploy(record.id, { stages: record.stages });
    const t0 = Date.now();
    try {
      const detail = await fn();
      entry.status = detail?.skipped ? "skipped" : "ok";
      entry.detail = detail?.summary ?? "";
      entry.durationMs = Date.now() - t0;
      store.updateDeploy(record.id, { stages: record.stages });
      return detail;
    } catch (err) {
      entry.status = "failed";
      entry.detail = String(err?.message ?? err).slice(0, 800);
      entry.durationMs = Date.now() - t0;
      record.status = "failed";
      record.failedStage = name;
      record.finishedAt = new Date().toISOString();
      store.updateDeploy(record.id, { status: record.status, failedStage: name, finishedAt: record.finishedAt, stages: record.stages });
      throw err;
    }
  };

  let pkg;
  try {
    if (!skipBuild) {
      await stage("build", async () => {
        const { stderr } = await localRun(project.build, { cwd: store.projectRoot() });
        return { summary: "构建完成" + (stderr ? `（stderr 有输出：${clip(stderr, 300)}）` : "") };
      });
    } else {
      record.stages.push({ name: "build", status: "skipped", detail: "skipBuild=true", startedAt: new Date().toISOString(), durationMs: 0 });
    }
    pkg = await stage("package", () => stagePackage(project, stamp));
    await stage("upload", async () => {
      await sshRun(`mkdir -p ${q(join(envObj.deployRoot, "releases", stamp).replaceAll("\\", "/"))}`, { timeoutMs: 60_000, overrides: envObj.ssh });
      const remotePath = `${envObj.deployRoot}/releases/${stamp}/bundle${pkg.kind === "docker-image" ? ".tar" : ".tar.gz"}`;
      await uploadFile(pkg.file, remotePath, { overrides: envObj.ssh });
      const sizeMB = (statSync(pkg.file).size / 1024 / 1024).toFixed(1);
      return { summary: `上传 ${sizeMB} MB → ${remotePath}`, remotePath };
    });
    await stage("remote", async () => {
      const remoteDir = `${envObj.deployRoot}/releases/${stamp}`;
      if (pkg.kind === "docker-image") {
        await sshRun(`docker load -i ${q(`${remoteDir}/bundle.tar`)}`, { timeoutMs: 300_000, overrides: envObj.ssh });
        await sshRun(`rm -f ${q(`${remoteDir}/bundle.tar`)}`, { overrides: envObj.ssh });
      } else {
        await sshRun(`tar -xzf ${q(`${remoteDir}/bundle.tar.gz`)} -C ${q(remoteDir)} && rm -f ${q(`${remoteDir}/bundle.tar.gz`)}`, { timeoutMs: 120_000, overrides: envObj.ssh });
        await sshRun(`ln -sfn ${q(join(envObj.deployRoot, "releases", stamp))} ${q(join(envObj.deployRoot, "current"))}`, { overrides: envObj.ssh });
      }
      if (envObj.remoteScript) {
        await sshRun(`cd ${q(envObj.deployRoot)} && ( ${envObj.remoteScript} )`, { timeoutMs: 300_000, overrides: envObj.ssh });
      }
      return { summary: `${pkg.kind === "docker-image" ? "镜像加载" : "软链已切换"}${envObj.remoteScript ? ` + 执行 ${envObj.remoteScript}` : ""}` };
    });
    const healthResults = await stage("verify", async () => {
      const results = await checkHealthWithRetry(envObj);
      const last = results.at(-1);
      // 健康快照：随部署记录存档（面板时间线展示）
      record.health = last.skipped ? { skipped: true } : { ok: !!last.ok, status: last.status, via: last.via, attempts: results.length };
      if (last.skipped) return { summary: last.reason, skipped: true };
      if (!last.ok) {
        throw new Error(`健康检查未通过（${results.length} 次尝试）：\n${formatHealth(results)}`);
      }
      return { summary: `健康检查通过（${results.length} 次内）`, healthResults: results };
    });
    record.status = healthResults?.skipped ? "ok-with-warnings" : "ok";
    record.finishedAt = new Date().toISOString();
    store.updateDeploy(record.id, { status: record.status, finishedAt: record.finishedAt, ...(record.health ? { health: record.health } : {}) });

    // 清理旧版本（可选）
    let pruneLine = "";
    if (pruneOld) pruneLine = `\n${await pruneReleases(envObj)}`;

    // 终态通知（失败不影响部署结果）
    let notifyLine = "";
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name, env: envObj.name, type: "deploy", status: record.status,
        release: stamp, failedStage: null, durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: record.stages.find((s) => s.status === "failed")?.detail ?? "",
      });
      notifyLine = `\n通知：${notifyRes.detail}`;
    }

    const lines = [
      "═══ 部署完成 ═══",
      `环境：${envObj.name}｜版本：${stamp} → ${cfg.user}@${cfg.host}:${envObj.deployRoot}`,
      ...record.stages.map((s) => `- ${s.name}: ${s.status}${s.detail ? `（${s.detail}）` : ""}${s.durationMs ? ` ${s.durationMs}ms` : ""}`),
      record.status === "ok-with-warnings" ? "注意：未配置健康检查 URL，本次部署未经线上验证。" : "",
      pruneLine,
      notifyLine,
      record.status === "ok-with-warnings"
        ? "建议：补全档案 healthCheck.url 后用 wudi_health_check 手动验证。"
        : "下一步：如需文档更新用 /wudi-docs changelog。",
    ].filter(Boolean);
    return ok(lines.join("\n"), { deploy: store.loadDeploys()[0] });
  } catch (err) {
    const failed = record.stages.find((s) => s.status === "failed");
    const remoteTouched = ["remote", "verify"].includes(record.failedStage);
    // 失败终态通知
    let notifyLine = "";
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name, env: envObj.name, type: "deploy", status: "failed",
        release: stamp, failedStage: record.failedStage,
        durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: failed?.detail ?? String(err?.message ?? err),
      });
      notifyLine = `\n通知：${notifyRes.detail}`;
    }
    const lines = [
      "═══ 部署失败 ═══",
      `环境：${envObj.name}｜卡在阶段：${record.failedStage}`,
      `错误：${clip(failed?.detail ?? err?.message, 800)}`,
      remoteTouched
        ? "注意：失败发生在远端切换之后，线上可能受影响 —— 立即评估：wudi_health_check 检查，或 wudi_rollback 回滚上一版。"
        : "线上未受影响（失败发生在上传/切换之前）。",
      notifyLine,
      "修复后重新调用 wudi_deploy（confirm=true）。",
    ].filter(Boolean);
    return fail(lines.join("\n"));
  }
}

function toolDeployHistory(args: any = {}) {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
  const envFilter = args.env ? String(args.env) : null;
  let root;
  try { root = toolRoot(args); } catch (err: any) { return fail(String(err?.message ?? err)); }
  const deploys = store
    .loadDeploysAt(root)
    .filter((d) => !envFilter || d.env === envFilter)
    .slice(0, limit);
  if (!deploys.length) return ok(envFilter ? `环境 ${envFilter} 还没有部署记录。` : "还没有部署记录。", { deploys: [] });
  const lines = deploys.map((d) =>
    [
      `── ${d.release ?? d.id}｜${d.type === "rollback" ? "回滚" : "部署"}${d.env && d.env !== "default" ? `@${d.env}` : ""}｜${d.status}`,
      `   ${d.startedAt} → ${d.finishedAt ?? "进行中"}`,
      ...d.stages.map((s) => `   ${s.name}: ${s.status}${s.detail ? `｜${clip(s.detail, 160)}` : ""}`),
    ].join("\n")
  );
  return ok(lines.join("\n"), { deploys });
}

/* ================= 回滚 ================= */

function parseRemoteReleases(stdout) {
  return String(stdout)
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => /^\d{8}-\d{6}$/.test(s))
    .sort()
    .reverse();
}

async function readCurrentRelease(envObj) {
  const { stdout } = await sshRun(`readlink ${q(join(envObj.deployRoot, "current"))}`, { timeoutMs: 30_000, overrides: envObj.ssh });
  const m = String(stdout).trim().match(/(\d{8}-\d{6})$/);
  return m ? m[1] : "";
}

async function toolRollback(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (project.package.type === "docker-image") {
    const artifacts = listLocalArtifacts();
    return fail(
      [
        "docker-image 项目没有软链可切，不能用一键回滚。两个替代方案：",
        "1. 本地保留了最近 10 个镜像 artifact（.wudi/artifacts/）：",
        ...(artifacts.length ? artifacts.map((a) => `   - ${a.name}（${a.sizeMB} MB）`) : ["   （本地无保留 artifact）"]),
        "   选定旧版本后，把档案 dockerImage 临时指向旧镜像重打包部署；或直接 docker load 旧 tar + 调整 compose 后 wudi_remote_exec 执行。",
        "2. 若服务器上旧镜像 tag 还在：wudi_remote_exec 执行 docker tag/compose 切换（需在 remoteWhitelist 白名单内）。",
      ].join("\n")
    );
  }
  if (!envObj.deployRoot) return fail(`环境 ${envObj.name} 缺 deployRoot。`);
  const confirm = args.confirm === true;

  let releases;
  try {
    const { stdout } = await sshRun(`ls -1 ${q(join(envObj.deployRoot, "releases"))}`, { timeoutMs: 30_000, overrides: envObj.ssh });
    releases = parseRemoteReleases(stdout);
  } catch (err) {
    return fail(`无法读取服务器版本列表（SSH 不可达或 releases 目录缺失）：${String(err?.message ?? err).slice(0, 300)}`);
  }
  if (!releases.length) return fail(`服务器 ${envObj.deployRoot}/releases 下没有可回滚的版本。`);
  const current = await readCurrentRelease(envObj);
  const target = args.target ? String(args.target).trim() : releases.find((r) => r < (current || releases[0]));

  if (!target) {
    return fail(`环境 ${envObj.name} 当前只有一个版本（${releases[0]}）且正在运行，没有可回滚的上一版。`);
  }
  if (!releases.includes(target)) {
    return fail(`目标版本 ${target} 不存在。服务器可用版本（新→旧）：\n${releases.join("\n")}`);
  }
  if (target === current) return fail(`目标版本 ${target} 就是当前线上版本，无需回滚。可用版本：\n${releases.join("\n")}`);

  if (!confirm) {
    return ok(
      planText(
        [
          "═══ 回滚预检计划（未执行）═══",
          `环境：${envObj.name}`,
          `当前线上：${current || "(未知)"}`,
          `回滚到：${target}`,
          `动作：切换 current 软链${envObj.remoteScript ? ` + 执行 ${envObj.remoteScript}` : ""} + 健康检查`,
          envObj.remoteScript?.includes("migrate") ? "警告：切换脚本疑似包含 migrate，数据库迁移不可自动回滚，请先确认有备份！" : "",
        ].filter(Boolean),
        "与用户确认后再次调用 wudi_rollback 并带 confirm=true。"
      )
    );
  }

  const stamp = store.releaseStamp();
  const record = {
    id: `rb-${stamp}`,
    type: "rollback",
    env: envObj.name,
    release: target,
    fromRelease: current,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    failedStage: null,
    stages: [],
  };
  store.appendDeploy(record);
  try {
    await sshRun(`ln -sfn ${q(join(envObj.deployRoot, "releases", target))} ${q(join(envObj.deployRoot, "current"))}`, { timeoutMs: 60_000, overrides: envObj.ssh });
    record.stages.push({ name: "switch", status: "ok", detail: `current → ${target}`, startedAt: new Date().toISOString(), durationMs: 0 });
    if (envObj.remoteScript) {
      await sshRun(`cd ${q(envObj.deployRoot)} && ( ${envObj.remoteScript} )`, { timeoutMs: 300_000, overrides: envObj.ssh });
      record.stages.push({ name: "remote", status: "ok", detail: envObj.remoteScript, startedAt: new Date().toISOString(), durationMs: 0 });
    }
    store.updateDeploy(record.id, { stages: record.stages });
    const health = await checkHealthWithRetry(envObj);
    const last = health.at(-1);
    record.stages.push({ name: "verify", status: last.ok ? "ok" : last.skipped ? "skipped" : "failed", detail: formatHealth(health), startedAt: new Date().toISOString(), durationMs: 0 });
    record.health = last.skipped ? { skipped: true } : { ok: !!last.ok, status: last.status, via: last.via, attempts: health.length };
    record.status = last.ok ? "ok" : last.skipped ? "ok-with-warnings" : "failed";
    record.finishedAt = new Date().toISOString();
    store.updateDeploy(record.id, { status: record.status, finishedAt: record.finishedAt, stages: record.stages, health: record.health });
    // 回滚终态通知
    const notifyCfg = resolveNotify(project, envObj);
    if (notifyCfg) {
      const notifyRes = await sendNotify(notifyCfg, {
        project: project.name, env: envObj.name, type: "rollback", status: record.status,
        release: target, failedStage: record.status === "failed" ? "verify" : null,
        durationMs: Date.now() - new Date(record.startedAt).getTime(),
        detail: formatHealth(health),
      });
      var notifyLine = `\n通知：${notifyRes.detail}`;
    } else {
      var notifyLine = "";
    }
    if (record.status === "failed") {
      return fail(
        [
          `═══ 回滚已切换但健康检查未通过 ═══`,
          `current 已指向 ${target}，但服务未恢复。按排查清单检查：`,
          "1) docker ps / systemctl status 看进程；2) docker logs / journalctl 看日志；3) ss -tlnp 看端口；4) 磁盘 df -h。",
          "可用 wudi_remote_exec（白名单内命令）或 wudi_deploy_logs 排查，或考虑回滚到更早版本。",
        ].join("\n")
      );
    }
    return ok(
      [
        `═══ 回滚${record.status === "ok-with-warnings" ? "完成（未经健康检查验证）" : "完成"} ═══`,
        `环境：${envObj.name}｜线上版本：${target}（原 ${current || "未知"}）`,
        formatHealth(health),
        notifyLine,
      ].filter(Boolean).join("\n"),
      { deploy: store.loadDeploys()[0] }
    );
  } catch (err) {
    record.status = "failed";
    record.failedStage = "switch";
    record.finishedAt = new Date().toISOString();
    store.updateDeploy(record.id, { status: "failed", failedStage: "switch", finishedAt: record.finishedAt, stages: record.stages });
    return fail(`回滚失败（软链可能未切换，线上维持 ${current || "未知"}）：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

/* ================= 健康检查 / 远程执行 / 日志 / 清理 ================= */

async function toolHealthCheck(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.healthCheck?.url) {
    return fail(`环境 ${envObj.name} 未配置 healthCheck.url。用 wudi_project_init 补顶层或 wudi_env_set 补该环境后重试。`);
  }
  const results = await checkHealthWithRetry(envObj);
  const last = results.at(-1);
  const lines = [`健康检查（${envObj.name}）：${last.ok ? "通过 ✓" : "未通过 ✗"}`, formatHealth(results)];
  if (!last.ok) {
    lines.push(
      "",
      "排查建议（wudi_remote_exec 执行白名单内命令，或 wudi_deploy_logs 拉服务日志）：",
      "1) 进程：docker ps -a / systemctl status；2) 日志：docker logs --tail 100 / journalctl -n 100；",
      "3) 端口：ss -tlnp；4) 反代：tail -50 /var/log/nginx/error.log + nginx -t；5) 磁盘内存：df -h、free -m。"
    );
  }
  return last.ok ? ok(lines.join("\n"), { health: results }) : fail(lines.join("\n"));
}

async function toolRemoteExec(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const command = String(args.command ?? "").trim();
  if (!command) return fail("缺少 command。");
  if (args.confirm !== true) return fail("远端执行需 confirm=true。请先向用户复述将要执行的命令并征得同意。");
  const whitelist = project.remoteWhitelist ?? [];
  if (!whitelist.length) {
    return fail("档案 remoteWhitelist 为空，远端执行被拒绝。请先在档案中加白名单前缀（如 docker compose,df -h,journalctl），再重试。");
  }
  const hit = whitelist.find((prefix) => command.startsWith(prefix));
  if (!hit) {
    return fail(`命令不在白名单内（前缀匹配）。白名单：\n- ${whitelist.join("\n- ")}\n如需执行，先更新档案 remoteWhitelist。`);
  }
  const timeoutMs = Math.min(Math.max(Number(args.timeoutSec) || 60, 5), 600) * 1000;
  const { stdout, stderr } = await sshRun(command, { timeoutMs, overrides: envObj.ssh });
  const out = clip(stdout, 3000);
  return ok(
    [
      `已在 ${envObj.name}（${sshConfig(envObj.ssh).host}）执行（白名单命中：${hit}）：`,
      `$ ${command}`,
      out ? `\n${out}` : "(无标准输出)",
      stderr ? `\n[stderr] ${clip(stderr, 800)}` : "",
    ].filter(Boolean).join("\n"),
    { stdout: out, stderr: clip(stderr, 800) }
  );
}

async function toolDoctor(args: any = {}) {
  const project = store.loadProject();
  const checks = [];
  const add = (name, status, detail) => checks.push({ name, status, detail: String(detail).slice(0, 400) });

  if (!project) {
    add("项目档案", "fail", ".wudi/project.json 不存在，先 wudi_project_init。");
    return failReport(checks);
  }
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    add("环境解析", "fail", String(err?.message ?? err));
    return failReport(checks);
  }

  // 1. 档案关键字段
  const missing = [];
  if (!project.build) missing.push("build");
  if (!envObj.deployRoot) missing.push("deployRoot");
  if (!envObj.healthCheck.url) missing.push("healthCheck.url");
  add("档案关键字段", missing.length ? "warn" : "pass", missing.length ? `缺：${missing.join("、")}（部署前要补全）` : "build/打包/部署目标/健康检查齐全");

  // 2. SSH 连通
  try {
    const ping = await sshPing(envObj.ssh);
    add("SSH 连通", ping.ok ? "pass" : "fail", `${envObj.ssh.host || sshConfig(envObj.ssh).host}:${envObj.ssh.port || "22"} 延迟 ${ping.latencyMs}ms`);
  } catch (err) {
    add("SSH 连通", "fail", String(err?.message ?? err).slice(0, 300));
  }

  // 3~5. 远端检查（连通才做）
  let remoteReachable = checks.find((c) => c.name === "SSH 连通")?.status === "pass";
  if (remoteReachable) {
    try {
      const { stdout } = await sshRun(`df -Pm ${q(envObj.deployRoot)} 2>/dev/null | tail -1 | awk '{print $5}'`, { timeoutMs: 30_000, overrides: envObj.ssh });
      const usage = parseInt(String(stdout).trim(), 10);
      if (Number.isNaN(usage)) add("磁盘空间", "warn", "无法读取（检查 deployRoot 是否已创建）");
      else add("磁盘空间", usage >= 95 ? "fail" : usage >= 80 ? "warn" : "pass", `${envObj.deployRoot} 所在分区使用 ${usage}%`);
    } catch (err) {
      add("磁盘空间", "warn", String(err?.message ?? err).slice(0, 200));
    }
    try {
      const { stdout } = await sshRun(`awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo`, { timeoutMs: 30_000, overrides: envObj.ssh });
      const availMB = parseInt(String(stdout).trim(), 10);
      if (Number.isNaN(availMB)) add("内存", "warn", "无法读取 MemAvailable");
      else add("内存", availMB < 200 ? "warn" : "pass", `可用 ${availMB} MB`);
    } catch (err) {
      add("内存", "warn", String(err?.message ?? err).slice(0, 200));
    }
    try {
      const { stdout: lsOut } = await sshRun(`ls -1 ${q(join(envObj.deployRoot, "releases"))} 2>/dev/null`, { timeoutMs: 30_000, overrides: envObj.ssh });
      const releases = parseRemoteReleases(lsOut);
      if (!releases.length) add("版本目录", "warn", "releases 为空（尚未部署过）");
      else add("版本目录", releases.length > 10 ? "warn" : "pass", `${releases.length} 个版本${releases.length > 10 ? "（建议 pruneOld 清理）" : ""}`);
      if (project.package.type !== "docker-image" && releases.length) {
        const current = await readCurrentRelease(envObj);
        const { stdout: exists } = await sshRun(`test -e ${q(join(envObj.deployRoot, "current"))} && echo yes || echo no`, { overrides: envObj.ssh });
        add("current 软链", current && String(exists).includes("yes") ? "pass" : "warn", current ? `指向 ${current}，目标存在` : "未设置或目标不存在");
      }
    } catch (err) {
      add("版本目录/软链", "warn", String(err?.message ?? err).slice(0, 200));
    }
  } else {
    add("远端检查", "warn", "SSH 不通，跳过磁盘/内存/版本检查");
  }

  // 6. 健康快测（单次）
  try {
    const r = await checkHealthOnce(envObj);
    if (r.skipped) add("健康检查", "warn", r.reason);
    else add("健康检查", r.ok ? "pass" : "fail", `${r.via} 侧 HTTP ${r.status}（期望 ${r.expect}）`);
  } catch (err) {
    add("健康检查", "fail", String(err?.message ?? err).slice(0, 300));
  }

  // 7. 通知配置（信息项）
  const notifyCfg = resolveNotify(project, envObj);
  add("部署通知", notifyCfg ? "pass" : "warn", notifyCfg ? `${notifyCfg.format} webhook 已配置` : "未配置 notifyWebhook（部署结果不会推送到群）");

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const verdict = failCount ? "FAIL" : warnCount ? "WARN" : "PASS";
  const lines = [
    `═══ 无敌编程体检（${envObj.name}）═══`,
    ...checks.map((c) => `- [${c.status.toUpperCase()}] ${c.name}：${c.detail}`),
    "",
    `结论：${verdict}${failCount ? `（${failCount} 项失败）` : warnCount ? `（${warnCount} 项警告）` : "（全部通过）"}`,
  ];
  return verdict === "FAIL" ? fail(lines.join("\n")) : ok(lines.join("\n"), { checks, verdict });
}

/** 体检报告的 FAIL 出口。 */
function failReport(checks) {
  const lines = ["═══ 无敌编程体检 ═══", ...checks.map((c) => `- [${c.status.toUpperCase()}] ${c.name}：${c.detail}`), "", "结论：FAIL"];
  return fail(lines.join("\n"));
}

async function toolDeployLogs(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!envObj.logCommand) {
    return fail(
      [
        `环境 ${envObj.name} 未配置 logCommand。设置方法（二选一）：`,
        "- wudi_env_set 传 logCommand，如：docker compose logs --tail 200 或 journalctl -u <服务> -n 200 --no-pager",
        "- wudi_project_init 补顶层 logCommand（环境未设置时回落顶层）",
      ].join("\n")
    );
  }
  try {
    const { stdout, stderr } = await sshRun(envObj.logCommand, { timeoutMs: 60_000, overrides: envObj.ssh });
    const out = clip(stdout, 4000);
    return ok(
      [`${envObj.name} 服务日志（${envObj.logCommand}）：`, out || "(无输出)", stderr ? `\n[stderr] ${clip(stderr, 500)}` : ""].filter(Boolean).join("\n"),
      { stdout: out }
    );
  } catch (err) {
    return fail(`日志拉取失败：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

/* ================= Figma（可选能力） ================= */

async function toolFigmaFetch(args: any = {}) {
  if (!figmaToken()) {
    return ok(
      [
        "Figma 接入未启用：插件设置里还没有配置 figmaToken。",
        "启用步骤：",
        "1. Figma → Settings → Security → Personal access tokens → 生成（只读权限即可）",
        "2. 把 token 填到 AOPC 插件设置中 wudi-coding 的「Figma Personal Access Token」",
        "3. 重开会话使 MCP server 重新加载，即可用本工具拉取设计稿结构与样式。",
        "未配置不影响其他功能，UI 设计可走本地生成路线（wudi-ui 技能）。",
      ].join("\n")
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  try {
    const data = await fetchFigmaStructure({
      fileKey: ref.fileKey,
      nodeId: ref.nodeId,
      maxDepth: Math.min(Math.max(Number(args.maxDepth) || 6, 1), 10),
      budgetMax: Math.min(Math.max(Number(args.budgetMax) || 400, 50), 2000),
    });
    const summary = [
      `Figma 文件：${data.name}（key ${data.fileKey}${ref.nodeId ? `，节点 ${ref.nodeId}` : ""}，最后修改 ${data.lastModified ?? "?"}）`,
      ref.nodeId ? "节点结构（提炼：尺寸/颜色/字号/文本/flex）：\n" + j(data.tree) : "页面概览（用 node-id 链接可拉取具体画板）：\n" + j(data.pages?.map((p) => ({ name: p.name, id: p.id }))),
    ].join("\n");
    return ok(summary.slice(0, 40_000), { figma: data });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN 环境变量缺失：检查插件清单 userConfig 映射。");
    return fail(`Figma 拉取失败：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

/* ================= 设计产物 ================= */

function toolDesignTokensGet() {
  const tokens = store.loadTokens();
  if (!tokens) {
    return ok(
      [
        "还没有 design tokens（.wudi/design/tokens.json）。",
        "建立方式：/wudi-ui 设计定稿后自动沉淀，或直接调用 wudi_design_tokens_set 传入对象：",
        j({
          color: { primary: "#3b6ef6", text: "#1a1d21", bg: "#ffffff" },
          spacing: { sm: "8px", md: "16px", lg: "24px" },
          radius: { md: "8px" },
          typography: { "font-size-base": "14px" },
        }),
        "写入时会同步生成 tokens.css（CSS 变量 --分组-键名）。",
      ].join("\n")
    );
  }
  return ok(`design tokens（.wudi/design/tokens.json）：\n${j(tokens)}`, { tokens });
}

function toolDesignTokensSet(args) {
  let tokens = args.tokens;
  if (!tokens && args.json !== undefined) {
    try {
      tokens = JSON.parse(String(args.json));
    } catch (err) {
      return fail(`json 参数不是合法 JSON：${String(err?.message ?? err).slice(0, 200)}`);
    }
  }
  try {
    const files = store.saveTokens(tokens);
    return ok(
      [
        "tokens 已写入并生成 CSS 变量文件：",
        `- ${files.json}`,
        `- ${files.css}`,
        "后续设计稿与组件代码请引用这些变量，不再出现魔法值。",
      ].join("\n"),
      { files }
    );
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
}

function toolDesignList() {
  const dir = store.designDir();
  if (!existsSync(dir)) {
    return ok("还没有设计产物（.wudi/design/ 不存在）。执行 /wudi-ui 生成设计稿后会落盘到这里。", { files: [] });
  }
  const files = [];
  const walk = (d, prefix = "") => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else {
        const st = statSync(full);
        files.push({
          path: `.wudi/design/${prefix}${entry.name}`,
          sizeKB: Number((st.size / 1024).toFixed(1)),
          updatedAt: st.mtime.toISOString(),
        });
      }
    }
  };
  walk(dir);
  files.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const lines = files.length
    ? files.map((f) => `- ${f.path}（${f.sizeKB} KB，${f.updatedAt.slice(0, 16).replace("T", " ")}）`).join("\n")
    : "（目录为空）";
  return ok(`设计产物（.wudi/design/，新→旧）：\n${lines}`, { files });
}

/* ================= 项目注册表（跨项目管理） ================= */

/** 自动把当前工作区登记进注册表（幂等），再返回全部项目概览。 */
function toolProjectsList() {
  const root = store.projectRoot();
  try {
    // 当前项目自动纳入注册表并确保有 .wudi 档案（取消「未建档」）
    store.ensureProfileAt(root);
    // 用户显式移除过当前项目 → 尊重移除意图，不再自动加回（重新登记可恢复）
    if (!store.isProjectRootHidden(root)) {
      const exists = store.loadRegistry().some((e) => resolve(e.path) === resolve(root));
      if (!exists) store.registryAdd(root, store.loadProject()?.name || "");
    }
  } catch { /* 注册失败不阻塞列表 */ }
  const projects = store.registrySummaries(root);
  const lines = projects
    .map((p) => {
      const last = p.lastDeploy
        ? `${p.lastDeploy.type === "rollback" ? "回滚" : "部署"}@${p.lastDeploy.env ?? "default"} ${p.lastDeploy.release}（${p.lastDeploy.status}）`
        : "无部署";
      return `- ${p.isCurrent ? "★当前 " : ""}${p.name}｜${p.path}\n  技术栈 ${p.techStack || "?"}｜环境 ${(p.envNames || ["—"]).join("、")}｜${last}｜文档 ${p.docsCount}｜设计产物 ${p.designCount}`;
    })
    .join("\n");
  return ok(`═══ 项目注册表（${projects.length}）═══\n${lines || "（空）"}`, { projects });
}

/** 工具调用的项目根：显式 root 参数优先（多项目内容页），否则当前工作区。 */
function toolRoot(args: any = {}) {
  const raw = String(args?.root ?? "").trim();
  if (!raw) return store.projectRoot();
  const abs = resolve(raw);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new Error(`项目根不存在：${raw}`);
  return abs;
}

/** 当前项目根（工作区）—— 项目登记与目录浏览的唯一允许范围。 */
function currentProjectRoot() {
  return resolve(store.projectRoot());
}

/** 路径是否在当前项目根内（含根本身）。 */
function withinProjectRoot(p) {
  const root = currentProjectRoot();
  const abs = resolve(String(p ?? ""));
  return abs === root || abs.startsWith(root + "/");
}

function toolFsListDirs(args: any = {}) {
  const root = currentProjectRoot();
  const target = args?.path ? resolve(String(args.path)) : root;
  if (target !== root && !target.startsWith(root + "/")) {
    return fail(`只能浏览当前项目（${root}）及其子文件夹内的路径。`);
  }
  if (!existsSync(target) || !statSync(target).isDirectory()) return fail(`目录不存在：${target}`);
  let dirs = [];
  try {
    dirs = readdirSync(target, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ name: d.name, path: join(target, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err: any) {
    return fail(`读取目录失败：${String(err?.message ?? err)}`);
  }
  const parent = target !== root ? resolve(target, "..") : "";
  return ok(
    `目录：${target}\n子文件夹（${dirs.length}）：${dirs.map((d) => d.name).join("、") || "（无）"}`,
    { root, path: target, parent, dirs }
  );
}

function toolProjectsRename(args: any = {}) {
  const id = String(args?.id ?? "").trim();
  const name = String(args?.name ?? "").trim();
  if (!id || !name) return fail("缺少参数：id（项目 id）与 name（新显示名）。");
  let entry;
  try {
    entry = store.registryRename(id, name);
  } catch (err: any) {
    return fail(String(err?.message ?? err));
  }
  if (!entry) return fail(`注册表中找不到 ${id}（用 wudi_projects_list 查 id）。`);
  return ok(`已重命名项目：${entry.name}（${entry.path}）`, { project: entry });
}

function toolProjectsAdd(args) {
  const path = String(args.path ?? "").trim();
  if (!path) return fail("缺少 path：要登记的项目根目录绝对路径。");
  if (!existsSync(path)) return fail(`目录不存在：${path}`);
  if (!statSync(path).isDirectory()) return fail(`不是目录：${path}`);
  if (!withinProjectRoot(path)) {
    return fail(`只能登记当前项目（${currentProjectRoot()}）本身或其子文件夹；${path} 不在范围内。`);
  }
  let res;
  try {
    res = store.registryAdd(path, args.name ? String(args.name) : "");
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  /* 重新登记 → 取消此前的隐藏意图；登记即为项目建档 */
  store.unhideProjectRoot(res.entry.path);
  try { store.migrateDesignsFor(res.entry.path); } catch { /* 迁移失败不阻塞 */ }
  try {
    store.ensureProfileAt(res.entry.path, res.entry.name);
  } catch (err: any) {
    return fail(`已登记但创建 .wudi 失败：${String(err?.message ?? err)}`);
  }
  const s = store.registrySummaries(store.projectRoot()).find((x) => x.id === res.entry.id);
  return ok(
    `${res.added ? "已登记项目" : "项目已在注册表"}：${res.entry.name}（${res.entry.path}），已初始化 .wudi/project.json`,
    { project: s }
  );
}

function toolProjectsRemove(args) {
  const id = String(args.id ?? "").trim();
  const removed = store.registryRemove(id);
  if (!removed) return fail(`注册表中找不到 ${id}（用 wudi_projects_list 查 id）。`);
  // 当前工作区项目：记住移除意图，避免 projects_list 每次自动加回
  if (resolve(removed.path) === resolve(store.projectRoot())) {
    store.hideProjectRoot(removed.path);
    return ok(
      `已从工作台移除当前项目：${removed.name}（${removed.path}）。项目文件与 .wudi 未删除；重新「登记项目」指向该目录即可恢复。`,
      { removed, hiddenCurrent: true }
    );
  }
  return ok(`已从注册表移除：${removed.name}（${removed.path}）。项目文件本身未删除。`, { removed });
}

/* ================= 设计画布（Agent 可操作） ================= */

function toolCanvasBridge() {
  if (!bridgePort) return fail("协同桥尚未就绪，稍后重试。");
  return ok(`实时协同桥：http://127.0.0.1:${bridgePort}/bridge（SSE，画布变更推送）`, { url: `http://127.0.0.1:${bridgePort}/bridge` });
}

function toolCanvasGet() {
  const canvas = store.loadCanvas();
  return ok(`设计画布（${canvas.shapes.length} 个形状）：\n${j(canvas)}`, { canvas });
}

function toolCanvasEdit(args: any = {}) {
  const ops = args.ops;
  if (!Array.isArray(ops) || !ops.length) return fail("缺少 ops 数组（add/update/delete/add_frame/update_frame/delete_frame 批量操作）。");
  const canvas = store.loadCanvas();
  const validFrames = new Set(canvas.frames.map((f) => f.id));
  const summary = [];
  for (const [i, op] of ops.entries()) {
    try {
      if (op?.op === "add") {
        const shape = store.sanitizeShape(op.shape, i, validFrames);
        if (canvas.shapes.length >= 1000) throw new Error("画布已达 1000 形状上限，先删除再添加。");
        canvas.shapes.push(shape);
        summary.push(`+ ${shape.type} ${shape.id} @(${shape.x},${shape.y})${shape.frameId ? ` in ${shape.frameId}` : ""}`);
      } else if (op?.op === "update") {
        const idx = canvas.shapes.findIndex((s) => s.id === op.id);
        if (idx < 0) throw new Error(`找不到形状 ${op.id}`);
        const merged = { ...canvas.shapes[idx], ...(op.patch ?? {}) };
        canvas.shapes[idx] = store.sanitizeShape(merged, i, validFrames);
        summary.push(`~ ${op.id}`);
      } else if (op?.op === "delete") {
        const ids = new Set(Array.isArray(op.ids) ? op.ids : [op.id].filter(Boolean));
        const before = canvas.shapes.length;
        canvas.shapes = canvas.shapes.filter((s) => !ids.has(s.id));
        summary.push(`- ${before - canvas.shapes.length} 个形状`);
      } else if (op?.op === "add_frame") {
        if (canvas.frames.length >= 50) throw new Error("画板数已达 50 上限。");
        const frame = store.sanitizeFrame(op.frame, canvas.frames.length);
        canvas.frames.push(frame);
        summary.push(`+ 画板 ${frame.name} ${frame.id} @(${frame.x},${frame.y}) ${frame.w}x${frame.h}`);
      } else if (op?.op === "update_frame") {
        const idx = canvas.frames.findIndex((f) => f.id === op.id);
        if (idx < 0) throw new Error(`找不到画板 ${op.id}`);
        canvas.frames[idx] = store.sanitizeFrame({ ...canvas.frames[idx], ...(op.patch ?? {}) }, idx);
        summary.push(`~ 画板 ${op.id}`);
      } else if (op?.op === "delete_frame") {
        const frame = store.deleteFrame(canvas, String(op.id ?? ""), op.withShapes === true);
        summary.push(`- 画板 ${frame.name}${op.withShapes ? "（含形状）" : "（形状转游离）"}`);
      } else if (op?.op === "reorder") {
        const idx = canvas.shapes.findIndex((s) => s.id === op.id);
        if (idx < 0) throw new Error(`找不到形状 ${op.id}`);
        const [sh] = canvas.shapes.splice(idx, 1);
        if (op.to === "front") canvas.shapes.push(sh);
        else canvas.shapes.unshift(sh);
        summary.push(`⇅ ${op.id} ${op.to === "front" ? "置顶" : "置底"}`);
      } else if (op?.op === "replace") {
        // 全量替换（撤销/重做数据基础）：frames/shapes 整体过校验后替换
        const frames = (op.canvas?.frames ?? []).map((f, fi) => store.sanitizeFrame(f, fi));
        const valid = new Set(frames.map((f) => f.id));
        const shapes = (op.canvas?.shapes ?? []).map((sh, si) => store.sanitizeShape(sh, si, valid));
        canvas.frames = frames;
        canvas.shapes = shapes;
        summary.push(`↺ 全量替换（${frames.length} 画板 / ${shapes.length} 形状）`);
      } else {
        throw new Error(`ops[${i}] 的 op 非法：${op?.op}`);
      }
    } catch (err) {
      return fail(`ops[${i}] 失败：${String(err?.message ?? err)}`);
    }
  }
  store.saveCanvas(canvas);
  broadcastCanvasChanged();
  return ok(`画布已更新（${canvas.frames.length} 画板 / ${canvas.shapes.length} 形状）：\n${summary.map((s) => `- ${s}`).join("\n")}`, { canvas });
}

function toolCanvasClear(args: any = {}) {
  if (args.confirm !== true) return fail("清空画布需 confirm=true。建议先 wudi_canvas_get 展示现状征得用户同意。");
  const canvas = store.loadCanvas();
  const n = canvas.shapes.length;
  const fn = canvas.frames.length;
  store.saveCanvas({ frames: [], shapes: [] });
  broadcastCanvasChanged();
  return ok(`画布已清空（移除 ${fn} 画板 / ${n} 形状）。`, { canvas: { frames: [], shapes: [] } });
}

function toolCanvasExport(args: any = {}) {
  const name = String(args.name ?? "").trim();
  if (!name) return fail("缺少 name（设计稿文件名，如 app-wireframe-v1）。");
  const canvas = store.loadCanvas();
  if (!canvas.shapes.length && !canvas.frames.length) return fail("画布是空的，先 wudi_canvas_edit 添加画板与形状再导出。");
  const format = ["html", "excalidraw", "both"].includes(String(args.format)) ? String(args.format) : "html";
  const lines = [];
  const out = {};
  if (format === "html" || format === "both") {
    const outputs = store.exportCanvasToMockups(canvas, name);
    for (const o of outputs) {
      store.registerDoc({ path: o.relPath, type: "doc", title: `画布导出：${o.frame}`, source: "canvas export" });
      lines.push(`- 画板「${o.frame}」→ ${o.relPath}（${o.shapes} 形状，已进图库）`);
    }
    out.mockups = outputs;
  }
  if (format === "excalidraw" || format === "both") {
    const ex = store.exportCanvasToExcalidraw(canvas, name);
    out.excalidraw = ex.relPath;
    lines.push(`- Excalidraw 场景：${ex.relPath}（${ex.elements} 元素，画板映射为 frame）`);
    lines.push("  继续编辑：让 Agent 调官方 Excalidraw 插件的 open_diagram 导入该文件，在完整级无限画布中拖拽/连线/改样式。");
  }
  return ok(
    [`画布已导出（${format}，${canvas.frames.length} 画板）：`, ...lines, "", "下一步：HTML 版按 wudi-ui 流程接 tokens 精修；excalidraw 版在完整级无限画布自由编辑。"].join("\n"),
    out
  );
}

/* ================= 周报 / Figma 渲染 ================= */

function isoWeek(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

async function toolDocsWeekly(args: any = {}) {
  const days = Math.min(Math.max(Number(args.days) || 7, 1), 90);
  const author = String(args.author ?? "").trim();
  let out;
  try {
    const r = await localRun(
      `git log --since=${q(`${days} days ago`)} --pretty=format:${q("%h|%ad|%an|%s")} --date=short${author ? ` --author ${q(author)}` : ""}`,
      { cwd: store.projectRoot(), timeoutMs: 30_000 }
    );
    out = r.stdout.trim();
  } catch (err) {
    return fail(`git log 失败（项目根不是 git 仓库？）：${String(err?.message ?? err).slice(0, 300)}`);
  }
  if (!out) return ok(`最近 ${days} 天${author ? `（作者 ${author}）` : ""}没有 commit，周报无可写内容。`);

  const byDate = new Map();
  const authors = new Set();
  let total = 0;
  for (const line of out.split("\n")) {
    const [hash = "", date = "", who = "", ...rest] = line.split("|");
    const subject = rest.join("|").trim();
    if (!hash || !date || !subject) continue;
    total++;
    authors.add(who);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ hash: hash.slice(0, 7), who, subject });
  }

  const { year, week } = isoWeek();
  const relPath = `docs/weekly/${year}-W${String(week).padStart(2, "0")}.md`;
  const absPath = join(store.projectRoot(), relPath);
  const dates = [...byDate.keys()].sort();
  const md = [
    `# 周报 ${year}-W${String(week).padStart(2, "0")}`,
    "",
    `> 自动生成自 git log（近 ${days} 天${author ? `，作者 ${author}` : ""}，截至 ${dates.at(-1)}）。commit 原文偏技术视角，提交前请把「本周完成」改写成用户价值语言。`,
    "",
    "## 概览",
    `- 提交数：${total}（活跃 ${byDate.size} 天）`,
    `- 作者：${[...authors].join("、") || "?"}`,
    "",
    "## 逐日进展",
    ...dates.flatMap((d) => [
      `### ${d}（${byDate.get(d).length} 条）`,
      ...byDate.get(d).map((c) => `- \`${c.hash}\` ${c.subject}（${c.who}）`),
      "",
    ]),
    "## 本周完成（人工补充：从上面提炼成用户价值语言）",
    "- [ ] ",
    "",
    "## 下周计划（人工补充）",
    "- [ ] ",
    "",
  ].join("\n");

  try {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(join(store.projectRoot(), "docs", "weekly"), { recursive: true });
    writeFileSync(absPath, md, "utf-8");
  } catch (err) {
    return fail(`周报写入失败：${String(err?.message ?? err).slice(0, 300)}`);
  }
  store.registerDoc({ path: relPath, type: "weekly", title: `周报 ${year}-W${String(week).padStart(2, "0")}`, source: `git log ${days}d` });
  return ok(
    [
      `周报草稿已生成：${relPath}（已登记文档库）`,
      `- 提交 ${total} 条，活跃 ${byDate.size} 天，作者 ${[...authors].join("、") || "?"}`,
      `- 日期范围：${dates[0]} ~ ${dates.at(-1)}`,
      "下一步：人工把「本周完成」改写成用户价值语言后即可发出（可用 /wudi-docs export 转交付格式）。",
    ].join("\n"),
    { path: relPath, total, activeDays: byDate.size }
  );
}

async function toolFigmaImages(args: any = {}) {
  if (!figmaToken()) {
    return ok(
      [
        "Figma 接入未启用：插件设置里还没有配置 figmaToken（同 wudi_figma_fetch 的启用步骤）。",
        "配置后本工具把节点渲染成 PNG 下载到 .wudi/design/figma/，供与实现截图做视觉比对。",
      ].join("\n")
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const nodeIds = String(args.nodeIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace("-", ":"));
  if (!nodeIds.length) return fail("缺少 nodeIds：从 wudi_figma_fetch 返回的结构里取节点 id，逗号分隔（如 12:34,12:35）。");
  const scale = Math.min(Math.max(Number(args.scale) || 2, 0.01), 4);
  try {
    const images = await fetchFigmaImages({ fileKey: ref.fileKey, nodeIds, scale });
    const outDir = join(store.wudiDir(), "design", "figma");
    const { mkdirSync, writeFileSync } = await import("node:fs");
    mkdirSync(outDir, { recursive: true });
    const saved = [];
    const failedNodes = [];
    for (const [nodeId, url] of Object.entries(images)) {
      if (!url) {
        failedNodes.push(nodeId);
        continue;
      }
      const fname = `${ref.fileKey}-${nodeId.replace(/[^0-9:]/g, "_")}-x${scale}.png`.replaceAll(":", "-");
      const buf = Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
      const abs = join(outDir, fname);
      writeFileSync(abs, buf);
      saved.push({ nodeId, path: `.wudi/design/figma/${fname}`, sizeKB: Number((buf.length / 1024).toFixed(1)) });
    }
    const lines = [
      `已下载 ${saved.length} 张设计稿 PNG（scale ${scale}）：`,
      ...saved.map((s) => `- ${s.nodeId} → ${s.path}（${s.sizeKB} KB）`),
      failedNodes.length ? `渲染失败节点：${failedNodes.join("、")}` : "",
      "",
      "用法：与实现页截图并排对比（视觉比对），或交给 Agent 读取图片自查。",
    ].filter(Boolean);
    return ok(lines.join("\n"), { images: saved, failedNodes });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN 环境变量缺失：检查插件清单 userConfig 映射。");
    return fail(`Figma 渲染拉取失败：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

function toolDesignTokensExport(args: any = {}) {
  const tokens = store.loadTokens();
  if (!tokens) return fail("还没有 design tokens。先 /wudi-ui 沉淀或 wudi_design_tokens_set 写入，再导出。");
  const format = ["css", "tailwind", "json"].includes(String(args.format)) ? String(args.format) : "css";
  let content = "";
  let fname = "";
  if (format === "json") {
    content = j(tokens);
    fname = "tokens.json";
  } else if (format === "tailwind") {
    // tailwind.config.js 的 theme.extend 片段：颜色转 rgb 值（tailwind 期望无 # 的值也接受，直接给原值更直观）
    const camel = (s) => String(s).replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    const toJs = (obj, indent = "  ") => {
      const lines = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (v && typeof v === "object" && !Array.isArray(v)) lines.push(`${indent}${camel(k)}: {`);
        const sub = v && typeof v === "object" && !Array.isArray(v) ? toJs(v, indent + "  ") : null;
        if (sub) { lines.push(sub); lines.push(`${indent}},`); }
        else lines.push(`${indent}${camel(k)}: ${JSON.stringify(String(v))},`);
      }
      return lines.join("\n");
    };
    content = [
      "// 由 wudi-coding 设计 tokens 导出；合并进 tailwind.config.js 的 theme.extend",
      "// 用法：theme: { extend: { colors: {...}, spacing: {...}, borderRadius: {...}, fontSize: {...} } }",
      `{`,
      `  colors: {`,
      toJs(tokens.color ?? {}),
      `  },`,
      `  spacing: {`,
      toJs(tokens.spacing ?? {}),
      `  },`,
      `  borderRadius: {`,
      toJs(tokens.radius ?? {}),
      `  },`,
      `  fontSize: {`,
      toJs(tokens.typography ?? {}),
      `  },`,
      `}`,
    ].join("\n");
    fname = "tailwind.theme.js";
  } else {
    try {
      content = readFileSync(join(store.designDir(), "tokens.css"), "utf-8");
    } catch {
      content = "";
    }
    if (!content) return fail("tokens.css 不存在（tokens 可能是旧版写入），重跑一次 wudi_design_tokens_set 生成后再导出。");
    fname = "tokens.css";
  }
  const exportsDir = join(store.designDir(), "exports");
  mkdirSync(exportsDir, { recursive: true });
  const outPath = join(exportsDir, fname);
  writeFileSync(outPath, content, "utf-8");
  return ok(
    [`tokens 已导出（${format}）：`, `- ${outPath}`, "", "```", clip(content, 1200), "```", "转组件代码时引用该文件，不再出现魔法值。"].join("\n"),
    { format, path: `.wudi/design/exports/${fname}`, content }
  );
}

async function toolNotifyTest(args: any = {}) {
  const project = store.loadProject();
  if (!project) return fail("项目档案缺失，先 wudi_project_init。");
  let envObj;
  try {
    envObj = store.resolveEnv(project, args.env ? String(args.env) : undefined);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  const cfg = resolveNotify(project, envObj);
  if (!cfg) {
    return fail(
      [
        `环境 ${envObj.name} 未配置通知 webhook。设置方法：`,
        "- wudi_project_init 传 notifyWebhook（如飞书群机器人地址）+ notifyFormat（feishu/wecom/generic）",
        "- 或 wudi_env_set 给单个环境配置 notifyWebhook（如只给 prod 发通知）",
        "配置后重跑本工具验证连通性。",
      ].join("\n")
    );
  }
  const res = await sendNotify(cfg, {
    project: project.name, env: envObj.name, type: "notify-test", status: "ok",
    release: "test-" + store.releaseStamp(), detail: "这是一条 wudi-coding 测试通知，收到即配置成功。",
  });
  return res.ok
    ? ok(`测试通知已发送（${cfg.format} 格式 → ${cfg.webhook}）：${res.detail}。请到群里确认收到。`, { notify: res })
    : fail(`测试通知失败：${res.detail}（检查 webhook 地址与网络连通性）`);
}

function flattenTokens(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenTokens(v, path, out);
    else if (v !== null && v !== undefined) out[path] = String(v);
  }
  return out;
}

function toolTokensCompare(args: any = {}) {
  let incoming = args.tokens;
  if (!incoming && args.json !== undefined) {
    try {
      incoming = JSON.parse(String(args.json));
    } catch (err) {
      return fail(`json 参数不是合法 JSON：${String(err?.message ?? err).slice(0, 200)}`);
    }
  }
  if (!incoming || typeof incoming !== "object") return fail("缺少 tokens 对象（或 json 字符串）。");
  const local = store.loadTokens();
  if (!local) return fail("本地还没有 design tokens，先 wudi_design_tokens_set 建立基准再比对。");
  const flatIn = flattenTokens(incoming);
  const flatLocal = flattenTokens(local);
  const added = Object.keys(flatIn).filter((k) => !(k in flatLocal)).map((k) => ({ key: k, value: flatIn[k] }));
  const changed = Object.keys(flatIn).filter((k) => k in flatLocal && flatLocal[k] !== flatIn[k]).map((k) => ({ key: k, local: flatLocal[k], incoming: flatIn[k] }));
  const removed = Object.keys(flatLocal).filter((k) => !(k in flatIn)).map((k) => ({ key: k, value: flatLocal[k] }));
  const same = Object.keys(flatIn).length - added.length - changed.length;
  const lines = [
    `═══ tokens 比对（外部 vs 本地）═══`,
    `外部 ${Object.keys(flatIn).length} 键 / 本地 ${Object.keys(flatLocal).length} 键｜一致 ${same}`,
    "",
    `【新增】外部有本地无（${added.length}）：`,
    ...(added.slice(0, 20).map((a) => `- ${a.key} = ${a.value}`)),
    added.length > 20 ? `  …共 ${added.length} 条` : "",
    "",
    `【变更】同键不同值（${changed.length}）：`,
    ...(changed.slice(0, 20).map((c) => `- ${c.key}: ${c.local} → ${c.incoming}`)),
    changed.length > 20 ? `  …共 ${changed.length} 条` : "",
    "",
    `【移除】本地有外部无（${removed.length}）：`,
    ...(removed.slice(0, 20).map((r) => `- ${r.key} = ${r.value}`)),
    removed.length > 20 ? `  …共 ${removed.length} 条` : "",
    "",
    "处置：确认后把合并结果用 wudi_design_tokens_set 整体写入（写前可让用户过目本报告）。",
  ].filter(Boolean);
  return ok(lines.join("\n").slice(0, 30_000), { added, changed, removed, same });
}

/** 校验并解析 designs/ 目录内的设计稿路径（防路径穿越，仅 .fig/.pen）。 */
/** 设计稿文件名是否合法：允许中文等 Unicode 字符；拒绝路径穿越、分隔符与控制字符。 */
function validDesignName(name) {
  const base = String(name ?? "").trim();
  if (!base) return false;
  if (/[/\\]/.test(base)) return false;
  if (base.includes("..")) return false;
  if (/^[\x00-\x1f]/.test(base) || /[\x00-\x1f]/.test(base)) return false;
  if (!/\.(fig|pen)$/i.test(base)) return false;
  return base.replace(/\.(fig|pen)$/i, "").trim().length > 0;
}

function resolveDesignFile(p: string, root?: string) {
  const projRoot = resolve(root || store.projectRoot());
  const base = store.projectBaseName(projRoot);
  const dir = store.designsDirFor(projRoot);
  // 兼容前缀：.wudi/<项目>/designs/（集中式）、.wudi/designs/（v0.38.0）、designs/（旧）
  const clean = String(p ?? "").trim()
    .replace(/^\.wudi\/[^/]+\/designs\//i, "")
    .replace(/^\.wudi\/designs\//i, "")
    .replace(/^designs\//i, "");
  if (!validDesignName(clean)) throw new Error(`非法设计稿名：${p}（仅允许 designs/<名称>.fig/.pen，支持中文）`);
  const file = resolve(dir, clean);
  if (!file.startsWith(dir + "/")) throw new Error(`非法设计稿路径：${p}`);
  return { dir, file, base: clean };
}

async function toolDesignDelete(args: any = {}) {
  const path = String(args?.path ?? "").trim();
  if (!path) return fail("缺少 path：要删除的设计稿路径，如 designs/old.fig。");
  let file: string;
  try {
    file = resolveDesignFile(path, toolRoot(args)).file;
  } catch (err: any) {
    return fail(String(err?.message ?? err));
  }
  if (!(await waitForDesignFile(file, 1500))) return fail(`设计稿不存在：${path}`);
  rmSync(file);
  return ok(`已删除设计稿：${path}`);
}

/** openPencil 建稿落盘是异步的：等文件真正写出（最多 3s）。 */
async function waitForDesignFile(file: string, ms = 3000) {
  const deadline = Date.now() + ms;
  while (!existsSync(file) && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 120));
  }
  return existsSync(file);
}

async function toolDesignRename(args: any = {}) {
  const path = String(args?.path ?? "").trim();
  const name = String(args?.name ?? "").trim();
  if (!path || !name) return fail("缺少参数：path（现有设计稿）与 name（新文件名，如 new.fig）。");
  let dir: string, file: string, base: string;
  try {
    ({ dir, file, base } = resolveDesignFile(path, toolRoot(args)));
  } catch (err: any) {
    return fail(String(err?.message ?? err));
  }
  if (!validDesignName(name)) return fail(`非法新文件名：${name}（仅允许 <名称>.fig/.pen，支持中文）`);
  if (!(await waitForDesignFile(file))) return fail(`设计稿不存在（可能仍在落盘，稍后重试）：${path}`);
  const target = resolve(dir, name);
  if (!target.startsWith(dir + "/")) return fail(`非法目标路径：${name}`);
  if (existsSync(target)) return fail(`目标已存在：designs/${name}`);
  renameSync(file, target);
  return ok(`已重命名：${base} → designs/${name}`, { path: `designs/${name}` });
}

async function toolDesignCreate(args: any = {}) {
  let root;
  try { root = toolRoot(args); } catch (err: any) { return fail(String(err?.message ?? err)); }
  const base = store.projectBaseName(root);
  const name = String(args?.name ?? "").trim() || "ui";
  const rel = `.wudi/${base}/designs/${name}.fig`;
  let file: string;
  try {
    file = resolveDesignFile(rel, root).file;
  } catch (err: any) {
    return fail(String(err?.message ?? err));
  }
  if (existsSync(file)) {
    return ok(`画布已存在：${rel}（直接打开）`, { path: rel });
  }
  /* 所有画布集中在工作区 .wudi/<项目>/designs/，统一走默认子进程（其工作区根即工作区） */
  await openpencilCall(undefined, "new_design", { path: rel });
  // openPencil 落盘是异步的：轮询等待文件真正写出（最多 5s），保证后续改名/删除立即可用
  const deadline = Date.now() + 5000;
  while (!existsSync(file) && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 120));
  }
  if (!existsSync(file)) return fail(`画布创建超时（文件未落盘）：${rel}`);
  return ok(`已创建画布：${rel}`, { path: rel });
}

function toolDesignsList(args: any = {}) {
  const root = toolRoot(args);
  const dir = store.designsDirFor(root);
  try { store.migrateDesignsFor(root); } catch { /* 迁移失败不阻塞列表 */ }
  const designs = [];
  try {
    for (const f of readdirSync(dir)) {
      if (!/\.(fig|pen)$/i.test(f)) continue;
      const st = statSync(join(dir, f));
      designs.push({
        name: f,
        path: `.wudi/${store.projectBaseName(root)}/designs/${f}`,
        format: f.toLowerCase().endsWith(".fig") ? "fig（可编辑）" : "pen（只读导入）",
        sizeKB: Number((st.size / 1024).toFixed(1)),
        updatedAt: st.mtime.toISOString(),
      });
    }
  } catch { /* designs/ 不存在 */ }
  designs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const lines = designs.length
    ? designs.map((d) => `- ${d.name}（${d.format}，${d.sizeKB} KB，${d.updatedAt.slice(0, 16).replace("T", " ")}）`).join("\n")
    : "（designs/ 目录还没有设计稿。用 OpenPencil 的 new_design 创建，或让 Agent 建稿。）";
  return ok(`设计稿（${designs.length}）：\n${lines}\n\n交互：open_design 打开协同编辑 → create_shape/render 改内容 → export_image 渲染 PNG 到 .wudi/design/renders/ 进面板图墙。`, { designs });
}

function toolFigmaLink(args: any = {}) {
  if (args.url === undefined) {
    const url = getFigmaUrl();
    return url
      ? ok(`当前 Figma 文件链接：${url}`, { url })
      : ok("尚未设置 Figma 文件链接。调用本工具传 url（https://www.figma.com/ 开头）记住后面板可一键打开。");
  }
  try {
    const url = setFigmaUrl(args.url);
    return ok(`Figma 文件链接已保存：${url}\n边界说明：Figma API 只读 —— Agent 可拉取结构/渲染图/比对 tokens（wudi_figma_*），但改不了 Figma 文件；需要 Agent 写的设计请走 Excalidraw 画布。`, { url });
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
}

async function toolFigmaTokensDiff(args: any = {}) {
  if (!figmaToken()) {
    return ok(
      "Figma 接入未启用：插件设置里还没有配置 figmaToken（同 wudi_figma_fetch 的启用步骤）。配置后本工具把画板样式与本地 design tokens 自动比对。"
    );
  }
  let ref;
  try {
    ref = parseFigmaRef(args.ref);
  } catch (err) {
    return fail(String(err?.message ?? err));
  }
  if (!ref.nodeId) {
    return fail("建议带 node-id 指向定稿画板（否则扫描整文件噪声大）。示例：https://www.figma.com/design/<key>/<file>?node-id=12-34");
  }
  const localTokens = store.loadTokens();
  if (!localTokens) {
    return fail("本地还没有 design tokens（.wudi/design/tokens.json）。先 /wudi-ui 建立规范或用 wudi_design_tokens_set 写入，再回来比对。");
  }
  try {
    const data = await fetchFigmaStructure({
      fileKey: ref.fileKey,
      nodeId: ref.nodeId,
      maxDepth: Math.min(Math.max(Number(args.maxDepth) || 8, 1), 12),
      budgetMax: 2000,
    });
    const styles = extractStyles(data.tree);
    // 本地 tokens 展开比对：color 组值集合、typography 中的 px 值集合
    const localColors = new Set();
    const localSizes = new Set();
    for (const v of Object.values(localTokens.color ?? {})) {
      if (typeof v === "string") localColors.add(v.toLowerCase());
    }
    for (const v of Object.values(localTokens.typography ?? {})) {
      const m = typeof v === "string" ? v.match(/^(\d+(?:\.\d+)?)px$/) : null;
      if (m) localSizes.add(String(Number(m[1])));
    }
    const missingColors = styles.colors.filter((c) => !localColors.has(c.hex.toLowerCase()));
    const unusedColors = [...localColors].filter((c) => !styles.colors.some((s) => s.hex.toLowerCase() === c));
    const missingSizes = styles.fontSizes.filter((s) => !localSizes.has(String(s.size)));
    const unusedSizes = [...localSizes].filter((s) => !styles.fontSizes.some((x) => String(x.size) === s));

    const lines = [
      `═══ Figma ↔ tokens 比对（节点 ${ref.nodeId}，扫描 ${styles.visited} 节点）═══`,
      `设计稿颜色 ${styles.colors.length} 种 / 字号 ${styles.fontSizes.length} 档；本地 tokens 颜色 ${localColors.size} / 字号 ${localSizes.size}`,
      "",
      `【tokens 缺失】设计稿出现但 tokens 没有（${missingColors.length} 色 / ${missingSizes.length} 档）：`,
      ...(missingColors.slice(0, 15).map((c) => `- ${c.hex}（出现 ${c.count} 次）`)),
      ...(missingSizes.slice(0, 10).map((s) => `- ${s.size}px（出现 ${s.count} 次）`)),
      (!missingColors.length && !missingSizes.length) ? "  （无缺失 ✓）" : "",
      "",
      `【tokens 未用】tokens 有但该画板未出现（${unusedColors.length} 色 / ${unusedSizes.length} 档）：`,
      ...(unusedColors.slice(0, 15).map((c) => `- ${c}`)),
      ...(unusedSizes.slice(0, 10).map((s) => `- ${s}px`)),
      (!unusedColors.length && !unusedSizes.length) ? "  （无未用 ✓）" : "",
      "",
      "处置建议：缺失项确认后用 wudi_design_tokens_set 补入；未用项确认是别的画板在用还是规范过时（本工具只出报告不改 tokens）。",
    ].filter(Boolean);
    return ok(lines.join("\n").slice(0, 30_000), { missingColors, missingSizes, unusedColors, unusedSizes, scanned: styles.visited });
  } catch (err) {
    if (err?.message === "FIGMA_TOKEN_MISSING") return fail("WUDI_FIGMA_TOKEN 环境变量缺失：检查插件清单 userConfig 映射。");
    return fail(`比对失败：${String(err?.message ?? err).slice(0, 800)}`);
  }
}

function listLocalArtifacts() {
  const dir = join(store.wudiDir(), "artifacts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(tar|tar\.gz)$/.test(f))
    .sort()
    .reverse()
    .slice(0, 10)
    .map((name) => {
      const sizeMB = (statSync(join(dir, name)).size / 1024 / 1024).toFixed(1);
      return { name, sizeMB: Number(sizeMB) };
    });
}

/** 清理服务器旧版本：只删时间戳命名目录，保留最近 5 个，先算清楚再删。 */
async function pruneReleases(envObj) {
  const releasesDir = join(envObj.deployRoot, "releases");
  const { stdout } = await sshRun(`ls -1 ${q(releasesDir)}`, { timeoutMs: 30_000, overrides: envObj.ssh });
  const all = parseRemoteReleases(stdout);
  const keep = all.slice(0, 5);
  const toDelete = all.filter((r) => !keep.includes(r));
  if (!toDelete.length) return "旧版本清理：无需清理（共 " + all.length + " 个版本）。";
  for (const r of toDelete) {
    await sshRun(`rm -rf -- ${q(join(releasesDir, r))}`, { timeoutMs: 120_000, overrides: envObj.ssh });
  }
  return `旧版本清理：已删除 ${toDelete.length} 个（${toDelete.join(", ")}），保留最近 5 个（${keep.join(", ")}）。`;
}
