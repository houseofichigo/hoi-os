import React, { useState, useEffect, useRef } from "react";
import { Drawer } from "./product-ui";
import { ViewTabs } from "./shell";

export default function Memory({ api, memories, refresh }) {
  const [view, setView] = useState("Current"),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const opener = useRef(null),
    pending = useRef(null);
  const [comparison, setComparison] = useState(null),
    [fields, setFields] = useState({});
  const identity = (m) => ({
    id: m.id,
    expectedVersion: m.version,
    expectedChecksum: m.checksum,
  });
  async function mutate(path, payload) {
    const signature = JSON.stringify([path, payload]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    const result = await api(path, {
      ...payload,
      requestKey: pending.current.key,
    });
    pending.current = null;
    return result;
  }
  function edit(m) {
    setEditing(m);
    setText(m.content ?? "");
    setFields({
      type: m.type ?? "semantic",
      durability: m.durability ?? "long-term",
      validFrom: m.validFrom ?? "",
      validUntil: m.validUntil ?? "",
    });
    setDetail(null);
    setComparison(null);
    setError("");
  }
  async function begin(m, restoreVersion) {
    const result = await mutate("memory/draft", {
      ...identity(m),
      ...(restoreVersion ? { restoreVersion } : {}),
    });
    const history = await api("memory/history", { id: result.id });
    edit(history.revisions[0]);
    setView("Proposed");
  }
  async function compare(m) {
    setComparison(await api("memory/compare", { id: m.id }));
    setDetail(null);
  }
  function closeEditor() {
    const dirty =
      text !== (editing.content ?? "") ||
      Object.entries(fields).some(
        ([k, v]) =>
          v !==
          (editing[k] ??
            (k === "type"
              ? "semantic"
              : k === "durability"
                ? "long-term"
                : "")),
      );
    if (
      !dirty ||
      window.confirm(
        "Discard unsaved changes? Saved revisions will remain available.",
      )
    )
      setEditing(null);
  }
  const display = (v) =>
    v == null
      ? "Not supplied"
      : Array.isArray(v)
        ? v
            .map((x) =>
              typeof x === "string"
                ? x
                : (x.quote ?? x.passageId ?? "Evidence reference"),
            )
            .join("; ") || "None"
        : String(v);
  const [historyRows, setHistoryRows] = useState([]);
  useEffect(() => {
    if (view === "History")
      api("memory?view=history")
        .then(setHistoryRows)
        .catch((e) => setError(e.message));
  }, [view, memories]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("memory");
    if (id)
      api("memory/history", { id })
        .then(setDetail)
        .catch((e) => setError(e.message));
  }, []);
  const today = new Date().toISOString().slice(0, 10);
  const current = (m) =>
    m.state === "approved" &&
    (!m.validFrom || m.validFrom <= today) &&
    (!m.validUntil || m.validUntil >= today) &&
    !m.stale;
  const rows = (view === "History" ? historyRows : memories).filter(
    (m) =>
      (view === "History" ||
        (view === "Proposed" ? m.state === "proposed" : current(m))) &&
      m.content.toLowerCase().includes(query.toLowerCase()),
  );
  async function run(work) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function review(m, state) {
    await mutate("memory/review", {
      id: m.id,
      state,
      expectedVersion: m.version,
      expectedChecksum: m.checksum,
      confirm: true,
    });
    setDetail(null);
    setComparison(null);
  }
  return (
    <section aria-label="Reviewed memory">
      <div className="section-head">
        <div>
          <h2>Memory</h2>
          <p>
            Reviewed preferences, decisions and durable context. Corrections
            preserve history.
          </p>
        </div>
        <button
          onClick={() => {
            edit({});
          }}
        >
          Add attributed note
        </button>
      </div>
      <ViewTabs
        label="Memory views"
        values={["Current", "Proposed", "History"]}
        value={view}
        onChange={setView}
      />
      <label>
        Search memory
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {!rows.length && (
        <p className="app-note">
          {query
            ? "No matching memories."
            : `No ${view.toLowerCase()} memories.`}
        </p>
      )}
      <ul className="row-list">
        {rows.map((m) => (
          <li key={m.id}>
            <div className="grow">
              <strong>{m.content}</strong>
              <p>
                {m.type} · {m.state} ·{" "}
                {m.author
                  ? `Attributed to ${m.author}`
                  : m.evidence?.length
                    ? "Source-backed"
                    : "Attribution unknown"}
              </p>
              <small>
                Effective {m.validFrom ?? "date unknown"}
                {m.validUntil ? ` through ${m.validUntil}` : ""} · Version{" "}
                {m.version ?? "legacy"}
              </small>
              <div className="toolbar">
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={async (e) => {
                    opener.current = e.currentTarget;
                    setBusy(true);
                    setError("");
                    try {
                      const history = await api("memory/history", { id: m.id });
                      setBusy(false);
                      setDetail(history);
                    } catch (error) {
                      setBusy(false);
                      setError(error.message);
                    }
                  }}
                >
                  Inspect & history
                </button>
                {m.state === "approved" && (
                  <button
                    className="text-link"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("hoi:ask-knowledge", {
                          detail: { kind: "memory", id: m.id },
                        }),
                      )
                    }
                  >
                    Ask about this
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {(detail || comparison || editing) && (
        <Drawer
          returnFocus={opener.current}
          title={
            editing
              ? editing.id
                ? "Edit memory draft"
                : "Attributed note"
              : comparison
                ? "Compare memory draft"
                : "Memory review"
          }
          onClose={() => {
            if (editing) closeEditor();
            else {
              setDetail(null);
              setComparison(null);
            }
          }}
        >
          {detail && (
            <>
              {error && <p role="alert">{error}</p>}
              {detail.revisions.map((m, i) => (
                <article key={`${m.id}-${m.version}`}>
                  <h3>
                    Version {m.version} · {m.state}
                  </h3>
                  <p>{m.content}</p>
                  <p>
                    Recorded {m.createdAt ?? "unknown"} · Reviewed{" "}
                    {m.reviewedAt ?? "not reviewed"}
                  </p>
                  <details>
                    <summary>
                      Supporting evidence ({m.evidence?.length ?? 0})
                    </summary>
                    {m.evidence?.map((e, n) => (
                      <blockquote key={n}>
                        <p>{e.quote}</p>
                        <small>
                          {e.revisionId} · {e.passageId}
                        </small>
                      </blockquote>
                    ))}
                  </details>
                  {i === 0 && (
                    <div className="toolbar">
                      {m.state === "proposed" && (
                        <>
                          <button disabled={busy} onClick={() => edit(m)}>
                            Edit draft
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => run(() => compare(m))}
                          >
                            Compare changes
                          </button>
                          <button
                            disabled={
                              busy ||
                              !!m.supersedes ||
                              (!m.author && !m.evidence?.length)
                            }
                            onClick={() => run(() => review(m, "approved"))}
                          >
                            Approve exact version
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => run(() => review(m, "rejected"))}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {m.state === "approved" && (
                        <>
                          <button onClick={() => run(() => begin(m))}>
                            Propose correction
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => run(() => review(m, "retired"))}
                          >
                            No longer use this
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {detail.revisions[0].state !== "superseded" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(() => begin(detail.revisions[0], m.version))
                      }
                    >
                      Restore version {m.version} as draft
                    </button>
                  )}
                  {i === 0 && m.supersededBy && (
                    <button
                      onClick={() =>
                        run(async () =>
                          setDetail(
                            await api("memory/history", { id: m.supersededBy }),
                          ),
                        )
                      }
                    >
                      Open replacement
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
          {comparison && (
            <>
              <p>
                Review the saved version before approval. Approved memory stays
                unchanged until you approve this proposal.
              </p>
              {comparison.stalePredecessor && (
                <p role="alert">
                  The original memory changed. Create a new correction from its
                  current version before approval.
                </p>
              )}
              <h3>Before</h3>
              <p>{comparison.base?.content ?? "New memory"}</p>
              <h3>Proposed statement</h3>
              <p>{comparison.draft.content}</p>
              <dl>
                {comparison.changes.map((c) => (
                  <React.Fragment key={c.field}>
                    <dt>
                      {{
                        validFrom: "Effective from",
                        validUntil: "Effective until",
                        allowedHosts: "Access",
                        content: "Statement",
                      }[c.field] ?? c.field}
                    </dt>
                    <dd>
                      {display(c.before)} → {display(c.after)}
                    </dd>
                  </React.Fragment>
                ))}
              </dl>
              <button disabled={busy} onClick={() => edit(comparison.draft)}>
                Edit draft
              </button>
              <button
                disabled={
                  busy ||
                  comparison.stalePredecessor ||
                  (!comparison.draft.author &&
                    !comparison.draft.evidence?.length)
                }
                onClick={() => run(() => review(comparison.draft, "approved"))}
              >
                Approve exact version
              </button>
              {error && <p role="alert">{error}</p>}
            </>
          )}
          {editing && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const changes = {
                      ...fields,
                      content: text.trim(),
                      validFrom: fields.validFrom || null,
                      validUntil: fields.validUntil || null,
                    };
                    if (editing.id)
                      await mutate("memory/save-draft", {
                        ...identity(editing),
                        changes,
                        attributedStatement: true,
                      });
                    else
                      await mutate("memory/propose", {
                        attributedStatement: true,
                        memory: changes,
                      });
                    setEditing(null);
                    setView("Proposed");
                  });
                }}
              >
                {editing.id && (
                  <>
                    <h3>Saved draft</h3>
                    <p>{editing.content}</p>
                  </>
                )}
                <label htmlFor="memory-statement">Your statement</label>
                <textarea
                  id="memory-statement"
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                />
                <label>
                  Memory type
                  <select
                    value={fields.type}
                    onChange={(e) =>
                      setFields({ ...fields, type: e.target.value })
                    }
                  >
                    {[
                      "episodic",
                      "semantic",
                      "decision",
                      "preference",
                      "procedural",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Durability
                  <select
                    value={fields.durability}
                    onChange={(e) =>
                      setFields({ ...fields, durability: e.target.value })
                    }
                  >
                    {["temporary", "project", "long-term", "permanent"].map(
                      (v) => (
                        <option key={v}>{v}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Effective from
                  <input
                    type="date"
                    value={fields.validFrom}
                    onChange={(e) =>
                      setFields({ ...fields, validFrom: e.target.value })
                    }
                  />
                </label>
                <label>
                  Effective until
                  <input
                    type="date"
                    value={fields.validUntil}
                    onChange={(e) =>
                      setFields({ ...fields, validUntil: e.target.value })
                    }
                  />
                </label>
                {editing.evidence?.length > 0 && (
                  <p>
                    Existing supporting evidence is preserved:{" "}
                    {display(editing.evidence)}
                  </p>
                )}
                <p>
                  This will be attributed to you and saved for review. It is not
                  independently verified.
                </p>
                {editing.id && (
                  <>
                    <h3>Proposed replacement</h3>
                    <p>{text}</p>
                  </>
                )}
                <button disabled={busy || !text.trim()}>
                  {editing.id ? "Save draft" : "Save proposal"}
                </button>
                {error && <p role="alert">{error}</p>}
              </form>
            </>
          )}
        </Drawer>
      )}
    </section>
  );
}
