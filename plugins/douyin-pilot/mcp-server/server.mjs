/**
 * douyin-pilot —— AOPC 插件 MCP stdio server（最小实现：initialize / tools/list / tools/call）。
 * 零依赖，Node 24 全局 fetch。工具逻辑在 lib/tools.mjs，API 封装在 lib/douyin-api.mjs。
 */
import { TOOLS, callTool } from "../lib/tools.mjs";

const SERVER_INFO = { name: "douyin-pilot", version: "0.1.0" };

function send(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function sendError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) handleMessage(line);
  }
});
process.stdin.on("end", () => process.exit(0));

function handleMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  if (method === "initialize") {
    send(id, {
      protocolVersion: params?.protocolVersion ?? "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }
  if (method?.startsWith("notifications/")) return;
  if (method === "tools/list") {
    send(id, { tools: TOOLS });
    return;
  }
  if (method === "tools/call") {
    callTool(params?.name ?? "", params?.arguments ?? {}).then((result) => send(id, result));
    return;
  }
  if (method === "ping") {
    send(id, {});
    return;
  }
  sendError(id, -32601, `方法未实现：${method}`);
}
