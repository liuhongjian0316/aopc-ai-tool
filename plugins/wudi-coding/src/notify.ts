// @ts-nocheck —— 由 JS 迁移（tools/store/ssh/figma/notify/openpencil 为动态工具实现，类型逐步收紧；入口 src/server.ts 全量检查）
/**
 * 部署通知（v0.6）：deploy/rollback 终态推送 webhook。支持飞书、企业微信、通用 JSON 三种格式。
 * 配置来自项目档案（顶层或环境级覆盖）：notifyWebhook（URL）+ notifyFormat（feishu/wecom/generic，缺省 generic）。
 * 原则：通知失败绝不影响部署结果本身——只把失败原因附加到返回文本里。
 */

const NOTIFY_TIMEOUT_MS = 5_000;

/** 解析某环境的通知配置：环境级覆盖顶层。返回 {webhook, format} 或 null（未配置）。 */
export function resolveNotify(project, envObj) {
  const env = envObj?.raw ?? null;
  const webhook = (env?.notifyWebhook || project?.notifyWebhook || "").trim();
  if (!webhook) return null;
  const format = (env?.notifyFormat || project?.notifyFormat || "generic").toLowerCase();
  return { webhook, format: ["feishu", "wecom", "generic"].includes(format) ? format : "generic" };
}

/** 组装各平台的消息体。 */
export function buildPayload(format, info) {
  // info: {project, env, type, status, release, detail, durationMs, failedStage}
  const statusZh = info.status === "ok" ? "✅ 成功" : info.status === "ok-with-warnings" ? "⚠️ 成功（未经健康检查验证）" : info.status === "aborted" ? "⏹ 已中断" : `❌ 失败（卡在 ${info.failedStage ?? "?"}）`;
  const text = [
    `【无敌编程】${info.project || "未命名项目"} · ${info.type === "rollback" ? "回滚" : "部署"}${info.env && info.env !== "default" ? `@${info.env}` : ""}`,
    `结果：${statusZh}`,
    `版本：${info.release ?? "?"}`,
    info.durationMs ? `耗时：${(info.durationMs / 1000).toFixed(1)}s` : "",
    info.detail ? `详情：${String(info.detail).slice(0, 500)}` : "",
  ].filter(Boolean).join("\n");

  if (format === "feishu") {
    return { msg_type: "text", content: { text } };
  }
  if (format === "wecom") {
    return { msgtype: "text", text: { content: text } };
  }
  return { source: "wudi-coding", ...info, statusText: statusZh, text };
}

/**
 * 发送通知。返回 {ok, detail}；任何错误都被吞掉并记录（通知不干扰部署结果）。
 */
export async function sendNotify(cfg, info) {
  if (!cfg?.webhook) return { ok: false, detail: "未配置通知 webhook，跳过" };
  try {
    const body = JSON.stringify(buildPayload(cfg.format, info));
    const res = await fetch(cfg.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, detail: `webhook 返回 ${res.status}` };
    }
    return { ok: true, detail: `已推送 ${cfg.format} 通知` };
  } catch (err) {
    return { ok: false, detail: `推送失败：${String(err?.message ?? err).slice(0, 200)}` };
  }
}
