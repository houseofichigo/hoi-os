import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./style.css";
import "./app.css";
const token =
  location.hash.slice(1) || sessionStorage.getItem("hoi-map-token") || "";
if (location.hash) {
  sessionStorage.setItem("hoi-map-token", token);
  history.replaceState(null, "", location.pathname);
}
async function api(path, body) {
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
    throw Error(
      "The local server is unavailable. Restart the app command and open its new URL.",
    );
  }
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
  return r.json();
}
const VIEWS = [
  ["home", "Home"],
  ["brain", "Brain"],
  ["wiki", "Wiki"],
  ["sources", "Sources"],
  ["memory", "Memory"],
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
function Wiki({ wikiPages, refresh, setError }) {
  const [selected, setSelected] = useState(null),
    [page, setPage] = useState(null),
    [passage, setPassage] = useState(null),
    [busy, setBusy] = useState(false);
  async function open(id) {
    setSelected(id);
    setPassage(null);
    try {
      setPage(await api(`wiki/${id}`));
    } catch (e) {
      setError(e.message);
    }
  }
  async function act(path, body) {
    setBusy(true);
    try {
      await api(path, body);
      await refresh();
      if (selected) await open(selected);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">WIKI</p>
      <h1>The current view, with its sources.</h1>
      <p className="lede">
        Synthesized pages your assistant proposed. Nothing becomes canonical
        without your review.
      </p>
      {wikiPages.length ? (
        <ul className="row-list">
          {wikiPages.map((p) => (
            <li key={p.id}>
              <div className="grow">
                <button className="text-link" onClick={() => open(p.id)}>
                  {p.title}
                </button>
                <small>
                  {p.slug} · {p.type} · {p.evidenceCount} source
                  {p.evidenceCount === 1 ? "" : "s"}
                  {p.evidenceCurrent ? "" : " · evidence needs review"}
                </small>
              </div>
              <Chip value={p.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="app-note">
          No wiki pages yet. Ask your assistant to build them from your sources
          with hoi-wiki.
        </p>
      )}
      {page && (
        <div className="detail">
          <p className="eyebrow">
            {page.slug} · {page.type} · {page.status.toUpperCase()}
          </p>
          <h2>{page.title}</h2>
          {page.content.split(/\n{2,}/).map((block, i) => (
            <p key={i}>{block.replace(/^#+\s*/, "")}</p>
          ))}
          <div className="actions">
            {page.status === "draft" && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    act("wiki/review", { id: page.id, state: "reviewed" })
                  }
                >
                  Mark reviewed
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    act("wiki/review", { id: page.id, state: "rejected" })
                  }
                >
                  Reject
                </button>
              </>
            )}
            {page.status === "reviewed" && (
              <button
                disabled={busy}
                onClick={() => act("wiki/canonical", { id: page.id })}
              >
                Mark canonical
              </button>
            )}
          </div>
          <p className="group-head">SOURCES</p>
          {page.evidence.map((e) => (
            <button
              key={e.passageId}
              className="text-link"
              onClick={async () => {
                try {
                  setPassage(await api(`passage/${e.passageId}`));
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              {e.relation === "contradicts" ? "Contradicts: " : "Evidence: "}
              {e.quote.slice(0, 90)}
            </button>
          ))}
          {passage && <Passage passage={passage} />}
        </div>
      )}
    </>
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
function Memory({ memories, refresh, setError }) {
  const [busy, setBusy] = useState(false);
  async function review(id, state) {
    setBusy(true);
    try {
      await api("memory/review", { id, state });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const sections = [
    ["PROPOSED", memories.filter((m) => m.state === "proposed")],
    ["APPROVED", memories.filter((m) => m.state === "approved")],
    [
      "OTHER",
      memories.filter((m) => !["proposed", "approved"].includes(m.state)),
    ],
  ];
  return (
    <>
      <p className="eyebrow">MEMORY</p>
      <h1>What persists, on your say-so.</h1>
      <p className="lede">
        Facts, preferences, and decisions stay proposed until you approve them.
        Superseded memory keeps its history.
      </p>
      {sections.map(
        ([label, items]) =>
          items.length > 0 && (
            <div key={label}>
              <p className="group-head">
                {label} · {items.length}
              </p>
              <ul className="row-list">
                {items.map((m) => (
                  <li key={m.id}>
                    <div className="grow">
                      <strong>{m.content}</strong>
                      <small>
                        {m.type} · {m.durability} ·{" "}
                        {m.createdAt?.slice(0, 10) ?? "date unknown"}
                        {m.stale ? " · evidence needs review" : ""}
                      </small>
                      {m.state === "proposed" && (
                        <span
                          style={{ display: "flex", gap: 12, marginTop: 8 }}
                        >
                          <button
                            disabled={busy}
                            onClick={() => review(m.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            className="danger"
                            style={{
                              background: "transparent",
                              color: "var(--danger)",
                              border: "1px solid var(--danger)",
                            }}
                            disabled={busy}
                            onClick={() => review(m.id, "rejected")}
                          >
                            Reject
                          </button>
                        </span>
                      )}
                    </div>
                    <Chip value={m.stale ? "stale" : m.state} />
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      {!memories.length && (
        <p className="app-note">
          No memories yet. Capture decisions with hoi-capture or
          hoi-session-capture in your assistant.
        </p>
      )}
    </>
  );
}
function App() {
  const [view, setView] = useState("home"),
    [error, setError] = useState(""),
    [workspace, setWorkspace] = useState(null),
    [graph, setGraph] = useState({ nodes: [], links: [] }),
    [wikiPages, setWikiPages] = useState([]),
    [memories, setMemories] = useState([]),
    [sources, setSources] = useState([]),
    [connections, setConnections] = useState(null),
    [loading, setLoading] = useState(true);
  async function refresh() {
    setError("");
    try {
      const [w, g, wk, m, src, conn] = await Promise.all([
        api("workspace"),
        api("graph"),
        api("wiki"),
        api("memory"),
        api("sources"),
        api("connections"),
      ]);
      setWorkspace(w);
      setGraph(g);
      setWikiPages(wk);
      setMemories(m);
      setSources(src);
      setConnections(conn);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Workspace">
        <div className="brand">
          <img src="/mark.png" alt="House of Ichigo" className="logo-mark" />
          <span>
            House of Ichigo
            <span className="subbrand">WORKSPACE</span>
          </span>
        </div>
        {VIEWS.map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            aria-current={view === id ? "page" : undefined}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
        <button onClick={() => (location.href = `/#${token}`)}>
          Memory Map ↗
        </button>
        <div className="nav-foot">
          LOCAL WORKSPACE
          <br />
          REVIEWABLE ACTIONS ONLY
        </div>
      </nav>
      <main className="app-main">
        {error && (
          <p role="alert" className="app-error">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status" className="app-note">
            Loading your workspace…
          </p>
        ) : view === "home" ? (
          <Home
            workspace={workspace}
            wikiPages={wikiPages}
            memories={memories}
            go={setView}
            setError={setError}
          />
        ) : view === "brain" ? (
          <Brain graph={graph} />
        ) : view === "wiki" ? (
          <Wiki wikiPages={wikiPages} refresh={refresh} setError={setError} />
        ) : view === "sources" ? (
          <Sources sources={sources} connections={connections} />
        ) : (
          <Memory memories={memories} refresh={refresh} setError={setError} />
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
