/**
 * Indexer - Builds and maintains search index and link graph
 * Uses MiniSearch for full-text search
 */
import MiniSearch from "minisearch";
import { watch } from "chokidar";
import { Vault, Note } from "./vault.js";

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  excerpt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  tags: string[];
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "link" | "embed";
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface IndexStats {
  docCount: number;
  buildTimeMs: number;
  lastUpdated: string;
}

export interface SearchOptions {
  limit?: number;
  tags?: string[];
  pathPattern?: string;
}

export interface GraphOptions {
  maxNodes?: number;
  minLinks?: number;
  tags?: string[];
}

export interface DataviewParsed {
  select?: string[];
  from?: string[];
  where?: Array<{ field: string; op: string; value: string }>;
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
}

export class Indexer {
  private minisearch: MiniSearch;
  private notes: Map<string, Note> = new Map();
  private backlinkIndex: Map<string, Array<{ path: string; embed: boolean }>> = new Map();
  private outlinkIndex: Map<string, Array<{ path: string; embed: boolean }>> = new Map();
  public stats: IndexStats = { docCount: 0, buildTimeMs: 0, lastUpdated: new Date().toISOString() };

  constructor(private vault: Vault) {
    this.minisearch = new MiniSearch({
      fields: ["title", "content", "tags"],
      storeFields: ["path", "title", "tags"],
      searchOptions: {
        boost: { title: 2, tags: 1.5 },
        fuzzy: 0.2,
        prefix: true
      }
    });
  }

  async build(): Promise<void> {
    const start = Date.now();
    this.notes.clear();
    this.backlinkIndex.clear();
    this.outlinkIndex.clear();
    this.minisearch = new MiniSearch({
      fields: ["title", "content", "tags"],
      storeFields: ["path", "title", "tags"]
    });

    const allNotes = await this.vault.listNotes({ recursive: true });
    const docs = [];

    for (const note of allNotes) {
      this.notes.set(note.path, note);

      // Build link indices
      for (const link of note.links) {
        const targetPath = this.resolveLink(note.path, link.target);
        if (targetPath) {
          // Outlink
          if (!this.outlinkIndex.has(note.path)) {
            this.outlinkIndex.set(note.path, []);
          }
          this.outlinkIndex.get(note.path)!.push({ path: targetPath, embed: link.embed });

          // Backlink
          if (!this.backlinkIndex.has(targetPath)) {
            this.backlinkIndex.set(targetPath, []);
          }
          this.backlinkIndex.get(targetPath)!.push({ path: note.path, embed: link.embed });
        }
      }

      docs.push({
        id: note.path,
        path: note.path,
        title: note.title,
        content: note.content.substring(0, 10000), // Limit indexed content
        tags: note.tags.join(" ")
      });
    }

    this.minisearch.addAll(docs);
    this.stats.docCount = docs.length;
    this.stats.buildTimeMs = Date.now() - start;
    this.stats.lastUpdated = new Date().toISOString();
  }

  private resolveLink(sourcePath: string, target: string): string | null {
    // Strip heading references and block IDs
    let cleanTarget = target.split("#")[0].split("^")[0].trim();
    if (!cleanTarget) return null;

    // Try as path first
    const directPath = this.notes.get(cleanTarget);
    if (directPath) return cleanTarget;

    // Try adding .md extension
    if (!cleanTarget.endsWith(".md") && this.notes.has(cleanTarget + ".md")) {
      return cleanTarget + ".md";
    }

    // Try relative resolution from source directory
    const dir = sourcePath.split("/").slice(0, -1).join("/");
    const relativePath = dir ? `${dir}/${cleanTarget}` : cleanTarget;
    if (this.notes.has(relativePath)) return relativePath;
    if (this.notes.has(relativePath + ".md")) return relativePath + ".md";

    // Try finding by title
    for (const [path, note] of this.notes) {
      if (note.title.toLowerCase() === cleanTarget.toLowerCase()) return path;
      if (path.toLowerCase().includes(cleanTarget.toLowerCase())) return path;
    }

    return null;
  }

  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const limit = options.limit || 20;
    const results = this.minisearch.search(query, { limit: limit * 2 });

    const filtered = results.filter((r) => {
      const note = this.notes.get(r.path as string);
      if (!note) return false;

      if (options.tags?.length) {
        if (!options.tags.some((t) => note.tags.includes(t))) return false;
      }

      if (options.pathPattern) {
        const regex = new RegExp(options.pathPattern.replace("*", ".*"));
        if (!regex.test(r.path as string)) return false;
      }

      return true;
    });

    return filtered.slice(0, limit).map((r) => {
      const note = this.notes.get(r.path as string)!;
      const excerptStart = Math.max(0, note.content.indexOf(query) - 50);
      const excerpt = note.content
        .substring(excerptStart, excerptStart + 200)
        .replace(/\n/g, " ")
        .trim();

      return {
        path: r.path as string,
        title: note.title,
        score: r.score,
        excerpt: excerpt.length > 200 ? excerpt + "..." : excerpt
      };
    });
  }

  getGraph(options: GraphOptions = {}): Graph {
    const maxNodes = options.maxNodes || 500;
    const minLinks = options.minLinks || 0;

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Collect all connected nodes
    for (const [path, outlinks] of this.outlinkIndex) {
      if (options.tags?.length) {
        const note = this.notes.get(path);
        if (!note || !options.tags.some((t) => note.tags.includes(t))) continue;
      }

      const totalLinks = (outlinks.length) + (this.backlinkIndex.get(path)?.length || 0);
      if (totalLinks < minLinks) continue;

      if (!nodeIds.has(path)) {
        nodeIds.add(path);
        const note = this.notes.get(path);
        nodes.push({
          id: path,
          label: note?.title || path,
          tags: note?.tags || [],
          linkCount: totalLinks
        });
      }

      for (const link of outlinks) {
        if (!nodeIds.has(link.path) && nodeIds.size >= maxNodes) continue;
        if (!nodeIds.has(link.path)) {
          nodeIds.add(link.path);
          const note = this.notes.get(link.path);
          nodes.push({
            id: link.path,
            label: note?.title || link.path,
            tags: note?.tags || [],
            linkCount: (this.outlinkIndex.get(link.path)?.length || 0) + (this.backlinkIndex.get(link.path)?.length || 0)
          });
        }
        edges.push({ source: path, target: link.path, type: link.embed ? "embed" : "link" });
      }
    }

    return { nodes: nodes.slice(0, maxNodes), edges };
  }

  getBacklinks(path: string, options: { includeEmbeds?: boolean } = {}): Array<{ path: string; embed: boolean; title: string }> {
    const links = this.backlinkIndex.get(path) || [];
    const filtered = options.includeEmbeds ? links : links.filter((l) => !l.embed);

    return filtered.map((l) => ({
      path: l.path,
      embed: l.embed,
      title: this.notes.get(l.path)?.title || l.path
    }));
  }

  getOutlinks(path: string, options: { includeEmbeds?: boolean } = {}): Array<{ path: string; embed: boolean; title: string }> {
    const links = this.outlinkIndex.get(path) || [];
    const filtered = options.includeEmbeds ? links : links.filter((l) => !l.embed);

    return filtered.map((l) => ({
      path: l.path,
      embed: l.embed,
      title: this.notes.get(l.path)?.title || l.path
    }));
  }

  executeDataview(parsed: DataviewParsed): unknown[] {
    let results = Array.from(this.notes.values());

    // FROM: tag or folder filter
    if (parsed.from?.length) {
      results = results.filter((note) => {
        return parsed.from!.some((source) => {
          if (source.startsWith("#")) return note.tags.includes(source.slice(1));
          if (source.startsWith('"') || source.startsWith("'")) {
            const folder = source.slice(1, -1);
            return note.path.startsWith(folder);
          }
          return note.path.includes(source) || note.title.includes(source);
        });
      });
    }

    // WHERE: field filters
    if (parsed.where?.length) {
      results = results.filter((note) => {
        return parsed.where!.every((condition) => {
          const value = this.getFieldValue(note, condition.field);
          return this.evaluateCondition(value, condition.op, condition.value);
        });
      });
    }

    // SORT
    if (parsed.sort) {
      results.sort((a, b) => {
        const va = this.getFieldValue(a, parsed.sort!.field);
        const vb = this.getFieldValue(b, parsed.sort!.field);
        const cmp = String(va ?? "").localeCompare(String(vb ?? ""));
        return parsed.sort!.direction === "desc" ? -cmp : cmp;
      });
    }

    // LIMIT
    if (parsed.limit) {
      results = results.slice(0, parsed.limit);
    }

    // SELECT: project fields
    if (parsed.select?.length) {
      return results.map((note) => {
        const row: Record<string, unknown> = {};
        for (const field of parsed.select!) {
          if (field === "file.name") row["name"] = note.title;
          else if (field === "file.path") row["path"] = note.path;
          else if (field === "file.tags") row["tags"] = note.tags;
          else if (field === "file.mtime") row["modified"] = note.modified;
          else row[field] = this.getFieldValue(note, field);
        }
        return row;
      });
    }

    return results.map((n) => ({
      path: n.path,
      title: n.title,
      tags: n.tags,
      modified: n.modified
    }));
  }

  private getFieldValue(note: Note, field: string): unknown {
    if (field === "tags") return note.tags;
    if (field === "title") return note.title;
    if (field === "modified") return note.modified;
    if (field.startsWith("frontmatter.")) return note.frontmatter[field.slice(12)];
    return note.frontmatter[field] ?? note.content.includes(field);
  }

  private evaluateCondition(value: unknown, op: string, target: string): boolean {
    const strVal = String(value ?? "").toLowerCase();
    const strTarget = target.toLowerCase();

    switch (op) {
      case "=": case "==": return strVal === strTarget;
      case "!=": return strVal !== strTarget;
      case ">": return strVal > strTarget;
      case "<": return strVal < strTarget;
      case ">=": return strVal >= strTarget;
      case "<=": return strVal <= strTarget;
      case "contains": return strVal.includes(strTarget);
      case "startswith": return strVal.startsWith(strTarget);
      default: return false;
    }
  }

  async watch(): Promise<void> {
    const watcher = watch(this.vault.getRoot(), {
      ignoreInitial: true,
      ignored: (path: string) => path.includes(".obsidian") || path.includes(".git")
    });

    watcher.on("change", async (path: string) => {
      if (!path.endsWith(".md")) return;
      const relativePath = path.replace(this.vault.getRoot() + "/", "");
      try {
        await this.reindexNote(relativePath);
      } catch (err) {
        console.error(`Failed to reindex ${relativePath}:`, err);
      }
    });

    watcher.on("add", async (path: string) => {
      if (!path.endsWith(".md")) return;
      const relativePath = path.replace(this.vault.getRoot() + "/", "");
      try {
        await this.reindexNote(relativePath);
      } catch (err) {
        console.error(`Failed to index new ${relativePath}:`, err);
      }
    });

    watcher.on("unlink", (path: string) => {
      if (!path.endsWith(".md")) return;
      const relativePath = path.replace(this.vault.getRoot() + "/", "");
      this.removeNote(relativePath);
    });
  }

  private async reindexNote(path: string): Promise<void> {
    // Remove old
    this.removeNote(path);

    // Re-read and add
    try {
      const note = await this.vault.readNote(path);
      this.notes.set(note.path, note);

      this.minisearch.addDoc({
        id: note.path,
        path: note.path,
        title: note.title,
        content: note.content.substring(0, 10000),
        tags: note.tags.join(" ")
      });

      // Rebuild link indices for this note
      for (const link of note.links) {
        const targetPath = this.resolveLink(note.path, link.target);
        if (targetPath) {
          if (!this.outlinkIndex.has(note.path)) {
            this.outlinkIndex.set(note.path, []);
          }
          this.outlinkIndex.get(note.path)!.push({ path: targetPath, embed: link.embed });

          if (!this.backlinkIndex.has(targetPath)) {
            this.backlinkIndex.set(targetPath, []);
          }
          this.backlinkIndex.get(targetPath)!.push({ path: note.path, embed: link.embed });
        }
      }

      this.stats.lastUpdated = new Date().toISOString();
    } catch {
      // File might be a canvas or other format - skip
    }
  }

  private removeNote(path: string): void {
    this.notes.delete(path);

    try {
      this.minisearch.removeDoc(path);
    } catch {
      // Doc might not exist yet
    }

    // Remove from link indices
    const outlinks = this.outlinkIndex.get(path) || [];
    for (const link of outlinks) {
      const backlinks = this.backlinkIndex.get(link.path);
      if (backlinks) {
        const idx = backlinks.findIndex((l) => l.path === path);
        if (idx >= 0) backlinks.splice(idx, 1);
      }
    }
    this.outlinkIndex.delete(path);

    // Clean this note from backlinks (as a target)
    for (const [target, links] of this.outlinkIndex) {
      const idx = links.findIndex((l) => l.path === path);
      if (idx >= 0) {
        links.splice(idx, 1);
        if (links.length === 0) this.outlinkIndex.delete(target);
      }
    }

    this.backlinkIndex.delete(path);
    this.stats.docCount = this.notes.size;
  }
}
