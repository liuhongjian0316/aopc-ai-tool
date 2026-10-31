# Obsidian Knowledge Base Skill

> Integrate AOPC with your Obsidian vault for note creation, editing, and knowledge-graph operations.

## Plugin
`obsidian-kb` — MCP server for reading, searching, creating, and editing Obsidian notes.

## Capabilities

### 1. Vault Management
- **Read a note:** `read_note(path="Notes/My Project.md")`
- **Create a note:** `create_note(path="Notes/New Note.md", content="# Title\n\nContent...", frontmatter={tags: ["project"]})`
- **Edit a note:** `edit_note(path="Notes/Existing.md", content="New full content")` or `edit_note(path="...", section="## Heading", content="...", append=true)`
- **List notes:** `list_notes(folder="Notes", recursive=true, tags=["project"])`
- **Vault info:** `vault_info()` — returns doc count, index status, root path

### 2. Search
- **Full-text search:** `search_notes(query="project planning", limit=20)` — supports boolean operators, tag filters, path pattern filters

### 3. Bidirectional Links
- **Backlinks:** `get_backlinks(path="Notes/My Project.md")` — find all notes linking to this note
- **Outlinks:** `get_outlinks(path="Notes/My Project.md")` — find all notes this note links to
- **Graph view:** `get_graph()` — returns nodes and edges for visualization

### 4. Dataview Queries
- **Execute query:** `query_dataview(query="FROM #project WHERE status = 'active' SORT by file.name LIMIT 10")`

### 5. Canvas Files
- **Parse canvas:** `parse_canvas(path="Canvas/My Board.canvas")`

## Usage Examples

```
@obsidian create_note(path="2025/Daily Standup.md", content="# Daily Standup\n\n## What I did\n- ", frontmatter={tags:["daily"]})
```

```
@obsidian search_notes(query="meeting notes", tags=["retro"])
```

```
@obsidian get_graph()
```

```
@obsidian query_dataview(query="FROM #project WHERE status = 'done' SORT by file.mtime desc")
```

## Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `vaultPath` | Absolute path to Obsidian vault | Required |
| `encryption.mode` | Decryption mode: `none`, `age`, `gpg`, `openssl`, `custom` | `none` |
| `encryption.key` | Decryption key or command | — |
| `index.watch` | Enable file watcher for incremental index | `true` |

## Notes
- Notes are addressed by path relative to vault root (e.g., `Folder/Note.md`)
- Wikilinks (`[[Note Name]]`) and markdown links (`[text](Note.md)`) are both parsed for graph analysis
- Encrypted vaults require `age`, `gpg`, or `openssl` to be installed on the system
