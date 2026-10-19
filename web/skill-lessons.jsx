import React, { useEffect, useRef, useState } from "react";
import { Drawer } from "./product-ui.jsx";
import Memory from "./memory.jsx";
import { presentation } from "./skill-presentation.js";
import { recordRoute } from "./destination.js";

import { evaluationLabels } from "./lesson-details.jsx";

export default function SkillLessons({ api, skills }) {
  const [memories, setMemories] = useState([]),
    [skill, setSkill] = useState("");
  const [open, setOpen] = useState(false),
    [detail, setDetail] = useState(null),
    [revision, setRevision] = useState("");
  const [content, setContent] = useState(""),
    [scope, setScope] = useState(""),
    [limitations, setLimitations] = useState("");
  const [kind, setKind] = useState("manual-observation"),
    [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [evidence, setEvidence] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const opener = useRef(null),
    pending = useRef(null),
    generation = useRef(0);
  const refresh = async () => setMemories(await api("memory"));
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let current = true;
    setDetail(null);
    setRevision("");
    if (skill)
      api("skills/" + encodeURIComponent(skill))
        .then((d) => {
          if (!current) return;
          setDetail(d);
          setRevision(
            (d.active ?? d.revisions[0] ?? d.bundled)?.revisionId ?? "",
          );
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [skill]);
  const revisions = detail
    ? [detail.bundled, ...detail.revisions].filter(Boolean)
    : [];
  const pinned = revisions.find((r) => r.revisionId === revision);
  const close = () => {
    if (busy) return;
    if (
      (content || scope || limitations || evidence) &&
      !window.confirm(
        "Discard the unsaved lesson? Existing memory and skills will remain unchanged.",
      )
    )
      return;
    setOpen(false);
    generation.current++;
    setContent("");
    setScope("");
    setLimitations("");
    setEvidence(null);
    setResults([]);
  };
  async function search() {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const r = await api("retrieve?q=" + encodeURIComponent(query));
      if (request === generation.current) setResults(r.results);
    } catch (e) {
      if (request === generation.current) setError(e.message);
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  async function save(e) {
    e.preventDefault();
    if (!pinned || !evidence || busy) return;
    const payload = {
      attributedStatement: true,
      memory: {
        type: "procedural",
        content: content.trim(),
        allowedHosts: ["local"],
        evidence: [
          {
            revisionId: evidence.revisionId,
            passageId: evidence.passageId,
            quote: evidence.quote,
          },
        ],
        lesson: {
          skillId: skill,
          revisionId: pinned.revisionId,
          checksum: pinned.checksum,
          scope: scope.trim(),
          limitations: limitations.trim(),
          evaluationKind: kind,
        },
      },
    };
    const signature = JSON.stringify(payload);
    if (pending.current?.signature !== signature)
      pending.current = { signature, requestKey: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      await api("memory/propose", {
        ...payload,
        requestKey: pending.current.requestKey,
      });
      pending.current = null;
      setOpen(false);
      setContent("");
      setScope("");
      setLimitations("");
      setEvidence(null);
      setResults([]);
      setNotice(
        "Lesson saved for review. Skill instructions and activation are unchanged.",
      );
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="skill-improvement" aria-label="Skill improvement">
      <div className="section-head">
        <div>
          <h2>Learn from reviewed work</h2>
          <p>
            Record what helped, where it applies and what remains untested.
            Lessons use Memory’s revision and review history.
          </p>
        </div>
        <button
          onClick={(e) => {
            opener.current = e.currentTarget;
            setError("");
            setOpen(true);
          }}
        >
          Record lesson
        </button>
      </div>
      <p>
        Review a lesson → compare a skill draft → evaluate it → explicitly
        activate if warranted. These are separate decisions.
      </p>
      <div className="record-toolbar">
        <label>
          Filter by skill
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">All skills</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {presentation(s).displayName}
              </option>
            ))}
          </select>
        </label>
        {skill && (
          <button
            className="secondary"
            onClick={() => recordRoute("skill", skill)}
          >
            Inspect skill and revisions
          </button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {!open && error && <p role="alert">{error}</p>}
      <Memory
        api={api}
        memories={memories}
        refresh={refresh}
        lessonsOnly
        skillId={skill}
      />
      {open && (
        <Drawer
          title="Record procedural lesson"
          onClose={close}
          returnFocus={opener.current}
        >
          <form className="lesson-form" onSubmit={save}>
            <h2>Record procedural lesson</h2>
            <p>
              Use a preserved evaluation report or observation as evidence.
              Import it through Knowledge Hub first if needed. No evaluation is
              run by this form.
            </p>
            <label>
              Skill
              <select
                aria-label="Skill"
                required
                value={skill}
                disabled={busy}
                onChange={(e) => setSkill(e.target.value)}
              >
                <option value="">Select a skill</option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {presentation(s).displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Skill revision
              <select
                aria-label="Skill revision"
                required
                value={revision}
                disabled={!detail || busy}
                onChange={(e) => setRevision(e.target.value)}
              >
                <option value="">Select a revision</option>
                {revisions.map((r) => (
                  <option key={r.revisionId} value={r.revisionId}>
                    {r.revisionId === detail.active?.revisionId
                      ? "Active"
                      : "Inactive / draft"}{" "}
                    · {r.checksum.slice(0, 12)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observation type
              <select
                value={kind}
                disabled={busy}
                onChange={(e) => setKind(e.target.value)}
              >
                {Object.entries(evaluationLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lesson
              <textarea
                required
                rows={3}
                value={content}
                disabled={busy}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <label>
              Applies to
              <textarea
                required
                maxLength={2000}
                rows={2}
                value={scope}
                disabled={busy}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Which work, inputs or conditions?"
              />
            </label>
            <label>
              Limitations
              <textarea
                required
                maxLength={2000}
                rows={2}
                value={limitations}
                disabled={busy}
                onChange={(e) => setLimitations(e.target.value)}
                placeholder="What was not tested, or where should this not be used?"
              />
            </label>
            <fieldset>
              <legend>Preserved evidence</legend>
              <label>
                Find report or observation
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="secondary"
                disabled={busy || !query.trim()}
                onClick={search}
              >
                Search passages
              </button>
              {results.map((r) => (
                <label className="lesson-passage" key={r.passageId}>
                  <input
                    type="radio"
                    name="lesson-evidence"
                    checked={evidence?.passageId === r.passageId}
                    onChange={() => setEvidence(r)}
                  />
                  <span>
                    <strong>{r.title}</strong>
                    <span>{r.quote}</span>
                  </span>
                </label>
              ))}
              {evidence && <p>Selected passage: {evidence.title}</p>}
            </fieldset>
            <p>
              This proposal is attributed to you and visible to local review
              only. It does not become business-fact context, edit instructions
              or activate tools.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="toolbar">
              <button
                disabled={
                  busy ||
                  !pinned ||
                  !evidence ||
                  !content.trim() ||
                  !scope.trim() ||
                  !limitations.trim()
                }
              >
                Save lesson for review
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </section>
  );
}
