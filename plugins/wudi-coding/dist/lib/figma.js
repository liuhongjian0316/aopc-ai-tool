// src/figma.ts
var API = "https://api.figma.com/v1";
function figmaToken() {
  return (process.env.WUDI_FIGMA_TOKEN || "").trim();
}
function parseFigmaRef(input) {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("\u7F3A\u5C11 fileKey \u6216 Figma \u94FE\u63A5\u3002");
  const urlMatch = s.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (urlMatch) {
    const nodeMatch = s.match(/node-id=([\d-]+)/);
    return {
      fileKey: urlMatch[1],
      nodeId: nodeMatch ? nodeMatch[1].replace("-", ":") : ""
    };
  }
  const bare = s.match(/^([A-Za-z0-9]+)(?:[\s:]+([\d]+:[\d]+))?$/);
  if (bare) return { fileKey: bare[1], nodeId: bare[2] ?? "" };
  throw new Error(`\u65E0\u6CD5\u8BC6\u522B\u7684 Figma \u5F15\u7528\uFF1A${s.slice(0, 100)}\uFF08\u652F\u6301 https://www.figma.com/(file|design)/<key>?node-id=<id> \u94FE\u63A5\u6216\u88F8 fileKey\uFF09`);
}
async function figmaGet(path) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Figma-Token": token },
    signal: AbortSignal.timeout(3e4)
  });
  if (res.status === 403) throw new Error("Figma \u62D2\u7EDD\u8BBF\u95EE\uFF08403\uFF09\uFF1Atoken \u65E0\u6548\u6216\u65E0\u8BE5\u6587\u4EF6\u6743\u9650\u3002");
  if (res.status === 404) throw new Error("Figma \u6587\u4EF6/\u8282\u70B9\u4E0D\u5B58\u5728\uFF08404\uFF09\uFF1A\u68C0\u67E5 fileKey \u4E0E nodeId\u3002");
  if (res.status === 429) throw new Error("Figma \u9650\u6D41\uFF08429\uFF09\uFF1A\u7A0D\u540E\u518D\u8BD5\u3002");
  if (!res.ok) throw new Error(`Figma API ${res.status}\uFF1A${(await res.text()).slice(0, 300)}`);
  return res.json();
}
async function fetchFigmaImages({ fileKey, nodeIds, scale = 2 }) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}/images/${encodeURIComponent(fileKey)}`, {
    method: "POST",
    headers: { "X-Figma-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: nodeIds.join(","), format: "png", scale }),
    signal: AbortSignal.timeout(3e4)
  });
  if (res.status === 403) throw new Error("Figma \u62D2\u7EDD\u8BBF\u95EE\uFF08403\uFF09\uFF1Atoken \u65E0\u6548\u6216\u65E0\u8BE5\u6587\u4EF6\u6743\u9650\u3002");
  if (res.status === 404) throw new Error("Figma \u6587\u4EF6\u4E0D\u5B58\u5728\uFF08404\uFF09\uFF1A\u68C0\u67E5 fileKey\u3002");
  if (res.status === 429) throw new Error("Figma \u9650\u6D41\uFF08429\uFF09\uFF1A\u7A0D\u540E\u518D\u8BD5\u3002");
  if (!res.ok) throw new Error(`Figma API ${res.status}\uFF1A${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.err) throw new Error(`Figma \u6E32\u67D3\u5931\u8D25\uFF1A${data.err}`);
  return data.images ?? {};
}
function extractStyles(tree, { maxNodes = 2e3 } = {}) {
  const colors = /* @__PURE__ */ new Map();
  const fontSizes = /* @__PURE__ */ new Map();
  let visited = 0;
  const walk = (node) => {
    if (!node || visited >= maxNodes) return;
    visited++;
    if (Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.visible === false || f.type !== "SOLID" || !f.color) continue;
        const hex = toHex(f.color);
        if (hex) colors.set(hex, (colors.get(hex) ?? 0) + 1);
      }
    }
    if (node.type === "TEXT") {
      const size = node.style?.fontSizePx ?? node.fontSize;
      if (size) {
        const key = String(Number(size));
        fontSizes.set(key, (fontSizes.get(key) ?? 0) + 1);
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return {
    colors: [...colors.entries()].sort((a, b) => b[1] - a[1]).map(([hex, count]) => ({ hex, count })),
    fontSizes: [...fontSizes.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([size, count]) => ({ size: Number(size), count })),
    visited
  };
}
function toHex(c) {
  if (!c) return null;
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex;
}
function distill(node, depth, maxDepth, budget) {
  if (!node || budget.count <= 0 || depth > maxDepth) return null;
  budget.count--;
  const box = node.absoluteBoundingBox ?? {};
  const out = {
    name: node.name,
    type: node.type,
    w: box.width != null ? Math.round(box.width) : void 0,
    h: box.height != null ? Math.round(box.height) : void 0
  };
  if (node.fills?.length) {
    const paints = node.fills.filter((f) => f.visible !== false && f.type === "SOLID").slice(0, 3);
    if (paints.length) out.fill = toHex(paints[0].color);
  }
  if (node.type === "TEXT") {
    out.text = node.characters?.slice(0, 200);
    const seg = node.style ?? {};
    if (seg.fontSizePx) out.fontSize = seg.fontSizePx;
    if (seg.fontWeight) out.fontWeight = seg.fontWeight;
    if (seg.fontFamily) out.fontFamily = seg.fontFamily;
    if (seg.lineHeightPx) out.lineHeight = Math.round(seg.lineHeightPx);
  }
  if (node.cornerRadius) out.radius = node.cornerRadius;
  if (node.effects?.some((e) => e.type === "DROP_SHADOW" && e.visible !== false)) out.shadow = true;
  if (node.layoutMode) {
    out.flex = `${node.layoutMode === "HORIZONTAL" ? "row" : "column"}`;
    if (node.itemSpacing) out.gap = node.itemSpacing;
    if (node.paddingLeft || node.paddingTop) {
      out.padding = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => v ?? 0);
    }
  }
  const kids = node.children ?? [];
  if (kids.length && depth < maxDepth) {
    const children = kids.slice(0, 40).map((k) => distill(k, depth + 1, maxDepth, budget)).filter(Boolean);
    if (children.length) out.children = children;
  } else if (kids.length) {
    out.childrenTruncated = kids.length;
  }
  return out;
}
async function fetchFigmaStructure({ fileKey, nodeId, maxDepth = 6, budgetMax = 400 }) {
  const budget = { count: budgetMax };
  if (nodeId) {
    const data2 = await figmaGet(`/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}&depth=${Math.min(maxDepth + 1, 8)}`);
    const nodes = data2.nodes ?? {};
    const entry = Object.values(nodes)[0];
    if (!entry) throw new Error(`\u672A\u627E\u5230\u8282\u70B9 ${nodeId}\u3002`);
    return {
      fileKey,
      nodeId,
      name: data2.name,
      lastModified: data2.lastModified,
      tree: distill(entry.document, 0, maxDepth, budget)
    };
  }
  const data = await figmaGet(`/files/${encodeURIComponent(fileKey)}?depth=${Math.min(maxDepth + 1, 8)}`);
  const doc = data.document;
  const pages = (doc?.children ?? []).slice(0, 8);
  return {
    fileKey,
    name: data.name,
    lastModified: data.lastModified,
    pages: pages.map((p) => ({
      name: p.name,
      id: p.id,
      tree: distill(p, 0, maxDepth, budget)
    }))
  };
}
export {
  extractStyles,
  fetchFigmaImages,
  fetchFigmaStructure,
  figmaToken,
  parseFigmaRef
};
