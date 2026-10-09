import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export function validateReviewPack(pack) {
  if (pack.status !== "draft-for-human-review")
    throw Error(
      "This validator handles draft packs only; it cannot approve labels",
    );
  const records = new Map(pack.records.map((r) => [r.id, r]));
  if (records.size !== pack.records.length)
    throw Error("Duplicate fixture record");
  const ids = new Set(),
    families = new Map(),
    counts = { development: 0, "held-out": 0, en: 0, fr: 0 };
  for (const c of pack.cases) {
    if (ids.has(c.id) || !c.id)
      throw Error("Duplicate or missing case identity");
    ids.add(c.id);
    if (
      !["development", "held-out"].includes(c.split) ||
      !["en", "fr"].includes(c.language)
    )
      throw Error("Invalid split/language");
    if (families.has(c.family) && families.get(c.family) !== c.split)
      throw Error("Family crosses splits");
    families.set(c.family, c.split);
    if (
      c.review?.status !== "pending" ||
      c.review.reviewer !== null ||
      c.review.at !== null
    )
      throw Error("Draft must not claim human approval");
    if (c.exactEngineReferences !== null)
      throw Error(
        "Materialized references require a separate verified run artifact",
      );
    for (const ref of [...c.proposedRelevant, ...c.proposedForbidden])
      if (records.get(ref)?.family !== c.family)
        throw Error("Missing or cross-family reference");
    if (c.proposedRelevant.some((r) => c.proposedForbidden.includes(r)))
      throw Error("Forbidden evidence cannot be relevant");
    if (c.proposedAbstain !== !c.proposedRelevant.length)
      throw Error("Inconsistent proposed answerability");
    if (!c.question?.trim() || !c.proposedAnswerFacts?.length)
      throw Error("Missing review material");
    counts[c.split]++;
    counts[c.language]++;
  }
  if (
    pack.cases.length !== 120 ||
    counts.development !== 40 ||
    counts["held-out"] !== 80 ||
    counts.en !== 60 ||
    counts.fr !== 60
  )
    throw Error(
      "Expected 120 cases: 40 development, 80 held-out, 60 per language",
    );
  return {
    cases: pack.cases.length,
    families: families.size,
    ...counts,
    humanApproved: 0,
    status: "structurally-valid-draft",
    acceptance: "not-certified",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const path = process.argv[2];
  if (!path) throw Error("Supply review-pack.json");
  console.log(
    JSON.stringify(validateReviewPack(JSON.parse(readFileSync(path, "utf8")))),
  );
}
