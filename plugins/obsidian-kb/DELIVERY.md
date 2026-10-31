# Obsidian KB Plugin Delivery Guide

## 1. Build & Package

```bash
cd plugins/obsidian-kb
npm install
npm run build
```

Output:
- `dist/server.mjs` — MCP server (Node.js ESM)
- `dist/ui/panel.html` — UI panel (browser IIFE)
- `dist/ui/panel.css` — Styles
- `dist/ui/bundle-0.txt` — Chunked JS (1-4MB chunks)
- `dist/ui/assets.json` — Script manifest

## 2. Installation

```bash
aopc plugin install /path/to/obsidian-kb
```

Or from marketplace:
```bash
aopc marketplace install obsidian-kb
```

## 3. Configuration

After installation, configure in AOPC Settings → Plugins → Obsidian KB:

| Setting | Description | Default |
|---------|-------------|---------|
| **Vault Path** | Absolute path to Obsidian vault | Auto-detect `~/Documents/知识库/AIJIUOPC/` |
| **Index on Startup** | Full index on plugin load | `true` |
| **Watch Changes** | chokidar file watcher | `true` |
| **Max Index Size** | MB limit before sharding | `100` |
| **Encryption Enabled** | If vault is encrypted | `false` |
| **Encryption Method** | `age`, `gpg`, `openssl`, `custom` | `age` |
| **Key Path** | Decryption key file | — |
| **Passphrase Env** | Env var for password | — |
| **Custom Command** | Custom decrypt command | — |
| **Sync Conflict Strategy** | `readonly` | `auto-merge` | `prompt` | `readonly` |
| **Index Exclude Patterns** | Glob patterns to skip | `[".obsidian/**", ".git/**", ".trash/**", "*.canvas", "*.base"]` |

## 4. Usage

### MCP Server Tools
Available via `@obsidian`:
- `read_note(path, heading?, cursor?)`
- `create_note(path, content, frontmatter?)`
- `edit_note(path, content, section?, append?)`
- `list_notes(folder?, recursive?, tags?, modifiedAfter?)`
- `search_notes(query, limit?, tags?, pathPattern?)`
- `get_graph(maxNodes?, minLinks?, tags?)`
- `get_backlinks(path, includeEmbeds?)`
- `get_outlinks(path, includeEmbeds?)`
- `query_dataview(query, explain?)`
- `parse_canvas(path, includeContent?)`
- `vault_info()`
- `list_files()`

### UI Panel
Open from AOPC sidebar → **Obsidian 知识库**

Tabs:
- **Notes** — File tree browser
- **Graph** — Bidirectional link visualization
- **Search** — Full-text search with excerpts

### Skills
Two skills available:
1. `obsidian` — CRUD, search, graph, dataview, canvas
2. `obsidian-viewer` — UI panel interaction patterns

## 5. Testing

Smoke test:
```bash
npm run smoke
```

Manual test:
1. Create test vault with markdown notes
2. Add wikilinks `[[Other Note]]` and tags `#project`
3. Run `query_dataview("FROM #project LIMIT 5")`
4. Open UI panel, verify graph renders
5. Edit a note, verify changes sync

## 6. Uninstall

```bash
aopc plugin uninstall obsidian-kb
```

## 7. Notes

- **Encrypted vaults**: Requires `age`, `gpg`, or `openssl` installed on system
- **Sync conflicts**: `readonly` mode refuses writes on external changes
- **Large vaults**: >100MB index triggers metadata-only indexing
- **Canvas files**: Parsed to JSON structure and Mermaid diagram
- **Dataview**: Supports FROM, WHERE, SORT, LIMIT, SELECT, boolean operators
