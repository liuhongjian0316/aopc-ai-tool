// 观己 · 脱敏与签名工具
// 事件日志落盘前的最后一道闸:截断 + 密钥模式打码 + 单行化。

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /ghp_[A-Za-z0-9]{20,}/g,
  /gho_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9._-]{8,}/gi,
  /(api[_-]?key|apikey|secret|password|passwd|token|authorization)\s*[=:]\s*["']?[^\s"',;)}]{6,}/gi,
];

export const MAX_SNIPPET = 2048;

/** 截断 + 打码 + 单行化(事件日志是 JSONL,必须单行安全) */
export function redact(text, max = MAX_SNIPPET) {
  if (typeof text !== "string") return "";
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, "***");
  out = out.replace(/[\r\n\t]+/g, " ").trim();
  if (out.length > max) out = out.slice(0, max) + "…(截断)";
  return out;
}

/** 错误签名:归一化数字后取头部,用于"同类失败"连败判定 */
export function errorSignature(text) {
  if (typeof text !== "string") return "unknown";
  const s = text.replace(/[\r\n\t]+/g, " ").replace(/\d+/g, "N").trim();
  return s.slice(0, 48) || "unknown";
}
