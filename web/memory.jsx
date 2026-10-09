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
  const opener=useRef(null);
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
    await api("memory/review", {
      id: m.id,
      state,
      expectedVersion: m.version,
      expectedChecksum: m.checksum,
      requestKey: crypto.randomUUID(),
      confirm: true,
    });
    setDetail(null);
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
            setEditing({});
            setText("");
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
                    opener.current=e.currentTarget;
                    setBusy(true);setError("");
                    try {
                      const history=await api("memory/history", { id: m.id });
                      setBusy(false);
                      setDetail(history);
                    } catch(error) { setBusy(false);setError(error.message); }
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
      {detail && (
        <Drawer returnFocus={opener.current} title="Memory review" onClose={() => setDetail(null)}>
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
                      <button
                        disabled={busy || (!m.author && !m.evidence?.length)}
                        onClick={() =>
                          run(() =>
                            review(
                              memories.find((x) => x.id === m.id),
                              "approved",
                            ),
                          )
                        }
                      >
                        Approve exact version
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            review(
                              memories.find((x) => x.id === m.id),
                              "rejected",
                            ),
                          )
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {m.state === "approved" && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(m);
                          setText(m.content);
                          setDetail(null);
                        }}
                      >
                        Propose correction
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            review(
                              memories.find((x) => x.id === m.id),
                              "retired",
                            ),
                          )
                        }
                      >
                        No longer use this
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </Drawer>
      )}
      {editing && (
        <Drawer
          title={editing.id ? "Propose memory correction" : "Attributed note"}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api("memory/propose", {
                  requestKey: crypto.randomUUID(),
                  attributedStatement: true,
                  memory: {
                    type: editing.type ?? "semantic",
                    content: text.trim(),
                    entities: editing.entities ?? [],
                    allowedHosts: editing.allowedHosts ?? [
                      "local",
                      "codex",
                      "claude",
                    ],
                    ...(editing.id ? { supersedes: editing.id } : {}),
                  },
                });
                setEditing(null);
                setView("Proposed");
              });
            }}
          >
            {editing.id && (
              <>
                <h3>Current statement</h3>
                <p>{editing.content}</p>
              </>
            )}
            <label>
              Your statement
              <textarea
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
              />
            </label>
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
            <button disabled={busy || !text.trim()}>Save proposal</button>
            {error && <p role="alert">{error}</p>}
          </form>
        </Drawer>
      )}
    </section>
  );
}
