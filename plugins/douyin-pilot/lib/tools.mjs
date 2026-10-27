/**
 * douyin-pilot MCP 工具定义与分发。
 * 约定：所有工具返回中文文本，直接面向 Agent 阅读；
 * 需要用户介入的步骤（扫码授权、补 client_key）在返回里明确写出下一步。
 */
import { existsSync, statSync } from "node:fs";
import http from "node:http";
import { randomUUID } from "node:crypto";
import * as api from "./douyin-api.mjs";
import {
  loadConfig,
  loadAccounts,
  saveAccount,
  loadQueue,
  saveQueue,
  publishGuardStats,
  loadSnapshots,
  saveSnapshot,
  loadDmRules,
  saveDmRules,
  writeJSON,
} from "./store.mjs";
import { rpaCommand, rpaInstalled, rpaInstallHint, rpaDir } from "./rpa-client.mjs";

const ok = (text) => ({ content: [{ type: "text", text }], isError: false });
const fail = (text) => ({ content: [{ type: "text", text }], isError: true });
const j = (v) => JSON.stringify(v, null, 2);

/** 回复内容合规兜底：营销引流/敏感词命中即拒绝自动回复，转人工。 */
const SENSITIVE_WORDS = [
  "加微信", "微信号", "vx", "VX", "威信", "扫码", "转账", "汇款", "刷单", "兼职",
  "退款理赔", "中奖", "免费领", "代刷", "涨粉服务", "博彩", "色情", "裸聊",
];

function hitsSensitive(text) {
  const t = String(text ?? "").toLowerCase();
  return SENSITIVE_WORDS.find((w) => t.includes(w.toLowerCase())) ?? null;
}

/** 发布风控守卫（API/RPA 通道共用）：返回 null = 放行，否则返回拦截文案。 */
function checkPublishGuard(accountKey, force) {
  const config = loadConfig();
  const guard = publishGuardStats(accountKey);
  if (force) return null;
  if (guard.publishedToday >= config.dailyPublishCap)
    return `该账号今日已发布 ${guard.publishedToday} 条，达到上限 ${config.dailyPublishCap}。确需继续请带 force=true。`;
  const gapMs = config.minPublishIntervalMin * 60 * 1000;
  if (guard.lastPublishedAt && Date.now() - guard.lastPublishedAt < gapMs) {
    const waitMin = Math.ceil((gapMs - (Date.now() - guard.lastPublishedAt)) / 60000);
    return `距上次发布不足 ${config.minPublishIntervalMin} 分钟，建议再等 ${waitMin} 分钟（风控保护）。确需立即发布请带 force=true。`;
  }
  return null;
}

/* ---------------- 账号与 token ---------------- */

/** 取可用 token：过期自动用 refresh_token 续期，续期失败提示重新授权。 */
async function getValidToken(account) {
  const config = loadConfig();
  if (!account) throw new Error("未找到账号，请先调用 dy_auth_url / dy_auth_listen 完成授权。");
  if (Date.now() < (account.expiresAt ?? 0)) return account.accessToken;
  const fresh = await api.refreshToken(config, account.refreshToken);
  const updated = saveAccount({ ...account, ...fresh });
  return updated.accessToken;
}

/** 按昵称或 openId 选账号；不传且只有一个账号时直接用它。 */
function resolveAccount(ref) {
  const accounts = loadAccounts();
  const list = Object.values(accounts);
  if (!ref) {
    if (list.length === 1) return list[0];
    throw new Error(
      list.length === 0
        ? "尚无已授权账号。先运行 dy_auth_listen（本机回调）或 dy_auth_url + dy_auth_exchange（手动粘贴）完成授权。"
        : `本机有 ${list.length} 个账号，请用 accountId 指定：${list.map((a) => `${a.nickname || a.openId}(${a.openId.slice(0, 8)}…)`) .join("、")}`
    );
  }
  const hit = list.find((a) => a.openId === ref) ?? list.find((a) => (a.nickname ?? "") === ref);
  if (!hit) throw new Error(`找不到账号「${ref}」。可用：${list.map((a) => a.nickname || a.openId).join("、")}`);
  return hit;
}

/* ---------------- 工具分发 ---------------- */

export async function callTool(name, args = {}) {
  try {
    const out = await dispatch(name, args);
    // dispatch 的校验拦截路径会直接返回 fail(...) 结构，此时不再包一层
    if (out && typeof out === "object" && Array.isArray(out.content)) return out;
    return ok(out);
  } catch (err) {
    return fail(`【douyin-pilot 出错】${err.message}${err.code ? `（错误码 ${err.code}）` : ""}`);
  }
}

async function dispatch(name, args) {
  const config = loadConfig();

  switch (name) {
    /* ===== 配置 ===== */
    case "dy_config_get": {
      const done = Boolean(config.clientKey && config.clientSecret);
      return [
        `配置状态：${done ? "✅ 已配置 client_key" : "❌ 未配置 client_key/secret（开放平台控制台 → 应用详情里获取）"}`,
        `client_key：${config.clientKey ? config.clientKey.slice(0, 6) + "…" : "（空）"}`,
        `回调地址：${config.redirectUri}`,
        `授权 scope：${config.scopes}`,
        `接口版本：${config.apiMode}`,
        `风控：每日上限 ${config.dailyPublishCap} 条 / 最小间隔 ${config.minPublishIntervalMin} 分钟`,
      ].join("\n");
    }
    case "dy_config_set": {
      const patch = {};
      for (const k of ["clientKey", "clientSecret", "redirectUri", "scopes", "apiMode"]) {
        if (args[k] !== undefined && args[k] !== "") patch[k] = args[k];
      }
      const saved = { ...config, ...patch };
      writeJSON("config", saved);
      return `配置已保存${Object.keys(patch).length ? `（更新：${Object.keys(patch).join("、")}）` : "（无变更）"}。${saved.clientKey && saved.clientSecret ? "可以开始授权了：调用 dy_auth_listen。" : "client_key/secret 仍不全，暂无法授权。"}`;
    }

    /* ===== 授权 ===== */
    case "dy_auth_url": {
      if (!config.clientKey) return "请先用 dy_config_set 写入 client_key / client_secret。";
      const state = randomUUID();
      return [
        "请在浏览器打开下面的授权链接，同意后：",
        args.localRedirect !== false && config.redirectUri.includes("127.0.0.1")
          ? `回调会打到本机 ${config.redirectUri}，接着调用 dy_auth_listen 等待回调自动完成。`
          : "复制跳转后地址栏里的 code 参数值，调用 dy_auth_exchange 完成。",
        `授权链接：\n${api.authorizeUrl(config, state)}`,
        `state=${state}（回调校验用）`,
      ].join("\n");
    }
    case "dy_auth_exchange": {
      const code =
        (args.code ?? "").trim() ||
        (new URL((args.redirectUrl ?? "").trim()).searchParams.get("code") ?? "");
      if (!code) return "缺少 code：传回调地址（redirectUrl）或 code 参数。";
      const account = await api.exchangeCode(config, code);
      const info = await api.userInfo(account.accessToken, account.openId);
      saveAccount({ ...account, nickname: info?.nickname ?? "", avatar: info?.avatar ?? "" });
      return `✅ 授权成功：${info?.nickname || account.openId}（scope: ${account.scope}）。现在可以 dy_account_stats / dy_publish_video 了。`;
    }
    case "dy_auth_listen": {
      if (!config.clientKey) return "请先用 dy_config_set 写入 client_key / client_secret。";
      const { hostname, port } = new URL(config.redirectUri);
      if (!["127.0.0.1", "localhost"].includes(hostname))
        return `回调地址 ${config.redirectUri} 不是本机地址，无法本机监听。请用 dy_auth_url + dy_auth_exchange 手动粘贴 code。`;
      const timeoutMs = Number(args.timeoutSec ?? 180) * 1000;
      const result = await new Promise((resolve) => {
        const server = http.createServer((req, res) => {
          const url = new URL(req.url, config.redirectUri);
          const code = url.searchParams.get("code");
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(
            code
              ? "<h2>✅ 授权成功，回到 AOPC 继续。</h2>"
              : "<h2>❌ 回调里没有 code，回到 AOPC 查看日志。</h2>"
          );
          server.close();
          resolve(code ? { code } : { error: "回调缺少 code 参数" });
        });
        server.on("error", (err) => resolve({ error: `本机 ${port} 端口监听失败：${err.message}` }));
        server.listen(port, hostname);
        setTimeout(() => {
          server.close();
          resolve({ error: `等待回调超时（${timeoutMs / 1000}s）。请确认浏览器里已完成授权。` });
        }, timeoutMs);
      });
      if (result.error) return `❌ ${result.error}`;
      const account = await api.exchangeCode(config, result.code);
      const info = await api.userInfo(account.accessToken, account.openId);
      saveAccount({ ...account, nickname: info?.nickname ?? "", avatar: info?.avatar ?? "" });
      return `✅ 授权成功：${info?.nickname || account.openId}（scope: ${account.scope}）。现在可以 dy_account_stats / dy_publish_video 了。`;
    }
    case "dy_accounts": {
      const list = Object.values(loadAccounts());
      if (!list.length) return "暂无已授权账号。";
      return list
        .map(
          (a) =>
            `${a.nickname || "(未取到昵称)"}｜openId=${a.openId}｜token${Date.now() < (a.expiresAt ?? 0) ? "有效" : "已过期(会自动续期)"}｜scope=${a.scope}`
        )
        .join("\n");
    }
    case "dy_account_refresh": {
      const account = resolveAccount(args.accountId);
      const fresh = await api.refreshToken(config, account.refreshToken);
      saveAccount({ ...account, ...fresh });
      return `✅ ${account.nickname || account.openId} 的 token 已续期。`;
    }

    /* ===== 发布 ===== */
    case "dy_publish_video": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const videoPath = args.videoPath;
      if (!videoPath || !existsSync(videoPath))
        return fail(`视频文件不存在：${videoPath}`);
      const sizeMB = statSync(videoPath).size / 1024 / 1024;
      if (sizeMB > 4000) return fail(`视频 ${(sizeMB / 1024).toFixed(1)}GB 超过 4GB 上限。`);

      // 风控守卫：频次与每日上限（force=true 可越过）
      const blocked = checkPublishGuard(account.openId, args.force);
      if (blocked) return fail(blocked);

      const text = args.title + (Array.isArray(args.tags) && args.tags.length ? " " + args.tags.map((t) => (t.startsWith("#") ? t : `#${t}#`)).join(" ") : "");
      const videoId = await api.uploadVideo(token, config.apiMode, videoPath);
      const { itemId, publishId } = await api.createVideo(token, config.apiMode, {
        videoId,
        text,
        poiId: args.poiId,
      });
      const queue = loadQueue();
      const task = {
        id: randomUUID().slice(0, 8),
        accountId: account.openId,
        accountName: account.nickname || account.openId,
        videoPath,
        title: args.title,
        tags: args.tags ?? [],
        videoId,
        itemId,
        publishId,
        status: "published",
        publishedAt: new Date().toISOString(),
      };
      queue.tasks.push(task);
      saveQueue(queue);
      return `✅ 已发布：${args.title}\nitem_id=${itemId}（后续查数据/评论用它）\n审核通常几分钟到几小时，可用 dy_publish_status 查看审核状态。`;
    }
    case "dy_publish_status": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const data = await api.videoList(token, config.apiMode, { cursor: 0, count: Number(args.count ?? 10) });
      const items = data.list ?? data.data?.list ?? data.items ?? [];
      if (!items.length) return "该账号暂无作品记录。";
      return items
        .map((v) => `${v.item_id ?? v.itemId}｜${(v.title ?? "").slice(0, 40)}｜状态=${v.status ?? v.review_status ?? "?"}｜创建=${v.create_time ? new Date(Number(v.create_time) * 1000).toLocaleString("zh-CN") : "?"}`)
        .join("\n");
    }

    /* ===== RPA 通道（路线B 主通道：创作者中心自动化） ===== */
    case "dy_rpa_setup": {
      const chinaMirror = args.chinaMirror !== false;
      const { execFile } = await import("node:child_process");
      const run = (cmd, argv, extraEnv = {}) =>
        new Promise((resolve) =>
          execFile(
            cmd,
            argv,
            { cwd: rpaDir(), timeout: 600000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, ...extraEnv } },
            (err, stdout, stderr) => resolve({ err, out: `${stdout}${stderr}`.trimEnd().slice(-2500) })
          )
        );
      const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
      const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
      console.error("[douyin-pilot] 安装 playwright…");
      const npmRes = await run(npmBin, [
        "install",
        "--no-audit",
        "--no-fund",
        ...(chinaMirror ? ["--registry=https://registry.npmmirror.com"] : []),
      ]);
      if (npmRes.err) return fail(`npm install 失败：${npmRes.err.message}\n${npmRes.out}\n可按 README 手动安装后重试。`);
      console.error("[douyin-pilot] 下载 chromium…");
      const pwRes = await run(npxBin, ["playwright", "install", "chromium"], chinaMirror ? { PLAYWRIGHT_DOWNLOAD_HOST: "https://cdn.npmmirror.com/binaries/playwright" } : {});
      if (pwRes.err) return fail(`chromium 下载失败：${pwRes.err.message}\n${pwRes.out}\n可按 README 手动安装后重试。`);
      return `✅ RPA 依赖安装完成（playwright + chromium）。下一步：执行 dy_rpa_login，在弹出的浏览器里扫码登录创作者中心。`;
    }
    case "dy_rpa_status": {
      if (!rpaInstalled()) return rpaInstallHint();
      const st = await rpaCommand("status", {}, 90000);
      return [
        `Playwright：✅ 已安装`,
        `创作者中心登录态：${st.loggedIn ? "✅ 有效" : "❌ 未登录（执行 dy_rpa_login 扫码）"}`,
        `浏览器 profile：${st.profileDir}`,
        `发布模式：${st.headlessDefault ? "无头（后台静默）" : "有头（可见窗口，风控更稳）"}`,
      ].join("\n");
    }
    case "dy_rpa_login": {
      if (!rpaInstalled()) return rpaInstallHint();
      const timeoutSec = Number(args.timeoutSec ?? 300);
      const res = await rpaCommand("login", { timeoutSec }, timeoutSec * 1000 + 30000);
      return res.loggedIn
        ? `✅ ${res.alreadyLoggedIn ? "已有登录态，无需重复扫码" : "扫码登录成功"}。可以 dy_rpa_publish 发布了；登录态保存在本机 profile，长期有效。`
        : "未检测到登录。";
    }
    case "dy_rpa_publish": {
      const videoPath = args.videoPath;
      if (!videoPath || !existsSync(videoPath)) return fail(`视频文件不存在：${videoPath}`);
      const blocked = checkPublishGuard("rpa", args.force);
      if (blocked) return fail(blocked);
      let scheduleAt = null;
      if (args.scheduleAt) {
        const due = Date.parse(args.scheduleAt);
        if (!Number.isFinite(due)) return fail(`scheduleAt 不是合法时间：${args.scheduleAt}（ISO 格式）`);
        const hoursAhead = (due - Date.now()) / 3600000;
        if (hoursAhead < 2) return fail("定时发布需至少晚于当前 2 小时（平台规则）。想立即发布请去掉 scheduleAt。");
        if (hoursAhead > 24 * 10) return fail("定时发布最远只支持 10 天内（平台规则）。");
        scheduleAt = args.scheduleAt;
      }
      let res;
      try {
        res = await rpaCommand("publish", { videoPath, title: args.title, tags: args.tags ?? [], scheduleAt }, 16 * 60 * 1000);
      } catch (err) {
        if (err.message === "RPA_NOT_INSTALLED") return fail(rpaInstallHint());
        throw err;
      }
      const queue = loadQueue();
      queue.tasks.push({
        id: randomUUID().slice(0, 8),
        accountId: "rpa",
        accountName: "RPA-创作者中心",
        channel: "rpa",
        videoPath,
        title: args.title,
        tags: args.tags ?? [],
        scheduleAt,
        status: "published",
        publishedAt: new Date().toISOString(),
        pageUrl: res.url,
      });
      saveQueue(queue);
      return [
        `✅ ${scheduleAt ? "已设置定时发布" : "已发布"}：${args.title}`,
        `耗时 ${res.tookSec}s${scheduleAt ? `，定时 ${scheduleAt}` : ""}`,
        `请到创作者中心「内容管理」核对一眼（发布状态/封面），链接：${res.url}`,
      ].join("\n");
    }
    case "dy_rpa_close": {
      try {
        await rpaCommand("close", {}, 15000);
        return "✅ RPA 浏览器已关闭。";
      } catch (err) {
        return err.message === "RPA_NOT_INSTALLED" ? "RPA 未安装，无需关闭。" : `关闭时出错：${err.message}`;
      }
    }

    /* ===== 队列（定时发布） ===== */
    case "dy_queue_add": {
      const due = Date.parse(args.dueAt);
      if (!Number.isFinite(due)) return fail(`dueAt 不是合法时间：${args.dueAt}（ISO 格式，如 2026-10-28T19:30:00+08:00）`);
      // 账号允许先不绑定（尚未授权时也能占坑），执行时再校验
      const accountRef = args.accountId ?? null;
      let accountName;
      try {
        accountName = resolveAccount(accountRef).nickname || accountRef;
      } catch {
        accountName = accountRef ?? "(待授权后绑定)";
      }
      const queue = loadQueue();
      const task = {
        id: randomUUID().slice(0, 8),
        accountId: accountRef,
        accountName,
        channel: args.channel === "api" ? "api" : "rpa",
        videoPath: args.videoPath,
        title: args.title,
        tags: args.tags ?? [],
        dueAt: new Date(due).toISOString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      queue.tasks.push(task);
      saveQueue(queue);
      return `✅ 已入队（id=${task.id}，通道=${task.channel}，账号：${accountName}），${task.dueAt} 到期后调用 dy_queue_run 执行（RPA 通道在到期时刻立即发布；API 通道可直接传 scheduleAt 用平台定时）。也可在 AOPC 里给 dy_queue_run 挂定时任务。${accountRef || task.channel === "rpa" ? "" : "\n⚠️ 任务尚未绑定账号，授权后请补绑。"}`;
    }
    case "dy_queue_list": {
      const tasks = loadQueue().tasks;
      if (!tasks.length) return "发布队列为空。";
      return tasks
        .map((t) => `${t.id}｜[${t.channel ?? "api"}] ${t.accountName ?? t.accountId}｜${t.title}｜到期=${t.dueAt ?? "-"}｜${t.status}${t.error ? `（${t.error}）` : ""}`)
        .join("\n");
    }
    case "dy_queue_run": {
      const now = Date.now();
      const queue = loadQueue();
      const due = queue.tasks.filter((t) => t.status === "pending" && Date.parse(t.dueAt) <= now);
      if (!due.length) return "没有到期任务。";
      const lines = [];
      for (const task of due) {
        try {
          const res =
            task.channel === "api"
              ? await dispatch("dy_publish_video", {
                  accountId: task.accountId,
                  videoPath: task.videoPath,
                  title: task.title,
                  tags: task.tags,
                })
              : await dispatch("dy_rpa_publish", {
                  videoPath: task.videoPath,
                  title: task.title,
                  tags: task.tags,
                });
          task.status = res.isError ? "failed" : "published";
          task.publishedAt = new Date().toISOString();
          if (res.isError) {
            task.error = res.content[0].text;
            lines.push(`❌ ${task.id}：${task.error}`);
          } else {
            lines.push(`✅ ${task.id}：${task.title} 已发布`);
          }
        } catch (err) {
          task.status = "failed";
          task.error = err.message;
          lines.push(`❌ ${task.id}：${err.message}`);
        }
      }
      saveQueue(queue);
      return lines.join("\n");
    }

    /* ===== 数据 ===== */
    case "dy_account_stats": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const data = await api.userBaseData(token, config.apiMode, args.dateRange ?? "7d");
      return `${account.nickname || account.openId} 近期数据：\n${j(data)}`;
    }
    case "dy_video_list": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const data = await api.videoList(token, config.apiMode, {
        cursor: Number(args.cursor ?? 0),
        count: Number(args.count ?? 10),
      });
      return j(data);
    }
    case "dy_video_stats": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const ids = Array.isArray(args.itemIds) ? args.itemIds.join(",") : args.itemIds;
      const data = await api.videoBaseData(token, config.apiMode, ids, args.dateRange ?? "7d");
      return j(data);
    }
    case "dy_snapshot": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const user = await api.userBaseData(token, config.apiMode, "7d");
      saveSnapshot(new Date().toISOString().slice(0, 10), {
        accountId: account.openId,
        accountName: account.nickname || account.openId,
        data: user,
      });
      const dates = Object.keys(loadSnapshots()).sort();
      return `✅ 已保存 ${dates.at(-1)} 快照（累计 ${dates.length} 天）。快照攒起来后，可用 dy-analytics 技能出趋势周报。`;
    }

    /* ===== 评论 ===== */
    case "dy_comment_list": {
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      const data = await api.commentList(token, config.apiMode, args.itemId, { cursor: Number(args.cursor ?? 0), count: Number(args.count ?? 20) });
      return j(data);
    }
    case "dy_comment_reply": {
      const bad = hitsSensitive(args.content);
      if (bad) return fail(`回复内容命中敏感词「${bad}」，已拦截。请改写或转人工处理。`);
      const account = resolveAccount(args.accountId);
      const token = await getValidToken(account);
      await api.commentReply(token, config.apiMode, {
        itemId: args.itemId,
        commentId: args.commentId,
        content: args.content,
      });
      return `✅ 已回复评论 ${args.commentId}：${args.content}`;
    }

    /* ===== 私信规则（Phase 2 webhook/RPA 消费） ===== */
    case "dy_dm_rules": {
      if (args.set !== undefined) {
        saveDmRules({ rules: args.set });
        return `✅ 私信规则已保存（${args.set.length} 条）。Phase 2 接入 webhook/RPA 通道后生效。`;
      }
      const { rules } = loadDmRules();
      if (!rules.length) return "暂无私信规则。传 set=[{keyword,reply,enabled}] 设置关键词回复规则。";
      return rules.map((r) => `${r.enabled === false ? "⛔" : "▶️"} ${r.keyword} → ${r.reply}`).join("\n");
    }

    default:
      return fail(`未知工具：${name}`);
  }
}

/* ---------------- MCP 工具清单 ---------------- */

const str = (desc) => ({ type: "string", description: desc });
const bool = (desc) => ({ type: "boolean", description: desc });

export const TOOLS = [
  {
    name: "dy_config_get",
    description: "查看抖音开放平台配置状态（client_key 是否已配、回调地址、scope、风控参数）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_config_set",
    description: "写入抖音开放平台配置（clientKey/clientSecret/redirectUri/scopes/apiMode），保存到本机插件数据目录",
    inputSchema: {
      type: "object",
      properties: {
        clientKey: str("应用的 client_key"),
        clientSecret: str("应用的 client_secret"),
        redirectUri: str("OAuth 回调地址"),
        scopes: str("逗号分隔的授权 scope"),
        apiMode: { type: "string", enum: ["v1", "legacy"], description: "接口路径版本" },
      },
    },
  },
  {
    name: "dy_auth_url",
    description: "生成抖音开放平台授权链接（用户在浏览器打开并确认授权）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_auth_listen",
    description: "在本机启动 OAuth 回调监听，等待浏览器授权后自动换取 token（回调地址需为 127.0.0.1/localhost）",
    inputSchema: {
      type: "object",
      properties: { timeoutSec: { type: "number", description: "等待回调超时秒数，默认 180" } },
    },
  },
  {
    name: "dy_auth_exchange",
    description: "手动模式换取 token：传回调完整地址（redirectUrl）或其中的 code 参数",
    inputSchema: {
      type: "object",
      properties: {
        code: str("授权回调返回的 code"),
        redirectUrl: str("授权后浏览器跳转的完整 URL"),
      },
    },
  },
  {
    name: "dy_accounts",
    description: "列出本机已授权的抖音账号及 token 状态",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_account_refresh",
    description: "手动续期指定账号的 access_token",
    inputSchema: { type: "object", properties: { accountId: str("openId 或昵称") } },
  },
  {
    name: "dy_publish_video",
    description: "发布视频到抖音：上传文件并创建作品（含风控守卫：每日上限与最小发布间隔）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称，单账号可省略"),
        videoPath: str("本地视频文件绝对路径（mp4）", true),
        title: str("作品标题（不含话题）", true),
        tags: { type: "array", items: { type: "string" }, description: "话题标签数组，如 [\"美食\", \"探店\"]" },
        poiId: str("挂载地理位置的 POI id（可选，需已开通 POI 权限）"),
        force: bool("越过风控守卫强制发布"),
      },
      required: ["videoPath", "title"],
    },
  },
  {
    name: "dy_publish_status",
    description: "查看账号作品的审核状态与最近发布记录",
    inputSchema: {
      type: "object",
      properties: { accountId: str("openId 或昵称"), count: { type: "number", description: "条数，默认 10" } },
    },
  },
  {
    name: "dy_rpa_setup",
    description: "安装 RPA 通道依赖（playwright + chromium，默认走国内镜像），首次使用 RPA 通道前执行一次",
    inputSchema: {
      type: "object",
      properties: { chinaMirror: { type: "boolean", description: "使用国内镜像加速，默认 true" } },
    },
  },
  {
    name: "dy_rpa_status",
    description: "查看 RPA 通道状态：playwright 是否安装、创作者中心登录态（无头探测，不弹窗）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_rpa_login",
    description: "弹出浏览器打开创作者中心，等待用户扫码登录；登录态持久化到本机 profile",
    inputSchema: {
      type: "object",
      properties: { timeoutSec: { type: "number", description: "等待扫码超时秒数，默认 300" } },
    },
  },
  {
    name: "dy_rpa_publish",
    description: "RPA 主通道发布视频：自动操作创作者中心完成上传/标题/话题/定时发布（含风控守卫与二次确认处理）",
    inputSchema: {
      type: "object",
      properties: {
        videoPath: str("本地视频文件绝对路径（mp4）", true),
        title: str("作品标题（不含话题）", true),
        tags: { type: "array", items: { type: "string" }, description: "话题标签数组" },
        scheduleAt: str("定时发布时间 ISO 格式（可选；须晚于当前 2 小时、10 天内）"),
        force: bool("越过风控守卫强制发布"),
      },
      required: ["videoPath", "title"],
    },
  },
  {
    name: "dy_rpa_close",
    description: "关闭 RPA 浏览器（登录态保留在本机 profile）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_queue_add",
    description: "添加定时发布任务（到点后由 dy_queue_run 执行）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        videoPath: str("本地视频文件绝对路径", true),
        title: str("作品标题", true),
        tags: { type: "array", items: { type: "string" }, description: "话题标签数组" },
        dueAt: str("到期时间 ISO 格式，如 2026-10-28T19:30:00+08:00", true),
        channel: { type: "string", enum: ["rpa", "api"], description: "发布通道，默认 rpa（创作者中心自动化）" },
      },
      required: ["videoPath", "title", "dueAt"],
    },
  },
  {
    name: "dy_queue_list",
    description: "查看发布队列（待发/已发/失败）",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_queue_run",
    description: "执行所有到期的定时发布任务",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "dy_account_stats",
    description: "拉取账号概况数据（粉丝/播放/互动，data.external.user.base）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        dateRange: { type: "string", description: '统计窗口，如 "7d"、"30d"，默认 7d' },
      },
    },
  },
  {
    name: "dy_video_list",
    description: "拉取账号已发布视频列表（返回原始 JSON，含 item_id）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        cursor: { type: "number", description: "翻页游标" },
        count: { type: "number", description: "条数，默认 10" },
      },
    },
  },
  {
    name: "dy_video_stats",
    description: "拉取视频播放/点赞/评论/完播数据（data.external.video.base）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        itemIds: { type: "array", items: { type: "string" }, description: "视频 item_id 列表" },
        dateRange: { type: "string", description: '统计窗口，默认 "7d"' },
      },
      required: ["itemIds"],
    },
  },
  {
    name: "dy_snapshot",
    description: "拉取账号数据并保存当日快照（供趋势分析）",
    inputSchema: { type: "object", properties: { accountId: str("openId 或昵称") } },
  },
  {
    name: "dy_comment_list",
    description: "拉取某条视频的评论列表",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        itemId: str("视频 item_id", true),
        cursor: { type: "number", description: "翻页游标" },
        count: { type: "number", description: "条数，默认 20" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "dy_comment_reply",
    description: "回复一条评论（带敏感词拦截，命中即拒绝并建议转人工）",
    inputSchema: {
      type: "object",
      properties: {
        accountId: str("openId 或昵称"),
        itemId: str("视频 item_id", true),
        commentId: str("评论 id", true),
        content: str("回复内容", true),
      },
      required: ["itemId", "commentId", "content"],
    },
  },
  {
    name: "dy_dm_rules",
    description: "查看/设置私信关键词自动回复规则（Phase 2 通道接入后生效）",
    inputSchema: {
      type: "object",
      properties: {
        set: {
          type: "array",
          description: "设置规则数组 [{keyword, reply, enabled}]；不传则查看当前规则",
          items: {
            type: "object",
            properties: { keyword: str("触发关键词", true), reply: str("回复内容", true), enabled: bool("是否启用") },
          },
        },
      },
    },
  },
];
