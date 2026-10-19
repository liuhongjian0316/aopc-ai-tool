#!/usr/bin/env node
/**
 * boot-animation MCP server（stdio，零依赖 raw JSON-RPC 实现）。
 *
 * 工具：
 *   set_boot_animation { source }  把本地 mp4/webm/gif/html 复制为启动画面
 *   clear_boot_animation {}        移除启动画面（回落默认 logo 壳）
 *   get_status {}                  查看当前启动画面状态
 *
 * 资源约定与 AOPC 桌面本体一致：<插件根>/boot-animation/boot.<ext>，
 * 重启 AOPC 后生效。绝不打印文件内容，只返回路径与结果信息。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";

const PLUGIN_ROOT = process.env.AOPC_PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd();
const ANIMATION_DIR = join(PLUGIN_ROOT, "boot-animation");
const ALLOWED_EXTENSIONS = new Set([".mp4", ".webm", ".gif", ".html"]);
const MAX_SOURCE_BYTES = 200 * 1024 * 1024;

function textResult(text) {
  return { content: [{ type: "text", text }], isError: false };
}

function errorResult(text) {
  return { content: [{ type: "text", text }], isError: true };
}

function listAnimationFiles() {
  if (!existsSync(ANIMATION_DIR)) return [];
  return readdirSync(ANIMATION_DIR).filter((name) =>
    ALLOWED_EXTENSIONS.has(extname(name).toLowerCase()),
  );
}

function toolSetBootAnimation(args) {
  const source = typeof args?.source === "string" ? args.source.trim() : "";
  if (!source) return errorResult("缺少 source：请提供视频/HTML 文件的绝对路径。");
  const sourcePath = isAbsolute(source) ? source : resolve(process.cwd(), source);
  if (!existsSync(sourcePath)) return errorResult(`文件不存在：${sourcePath}`);
  const ext = extname(sourcePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return errorResult(`不支持的扩展名 ${ext}；只允许 ${[...ALLOWED_EXTENSIONS].join(" / ")}。`);
  }
  const size = statSync(sourcePath).size;
  if (size > MAX_SOURCE_BYTES) {
    return errorResult(`文件过大（${Math.round(size / 1024 / 1024)}MB > 200MB 上限）。`);
  }
  mkdirSync(ANIMATION_DIR, { recursive: true });
  // 先清掉其他变体，保证本体解析优先级唯一命中新资源
  for (const name of listAnimationFiles()) {
    rmSync(join(ANIMATION_DIR, name), { force: true });
  }
  const target = join(ANIMATION_DIR, `boot${ext}`);
  copyFileSync(sourcePath, target);
  return textResult(
    `✓ 启动画面已设置：${basename(sourcePath)} → ${target}\n` +
      "重启 AOPC 后生效；启动时全屏播放，点击/按键可跳过。",
  );
}

function toolClearBootAnimation() {
  const removed = listAnimationFiles();
  for (const name of removed) {
    rmSync(join(ANIMATION_DIR, name), { force: true });
  }
  return textResult(
    removed.length > 0
      ? `✓ 已移除启动画面（${removed.join(", ")}）；重启 AOPC 后回落默认启动壳。`
      : "当前没有设置启动画面。",
  );
}

function toolGetStatus() {
  const files = listAnimationFiles();
  if (files.length === 0) {
    return textResult("当前未设置启动画面（回落默认 logo 启动壳）。");
  }
  const lines = files.map((name) => {
    const stat = statSync(join(ANIMATION_DIR, name));
    return `- ${name}（${Math.round(stat.size / 1024)}KB）`;
  });
  return textResult(`当前启动画面资源：\n${lines.join("\n")}\n重启 AOPC 后生效。`);
}

const TOOLS = [
  {
    name: "set_boot_animation",
    description:
      "把本地视频（mp4/webm/gif）或 HTML 文件设置为 AOPC 启动动画。source 为文件绝对路径；重启 AOPC 后生效。",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", description: "动画文件绝对路径（.mp4/.webm/.gif/.html）" },
      },
      required: ["source"],
    },
  },
  {
    name: "clear_boot_animation",
    description: "移除 AOPC 启动动画，回落默认启动 logo。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_status",
    description: "查看当前 AOPC 启动动画的设置状态。",
    inputSchema: { type: "object", properties: {} },
  },
];

function dispatchTool(name, args) {
  switch (name) {
    case "set_boot_animation":
      return toolSetBootAnimation(args);
    case "clear_boot_animation":
      return toolClearBootAnimation();
    case "get_status":
      return toolGetStatus();
    default:
      return errorResult(`未知工具：${name}`);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;
    handleMessage(line);
  }
});
process.stdin.on("end", () => process.exit(0));

function handleMessage(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message?.id === undefined) return; // 通知（initialized 等）不回包
  let result;
  try {
    switch (message.method) {
      case "initialize":
        result = {
          protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "boot-animation", version: "0.1.0" },
        };
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call": {
        const name = message.params?.name;
        const args = message.params?.arguments ?? {};
        result = dispatchTool(name, args);
        break;
      }
      default:
        result = { error: { code: -32601, message: `未知方法：${message.method}` } };
    }
  } catch (error) {
    result = { error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
  }
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result })}\n`);
}
