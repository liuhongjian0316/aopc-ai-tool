#!/usr/bin/env node
/**
 * obsidian-kb 构建脚本：打包 MCP server 和 UI 面板
 * 参考 office-runtime/scripts/build.mjs，简化版（无多格式分发）
 */
import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const pluginJson = JSON.parse(
  await readFile(join(root, ".aopc-plugin", "plugin.json"), "utf8")
);

const dist = join(root, "dist");
const uiDir = join(dist, "ui");

// 清理旧的 dist
await rm(dist, { recursive: true, force: true });
await mkdir(uiDir, { recursive: true });

const define = { "process.env.NODE_ENV": '"production"' };

// ═══════════════════════════════════════════
// 1. Build MCP server (Node.js target)
// ═══════════════════════════════════════════
const server = await build({
  metafile: true,
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(dist, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
  external: ["fsevents"], // Native module, require at runtime
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
  },
});

// ═══════════════════════════════════════════
// 2. Build UI panel (browser target → IIFE)
// ═══════════════════════════════════════════
const app = await build({
  metafile: true,
  entryPoints: [join(root, "src/ui/main.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define,
  write: false,
  logOverride: { "direct-eval": "silent" },
});

// 面板经 MCP resources/read 以单个 HTML 字符串分发（ui:// 无相对路径可解析），
// 必须自包含：CSS 与 JS 全部内联，转义 </script 防止提前闭合标签。
const js = Buffer.from(app.outputFiles[0].contents)
  .toString("utf-8")
  .replaceAll("</script", "<\\/script");
const css = await readFile(join(root, "src/ui/styles.css"), "utf-8");

// Panel HTML — self-contained
const panelHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pluginJson.description_i18n["zh-CN"] || pluginJson.description}</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
await writeFile(join(uiDir, "panel.html"), panelHtml);

// ═══════════════════════════════════════════
// 3. Write metadata files
// ═══════════════════════════════════════════
const totalBytes = Object.values(server.metafile?.outputs).reduce(
  (sum, f) => sum + (f.bytes || 0),
  0
);
process.stdout.write(
  `obsidian-kb v${pkg.version}: server ${Math.round(totalBytes / 1024)} KiB, UI ${Math.round(js.length / 1024)} KiB (self-contained panel.html)\n`
);
