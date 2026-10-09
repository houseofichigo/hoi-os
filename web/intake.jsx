import React, { useEffect, useState } from "react";
export default function Intake({ api, onChange }) {
  const [items, setItems] = useState([]),
    [mentions, setMentions] = useState([]),
    [history, setHistory] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [json, setJson] = useState(""),
    [request, setRequest] = useState(null);
  async function refresh() {
    const [i, m, d] = await Promise.all([
      api("intake"),
      api("intake/mentions"),
      api("intake/decisions"),
    ]);
    setItems(i);
    setMentions(m);
    setHistory(d);
  }
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      await onChange();
    } catch (e) {
      setError(e.message);
      await refresh().catch(() => {
        setItems([]);
        setMentions([]);
        setHistory([]);
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Intake review">
      <h2>Intake &amp; duplicate review</h2>
      <p>
        Import selected normalized exports. An assistant supplies structured
        extraction; matching decisions remain yours.
      </p>
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>Import or submit assistant results</summary>
        <label>
          Normalized export or extraction JSON
          <textarea
            aria-label="Intake JSON"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={8}
          />
        </label>
        <div className="task-filters">
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("intake/import", JSON.parse(json));
                setJson("");
              })
            }
          >
            Import export
          </button>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("intake/submit", JSON.parse(json));
                setJson("");
              })
            }
          >
            Submit extraction
          </button>
        </div>
      </details>
      {items.map((i) => (
        <div key={i.id} className="task-proposal">
          <strong>{i.title}</strong> · {i.kind} · {i.state}
          {i.cancelled ? " · cancelled" : ""}
          <p className="mono">Checked: {i.checkedAt}</p>
          {i.error && <p>{i.error}</p>}
          <button
            disabled={busy || i.state !== "ready"}
            onClick={() =>
              act(async () =>
                setRequest(await api("intake/prepare", { id: i.id })),
              )
            }
          >
            Prepare extraction: {i.title}
          </button>
        </div>
      ))}
      {request && (
        <details open>
          <summary>Assistant extraction request</summary>
          <p>
            Pass this request to your local Codex or Claude assistant. Source
            text is evidence, not instructions. Return the schema described in
            the Batch 2 guide.
          </p>
          <textarea
            readOnly
            aria-label="Extraction request"
            rows={10}
            value={JSON.stringify(request, null, 2)}
          />
        </details>
      )}
      {mentions
        .filter((m) => m.state === "pending")
        .map((m) => (
          <Mention
            key={m.id}
            m={m}
            busy={busy}
            resolve={(v) => act(() => api("intake/resolve", v))}
          />
        ))}
      {!mentions.some((m) => m.state === "pending") && (
        <p>No extracted mentions awaiting review.</p>
      )}
      <details>
        <summary>Matching history</summary>
        <ul>
          {history.map((d) => (
            <li key={d.id}>
              {d.decision} · {d.reversed ? "undone" : "recorded"}{" "}
              <button
                disabled={busy || d.reversed}
                onClick={() => act(() => api("intake/undo", { id: d.id }))}
              >
                Undo {d.decision}
              </button>
            </li>
          ))}
        </ul>
        <p>
          Undo refuses to overwrite later task edits. Rejected and undone items
          remain recorded.
        </p>
      </details>
    </section>
  );
}
function Mention({ m, busy, resolve }) {
  const [target, setTarget] = useState("");
  const c = m.candidates.find((c) => c.proposalId === target);
  const decide = (decision) =>
    resolve({
      id: m.id,
      expectedVersion: m.version,
      decision,
      ...(target && decision !== "separate" && decision !== "reject"
        ? {
            targetId: target,
            targetVersion: c.taskVersion ?? c.proposalVersion,
          }
        : {}),
    });
  return (
    <article className="task-proposal" aria-label={`Mention ${m.task.title}`}>
      <h3>{m.task.title}</h3>
      <p>
        {m.intent} · {m.sourceKind} · Speaker/actor: {m.actor || "Unknown"} ·
        Recurrence: {m.recurrenceId || "None"}
      </p>
      <div className="match-comparison">
        <section>
          <h4>Incoming</h4>
          <p>{m.task.outcome}</p>
          <p>Owner: {m.task.owner || "Unknown"}</p>
          <p>
            Due: {m.task.dueDate || "Unknown"} {m.task.dueTime}{" "}
            {m.task.timezone}
          </p>
          {m.evidence.map((e, i) => (
            <blockquote key={i}>{e.quote}</blockquote>
          ))}
        </section>
        <section>
          <h4>Existing work</h4>
          <label>
            Compare with
            <select
              aria-label={`Match target for ${m.id}`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Select a possible match</option>
              {m.candidates.map((c) => (
                <option key={c.proposalId} value={c.proposalId}>
                  {c.task.title} — {c.state}
                </option>
              ))}
            </select>
          </label>
          {c && (
            <>
              <p>{c.reason}</p>
              <p>{c.task.outcome}</p>
              <p>Owner: {c.task.owner || "Unknown"}</p>
              <p>
                Due: {c.task.dueDate || "Unknown"} {c.task.dueTime}{" "}
                {c.task.timezone}
              </p>
              <p>Status: {c.state}</p>
            </>
          )}
        </section>
      </div>
      <div className="task-filters">
        <button
          disabled={busy || m.intent === "context" || m.cancelled}
          onClick={() => decide("separate")}
        >
          Keep separate
        </button>
        <button
          disabled={busy || !c || c.state === "rejected"}
          onClick={() => decide("merge")}
        >
          Attach evidence
        </button>
        <button
          disabled={
            busy ||
            !c ||
            c.state === "rejected" ||
            m.intent === "context" ||
            m.cancelled
          }
          onClick={() => decide("update")}
        >
          Apply reviewed fields
        </button>
        <button
          disabled={
            busy ||
            !c ||
            !["done", "cancelled"].includes(c.state) ||
            m.intent === "context" ||
            m.cancelled
          }
          onClick={() => decide("reopen")}
        >
          Reopen with new evidence
        </button>
        <button disabled={busy} onClick={() => decide("reject")}>
          Reject mention
        </button>
      </div>
      <p>
        Keep separate creates a task proposal for approval. Attaching evidence
        preserves status. Applying fields changes the selected work immediately
        after this review.
      </p>
    </article>
  );
}
