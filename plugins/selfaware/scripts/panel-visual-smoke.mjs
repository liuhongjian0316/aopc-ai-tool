#!/usr/bin/env node
// panel-visual-smoke.mjs —— 面板视觉冒烟:mock host SDK + 真实 panel.html + playwright 截图
// 用法: node scripts/panel-visual-smoke.mjs [out.png] [theme]
// 原理: panel.html 的 module 内部 `const { App } = GUANJI_SDK;` —— 派生 mock 版把这一行
//       指向 window.MOCK_GUANJI_SDK( canned structuredContent,覆盖全部卡片数据面),
//       无需宿主即可渲染;截图供人工/代理目检。卡片空白或 JS 报错都会在此暴露。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(tmpdir(), 'guanji-panel-mock.png');
const THEME = process.argv[3] || 'dark';

const html = readFileSync(join(root, 'panel.html'), 'utf8');
const anchor = 'const { App } = GUANJI_SDK;';
if (!html.includes(anchor)) throw new Error('panel.html 中找不到 App 解构行,构建产物可能已变。');

/* canned 数据:对齐真实使命形态(r001 待决策/v006 awaiting/已度量 3 条/能力账 2 脚本) */
const now = Date.now(), H = 3600000;
const mission = {
  active: { title: '抖音自主运营·AI开源工具种草', goal: '【纠偏定位·据96条历史数据】定位=AI编程/开源工具/Codex生态 实战种草号', autonomy: 'full', day: 10 },
  recentLog: [
    { t: now - 2 * H, kind: 'review', text: 'v005 自评:钩子给的是「画面在动」而非「事件在发生」' },
    { t: now - 4 * H, kind: 'publish', text: 'v006 我让AI在浏览器里养了一群会进化的生物,它们真的在抢饭吃' },
    { t: now - 26 * H, kind: 'note', text: 'Day 10 收工(无熔断):v006 全链路一次通过 + 能力自扩展 2 件' },
  ],
  openDifficulties: [],
  difficultyAgingDays: 0,
  pendingRequests: [{ id: 'r001', type: 'B', question: '抖音开放平台授权方式选哪种?(B 类凭据,批复一次永久解除每日数据回收障碍)', options: 'A: dy_auth_listen 授权(推荐) / B: dy_auth_url 手动换取' }],
  ideas: [{ id: 'i001', t: now - 5 * H, status: 'open', text: 'v007 候选C2(自研产品展示):「我给AI装了自我意识,它开始自己进化了」观己仪表盘实机演示' }],
  ledger: {
    awaiting: 1,
    due: [],
    selfReviewDue: [{ id: 'v006', title: '我让AI在浏览器里养了一群会进化的生物,它们真的在抢饭吃 全程真实录屏', t: now - 20 * H }],
    voided: [{ id: 'v001', reason: '误报,从未实际上传' }, { id: 'v003', reason: '同素材换壳试运行' }],
    recent: [
      { id: 'v006', status: 'awaiting', title: '我让AI在浏览器里养了一群会进化的生物…', t: now - 20 * H, hypothesis: '奇观类型素材更换复制,0s 动态首帧' },
      { id: 'v005', status: 'measured', title: '用 AI 写的代码真能跑起来吗？全程真实录屏', m: { views: 486, likes: 4, completion: 1.9 }, measuredAt: now - 30 * H, selfReviewAt: now - 2 * H },
      { id: 'v004', status: 'measured', title: '用 AI 写的代码真能跑起来吗？全程真实录屏', m: { views: 389, likes: 1, completion: 1.0 }, measuredAt: now - 3 * 24 * H },
      { id: 'v002', status: 'measured', title: '让AI一句话给浏览器写了个黑洞,运行那一刻真的帅', m: { views: 325, likes: 4, completion: 1.1 }, measuredAt: now - 7 * 24 * H },
    ],
    measuredAgg: { count: 3, avgViews: 400, best: { id: 'v005', title: '用 AI 写的代码真能跑起来吗？全程真实录屏', views: 486 }, worst: { id: 'v002', title: '让AI一句话给浏览器写了个黑洞…', views: 325 } },
  },
};
const selfState = {
  session: { sid: 'sess_visual_smoke', turns: 12, segments: 9, toolCalls: { Bash: 22, Write: 11, Read: 6, Edit: 1 }, errors: {}, streaks: {}, dispatches: 0,
    budget: { percent: 41.9, used: 83700, window: 200000, burn: 0, src: 'provider', confidence: 'high' }, trail: [{ t: now - 3600000, pct: 38 }, { t: now, pct: 41.9 }] },
  debt: 0,
  health: '五段齐,教训 2 条',
  lastDeepAt: now - 26 * H,
  playbookRules: ['发布假设以晋级线为靶阶梯逼近,不以历史相对值为靶', '本号定位 = AI编程/开源工具/Codex 生态实战种草', '钩子必须在 0-3s 给「看什么」'],
  playbookFiles: ['ops-fixes.md', 'douyin-content.md', 'autonomy-boundaries.md'],
  knowledge: { configured: true, today: 3, total: 14, recent: ['2026-11-11-深潜·抖音流量池分发机制与我号数据的对照诊断.md', '2026-11-11-设计·迪士尼十二法则在竖屏钩子里的三个可用杠杆.md', '2026-11-11-经验·模拟类demo的种群经济要在录屏前调平.md'], path: '/Users/…/知识库/AOPC/AOPC' },
  ideas: mission.ideas,
  journal: { total: 11, proposed: 0, landed: 4 },
  journalDiet: { failure_postmortem: 4, playbook_proposal: 4, user_feedback: 1, plugin_proposal: 1 },
  difficultyAgingDays: 0,
  capabilities: { tools: ['self_state', 'self_errors', 'self_usage', 'self_history', 'self_learn', 'self_recall', 'self_mission', 'self_config', 'self_journal'], skills: ['metacognition', 'self-review', 'autonomous-ops'], agents: ['critic', 'guanji'], commands: ['reflect', 'selfcheck'] },
  evolution: { modelChanges: ['[2026-11-11] 自主运营 Day10 复盘修订:新增真实录屏管线等 4 条能力,更正图像判断条目'], rulesByFile: { 'ops-fixes.md': 12, 'douyin-content.md': 11, 'autonomy-boundaries.md': 9 }, journalLanded: 4 },
  opsScripts: [
    { name: 'compose-douyin.mjs', desc: '抖音成片确定性合成:录屏底+多段口播时间轴混音', usage: 'node compose-douyin.mjs <video> <out> …', lastVerifiedAt: '2026-11-11', registered: true },
    { name: 'mcp-call.mjs', desc: '通用 MCP stdio 调用器:无挂载会话走真代码路径记账', usage: 'node mcp-call.mjs <server> <tool> <json>', lastVerifiedAt: '2026-11-11', registered: true },
    { name: 'unregistered-demo.sh', desc: '', usage: '', lastVerifiedAt: null, registered: false },
  ],
  mission,
  paths: { data: '/Users/…/.aopc/cli/plugins/data/selfaware@aopc-ai-tool', selfModel: '…/self-model.md', playbooks: '…/playbooks', journal: '…/journal.jsonl' },
};
const MOCK = {
  self_state: selfState,
  self_usage: { budget: selfState.session.budget, rolloutOffset: 0 },
  self_history: { daily: [{ date: '2026-11-05', calls: 40, errors: 2 }, { date: '2026-11-06', calls: 55, errors: 3 }, { date: '2026-11-07', calls: 61, errors: 1 }, { date: '2026-11-08', calls: 12, errors: 0 }, { date: '2026-11-09', calls: 8, errors: 0 }, { date: '2026-11-10', calls: 70, errors: 2 }, { date: '2026-11-11', calls: 88, errors: 3 }],
    sessions: [{ sid: 'sess_visual_smoke', sub: false, lastAt: now, turns: 12, calls: 40, errors: 0, lastMsg: '继续把观己插件弄的完美,并自主进化' }, { sid: 'sess_day10_ops', sub: false, lastAt: now - 26 * H, turns: 31, calls: 88, errors: 3, lastMsg: 'Day 10 收工:v006 发布 + v3.7.0 发版' }],
    totalSessions: 21, totals: { turns: 402, calls: 1607, errors: 41 } },
  self_errors: { chronic: [] },
  self_journal: { entries: [
    { id: 'j011', t: now - 3 * H, kind: 'playbook_proposal', status: 'landed', title: '抖音假设靶值改为阶梯逼近晋级线(2s跳出<20%/3s留存≥60%)', lesson: '发布假设以晋级线为靶阶梯逼近,不以历史相对值为靶' },
    { id: 'j010', t: now - 30 * H, kind: 'plugin_proposal', status: 'proposed', title: '定时任务会话未自动挂载观己 MCP server(宿主级提案)' },
  ], total: 11 },
};

const mockHtml = html.replace(
  anchor,
  `const { App } = window.MOCK_GUANJI_SDK;`
).replace(
  '</head>',
  `<script>
window.MOCK_GUANJI_SDK = {
  App: class MockApp {
    constructor(info) { this.info = info; }
    async connect() { return true; }
    getHostContext() { return { theme: ${JSON.stringify(THEME)} }; }
    async callServerTool({ name }) {
      const sc = window.MOCK_DATA[name];
      if (!sc) throw new Error('mock 未覆盖: ' + name);
      return { isError: false, content: [{ type: 'text', text: '(mock)' }], structuredContent: sc };
    }
    sendSizeChanged() {}
  }
};
window.MOCK_DATA = ${JSON.stringify(MOCK)};
</script></head>`
);
if (mockHtml === html) throw new Error('mock 注入失败(替换点均未命中)。');
const dir = mkdtempSync(join(tmpdir(), 'panel-mock-'));
const mockPath = join(dir, 'panel-mock.html');
writeFileSync(mockPath, mockHtml);

const PLAYWRIGHT = '/Users/liuhongjian/.aopc/cli/plugins/cache/aopc-ai-tool/douyin-pilot/0.2.1/rpa/node_modules/playwright/index.js';
const script = `
import pkg from '${PLAYWRIGHT}';
const { chromium } = pkg;
const errors = [];
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 880, height: 1200 } });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://${mockPath}', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.screenshot({ path: '${OUT}', fullPage: true });
await b.close();
if (errors.length) { console.error(errors.join('\\n')); process.exit(2); }
console.log('OK no page errors');
`;
execFileSync('node', ['--input-type=module', '-e', script], { stdio: 'inherit' });
console.log('✅ 截图:', OUT);
