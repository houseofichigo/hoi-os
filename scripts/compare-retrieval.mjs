import { evaluateRetrieval } from "./retrieval-metrics.mjs";
export function compareRetrieval(baseline, candidate) {
  const a = evaluateRetrieval(baseline),
    b = evaluateRetrieval(candidate),
    byId = new Map(candidate.map((r) => [r.id, r]));
  if (baseline.length !== candidate.length)
    throw Error("Comparison requires identical cases");
  for (const row of baseline) {
    const other = byId.get(row.id);
    if (
      !other ||
      JSON.stringify([
        row.question,
        row.split,
        row.relevant,
        row.forbidden,
        row.abstain,
      ]) !==
        JSON.stringify([
          other.question,
          other.split,
          other.relevant,
          other.forbidden,
          other.abstain,
        ])
    )
      throw Error("Comparison labels or questions differ");
  }
  const before = new Map(a.rows.map((r) => [r.id, r]));
  return {
    status: "unreviewed-diagnostic-comparison",
    acceptance: "not-certified",
    baseline: {
      recallAt5: a.recallAt5,
      ndcgAt10: a.ndcgAt10,
      leaks: a.leakCount,
    },
    candidate: {
      recallAt5: b.recallAt5,
      ndcgAt10: b.ndcgAt10,
      leaks: b.leakCount,
    },
    improved: b.rows
      .filter(
        (r) => r.recallAt5 !== null && r.recallAt5 > before.get(r.id).recallAt5,
      )
      .map((r) => r.id),
    regressed: b.rows
      .filter(
        (r) => r.recallAt5 !== null && r.recallAt5 < before.get(r.id).recallAt5,
      )
      .map((r) => r.id),
    unanswerableCasesReturningEvidence: {
      baseline: baseline.filter((r) => r.abstain && r.returned.length).length,
      candidate: candidate.filter((r) => r.abstain && r.returned.length).length,
      total: baseline.filter((r) => r.abstain).length,
    },
    limitations: [
      "Returning evidence is not proof that a question is answerable.",
      "No answers or independently approved labels are included; factual support and answer abstention remain unmeasured.",
    ],
  };
}
