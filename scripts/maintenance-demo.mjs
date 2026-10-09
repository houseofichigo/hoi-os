import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedDailyDemo } from "./daily-demo.mjs";
import { Store } from "../dist/core/store.js";
import { capture, reviewMemory } from "../dist/core/knowledge.js";
import { proposeWiki, reviewWiki } from "../dist/core/wiki.js";
import { ingest, retrieve } from "../dist/core/intake.js";
export async function seedMaintenanceDemo(workspace) {
  const demo = await seedDailyDemo(workspace),
    s = new Store(demo.workspace),
    dir = mkdtempSync(join(tmpdir(), "hoi-maintenance-"));
  try {
    const p = join(dir, "offering.md");
    writeFileSync(p, "Cedar pilot offering is a proposal review.");
    await ingest(s, p);
    const e = retrieve(s, "offering", "local").results[0],
      evidence = [
        { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote },
      ];
    const wiki = proposeWiki(
      s,
      {
        slug: "cedar-offering",
        title: "Cedar offering (synthetic)",
        type: "offering",
        content: "The pilot offers a proposal review.",
        evidence,
      },
      "local",
    );
    reviewWiki(s, wiki.id, "reviewed", "local");
    const m = capture(
      s,
      {
        type: "semantic",
        content: "Temporary Cedar pilot assumption (synthetic)",
        validUntil: "2020-01-01",
        evidence,
      },
      "local",
    );
    reviewMemory(s, m.id, "approved", "local");
    writeFileSync(p, "Cedar pilot offering has changed to a scope review.");
    await ingest(s, p);
    return {
      ...demo,
      note: "Open Wiki, scan knowledge, inspect stale evidence and expired memory. Synthetic only.",
    };
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(
    JSON.stringify(await seedMaintenanceDemo(process.argv[2]), null, 2),
  );
