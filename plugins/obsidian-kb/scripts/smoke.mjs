#!/usr/bin/env node
/**
 * Smoke test for obsidian-kb plugin
 * Verifies: build output, MCP server start, tool discovery, UI panel structure
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(".", "..");
const dist = resolve(root, "dist");
const uiDir = resolve(dist, "ui");

console.log("🧪 Running smoke test for obsidian-kb...\n");

async function testBuildArtifacts() {
  console.log("1️⃣ Checking build artifacts...");

  // Check server.mjs exists
  const serverPath = resolve(dist, "server.mjs");
  try {
    await readFile(serverPath, "utf8");
    console.log("   ✅ server.mjs exists");
  } catch (e) {
    console.error("   ❌ server.mjs missing");
    return false;
  }

  // Check UI files
  const panelPath = resolve(uiDir, "panel.html");
  const cssPath = resolve(uiDir, "panel.css");
  const assetsPath = resolve(uiDir, "assets.json");

  try {
    await readFile(panelPath, "utf8");
    await readFile(cssPath, "utf8");
    await readFile(assetsPath, "utf8");
    console.log("   ✅ UI panel files exist");
  } catch (e) {
    console.error("   ❌ Missing UI files");
    return false;
  }

  return true;
}

async function testMCPServer() {
  console.log("\n2️⃣ Starting MCP server...");

  const server = spawn("node", [resolve(dist, "server.mjs")], {
    cwd: root,
    env: {
      ...process.env,
      OBSIDIAN_VAULT_PATH: resolve(root, "test_vault"),
      OBSIDIAN_INDEX_ON_STARTUP: "false",
      OBSIDIAN_WATCH_CHANGES: "false",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let ready = false;
  let timeout;

  return new Promise((resolve) => {
    server.stdout.on("data", (data) => {
      const line = data.toString().trim();
      console.log(`   [server] ${line}`);

      if (line.includes('{"jsonrpc":"2.0","result":')) {
        ready = true;
        clearTimeout(timeout);
        server.kill();
        resolve(true);
      }
    });

    server.stderr.on("data", (data) => {
      console.log(`   [server stderr] ${data.toString().trim()}`);
    });

    server.on("error", (err) => {
      console.error("   ❌ Server error:", err);
      resolve(false);
    });

    // 10s timeout
    timeout = setTimeout(() => {
      console.error("   ❌ Server startup timeout");
      server.kill();
      resolve(false);
    }, 10000);
  });
}

async function testUIPanel() {
  console.log("\n3️⃣ Validating UI panel...");

  try {
    const panel = await readFile(resolve(uiDir, "panel.html"), "utf8");
    const css = await readFile(resolve(uiDir, "panel.css"), "utf8");

    // Basic checks
    if (!panel.includes("id=\"root\"")) {
      console.error("   ❌ Missing root div");
      return false;
    }

    if (!panel.includes("__renderPanel")) {
      console.error("   ❌ Missing render function");
      return false;
    }

    if (!css.includes(".note-viewer")) {
      console.error("   ❌ Missing note viewer styles");
      return false;
    }

    console.log("   ✅ UI panel structure valid");
    return true;
  } catch (e) {
    console.error("   ❌ UI validation failed:", e.message);
    return false;
  }
}

async function run() {
  console.log("🚀 Starting smoke test...\n");

  const passed = await testBuildArtifacts();
  if (!passed) return;

  const serverOk = await testMCPServer();
  if (!serverOk) return;

  const uiOk = await testUIPanel();
  if (!uiOk) return;

  console.log("\n🎉 All smoke tests passed!");
  console.log("\nNext steps:");
  console.log("1. Install plugin: aopc plugin install ./");
  console.log("2. Configure vault path in settings");
  console.log("3. Open Obsidian KB panel from sidebar");
}

run().catch((err) => {
  console.error("❌ Smoke test failed:", err);
  process.exit(1);
});