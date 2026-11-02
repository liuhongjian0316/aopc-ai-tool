#!/usr/bin/env node
/**
 * sync-upstream.mjs - 从上游 jackotom/hongguo-drama 克隆同步运行壳
 *
 * 用法:
 *   node scripts/sync-upstream.mjs --source /path/to/hongguo-drama [--skip-react-build]
 *
 * 流程（全部在 .sync-staging 完成，校验通过才落盘，失败不影响现有 runtime）:
 *   1. 复制当前 runtime → staging（保留 aopc-bridge.js / node_modules axios stub）
 *   2. 用上游文件覆盖 main.js / preload.js / src/{store.js,native}（剔除 licenses）/ dist-react
 *   3. 逐条回放 AOPC 补丁（锚点 find/replace；锚点找不到即报错中止，提示人工比对）
 *   4. node --check 语法校验 + [AOPC] 标记完整性检查
 *   5. 重建 vendor/axios.cjs（esbuild 打包上游 axios，含全部子依赖）
 *   6. 原子换名落盘，打印后续人工清单
 *
 * 升级上游版本后：补丁锚点若失配，先 git diff 旧 runtime 与新上游的对应代码段，
 * 更新本文件 PATCHES 里的 find/replace，再重跑。
 */
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = join(PLUGIN_ROOT, "runtime");

// ---------------------------------------------------------------- 参数
const args = process.argv.slice(2);
function argOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const SOURCE = resolve(argOf("--source") || "");
const SKIP_REACT_BUILD = args.includes("--skip-react-build");
if (!SOURCE || !existsSync(join(SOURCE, "package.json"))) {
  console.error("用法: node scripts/sync-upstream.mjs --source <hongguo-drama 克隆路径> [--skip-react-build]");
  process.exit(1);
}
const upstreamPkg = JSON.parse(readFileSync(join(SOURCE, "package.json"), "utf-8"));

// ---------------------------------------------------------------- AOPC 补丁定义
// 每条 = 在上游文件上的精确 find/replace。上游重构导致锚点失配时脚本会明确报错。
const PATCHES = [
  {
    id: "01-user-data-dir",
    desc: "数据目录跟随 AOPC_PLUGIN_DATA（单实例锁随之隔离，可与正式版并存）",
    find: "const hasSingleInstanceLock = app.requestSingleInstanceLock();",
    replace: `// [AOPC] 插件运行壳：数据目录跟随 AOPC 插件数据目录（AOPC_PLUGIN_DATA），与独立安装版完全隔离，
// 单实例锁也因此作用在独立目录上，可与用户自装的正式版红果短剧并存。
const AOPC_RUNTIME = !!process.env.AOPC_HONGGUO_RUNTIME;
if (AOPC_RUNTIME && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(
    process.env.AOPC_PLUGIN_DATA || path.join(app.getPath('appData'), 'hongguo-aopc-runtime'), 'app-data'));
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();`,
  },
  {
    id: "02-ipc-registry-deny-log",
    desc: "IPC handler 登记（HTTP 桥白名单派发）+ 拒绝诊断日志",
    find: `const ipcMain = {
  handle(channel, handler) {
    rawIpcMain.handle(channel, async (event, ...args) => {
      if (!rendererSecurity.isTrustedSender(event, mainWindow)) throw new Error('窗口请求无效');`,
    replace: `// [AOPC] HTTP 桥：记录所有 IPC handler，供 aopc-bridge 通过本地回环 HTTP 调用（仅白名单通道）。
// 白名单只收录不依赖 event.sender 的查询/任务通道；直接调用原始 handler，跳过渲染器来源校验。
const aopcIpcRegistry = new Map();
const AOPC_ALLOWED_IPC_CHANNELS = new Set([
  'hongguo-resolve', 'hongguo-download-batch', 'download-single-episode',
  'search-series', 'search-series-more', 'search-resolve', 'find-series-sequels',
  'get-series-list', 'get-download-tasks', 'get-queue-status', 'get-settings',
  'get-merge-tasks', 'get-ffmpeg-status', 'get-storage-usage', 'get-watch-history',
  'get-app-info', 'get-account-status',
  'pause-all', 'resume-all', 'stop-download', 'retry-task', 'retry-tasks',
  'delete-task', 'delete-tasks',
]);
const ipcMain = {
  handle(channel, handler) {
    if (AOPC_RUNTIME) aopcIpcRegistry.set(channel, handler); // [AOPC]
    rawIpcMain.handle(channel, async (event, ...args) => {
      if (!rendererSecurity.isTrustedSender(event, mainWindow)) {
        // [AOPC] 诊断：记录拒绝原因，便于排查插件运行壳的 IPC 来源问题
        if (AOPC_RUNTIME) {
          const frameUrl = (() => { try { return String(event?.senderFrame?.url || '').slice(0, 120); } catch (_) { return '(frame异常)'; } })();
          const expectUrl = (() => { try { return String(mainWindow?.webContents?.mainFrame?.url || '').slice(0, 120); } catch (_) { return '(mainFrame异常)'; } })();
          console.error('[AOPC-IPC-DENY]', channel, JSON.stringify({
            hasWin: !!mainWindow, winDestroyed: mainWindow?.isDestroyed?.() ?? null,
            senderMatch: mainWindow ? event?.sender === mainWindow.webContents : null,
            frameMatch: mainWindow && mainWindow.webContents ? event?.senderFrame === mainWindow.webContents.mainFrame : null,
            frameUrl, expectUrl,
          }));
        }
        throw new Error('窗口请求无效');
      }`,
  },
  {
    id: "03-download-dir-default",
    desc: "默认下载目录：userConfig / AOPC_PLUGIN_DATA",
    find: "    root: IS_PREVIEW ? path.join(app.getPath('userData'), 'downloads') : app.getPath('downloads'),",
    replace: `    // [AOPC] 插件运行壳默认下载目录：优先 AOPC_HONGGUO_DOWNLOAD_DIR（userConfig），否则落在插件数据目录
    root: AOPC_RUNTIME
      ? (String(process.env.AOPC_HONGGUO_DOWNLOAD_DIR || '').trim() || path.join(process.env.AOPC_PLUGIN_DATA || app.getPath('downloads'), 'downloads'))
      : (IS_PREVIEW ? path.join(app.getPath('userData'), 'downloads') : app.getPath('downloads')),`,
  },
  {
    id: "04-disable-update-check",
    desc: "禁用应用内更新检查（更新走插件市场）",
    find: "  if (IS_PREVIEW || !mainWindow || event.sender !== mainWindow.webContents) return { enabled: false, release: null };",
    replace: "  if (IS_PREVIEW || AOPC_RUNTIME || !mainWindow || event.sender !== mainWindow.webContents) return { enabled: false, release: null };",
  },
  {
    id: "05-headless-window",
    desc: "无头启动：窗口先隐藏，等 /show 再显示",
    find: `    autoHideMenuBar: true,
    backgroundColor: '#f5f6fa',`,
    replace: `    autoHideMenuBar: true,
    backgroundColor: '#f5f6fa',
    // [AOPC] 无头模式：由 MCP 代理在后台拉起时先不显示窗口，等 /show 或用户激活再显示
    ...(process.env.AOPC_HONGGUO_HEADLESS === '1' ? { show: false } : {}),`,
  },
  {
    id: "06-bridge-start",
    desc: "whenReady 早期启动 aopc-bridge（READY 握手）",
    find: "    setDeviceIdentityFile(path.join(app.getPath('userData'), 'danmaku-client.json'));",
    replace: `    setDeviceIdentityFile(path.join(app.getPath('userData'), 'danmaku-client.json'));
    // [AOPC] 启动本地回环 HTTP 桥并打印 READY 握手行（MCP 薄代理据此接管）。
    // 尽早启动：握手不等代理初始化与窗口创建，避免启动慢导致代理端超时。
    if (AOPC_RUNTIME) {
      require('./aopc-bridge').startAopcBridge({
        app,
        version: APP_VERSION,
        registry: aopcIpcRegistry,
        allowed: AOPC_ALLOWED_IPC_CHANNELS,
        ensureWindow: () => { if (!mainWindow || mainWindow.isDestroyed()) createWindow(); return mainWindow; },
        hideWindow: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide(); },
      });
    }`,
  },
  {
    id: "07-startup-createwindow-guard",
    desc: "启动 createWindow 守卫（防 /show 竞态双窗口 →「窗口请求无效」）",
    find: `    startupStage = '创建主窗口';
    createWindow();`,
    replace: `    startupStage = '创建主窗口';
    // [AOPC] 桥的 /show 可能在代理初始化期间提前建窗（READY 早于本行触发）。
    // 这里只在还没有主窗口时才创建，否则会静默生成第二个窗口并顶掉 mainWindow，
    // 导致先显示的窗口 sender 不匹配、所有 IPC 报「窗口请求无效」。
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();`,
  },
  {
    id: "08-keep-running-on-close",
    desc: "关窗后台续下（退出走 HTTP /quit）",
    find: `app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});`,
    replace: `app.on('window-all-closed', () => {
  // [AOPC] 插件运行壳：关窗后继续在后台跑下载队列，彻底退出走 HTTP /quit
  if (AOPC_RUNTIME) return;
  if (process.platform !== 'darwin') app.quit();
});`,
  },
];

// ---------------------------------------------------------------- 工具
function sh(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, { stdio: ["ignore", "pipe", "pipe"], ...opts }).toString();
}
function fail(msg) {
  console.error(`\n✗ ${msg}`);
  console.error("  已中止，现有 runtime 未被改动。");
  process.exit(1);
}

// ---------------------------------------------------------------- staging
const staging = join(PLUGIN_ROOT, ".sync-staging");
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

console.log(`[1/6] 复制当前 runtime → staging（保留 aopc-bridge.js / node_modules axios stub）`);
cpSync(RUNTIME, staging, { recursive: true });

console.log(`[2/6] 覆盖上游文件（hongguo-drama ${upstreamPkg.version}）`);
for (const f of ["main.js", "preload.js"]) {
  cpSync(join(SOURCE, f), join(staging, f));
}
rmSync(join(staging, "src"), { recursive: true, force: true });
mkdirSync(join(staging, "src"), { recursive: true });
cpSync(join(SOURCE, "src", "store.js"), join(staging, "src", "store.js"));
cpSync(join(SOURCE, "src", "native"), join(staging, "src", "native"), { recursive: true });
rmSync(join(staging, "src", "native", "licenses"), { recursive: true, force: true });
rmSync(join(staging, "dist-react"), { recursive: true, force: true });
if (SKIP_REACT_BUILD) {
  if (!existsSync(join(SOURCE, "dist-react", "index.html"))) {
    fail("上游没有 dist-react 构建产物；去掉 --skip-react-build 让脚本代跑 npm run build:react");
  }
  cpSync(join(SOURCE, "dist-react"), join(staging, "dist-react"), { recursive: true });
} else {
  console.log("      上游构建 React 前端（npm run build:react）…");
  execFileSync("npm", ["run", "build:react"], { cwd: SOURCE, stdio: "inherit" });
  cpSync(join(SOURCE, "dist-react"), join(staging, "dist-react"), { recursive: true });
}

console.log(`[3/6] 回放 AOPC 补丁（${PATCHES.length} 条）`);
const mainPath = join(staging, "main.js");
let mainSrc = readFileSync(mainPath, "utf-8");
for (const patch of PATCHES) {
  if (!mainSrc.includes(patch.find)) {
    fail(`补丁 ${patch.id} 锚点失配（上游该处代码已变化）。\n  期望锚点: ${patch.find.split("\n")[0].slice(0, 100)}…\n  请人工比对上游 main.js 对应位置，更新 scripts/sync-upstream.mjs 中该补丁的 find/replace。`);
  }
  mainSrc = mainSrc.replace(patch.find, patch.replace);
  console.log(`      ✓ ${patch.id} - ${patch.desc}`);
}
writeFileSync(mainPath, mainSrc);

console.log(`[4/6] 校验`);
for (const f of ["main.js", "preload.js", "aopc-bridge.js"]) {
  execFileSync(process.execPath, ["--check", join(staging, f)]);
}
for (const marker of ["AOPC_RUNTIME", "aopcIpcRegistry", "startAopcBridge", "AOPC-IPC-DENY"]) {
  if (!mainSrc.includes(marker)) fail(`校验失败：main.js 缺少标记 ${marker}`);
}
if (!mainSrc.includes("if (!mainWindow || mainWindow.isDestroyed()) createWindow();")) {
  fail("校验失败：启动 createWindow 守卫缺失");
}
console.log("      ✓ 语法与 [AOPC] 标记完整");

console.log(`[5/6] 重建 vendor/axios.cjs`);
const axiosEntry = join(SOURCE, "node_modules", "axios", "dist", "node", "axios.cjs");
if (!existsSync(axiosEntry)) {
  fail("上游 node_modules 里没有 axios（先在上游目录 npm install）");
}
const esbuildCandidates = [
  join(SOURCE, "node_modules", ".bin", "esbuild"),
  join(PLUGIN_ROOT, "node_modules", ".bin", "esbuild"),
];
const esbuildBin = esbuildCandidates.find((c) => existsSync(c));
if (!esbuildBin) fail("找不到 esbuild（上游与插件目录都未安装）");
sh(esbuildBin, [axiosEntry, "--bundle", "--platform=node", "--format=cjs", "--legal-comments=none", `--outfile=${join(staging, "vendor", "axios.cjs")}`]);
{
  const probe = sh(process.execPath, ["-e", `const a=require(${JSON.stringify(join(staging, "vendor", "axios.cjs"))}); if (typeof a.get !== 'function' || typeof a.VERSION !== 'string') process.exit(2);`]);
  console.log("      ✓ axios vendor 可用");
}

console.log(`[6/6] 落盘`);
const runtimePkg = JSON.parse(readFileSync(join(staging, "package.json"), "utf-8"));
const currentBase = (runtimePkg.version || "").split("-aopc.")[0];
const currentN = Number((runtimePkg.version || "").split("-aopc.")[1] || "0");
const nextVersion = currentBase === upstreamPkg.version
  ? `${upstreamPkg.version}-aopc.${currentN || 1}`
  : `${upstreamPkg.version}-aopc.1`;
runtimePkg.version = nextVersion;
runtimePkg.description = `红果短剧 AOPC 插件运行壳（vendor 自 jackotom/hongguo-drama ${upstreamPkg.version}，GPL-3.0）`;
writeFileSync(join(staging, "package.json"), `${JSON.stringify(runtimePkg, null, 2)}\n`);
const backup = join(PLUGIN_ROOT, ".sync-backup");
rmSync(backup, { recursive: true, force: true });
renameSync(RUNTIME, backup);
renameSync(staging, RUNTIME);
rmSync(backup, { recursive: true, force: true });

console.log(`
✓ 同步完成：上游 ${upstreamPkg.version} → runtime（版本 ${nextVersion}）

后续人工清单：
  1. 上游若新增/删除了 src 模块，检查 git status 并同步 NOTICE.md 改动清单
  2. 确认补丁语义仍成立后，提升 .aopc-plugin/plugin.json 版本并更新 marketplace changelog
  3. 冒烟验证：
     node --check runtime/main.js
     echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | AOPC_PLUGIN_DATA=/tmp/hg-smoke node mcp-server/server.mjs
     aopc plugins update hongguo-drama && 重启 AOPC 实测「打开窗口」
`);
