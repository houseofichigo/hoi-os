import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { compareSkillTrials } from "../dist/core/skill-trials.js";
try {
  const { values } = parseArgs({
    options: { input: { type: "string" }, output: { type: "string" } },
  });
  if (!values.input)
    throw Error("Use --input comparison.json [--output new-report.json]");
  const input = resolve(values.input);
  const report = compareSkillTrials(
    dirname(input),
    JSON.parse(readFileSync(input, "utf8")),
  );
  const output = JSON.stringify(report, null, 2) + "\n";
  if (values.output)
    writeFileSync(resolve(values.output), output, { flag: "wx", mode: 0o600 });
  else process.stdout.write(output);
  if (report.decision !== "needs-human-review") process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
