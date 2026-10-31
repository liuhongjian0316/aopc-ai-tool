/**
 * FileTree - browses the vault folder structure
 */
import React, { useState, useEffect } from "react";
import { rpc } from "./rpc.js";

interface FileEntry {
  path: string;
  name: string;
  type: "folder" | "note";
  children?: FileEntry[];
}

interface Props {
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileTree({ selectedPath, onSelect }: Props) {
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rpc<{ files: FileEntry[] }>("list_files")
      .then((r) => setTree(r.files))
      .catch((e) => setError(e.message));
  }, []);

  const toggleFolder = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  };

  const renderNode = (entry: FileEntry, depth: number): React.ReactNode => {
    const pad = depth * 12;

    if (entry.type === "folder") {
      const isOpen = expanded.has(entry.path);
      return React.createElement("div", { key: entry.path },
        React.createElement("div", {
          className: "tree-folder",
          style: { paddingLeft: `${pad}px` },
          onClick: () => toggleFolder(entry.path)
        }, `${isOpen ? "▾" : "▸"} 📁 ${entry.name}`),
        isOpen && (entry.children || []).map((c) => renderNode(c, depth + 1))
      );
    }

    return React.createElement("div", {
      key: entry.path,
      className: `tree-note ${selectedPath === entry.path ? "active" : ""}`,
      style: { paddingLeft: `${pad}px` },
      onClick: () => onSelect(entry.path)
    }, `📄 ${entry.name}`);
  };

  if (error) return React.createElement("div", { className: "tree-error" }, error);

  return React.createElement("aside", { className: "file-tree" },
    tree.map((e) => renderNode(e, 0))
  );
}
