import { createHash } from "node:crypto";
const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function evaluateRetrieval(cases) {
  if (!Array.isArray(cases) || !cases.length)
    throw Error("Evaluation cases required");
  const ids = new Set(),
    families = new Map();
  for (const c of cases) {
    if (
      !c.id ||
      ids.has(c.id) ||
      !c.family ||
      !["development", "held-out"].includes(c.split)
    )
      throw Error("Invalid case identity or split");
    ids.add(c.id);
    if (families.has(c.family) && families.get(c.family) !== c.split)
      throw Error("Scenario family crosses splits");
    families.set(c.family, c.split);
    if (
      !Array.isArray(c.relevant) ||
      !Array.isArray(c.returned) ||
      typeof c.abstain !== "boolean"
    )
      throw Error("Explicit relevance and abstention labels required");
    if (
      c.relevant.some((x) => typeof x !== "string") ||
      c.returned.some((x) => typeof x !== "string")
    )
      throw Error("Exact evidence identity strings required");
    if (!c.abstain && !c.relevant.length)
      throw Error("Answerable case requires relevance labels");
    if (c.abstain && c.relevant.length)
      throw Error("Abstention case cannot have relevant evidence");
  }
  const rows = cases.map((c) => {
    const relevant = new Set(c.relevant),
      returned = [...new Set(c.returned)],
      hits = returned.slice(0, 5).filter((x) => relevant.has(x)).length;
    const ideal = Array.from(
      { length: Math.min(10, relevant.size) },
      (_, i) => 1 / Math.log2(i + 2),
    ).reduce((a, b) => a + b, 0);
    return {
      id: c.id,
      split: c.split,
      reviewed:
        c.review?.status === "approved" &&
        !!c.review.reviewer &&
        !!c.review.at &&
        Number.isFinite(Date.parse(c.review.at)),
      recallAt5: relevant.size ? hits / relevant.size : null,
      ndcgAt10: ideal
        ? returned
            .slice(0, 10)
            .reduce(
              (n, x, i) => n + (relevant.has(x) ? 1 / Math.log2(i + 2) : 0),
              0,
            ) / ideal
        : null,
      leaks: returned.filter((x) => (c.forbidden ?? []).includes(x)),
      abstentionCorrect:
        c.abstain && typeof c.answerAbstained === "boolean"
          ? c.answerAbstained === true
          : null,
    };
  });
  const held = rows.filter((r) => r.split === "held-out");
  return {
    version: 1,
    corpusHash: createHash("sha256")
      .update(
        JSON.stringify(
          cases.map(({ returned, answerAbstained, ...label }) => label),
        ),
      )
      .digest("hex"),
    cases: cases.length,
    heldOut: held.length,
    reviewed: rows.filter((r) => r.reviewed).length,
    recallAt5: mean(held.map((r) => r.recallAt5).filter((x) => x !== null)),
    ndcgAt10: mean(held.map((r) => r.ndcgAt10).filter((x) => x !== null)),
    correctAbstention: mean(
      held
        .map((r) => r.abstentionCorrect)
        .filter((x) => x !== null)
        .map(Number),
    ),
    leakCount: rows.reduce((n, r) => n + r.leaks.length, 0),
    acceptance: "not-certified",
    limitations: [
      "Metrics describe supplied run results; this scorer does not certify provenance, citation resolution or factual support.",
      "Human-reviewed labels and reviewed generated answers are required for product acceptance.",
    ],
    rows,
  };
}
