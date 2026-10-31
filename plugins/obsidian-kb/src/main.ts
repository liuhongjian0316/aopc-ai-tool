/**
 * obsidian-kb MCP Server Entry Point
 * Initializes the vault, indexer, and MCP server
 */
import { createServer } from "./server.js";
import { Vault } from "./vault.js";
import { Indexer } from "./indexer.js";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
const INDEX_ON_STARTUP = process.env.OBSIDIAN_INDEX_ON_STARTUP === "true";
const WATCH_CHANGES = process.env.OBSIDIAN_WATCH_CHANGES === "true";

if (!VAULT_PATH) {
  console.error("OBSIDIAN_VAULT_PATH environment variable is required");
  process.exit(1);
}

async function main() {
  const vault = new Vault(VAULT_PATH);
  const indexer = new Indexer(vault);

  if (INDEX_ON_STARTUP) {
    console.error(`Indexing vault at ${VAULT_PATH}...`);
    await indexer.build();
    console.error(`Indexed ${indexer.stats.docCount} notes in ${indexer.stats.buildTimeMs}ms`);
  }

  const server = createServer(vault, indexer);

  if (WATCH_CHANGES) {
    await indexer.watch();
    console.error("File watcher started");
  }

  server.listen();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
