import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const schema = JSON.parse(
  readFileSync(
    new URL("../references/project.schema.json", import.meta.url),
    "utf8",
  ),
);
const placeholder =
  /^(?:tbd|tbc|todo|unknown|n\/?a|null|undefined|none|not specified|not provided|to be (?:confirmed|determined|defined)|pending|[-?]+|<[^>]*>|\[[^\]]*\])$/i;
export function validate(value) {
  const issues = [];
  if (!value || Array.isArray(value) || typeof value !== "object")
    return [{ field: "payload", reason: "Expected a project object" }];
  for (const key of Object.keys(value))
    if (!schema.required.includes(key))
      issues.push({ field: key, reason: "Unexpected field" });
  for (const key of schema.required) {
    const v = value[key],
      rule = schema.properties[key];
    if (typeof v !== "string" || !v.trim() || placeholder.test(v.trim())) {
      issues.push({ field: key, reason: "Required non-placeholder string" });
      continue;
    }
    if (rule.enum && !rule.enum.includes(v))
      issues.push({ field: key, reason: "Invalid allowed value" });
    if (rule.format === "date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
      if (
        !match ||
        +match[1] === 0 ||
        !Number.isFinite(Date.parse(v + "T00:00:00Z")) ||
        new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
      )
        issues.push({ field: key, reason: "Invalid YYYY-MM-DD calendar date" });
    }
    if (
      key === "tags" &&
      v.split(",").some((x) => !x.trim() || placeholder.test(x.trim()))
    )
      issues.push({
        field: key,
        reason: "Tags require non-empty, non-placeholder entries",
      });
  }
  return issues;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const issues = validate(JSON.parse(readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify({ valid: issues.length === 0, issues }));
    process.exitCode = issues.length ? 1 : 0;
  } catch {
    console.error("Invalid or unreadable payload file.");
    process.exitCode = 1;
  }
}
