/**
 * Figma REST 只读接入（M4，可选能力）：拉取文件/节点，提炼布局、颜色、字号、文本为 Agent 可用的结构。
 * 需要 WUDI_FIGMA_TOKEN（插件 userConfig figmaToken → env 注入）；未配置时由工具层返回启用指引。
 * 零依赖，Node 24 全局 fetch。只读 API，不做任何写操作。
 */

const API = "https://api.figma.com/v1";

export function figmaToken() {
  return (process.env.WUDI_FIGMA_TOKEN || "").trim();
}

/** 从 Figma URL 或裸 key 提取 { fileKey, nodeId }。支持 /file/:key、/design/:key/、node-id=123-456 形式。 */
export function parseFigmaRef(input) {
  const s = String(input ?? "").trim();
  if (!s) throw new Error("缺少 fileKey 或 Figma 链接。");
  const urlMatch = s.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (urlMatch) {
    // node-id 单独匹配（避免被查询串的其他参数/贪婪匹配吞掉）
    const nodeMatch = s.match(/node-id=([\d-]+)/);
    return {
      fileKey: urlMatch[1],
      nodeId: nodeMatch ? nodeMatch[1].replace("-", ":") : "",
    };
  }
  // 裸 fileKey（也容忍 fileKey:nodeId 空格分隔）
  const bare = s.match(/^([A-Za-z0-9]+)(?:[\s:]+([\d]+:[\d]+))?$/);
  if (bare) return { fileKey: bare[1], nodeId: bare[2] ?? "" };
  throw new Error(`无法识别的 Figma 引用：${s.slice(0, 100)}（支持 https://www.figma.com/(file|design)/<key>?node-id=<id> 链接或裸 fileKey）`);
}

async function figmaGet(path) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}${path}`, {
    headers: { "X-Figma-Token": token },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 403) throw new Error("Figma 拒绝访问（403）：token 无效或无该文件权限。");
  if (res.status === 404) throw new Error("Figma 文件/节点不存在（404）：检查 fileKey 与 nodeId。");
  if (res.status === 429) throw new Error("Figma 限流（429）：稍后再试。");
  if (!res.ok) throw new Error(`Figma API ${res.status}：${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** 把节点渲染为 PNG：POST /v1/images/:key，返回 {nodeId: url|null} 映射（URL 30 天有效）。 */
export async function fetchFigmaImages({ fileKey, nodeIds, scale = 2 }) {
  const token = figmaToken();
  if (!token) throw new Error("FIGMA_TOKEN_MISSING");
  const res = await fetch(`${API}/images/${encodeURIComponent(fileKey)}`, {
    method: "POST",
    headers: { "X-Figma-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ ids: nodeIds.join(","), format: "png", scale }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 403) throw new Error("Figma 拒绝访问（403）：token 无效或无该文件权限。");
  if (res.status === 404) throw new Error("Figma 文件不存在（404）：检查 fileKey。");
  if (res.status === 429) throw new Error("Figma 限流（429）：稍后再试。");
  if (!res.ok) throw new Error(`Figma API ${res.status}：${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (data.err) throw new Error(`Figma 渲染失败：${data.err}`);
  return data.images ?? {};
}

/** 从提炼树/原始树递归收集样式：颜色 hex 集合与字号集合（tokens 比对用）。 */
export function extractStyles(tree, { maxNodes = 2000 } = {}) {
  const colors = new Map(); // hex → 出现次数
  const fontSizes = new Map();
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
    visited,
  };
}

/* ---- 提炼：把 Figma 节点树压缩为转码友好的摘要 ---- */

/** RGBA(0-1) → #rrggbb(+aa)。 */
function toHex(c) {
  if (!c) return null;
  const r = Math.round((c.r ?? 0) * 255);
  const g = Math.round((c.g ?? 0) * 255);
  const b = Math.round((c.b ?? 0) * 255);
  const a = c.a ?? 1;
  const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  return a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : hex;
}

const LAYOUT_TYPES = new Set(["FRAME", "GROUP", "COMPONENT", "INSTANCE", "SECTION"]);

/** 递归提炼节点树（限深限宽）。 */
function distill(node, depth, maxDepth, budget) {
  if (!node || budget.count <= 0 || depth > maxDepth) return null;
  budget.count--;
  const box = node.absoluteBoundingBox ?? {};
  const out = {
    name: node.name,
    type: node.type,
    w: box.width != null ? Math.round(box.width) : undefined,
    h: box.height != null ? Math.round(box.height) : undefined,
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
    const children = kids
      .slice(0, 40)
      .map((k) => distill(k, depth + 1, maxDepth, budget))
      .filter(Boolean);
    if (children.length) out.children = children;
  } else if (kids.length) {
    out.childrenTruncated = kids.length;
  }
  return out;
}

/** 拉取文件或指定节点并提炼。maxDepth 控制树深，budget 控制总节点数（防超大文件撑爆回复）。 */
export async function fetchFigmaStructure({ fileKey, nodeId, maxDepth = 6, budgetMax = 400 }) {
  const budget = { count: budgetMax };
  if (nodeId) {
    const data = await figmaGet(`/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(nodeId)}&depth=${Math.min(maxDepth + 1, 8)}`);
    const nodes = data.nodes ?? {};
    const entry = Object.values(nodes)[0];
    if (!entry) throw new Error(`未找到节点 ${nodeId}。`);
    return {
      fileKey,
      nodeId,
      name: data.name,
      lastModified: data.lastModified,
      tree: distill(entry.document, 0, maxDepth, budget),
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
      tree: distill(p, 0, maxDepth, budget),
    })),
  };
}
