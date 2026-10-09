import { readFile } from "node:fs/promises";
import { extname, basename } from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
export type Extracted = { text: string; location: string };
const list = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v: any): string =>
  v == null
    ? ""
    : typeof v !== "object"
      ? String(v)
      : Array.isArray(v)
        ? v.map(text).join(" ")
        : Object.entries(v)
            .filter(([k]) => !k.startsWith("@_"))
            .map(([, x]) => text(x))
            .join(" ");
export async function extract(path: string): Promise<Extracted[]> {
  const ext = extname(path).toLowerCase(),
    bytes = await readFile(path),
    out: Extracted[] = [];
  const add = (value: string, location: string) => {
    if (value.trim())
      for (let i = 0; i < value.length; i += 6000)
        out.push({
          text: value.slice(i, i + 6000).trim(),
          location:
            value.length > 6000
              ? `${location}, part ${1 + i / 6000}`
              : location,
        });
  };
  if (
    [".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".vtt", ".srt"].includes(
      ext,
    )
  ) {
    const s = bytes.toString("utf8");
    if (s.includes("\0")) throw Error("Binary data in text input");
    s.split(/\r?\n\s*\r?\n/).forEach((p, i) => add(p, `Block ${i + 1}`));
  } else if ([".docx", ".pptx", ".xlsx"].includes(ext)) {
    const zip = await JSZip.loadAsync(bytes);
    if (
      Object.values(zip.files).reduce(
        (n, f) => n + ((f as any)._data?.uncompressedSize ?? 0),
        0,
      ) > 50_000_000
    )
      throw Error("Office archive exceeds expanded size limit");
    let expanded = 0;
    const read = async (n: string) => {
      const f = zip.file(n);
      if (!f) throw Error(`Missing Office part: ${n}`);
      const s = await f.async("string");
      expanded += s.length;
      if (expanded > 50_000_000)
        throw Error("Office document exceeds extraction limit");
      return new XMLParser({
        ignoreAttributes: false,
        processEntities: false,
      }).parse(s);
    };
    if (ext === ".docx") {
      const d = (await read("word/document.xml"))["w:document"]?.["w:body"];
      list(d?.["w:p"]).forEach((p, i) => add(text(p), `Paragraph ${i + 1}`));
      list(d?.["w:tbl"]).forEach((p, i) => add(text(p), `Table ${i + 1}`));
    }
    if (ext === ".pptx")
      for (const n of Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
        add(text(await read(n)), `Slide ${n.match(/slide(\d+)/)?.[1]}`);
    if (ext === ".xlsx") {
      let shared: string[] = [];
      if (zip.file("xl/sharedStrings.xml"))
        shared = list((await read("xl/sharedStrings.xml")).sst?.si).map(text);
      for (const n of Object.keys(zip.files).filter((n) =>
        /^xl\/worksheets\/sheet\d+\.xml$/.test(n),
      )) {
        const d = await read(n);
        for (const row of list(d.worksheet?.sheetData?.row))
          add(
            list(row.c)
              .map(
                (c) =>
                  `${c["@_r"]}: ${c["@_t"] === "s" ? shared[Number(c.v)] : text(c.is ?? c.v ?? "")}`,
              )
              .join(" | "),
            `${basename(n, ".xml")} row ${row["@_r"]}`,
          );
      }
    }
  } else if (ext === ".pdf") {
    const pdf = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdf.getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise;
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const c = await page.getTextContent();
        add(c.items.map((v: any) => v.str ?? "").join(" "), `Page ${i}`);
        page.cleanup();
      }
    } finally {
      await doc.destroy();
    }
  } else
    throw Error(
      `Unsupported format ${ext || "(none)"}. Original preserved; supply a text export.`,
    );
  if (!out.length)
    throw Error(
      "No extractable text. For scans, use optional OCR and import the resulting text alongside the original.",
    );
  return out;
}
