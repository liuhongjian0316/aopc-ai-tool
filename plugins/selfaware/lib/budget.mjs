// 观己 · 上下文预算估算器
//
// 两级来源(勘察确认,AOPC v3.17.1):
//  1. provider 实测:rollout JSONL 每行 model_io 的 response.usage.inputTokens 就是
//     该次请求的真实上下文占用(P1 实测样本:{"inputTokens":80642,...})→ confidence high
//  2. 字节回退:文件字节 ÷ 3(与宿主 ESTIMATED_TOKEN_CHAR_DIVISOR 同口径)→ confidence low
//
// 增量读:state 记 rolloutOffset;首次直接取文件尾部 256KB(usage 锚点在最新行)。

import fs from "node:fs";
import path from "node:path";
import { rolloutDir } from "./state.mjs";

const TAIL_BYTES = 256 * 1024;
const MAX_INCREMENT = 8 * 1024 * 1024;

function extractUsage(line) {
  try {
    const u = JSON.parse(line)?.response?.usage;
    if (u && Number.isFinite(u.inputTokens)) return u;
  } catch {}
  return null;
}

export function updateBudget(sid, sess, cfg) {
  const file = path.join(rolloutDir(), `model-io-${sid}.jsonl`);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return sess.budget;
  }

  let used = sess.budget?.used ?? 0;
  let src = sess.budget?.src ?? "none";
  const offset = sess.rolloutOffset || 0;
  let fh = null;
  try {
    fh = fs.openSync(file, "r");
    let start;
    if (offset === 0) {
      start = Math.max(0, stat.size - TAIL_BYTES);
    } else if (stat.size > offset) {
      start = offset;
    } else {
      start = -1; // 无新内容
    }
    if (start >= 0) {
      const len = Math.min(stat.size - start, MAX_INCREMENT);
      const buf = Buffer.alloc(len);
      const read = fs.readSync(fh, buf, 0, len, start);
      const chunk = buf.toString("utf8", 0, read);
      for (const line of chunk.split("\n")) {
        if (!line) continue;
        const u = extractUsage(line);
        if (u) {
          used = u.inputTokens;
          src = "provider";
        } else if (src !== "provider") {
          used = Math.round((start + read) / 3);
          src = "estimate";
        }
      }
      sess.rolloutOffset = start + read;
    }
  } catch {
    // 读不到就沿用旧值
  } finally {
    if (fh) {
      try {
        fs.closeSync(fh);
      } catch {}
    }
  }

  const window = cfg.contextWindow || 200000;
  sess.samples = [...(sess.samples || []), { t: Date.now(), used }].slice(-5);
  const s = sess.samples;
  const burn = s.length >= 2 ? Math.max(0, Math.round((s[s.length - 1].used - s[0].used) / (s.length - 1))) : 0;
  sess.budget = {
    used,
    window,
    percent: Math.min(100, Math.round((used / window) * 1000) / 10),
    burn,
    src,
    confidence: src === "provider" ? "high" : "low",
    at: Date.now(),
  };
  return sess.budget;
}

/** 给定 sid 的 rollout 文件是否存在 */
export function rolloutExists(sid) {
  try {
    fs.accessSync(path.join(rolloutDir(), `model-io-${sid}.jsonl`));
    return true;
  } catch {
    return false;
  }
}
