import { Suggestions } from "./activity.jsx";
import Transcripts from "./transcripts.jsx";
import EmailDrafts from "./email-drafts.jsx";
import React, { useEffect, useState } from "react";
import { PageHeader, ViewTabs, EmptyState, StatusLabel } from "./shell.jsx";
import { Drawer } from "./product-ui.jsx";
import { useSubview } from "./destination.js";
import Tasks from "./tasks.jsx";
import Intake from "./intake.jsx";
import Daily from "./daily.jsx";
import ChatUpload from "./chat-upload.jsx";
export default function Inbox({ api, token, schemaVersion }) {
  const [tab, setTab] = useSubview(
    "inbox",
    ["Email", "Calendar", "Transcripts", "Suggestions"],
    "Email",
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [items, setItems] = useState([]),
    [candidates, setCandidates] = useState([]),
    [selected, setSelected] = useState(null),
    [request, setRequest] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  async function load() {
    const [i, c] = await Promise.all([
      api("inbox"),
      api("inbox/email-candidates"),
    ]);
    setItems(i);
    setCandidates(c);
    setRefreshVersion((v) => v + 1);
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
      setSelected(null);
      setRequest(null);
    } finally {
      setBusy(false);
    }
  }
  const kind = {
    Email: "email",
    Calendar: "calendar",
    Transcripts: "transcript",
  }[tab];
  const visible = items.filter(
    (i) =>
      i.kind === kind && i.title.toLowerCase().includes(search.toLowerCase()),
  );
  if (schemaVersion < 16)
    return (
      <EmptyState title="Inbox needs an upgraded workspace">
        Create a verified upgraded copy to enable standalone tasks.
      </EmptyState>
    );
  return (
    <>
      <PageHeader eyebrow="Daily work" title="Inbox">
        <p>Communications, meetings and actions. A project is optional.</p>
      </PageHeader>
      <ViewTabs
        label="Inbox views"
        values={["Email", "Calendar", "Transcripts", "Suggestions"]}
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSelected(null);
          setRequest(null);
        }}
      />
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading or saving…</p>}
      {tab === "Email" && (
        <section aria-label="Reply candidates">
          <h2>May need a reply</h2>
          <p>
            Based on selected thread history; unread does not mean unanswered.
          </p>
          {!candidates.length && (
            <p>
              No candidates in the available history.{" "}
              <a href="?view=configuration&section=Connections">
                Review coverage and connections
              </a>
            </p>
          )}
          {candidates.map((c) => (
            <article key={c.id}>
              <button
                className="record-link"
                onClick={() =>
                  act(async () => setSelected(await api(`inbox/item/${c.id}`)))
                }
              >
                {c.title}
              </button>
              <p>
                {c.sender} · {c.ageHours} hours · {c.state}
              </p>
              <p>{c.excerpt}</p>
              <div className="task-filters">
                {["confirmed", "dismissed", "snoozed"].map((state) => (
                  <button
                    key={state}
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api("email/review", {
                          id: c.id,
                          digest: c.digest,
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
            </article>
          ))}
        </section>
      )}
      {tab === "Transcripts" && (
        <Transcripts api={api} token={token} onChange={load} />
      )}
      {kind && (
        <>
          <div className="task-filters">
            <label>
              Search {tab.toLowerCase()}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <a href="?view=configuration&section=Connections">
              Manage connections
            </a>
          </div>
          <section aria-label="Inbox records">
            {!visible.length ? (
              <EmptyState
                title={
                  search
                    ? "No matching records"
                    : "No selected communications yet"
                }
              >
                Connect a selected scope or import an export. This is not a
                statement about your entire account.
              </EmptyState>
            ) : (
              visible.map((i) => (
                <article key={i.id}>
                  <button
                    className="record-link"
                    onClick={() =>
                      act(async () => {
                        setRequest(null);
                        setSelected(await api(`inbox/item/${i.id}`));
                      })
                    }
                  >
                    {i.title}
                  </button>
                  <p>
                    <StatusLabel>{i.state}</StatusLabel> ·{" "}
                    {i.projectId ? "Project linked" : "No project"} · Checked{" "}
                    {new Date(i.checkedAt).toLocaleString()}
                  </p>
                  {i.error && <p>{i.error}</p>}
                </article>
              ))
            )}
          </section>
        </>
      )}
      {tab === "Calendar" && (
        <details>
          <summary>Week planning and preparation slots</summary>
          <Daily api={api} schemaVersion={schemaVersion} />
        </details>
      )}
      {tab === "Suggestions" && schemaVersion >= 18 && (
        <Suggestions api={api} />
      )}
      {tab === "Suggestions" && schemaVersion < 18 && (
        <>
          <EmailDrafts api={api} />
          <Tasks api={api} schemaVersion={schemaVersion} standalone />
          <p>
            <a href="?view=knowledge&section=Reviews">Knowledge suggestions</a>{" "}
            ·{" "}
            <a href="?view=configuration&section=Connections">
              Connection and processing status
            </a>
          </p>
        </>
      )}
      {kind && (
        <details open={tab === "Transcripts"}>
          <summary>Reviewed extraction and duplicate matching</summary>
          <Intake
            key={items.map((i) => i.id).join(":") + refreshVersion}
            api={api}
            onChange={load}
          />
        </details>
      )}
      {selected && (
        <Drawer
          title={selected.title}
          onClose={() => {
            setSelected(null);
            setRequest(null);
          }}
        >
          <p>
            {selected.kind} ·{" "}
            {selected.projectId
              ? "Linked to project"
              : "Standalone communication"}
          </p>
          {selected.item.email && (
            <p>
              From {selected.item.email.sender} ·{" "}
              {selected.item.email.direction}
            </p>
          )}
          {selected.item.segments.map((s, i) => (
            <blockquote key={i}>
              {s.speaker && <strong>{s.speaker}: </strong>}
              {s.text}
              {s.quoted && <small>Quoted history</small>}
            </blockquote>
          ))}
          {selected.kind === "email" && (
            <EmailDrafts api={api} item={selected} />
          )}
          <a
            href={`?view=knowledge&section=Sources&source=${selected.sourceId}`}
          >
            Open preserved source
          </a>
          <div className="task-filters">
            <button
              disabled={busy}
              onClick={() =>
                act(async () =>
                  setRequest(await api("intake/prepare", { id: selected.id })),
                )
              }
            >
              Prepare task extraction
            </button>
            {selected.kind === "calendar" && (
              <button
                onClick={() =>
                  act(async () =>
                    setRequest(await api("daily/meeting", { id: selected.id })),
                  )
                }
              >
                Prepare meeting
              </button>
            )}
          </div>
          {request && (
            <section>
              <h3>Prepared context</h3>
              <p>
                Copy this reviewed request to your assistant; no model has run.
              </p>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    JSON.stringify(request, null, 2),
                  )
                }
              >
                Copy assistant request
              </button>
              <details>
                <summary>Request and evidence</summary>
                <pre>{JSON.stringify(request, null, 2)}</pre>
              </details>
            </section>
          )}
        </Drawer>
      )}
    </>
  );
}
