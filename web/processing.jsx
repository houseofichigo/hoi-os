import React, { useEffect, useState } from "react";
export default function ProcessingQueue({ api }) {
  const [queue, setQueue] = useState([]),
    [projects, setProjects] = useState([]),
    [assignment, setAssignment] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState(""),
    [assistant, setAssistant] = useState("codex");
  async function load() {
    setQueue(await api("sync/queue"));
    setProjects(await api("projects"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Assistant processing">
      <h2>Assistant processing</h2>
      <p>
        Indexing is automatic. Interpretation and task proposals use your
        Claude/Codex session and remain subject to review.
      </p>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => act(load)}>
        Refresh processing queue
      </button>
      <label>
        Assistant for handoff
        <select
          value={assistant}
          onChange={(e) => setAssistant(e.target.value)}
        >
          <option value="codex">Codex</option>
          <option value="claude">Claude Code</option>
        </select>
      </label>
      {queue.map((q) => (
        <article key={q.source_id}>
          <h3>{q.title}</h3>
          <p>
            {q.state === "reviewed" || q.state === "user-reviewed"
              ? "User-marked review — no validated assistant result implied"
              : q.state}
          </p>
          {(q.processing || []).map((r) => (
            <section key={r.id}>
              <p>
                {r.host} · {r.state}
              </p>
              <p className="mono">Request {r.id}</p>
              {r.result && (
                <details>
                  <summary>Validated stored result references</summary>
                  <p>
                    References and evidence validated. Factual accuracy and
                    approval still require review.
                  </p>
                  {r.result.proposalIds.map((id) => (
                    <p key={id}>
                      <a href={"/app?proposal=" + encodeURIComponent(id)}>
                        Open proposal {id}
                      </a>
                    </p>
                  ))}
                  <pre>{JSON.stringify(r.result, null, 2)}</pre>
                </details>
              )}
            </section>
          ))}
          {q.intakeId && (
            <>
              <label>
                Project for {q.title}
                <select
                  value={assignment[q.source_id] || ""}
                  onChange={(e) =>
                    setAssignment({
                      ...assignment,
                      [q.source_id]: e.target.value,
                    })
                  }
                >
                  <option value="">Choose project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || !assignment[q.source_id]}
                onClick={() =>
                  act(() =>
                    api("intake/assign", {
                      id: q.intakeId,
                      projectId: assignment[q.source_id],
                    }),
                  )
                }
              >
                Assign communication
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const r = await api("processing/prepare", {
                  sourceId: q.source_id,
                  revisionId: q.revision_id,
                  assistant,
                });
                setRequest(r.handoff);
              })
            }
          >
            Prepare assistant handoff
          </button>
          <button
            disabled={busy}
            onClick={() =>
              act(() =>
                api("sync/review", {
                  sourceId: q.source_id,
                  revisionId: q.revision_id,
                }),
              )
            }
          >
            Mark user review complete
          </button>
        </article>
      ))}
      {request && (
        <>
          <label>
            Assistant handoff
            <textarea readOnly value={request} />
          </label>
          <button
            onClick={() =>
              navigator.clipboard
                .writeText(request)
                .catch(() =>
                  setError("Select and copy the handoff text manually."),
                )
            }
          >
            Copy handoff
          </button>
        </>
      )}
    </section>
  );
}
