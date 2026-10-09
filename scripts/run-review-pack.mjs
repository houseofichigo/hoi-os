import { cpus, totalmem, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
import { compareRetrieval } from "./compare-retrieval.mjs";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initialize, Store } from "../dist/core/store.js";
import { ingest } from "../dist/core/intake.js";
import { saveWikiDraft, publishWiki } from "../dist/core/wiki-core.js";
import {
  proposeMemory,
  memoryGet,
  reviewVersionedMemory,
} from "../dist/core/reviewed-memory.js";
import { sourceImpact, changeSource } from "../dist/core/hub.js";
import {
  collectUnits,
  configureSemantic,
  installLocalModel,
  rebuildKnowledge,
  prepareSemanticQuery,
  MODEL_FINGERPRINT,
} from "../dist/core/semantic.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";
import { sha } from "../dist/core/files.js";
import { buildIdentity } from "../dist/core/security-evidence.js";
import { validateReviewPack } from "./validate-review-pack.mjs";
import { evaluateRetrieval } from "./retrieval-metrics.mjs";
const identity = (ref) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(ref).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
export async function runReviewPack(pack, directory, options = {}) {
  const hybrid = options.variant === "hybrid";
  if (options.variant && !hybrid && options.variant !== "lexical")
    throw Error("Unknown variant");
  if (hybrid && !options.modelDirectory)
    throw Error("Verified offline model directory required");
  if (
    options.distractors !== undefined &&
    (!Number.isInteger(options.distractors) ||
      options.distractors < 0 ||
      options.distractors > 10000)
  )
    throw Error("Distractor count must be 0..10000");
  if (options.distractors && !options.shared)
    throw Error("Distractors require a shared fixture");
  validateReviewPack(pack);
  const root = resolve(directory);
  mkdirSync(root); // Exclusive new directory; never select an existing workspace.
  const mapping = {},
    rows = [],
    fixtures = [],
    baselineRows = [],
    timings = [];
  const families = [...new Set(pack.cases.map((c) => c.family))];
  const groups = options.shared ? ["shared"] : families;
  const measurements = [];
  for (const [index, family] of groups.entries()) {
    const workspace = join(root, `fixture-${index}`);
    initialize(workspace);
    const s = new Store(workspace),
      sourceIds = {};
    try {
      const records = pack.records.filter(
        (r) => options.shared || r.family === family,
      );
      for (const [i, r] of records.entries()) {
        if (r.kind === "source") {
          // The fixed fixture specification, not instructions in the source, controls state.
          const temporal = r.id === "birch/old" || r.id === "birch/new";
          const file = join(
            root,
            `original-${index}-${temporal ? "venue" : i}.md`,
          );
          // Preserve both synthetic originals before reimporting the same logical source location.
          writeFileSync(join(root, `preserved-${index}-${i}.md`), r.text, {
            flag: "wx",
          });
          writeFileSync(file, r.text);
          const imported = await ingest(s, file, {
            host: "local",
            metadata:
              r.id === "ember/restricted" ? { allowedHosts: ["local"] } : {},
          });
          sourceIds[r.id] = imported.sourceId;
          if (temporal) {
            const date = r.id === "birch/old" ? "2026-01-02" : "2026-01-20";
            s.exec(
              "UPDATE revisions SET created_at=? WHERE id=?",
              date + "T12:00:00.000Z",
              imported.revisionId,
            );
          }
          mapping[r.id] = s
            .all(
              "SELECT id FROM passages WHERE revision_id=?",
              imported.revisionId,
            )
            .map((p) => ({
              kind: "source",
              revisionId: imported.revisionId,
              passageId: p.id,
            }));
        } else if (r.kind === "wiki") {
          const d = saveWikiDraft(
            s,
            {
              title: r.id,
              type: "topic",
              blocks: [
                {
                  id: "body",
                  heading: "Fixture statement",
                  text: r.text,
                  kind: "user-authored",
                  evidence: [],
                },
              ],
            },
            "local",
          );
          publishWiki(
            s,
            {
              pageId: d.pageId,
              revisionId: d.id,
              expectedVersion: d.version,
              confirm: true,
            },
            "local",
          );
          mapping[r.id] = [
            {
              kind: "wiki",
              pageId: d.pageId,
              wikiRevisionId: d.id,
              blockId: "body",
            },
          ];
        } else if (r.kind === "memory") {
          const m = proposeMemory(
            s,
            {
              requestKey: "fixture-memory-" + r.id,
              attributedStatement: true,
              memory: { type: "preference", content: r.text },
            },
            "local",
          );
          const current = memoryGet(s, m.id, "local");
          reviewVersionedMemory(
            s,
            {
              id: m.id,
              expectedVersion: current.version,
              expectedChecksum: current.checksum,
              requestKey: "fixture-review-" + r.id,
              state: "approved",
              confirm: true,
            },
            "local",
          );
          mapping[r.id] = collectUnits(s, "local")
            .filter((u) => u.recordId === m.id)
            .map((u) => u.reference);
        } else throw Error("Unsupported fixture kind");
      }
      if (sourceIds["pearl/archived"]) {
        const id = sourceIds["pearl/archived"],
          impact = sourceImpact(s, id, "local");
        changeSource(
          s,
          { id, expectedVersion: 0, digest: impact.digest, state: "archived" },
          "local",
        );
      }
      for (let i = 0; i < (options.distractors ?? 0); i++) {
        const text = `Unrelated fictional account DISTRACTOR-${i}. ${["Coaching workshop venue and owner pending.", "Formation : horaire et capacité à confirmer.", "Written agenda, delivery materials and preparation checklist.", "Atelier pratique : participants et coordination."][i % 4]} This record does not describe any named evaluation subject.`;
        const path = join(root, `distractor-${i}.md`);
        writeFileSync(path, text, { flag: "wx" });
        await ingest(s, path, { host: "local" });
      }
      const measurement = {
        fixture: family,
        eligibleUnits: collectUnits(s, "local").length,
        sources: s.one("SELECT count(*) n FROM sources").n,
        distractors: options.distractors ?? 0,
      };
      const inputFor = (c) => ({
        query: options.shared
          ? `Subject ${c.family}. ${c.question}`
          : c.question,
        limit: 10,
        ...(c.family === "birch" && c.question.includes("2026-01-10")
          ? { asOf: "2026-01-10" }
          : {}),
      });
      const baseline = new Map(
        pack.cases
          .filter((c) => options.shared || c.family === family)
          .map((c) => [c.id, knowledgeSearch(s, inputFor(c), c.host)]),
      );
      if (hybrid) {
        configureSemantic(s, "local", { enabled: true, confirm: true });
        await installLocalModel(s, "local", {
          confirm: true,
          directory: options.modelDirectory,
        });
        const indexingStarted = performance.now();
        await rebuildKnowledge(s, "local", {
          requestKey: "diagnostic-" + family,
        });
        measurement.indexingMs = performance.now() - indexingStarted;
      }
      let resolved = 0;
      for (const c of pack.cases.filter(
        (c) => options.shared || c.family === family,
      )) {
        const asOf =
          c.family === "birch" && c.question.includes("2026-01-10")
            ? "2026-01-10"
            : undefined;
        const dated = (ref) => ({ ...ref, ...(asOf ? { asOf } : {}) });
        const relevant = c.proposedRelevant.flatMap((k) =>
          mapping[k].map(dated),
        );
        for (const ref of relevant) {
          knowledgeEvidence(s, ref, c.host);
          resolved++;
        }
        const start = performance.now();
        if (hybrid && !asOf) await prepareSemanticQuery(s, c.host, inputFor(c).query);
        const result = hybrid
          ? knowledgeSearch(s, inputFor(c), c.host)
          : baseline.get(c.id);
        if (hybrid && !asOf && result.coverage.mode !== "hybrid")
          throw Error(`Expected hybrid retrieval for ${c.id}, got ${result.coverage.mode}`);
        if (hybrid)
          timings.push({
            id: c.id,
            ms: performance.now() - start,
            mode: result.coverage.mode,
            historical: !!asOf,
          });
        const returned = result.evidence.map((e) => ({
          kind: e.kind,
          ...e.reference,
        }));
        for (const ref of returned) {
          knowledgeEvidence(s, ref, c.host);
          resolved++;
        }
        const forbidden = [
          ...new Set(
            options.shared
              ? pack.cases.flatMap((q) => q.proposedForbidden)
              : c.proposedForbidden,
          ),
        ].flatMap((k) => mapping[k]);
        for (const ref of forbidden) {
          let denied = false;
          try {
            knowledgeEvidence(s, ref, c.host);
          } catch {
            denied = true;
          }
          if (!denied) throw Error("Fixture access boundary not enforced");
        }
        const row = {
          id: c.id,
          family: c.family,
          split: c.split,
          language: c.language,
          question: inputFor(c).query,
          originalQuestion: c.question,
          review: c.review,
          abstain: c.proposedAbstain,
          relevant: relevant.map(identity),
          returned: returned.map(identity),
          forbidden: forbidden.map(identity),
          warnings: result.warnings,
        };
        rows.push(row);
        baselineRows.push({
          ...row,
          returned: baseline
            .get(c.id)
            .evidence.map((e) => identity({ kind: e.kind, ...e.reference })),
          warnings: baseline.get(c.id).warnings,
        });
      }
      measurement.databaseBytes = statSync(s.path(".hoi/os.sqlite")).size;
      measurement.walBytes = statSync(s.path(".hoi/os.sqlite-wal")).size;
      measurements.push(measurement);
      fixtures.push({
        family,
        directory: `fixture-${index}`,
        referencesResolved: resolved,
        records: records.map((r) => ({
          logicalId: r.id,
          sha256: sha(r.text),
          references: mapping[r.id],
        })),
      });
    } finally {
      if (hybrid) {
        configureSemantic(s, "local", { enabled: false, confirm: true });
        // Remove only this fresh fixture's disposable model copy; preserve originals, indexes and manifests.
        rmSync(s.path(`.hoi/models/${MODEL_FINGERPRINT}`), {
          recursive: true,
          force: true,
        });
      }
      s.close();
    }
  }
  const metrics = evaluateRetrieval(rows);
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    buildId: buildIdentity(),
    candidatePackHash: sha(JSON.stringify(pack)),
    status: "unreviewed-diagnostic-run",
    acceptance: "not-certified",
    humanApproved: 0,
    variant: hybrid ? "hybrid-local" : "unified-lexical",
    ...(hybrid
      ? {
          modelFingerprint: MODEL_FINGERPRINT,
          comparison: compareRetrieval(baselineRows, rows),
          queryTimings: timings,
        }
      : {}),
    providerCalls: 0,
    layout: options.shared ? "shared-with-explicit-subject" : "isolated",
    hardware: {
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      ramBytes: totalmem(),
      platform: platform(),
      arch: arch(),
      node: process.versions.node,
    },
    measurements,
    processPeakRssKiB: process.resourceUsage().maxRSS,
    fixtures,
    metrics,
    limitations: [
      ...(options.shared ? ["Shared queries include explicit subject-family context; they are not directly comparable with the isolated unqualified questions. Distractors are synthetic templates, not a representative company corpus."] : []),
      "Proposed labels were authored by an assistant and have not been independently approved.",
      "Scenario split is not sealed; this is not held-out acceptance evidence.",
      "Temporal fixture revision timestamps are seeded directly in the disposable database; originals and revision IDs are created by ingestion.",
      "Wiki and memory fixture statements are explicitly user-attributed, not independently verified.",
      "Contradiction, duplicate lineage, alias and incomplete-thread expectations remain content-level review scenarios, not complete connector or relationship fixtures.",
      "No answers were generated: factual support and answer abstention are unmeasured.",
    ],
  };
  writeFileSync(
    join(root, "run.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  writeFileSync(
    join(root, "scoring-input.json"),
    JSON.stringify(rows, null, 2) + "\n",
    { flag: "wx" },
  );
  if (hybrid)
    writeFileSync(
      join(root, "baseline-scoring-input.json"),
      JSON.stringify(baselineRows, null, 2) + "\n",
      { flag: "wx" },
    );
  return report;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, directory, modelDirectory, distractors] = process.argv.slice(2);
  if (!input || !directory)
    throw Error(
      "Usage: node scripts/run-review-pack.mjs review-pack.json NEW_DIRECTORY [VERIFIED_MODEL_DIRECTORY [DISTRACTOR_COUNT]]",
    );
  const r = await runReviewPack(
    JSON.parse(readFileSync(input, "utf8")),
    directory,
    {
      ...(modelDirectory ? { variant: "hybrid", modelDirectory } : {}),
      ...(distractors !== undefined
        ? { shared: true, distractors: Number(distractors) }
        : {}),
    },
  );
  console.log(
    JSON.stringify({
      cases: r.metrics.cases,
      provisionalRecallAt5: r.metrics.recallAt5,
      leaks: r.metrics.leakCount,
      acceptance: r.acceptance,
    }),
  );
}
