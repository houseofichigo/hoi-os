import { Store } from "./store.js";
import type { Host } from "./schema.js";
export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (quoted || !field) quoted = !quoted;
      else throw Error("Invalid CSV quoting");
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers =
    rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
  if (
    !headers.length ||
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length
  )
    throw Error("CSV headers must be nonempty and unique");
  return rows.map((values, i) => {
    if (values.length !== headers.length)
      throw Error(`CSV row ${i + 2} has an unexpected column count`);
    return Object.fromEntries(
      headers.map((h, j) => [
        h,
        /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(values[j])
          ? Number(values[j])
          : values[j],
      ]),
    );
  });
}
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
