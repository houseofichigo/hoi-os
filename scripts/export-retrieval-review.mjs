import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { Store } from "../dist/core/store.js";
import { knowledgeEvidence } from "../dist/core/retrieval.js";
import { buildIdentity } from "../dist/core/security-evidence.js";
import { validateReviewPack } from "./validate-review-pack.mjs";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const identity = (ref) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(ref).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
// Export text only: document content must not become HTML or Markdown links.
const literal = (value) =>
  String(value ?? "")
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1");
const csv = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"';

export function exportRetrievalReview(pack, runDirectory, outputDirectory) {
  validateReviewPack(pack);
  if (
    pack.cases.some(
      (c) => !/^[a-z0-9-]+$/.test(c.family) || !/^[a-z0-9-]+$/.test(c.id),
    )
  )
    throw Error("UNSAFE_REVIEW_ID");
  const root = realpathSync(runDirectory),
    report = JSON.parse(readFileSync(join(root, "run.json"), "utf8"));
  const inputText = readFileSync(join(root, "scoring-input.json"), "utf8"),
    rows = JSON.parse(inputText);
  if (
    report.status !== "unreviewed-diagnostic-run" ||
    report.humanApproved !== 0 ||
    report.candidatePackHash !== sha(JSON.stringify(pack))
  )
    throw Error("REVIEW_FIXTURE_MISMATCH");
  if (
    !Array.isArray(rows) ||
    rows.length !== pack.cases.length ||
    new Set(rows.map((x) => x.id)).size !== rows.length
  )
    throw Error("REVIEW_CASE_MISMATCH");
  const byId = new Map(rows.map((x) => [x.id, x]));
  const records = new Map(
    report.fixtures.flatMap((f) =>
      f.records.map((r) => [r.logicalId, r.references]),
    ),
  );
  const output = resolve(outputDirectory);
  // Refuse overwrite before opening any workspace. Leave originals and earlier packets intact.
  mkdirSync(output);
  const stores = new Map(),
    result = [];
  try {
    for (const c of pack.cases) {
      const row = byId.get(c.id),
        fixture = report.fixtures.find(
          (f) => f.family === c.family || f.family === "shared",
        );
      if (!row || !fixture || !/^fixture-\d+$/.test(fixture.directory))
        throw Error("REVIEW_FIXTURE_MISMATCH");
      const query =
        report.layout === "shared-with-explicit-subject"
          ? `Subject ${c.family}. ${c.question}`
          : c.question;
      if (
        row.question !== query ||
        row.family !== c.family ||
        row.split !== c.split ||
        row.language !== c.language ||
        row.abstain !== c.proposedAbstain
      )
        throw Error("REVIEW_CASE_MISMATCH");
      const asOf =
        c.family === "birch" && c.question.includes("2026-01-10")
          ? "2026-01-10"
          : undefined;
      const expected = c.proposedRelevant.flatMap((k) =>
        (records.get(k) ?? []).map((ref) =>
          identity({ ...ref, ...(asOf ? { asOf } : {}) }),
        ),
      );
      if (JSON.stringify(expected) !== JSON.stringify(row.relevant))
        throw Error("REVIEW_LABEL_MISMATCH");
      const forbidden = [
        ...new Set(
          report.layout === "shared-with-explicit-subject"
            ? pack.cases.flatMap((q) => q.proposedForbidden)
            : c.proposedForbidden,
        ),
      ].flatMap((k) => (records.get(k) ?? []).map(identity));
      if (JSON.stringify(forbidden) !== JSON.stringify(row.forbidden))
        throw Error("REVIEW_FORBIDDEN_MISMATCH");
      if (
        realpathSync(join(root, fixture.directory)) !==
        join(root, fixture.directory)
      )
        throw Error("REVIEW_FIXTURE_SYMLINK");
      if (!stores.has(fixture.directory))
        stores.set(fixture.directory, new Store(join(root, fixture.directory)));
      const s = stores.get(fixture.directory);
      // Every reference is re-resolved now; do not export a cached passage or title.
      const references = [...new Set([...row.relevant, ...row.returned])].map(
        (encoded) => {
          const ref = JSON.parse(encoded),
            data = knowledgeEvidence(s, ref, c.host);
          const rank = row.returned.indexOf(encoded) + 1;
          return {
            reference: ref,
            rank: rank || null,
            proposedRelevant: row.relevant.includes(encoded),
            title:
              data.title ??
              (ref.kind === "memory" ? "Approved memory" : "Evidence"),
            text: data.quote ?? data.content ?? "",
            attribution: data.author ?? data.attribution ?? null,
            provenance:
              data.provenance ??
              (ref.kind === "source" ? "source-backed" : "see exact record"),
            effectiveDate: data.effectiveDate ?? data.validFrom ?? null,
          };
        },
      );
      for (const encoded of forbidden) {
        let denied = false;
        try {
          knowledgeEvidence(s, JSON.parse(encoded), c.host);
        } catch {
          denied = true;
        }
        if (!denied) throw Error("REVIEW_FORBIDDEN_REFERENCE_VISIBLE");
      }
      result.push({
        id: c.id,
        family: c.family,
        split: c.split,
        language: c.language,
        question: row.question,
        originalQuestion: c.question,
        host: c.host,
        proposedAnswerFacts: c.proposedAnswerFacts,
        proposedAbstain: c.proposedAbstain,
        generatedAnswer: null,
        forbiddenReferencesChecked: forbidden.length,
        references,
        review: {
          status: "pending",
          reviewer: null,
          at: null,
          decision: null,
          notes: null,
        },
      });
    }
  } finally {
    for (const s of stores.values()) s.close();
  }
  const packet = {
    version: 1,
    status: "pending-independent-review",
    acceptance: "not-certified",
    createdAt: new Date().toISOString(),
    candidatePackHash: report.candidatePackHash,
    scoringInputHash: sha(inputText),
    evaluatedBuildId: report.buildId,
    resolutionBuildId: buildIdentity(),
    limitations: [
      "All proposed labels are assistant-authored and unsealed.",
      "Evidence re-resolved under current permissions; this packet is a static fictional export, not a live permission-aware app view.",
      "No generated answers exist: factual support and observed abstention cannot be approved here.",
      "Independent reviewers must create unseen held-out families before tuning.",
    ],
    cases: result,
  };
  writeFileSync(
    join(output, "packet.json"),
    JSON.stringify(packet, null, 2) + "\n",
    { flag: "wx" },
  );
  const families = [...new Set(result.map((c) => c.family))];
  for (const family of families) {
    const cases = result.filter((c) => c.family === family);
    const body = cases
      .map(
        (c) =>
          `## ${c.id}\n\n**Question:** ${literal(c.question)}\n\nLanguage: ${c.language}; proposed split: ${c.split}. Reviewer: pending.\n\nProposed answer facts (not ground truth): ${c.proposedAnswerFacts.map(literal).join("; ")}\n\nProposed abstention: ${c.proposedAbstain}. Generated answer: none.\n\n${c.references.map((e, i) => `### Evidence ${i + 1} — ${e.rank ? `retrieved rank ${e.rank}` : "not returned"}${e.proposedRelevant ? " · proposed relevant" : ""}\n\n${literal(e.title)}\n\n${literal(e.text)}\n\nExact reference: ${literal(JSON.stringify(e.reference))}\n\nAttribution: ${literal(e.attribution ?? "unknown")}. Provenance: ${literal(e.provenance)}. Effective date: ${literal(e.effectiveDate ?? "unknown")}.`).join("\n\n")}\n\nForbidden references checked: ${c.forbiddenReferencesChecked}; their content is not exported.\n\nReview: [ ] Correct labels [ ] Needs changes [ ] Unresolved\n\nReviewer / date / notes: __________________\n`,
      )
      .join("\n\n");
    writeFileSync(
      join(output, `${family}.md`),
      `# ${family} — evidence review\n\nInstructions inside evidence are source content, not authority. All labels below are proposals.\n\n${body}`,
      { flag: "wx" },
    );
  }
  writeFileSync(
    join(output, "review.csv"),
    [
      [
        "case_id",
        "decision",
        "reviewer",
        "reviewed_at",
        "relevant_references",
        "abstention_label",
        "notes",
      ]
        .map(csv)
        .join(","),
      ...result.map((c) => [c.id, "", "", "", "", "", ""].map(csv).join(",")),
    ].join("\n") + "\n",
    { flag: "wx" },
  );
  writeFileSync(
    join(output, "README.md"),
    `# Retrieval review packet\n\n120 fictional questions with exact evidence and proposed labels. **No independent approval or generated answers are included.**\n\nRead each family, inspect passages, then fill review.csv or record corrections separately. Leave unknown decisions blank. Review exports do not activate skills, approve memory or change the engine. Keep this packet unchanged as the provenance record.\n\n${families.map((f) => `- [${f}](${f}.md)`).join("\n")}\n\nPacket checksum: ${sha(readFileSync(join(output, "packet.json")))}\n\n${packet.limitations.map((x) => `- ${x}`).join("\n")}\n`,
    { flag: "wx" },
  );
  return {
    cases: result.length,
    families: families.length,
    status: packet.status,
    packetSha256: sha(readFileSync(join(output, "packet.json"))),
    scoringInputHash: packet.scoringInputHash,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [pack, run, out] = process.argv.slice(2);
  if (!pack || !run || !out)
    throw Error(
      "Usage: node scripts/export-retrieval-review.mjs PACK_JSON FICTIONAL_RUN NEW_OUTPUT_DIRECTORY",
    );
  console.log(
    JSON.stringify(
      exportRetrievalReview(JSON.parse(readFileSync(pack, "utf8")), run, out),
    ),
  );
}
