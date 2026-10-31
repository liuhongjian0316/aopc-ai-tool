/**
 * Canvas Parser - Parses Obsidian Canvas files (.canvas JSON format)
 * Canvas spec: https://json.canvas/ (nodes, edges, groups)
 */
export interface CanvasNode {
  id: string;
  type: "file" | "link" | "group" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  text?: string;
  file?: string;
  url?: string;
  style?: Record<string, unknown>;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
  label?: string;
  color?: string;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasNode[];
}

export function parseCanvas(content: string): CanvasData {
  const parsed = JSON.parse(content);

  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const groups: CanvasNode[] = [];

  for (const item of parsed.nodes || []) {
    if (item.type === "group") {
      groups.push(item as CanvasNode);
    } else {
      nodes.push(item as CanvasNode);
    }
  }

  for (const item of parsed.edges || []) {
    edges.push(item as CanvasEdge);
  }

  return { nodes, edges, groups };
}

export function canvasToMermaid(canvas: CanvasData): string {
  const lines: string[] = ["graph TD"];

  // Add node definitions
  for (const node of canvas.nodes) {
    const label = node.text || node.file || node.url || node.id;
    lines.push(`  ${sanitizeId(node.id)}["${escapeQuotes(label)}"]`);
  }

  // Add edges
  for (const edge of canvas.edges) {
    const label = edge.label ? `|${edge.label}|` : "";
    lines.push(`  ${sanitizeId(edge.fromNode)} -->${label} ${sanitizeId(edge.toNode)}`);
  }

  return lines.join("\n");
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escapeQuotes(str: string): string {
  return str.replace(/"/g, "#quot;").replace(/\n/g, " ");
}
