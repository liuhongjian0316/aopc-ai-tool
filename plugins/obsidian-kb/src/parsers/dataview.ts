/**
 * Dataview Query Parser
 * Supports simplified Dataview syntax: FROM, WHERE, SORT, LIMIT, SELECT
 */
import type { DataviewParsed } from "../indexer.js";

/**
 * Parse a Dataview-style query string into structured format.
 *
 * Supported syntax:
 *   TABLE [fields] FROM [source] WHERE [conditions] SORT [field] [ASC|DESC] LIMIT [n]
 *   LIST FROM [source] WHERE [conditions]
 *   FROM #tag OR "folder/path"
 *   WHERE field = "value" AND/OR field2 != "value2"
 */
export function parseDataviewQuery(query: string): DataviewParsed {
  const parsed: DataviewParsed = {};
  const trimmed = query.trim();

  // FROM clause
  const fromMatch = trimmed.match(/FROM\s+(.+?)(?:\s+WHERE|\s+SORT|\s+LIMIT|$)/i);
  if (fromMatch) {
    parsed.from = fromMatch[1]
      .split(/\s+OR\s+/i)
      .map((s) => s.trim().replace(/[()]/g, ""))
      .filter(Boolean);
  }

  // WHERE clause
  const whereMatch = trimmed.match(/WHERE\s+(.+?)(?:\s+SORT|\s+LIMIT|$)/i);
  if (whereMatch) {
    parsed.where = parseConditions(whereMatch[1]);
  }

  // SORT clause
  const sortMatch = trimmed.match(/SORT\s+(\w+)(?:\s+(ASC|DESC))?/i);
  if (sortMatch) {
    parsed.sort = {
      field: sortMatch[1],
      direction: (sortMatch[2]?.toLowerCase() as "asc" | "desc") || "asc"
    };
  }

  // LIMIT clause
  const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    parsed.limit = parseInt(limitMatch[1], 10);
  }

  // SELECT clause (from TABLE)
  const selectMatch = trimmed.match(/TABLE\s+(.+?)(?:\s+FROM|$)/i);
  if (selectMatch) {
    parsed.select = selectMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return parsed;
}

function parseConditions(str: string): Array<{ field: string; op: string; value: string }> {
  const conditions: Array<{ field: string; op: string; value: string }> = [];
  const parts = str.split(/\s+AND\s+|\s+OR\s+/i);

  for (const part of parts) {
    const match = part.trim().match(
      /^(\S+)\s*(=|!=|>=|<=|>|<|CONTAINS|STARTSWITH|ENDSWITH)\s*(.+)$/i
    );
    if (match) {
      conditions.push({
        field: match[1],
        op: match[2].toLowerCase(),
        value: match[3].replace(/^["']|["']$/g, "")
      });
    }
  }

  return conditions;
}
