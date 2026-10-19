import React, { useEffect, useState } from "react";
export const evaluationLabels = {
  "engine-rehearsal": "Engine rehearsal",
  "saved-comparison": "Saved comparison",
  "host-run": "Assistant-host run",
  "manual-observation": "Manual observation",
};

export function LessonDetails({ lesson, api }) {
  const [status, setStatus] = useState("Checking pinned revision…");
  useEffect(() => {
    let active = true;
    api("skills/" + encodeURIComponent(lesson.skillId))
      .then((s) => {
        const exact = [s.bundled, ...s.revisions].some(
          (r) =>
            r?.revisionId === lesson.revisionId &&
            r.checksum === lesson.checksum,
        );
        if (active)
          setStatus(
            !exact
              ? "Pinned revision is no longer bundled or available. Retain the lesson as history; review a new proposal against the current revision."
              : s.active?.revisionId === lesson.revisionId &&
                  s.active?.checksum === lesson.checksum
                ? "Pinned to the active revision"
                : "Pinned revision is not active. Approval does not activate it.",
          );
      })
      .catch(() => {
        if (active)
          setStatus("Skill unavailable. This lesson cannot authorize its use.");
      });
    return () => {
      active = false;
    };
  }, [lesson, api]);
  return (
    <section className="lesson-details" aria-label="Procedural lesson context">
      <strong>
        Procedural lesson · {evaluationLabels[lesson.evaluationKind]}
      </strong>
      <dl>
        <dt>Applies to</dt>
        <dd>{lesson.scope}</dd>
        <dt>Limitations</dt>
        <dd>{lesson.limitations}</dd>
      </dl>
      <p>{status}</p>
      <p>
        Evidence records an observation. Approval is not a quality certification
        or a skill change.
      </p>
      <details>
        <summary>Skill provenance</summary>
        <p>{lesson.skillId}</p>
        <p>{lesson.revisionId}</p>
        <p>{lesson.checksum}</p>
      </details>
    </section>
  );
}
