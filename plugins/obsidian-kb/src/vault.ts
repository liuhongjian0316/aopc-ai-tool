/**
 * Core Vault Operations
 * Handles file system access, security checks, and note parsing
 */
import { readFile, writeFile, mkdir, stat, readdir } from "node:fs/promises";
import { join, dirname, relative, resolve } from "node:path";
import { existsSync } from "node:fs";
import matter from "gray-matter";

export interface Note {
  path: string;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  headings: Array<{ level: number; text: string; line: number }>;
  links: Array<{ target: string; embed: boolean; alias?: string }>;
  modified: string;
  size: number;

  getSection(heading: string): string | null;
}

export interface ListOptions {
  folder?: string;
  recursive?: boolean;
  tags?: string[];
  modifiedAfter?: string;
}

export class Vault {
  private readonly root: string;

  constructor(vaultPath: string) {
    this.root = resolve(vaultPath);
    if (!existsSync(this.root)) {
      throw new Error(`Vault path does not exist: ${this.root}`);
    }
  }

  private safePath(relativePath: string): string {
    const resolved = resolve(this.root, relativePath);
    if (!resolved.startsWith(this.root)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return resolved;
  }

  async readNote(path: string): Promise<Note> {
    const fullPath = this.safePath(path);
    const raw = await readFile(fullPath, "utf-8");
    const stats = await stat(fullPath);

    const { data: frontmatter, content } = matter(raw);
    const title = frontmatter.title || this.extractTitle(content) || relative(this.root, fullPath);
    const tags = this.extractTags(frontmatter, content);
    const headings = this.extractHeadings(content);
    const links = this.extractLinks(content);

    return {
      path: relative(this.root, fullPath),
      title,
      content,
      frontmatter,
      tags,
      headings,
      links,
      modified: stats.mtime.toISOString(),
      size: stats.size,

      getSection(heading: string): string | null {
        const lines = content.split("\n");
        const startIdx = lines.findIndex((line) =>
          line.match(/^#{1,6}\s+.*heading/i)
        );
        if (startIdx === -1) return null;

        const level = lines[startIdx].match(/^(#{1,6})/)?.[1].length || 1;
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
          const match = lines[i].match(/^(#{1,6})/);
          if (match && match[1].length <= level) {
            endIdx = i;
            break;
          }
        }
        return lines.slice(startIdx, endIdx).join("\n");
      }
    };
  }

  private extractTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || null;
  }

  private extractTags(frontmatter: Record<string, unknown>, content: string): string[] {
    const tags = new Set<string>();

    // From frontmatter
    if (Array.isArray(frontmatter.tags)) {
      frontmatter.tags.forEach((t) => tags.add(String(t)));
    }

    // From inline #tags
    const inlineTags = content.match(/(?:^|\s)#([\w-]+(?:\/[\w-]+)*)/g);
    inlineTags?.forEach((tag) => tags.add(tag.slice(1).trim()));

    return Array.from(tags);
  }

  private extractHeadings(content: string): Array<{ level: number; text: string; line: number }> {
    const lines = content.split("\n");
    const headings: Array<{ level: number; text: string; line: number }> = [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
          line: idx + 1
        });
      }
    });

    return headings;
  }

  private extractLinks(content: string): Array<{ target: string; embed: boolean; alias?: string }> {
    const links: Array<{ target: string; embed: boolean; alias?: string }> = [];

    // [[link]] and [[link|alias]]
    const wikilinks = content.matchAll(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
    for (const match of wikilinks) {
      links.push({
        embed: match[1] === "!",
        target: match[2].trim(),
        alias: match[3]?.trim()
      });
    }

    // [text](url) markdown links
    const mdLinks = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
    for (const match of mdLinks) {
      if (!match[2].startsWith("http")) {
        links.push({
          embed: false,
          target: match[2].trim()
        });
      }
    }

    return links;
  }

  async listNotes(options: ListOptions = {}): Promise<Note[]> {
    const folder = options.folder || "";
    const fullPath = this.safePath(folder);
    const notes: Note[] = [];

    const entries = await readdir(fullPath, {
      withFileTypes: true,
      recursive: options.recursive
    });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;

      const relativePath = relative(this.root, join(fullPath, entry.name));
      if (relativePath.startsWith(".obsidian")) continue;

      try {
        const note = await this.readNote(relativePath);

        // Apply filters
        if (options.tags?.length) {
          const hasTag = options.tags.some(t => note.tags.includes(t));
          if (!hasTag) continue;
        }

        if (options.modifiedAfter) {
          const after = new Date(options.modifiedAfter);
          if (new Date(note.modified) < after) continue;
        }

        notes.push(note);
      } catch (err) {
        console.error(`Failed to read ${relativePath}:`, err);
      }
    }

    return notes;
  }

  async createNote(
    path: string,
    content: string,
    frontmatter?: Record<string, unknown>
  ): Promise<string> {
    const fullPath = this.safePath(path);

    if (existsSync(fullPath)) {
      throw new Error(`File already exists: ${path}`);
    }

    await mkdir(dirname(fullPath), { recursive: true });

    let fileContent = "";
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      fileContent = matter.stringify(content, frontmatter);
    } else {
      fileContent = content;
    }

    await writeFile(fullPath, fileContent, "utf-8");
    return relative(this.root, fullPath);
  }

  async editNote(
    path: string,
    options: {
      content?: string;
      section?: string;
      append?: boolean;
    }
  ): Promise<void> {
    const fullPath = this.safePath(path);
    const existing = await this.readNote(path);

    let newContent = existing.content;

    if (options.content !== undefined) {
      if (options.section) {
        // Partial edit: replace section
        const lines = newContent.split("\n");
        const startIdx = lines.findIndex((line) =>
          line.match(new RegExp(`^#{1,6}\\s+.*${escapeRegExp(options.section)}`, "i"))
        );

        if (startIdx === -1) {
          throw new Error(`Section not found: ${options.section}`);
        }

        const level = lines[startIdx].match(/^(#{1,6})/)?.[1].length || 1;
        let endIdx = lines.length;
        for (let i = startIdx + 1; i < lines.length; i++) {
          const match = lines[i].match(/^(#{1,6})/);
          if (match && match[1].length <= level) {
            endIdx = i;
            break;
          }
        }

        const before = lines.slice(0, startIdx);
        const after = lines.slice(endIdx);

        if (options.append) {
          newContent = [...before, lines[startIdx], options.content, ...after].join("\n");
        } else {
          newContent = [...before, options.content, ...after].join("\n");
        }
      } else {
        // Full replace
        newContent = options.content;
      }
    }

    const fileContent = matter.stringify(newContent, existing.frontmatter);
    await writeFile(fullPath, fileContent, "utf-8");
  }

  async readFile(path: string): Promise<string> {
    const fullPath = this.safePath(path);
    return readFile(fullPath, "utf-8");
  }

  getRoot(): string {
    return this.root;
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
