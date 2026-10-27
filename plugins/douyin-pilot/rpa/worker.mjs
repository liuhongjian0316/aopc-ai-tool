/**
 * douyin-pilot RPA worker —— 创作者中心（creator.douyin.com）自动化主通道（路线B）。
 *
 * 由网关（lib/rpa-client.mjs）spawn 的长驻子进程，stdin/stdout 走换行分隔 JSON：
 *   请求 {id, cmd, args} → 响应 {id, ok, result?, error?}
 * 支持命令：status / login / publish / screenshot / close
 *
 * 设计要点：
 * - launchPersistentContext：登录态存本机 profile 目录，一次扫码长期有效
 * - 发布/登录每一步失败都存现场截图到 DOUYIN_RPA_DEBUG_DIR，便于修选择器
 * - 选择器全部带兜底链；创作者中心改版时按截图对最快定位
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const PROFILE_DIR = process.env.DOUYIN_RPA_PROFILE_DIR;
const DEBUG_DIR = process.env.DOUYIN_RPA_DEBUG_DIR || join(PROFILE_DIR ?? ".", "..", "rpa-debug");
const HEADLESS_DEFAULT = process.env.DOUYIN_RPA_HEADLESS === "true";
const CREATOR_URL = "https://creator.douyin.com/";
const UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload";

let chromium = null;
try {
  ({ chromium } = await import("playwright"));
} catch {
  /* 未安装 playwright：所有命令返回安装提示 */
}

let context = null;
let page = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.error("[rpa-worker]", ...a);

function reply(id, payload) {
  process.stdout.write(`${JSON.stringify({ id, ...payload })}\n`);
}

/** 任一步失败都落一张现场截图，错误信息里带截图路径。 */
async function withDebug(page_, fn) {
  try {
    return await fn();
  } catch (err) {
    try {
      if (page_) {
        mkdirSync(DEBUG_DIR, { recursive: true });
        const shot = join(DEBUG_DIR, `rpa-${Date.now()}.png`);
        await page_.screenshot({ path: shot, fullPage: true });
        err.message += `（现场截图：${shot}）`;
      }
    } catch {}
    throw err;
  }
}

async function ensureContext(headless) {
  if (!chromium) throw new Error("playwright 未安装：先调用 dy_rpa_setup 安装依赖");
  if (context) return { context, page };
  mkdirSync(PROFILE_DIR, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1440, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

/** 登录判定：creator 域下有 sessionid 即视为已登录。 */
async function checkLogin() {
  if (!context) return false;
  const cookies = await context.cookies(CREATOR_URL);
  return cookies.some((c) => c.name === "sessionid" || c.name === "sessionid_ss");
}

/** 无头临时探测：不惊动用户窗口也能知道登录态。 */
async function probeStatus() {
  if (context) return { loggedIn: await checkLogin(), probed: false };
  if (!chromium) throw new Error("playwright 未安装：先调用 dy_rpa_setup 安装依赖");
  mkdirSync(PROFILE_DIR, { recursive: true });
  const probeCtx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const cookies = await probeCtx.cookies(CREATOR_URL);
    return {
      loggedIn: cookies.some((c) => c.name === "sessionid" || c.name === "sessionid_ss"),
      probed: true,
    };
  } finally {
    await probeCtx.close().catch(() => {});
  }
}

/** 扫码登录：打开有头浏览器，轮询 cookie 直到登录或超时。 */
async function cmdLogin(args) {
  const timeoutSec = Number(args.timeoutSec ?? 300);
  await ensureContext(false); // 登录永远用有头窗口，用户要扫码
  if (await checkLogin()) {
    log("已有登录态，直接返回");
    return { loggedIn: true, alreadyLoggedIn: true };
  }
  await page.goto(CREATOR_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    if (await checkLogin()) return { loggedIn: true };
    await sleep(3000);
  }
  return withDebug(page, async () => {
    throw new Error(`${timeoutSec}s 内未检测到登录。请确认已在弹出的浏览器里扫码登录 creator.douyin.com`);
  });
}

/* ---------------- 发布 ---------------- */

async function fillTitleAndTags(page, title, tags) {
  const editor = page.locator('.zone-container, [contenteditable="true"]').first();
  await editor.click({ timeout: 20000 });
  await page.keyboard.type(title, { delay: 25 });

  for (const tag of tags) {
    await page.keyboard.type(`#${tag}`, { delay: 30 });
    await page.waitForTimeout(1200); // 等话题联想弹层
    const item = page
      .locator('.choose-item, .hashtag-choose-item, [class*="choose-item"], [class*="hash-tag"] li')
      .first();
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      await page.waitForTimeout(300);
    } else {
      await page.keyboard.type(" ", { delay: 10 }); // 没弹层就补空格断开，避免粘成一段
    }
  }
  // 焦点移出编辑器
  await page.keyboard.press("Escape").catch(() => {});
}

async function setSchedule(page, scheduleAt) {
  const due = new Date(scheduleAt);
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
  const timeStr = `${pad(due.getHours())}:${pad(due.getMinutes())}`;

  const toggle = page.getByText("定时发布").first();
  await toggle.click({ timeout: 10000 });
  await page.waitForTimeout(600);

  const dateInput = page.locator('input[placeholder*="日期"], .date-picker-input input, .date-picker input').first();
  await dateInput.click({ timeout: 10000 });
  await dateInput.fill(dateStr);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const timeInput = page.locator('input[placeholder*="时间"], .time-picker input').first();
  if (await timeInput.isVisible().catch(() => false)) {
    await timeInput.click();
    await timeInput.fill(timeStr);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  } else {
    log("未找到独立时间输入框，日期框可能含时间，保持已填内容");
  }
}

async function cmdPublish(args) {
  const { videoPath, title, tags = [], scheduleAt } = args;
  const headless = HEADLESS_DEFAULT;
  await ensureContext(headless);
  if (!(await checkLogin()))
    throw new Error("本地浏览器没有登录态：先执行 dy_rpa_login 扫码登录创作者中心");

  return withDebug(page, async () => {
    const t0 = Date.now();
    log("打开上传页", headless ? "(无头)" : "(有头)");
    await page.goto(UPLOAD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (/\/login/.test(page.url()))
      throw new Error("创作者中心要求重新登录，请执行 dy_rpa_login");

    log("提交视频文件");
    const fileInput = page.locator('input[type="file"]').first();
    if ((await fileInput.count()) === 0) {
      // 实测未登录/新版页面控件懒挂载：先点「上传视频」入口再等 input 出现
      const entry = page.getByText("上传视频").first();
      if (await entry.isVisible().catch(() => false)) {
        await entry.click();
        await page.waitForTimeout(1200);
      }
      await fileInput.waitFor({ state: "attached", timeout: 20000 });
    }
    await fileInput.setInputFiles(videoPath);

    // 等上传完成：发布按钮由禁用变可用（大文件最长 15 分钟）
    log("等待上传完成…");
    await page.waitForFunction(
      () => {
        const btn = [...document.querySelectorAll("button")].find(
          (b) => b.textContent.includes("发布") && !b.disabled && b.offsetParent !== null
        );
        return Boolean(btn);
      },
      { timeout: 15 * 60_000, polling: 2000 }
    );

    log("填写标题与话题");
    await fillTitleAndTags(page, title, tags);

    if (scheduleAt) {
      log("设置定时发布", scheduleAt);
      await setSchedule(page, scheduleAt);
    }

    log("点击发布");
    const publishBtn = page
      .locator('button:has-text("发布"), div.publish-btn')
      .filter({ hasNotText: "定时" })
      .last();
    await publishBtn.click({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // 部分版本会出现二次确认弹层，再点一次"发布"
    const dialogConfirm = page.locator('.semi-modal button:has-text("发布"), [role="dialog"] button:has-text("发布")').first();
    if (await dialogConfirm.isVisible().catch(() => false)) {
      log("处理二次确认弹层");
      await dialogConfirm.click();
      await page.waitForTimeout(2000);
    }

    // 成功判定：出现"发布成功"提示，或跳转到内容管理页
    const successToast = await page.getByText("发布成功").first().isVisible().catch(() => false);
    const redirected = /content\/manage|publish_success|creator-micro\/content/.test(page.url()) && !/upload/.test(page.url());
    if (!successToast && !redirected)
      throw new Error(`发布后未检测到成功信号（当前页面：${page.url()}），请人工确认是否已发出，勿重复发布`);

    const result = { ok: true, url: page.url(), tookSec: Math.round((Date.now() - t0) / 1000), scheduled: Boolean(scheduleAt) };
    log("发布完成", JSON.stringify(result));
    return result;
  });
}

/* ---------------- 主循环 ---------------- */

const HANDLERS = {
  async status(args) {
    const probe = await probeStatus();
    return { ...probe, profileDir: PROFILE_DIR, headlessDefault: HEADLESS_DEFAULT };
  },
  login: cmdLogin,
  publish: cmdPublish,
  async screenshot() {
    if (!page) throw new Error("浏览器未启动，无法截图");
    mkdirSync(DEBUG_DIR, { recursive: true });
    const shot = join(DEBUG_DIR, `manual-${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    return { path: shot };
  },
  async close() {
    if (context) {
      await context.close().catch(() => {});
      context = null;
      page = null;
    }
    return { closed: true };
  },
};

let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    const { id, cmd, args = {} } = msg;
    const handler = HANDLERS[cmd];
    if (!handler) {
      reply(id, { ok: false, error: `未知命令：${cmd}` });
      continue;
    }
    handler(args)
      .then((result) => reply(id, { ok: true, result }))
      .catch((err) => reply(id, { ok: false, error: err.message }));
  }
});
process.stdin.on("end", async () => {
  await HANDLERS.close().catch(() => {});
  process.exit(0);
});
