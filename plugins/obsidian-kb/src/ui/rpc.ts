/**
 * Minimal RPC client for communicating with the MCP server via the panel host (postMessage).
 */
let requestId = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg?.jsonrpc !== "2.0") return;
  const id = msg.id;
  if (typeof id === "number" && pending.has(id)) {
    const { resolve, reject } = pending.get(id)!;
    pending.delete(id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});

/** Send a JSON-RPC tool call to the host, which forwards it to the MCP server. */
export async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = ++requestId;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    const payload = { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
    // The AOPC panel host listens for postMessage with `aopc:mcp` envelope; fall back to raw.
    window.parent.postMessage({ type: "aopc:mcp", payload }, "*");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`RPC timeout: ${name}`));
      }
    }, 30000);
  });
}
