#!/usr/bin/env node
/**
 * hongguo-drama 面板构建：src/ui/panel.js + styles.css → dist/ui/panel.html（自包含单文件）
 * 面板经 MCP resources/read 以单个 HTML 字符串分发（ui:// 无相对路径可解析），
 * CSS 与 JS 必须全部内联，转义 </script 防止提前闭合标签。
 */
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const dist = join(root, "dist", "ui");
await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const app = await build({
  entryPoints: [join(root, "src/ui/panel.js")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  write: false,
});

const js = Buffer.from(app.outputFiles[0].contents)
  .toString("utf-8")
  .replaceAll("</script", "<\\/script");
const css = await readFile(join(root, "src/ui/styles.css"), "utf-8");

const panelHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>红果短剧</title>
<style>${css}</style>
</head>
<body>
<div id="boot">正在连接红果短剧…</div>
<header>
  <div class="logo">红</div>
  <h1>红果短剧</h1>
  <div class="shell-state"><span class="dot off" id="shell-dot"></span><span id="shell-label">未运行</span></div>
  <button class="btn" id="btn-open" data-action="open">打开窗口</button>
  <button class="btn" id="btn-pause" data-action="pause">暂停</button>
  <button class="btn" id="btn-resume" data-action="resume">恢复</button>
  <button class="btn" id="btn-quit" data-action="quit">退出</button>
</header>
<div id="error" hidden><span></span><button class="btn small" data-action="reload-error">重试</button></div>
<main>
  <section>
    <div class="sec-head"><h2>下载任务</h2><span class="sub" id="queue-summary"></span></div>
    <div id="tasks"></div>
  </section>
  <section>
    <div class="sec-head"><h2>我的剧库</h2><button class="btn small" data-action="load-library">刷新</button></div>
    <div id="library" class="library"></div>
  </section>
</main>
<script>${js}</script>
<script>
  // 面板渲染完成后撤掉启动占位
  requestAnimationFrame(() => setTimeout(() => document.querySelector("#boot").classList.add("hidden"), 150));
</script>
</body>
</html>`;

await writeFile(join(dist, "panel.html"), panelHtml);
process.stdout.write(`hongguo-drama UI built: dist/ui/panel.html (${Math.round(panelHtml.length / 1024)} KiB)\n`);
