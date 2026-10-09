import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fingerprint } from "./answer-evaluation.mjs";
export function diagnoseRanking(packet) {
  if (!Array.isArray(packet.cases)) throw Error("Evidence packet required");
  return {
    version: 1,
    packetHash: fingerprint(packet),
    status: "unreviewed-diagnostic",
    rankingChanged: false,
    cases: packet.cases
      .filter((c) => !c.proposedAbstain)
      .map((c) => {
        const relevant = c.references.filter((r) => r.proposedRelevant);
        return {
          id: c.id,
          language: c.language,
          split: c.split,
          expected: relevant.length,
          topFive: relevant.filter(
            (r) => Number.isInteger(r.rank) && r.rank > 0 && r.rank <= 5,
          ).length,
          missed: relevant
            .filter(
              (r) => !Number.isInteger(r.rank) || r.rank < 1 || r.rank > 5,
            )
            .map((r) => ({ reference: r.reference, rank: r.rank })),
        };
      }),
    limitations: [
      "Proposed labels are not independent human judgments.",
      "Ranks describe the frozen packet, not current runtime performance. No ranking weights or labels were changed.",
    ],
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output)
    throw Error(
      "Usage: diagnose-review-ranking.mjs packet.json new-report.json",
    );
  writeFileSync(
    output,
    JSON.stringify(
      diagnoseRanking(JSON.parse(readFileSync(input, "utf8"))),
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
}
