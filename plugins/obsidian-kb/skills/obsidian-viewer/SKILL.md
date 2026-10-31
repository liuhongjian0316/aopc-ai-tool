# Obsidian Viewer Skill

> Browse and visualize your Obsidian knowledge base through an interactive UI panel with file tree, note viewer, graph view, and full-text search.

## Plugin
`obsidian-kb` — provides a UI panel backed by the MCP server.

## Panel Features

### Tabs
1. **Notes** — File tree browser with folder expand/collapse. Click any note to open it in the viewer.
2. **Graph** — SVG-based bidirectional link graph with golden-angle spiral layout. Nodes sized by link count; selected nodes highlighted in amber.
3. **Search** — Full-text search bar with live results showing title, path, and excerpt.

### Note Viewer
- Renders markdown (headings, blockquotes, lists, bold, inline code)
- Wikilinks (`[[Note]]`) are clickable — clicking navigates to that note
- Displays frontmatter, tags, and backlinks panel
- Headings and anchors available for quick navigation

### Graph View
- Force-like circular layout using golden-angle spiral
- Edge types: solid (links), dashed (embeds)
- Node radius scales with link count (30–60px radius range)
- Active node highlighted in amber (`#f59e0b`)

## UI-RPC Methods (panel ↔ server)

| Method | Params | Returns |
|--------|--------|---------|
| `vault_info` | — | `{ path, docCount, buildTimeMs, lastUpdated }` |
| `list_files` | — | `{ files: [{ path, name, type, children[] }] }` |
| `read_note` | `{ path, heading?, cursor? }` | `{ path, title, content, frontmatter, tags, headings, backlinks }` |
| `open_note` | `{ path, anchor? }` | `{ opened, title, length, headings }` |
| `search_notes` | `{ query, limit?, tags?, pathPattern? }` | `{ results: [{ path, title, score, excerpt }] }` |
| `get_graph` | `{ maxNodes?, minLinks?, tags? }` | `{ nodes[], edges[] }` |

## Usage

Open the panel from the AOPC sidebar, then:

- Click any file in the **Notes** tab to read it
- Click any wikilink inside a note to navigate
- Type in the **Search** tab to find notes across the vault
- Switch to **Graph** to see the link structure

## Configuration

The panel inherits all configuration from the `obsidian-kb` MCP server — see the **Obsidian Knowledge Base** skill for configuration details.
