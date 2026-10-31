/**
 * Obsidian KB Panel - Main React Entry Point
 */
import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { FileTree } from "./FileTree.js";
import { NoteViewer } from "./NoteViewer.js";
import { GraphView } from "./GraphView.js";
import { SearchView } from "./SearchView.js";
import { rpc } from "./rpc.js";

type Tab = "notes" | "graph" | "search";

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [vaultInfo, setVaultInfo] = useState<{ path: string; docCount: number } | null>(null);

  useEffect(() => {
    rpc("vault_info").then(setVaultInfo).catch(() => {});
  }, []);

  const handleSelectNote = useCallback((path: string) => {
    setSelectedPath(path);
    setActiveTab("notes");
  }, []);

  return React.createElement("div", { className: "obsidian-panel" },
    // Header
    React.createElement("header", { className: "panel-header" },
      React.createElement("div", { className: "panel-title" },
        vaultInfo ? vaultInfo.path : "Loading..."
      ),
      vaultInfo && React.createElement("span", { className: "note-count" },
        `${vaultInfo.docCount} notes`
      )
    ),

    // Tabs
    React.createElement("nav", { className: "panel-tabs" },
      React.createElement("button", {
        className: `tab ${activeTab === "notes" ? "active" : ""}`,
        onClick: () => setActiveTab("notes")
      }, "Notes"),
      React.createElement("button", {
        className: `tab ${activeTab === "graph" ? "active" : ""}`,
        onClick: () => setActiveTab("graph")
      }, "Graph"),
      React.createElement("button", {
        className: `tab ${activeTab === "search" ? "active" : ""}`,
        onClick: () => setActiveTab("search")
      }, "Search")
    ),

    // Content area
    activeTab === "notes" && React.createElement("div", { className: "panel-split" },
      React.createElement(FileTree, {
        selectedPath,
        onSelect: handleSelectNote
      }),
      React.createElement(NoteViewer, { path: selectedPath })
    ),

    activeTab === "graph" && React.createElement(GraphView, {
      selectedPath,
      onSelect: handleSelectNote
    }),

    activeTab === "search" && React.createElement(SearchView, {
      onSelect: handleSelectNote
    })
  );
}

export function renderPanel() {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(React.createElement(App));
  }
}
