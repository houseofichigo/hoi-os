import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
const c = JSON.parse(readFileSync("learn/course.json"));
if (
  c.modules.length !== 8 ||
  new Set(c.modules.flatMap((m) => m.steps)).size !== 28
)
  throw Error("LEARN_STEP_MAPPING");
for (const m of c.modules) {
  const mark = `module:${m.id}; steps:${m.steps.join(",")}; version:${c.version}`;
  for (const locale of ["en", "fr"]) {
    const s = readFileSync("learn/" + m[locale], "utf8");
    if (!s.includes(mark) || s.split(/^## /m).length !== 8)
      throw Error("LEARN_PARITY");
  }
  for (const f of m.fixtures)
    if (!existsSync("learn/" + f)) throw Error("LEARN_FIXTURE");
}
function files(p) {
  return readdirSync(p).flatMap((n) =>
    statSync(p + "/" + n).isDirectory() ? files(p + "/" + n) : [p + "/" + n],
  );
}
for (const p of files("learn").filter((p) => p.endsWith(".md"))) {
  const s = readFileSync(p, "utf8");
  if (/\/Users\/|Bearer\s+[A-Za-z0-9]{20}/.test(s))
    throw Error("LEARN_PRIVATE_PATH");
  for (const [, url] of s.matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (
      !/^(https?:|mailto:)/.test(url) &&
      !existsSync(resolve(dirname(p), url))
    )
      throw Error("LEARN_LINK: " + p + ": " + url);
  }
}
console.log(
  "Learn: 8 bilingual modules, 28-step mapping, fixtures and relative links verified; semantic translation and participant review remain human gates.",
);
