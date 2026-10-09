import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
const count = z.number().int().nonnegative();
const metric = z
  .object({ total: count, correct: count })
  .strict()
  .refine((v) => v.correct <= v.total);
export const pilotSchema = z
  .object({
    version: z.literal(1),
    heldOut: z.boolean(),
    extraction: z
      .object({
        labeled: count,
        proposals: metric,
        explicitCommitments: metric,
      })
      .strict(),
    duplicates: z
      .object({
        labeled: count,
        candidates: metric,
        incorrectAutomaticMerges: count,
      })
      .strict(),
    retrieval: z
      .object({ labeled: count, answerable: metric, unanswerable: metric })
      .strict(),
    meetings: z.array(
      z
        .object({
          id: z.string().min(1),
          claims: metric,
          inventedCommitments: count,
          manualMinutes: z.number().positive(),
          assistedMinutes: z.number().nonnegative(),
        })
        .strict(),
    ),
    days: z.array(
      z.object({ date: z.string().date(), criticalDefects: count }).strict(),
    ),
    unresolvedCriticalDefects: count,
    checks: z
      .object({
        scopeApproved: z.boolean(),
        backupVerified: z.boolean(),
        recoveryRehearsed: z.boolean(),
        citationsResolve: z.boolean(),
        permissionsVerified: z.boolean(),
        codexFreshSession: z.boolean(),
        claudeFreshSession: z.boolean(),
        calendarAdapterVerified: z.boolean(),
        core: z.boolean(),
        browser: z.boolean(),
        platformCI: z.boolean(),
        packages: z.boolean(),
        publicationScan: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.days.map((d) => d.date)).size !== v.days.length)
      c.addIssue({ code: "custom", message: "Repeated pilot dates" });
    if (new Set(v.meetings.map((m) => m.id)).size !== v.meetings.length)
      c.addIssue({ code: "custom", message: "Repeated meeting IDs" });
    for (const d of v.days)
      if ([0, 6].includes(new Date(d.date + "T12:00:00Z").getUTCDay()))
        c.addIssue({
          code: "custom",
          message: "Pilot days must be working weekdays",
        });
  });
const ratio = (m) => (m.total ? m.correct / m.total : null);
export function readiness(
  input,
  today = new Date().toISOString().slice(0, 10),
) {
  const v = pilotSchema.parse(input);
  if (v.days.some((d) => d.date > today))
    throw Error("Future pilot days cannot count");
  const gates = [];
  const gate = (code, passed) => gates.push({ code, passed });
  gate("HELD_OUT", v.heldOut);
  gate(
    "EXTRACTION",
    v.extraction.labeled >= 100 &&
      v.extraction.proposals.total > 0 &&
      ratio(v.extraction.proposals) >= 0.95 &&
      v.extraction.explicitCommitments.total > 0 &&
      ratio(v.extraction.explicitCommitments) >= 0.9,
  );
  gate(
    "DUPLICATES",
    v.duplicates.labeled >= 50 &&
      v.duplicates.candidates.total > 0 &&
      ratio(v.duplicates.candidates) >= 0.95 &&
      v.duplicates.incorrectAutomaticMerges === 0,
  );
  gate(
    "RETRIEVAL",
    v.retrieval.labeled >= 30 &&
      v.retrieval.answerable.total > 0 &&
      ratio(v.retrieval.answerable) >= 0.9 &&
      v.retrieval.unanswerable.total > 0 &&
      ratio(v.retrieval.unanswerable) === 1,
  );
  gate(
    "MEETINGS",
    v.meetings.length >= 5 &&
      v.meetings.every(
        (m) =>
          m.claims.total > 0 &&
          ratio(m.claims) >= 0.95 &&
          m.inventedCommitments === 0,
      ),
  );
  const savings = v.meetings
    .map((m) => 1 - m.assistedMinutes / m.manualMinutes)
    .sort((a, b) => a - b);
  const mid = Math.floor(savings.length / 2);
  const median = savings.length
    ? savings.length % 2
      ? savings[mid]
      : (savings[mid - 1] + savings[mid]) / 2
    : null;
  gate("TIME_SAVING", median !== null && median >= 0.5);
  const days = [...v.days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  gate(
    "TEN_WORKING_DAYS",
    days.length === 10 && days.every((d) => d.criticalDefects === 0),
  );
  gate("CRITICAL_DEFECTS", v.unresolvedCriticalDefects === 0);
  for (const [code, passed] of Object.entries(v.checks)) gate(code, passed);
  return {
    version: 1,
    readyForReleaseReview: gates.every((g) => g.passed),
    basis:
      "User-recorded evaluation; this report does not independently verify claims or authorize publication.",
    gates,
    metrics: {
      extractionPrecision: ratio(v.extraction.proposals),
      extractionRecall: ratio(v.extraction.explicitCommitments),
      duplicateCandidateRecall: ratio(v.duplicates.candidates),
      retrievalRecallAt5: ratio(v.retrieval.answerable),
      medianTimeSaving: median,
      reviewedMeetings: v.meetings.length,
      recordedWorkingDays: v.days.length,
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv[2] !== "--input" || !process.argv[3])
      throw Error("Use --input <private pilot-record.json>");
    const r = readiness(JSON.parse(readFileSync(process.argv[3], "utf8")));
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = r.readyForReleaseReview ? 0 : 2;
  } catch {
    console.error(
      "PILOT_INPUT_INVALID: Provide valid private evaluation records; no contents exported.",
    );
    process.exitCode = 1;
  }
}
