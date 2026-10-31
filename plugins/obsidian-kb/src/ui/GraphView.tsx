/**
 * GraphView - renders the bidirectional link graph (SVG-based)
 */
import React, { useState, useEffect } from "react";
import { rpc } from "./rpc.js";

interface GraphNode {
  id: string;
  label: string;
  tags: string[];
  linkCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: "link" | "embed";
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Props {
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const W = 900;
const H = 640;

export function GraphView({ selectedPath, onSelect }: Props) {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc<Graph>("get_graph", { maxNodes: 300 })
      .then(setGraph)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Simple force-like layout: circular with jitter, deterministic by node id hash
  const positions = layoutGraph(graph);

  if (loading) return React.createElement("div", { className: "note-empty" }, "加载图谱...");
  if (error) return React.createElement("div", { className: "note-empty error" }, error);
  if (!graph || graph.nodes.length === 0) {
    return React.createElement("div", { className: "note-empty" }, "暂无链接数据");
  }

  return React.createElement("div", { className: "graph-view" },
    React.createElement("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      graph.edges.map((e, i) => {
        const s = positions.get(e.source);
        const t = positions.get(e.target);
        if (!s || !t) return null;
        return React.createElement("line", {
          key: i, x1: s.x, y1: s.y, x2: t.x, y2: t.y,
          stroke: e.type === "embed" ? "#94a3b8" : "#cbd5e1",
          strokeWidth: 1.5,
          strokeDasharray: e.type === "embed" ? "4 2" : undefined
        });
      }),
      graph.nodes.map((n) => {
        const p = positions.get(n.id);
        if (!p) return null;
        const isActive = selectedPath === n.id;
        const r = Math.min(4 + Math.sqrt(n.linkCount) * 2, 16);
        return React.createElement("g", {
          key: n.id, transform: `translate(${p.x},${p.y})`,
          onClick: () => onSelect(n.id),
          style: { cursor: "pointer" }
        },
          React.createElement("circle", {
            r, fill: isActive ? "#f59e0b" : "#6366f1", stroke: "#1e1b4b", strokeWidth: 1.5
          }),
          r > 8 && React.createElement("text", {
            y: -r - 4, textAnchor: "middle", fontSize: 10, fill: "#475569"
          }, n.label.slice(0, 16))
        );
      })
    )
  );
}

function layoutGraph(graph: Graph | null): Map<string, { x: number; y: number }> {
  const map = new Map<string, { x: number; y: number }>();
  if (!graph) return map;

  const cx = W / 2, cy = H / 2;
  // Place heavily-linked nodes near center via golden-angle spiral
  const sorted = [...graph.nodes].sort((a, b) => b.linkCount - a.linkCount);
  const phi = (1 + Math.sqrt(5)) / 2;
  sorted.forEach((n, i) => {
    const r = 30 + Math.sqrt(i + 1) * (Math.min(5, 540 / Math.sqrt(sorted.length)));
    const theta = (i * 2 * Math.PI) / phi;
    map.set(n.id, { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  });

  return map;
}
