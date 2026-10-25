// 从本地 dsh-pet 仓库/Release 解包目录导入 webm 动画素材 → packs/dsh/
// 用法：node scripts/sync-dsh-pack.mjs <dsh-pet/assets 目录>
// 注意：素材版权归 dsh-pet 仓库所有（禁止商用、二创须附原仓库链接），仅限个人本地使用，勿提交回本仓库。
import { cpSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src || !existsSync(src)) {
  console.error("用法: node scripts/sync-dsh-pack.mjs <dsh-pet/assets 目录>");
  process.exit(1);
}
const webmSrc = join(src, "webm");
if (!existsSync(webmSrc)) {
  console.error(`未找到 ${webmSrc}`);
  process.exit(1);
}
const pluginRoot = join(import.meta.dirname, "..");
const dest = join(pluginRoot, "packs", "dsh", "webm");
mkdirSync(dest, { recursive: true });
cpSync(webmSrc, dest, { recursive: true });

const names = readdirSync(dest).filter((f) => f.endsWith(".webm")).map((f) => f.replace(/\.webm$/, ""));
const config = {
  // dsh 素材的动作名即文件名；这里声明一个宽松的动作池，宿主渲染端按名加载对应 webm
  animations: {
    idle: [names.includes("待机") ? "待机" : names[0]],
    turn: ["转身"],
    drag: names.filter((n) => n.includes("拖") || n.includes("抓")),
    clicks: names.filter((n) => n.includes("点") || n.includes("弹")),
    moves: { default: { minDist: 60, maxDist: 240, duration: 3 }, actions: names.filter((n) => n.includes("走") || n.includes("溜达") || n.includes("跑")).map((name) => ({ name })) },
    categories: [{ id: "随机动作", weight: 80, actions: names.slice(0, 40) }],
    events: {
      workStatus: [
        names.filter((n) => n.includes("思考")),
        names.filter((n) => n.includes("工作") || n.includes("敲")),
        names.filter((n) => n.includes("整理")),
        names.filter((n) => n.includes("等待") || n.includes("打盹")),
        names.filter((n) => n.includes("成功") || n.includes("庆祝")),
        names.filter((n) => n.includes("出错") || n.includes("晕")),
      ].map((pool, i) => (pool.length ? pool : [[["待机"]][0]])),
      whisper: [["说话"]],
      balance: [names.filter((n) => n.startsWith("余额"))],
    },
  },
  whisperPhrases: [],
};
// 空池兜底：任何一档抽不到都回落"待机"
for (let i = 0; i < config.animations.events.workStatus.length; i++) {
  if (config.animations.events.workStatus[i].length === 0) config.animations.events.workStatus[i] = ["待机"];
}
if (config.animations.events.balance[0].length === 0) config.animations.events.balance[0] = ["待机"];
if (config.animations.drag.length === 0) config.animations.drag = ["待机"];
if (config.animations.clicks.length === 0) config.animations.clicks = ["点击弹跳"];
if (config.animations.moves.actions.length === 0) config.animations.moves.actions = [{ name: "溜达" }];
if (!names.includes("转身")) config.animations.turn = [];

writeFileSync(join(pluginRoot, "packs", "dsh-config.json"), `${JSON.stringify(config, null, 2)}\n`);
console.log(`已导入 ${names.length} 个动画 → packs/dsh/webm/`);
console.log('使用：把宠物条目的 "pack" 改为 "dsh"，重载配置生效。');
