/**
 * SearchView - full-text search interface
 */
import React, { useState, useCallback } from "react";
import { rpc } from "./rpc.js";

interface SearchResult {
  path: string;
  title: string;
  score: number;
  excerpt: string;
}

interface Props {
  onSelect: (path: string) => void;
}

export function SearchView({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    setError(null);
    try {
      const r = await rpc<{ results: SearchResult[] }>("search_notes", { query: q, limit: 30 });
      setResults(r.results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  }, []);

  return React.createElement("div", { className: "search-view" },
    React.createElement("div", { className: "search-bar" },
      React.createElement("input", {
        type: "text", placeholder: "搜索笔记...", value: query,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") doSearch(query); }
      }),
      React.createElement("button", { onClick: () => doSearch(query), disabled: searching },
        searching ? "..." : "搜索")
    ),
    error && React.createElement("div", { className: "tree-error" }, error),
    React.createElement("div", { className: "search-results" },
      results.map((r) => React.createElement("div", {
        key: r.path, className: "search-result",
        onClick: () => onSelect(r.path)
      },
        React.createElement("div", { className: "result-title" }, r.title),
        React.createElement("div", { className: "result-path" }, r.path),
        React.createElement("div", { className: "result-excerpt" }, r.excerpt)
      )),
      !searching && results.length === 0 && query && React.createElement("div",
        { className: "note-empty" }, "没有匹配结果")
    )
  );
}
