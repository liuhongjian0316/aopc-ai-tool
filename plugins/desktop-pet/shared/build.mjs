// 构建 shared-core：把移植的 dsh-pet 纯逻辑 TS 打包成 dist/shared-core.mjs
// （主进程与渲染进程共用）。产物随仓库提交，安装插件无需构建环境。
// esbuild 优先取 AOPC 仓库 node_modules，其次本机全局。
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const aopcEsbuild = join(here, "..", "..", "..", "..", "AOPC", "node_modules", "esbuild");
const require = createRequire(import.meta.url);
const esbuild = existsSync(aopcEsbuild) ? require(aopcEsbuild) : await import("esbuild");

// Electron 33（Node 20）主进程 require() 不能加载 ESM → 输出 CJS；
// 渲染端 <script type=module> 需要 ESM。两个产物都随仓库提交。
await esbuild.build({
  entryPoints: [join(here, "index.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: join(here, "dist", "shared-core.cjs"),
  logLevel: "warning",
});
await esbuild.build({
  entryPoints: [join(here, "index.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(here, "dist", "shared-core.mjs"),
  logLevel: "warning",
});
console.log("[shared] built dist/shared-core.mjs");
