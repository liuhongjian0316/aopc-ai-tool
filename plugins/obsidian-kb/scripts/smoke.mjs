#!/usr/bin/env node
/**
 * Smoke test for obsidian-kb plugin
 * Verifies: build output, MCP server (initialize/tools/resources), self-contained UI panel
 */
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const uiDir = resolve(dist, "ui");
const PANEL_URI = "ui://obsidian/panel.html";

console.log("🧪 Running smoke test for obsidian-kb...\n");

async function testBuildArtifacts() {
  console.log("1️⃣ Checking build artifacts...");

  const serverPath = resolve(dist, "server.mjs");
  try {
    await readFile(serverPath, "utf8");
    console.log("   ✅ server.mjs exists");
  } catch (e) {
    console.error("   ❌ server.mjs missing");
    return false;
  }

  try {
    const panel = await readFile(resolve(uiDir, "panel.html"), "utf8");
    console.log(`   ✅ panel.html exists (${Math.round(panel.length / 1024)} KiB)`);
  } catch (e) {
    console.error("   ❌ panel.html missing");
    return false;
  }

  return true;
}

/** 发送一条 JSON-RPC，等待匹配 id 的响应行（跨 chunk 缓冲半行）。 */
function rpc(server, id, method, params, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), timeoutMs);
    let buffer = "";
    const onData = (data) => {
      buffer += data.toString();
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === id) {
          clearTimeout(timer);
          server.stdout.off("data", onData);
          resolve(msg);
          return;
        }
      }
    };
    server.stdout.on("data", onData);
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

async function testMCPServer() {
  console.log("\n2️⃣ Starting MCP server...");

  const vault = await mkdtemp(resolve(tmpdir(), "obsidian-kb-smoke-"));
  const server = spawn("node", [resolve(dist, "server.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      OBSIDIAN_VAULT_PATH: vault,
      OBSIDIAN_INDEX_ON_STARTUP: "false",
      OBSIDIAN_WATCH_CHANGES: "false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  server.stderr.on("data", (data) => {
    console.log(`   [server stderr] ${data.toString().trim()}`);
  });

  try {
    const init = await rpc(server, 1, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    });
    const caps = init.result?.capabilities ?? {};
    if (!caps.tools || !caps.resources) {
      console.error("   ❌ initialize missing tools/resources capabilities:", JSON.stringify(caps));
      return false;
    }
    console.log("   ✅ initialize: tools + resources capabilities declared");

    const tools = await rpc(server, 2, "tools/list", {});
    const names = (tools.result?.tools ?? []).map((t) => t.name);
    if (names.length < 11) {
      console.error(`   ❌ tools/list returned ${names.length} tools`);
      return false;
    }
    console.log(`   ✅ tools/list: ${names.length} tools`);

    const res = await rpc(server, 3, "resources/read", { uri: PANEL_URI });
    const item = res.result?.contents?.[0];
    if (!item || item.uri !== PANEL_URI || !item.text?.includes("id=\"root\"")) {
      console.error("   ❌ resources/read returned unexpected payload:", line2(res));
      return false;
    }
    if (!String(item.mimeType || "").includes("text/html")) {
      console.error(`   ❌ unexpected mimeType: ${item.mimeType}`);
      return false;
    }
    console.log(`   ✅ resources/read: ${PANEL_URI} → ${Math.round(item.text.length / 1024)} KiB html`);
    return true;
  } catch (err) {
    console.error("   ❌ MCP smoke failed:", err.message);
    return false;
  } finally {
    server.kill();
    await rm(vault, { recursive: true, force: true });
  }

  function line2(res) {
    return JSON.stringify(res).slice(0, 200);
  }
}

async function testUIPanel() {
  console.log("\n3️⃣ Validating self-contained UI panel...");

  const panel = await readFile(resolve(uiDir, "panel.html"), "utf8");

  if (!panel.includes("<style>")) {
    console.error("   ❌ Missing inlined stylesheet");
    return false;
  }
  if (!panel.includes("<script>")) {
    console.error("   ❌ Missing inlined script");
    return false;
  }
  // 自包含断言：不允许任何外部相对引用（ui:// 下无法解析）
  if (/<(?:script|link)[^>]*\ssrc|<link[^>]*\shref=/.test(panel)) {
    console.error("   ❌ Panel references external files (must be self-contained)");
    return false;
  }
  if (!panel.includes(".note-viewer")) {
    console.error("   ❌ Missing note viewer styles");
    return false;
  }

  console.log("   ✅ UI panel is self-contained (style + script inlined)");
  return true;
}

async function run() {
  console.log("🚀 Starting smoke test...\n");

  if (!(await testBuildArtifacts())) return finish(1);
  if (!(await testMCPServer())) return finish(1);
  if (!(await testUIPanel())) return finish(1);

  console.log("\n🎉 All smoke tests passed!");
  console.log("\nNext steps:");
  console.log("1. Commit + push, then update the plugin in AOPC");
  console.log("2. Configure vault path in plugin settings");
  console.log("3. Open Obsidian KB panel from sidebar");
  finish(0);
}

function finish(code) {
  process.exit(code);
}

run().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});
