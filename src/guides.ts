import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha } from "./files.js";
import { z } from "zod";
export const GUIDE_NAMES = [
  "RULES.md",
  "FILESYSTEM.md",
  "TOOL_CONVENTIONS.md",
  "OPERATIONS_REFERENCE.md",
] as const;
const manifestSchema = z
  .object({
    version: z.literal(1),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    files: z.record(z.string().regex(/^[a-f0-9]{64}$/)),
  })
  .strict();
export function guideManifest(contents: Record<string, string>) {
  const files = Object.fromEntries(
    GUIDE_NAMES.map((n) => [n, sha(contents[n])]),
  );
  return { version: 1 as const, digest: sha(JSON.stringify(files)), files };
}
export function bundledGuides(root: string) {
  const contents = Object.fromEntries(
    GUIDE_NAMES.map((n) => [n, readFileSync(join(root, "docs", n), "utf8")]),
  );
  const manifest = manifestSchema.parse(
    JSON.parse(readFileSync(join(root, "docs/GUIDES.json"), "utf8")),
  );
  if (JSON.stringify(manifest) !== JSON.stringify(guideManifest(contents)))
    throw Error("GUIDES_STALE: Run npm run docs:sync");
  return { manifest, contents };
}
export function installedGuides(raw: unknown) {
  const m = manifestSchema.parse(raw);
  if (Object.keys(m.files).sort().join() !== [...GUIDE_NAMES].sort().join())
    throw Error("GUIDE_MANIFEST_INVALID");
  return m;
}
