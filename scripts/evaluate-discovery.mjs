import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, cpus, totalmem, platform, arch } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../dist/core/store.js";
import { ingest } from "../dist/core/intake.js";
import {
  saveConversationArtifact,
  artifactEvidence,
} from "../dist/core/conversation-artifacts.js";
import { writeYaml } from "../dist/core/files.js";
const corpus = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/discovery/cases.json", import.meta.url),
  ),
);
const root = mkdtempSync(join(tmpdir(), "hoi-discovery-eval-"));
initialize(join(root, "workspace"));
const s = new Store(join(root, "workspace"));
const results = [];
try {
  for (const c of corpus.cases) {
    const file = join(root, c.id + ".md");
    writeFileSync(
      file,
      c.distractor + "\n\n" + (c.answerPassage ?? "Nothing else recorded."),
    );
    const r = await ingest(s, file, { host: "local" }),
      ps = s.all(
        "SELECT id passageId,revision_id revisionId,text FROM passages WHERE revision_id=? ORDER BY rowid",
        r.revisionId,
      );
    const claim = (p) => ({
      text: p.text,
      evidence: [
        { revisionId: r.revisionId, passageId: p.passageId, quote: p.text },
      ],
    });
    const a = {
      topic: c.family,
      questions: [],
      summary: [claim(ps[0]), claim(ps[1])],
      decisions: [],
      proposedActions: [],
      openQuestions: [],
    };
    // Link the authored retrieval question to the corresponding claim through v2
    // for ranking evaluation; legacy comparison has only global question mapping.
    const { saveObservations } =
      await import("../dist/core/conversation-artifacts.js");
    saveObservations(
      s,
      "local",
      {
        topic: c.family,
        observations: ps.map((p, i) => ({
          ...claim(p),
          kind: "constraint",
          questions: i === 1 && c.mode !== "missing" ? [c.query] : [],
        })),
      },
      { passages: ps },
      {
        id: c.id,
        instructionDigest: "frozen-v1",
        coverage: "fictional complete selection",
      },
    );
    if (c.mode === "restricted")
      writeYaml(s.path("policies/actions.yaml"), {
        ...s.policy(),
        deniedSources: [...s.policy().deniedSources, r.sourceId],
      });
    // Exact source-scope removes unrelated corpus families from this unit-ranking test.
    const start = performance.now();
    const found = artifactEvidence(s, "local", c.query).filter(
      (e) => e.revisionId === r.revisionId,
    );
    const elapsed = performance.now() - start;
    const old = { ...a, questions: c.mode !== "missing" ? [c.query] : [] };
    const tokens = c.query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
    const baseline =
      c.mode === "restricted"
        ? []
        : tokens.some((t) => JSON.stringify(old).toLowerCase().includes(t))
          ? ps.map((p) => p.passageId)
          : [];
    const relevant = c.mode === "answerable" ? ps[1].passageId : null;
    const score = (ids) => ({
      recall5: relevant ? Number(ids.slice(0, 5).includes(relevant)) : null,
      ndcg10:
        relevant && ids.slice(0, 10).includes(relevant)
          ? 1 / Math.log2(ids.indexOf(relevant) + 2)
          : 0,
      emptyResult: !relevant ? Number(ids.length === 0) : null,
    });
    results.push({
      id: c.id,
      split: c.split,
      family: c.family,
      language: c.language,
      mode: c.mode,
      baseline: score(baseline),
      ranked: score(found.map((x) => x.passageId)),
      latencyMs: elapsed,
    });
  }
  const aggregate = (split, variant) => {
    const rows = results.filter((x) => x.split === split),
      a = rows.filter((x) => x.mode === "answerable"),
      m = rows.filter((x) => x.mode !== "answerable");
    return {
      cases: rows.length,
      recall5: a.reduce((n, x) => n + x[variant].recall5, 0) / a.length,
      ndcg10: a.reduce((n, x) => n + x[variant].ndcg10, 0) / a.length,
      emptyResultRate:
        m.reduce((n, x) => n + x[variant].emptyResult, 0) / m.length,
    };
  };
  console.log(
    JSON.stringify(
      {
        version: corpus.version,
        labels: "provisional; independent human review pending",
        scope:
          "source-scoped discovery-unit ranking; not end-to-end answer certification",
        variants: {
          baseline: {
            dev: aggregate("dev", "baseline"),
            heldout: aggregate("heldout", "baseline"),
          },
          ranked: {
            dev: aggregate("dev", "ranked"),
            heldout: aggregate("heldout", "ranked"),
          },
          hybrid: "not measured: requires verified opt-in model",
        },
        hardware: {
          cpu: cpus()[0].model,
          platform: platform(),
          arch: arch(),
          ram: totalmem(),
        },
        results,
      },
      null,
      2,
    ),
  );
} finally {
  s.close();
  rmSync(root, { recursive: true, force: true });
}
