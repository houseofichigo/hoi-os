import React, { useState, useEffect } from "react";
export default function EmailDrafts({ api, item, selectedId }) {
  const [rows, setRows] = useState([]),
    [connections, setConnections] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setRows(await api("email-actions"));
    setConnections((await api("sync")).filter((c) => c.provider === "gmail"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [item?.id]);
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
    <section aria-label="Reviewed Gmail drafts">
      <h3>Reply drafts</h3>
      <p>
        Review the exact reply before saving a draft to Gmail. HOI cannot send
        email.
      </p>
      {error && <p role="alert">{error}</p>}
      {item && (
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            act(() =>
              api("email-actions/propose", {
                key: crypto.randomUUID(),
                intakeId: item.id,
                connectionId: f.get("connection"),
                to: f
                  .get("to")
                  .split(",")
                  .map((s) => s.trim()),
                subject: f.get("subject"),
                body: f.get("body"),
              }),
            );
          }}
        >
          <label>
            Connected Gmail account
            <select name="connection" required>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.accountEmail || "Unverified"}
                </option>
              ))}
            </select>
          </label>
          <label>
            To (comma-separated)
            <input
              name="to"
              defaultValue={item.item.email?.sender || ""}
              required
            />
          </label>
          <label>
            Subject
            <input
              name="subject"
              defaultValue={
                item.title.startsWith("Re:") ? item.title : "Re: " + item.title
              }
              required
            />
          </label>
          <label>
            Reply
            <textarea name="body" required rows={6} />
          </label>
          <button disabled={busy || !connections.length}>
            Create reviewable reply
          </button>
        </form>
      )}
      {rows
        .filter(
          (r) =>
            (!selectedId || r.id === selectedId) &&
            (!item || r.proposal.intakeId === item.id),
        )
        .map((r) => (
          <article key={r.id}>
            <h4>{r.proposal.subject}</h4>
            <p>
              To: {r.proposal.to.join(", ")} · {r.state}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{r.proposal.body}</p>
            <details>
              <summary>Evidence</summary>
              {r.proposal.evidence.map((e, i) => (
                <blockquote key={i}>{e.quote}</blockquote>
              ))}
            </details>
            {r.state === "proposed" &&
              ["approved", "rejected"].map((decision) => (
                <button
                  key={decision}
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api("email-actions/review", {
                        id: r.id,
                        expectedVersion: r.version,
                        digest: r.digest,
                        decision,
                      }),
                    )
                  }
                >
                  {decision === "approved" ? "Approve exact draft" : "Reject"}
                </button>
              ))}
            {["approved", "uncertain", "executing"].includes(r.state) && (
              <button
                disabled={busy}
                onClick={() =>
                  act(() => api("email-actions/execute", { id: r.id }))
                }
              >
                {r.state === "approved"
                  ? "Save approved Gmail draft"
                  : "Reconcile uncertain draft"}
              </button>
            )}
            {r.external_id && (
              <p>Saved Gmail draft. Open Gmail to inspect or send it.</p>
            )}
          </article>
        ))}
    </section>
  );
}
export function GoogleWritePolicy({ api }) {
  const [policy, setPolicy] = useState(null),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("google-policy")
      .then(setPolicy)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section aria-label="External action policy">
      <h4>Reviewed external actions</h4>
      <p>{policy?.explanation}</p>
      <p>Current mode: {policy?.mode || "Unknown"}</p>
      {error && <p role="alert">{error}</p>}
      <label>
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        I reviewed this policy change. Keep exact-action approvals and connector
        scope checks.
      </label>
      <button
        type="button"
        disabled={!policy || !confirm}
        onClick={async () => {
          try {
            setPolicy(
              await api("google-policy/review", {
                mode: policy.mode === "deny" ? "approve" : "deny",
                expectedDigest: policy.digest,
                confirm: true,
              }),
            );
            setConfirm(false);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        {policy?.mode === "deny"
          ? "Enable reviewed external actions"
          : "Disable external writes"}
      </button>
    </section>
  );
}
