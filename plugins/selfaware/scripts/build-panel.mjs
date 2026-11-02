#!/usr/bin/env node
/**
 * 观己面板组装脚本(零依赖,模式照搬 wudi-coding/scripts/build-panel.mjs):
 * 1. 读取 vendor 的 ext-apps 官方 SDK 自包含产物(app-with-deps.js,零 bare import);
 * 2. 把末尾 `export { X as Y, ... };` 转换为 `const GUANJI_SDK = { Y: X, ... };`;
 * 3. 与 panel/panel.js、panel/panel.css 拼成单文件自包含 panel.html(ui:// 资源无相对路径,必须全内联);
 * 4. 自检:拼接产物过 node --check,并实跑确认 App 存在。
 * 用法:node scripts/build-panel.mjs
 */
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sdkPath = join(root, "panel", "vendor", "ext-apps-app-with-deps.js");
const panelJsPath = join(root, "panel", "panel.js");
const panelCssPath = join(root, "panel", "panel.css");
const outPath = join(root, "panel.html");

const sdk = await readFile(sdkPath, "utf-8");
const panelJs = await readFile(panelJsPath, "utf-8");
const panelCss = await readFile(panelCssPath, "utf-8");

/* ---- 1. 末尾 export 语句转 const 对象 ---- */
const tailRe = /\bexport\s*\{([\s\S]*?)\}\s*;\s*$/;
const m = sdk.match(tailRe);
if (!m) throw new Error("vendor SDK 末尾没有 export {...},文件可能已更换。");
const items = m[1]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((item) => {
    const as = item.split(/\s+as\s+/);
    if (as.length === 2) return `${as[1].trim()}: ${as[0]}`;
    return `${item}: ${item}`;
  });
const transformed =
  sdk.slice(0, m.index) + `const GUANJI_SDK = {\n${items.join(",\n")}\n};` + sdk.slice(m.index + m[0].length);

if (!items.some((s) => s.startsWith("App:") || s === "App: App")) {
  throw new Error(`SDK 导出里没有 App。实际导出样例:${items.slice(-5).join(", ")}`);
}

/* ---- 2. 组装 ---- */
const moduleJs = `${transformed}\n/* ══════ 观己 panel (panel/panel.js) ══════ */\n${panelJs}`;
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>观己 · 自我仪表盘</title>
<style>${panelCss}</style>
</head>
<body>
<div id="root"><div class="loading">正在连接观己…</div></div>
<script type="module">${moduleJs}</script>
</body>
</html>
`;

/* ---- 3. 自检 ---- */
const tmp = await mkdtemp(join(tmpdir(), "guanjipanel-"));
const modPath = join(tmp, "panel.check.mjs");
await writeFile(modPath, moduleJs);
const chk = spawnSync("node", ["--check", modPath], { encoding: "utf8" });
if (chk.status !== 0) throw new Error(`拼接产物语法检查失败:\n${chk.stderr}`);
const run = spawnSync("node", ["-e", `globalThis.document={documentElement:{dataset:{}}};import("${modPath.replace(/\\/g, "/")}")`], {
  encoding: "utf8",
  timeout: 15000,
});
// 实跑只要求不抛 ReferenceError(App 未定义之类);DOM 缺失的报错在预期内不算失败
if (/ReferenceError: (App|GUANJI_SDK) is not defined/.test(run.stderr || "")) {
  throw new Error(`SDK 绑定失败:${run.stderr.slice(0, 300)}`);
}
await rm(tmp, { recursive: true, force: true });

await writeFile(outPath, html);
console.log(`panel.html 已生成:${outPath}(${Math.round(html.length / 1024)} KB)`);
