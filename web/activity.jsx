import React, { useEffect, useState } from "react";
import { Drawer, ProductTabs } from "./product-ui.jsx";
import { StatusLabel } from "./shell.jsx";
import EmailDrafts from "./email-drafts.jsx";
import Calendar from "./calendar.jsx";
import { useLocationSearch } from "./destination.js";
const labels = {
  draft: "Draft",
  proposed: "Needs review",
  approved: "Approved",
  completed: "Completed",
  executed: "Completed",
  uncertain: "Outcome uncertain",
  failed: "Failed",
  cancelled: "Cancelled",
  reviewed: "Reviewed",
  rejected: "Dismissed",
};
const stages = {
  "preparing-context": "Preparing context",
  generating: "Generating",
  reading: "Reading",
  validating: "Validating response",
  completed: "Complete",
  cancelled: "Cancelled",
  uncertain: "Outcome uncertain",
};
export function openResult(href) {
  if (!href.startsWith("/app?")) return;
  history.pushState(null, "", href);
  window.dispatchEvent(new Event("hoi:navigate"));
}
export function Progress({ events = [] }) {
  if (!events.length) return null;
  const last = events.at(-1);
  return (
    <div className="work-progress">
      <p role="status" aria-live="polite">
        {stages[last.stage] ?? last.stage}
        {last.operation ? " · " + last.operation : ""}
      </p>
      <details>
        <summary>Activity history</summary>
        <ol>
          {events.map((e) => (
            <li key={e.sequence}>
              {stages[e.stage] ?? e.stage}
              {e.operation ? " · " + e.operation : ""}{" "}
              <time>{new Date(e.recordedAt).toLocaleTimeString()}</time>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
export function ResultCard({ card, api, onChanged, onEvidence, onOpen }) {
  const [edit, setEdit] = useState(false),
    [task, setTask] = useState(card.task),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [evidence, setEvidence] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("chat/propose", {
        runId: card.runId,
        expectedVersion: card.version,
        ...(edit ? { task } : {}),
      });
      setEdit(false);
      await onChanged?.();
      window.dispatchEvent(new Event("hoi:activity"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="result-card" aria-label={card.kind + " result"}>
      <div className="result-card-heading">
        <span className="meta">{card.kind.replaceAll("-", " ")}</span>
        <StatusLabel>{labels[card.state] ?? card.state}</StatusLabel>
      </div>
      <h3>{card.title}</h3>
      <p>{card.summary}</p>
      {card.task && (
        <p className="meta">
          Owner: {card.task.owner ?? "Not recorded"} · Due:{" "}
          {card.task.dueDate ?? "Not recorded"}
        </p>
      )}
      {card.evidenceCurrent === false && (
        <p>Evidence has changed. Recheck it before approval.</p>
      )}
      {edit && (
        <div className="task-form">
          {["title", "outcome", "owner", "dueDate"].map((k) => (
            <label key={k}>
              {
                {
                  title: "Title",
                  outcome: "Outcome",
                  owner: "Owner",
                  dueDate: "Due date",
                }[k]
              }
              {k === "outcome" ? (
                <textarea
                  value={task[k] ?? ""}
                  onChange={(e) => setTask({ ...task, [k]: e.target.value })}
                />
              ) : (
                <input
                  type={k === "dueDate" ? "date" : "text"}
                  value={task[k] ?? ""}
                  onChange={(e) =>
                    setTask({ ...task, [k]: e.target.value || null })
                  }
                />
              )}
            </label>
          ))}
        </div>
      )}
      <div className="result-actions">
        {card.state === "draft" && card.runId && (
          <>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setEdit(!edit)}
            >
              {edit ? "Close editor" : "Edit draft"}
            </button>
            <button disabled={busy} onClick={save}>
              Save for review
            </button>
          </>
        )}
        {card.kind === "task-proposal" && card.state === "proposed" && (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("tasks/review", {
                  id: card.id.slice(9),
                  expectedVersion: card.version,
                  decision: "rejected",
                });
                await onChanged?.();
                window.dispatchEvent(new Event("hoi:activity"));
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Dismiss
          </button>
        )}
        {card.href && (
          <a
            href={card.href}
            onClick={(e) => {
              e.preventDefault();
              openResult(card.href);
              onOpen?.();
            }}
          >
            {["proposed", "approved", "uncertain"].includes(card.state)
              ? "Review"
              : "Open record"}
          </a>
        )}
        {(onEvidence || card.evidence?.length > 0) && (
          <button
            className="secondary"
            onClick={() => (onEvidence ? onEvidence() : setEvidence(!evidence))}
          >
            Open evidence
          </button>
        )}
      </div>
      {evidence && (
        <section aria-label="Supporting evidence">
          {card.evidence.map((e, i) => (
            <blockquote key={i}>
              {e.quote}
              <small>Revision {e.revisionId}</small>
            </blockquote>
          ))}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function TurnResults({ api, turn, onChanged, onEvidence }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false,
      inflight = false;
    async function load() {
      if (document.hidden || inflight) return;
      inflight = true;
      try {
        const r = await api("chat/results/" + turn.id);
        if (!stopped) {
          setData(r);
          setError("");
        }
      } catch (e) {
        if (!stopped) {
          setData(null);
          setError("Results unavailable. Access or evidence may have changed.");
        }
      } finally {
        inflight = false;
      }
    }
    load();
    const timer =
      turn.state === "awaiting-assistant" ? setInterval(load, 2000) : null;
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [turn.id, turn.version]);
  return (
    <>
      {error && <p role="status">{error}</p>}
      <Progress events={data?.events} />
      {data?.cards.map((c) => (
        <ResultCard
          key={c.id}
          card={c}
          api={api}
          onChanged={onChanged}
          onEvidence={onEvidence}
        />
      ))}
    </>
  );
}
export function ActivityButton({ api }) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("Needs attention"),
    [category, setCategory] = useState("all"),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  const bucket = {
    Running: "running",
    "Needs attention": "attention",
    Completed: "completed",
  }[tab];
  async function load(cursor) {
    try {
      const r = await api(
        "activity?" +
          new URLSearchParams({
            bucket,
            category,
            ...(cursor ? { cursor } : {}),
          }),
      );
      setData((old) =>
        cursor ? { ...r, items: [...(old?.items ?? []), ...r.items] } : r,
      );
      setError("");
    } catch (e) {
      setData(null);
      setError(e.message);
    }
  }
  useEffect(() => {
    let stopped = false,
      inflight = false;
    async function refresh() {
      if (document.hidden || inflight) return;
      inflight = true;
      try {
        const r = await api(
          "activity?" + new URLSearchParams({ bucket, category }),
        );
        if (!stopped) {
          setData(r);
          setError("");
        }
      } catch (e) {
        if (!stopped) {
          setData(null);
          setError(e.message);
        }
      } finally {
        inflight = false;
      }
    }
    refresh();
    window.addEventListener("hoi:activity", refresh);
    const timer = open ? setInterval(refresh, 3000) : null;
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("hoi:activity", refresh);
    };
  }, [open, bucket, category]);
  return (
    <>
      <button className="secondary" onClick={() => setOpen(true)}>
        Activity{data ? " · " + data.counts.attention : ""}
      </button>
      {open && (
        <Drawer title="Activity" onClose={() => setOpen(false)}>
          <div className="activity-heading">
            <h2>Activity</h2>
            <button className="secondary" onClick={() => setOpen(false)}>
              Close Activity
            </button>
          </div>
          <ProductTabs
            label="Activity state"
            values={["Running", "Needs attention", "Completed"]}
            value={tab}
            onChange={setTab}
          />
          <label>
            Show
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All work</option>
              <option value="chat">Chat</option>
              <option value="imports">Imports / sync</option>
              <option value="reviews">Reviews</option>
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          {!data && !error && <p role="status">Loading activity…</p>}
          {data?.items.length === 0 && <p>No recorded work in this view.</p>}
          {data?.items.map((c) => (
            <section key={c.id}>
              <ResultCard card={c} api={api} onOpen={() => setOpen(false)} />
              {c.updatedAt && (
                <p className="meta">
                  Updated {new Date(c.updatedAt).toLocaleString()}
                </p>
              )}
              <Progress events={c.events} />
              {c.jobId && ["queued", "running"].includes(c.state) && (
                <>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await api("ai/cancel", { id: c.jobId });
                        await load();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                  >
                    Cancel request
                  </button>
                  <p className="meta">
                    An already-dispatched external request may still complete.
                  </p>
                </>
              )}
            </section>
          ))}
          {data?.nextCursor && (
            <button className="secondary" onClick={() => load(data.nextCursor)}>
              Load more
            </button>
          )}
        </Drawer>
      )}
    </>
  );
}
export function Suggestions({ api }) {
  const search = useLocationSearch(),
    query = new URLSearchParams(search),
    review = query.get("review"),
    record = query.get("record");
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Needs attention");
  async function load(cursor) {
    try {
      const r = await api(
        "suggestions?" +
          new URLSearchParams({
            bucket: tab === "History" ? "completed" : "attention",
            ...(cursor ? { cursor } : {}),
          }),
      );
      setData((old) =>
        cursor ? { ...r, items: [...(old?.items ?? []), ...r.items] } : r,
      );
      setError("");
    } catch (e) {
      setData(null);
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [tab, search]);
  return (
    <section aria-label="Suggestions">
      <ProductTabs
        label="Suggestion state"
        values={["Needs attention", "History"]}
        value={tab}
        onChange={setTab}
      />
      <p>
        Review source-backed proposals. Approval and execution remain separate.
      </p>
      {error && <p role="alert">{error}</p>}
      {data?.items.length === 0 && <p>No recorded suggestions in this view.</p>}
      {data?.items.map((c) => (
        <ResultCard key={c.id} card={c} api={api} onChanged={() => load()} />
      ))}
      {data?.nextCursor && (
        <button className="secondary" onClick={() => load(data.nextCursor)}>
          Load more
        </button>
      )}
      {review && record && (
        <Drawer
          title="Review suggestion"
          onClose={() => openResult("/app?view=inbox&section=Suggestions")}
        >
          <button
            className="secondary"
            onClick={() => openResult("/app?view=inbox&section=Suggestions")}
          >
            Close review
          </button>
          {review === "email" ? (
            <EmailDrafts api={api} selectedId={record} />
          ) : review === "calendar" ? (
            <Calendar api={api} selectedId={record} />
          ) : (
            <p>Review unavailable.</p>
          )}
        </Drawer>
      )}
    </section>
  );
}
