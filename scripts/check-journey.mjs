import { dirname, resolve } from "node:path";
import { readFileSync, existsSync, readdirSync } from "node:fs";
const read = (p) => readFileSync(p, "utf8");
const journey = JSON.parse(read("method/journey.json"));
const expected = Array.from({ length: 28 }, (_, i) => i + 1);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const numbers = [...read("method/JOURNEY.md").matchAll(/^(\d+)\. \*\*/gm)].map(
  (m) => +m[1],
);
if (
  journey.phases.length !== 8 ||
  !same(numbers, expected) ||
  !same(
    journey.phases.flatMap((p) => p.steps),
    expected,
  )
)
  throw Error("JOURNEY_STEPS");
if (
  Object.keys(journey.previousToCurrent).length !== 25 ||
  new Set(Object.values(journey.previousToCurrent)).size !== 25 ||
  !same(
    [...Object.values(journey.previousToCurrent), ...journey.addedSteps].sort(
      (a, b) => a - b,
    ),
    expected,
  )
)
  throw Error("JOURNEY_HISTORY");
const course = JSON.parse(read("learn/course.json"));
if (
  course.journeyVersion !== journey.version ||
  !same(
    [...new Set(course.modules.flatMap((m) => m.steps))].sort((a, b) => a - b),
    expected,
  )
)
  throw Error("JOURNEY_COURSE");
for (const entry of JSON.parse(read("method/SKILL_MAP.json")).entries)
  for (const skill of entry.engineSkills)
    if (!existsSync(`skills/${skill}/SKILL.md`))
      throw Error("JOURNEY_SKILL:" + skill);
for (const name of readdirSync("skills", { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)) {
  const p = `skills/${name}/SKILL.md`;
  if (!existsSync(p)) continue;
  for (const [, step] of read(p).matchAll(/\b[Ss]tep (\d+)\b/g))
    if (+step < 1 || +step > 28) throw Error("SKILL_STEP:" + p);
  if (/25-step method|existing 25-step journey|Step 16 of/.test(read(p)))
    throw Error("STALE_SKILL_JOURNEY:" + p);
}
for (const locale of ["en", "fr"])
  for (let i = 1; i <= 4; i++) {
    const text = read(`learn/${locale}/0${i}.md`);
    if (
      /harness:context|harness:resume-brief|chat:begin|chat:submit/.test(text)
    )
      throw Error("BEGINNER_ENGINE_DEPENDENCY");
  }
for (const locale of ["en", "fr"])
  for (let i = 1; i <= 8; i++)
    if (
      /harness:context|harness:resume-brief|reviewOf|revisionOf/.test(
        read(`learn/${locale}/0${i}.md`),
      )
    )
      throw Error("UNPUBLISHED_COURSE_OPERATION");
console.log(
  "28 unique steps, eight phases, prior numbering, skill routes and bilingual course verified.",
);

for (const p of [
  "README.md",
  "method/JOURNEY.md",
  "method/FOUNDATION.md",
  ...readdirSync("docs")
    .filter((n) => n.endsWith(".md"))
    .map((n) => "docs/" + n),
]) {
  for (const [, url] of read(p).matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)) {
    if (
      !/^(https?:|mailto:|#)/.test(url) &&
      !existsSync(resolve(dirname(p), url))
    )
      throw Error("ACTIVE_DOC_LINK:" + p + ":" + url);
  }
}
console.log("Active documentation links verified.");
