#!/usr/bin/env node
/**
 * wudi-coding 构建脚本（对齐官方 openpencil 工程形态：src/ → esbuild → dist/）：
 * 1. esbuild 打包 src/server.ts → dist/server.mjs（node ESM 单文件，部署时零依赖运行）；
 * 2. 组装工作台面板：ui/vendor 的 ext-apps 官方 SDK（自包含产物）+ ui/panel.js + ui/panel.css
 *    → dist/ui/panel.html（ui:// 资源无相对路径可解析，必须全内联）；
 * 3. 自检：dist/server.mjs 过 node --check；面板拼接产物过 node --check；
 *    SDK 转换产物在 node 里实跑确认 App 存在。
 * 用法：npm run build（或 node scripts/build.mjs）
 */
import { build } from "esbuild";
import { readFile, writeFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await mkdir(join(dist, "ui"), { recursive: true });

/* ---- 1. 服务端：src/server.ts → dist/server.mjs ---- */
await build({
  entryPoints: [join(root, "src", "server.ts")],
  outfile: join(dist, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
  logLevel: "warning",
  banner: { js: "/* wudi-coding server —— src/ 的构建产物，勿手改（npm run build） */" },
});

/* 1b. 纯函数模块（notify/figma/store）单独打包到 dist/lib，供 smoke 单测导入 */
await build({
  entryPoints: [join(root, "src", "notify.ts"), join(root, "src", "figma.ts"), join(root, "src", "store.ts")],
  outdir: join(dist, "lib"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  packages: "external",
  logLevel: "warning",
});

/* ---- 2. 面板：SDK 转换 + panel.js/panel.css 内联 ---- */
const sdkPath = join(root, "ui", "vendor", "ext-apps-app-with-deps.js");
const panelJsPath = join(root, "ui", "panel.js");
const panelCssPath = join(root, "ui", "panel.css");
const outPath = join(dist, "ui", "panel.html");

const sdk = await readFile(sdkPath, "utf-8");
const panelJs = await readFile(panelJsPath, "utf-8");
const panelCss = await readFile(panelCssPath, "utf-8");

/* 把末尾 `export { X as Y, ... };` 转成 `const WUDI_SDK = { Y: X, ... };` */
const tailRe = /\bexport\s*\{([\s\S]*?)\}\s*;\s*$/;
const m = sdk.match(tailRe);
if (!m) throw new Error("ui/vendor SDK 末尾没有找到 export {...} 语句，文件可能已更换，请检查。");
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

const moduleJs = `${transformed}\n/* ══════ wudi panel (ui/panel.js) ══════ */\n${panelJs}`
  .replaceAll("</script", "<\\/script");

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

/* ---- 3. 自检：全部产物过 node --check / SDK 探针 ---- */
const tmp = await mkdtemp(join(tmpdir(), "wudi-build-"));
try {
  const checkServer = spawnSync(process.execPath, ["--check", join(dist, "server.mjs")], { encoding: "utf-8" });
  if (checkServer.status !== 0) throw new Error(`dist/server.mjs 语法检查失败：\n${checkServer.stderr}`);

  const moduleFile = join(tmp, "assembled.mjs");
  await writeFile(moduleFile, moduleJs, "utf-8");
  const checkPanel = spawnSync(process.execPath, ["--check", moduleFile], { encoding: "utf-8" });
  if (checkPanel.status !== 0) throw new Error(`面板拼接产物语法检查失败：\n${checkPanel.stderr}`);

  /* 面板交互门禁：标记里出现的按钮 id 必须有对应绑定（曾有清理误删按钮处理器的回归） */
  const idRefs = [...panelJs.matchAll(/getElementById\("(btn-[\w-]+)"\)/g)].map((m) => m[1]);
  const missing = [...new Set(idRefs)].filter((id) => !panelJs.includes(`id="${id}"`));
  if (missing.length) throw new Error(`绑定引用了不存在的按钮 id：${missing.join(", ")}`);
  const markupIds = [...panelJs.matchAll(/id="(btn-[\w-]+)"/g)].map((m) => m[1]);
  const unbound = [...new Set(markupIds)].filter((id) => !panelJs.includes(`getElementById("${id}")`));
  if (unbound.length) throw new Error(`按钮缺少事件绑定：${unbound.join(", ")}`);

  /* prelude 语法门禁：OP_PRELUDE 模板字符串运行时的输出必须是合法 JS（曾因 \/ 被吞成 / 导致整段不执行） */
  const preludeSrc = panelJs.match(/const OP_PRELUDE = `([\s\S]*?)`;/);
  if (preludeSrc) {
    if (preludeSrc[1].includes("${")) throw new Error("OP_PRELUDE 含模板插值，构建脚本无法静态内联检查");
    const preludeHtml = Function("return `" + preludeSrc[1] + "`")();
    const preludeJs = preludeHtml.replace(/^<script>/, "").replace(/<\/script>$/, "");
    const preludeFile = join(tmp, "prelude.js");
    await writeFile(preludeFile, preludeJs, "utf-8");
    const checkPrelude = spawnSync(process.execPath, ["--check", preludeFile], { encoding: "utf-8" });
    if (checkPrelude.status !== 0) throw new Error(`OP_PRELUDE 语法检查失败（srcdoc 注入脚本）：\n${checkPrelude.stderr}`);
  }

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

const serverKB = (Buffer.byteLength(await readFile(join(dist, "server.mjs"))) / 1024).toFixed(0);
console.log(`dist/server.mjs 已生成（${serverKB} KB）`);
console.log(`dist/ui/panel.html 已生成（${(html.length / 1024).toFixed(0)} KB）`);
