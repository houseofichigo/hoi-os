import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  lazy,
  Suspense,
  Component,
} from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./style.css";
import { filterGraph } from "./filters.js";
const ForceGraph = lazy(() => import("react-force-graph-3d"));
const token =
  location.hash.slice(1) || sessionStorage.getItem("hoi-map-token") || "";
if (location.hash) {
  sessionStorage.setItem("hoi-map-token", token);
  history.replaceState(null, "", location.pathname);
}
async function api(path) {
  let r;
  try {
    r = await fetch(`/api/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Error(
      "The local server is unavailable. Restart npm start and open its new URL, then refresh records.",
    );
  }
  if (!r.ok)
    throw Error(
      r.status === 401
        ? "This map session has expired. Open the new URL printed by the map command."
        : "The requested record is unavailable for this host.",
    );
  return r;
}
class GraphBoundary extends Component {
  state = { failed: false };
  componentDidCatch() {
    this.props.onFailure();
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status" className="empty">
        3D rendering is unavailable. All records remain accessible in the list
        below.
      </p>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [data, setData] = useState({ nodes: [], links: [] }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [view, setView] = useState("all"),
    [type, setType] = useState(""),
    [scope, setScope] = useState(""),
    [source, setSource] = useState(""),
    [basis, setBasis] = useState(""),
    [cutoff, setCutoff] = useState(""),
    [unknown, setUnknown] = useState(true),
    [selected, setSelected] = useState(null),
    [focus, setFocus] = useState(""),
    [tab, setTab] = useState("list"),
    [graphFailed, setGraphFailed] = useState(false),
    [passage, setPassage] = useState(null),
    [wiki, setWiki] = useState(null),
    [paused, setPaused] = useState(
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [width, setWidth] = useState(700);
  const graphRef = useRef(),
    panel = useRef();
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const r = await (await api("graph")).json();
      setData(r);
      setSelected(null);
      setPassage(null);
      setWiki(null);
    } catch (e) {
      setData({ nodes: [], links: [] });
      setSelected(null);
      setPassage(null);
      setWiki(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  useEffect(() => {
    if (!panel.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(200, entries[0].contentRect.width)),
    );
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [loading, tab]);
  useEffect(() => {
    if (graphRef.current)
      paused
        ? graphRef.current.pauseAnimation()
        : graphRef.current.resumeAnimation();
  }, [paused]);
  const filtered = useMemo(
    () =>
      filterGraph(data, {
        query,
        view,
        type,
        scope,
        source,
        basis,
        cutoff: view === "temporal" ? cutoff : "",
        unknown,
        focus,
      }),
    [data, query, view, type, scope, source, basis, cutoff, unknown, focus],
  );
  const graphData = useMemo(
    () => ({
      nodes: filtered.nodes.map((n) => ({ ...n })),
      links: filtered.links.map((l) => ({ ...l })),
    }),
    [filtered],
  );
  const dates = useMemo(
    () => [...new Set(data.nodes.map((n) => n.date).filter(Boolean))].sort(),
    [data],
  );
  const relations = selected
    ? data.links.filter(
        (l) => l.source === selected.id || l.target === selected.id,
      )
    : [];
  async function choose(n) {
    setSelected(n);
    setPassage(null);
    setWiki(null);
    if (n?.type === "wiki")
      try {
        setWiki(await (await api(`wiki/${n.id}`)).json());
      } catch (e) {
        setError(e.message);
      }
  }
  function switchView(value) {
    setView(value);
    setScope("");
    setFocus("");
    setType("");
  }
  async function showPassage(id) {
    try {
      setPassage(await (await api(`passage/${id}`)).json());
    } catch (e) {
      setError(e.message);
    }
  }
  async function download(n) {
    try {
      const r = await api(
          `original/${n.sourceId ?? n.id}${n.revisionId ? "?revision=" + encodeURIComponent(n.revisionId) : ""}`,
        ),
        url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = n.name ?? "original";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  const safeLabel = (n) => {
    const el = document.createElement("span");
    el.textContent = `${n.name} · ${n.type}`;
    return el;
  };
  return (
    <>
      <a className="skip" href="#records">
        Skip to records
      </a>
      <header>
        <div className="brand">
          <img src="/mark.png" alt="House of Ichigo" className="logo-mark" />
          <span>
            House of Ichigo<span className="subbrand">OPERATING SYSTEM</span>
          </span>
        </div>
        <div className="session">
          <span className="live-dot" />
          Local workspace<span className="mono">READ ONLY</span>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">KNOWLEDGE / RELATIONSHIPS / EVIDENCE</p>
            <h1>The work, connected.</h1>
            <p className="lede">
              Trace a decision. Follow a project. Return to the source.
            </p>
          </div>
          <button onClick={refresh} disabled={loading}>
            {loading ? "Loading…" : "Refresh records"}
          </button>
        </div>
        <nav aria-label="Knowledge views">
          {[
            ["all", "Overview"],
            ["project", "Projects"],
            ["client", "Clients"],
            ["wiki", "Wiki"],
            ["memory", "Memory"],
            ["temporal", "Timeline"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
              onClick={() => switchView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <section className="workspace">
          <aside className="filters" aria-label="Filter knowledge">
            <p className="eyebrow">YOUR VIEW</p>
            <label>
              Search knowledge
              <input
                type="search"
                placeholder="A person, project, or decision"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {["client", "project"].includes(view) && (
              <label>
                {view === "client" ? "Client" : "Project"}
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                >
                  <option value="">All {view}s</option>
                  {data.nodes
                    .filter((n) => n.type === view)
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Record type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types</option>
                {[...new Set(data.nodes.map((n) => n.type))].sort().map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">All sources</option>
                {data.nodes
                  .filter((n) => n.type === "document")
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Relationship basis
              <select value={basis} onChange={(e) => setBasis(e.target.value)}>
                <option value="">All relationships</option>
                <option value="supported">Source-supported</option>
                <option value="manual">Manually declared</option>
                <option value="inferred">Inferred</option>
              </select>
            </label>
            {view === "temporal" && (
              <>
                <label>
                  Effective on or before
                  <input
                    type="date"
                    value={cutoff}
                    onInput={(e) => setCutoff(e.currentTarget.value)}
                    onChange={(e) => setCutoff(e.target.value)}
                  />
                </label>
                {dates.length > 1 && (
                  <label>
                    Date range
                    <input
                      type="range"
                      aria-label="Temporal date"
                      min="0"
                      max={dates.length - 1}
                      value={Math.max(0, dates.indexOf(cutoff || dates.at(-1)))}
                      onChange={(e) => setCutoff(dates[Number(e.target.value)])}
                    />
                  </label>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={unknown}
                    onChange={(e) => setUnknown(e.target.checked)}
                  />
                  Include unknown dates
                </label>
                <p className="note">
                  Effective dates only. This view does not reconstruct earlier
                  workspace states.
                </p>
              </>
            )}
            {focus && (
              <button onClick={() => setFocus("")}>Clear neighborhood</button>
            )}
            <div className="count">
              <span className="number">
                {String(filtered.nodes.length).padStart(2, "0")}
              </span>
              <span>
                visible records
                <br />
                {filtered.links.length} relationships
              </span>
            </div>
            <p className="note">
              Only permitted records appear. Unknown dates and inferred
              relationships remain labeled.
            </p>
          </aside>
          <div className="canvas-panel" ref={panel}>
            <div className="canvas-toolbar">
              <div role="group" aria-label="Display mode">
                <button
                  className={tab === "map" ? "active" : ""}
                  disabled={graphFailed}
                  onClick={() => {
                    const canvas = document.createElement("canvas");
                    const gl = canvas.getContext("webgl2");
                    if (!gl) {
                      setGraphFailed(true);
                      setTab("list");
                      return;
                    }
                    gl.getExtension("WEBGL_lose_context")?.loseContext();
                    setTab("map");
                  }}
                >
                  3D map
                </button>
                <button
                  className={tab === "list" ? "active" : ""}
                  onClick={() => setTab("list")}
                >
                  Record list
                </button>
              </div>
              {tab === "map" && (
                <div className="graph-controls">
                  <button onClick={() => graphRef.current?.zoomToFit(0, 60)}>
                    Fit view
                  </button>
                  <button onClick={() => setPaused(!paused)}>
                    {paused ? "Resume rendering" : "Pause rendering"}
                  </button>
                </div>
              )}
            </div>
            {graphFailed && (
              <p role="status" className="empty">
                3D rendering is unavailable. Use the record list to inspect
                every source and relationship.
              </p>
            )}
            {loading ? (
              <p className="empty" role="status">
                Loading workspace records…
              </p>
            ) : !filtered.nodes.length ? (
              <div className="empty">
                <h2>
                  {data.nodes.length
                    ? "No matching records."
                    : "Your knowledge starts here."}
                </h2>
                <p>
                  {data.nodes.length
                    ? "Adjust the filters to see more of your workspace."
                    : "Use hoi-ingest in Claude Code or Codex to add your first source."}
                </p>
              </div>
            ) : tab === "map" ? (
              <GraphBoundary
                onFailure={() => {
                  setGraphFailed(true);
                  setTab("list");
                }}
              >
                <Suspense
                  fallback={
                    <p className="empty" role="status">
                      Loading the 3D view…
                    </p>
                  }
                >
                  <ForceGraph
                    ref={graphRef}
                    width={width}
                    height={510}
                    graphData={graphData}
                    backgroundColor="#FFFFFF"
                    nodeLabel={safeLabel}
                    nodeColor={(n) =>
                      n.id === selected?.id
                        ? "#1231D6"
                        : n.type === "wiki"
                          ? n.status === "canonical"
                            ? "#1231D6"
                            : n.status === "reviewed"
                              ? "#0A0E27"
                              : "#5A6478"
                          : n.type === "document"
                            ? "#5A6478"
                            : "#0A0E27"
                    }
                    nodeVal={(n) =>
                      n.type === "client" || n.type === "project"
                        ? 5
                        : n.type === "wiki"
                          ? 4
                          : 2
                    }
                    linkColor={(l) =>
                      l.basis === "inferred"
                        ? "#5A6478"
                        : l.basis === "supported"
                          ? "#1231D6"
                          : "#0A0E27"
                    }
                    linkWidth={(l) => (l.basis === "supported" ? 1.5 : 0.7)}
                    linkDirectionalArrowLength={3}
                    onNodeClick={choose}
                    warmupTicks={paused ? 100 : 0}
                    cooldownTicks={paused ? 0 : 100}
                    onEngineStop={() => {
                      graphRef.current?.zoomToFit(0, 70);
                      if (paused) graphRef.current?.pauseAnimation();
                    }}
                    enableNodeDrag={!paused}
                  />
                </Suspense>
              </GraphBoundary>
            ) : null}
            <div className="legend">
              <span>
                <i className="supported" />
                Source-supported
              </span>
              <span>
                <i />
                Manually declared
              </span>
              <span>
                <i className="inferred" />
                Inferred
              </span>
              <span className="mono">DRAG TO ORBIT · SCROLL TO ZOOM</span>
            </div>
            <section id="records" className="record-list">
              <div className="section-heading">
                <h2>
                  {tab === "map"
                    ? "Accessible record list"
                    : "Workspace records"}
                </h2>
                <span className="mono">{filtered.nodes.length} RECORDS</span>
              </div>
              <ul>
                {filtered.nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      aria-pressed={selected?.id === n.id}
                      onClick={() => choose(n)}
                    >
                      <span>
                        <strong>{n.name}</strong>
                        <small>
                          {n.type} · {n.state ?? n.status ?? "declared"}
                        </small>
                      </span>
                      <time>{n.date ?? "Date unknown"}</time>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
        <section
          className="inspector"
          aria-label="Record inspection"
          aria-live="polite"
        >
          <div>
            <p className="eyebrow">INSPECT THE EVIDENCE</p>
            <h2>{selected?.name ?? "Every connection has a basis."}</h2>
            <p>
              {selected
                ? `${selected.type} · ${selected.date ?? "Effective date unknown"}`
                : "Select a record in the map or list to inspect its relationships and original sources."}
            </p>
          </div>
          {selected && (
            <div className="details">
              <p>
                {selected.content ??
                  `${selected.authority ?? "Manually maintained"} record${selected.stale ? " · evidence needs review" : ""}.`}
              </p>
              <div className="actions">
                <button
                  onClick={() => {
                    setFocus(selected.id);
                    setQuery("");
                    setType("");
                    setScope("");
                    setSource("");
                    setView("all");
                  }}
                >
                  Focus neighborhood
                </button>
                {selected.type === "document" && (
                  <button onClick={() => download(selected)}>
                    Open original source
                  </button>
                )}
              </div>
              {selected.type === "wiki" && wiki && (
                <div className="wiki-page">
                  <p className="mono">
                    {wiki.slug} · {wiki.pageType ?? wiki.type} ·{" "}
                    {wiki.status.toUpperCase()}
                    {wiki.reviewedAt
                      ? ` · reviewed ${wiki.reviewedAt.slice(0, 10)}`
                      : ""}
                    {" · "}
                    {wiki.evidenceCount} source
                    {wiki.evidenceCount === 1 ? "" : "s"}
                    {wiki.evidenceCurrent ? "" : " · evidence needs review"}
                  </p>
                  {wiki.content.split(/\n{2,}/).map((block, i) => (
                    <p key={i}>{block.replace(/^#+\s*/, "")}</p>
                  ))}
                  <h3>Sources</h3>
                  {wiki.evidence.map((e) => (
                    <button
                      key={e.passageId}
                      className="text-button"
                      onClick={() => showPassage(e.passageId)}
                    >
                      {e.relation === "contradicts"
                        ? "Contradicting source: "
                        : "Read evidence: "}
                      {e.quote.slice(0, 80)}
                    </button>
                  ))}
                </div>
              )}
              <h3>Relationships</h3>
              {relations.length ? (
                <ul>
                  {relations.map((l) => {
                    const other = data.nodes.find(
                      (n) =>
                        n.id ===
                        (l.source === selected.id ? l.target : l.source),
                    );
                    return (
                      <li key={l.id}>
                        <button
                          className="text-button"
                          onClick={() => choose(other)}
                        >
                          {l.type.replaceAll("_", " ")} → {other?.name}
                        </button>
                        <small>
                          {l.basis}
                          {!l.date ? " · date unknown" : ""}
                        </small>
                        {l.evidence.map((e) => (
                          <button
                            key={e.passageId}
                            className="text-button"
                            onClick={() => showPassage(e.passageId)}
                          >
                            Read supporting passage
                          </button>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No recorded relationships.</p>
              )}
              {(selected.evidence ?? []).map((e) => (
                <button
                  key={e.passageId}
                  className="text-button"
                  onClick={() => showPassage(e.passageId)}
                >
                  Read evidence: {e.quote.slice(0, 80)}
                </button>
              ))}
              {passage && (
                <blockquote>
                  <p className="mono">
                    {passage.title} · {passage.location}
                  </p>
                  <p>{passage.text}</p>
                  <button
                    onClick={() =>
                      download({
                        id: passage.sourceId,
                        revisionId: passage.revisionId,
                        name: passage.title,
                      })
                    }
                  >
                    Open this source revision
                  </button>
                </blockquote>
              )}
            </div>
          )}
        </section>
      </main>
      <footer>
        <span>House of Ichigo · Equipped to run.</span>
        <span className="mono">LOCAL DATA · EXPLICIT EVIDENCE · ALPHA</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
