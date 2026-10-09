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
