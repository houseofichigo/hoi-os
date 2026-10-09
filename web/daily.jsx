import { requested, focusRecord } from "./destination.js";
import Calendar from "./calendar.jsx";
import React, { useState, useEffect } from "react";
const statuses = [
  "open",
  "in-progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
];
export default function Daily({ api, schemaVersion }) {
  const [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA").format(new Date()),
    ),
    [timezone, setZone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [owner, setOwner] = useState(""),
    [project, setProject] = useState(""),
    [data, setData] = useState(null),
    [brief, setBrief] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [view, setView] = useState("priorities"),
    [workStart, setStart] = useState("09:00"),
    [workEnd, setEnd] = useState("18:00"),
    [prep, setPrep] = useState(30),
    [buffer, setBuffer] = useState(15),
    [coverage, setCoverage] = useState(""),
    [passage, setPassage] = useState(null);
  async function load() {
    setData(
      await api("daily/view", {
        date,
        timezone,
        owner: owner || null,
        ...(project ? { projectId: project } : {}),
        workStart,
        workEnd,
        prepMinutes: Number(prep),
        bufferMinutes: Number(buffer),
        ...(coverage ? { coverage: JSON.parse(coverage) } : {}),
      }),
    );
  }
  async function act(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    setPassage(null);
    try {
      await fn();
      setMessage("Daily work updated.");
    } catch (e) {
      setData(null);
      setBrief(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    api("preferences")
      .then((p) => {
        setZone(p.timezone);
        if (p.workStart) setStart(p.workStart);
        if (p.workEnd) setEnd(p.workEnd);
        setDate(
          new Intl.DateTimeFormat("en-CA", { timeZone: p.timezone }).format(
            new Date(),
          ),
        );
      })
      .catch(() => {});
    const key = requested("event");
    if (key)
      act(async () => {
        await load();
        setBrief(await api("daily/meeting", { id: key }));
        focusRecord("meeting-brief");
      });
  }, []);
  const refs = (items) => (
    <details>
      <summary>Inspect evidence ({items.length})</summary>
      {items.map((e, i) => (
        <div key={i}>
          <blockquote>{e.quote}</blockquote>
          <button
            onClick={() =>
              act(async () => setPassage(await api(`passage/${e.passageId}`)))
            }
          >
            Read source {i + 1}
          </button>
        </div>
      ))}
    </details>
  );
  if (schemaVersion < 4)
    return (
      <p>
        Today requires schema 4. Back up and upgrade the selected workspace
        first.
      </p>
    );
  return (
    <>
      <p className="eyebrow">DAILY WORK</p>
      <h1>Today</h1>
      <p>Priorities from approved work. Preparation suggestions stay local.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBrief(null);
          act(load);
        }}
      >
        <div className="task-filters">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            Timezone
            <input
              value={timezone}
              onChange={(e) => setZone(e.target.value)}
              required
            />
          </label>
          <label>
            Your recorded owner name
            <input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label>
            Project
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects</option>
              {data?.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details>
          <summary>Working hours and availability</summary>
          <p>
            Monday–Friday. Availability must cover all calendars and busy
            periods for the full seven-day window. Leave blank if unknown; no
            slots will be suggested.
          </p>
          <div className="task-filters">
            <label>
              Work start
              <input
                type="time"
                value={workStart}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Work end
              <input
                type="time"
                value={workEnd}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label>
              Preparation minutes
              <input
                type="number"
                min="15"
                max="240"
                value={prep}
                onChange={(e) => setPrep(e.target.value)}
              />
            </label>
            <label>
              Buffer minutes
              <input
                type="number"
                min="0"
                max="120"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
              />
            </label>
          </div>
          <label>
            Confirmed export coverage JSON
            <textarea
              value={coverage}
              onChange={(e) => setCoverage(e.target.value)}
              placeholder={
                '{"from":"…","to":"…","checkedAt":"…","complete":true}'
              }
              rows={4}
            />
          </label>
        </details>
        <button disabled={busy}>Refresh daily work</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <p className="mono">
            As of {data.date} · {data.timezone}
          </p>
          <section aria-label="Coverage gaps">
            <h2>Source coverage</h2>
            <ul>
              {data.gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p>{data.coverage.mode}</p>
          </section>
          <div className="task-filters">
            {[
              ["priorities", "Priorities"],
              ["promises", "My promises"],
              ["waitingFor", "Waiting for"],
              ["kanban", "Project Kanban"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "kanban" ? (
            <div className="daily-board">
              {statuses.map((status) => (
                <section key={status} aria-label={`Kanban ${status}`}>
                  <h2>{status}</h2>
                  {data.kanban
                    .filter((t) => t.status === status)
                    .map((t) => (
                      <div className="task-proposal" key={t.id}>
                        <h3>{t.title}</h3>
                        <p>{t.owner || "Unknown owner"}</p>
                        <label>
                          Move {t.title}
                          <select
                            disabled={busy}
                            value={t.status}
                            onChange={(e) =>
                              act(async () => {
                                await api("tasks/update", {
                                  id: t.id,
                                  expectedVersion: t.version,
                                  status: e.target.value,
                                });
                                await load();
                              })
                            }
                          >
                            {statuses.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                        {refs(t.evidence)}
                      </div>
                    ))}
                </section>
              ))}
            </div>
          ) : (
            <section aria-label="Daily task list">
              {data[view].length ? (
                data[view].map((t) => (
                  <article className="task-proposal" key={t.id}>
                    <h3>{t.title}</h3>
                    <p>
                      {t.reason || t.status} · Owner: {t.owner || "Unknown"}
                    </p>
                    <p className="mono">
                      Deadline: {t.dueDate || "Unknown"} {t.dueTime}{" "}
                      {t.timezone}
                    </p>
                    {refs(t.evidence)}
                  </article>
                ))
              ) : (
                <p>No matching approved work.</p>
              )}
            </section>
          )}
          <section aria-label="Week view">
            <h2>Next seven days</h2>
            {data.week.length ? (
              data.week.map((e) => (
                <article className="task-proposal" key={e.id}>
                  <h3>{e.title}</h3>
                  <p className="mono">
                    {new Date(e.timing.start).toLocaleString("en-GB", {
                      timeZone: data.timezone,
                    })}{" "}
                    –{" "}
                    {new Date(e.timing.end).toLocaleString("en-GB", {
                      timeZone: data.timezone,
                    })}{" "}
                    · {e.recurrenceId || "Single occurrence"}
                  </p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () =>
                        setBrief(await api("daily/meeting", { id: e.id })),
                      )
                    }
                  >
                    Prepare {e.title}
                  </button>
                </article>
              ))
            ) : (
              <p>No visible timed events in this window.</p>
            )}
          </section>
          <section aria-label="Preparation suggestions">
            <h2>Preparation suggestions</h2>
            {data.slots.map((s) => (
              <article key={s.eventId}>
                <h3>{s.title}</h3>
                <p>{s.reason}</p>
                {s.start && (
                  <p className="mono">
                    {new Date(s.start).toLocaleString("en-GB", {
                      timeZone: data.timezone,
                    })}{" "}
                    –{" "}
                    {new Date(s.end).toLocaleString("en-GB", {
                      timeZone: data.timezone,
                    })}
                  </p>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {schemaVersion >= 7 && (
        <Calendar api={api} slots={data?.slots || []} timezone={timezone} />
      )}
      {brief && (
        <section aria-label="Meeting brief" id="meeting-brief" tabIndex={-1}>
          <h2>{brief.event.title}</h2>
          <p>
            {brief.event.timing.start} ·{" "}
            {brief.event.recurrenceId || "Single occurrence"}
          </p>
          <p>
            Participants:{" "}
            {brief.event.timing.participants.join(", ") || "Unknown"}
          </p>
          <p>
            Project objective:{" "}
            {brief.project?.objective ?? "No project — meeting context only"}
          </p>
          {refs(brief.event.evidence)}
          <h3>Current tasks</h3>
          {brief.tasks.map((t) => (
            <article key={t.id}>
              <strong>{t.title}</strong>
              <p>
                {t.status} · {t.owner || "Unknown"} ·{" "}
                {t.dueDate || "No deadline"}
                {!t.evidenceCurrent ? " · Evidence needs review" : ""}
              </p>
              {refs(t.evidence)}
            </article>
          ))}
          <h3>Approved decisions</h3>
          {brief.decisions.map((m) => (
            <article key={m.id}>
              <p>{m.content}</p>
              {refs(m.evidence)}
            </article>
          ))}
          <h3>Related documents</h3>
          {brief.documents.map((d) => (
            <article key={d.passageId}>
              <strong>{d.title}</strong>
              {refs([d])}
            </article>
          ))}
          <h3>Open questions</h3>
          <ul>
            {brief.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <h3>Information gaps</h3>
          <ul>
            {brief.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>
      )}
      {passage && (
        <section aria-label="Daily source passage">
          <h2>{passage.title}</h2>
          <blockquote>{passage.text}</blockquote>
        </section>
      )}
    </>
  );
}
