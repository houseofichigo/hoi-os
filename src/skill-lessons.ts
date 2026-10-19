import { type Store } from "./store.js";
import { type Host, skillLesson } from "./schema.js";
import { skillDetail } from "./skill-library.js";

/** An evaluation reference is recorded evidence, not an attestation of success. */
export function validateSkillLesson(s: Store, m: any, h: Host) {
  if (!m.lesson) return;
  s.assertSchema(19, "Skill lessons");
  const lesson = skillLesson.parse(m.lesson);
  if (m.type !== "procedural") throw Error("LESSON_TYPE_REQUIRED");
  if (!m.content.trim() || !m.evidence?.length)
    throw Error("LESSON_EVIDENCE_REQUIRED");
  s.validateEvidence(m.evidence, h, true);
  const detail = skillDetail(s, lesson.skillId, h);
  const revision = [detail.bundled, ...detail.revisions].find(
    (r) =>
      r?.revisionId === lesson.revisionId && r.checksum === lesson.checksum,
  );
  if (!revision) throw Error("LESSON_SKILL_REVISION_UNAVAILABLE");
  const row = s.one(
    "SELECT allowed_hosts FROM workspace_skills WHERE id=?",
    lesson.skillId,
  );
  if (
    row &&
    m.allowedHosts.some(
      (host: Host) => !JSON.parse(row.allowed_hosts).includes(host),
    )
  )
    throw Error("LESSON_ACCESS_EXPANSION_DENIED");
}

/** A correction cannot turn an instruction into an operational fact, or vice versa. */
export function sameMemoryPurpose(before: any, after: any) {
  if (
    !!before.lesson !== !!after.lesson ||
    (before.lesson &&
      (after.type !== "procedural" ||
        before.lesson.skillId !== after.lesson.skillId))
  )
    throw Error("MEMORY_PURPOSE_CHANGED");
}
