#!/usr/bin/env node
/**
 * wudi-coding 面板组装脚本（零依赖，无需 esbuild/npm install）：
 * 1. 读取 vendor 的 ext-apps 官方 SDK 自包含产物（app-with-deps.js，零 bare import）；
 * 2. 把文件末尾的 `export { X as Y, ... };` 转换为 `const WUDI_SDK = { X: Y, ... };`；
 * 3. 与 panel/panel.js、panel/panel.css 拼成单文件自包含 panel.html（ui:// 资源无相对路径可解析，必须全内联）；
 * 4. 自检：拼接产物过 node --check；SDK 转换产物在 node 里实跑确认 App/EmptyResultSchema 存在。
 * 用法：node scripts/build-panel.mjs
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

/* ---- 1. 把末尾 export 语句转成 const 对象 ---- */
const tailRe = /\bexport\s*\{([\s\S]*?)\}\s*;\s*$/;
const m = sdk.match(tailRe);
if (!m) throw new Error("vendor SDK 末尾没有找到 export {...} 语句，文件可能已更换，请检查。");
const items = m[1]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((item) => {
    const as = item.split(/\s+as\s+/);
    // export { X as Y }：X 是模块内绑定，Y 是导出名 → 对象字面量 { Y: X }（键=导出名，值=本地绑定）
    if (as.length === 2) return `${as[1].trim()}: ${as[0]}`;
    return `${item}: ${item}`;
  });
const transformed =
  sdk.slice(0, m.index) + `const WUDI_SDK = {\n${items.join(",\n")}\n};` + sdk.slice(m.index + m[0].length);

for (const want of ["App"]) {
  if (!items.some((s) => s.startsWith(`${want}:`) || s === `${want}: ${want}`)) {
    throw new Error(`SDK 导出里没有 ${want}，panel.js 需要它。实际导出样例：${items.slice(-5).join(", ")}`);
  }
}

/* ---- 2. 组装 module 脚本 ---- */
const moduleJs = `${transformed}\n/* ══════ wudi panel (panel/panel.js) ══════ */\n${panelJs}`
  .replaceAll("</script", "<\\/script");

/* ---- 3. 自检：语法 + SDK 转换产物实跑 ---- */
const tmp = await mkdtemp(join(tmpdir(), "wudi-panel-"));
try {
  const moduleFile = join(tmp, "assembled.mjs");
  await writeFile(moduleFile, moduleJs, "utf-8");
  const check = spawnSync(process.execPath, ["--check", moduleFile], { encoding: "utf-8" });
  if (check.status !== 0) throw new Error(`拼接产物语法检查失败：\n${check.stderr}`);
  const probeFile = join(tmp, "probe.mjs");
  await writeFile(probeFile, `${transformed}\nconsole.log(JSON.stringify({ hasApp: typeof WUDI_SDK.App === "function", sdkKeys: Object.keys(WUDI_SDK).length }));`, "utf-8");
  const probe = spawnSync(process.execPath, [probeFile], { encoding: "utf-8", timeout: 15000 });
  if (probe.status !== 0 || !probe.stdout.includes('"hasApp":true')) {
    throw new Error(`SDK 转换产物自检失败：${probe.stderr || probe.stdout}`);
  }
  console.log("自检通过：", probe.stdout.trim());
} finally {
  await rm(tmp, { recursive: true, force: true });
}

/* ---- 4. 输出 panel.html ---- */
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>无敌编程工作台</title>
<style>${panelCss.replaceAll("</style", "<\\/style")}</style>
</head>
<body>
<div id="root"><div class="state">正在启动…</div></div>
<script type="module">
${moduleJs}
</script>
</body>
</html>
`;
await writeFile(outPath, html, "utf-8");
console.log(`panel.html 已生成：${outPath}（${(html.length / 1024).toFixed(0)} KB）`);
