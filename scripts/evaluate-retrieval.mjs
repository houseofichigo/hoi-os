import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { Store } from "../dist/core/store.js";
import { retrieve } from "../dist/core/intake.js";
import { atomic, contained, uid } from "../dist/core/files.js";
const { values: v } = parseArgs({
  options: {
    workspace: { type: "string" },
    input: { type: "string" },
    host: { type: "string" },
    output: { type: "string" },
  },
});
if (
  !v.workspace ||
  !v.input ||
  !v.output ||
  !["codex", "claude"].includes(v.host)
)
  throw Error(
    "Supply --workspace, --input, --host codex|claude and --output (private file).",
  );
const product = fileURLToPath(new URL("..", import.meta.url)),
  output = resolve(v.output);
if (contained(product, output))
  throw Error("Keep real evaluation records outside the product repository.");
const cases = z
  .array(
    z
      .object({
        id: z.string().min(1),
        question: z.string().min(1),
        category: z.enum([
          "current",
          "outdated",
          "missing",
          "restricted",
          "ambiguous",
        ]),
        language: z.enum(["fr", "en"]),
        expected: z.array(
          z.object({ sourceId: z.string(), revisionId: z.string() }),
        ),
        forbiddenSourceIds: z.array(z.string()).default([]),
      })
      .strict(),
  )
  .min(30)
  .parse(JSON.parse(readFileSync(v.input, "utf8")));
if (new Set(cases.map((c) => c.id)).size !== cases.length)
  throw Error("Case IDs must be unique");
if (
  !["fr", "en"].every((x) => cases.some((c) => c.language === x)) ||
  !["current", "outdated", "missing", "restricted"].every((x) =>
    cases.some((c) => c.category === x),
  )
)
  throw Error(
    "Include French, English, current, outdated, missing and restricted cases",
  );
const s = new Store(resolve(v.workspace));
try {
  const rows = cases.map((c) => {
    for (const e of c.expected)
      if (
        !s.one(
          "SELECT id FROM revisions WHERE id=? AND source_id=?",
          e.revisionId,
          e.sourceId,
        )
      )
        throw Error(`Expected evidence does not exist: ${c.id}`);
    const result = retrieve(s, c.question, v.host, { limit: 5, latest: true });
    const hit = c.expected.length
      ? result.results.some((r) =>
          c.expected.some(
            (e) => e.sourceId === r.sourceId && e.revisionId === r.revisionId,
          ),
        )
      : result.results.length === 0;
    const leaked = result.results.some((r) =>
      c.forbiddenSourceIds.includes(r.sourceId),
    );
    return {
      id: c.id,
      answerable: c.expected.length > 0,
      passed: hit && !leaked,
      policyLeak: leaked,
      returned: result.results.map((r) => ({
        sourceId: r.sourceId,
        revisionId: r.revisionId,
        passageId: r.passageId,
      })),
      warnings: result.warnings,
    };
  });
  const answerable = rows.filter((r) => r.answerable),
    recallAt5 = answerable.length
      ? answerable.filter((r) => r.passed).length / answerable.length
      : null;
  const report = {
    schemaVersion: 1,
    id: uid("retrieval_eval"),
    createdAt: new Date().toISOString(),
    host: v.host,
    recallAt5,
    passed:
      recallAt5 !== null &&
      recallAt5 >= 0.9 &&
      rows.filter((r) => !r.answerable).every((r) => r.passed) &&
      !rows.some((r) => r.policyLeak),
    rows,
  };
  // Exclusive output preserves previous evaluation records.
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  writeFileSync(output, JSON.stringify(report, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ recallAt5, passed: report.passed, cases: rows.length }),
  );
  if (!report.passed) process.exitCode = 1;
} finally {
  s.close();
}
