// src/notify.ts
var NOTIFY_TIMEOUT_MS = 5e3;
function resolveNotify(project, envObj) {
  const env = envObj?.raw ?? null;
  const webhook = (env?.notifyWebhook || project?.notifyWebhook || "").trim();
  if (!webhook) return null;
  const format = (env?.notifyFormat || project?.notifyFormat || "generic").toLowerCase();
  return { webhook, format: ["feishu", "wecom", "generic"].includes(format) ? format : "generic" };
}
function buildPayload(format, info) {
  const statusZh = info.status === "ok" ? "\u2705 \u6210\u529F" : info.status === "ok-with-warnings" ? "\u26A0\uFE0F \u6210\u529F\uFF08\u672A\u7ECF\u5065\u5EB7\u68C0\u67E5\u9A8C\u8BC1\uFF09" : info.status === "aborted" ? "\u23F9 \u5DF2\u4E2D\u65AD" : `\u274C \u5931\u8D25\uFF08\u5361\u5728 ${info.failedStage ?? "?"}\uFF09`;
  const text = [
    `\u3010\u65E0\u654C\u7F16\u7A0B\u3011${info.project || "\u672A\u547D\u540D\u9879\u76EE"} \xB7 ${info.type === "rollback" ? "\u56DE\u6EDA" : "\u90E8\u7F72"}${info.env && info.env !== "default" ? `@${info.env}` : ""}`,
    `\u7ED3\u679C\uFF1A${statusZh}`,
    `\u7248\u672C\uFF1A${info.release ?? "?"}`,
    info.durationMs ? `\u8017\u65F6\uFF1A${(info.durationMs / 1e3).toFixed(1)}s` : "",
    info.detail ? `\u8BE6\u60C5\uFF1A${String(info.detail).slice(0, 500)}` : ""
  ].filter(Boolean).join("\n");
  if (format === "feishu") {
    return { msg_type: "text", content: { text } };
  }
  if (format === "wecom") {
    return { msgtype: "text", text: { content: text } };
  }
  return { source: "wudi-coding", ...info, statusText: statusZh, text };
}
async function sendNotify(cfg, info) {
  if (!cfg?.webhook) return { ok: false, detail: "\u672A\u914D\u7F6E\u901A\u77E5 webhook\uFF0C\u8DF3\u8FC7" };
  try {
    const body = JSON.stringify(buildPayload(cfg.format, info));
    const res = await fetch(cfg.webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS)
    });
    if (!res.ok) {
      return { ok: false, detail: `webhook \u8FD4\u56DE ${res.status}` };
    }
    return { ok: true, detail: `\u5DF2\u63A8\u9001 ${cfg.format} \u901A\u77E5` };
  } catch (err) {
    return { ok: false, detail: `\u63A8\u9001\u5931\u8D25\uFF1A${String(err?.message ?? err).slice(0, 200)}` };
  }
}
export {
  buildPayload,
  resolveNotify,
  sendNotify
};
