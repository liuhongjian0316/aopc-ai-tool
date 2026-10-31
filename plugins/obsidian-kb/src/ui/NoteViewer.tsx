/**
 * NoteViewer - renders a single note with wikilinks, frontmatter, headings
 */
import React, { useState, useEffect } from "react";
import { rpc } from "./rpc.js";

interface NoteData {
  path: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  backlinks: Array<{ path: string; title: string }>;
}

interface Props {
  path: string | null;
  onNavigate: (path: string) => void;
}

export function NoteViewer({ path }: Props) {
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setNote(null);
      return;
    }
    setLoading(true);
    setError(null);
    rpc<NoteData>("read_note", { path })
      .then(setNote)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  if (loading) return React.createElement("div", { className: "note-empty" }, "加载中...");
  if (error) return React.createElement("div", { className: "note-empty error" }, error);
  if (!note) return React.createElement("div", { className: "note-empty" }, "选择左侧笔记开始浏览");

  // Simple markdown renderer
  const lines = note.content.split("\n");
  const html = lines.map((line, i) => {
    const heading = line.match(/^(#{1,6})\s+(.+)/);
    if (heading) {
      const level = heading[1].length;
      return React.createElement(`h${level}`, { key: i, className: "note-heading" },
        renderInline(heading[2]));
    }
    if (line.startsWith("> ")) {
      return React.createElement("blockquote", { key: i }, renderInline(line.slice(2)));
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return React.createElement("li", { key: i }, renderInline(line.slice(2)));
    }
    if (line.trim() === "") return React.createElement("br", { key: i });
    return React.createElement("p", { key: i }, renderInline(line));
  });

  return React.createElement("article", { className: "note-viewer" },
    React.createElement("h1", { className: "note-title" }, note.title),
    Object.keys(note.frontmatter).length > 0 && React.createElement("div", {
      className: "frontmatter"
    }, JSON.stringify(note.frontmatter, null, 2)),
    note.tags.length > 0 && React.createElement("div", { className: "tags" },
      note.tags.map((t) => React.createElement("span", { key: t, className: "tag" }, `#${t}`))
    ),
    React.createElement("div", { className: "note-content" }, html),
    note.backlinks.length > 0 && React.createElement("div", { className: "backlinks" },
      React.createElement("h3", {}, `反向链接 (${note.backlinks.length})`),
      note.backlinks.map((bl) => React.createElement("div", {
        key: bl.path, className: "backlink"
      }, bl.title))
    )
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\[\[[^\]]+\]\]|`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const inner = part.slice(2, -2);
      const [target, alias] = inner.split("|");
      return React.createElement("a", { key: i, className: "wikilink", href: "#" }, alias || target);
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return React.createElement("code", { key: i }, part.slice(1, -1));
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return React.createElement("strong", { key: i }, part.slice(2, -2));
    }
    return part;
  });
}
