import { readFileSync, writeFileSync } from "node:fs";
import { evaluateRetrieval } from "./retrieval-metrics.mjs";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error("Usage: node scripts/score-retrieval.mjs cases.json report.json");
const report = evaluateRetrieval(JSON.parse(readFileSync(input, "utf8")));
writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
console.log(
  JSON.stringify({
    cases: report.cases,
    heldOut: report.heldOut,
    recallAt5: report.recallAt5,
    acceptance: report.acceptance,
  }),
);
