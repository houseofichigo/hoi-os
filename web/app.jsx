import Memory from "./memory";
import { ActivityButton } from "./activity.jsx";
import Inbox from "./inbox.jsx";
import WikiLibrary from "./wiki-core.jsx";
import Showcase from "./showcase.jsx";
import Delivery from "./delivery.jsx";
import Skills from "./skills.jsx";
import {
  requested,
  navigate,
  routeView,
  useLocationSearch,
  useSubview,
} from "./destination.js";
import {
  RecoveryState,
  ViewErrorBoundary,
  ViewTabs,
  StatusLabel,
} from "./shell.jsx";
import Hub from "./hub.jsx";
import Records from "./records.jsx";
import Dashboard from "./dashboard.jsx";
import Configuration from "./configuration.jsx";
import Chat from "./chat.jsx";
import Maintenance from "./maintenance.jsx";
import Daily from "./daily.jsx";
import Tasks from "./tasks.jsx";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./style.css";
import "./app.css";
import "./product.css";
const incomingToken = /^[a-f0-9]{64}$/.test(location.hash.slice(1))
  ? location.hash.slice(1)
  : "";
const token = incomingToken || sessionStorage.getItem("hoi-map-token") || "";
if (incomingToken) {
  sessionStorage.setItem("hoi-map-token", token);
  history.replaceState(null, "", location.pathname + location.search);
}
function connectionError(code, message) {
  const error = Object.assign(new Error(message), { code });
  window.dispatchEvent(
    new CustomEvent("hoi:connection-error", { detail: code }),
  );
  return error;
}
async function api(path, body) {
  if (!token)
    throw connectionError(
      "SESSION_REQUIRED",
      "Open the authenticated workspace link from the launcher.",
    );
  let r;
  try {
    r = await fetch(`/api/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw connectionError(
      "SERVER_UNAVAILABLE",
      "The local server is unavailable. Restart the app command and open its new URL.",
    );
  }
  if (r.status === 401)
    throw connectionError(
      "SESSION_EXPIRED",
      "Open the new authenticated workspace link from the launcher.",
    );
  if (!r.ok) {
    let message = "";
    try {
      message = (await r.json()).error;
    } catch {}
    throw Error(
      r.status === 401
        ? "This session has expired. Open the new URL printed by the app command."
        : message || "The requested action is unavailable for this host.",
    );
  }
  const result = await r.json();
  if (body) window.dispatchEvent(new Event("hoi:activity"));
  return result;
}
const VIEWS = [
  ["home", "Home"],
  ["inbox", "Inbox"],
  ["knowledge", "Knowledge Hub"],
  ["projects", "Projects"],
  ["clients", "Clients"],
  ["chat", "Chat"],
  ["skills", "Skills"],
  ["configuration", "Configuration"],
];
function Chip({ value }) {
  return <span className={`chip ${value}`}>{value}</span>;
}
function Passage({ passage }) {
  return (
    <blockquote className="evidence-quote">
      <p className="mono">
        {passage.title} · {passage.location}
      </p>
      <p>{passage.text}</p>
    </blockquote>
  );
}
function Home({ workspace, wikiPages, memories, go, setError }) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [busy, setBusy] = useState(false),
    [passage, setPassage] = useState(null);
  const proposedMemories = memories.filter((m) => m.state === "proposed");
  const draftPages = wikiPages.filter((p) => p.status === "draft");
  async function ask(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setPassage(null);
    try {
      setResults(await api(`retrieve?q=${encodeURIComponent(query)}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>
        The work, <span className="accent">connected.</span>
      </h1>
      <p className="lede">
        Source-backed answers from your own knowledge. Every claim keeps its
        evidence.
      </p>
      <form className="ask" onSubmit={ask}>
        <input
          type="search"
          placeholder="Ask your workspace — a client, a decision, a document…"
          value={query}
          aria-label="Ask your workspace"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy}>{busy ? "Searching…" : "Ask"}</button>
      </form>
      {results && (
        <>
          <p className="group-head">EVIDENCE</p>
          {results.results.length ? (
            <ul className="row-list">
              {results.results.map((r) => (
                <li key={r.passageId}>
                  <div className="grow">
                    <strong>{r.title}</strong>
                    <small>{r.quote}</small>
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          setPassage(await api(`passage/${r.passageId}`));
                        } catch (e) {
                          setError(e.message);
                        }
                      }}
                    >
                      Read full passage
                    </button>
                  </div>
                  <Chip value={r.status ?? "unknown"} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="app-note">
              No permitted matching evidence. The answer is not invented when
              the sources are silent.
            </p>
          )}
          {passage && <Passage passage={passage} />}
        </>
      )}
      <p className="group-head">AT A GLANCE</p>
      <div className="stat-row">
        {[
          ["Sources", workspace?.counts.sources ?? 0],
          ["Wiki pages", workspace?.counts.wikiPages ?? 0],
          ["Memories", workspace?.counts.memories ?? 0],
        ].map(([label, value]) => (
          <div className="stat-block" key={label}>
            <div className="stat-value">{String(value).padStart(2, "0")}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
      <p className="group-head">SUGGESTED ACTIONS</p>
      <div className="suggest">
        {proposedMemories.length > 0 && (
          <button onClick={() => go("memory")}>
            Review {proposedMemories.length} proposed{" "}
            {proposedMemories.length === 1 ? "memory" : "memories"}
          </button>
        )}
        {draftPages.length > 0 && (
          <button onClick={() => go("wiki")}>
            Review {draftPages.length} wiki draft
            {draftPages.length === 1 ? "" : "s"}
          </button>
        )}
        <button onClick={() => (location.href = `/#${token}`)}>
          Open the 3D map
        </button>
      </div>
      <p className="app-note">
        Ingestion, onboarding, and connections run through your assistant with
        the HOI skills; this app reads your workspace and records your reviews.
      </p>
    </>
  );
}
function Brain({ graph }) {
  const groups = {};
  for (const n of graph.nodes)
    if (!["document", "memory", "wiki", "capability", "tool"].includes(n.type))
      groups[n.type] = [...(groups[n.type] ?? []), n];
  const names = Object.keys(groups).sort();
  return (
    <>
      <p className="eyebrow">BRAIN</p>
      <h1>What your workspace knows.</h1>
      <p className="lede">
        Declared entities and their relationships. Matching names never merge
        without review.
      </p>
      {names.length ? (
        names.map((type) => (
          <div key={type}>
            <p className="group-head">
              {type.toUpperCase()} · {groups[type].length}
            </p>
            <ul className="row-list">
              {groups[type].map((n) => (
                <li key={n.id}>
                  <div className="grow">
                    <strong>{n.name}</strong>
                    {n.aliases?.length ? (
                      <small>also: {n.aliases.join(", ")}</small>
                    ) : null}
                  </div>
                  <time className="mono">{n.date ?? ""}</time>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="app-note">
          No entities yet. Declare people, clients, and projects through
          hoi-ingest and the entity command in your assistant.
        </p>
      )}
    </>
  );
}
function Wiki({ schemaVersion }) {
  return schemaVersion >= 15 ? (
    <WikiLibrary api={api} />
  ) : (
    <p>
      Upgrade a verified workspace copy to schema 15 to use the wiki editor.
    </p>
  );
}

function Sources({ sources, connections }) {
  return (
    <>
      <p className="eyebrow">SOURCES</p>
      <h1>Evidence in, provenance kept.</h1>
      <p className="lede">
        Originals are preserved and checksummed. Connections are live reads
        attested by your assistant, never stored credentials.
      </p>
      <p className="group-head">IN YOUR BRAIN · {sources.length}</p>
      {sources.length ? (
        <ul className="row-list">
          {sources.map((s) => (
            <li key={s.id}>
              <div className="grow">
                <strong>{s.title}</strong>
                <small>
                  {s.documentType} · {s.authority}
                  {s.client ? ` · ${s.client}` : ""}
                  {s.extractionStatus !== "ready"
                    ? ` · extraction ${s.extractionStatus}`
                    : ""}
                </small>
              </div>
              <time className="mono">{s.effectiveDate ?? "date unknown"}</time>
              <Chip value={s.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="app-note">
          Nothing ingested yet. Point hoi-ingest at your raw-materials folder in
          your assistant.
        </p>
      )}
      <p className="group-head">CONNECTORS</p>
      <ul className="row-list">
        {(connections?.connections ?? []).map((c) => (
          <li key={`${c.provider}-${c.host}`}>
            <div className="grow">
              <strong style={{ textTransform: "capitalize" }}>
                {c.provider}
              </strong>
              <small>
                via {c.host} · {c.mechanism} · checked{" "}
                {c.checkedAt?.slice(0, 10)}
              </small>
            </div>
            <Chip value={c.status} />
          </li>
        ))}
      </ul>
      {!(connections?.connections ?? []).length && (
        <p className="app-note">
          No connections recorded. Run hoi-connect in your assistant to attest
          Gmail, Calendar, Drive, or GitHub access for this workspace.
        </p>
      )}
    </>
  );
}
function ProjectsArea({ api, graph, schemaVersion }) {
  const [tab, setTab] = useSubview(
    "projects",
    ["portfolio", "tasks"],
    requested("task") || requested("proposal") ? "tasks" : "portfolio",
  );
  return (
    <>
      <ViewTabs
        label="Project views"
        values={["Portfolio", "Tasks & approvals"]}
        value={tab === "portfolio" ? "Portfolio" : "Tasks & approvals"}
        onChange={(t) => setTab(t === "Portfolio" ? "portfolio" : "tasks")}
      />
      {tab === "portfolio" ? (
        <Records api={api} kind="project" />
      ) : (
        <Tasks api={api} graph={graph} schemaVersion={schemaVersion} />
      )}
    </>
  );
}
function App() {
  const search = useLocationSearch();
  const view = routeView(search);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [connectionCode, setConnectionCode] = useState(null);
  const [error, setError] = useState(""),
    [workspace, setWorkspace] = useState(null),
    [graph, setGraph] = useState({ nodes: [], links: [] }),
    [wikiPages, setWikiPages] = useState([]),
    [memories, setMemories] = useState([]),
    [sources, setSources] = useState([]),
    [connections, setConnections] = useState(null),
    [loading, setLoading] = useState(true);
  async function refresh() {
    if (!workspace || connectionCode) setLoading(true);
    setConnectionCode(null);
    setError("");
    try {
      const w = await api("workspace");
      if (!w || !Number.isInteger(w.schemaVersion))
        throw Error("Invalid workspace response");
      setWorkspace(w);
      const results = await Promise.allSettled([
        api("graph"),
        api("wiki"),
        api("memory"),
        api("sources"),
        api("connections"),
      ]);
      const setters = [
        setGraph,
        setWikiPages,
        setMemories,
        setSources,
        setConnections,
      ];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") setters[i](r.value);
        else setters[i]([{ nodes: [], links: [] }, [], [], [], null][i]);
      });
      if (results.some((r) => r.status === "rejected"))
        setError(
          "Some supporting records could not load. Retry workspace data before relying on empty lists.",
        );
    } catch (e) {
      setWorkspace(null);
      setConnectionCode(e.code || "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const failed = (e) => setConnectionCode(e.detail);
    window.addEventListener("hoi:connection-error", failed);
    refresh();
    return () => window.removeEventListener("hoi:connection-error", failed);
  }, []);
  useEffect(() => {
    setNavigationOpen(false);
  }, [search]);
  return (
    <div className={`app-shell view-${view}`}>
      <a className="workspace-skip" href="#workspace-main">
        Skip to workspace
      </a>
      <nav className="app-nav" aria-label="Workspace">
        <button
          className="navigation-toggle"
          aria-expanded={navigationOpen}
          aria-controls="workspace-navigation"
          onClick={() => setNavigationOpen(!navigationOpen)}
        >
          Menu
        </button>
        <div className="brand">
          <img src="/mark.png" alt="House of Ichigo" className="logo-mark" />
          <span>
            House of Ichigo
            <span className="subbrand">WORKSPACE</span>
          </span>
        </div>
        <div
          id="workspace-navigation"
          className={`workspace-navigation ${navigationOpen ? "is-open" : ""}`}
        >
          {[...VIEWS]
            .sort(
              (a, b) =>
                [
                  "home",
                  "inbox",
                  "projects",
                  "clients",
                  "knowledge",
                  "chat",
                  "skills",
                  "configuration",
                ].indexOf(a[0]) -
                [
                  "home",
                  "inbox",
                  "projects",
                  "clients",
                  "knowledge",
                  "chat",
                  "skills",
                  "configuration",
                ].indexOf(b[0]),
            )
            .map(([id, label]) => (
              <React.Fragment key={id}>
                {id === "home" && <span className="nav-group">Work</span>}
                {id === "knowledge" && (
                  <span className="nav-group">Intelligence</span>
                )}
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => {
                    navigate(id);
                    setNavigationOpen(false);
                    requestAnimationFrame(() =>
                      document.getElementById("workspace-main")?.focus(),
                    );
                  }}
                >
                  {label}
                </button>
              </React.Fragment>
            ))}
        </div>
        <div className="nav-foot">
          LOCAL WORKSPACE
          <br />
          REVIEWABLE ACTIONS ONLY
        </div>
      </nav>
      <div className="workspace-body">
        <div className="workspace-topbar">
          <div>
            <span className="workspace-label">
              {workspace?.displayName || "Private workspace"}
            </span>
            <span className="workspace-location">
              {VIEWS.find(([id]) => id === view)?.[1]}
            </span>
          </div>
          <div className="workspace-health">
            {workspace?.schemaVersion >= 18 && !connectionCode && (
              <ActivityButton api={api} />
            )}
            {workspace?.environment === "demo" && (
              <StatusLabel>Fictional demo</StatusLabel>
            )}
            <StatusLabel tone={connectionCode ? "warning" : "neutral"}>
              {loading
                ? "Connecting"
                : connectionCode
                  ? "Connection needed"
                  : workspace
                    ? "Local engine connected"
                    : "Not connected"}
            </StatusLabel>
            <span className="workspace-alpha">Alpha</span>
          </div>
        </div>
        <main id="workspace-main" tabIndex={-1} className="app-main">
          {[
            "project",
            "client",
            "task",
            "proposal",
            "source",
            "event",
            "training",
            "connection",
          ].some((k) => requested(k)) && (
            <a
              className="text-link"
              href="/app?view=home"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  navigate("home");
                }
              }}
            >
              Back to Home
            </a>
          )}
          {error && !connectionCode && (
            <div role="alert" className="app-error">
              {error}{" "}
              <button className="secondary" onClick={refresh}>
                Retry workspace data
              </button>
            </div>
          )}
          <ViewErrorBoundary key={view}>
            {requested("showcase") === "components" ? (
              <Showcase />
            ) : loading ? (
              <p role="status" className="app-note">
                Loading your workspace…
              </p>
            ) : connectionCode || !workspace ? (
              <RecoveryState
                code={connectionCode || "REQUEST_FAILED"}
                onRetry={refresh}
              />
            ) : workspace.schemaVersion < 12 ? (
              <p>
                Back up and upgrade this workspace to use the redesigned app.
                Existing CLI commands remain available.
              </p>
            ) : view === "home" ? (
              <Dashboard
                composer={
                  <Chat
                    api={api}
                    token={token}
                    schemaVersion={workspace.schemaVersion}
                    entry="home"
                  />
                }
                api={api}
                daily={
                  <Daily api={api} schemaVersion={workspace.schemaVersion} />
                }
                trainings={<Delivery api={api} type="training" />}
                consulting={<Delivery api={api} type="consulting" />}
              />
            ) : view === "inbox" ? (
              <Inbox
                api={api}
                token={token}
                schemaVersion={workspace.schemaVersion}
              />
            ) : view === "skills" ? (
              <Skills api={api} schemaVersion={workspace.schemaVersion} />
            ) : view === "chat" ? (
              <Chat
                api={api}
                token={token}
                schemaVersion={workspace.schemaVersion}
              />
            ) : view === "knowledge" ? (
              <Hub
                composer={
                  <Chat
                    api={api}
                    token={token}
                    schemaVersion={workspace.schemaVersion}
                    entry="knowledge"
                  />
                }
                api={api}
                token={token}
                views={{
                  overview: <Brain graph={graph} />,
                  wiki: (
                    <Wiki
                      wikiPages={wikiPages}
                      refresh={refresh}
                      setError={setError}
                      schemaVersion={workspace.schemaVersion}
                    />
                  ),
                  memory: (
                    <Memory
                      api={api}
                      memories={memories}
                      refresh={refresh}
                      setError={setError}
                    />
                  ),
                  reviews: (
                    <Maintenance
                      refresh={refresh}
                      api={api}
                      schemaVersion={workspace.schemaVersion}
                    />
                  ),
                }}
              />
            ) : view === "projects" ? (
              <ProjectsArea
                api={api}
                graph={graph}
                schemaVersion={workspace.schemaVersion}
              />
            ) : view === "clients" ? (
              <Records api={api} kind="client" />
            ) : (
              <Configuration api={api} />
            )}
          </ViewErrorBoundary>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ViewErrorBoundary>
    <App />
  </ViewErrorBoundary>,
);
