import {
  fontManager,
  collectGraphFontRequirements,
  missingGraphFontScripts,
} from "@open-pencil/core/text";
import type { SceneGraph } from "@open-pencil/scene-graph";

/**
 * 字体策略：沙箱不允许联网取字体（CSP），所以关掉上游的在线字体提供商；
 * 内置 Inter / Noto Naskh Arabic 经 assets.ts 的 fetch 拦截提供；其余字体走上游的本地替代逻辑。
 */
/**
 * wudi 增补：沙箱内无法联网取字体（CSP），宿主也不提供系统字体；随面板资源内置的
 * Noto Sans SC（OFL）注册为 CJK fallback —— 中文等字形离线可用，不再缺字/不渲染。
 * 资源字节经 ui/assets.ts 的 fetch 拦截从 MCP readResource 获取。
 */
export async function configureBundledCjkFont(family = "Noto Sans SC") {
  try {
    const res = await fetch("/NotoSansSC-Regular.otf");
    if (!res.ok) return;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 1024) return;
    (fontManager as unknown as {
      registerAndCache: (f: string, s: string, b: ArrayBuffer) => unknown;
    }).registerAndCache(family, "Regular", bytes);
    (fontManager as unknown as { setCJKFallbackFamily: (f: string) => void }).setCJKFallbackFamily(family);
  } catch {
    /* 字体缺失时保持上游行为（CJK 可能缺字） */
  }
}

export function configureFonts() {
  fontManager.setOnlineFontProviders({});
  fontManager.setWebFontFetch(null);
  if (typeof navigator !== "undefined") fontManager.setFallbackUserAgent(navigator.userAgent);
}
export async function loadFont(family: string, style = "Regular", characters = "") {
  return fontManager.loadFont(family, style, characters);
}
interface FontRenderInvalidator {
  invalidateAllPictures(): void;
}
/** 移植自上游 app（v0.14.0）：Agent 改完节点后确保字体就绪并清掉文本缓存图。 */
export async function ensureGraphFonts(
  graph: SceneGraph,
  nodeIds: string[],
  renderer?: FontRenderInvalidator | null,
): Promise<boolean> {
  fontManager.blockNodesUntilFontsResolve(nodeIds);
  try {
    const generationBefore = fontManager.generation();
    const fontKeys = fontManager.collectFontKeys(graph, nodeIds);
    const requirements = collectGraphFontRequirements(graph, nodeIds);
    const { characters } = requirements;
    await Promise.all(fontKeys.map(([family, style]) => loadFont(family, style, characters)));
    const fallbackScripts = missingGraphFontScripts(requirements);
    if (fallbackScripts.length > 0) {
      const fallbacks = await fontManager
        .ensureFallbackPack(fallbackScripts, characters)
        .catch(() => ({}));
      if (Object.values(fallbacks).some((families) => (families as string[]).length > 0))
        clearTextPictures(graph, nodeIds);
    } else if (fontManager.generation() !== generationBefore) {
      clearTextPictures(graph, nodeIds);
    }
    return fontManager.generation() !== generationBefore || fallbackScripts.length > 0;
  } finally {
    fontManager.unblockNodes(nodeIds);
    renderer?.invalidateAllPictures();
  }
}
function clearTextPictures(graph: SceneGraph, nodeIds: string[]): void {
  const clear = (id: string) => {
    const node = graph.getNode(id);
    if (!node) return;
    if (node.type === "TEXT") (node as { textPicture?: unknown }).textPicture = null;
    for (const childId of node.childIds) clear(childId);
  };
  for (const id of nodeIds) clear(id);
}
