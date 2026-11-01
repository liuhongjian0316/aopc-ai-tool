/**
 * 面板 ↔ 宿主通信：官方 MCP Apps SDK（UI_PLUGIN.md 契约）。
 * 宿主的线协议（ui/* 握手、JSON-RPC over postMessage）由 @modelcontextprotocol/ext-apps 承担，
 * 自造 postMessage 协议宿主不认，会报 "MCP App connection is unavailable"。
 */
import { App } from "@modelcontextprotocol/ext-apps";

let appPromise: Promise<App> | null = null;

function getApp(): Promise<App> {
  if (!appPromise) {
    const app = new App({ name: "obsidian-kb", version: "0.1.2" }, {}, { autoResize: false });
    app.onhostcontextchanged = () => applyTheme(app);
    appPromise = app
      .connect()
      .then(() => {
        applyTheme(app);
        return app;
      })
      .catch((err) => {
        appPromise = null; // 允许「重新加载」后重试握手
        throw err;
      });
  }
  return appPromise;
}

/** 把宿主下发的主题同步到 <html data-theme>，styles.css 据此切换变量。 */
function applyTheme(app: App) {
  const theme = app.getHostContext()?.theme ?? "dark";
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
}

/** 调用本插件 MCP server 的工具，返回 structuredContent（或解析文本回退）。 */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const app = await getApp();
  const result = await app.callServerTool({ name, arguments: args });
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (result.isError) {
    throw new Error(text || `Tool error: ${name}`);
  }
  if (result.structuredContent !== undefined) return result.structuredContent as T;
  if (text !== undefined) {
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
  return undefined as T;
}
