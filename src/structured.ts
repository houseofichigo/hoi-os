import { Store } from "./store.js";
import type { Host } from "./schema.js";
export { parseCsv } from "./csv.js";
export function queryData(
  s: Store,
  sourceId: string,
  column: string,
  operation: string,
  host: Host,
) {
  s.assertHost(host);
  const source = s.one("SELECT * FROM sources WHERE id=?", sourceId);
  if (!source || !s.allowed(source, host)) throw Error("Source unavailable");
  const rows = s.all(
    "SELECT * FROM structured_rows WHERE revision_id=? ORDER BY row_number",
    source.current_revision,
  );
  if (!rows.length) throw Error("No typed CSV rows in the current revision");
  if (!["sum", "count", "min", "max", "avg"].includes(operation))
    throw Error("Unsupported aggregate");
  if (operation === "count")
    return {
      sourceId,
      revisionId: source.current_revision,
      operation,
      value: rows.length,
      rowCount: rows.length,
    };
  const values = rows.map((r) => JSON.parse(r.data)[column]);
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v)))
    throw Error(
      "Every selected cell must be numeric; mixed units, blanks and text require review",
    );
  const value =
    operation === "sum"
      ? values.reduce((a, b) => a + b, 0)
      : operation === "avg"
        ? values.reduce((a, b) => a + b, 0) / values.length
        : operation === "min"
          ? Math.min(...values)
          : Math.max(...values);
  return {
    sourceId,
    revisionId: source.current_revision,
    column,
    operation,
    value,
    rowCount: rows.length,
    units:
      "Not inferred. Verify consistent units before interpreting this result.",
  };
}
