import { OnboardingPrompt } from "./onboarding.jsx";
import WorkCharts from "./work-charts.jsx";
import { useSubview, navigate } from "./destination.js";
import { PageHeader, ViewTabs, EmptyState } from "./shell.jsx";
import React, { useState, useEffect } from "react";
const destination = (a) => `/app?${new URLSearchParams({ [a.kind]: a.id })}`;
const title = (r) =>
  r.name || r.title || r.task?.title || "Review recorded item";
const coverageText = (g) =>
  g.coverage.state === "current"
    ? "Current within selected scope"
    : g.coverage.state === "unknown"
      ? `${g.key === "emails" ? "Email" : "Calendar"} coverage not established`
      : `${g.coverage.state === "partial" ? "Partial" : "Stale"} source coverage`;
export default function Dashboard({
  api,
  daily,
  trainings,
  consulting,
  composer,
}) {
  const [view, setView] = useSubview(
    "home",
    ["Overview", "Today", "Trainings", "Consulting"],
    new URLSearchParams(location.search).has("event")
      ? "Today"
      : new URLSearchParams(location.search).has("training")
        ? "Trainings"
        : "Overview",
  );
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState({}),
    [passage, setPassage] = useState(null);
  async function load() {
    setData(await api("dashboard", {}));
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
  function focus(key) {
    const el = document.getElementById("signal-" + key);
    el?.focus();
    el?.scrollIntoView({ block: "nearest" });
  }
  function renderItem(r, g) {
    return (
      <article
        key={(r.action?.kind || "item") + r.id}
        className="executive-row"
      >
        <div>
          <h3>{title(r)}</h3>
          {r.reason && <p className="priority-reason">{r.reason}</p>}
          <p className="record-meta">
            {r.dueDate ||
              r.start ||
              r.timing?.start ||
              r.occurredAt ||
              r.status ||
              r.state}
            {r.owner && ` · ${r.owner}`}
          </p>
          {r.deadlineReview && (
            <p>
              Ambiguous local deadline time: verify before treating as overdue.
            </p>
          )}
          {r.preparation && <p>{r.preparation}</p>}
          {g.key === "emails" && (
            <>
              <p>
                {r.sender} · {r.ageHours} hours · {r.state}
              </p>
              <blockquote>{r.excerpt}</blockquote>
              <p>{r.coverage}</p>
              <div className="page-actions">
                {["confirmed", "dismissed", "snoozed"].map((state) => (
                  <button
                    className="secondary"
                    key={state}
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api("email/review", {
                          id: r.id,
                          digest: r.digest,
                          state,
                          ...(state === "snoozed"
                            ? {
                                until: new Date(
                                  Date.now() + 86400000,
                                ).toISOString(),
                              }
                            : {}),
                        }),
                      )
                    }
                  >
                    {state === "snoozed"
                      ? "Snooze 24 hours"
                      : state === "confirmed"
                        ? "Confirm needs reply"
                        : "Dismiss"}
                  </button>
                ))}
              </div>
            </>
          )}
          {!!r.evidence?.length && (
            <details>
              <summary>Inspect evidence ({r.evidence.length})</summary>
              {r.evidence.map((e, i) => (
                <button
                  className="text-link"
                  key={e.passageId + ":" + i}
                  onClick={() =>
                    act(async () =>
                      setPassage(await api("passage/" + e.passageId)),
                    )
                  }
                >
                  Read evidence {i + 1}
                </button>
              ))}
            </details>
          )}
        </div>
        {r.action && (
          <a className="record-action" href={destination(r.action)}>
            {r.action.kind === "event"
              ? "Prepare this meeting"
              : r.action.kind === "proposal"
                ? "Review this proposal"
                : `Open ${r.action.kind}`}
          </a>
        )}
      </article>
    );
  }
  function section(key, label, items, subtitle) {
    const g = data.signals.find((g) => g.key === key);
    return (
      <section
        id={"signal-" + key}
        tabIndex={-1}
        aria-label={g.label}
        className="executive-section"
      >
        <div className="section-heading">
          <h2>{label}</h2>
          <span className="mono">{items.length}</span>
        </div>
        {subtitle && <p className="app-note">{subtitle}</p>}
        {items.length ? (
          items
            .slice(0, expanded[key] ? items.length : 5)
            .map((r) => renderItem(r, g))
        ) : (
          <p className="executive-empty">
            {g.coverage.state === "current"
              ? `No recorded ${key === "attention" ? "items needing attention" : g.label.toLowerCase()} in this scope.`
              : coverageText(g) + ". Connect or review selected sources."}
          </p>
        )}
        {items.length > 5 && (
          <button
            className="text-link"
            onClick={() => setExpanded({ ...expanded, [key]: !expanded[key] })}
          >
            {expanded[key] ? "Show less" : `View all ${items.length}`}
          </button>
        )}
        {g.coverage.state !== "current" && (
          <button
            className="text-link"
            onClick={() => navigate("configuration", "Connections")}
          >
            Review connections
          </button>
        )}
        <details className="coverage-details">
          <summary>Source coverage · {g.coverage.state}</summary>
          <p>{g.coverage.scope}</p>
          <p>Last successful refresh: {g.coverage.lastSuccess || "Unknown"}</p>
        </details>
      </section>
    );
  }
  return (
    <>
      <OnboardingPrompt api={api} />
      <PageHeader
        eyebrow="YOUR CHIEF OF STAFF"
        title="What needs your attention."
        actions={
          <button
            className="secondary"
            disabled={busy}
            onClick={() => act(async () => {})}
          >
            Refresh dashboard
          </button>
        }
      >
        <p>
          {data
            ? `${data.date} · ${data.timezone}`
            : "Your decisions, agenda and delivery priorities."}
        </p>
      </PageHeader>
      <ViewTabs
        label="Home views"
        values={["Overview", "Today", "Trainings", "Consulting"]}
        value={view}
        onChange={setView}
      />
      {view === "Overview" && composer}
      {error && <p role="alert">{error}</p>}
      {view === "Today" ? (
        daily
      ) : view === "Trainings" ? (
        trainings
      ) : view === "Consulting" ? (
        consulting
      ) : !data ? (
        <p role="status">Loading daily signals…</p>
      ) : (
        <>
          <div className="executive-kpis" aria-label="Executive indicators">
            {data.executive.indicators.map((k) => (
              <button key={k.key} onClick={() => focus(k.target)}>
                <span>{k.label}</span>
                <strong className="mono">
                  {k.count || (k.coverage.state === "current" ? 0 : "—")}
                </strong>
                <small>
                  {k.coverage.state === "current"
                    ? "Recorded in this workspace"
                    : `${k.coverage.state} coverage`}
                </small>
              </button>
            ))}
          </div>
          <div className="executive-coverage">
            <span>
              Selected sources only ·{" "}
              {data.signals.filter((g) => g.coverage.state !== "current").length
                ? "Some source coverage is incomplete"
                : "Recorded scopes are current"}
            </span>
            <button
              className="text-link"
              onClick={() => navigate("configuration", "Connections")}
            >
              Manage sources
            </button>
          </div>
          <div className="executive-grid">
            <div>
              {section(
                "attention",
                "Decisions and attention",
                data.executive.queue,
                "Overdue and blocked work first; approvals remain yours.",
              )}
              {section(
                "meetings",
                data.executive.agenda.length
                  ? "Today’s agenda"
                  : "Next meetings",
                data.executive.agenda.length
                  ? data.executive.agenda
                  : data.signals.find((g) => g.key === "meetings").items,
                "Open a meeting to prepare from its evidence.",
              )}
              {data.emails.length > 0 &&
                section(
                  "emails",
                  "Email awaiting reply",
                  data.emails,
                  "Candidates for review; unread does not mean unanswered.",
                )}
            </div>
            <aside aria-label="Delivery outlook">
              {section(
                "deadlines",
                "Deadlines",
                data.deadlines,
                "Next seven days; overdue work appears in attention.",
              )}
              {data.followups.length > 0 &&
                section("followups", "Waiting for", data.followups)}
              {data.trainings.length > 0 &&
                section(
                  "trainings",
                  "Training preparation",
                  data.trainings,
                  "Client delivery sessions in the next 30 days.",
                )}
              {!data.followups.length && !data.trainings.length && (
                <EmptyState title="Build your daily picture">
                  Approved waiting-for tasks and upcoming client training
                  sessions will appear here.
                  <button
                    className="text-link"
                    onClick={() => navigate("home", "Trainings")}
                  >
                    View training delivery
                  </button>
                </EmptyState>
              )}
            </aside>
          </div>
          <WorkCharts projects={data.projects} />
          {passage && (
            <section
              aria-label="Signal evidence"
              className="executive-evidence"
              tabIndex={-1}
            >
              <h2>{passage.title || "Signal evidence"}</h2>
              <blockquote>{passage.text}</blockquote>
              <p className="mono">
                {passage.revision_id || passage.revisionId}
              </p>
              <button className="secondary" onClick={() => setPassage(null)}>
                Close evidence
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}
