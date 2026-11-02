/**
 * aopc-bridge.js - AOPC 插件运行壳本地 HTTP 桥
 *
 * MCP 薄代理（mcp-server/server.mjs）与红果短剧运行壳之间的通信层：
 *   - 仅监听 127.0.0.1，随机端口 + 随机 token（请求头 x-aopc-hongguo-token）
 *   - 监听成功后向 stdout 打印 `AOPC_HONGGUO_READY port=<p> token=<t>` 握手行
 *   - POST /ipc/<channel>：把 HTTP 调用派发到 main.js 已注册的 IPC handler（白名单内）
 *   - POST /show、/hide：显示/隐藏主窗口（无头启动后的唤出入口）
 *   - POST /quit：优雅退出（走 before-quit 的暂停/清理编排）
 *
 * 只用 Node 标准库，无第三方依赖。
 */
'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// 把运行壳的端口/token 写进插件数据目录，供 MCP 薄代理做单实例握手。
// 由运行壳自己写（而非代理）：无论运行壳被谁拉起，代理都能发现它。
function writeRuntimeStateFile(state) {
  const dataDir = process.env.AOPC_PLUGIN_DATA;
  if (!dataDir) return;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'runtime.json'), JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('[AOPC-Bridge] 写 runtime.json 失败:', error.message);
  }
}

function startAopcBridge({ app, version, registry, allowed, ensureWindow, hideWindow }) {
  const token = crypto.randomBytes(24).toString('hex');

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
      'cache-control': 'no-store',
    });
    res.end(body);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error('请求体超过 2MB 上限'));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (error) { reject(new Error('请求体不是合法 JSON')); }
      });
      req.on('error', reject);
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      // 鉴权：所有端点都要求 token 匹配，防本地其它进程探测调用
      if (req.headers['x-aopc-hongguo-token'] !== token) {
        return sendJson(res, 401, { error: 'token 无效' });
      }
      const url = new URL(req.url, `http://127.0.0.1:${server.address().port}`);
      const pathname = url.pathname;

      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { ok: true, pid: process.pid });
      }
      if (req.method === 'GET' && pathname === '/version') {
        return sendJson(res, 200, {
          version: version,
          aopcRuntime: true,
          pluginVersion: process.env.AOPC_HONGGUO_PLUGIN_VERSION || '',
        });
      }
      if (req.method === 'POST' && pathname === '/show') {
        await readBody(req);
        const win = ensureWindow?.();
        if (!win || win.isDestroyed()) throw new Error('主窗口不可用');
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
        return sendJson(res, 200, { success: true });
      }
      if (req.method === 'POST' && pathname === '/hide') {
        await readBody(req);
        hideWindow?.();
        return sendJson(res, 200, { success: true });
      }
      if (req.method === 'POST' && pathname === '/quit') {
        sendJson(res, 200, { ok: true });
        // 先回包再退出，让代理端拿到确认
        setTimeout(() => { try { app.quit(); } catch (_) {} }, 120);
        return undefined;
      }
      if (req.method === 'POST' && pathname.startsWith('/ipc/')) {
        const channel = decodeURIComponent(pathname.slice('/ipc/'.length));
        if (!allowed || !allowed.has(channel)) {
          return sendJson(res, 403, { error: `通道不在白名单内: ${channel}` });
        }
        const handler = registry && registry.get(channel);
        if (!handler) {
          return sendJson(res, 404, { error: `通道未注册: ${channel}` });
        }
        const body = await readBody(req);
        const args = Array.isArray(body?.args) ? body.args : [];
        // 直接调用原始 handler（event 传 null）：白名单通道都不读 event.sender；
        // 个别读了也会抛错并被这里兜住，不会影响运行壳。
        const result = await handler(null, ...args);
        return sendJson(res, 200, { ok: true, result: result === undefined ? null : result });
      }

      return sendJson(res, 404, { error: `未知端点: ${req.method} ${pathname}` });
    } catch (error) {
      return sendJson(res, 500, { error: String((error && error.message) || error) });
    }
  });

  server.on('error', (error) => {
    console.error('[AOPC-Bridge] 启动失败:', error.message);
  });

  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    // 握手行：MCP 薄代理从运行壳 stdout 匹配这一行
    console.log(`AOPC_HONGGUO_READY port=${port} token=${token}`);
    // 单实例握手状态：MCP 薄代理重启后凭它复用本运行壳
    writeRuntimeStateFile({
      apiPort: port,
      apiToken: token,
      pid: process.pid,
      pluginVersion: process.env.AOPC_HONGGUO_PLUGIN_VERSION || '',
      startedAt: new Date().toISOString(),
    });
  });

  return server;
}

module.exports = { startAopcBridge };
