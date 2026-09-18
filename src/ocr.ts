import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { assertInput, sha, now } from "./files.js";
export function doctorOcr() {
  try {
    const languages = execFileSync("tesseract", ["--list-langs"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return { available: true, languages };
  } catch {
    return {
      available: false,
      instruction:
        "Install the Tesseract CLI and required language packs, then ensure tesseract is on PATH.",
    };
  }
}
export function ocr(input: string, output: string, language = "eng") {
  const path = assertInput(input);
  if (
    ![".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"].includes(
      extname(path).toLowerCase(),
    )
  )
    throw Error("OCR accepts image scans. Export PDF pages to images first.");
  if (!/^[a-z_]+(?:\+[a-z_]+)*$/.test(language))
    throw Error("Invalid OCR language list");
  const destination = resolve(output);
  if (existsSync(destination) || existsSync(destination + ".source.json"))
    throw Error("OCR output already exists; choose a distinct filename");
  if (!doctorOcr().available)
    throw Error("Tesseract is unavailable; run doctor-ocr");
  const text = execFileSync("tesseract", [path, "stdout", "-l", language], {
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!text.trim()) throw Error("OCR produced no text");
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  writeFileSync(destination, text, { flag: "wx", mode: 0o600 });
  writeFileSync(
    destination + ".source.json",
    JSON.stringify(
      {
        schemaVersion: 1,
        source: path,
        sourceChecksum: sha(readFileSync(path)),
        outputChecksum: sha(text),
        language,
        createdAt: now(),
        authority: "derived",
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
  return { output: destination, authority: "derived", reviewRequired: true };
}
