import React, { useState, useEffect } from "react";
export default function Calendar({ api, slots = [], timezone, selectedId }) {
  const [calendar, setCalendar] = useState(""),
    [rows, setRows] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setRows(await api("calendar"));
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
      await load().catch(() => setRows([]));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Calendar approvals">
      <h2>Calendar approvals</h2>
      <p>
        Private preparation blocks only. No invitations. Writes require an
        explicitly configured calendar and a server OAuth token. Approval alone
        does not create an event.
      </p>
      <label>
        Verified calendar ID
        <input value={calendar} onChange={(e) => setCalendar(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      {slots
        .filter((s) => s.start)
        .map((s) => (
          <button
            key={s.eventId}
            disabled={busy || !calendar}
            onClick={() =>
              act(() =>
                api("calendar/propose", {
                  calendarId: calendar,
                  meetingId: s.eventId,
                  title: "Prepare: " + s.title,
                  start: s.start,
                  end: s.end,
                  timezone,
                  evidence: s.evidence,
                }),
              )
            }
          >
            Review preparation block for {s.title}
          </button>
        ))}
      <button disabled={busy} onClick={() => act(load)}>
        Refresh calendar actions
      </button>
      {rows
        .filter((r) => !selectedId || r.id === selectedId)
        .map((r) => (
          <article key={r.id}>
            <h3>{r.event.title}</h3>
            <p>
              {r.event.start} → {r.event.end} · {r.event.timezone}
            </p>
            <p>
              Calendar: {r.event.calendarId} · {r.state}
            </p>
            <details>
              <summary>Evidence and approval fingerprint</summary>
              <p className="mono">{r.digest}</p>
              {r.event.evidence.map((e, i) => (
                <p key={i}>
                  {e.quote} ({e.revisionId}/{e.passageId})
                </p>
              ))}
            </details>
            {r.state === "proposed" &&
              ["approved", "rejected"].map((decision) => (
                <button
                  key={decision}
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api("calendar/review", {
                        id: r.id,
                        expectedVersion: r.version,
                        digest: r.digest,
                        decision,
                      }),
                    )
                  }
                >
                  {decision === "approved"
                    ? "Approve exact event"
                    : "Reject event"}
                </button>
              ))}
            {["approved", "uncertain", "executing"].includes(r.state) && (
              <button
                disabled={busy}
                onClick={() => act(() => api("calendar/execute", { id: r.id }))}
              >
                {r.state === "approved"
                  ? "Check availability and create approved event"
                  : "Reconcile with calendar"}
              </button>
            )}
          </article>
        ))}
    </section>
  );
}
