// Synthetic scaling measurement only. Creates its own disposable workspace, never opens private data.
import { mkdtempSync, writeFileSync, rmSync, statSync } from "node:fs";
import { tmpdir, cpus, totalmem, platform, arch } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { initialize, Store } from "../dist/core/store.js";
import { ingest } from "../dist/core/intake.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import { buildIdentity } from "../dist/core/security-evidence.js";
const output = process.argv[2];
if (!output) throw Error("Supply a new output JSON path");
const root = mkdtempSync(join(tmpdir(), "hoi-synthetic-scale-")),
  workspace = join(root, "workspace");
initialize(workspace);
const s = new Store(workspace);
try {
  const expected = new Map();
  for (let source = 0; source < 100; source++) {
    const paragraphs = Array.from(
      { length: 100 },
      (_, i) =>
        `Fictional item KEY${source.toString().padStart(3, "0")}${i.toString().padStart(3, "0")} requires reviewed preparation. Atelier fictif de formation.`,
    );
    const path = join(root, `fixture-${source}.md`);
    writeFileSync(path, paragraphs.join("\n\n"));
    const r = await ingest(s, path, { host: "local" });
    // Deterministic passage projection of exact original paragraphs, independent of chunker tuning.
    s.tx(() => {
      s.exec(
        "DELETE FROM passage_search WHERE passage_id IN (SELECT id FROM passages WHERE revision_id=?)",
        r.revisionId,
      );
      s.exec("DELETE FROM passages WHERE revision_id=?", r.revisionId);
      paragraphs.forEach((text, i) => {
        const id = `benchmark-${source}-${i}`;
        s.exec(
          "INSERT INTO passages VALUES(?,?,?,?)",
          id,
          r.revisionId,
          `paragraph ${i + 1}`,
          text,
        );
        s.exec(
          "INSERT INTO passage_search(text,passage_id) VALUES(?,?)",
          text,
          id,
        );
        expected.set(text.match(/KEY\d+/)[0], id);
      });
    });
  }
  const queries = Array.from(expected.keys())
      .filter((_, i) => i % 199 === 0)
      .slice(0, 50),
    durations = [];
  let exactHits = 0,
    citations = 0;
  const run = (q) => {
    const start = performance.now();
    const result = knowledgeSearch(s, { query: q }, "local");
    return { result, ms: performance.now() - start };
  };
  const first = run(queries[0]);
  for (const q of queries) {
    const { result, ms } = run(q);
    durations.push(ms);
    if (
      result.evidence
        .slice(0, 5)
        .some((e) => e.reference.passageId === expected.get(q))
    )
      exactHits++;
    for (const e of result.evidence) {
      knowledgeEvidence(s, { kind: e.kind, ...e.reference }, "local");
      citations++;
    }
  }
  const broadDurations = Array.from(
    { length: 20 },
    () => run("reviewed preparation formation").ms,
  ).sort((a, b) => a - b);
  durations.sort((a, b) => a - b);
  const percentile = (p) => durations[Math.ceil(p * durations.length) - 1];
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    buildId: buildIdentity(),
    hardware: {
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      ramBytes: totalmem(),
      platform: platform(),
      arch: arch(),
      node: process.versions.node,
    },
    variant: "unified-lexical",
    broadQueries: {
      count: 20,
      warmP50Ms: broadDurations[9],
      warmP95Ms: broadDurations[18],
      quality: "unlabelled workload; no relevance claim",
    },
    units: s.one("SELECT count(*) n FROM passages").n,
    sources: 100,
    queries: queries.length,
    firstQueryMs: first.ms,
    warmP50Ms: percentile(0.5),
    warmP95Ms: percentile(0.95),
    processPeakRssKiB: process.resourceUsage().maxRSS,
    databaseBytes: statSync(s.path(".hoi/os.sqlite")).size,
    walBytes: statSync(s.path(".hoi/os.sqlite-wal")).size,
    exactIdentifierHitsAt5: exactHits,
    exactReferencesResolved: citations,
    providerCostUSD: 0,
    modelBytes: 0,
    limitations: [
      "Generated exact-identifier workload, not the human-labelled bilingual quality corpus.",
      "First query follows fixture creation and is not a cold filesystem measurement.",
      "Semantic indexing, model worker memory, concurrent requests and multi-domain scaling are not measured.",
      "Not a clean-machine or Windows certification.",
    ],
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(JSON.stringify(report));
} finally {
  s.close();
  rmSync(root, { recursive: true, force: true });
}
