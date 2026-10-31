/**
 * MCP Server Implementation for Obsidian KB
 * Implements: initialize, tools/list, tools/call
 */
import { Vault, type Note } from "./vault.js";
import { Indexer } from "./indexer.js";
import { parseCanvas } from "./parsers/canvas.js";
import { parseDataviewQuery } from "./parsers/dataview.js";

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

const TOOLS: Tool[] = [
  {
    name: "open_note",
    description: "Open a note in the Obsidian viewer panel, optionally jump to a section",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Note path relative to vault root (e.g., 'Notes/Project.md')" },
        anchor: { type: "string", description: "Optional anchor to jump to (heading text or line number)" }
      },
      required: ["path"]
    }
  },
  {
    name: "read_note",
    description: "Read a note's content with optional section filtering",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Note path relative to vault root" },
        heading: { type: "string", description: "Optional: read only content under this heading" },
        cursor: { type: "number", description: "Pagination cursor for large files" }
      },
      required: ["path"]
    }
  },
  {
    name: "search_notes",
    description: "Full-text search across all indexed notes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (supports boolean operators)" },
        limit: { type: "number", description: "Max results (default: 20)" },
        tags: { type: "array", description: "Filter by tags" },
        pathPattern: { type: "string", description: "Filter by path glob pattern" }
      },
      required: ["query"]
    }
  },
  {
    name: "list_notes",
    description: "List notes in a folder or with filters",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string", description: "Folder path (empty = root)" },
        recursive: { type: "boolean", description: "Include subfolders" },
        tags: { type: "array", description: "Filter by tags" },
        modifiedAfter: { type: "string", description: "ISO date: only notes modified after" }
      }
    }
  },
  {
    name: "create_note",
    description: "Create a new note with content and frontmatter",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "New note path (must not exist)" },
        content: { type: "string", description: "Markdown content" },
        frontmatter: { type: "object", description: "Frontmatter fields (tags, aliases, etc.)" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "edit_note",
    description: "Edit an existing note (full replace or section update)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Note path" },
        content: { type: "string", description: "New content (full file)" },
        section: { type: "string", description: "Heading to replace (partial edit mode)" },
        append: { type: "boolean", description: "Append instead of replace" }
      },
      required: ["path"]
    }
  },
  {
    name: "get_graph",
    description: "Get the knowledge graph (nodes and edges) for visualization",
    inputSchema: {
      type: "object",
      properties: {
        maxNodes: { type: "number", description: "Max nodes to return (default: 500)" },
        minLinks: { type: "number", description: "Filter nodes with fewer links" },
        tags: { type: "array", description: "Filter by tags" }
      }
    }
  },
  {
    name: "get_backlinks",
    description: "Get all notes that link to a specific note",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Target note path" },
        includeEmbeds: { type: "boolean", description: "Include ![[embed]] references" }
      },
      required: ["path"]
    }
  },
  {
    name: "get_outlinks",
    description: "Get all outgoing links from a note",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Source note path" },
        includeEmbeds: { type: "boolean", description: "Include ![[embed]] references" }
      },
      required: ["path"]
    }
  },
  {
    name: "query_dataview",
    description: "Execute a Dataview-style query on notes",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Dataview query (FROM, WHERE, SORT, LIMIT)" },
        explain: { type: "boolean", description: "Return query plan instead of results" }
      },
      required: ["query"]
    }
  },
  {
    name: "parse_canvas",
    description: "Parse a Canvas file and return its structure",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Canvas file path (.canvas)" },
        includeContent: { type: "boolean", description: "Include embedded note content" }
      },
      required: ["path"]
    }
  }
];

export function createServer(vault: Vault, indexer: Indexer) {
  let buffer = "";

  function send(id: string | number, result: unknown) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
  }

  function sendError(id: string | number, code: number, message: string) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
  }

  async function callTool(name: string, args: Record<string, unknown>) {
    try {
      // ── Panel-only tools ──
      switch (name) {
        case "vault_info": {
          return {
            content: [{ type: "text", text: JSON.stringify({
              path: vault.getRoot(),
              docCount: indexer.stats.docCount,
              buildTimeMs: indexer.stats.buildTimeMs,
              lastUpdated: indexer.stats.lastUpdated
            }) }],
            structuredContent: {
              path: vault.getRoot(),
              docCount: indexer.stats.docCount,
              buildTimeMs: indexer.stats.buildTimeMs,
              lastUpdated: indexer.stats.lastUpdated
            }
          };
        }

        case "list_files": {
          const notes = await vault.listNotes({ recursive: true });
          // Build tree structure
          const tree: Array<{ path: string; name: string; type: "folder" | "note"; children?: unknown[] }> = [];
          const folderMap = new Map<string, typeof tree>();

          for (const note of notes) {
            const parts = note.path.split("/");
            const name = parts[parts.length - 1];
            const folder = parts.slice(0, -1).join("/");

            if (!folderMap.has(folder)) {
              const entries: typeof tree = [];
              folderMap.set(folder, entries);
              tree.push({ path: folder, name: folder.split("/").pop() || "Root", type: "folder", children: entries });
            }
            folderMap.get(folder)!.push({ path: note.path, name, type: "note" });
          }

          return {
            content: [{ type: "text", text: JSON.stringify({ files: tree }) }],
            structuredContent: { files: tree }
          };
        }
      }

      switch (name) {
        case "open_note": {
          const note = await vault.readNote(args.path as string);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                opened: note.path,
                title: note.title,
                length: note.content.length,
                headings: note.headings.map(h => h.text)
              }, null, 2)
            }]
          };
        }

        case "read_note": {
          const note = await vault.readNote(args.path as string);
          let content = note.content;
          if (args.heading) {
            const section = note.getSection(args.heading as string);
            content = section || content;
          }
          const backlinks = indexer.getBacklinks(note.path, { includeEmbeds: false });
          const noteData = {
            path: note.path,
            title: note.title,
            content,
            frontmatter: note.frontmatter,
            tags: note.tags,
            headings: note.headings,
            backlinks
          };
          return {
            content: [{ type: "text", text: content }],
            structuredContent: noteData
          };
        }

        case "search_notes": {
          const results = indexer.search(args.query as string, {
            limit: (args.limit as number) || 20,
            tags: args.tags as string[],
            pathPattern: args.pathPattern as string
          });
          return {
            content: [{
              type: "text",
              text: JSON.stringify(results, null, 2)
            }],
            structuredContent: { results }
          };
        }

        case "list_notes": {
          const notes = await vault.listNotes({
            folder: args.folder as string,
            recursive: (args.recursive as boolean) ?? true,
            tags: args.tags as string[],
            modifiedAfter: args.modifiedAfter as string
          });
          return {
            content: [{
              type: "text",
              text: JSON.stringify(notes.map(n => ({
                path: n.path,
                title: n.title,
                tags: n.tags,
                modified: n.modified
              })), null, 2)
            }]
          };
        }

        case "create_note": {
          const path = await vault.createNote(
            args.path as string,
            args.content as string,
            args.frontmatter as Record<string, unknown>
          );
          return {
            content: [{ type: "text", text: `Created: ${path}` }]
          };
        }

        case "edit_note": {
          await vault.editNote(args.path as string, {
            content: args.content as string,
            section: args.section as string,
            append: (args.append as boolean) ?? false
          });
          return {
            content: [{ type: "text", text: `Updated: ${args.path}` }]
          };
        }

        case "get_graph": {
          const graph = indexer.getGraph({
            maxNodes: (args.maxNodes as number) || 500,
            minLinks: (args.minLinks as number) || 0,
            tags: args.tags as string[]
          });
          return {
            content: [{ type: "text", text: JSON.stringify(graph, null, 2) }],
            structuredContent: graph
          };
        }

        case "get_backlinks": {
          const backlinks = indexer.getBacklinks(args.path as string, {
            includeEmbeds: (args.includeEmbeds as boolean) ?? false
          });
          return {
            content: [{ type: "text", text: JSON.stringify(backlinks, null, 2) }]
          };
        }

        case "get_outlinks": {
          const outlinks = indexer.getOutlinks(args.path as string, {
            includeEmbeds: (args.includeEmbeds as boolean) ?? false
          });
          return {
            content: [{ type: "text", text: JSON.stringify(outlinks, null, 2) }]
          };
        }

        case "query_dataview": {
          const parsed = parseDataviewQuery(args.query as string);
          const results = indexer.executeDataview(parsed);
          return {
            content: [{ type: "text", text: JSON.stringify(results, null, 2) }]
          };
        }

        case "parse_canvas": {
          const canvas = await vault.readFile(args.path as string);
          const parsed = parseCanvas(canvas);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                nodes: parsed.nodes.length,
                edges: parsed.edges.length,
                groups: parsed.groups?.length || 0
              }, null, 2)
            }]
          };
        }

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${name}` }],
            isError: true
          };
      }
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true
      };
    }
  }

  function handleMessage(line: string) {
    let msg: { id?: string | number; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    const { id, method, params } = msg;

    if (method === "initialize") {
      send(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "obsidian-kb", version: "0.1.0" }
      });
      return;
    }

    if (method?.startsWith("notifications/")) return;

    if (method === "tools/list") {
      send(id, { tools: TOOLS });
      return;
    }

    if (method === "tools/call") {
      callTool(params?.name ?? "", params?.arguments ?? {}).then((result) => send(id, result));
      return;
    }

    if (method === "ping") {
      send(id, {});
      return;
    }

    sendError(id, -32601, `Method not implemented: ${method}`);
  }

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) handleMessage(line);
    }
  });
  process.stdin.on("end", () => process.exit(0));

  return { listen: () => {} };
}
