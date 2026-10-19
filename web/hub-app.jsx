import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, token } from "./api-client.js";
import { ActivityButton } from "./activity.jsx";
import { Drawer } from "./product-ui.jsx";
import { RecoveryState, StatusLabel, ViewErrorBoundary } from "./shell.jsx";
import { navigate, routeView, useLocationSearch } from "./destination.js";
import Hub from "./hub.jsx";
import Brain from "./knowledge-overview.jsx";
import { RelatedRecord } from "./hub-record.jsx";
import Wiki from "./wiki-core.jsx";
import "./tokens.css";
import "./style.css";
import "./workspace.css";
import "./product.css";

const Memory = lazy(() => import("./memory.jsx"));
const Maintenance = lazy(() => import("./maintenance.jsx"));
const Skills = lazy(() => import("./skills.jsx"));
const Configuration = lazy(() => import("./configuration.jsx"));
const views = [
  ["knowledge", "Knowledge Hub"],
  ["skills", "Skills"],
  ["configuration", "Configuration"],
];

function KnowledgeHubApp() {
  const search = useLocationSearch(),
    view = routeView(search);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [workspace, setWorkspace] = useState(null),
    [graph, setGraph] = useState({ nodes: [], links: [] });
  const [memories, setMemories] = useState([]),
    [loading, setLoading] = useState(true);
  const [connectionCode, setConnectionCode] = useState(null),
    [error, setError] = useState("");
  const [handoff, setHandoff] = useState(null),
    [skillBusy, setSkillBusy] = useState(false);
  async function refresh() {
    setConnectionCode(null);
    setError("");
    try {
      const w = await api("workspace");
      if (!w || !Number.isInteger(w.schemaVersion))
        throw Error("Invalid workspace response");
      setWorkspace(w);
      const result = await Promise.allSettled([api("graph"), api("memory")]);
      setGraph(
        result[0].status === "fulfilled"
          ? result[0].value
          : { nodes: [], links: [] },
      );
      setMemories(result[1].status === "fulfilled" ? result[1].value : []);
      if (result.some((r) => r.status === "rejected"))
        setError(
          "Some supporting records could not load. Retry before relying on empty lists.",
        );
    } catch (e) {
      setWorkspace(null);
      setConnectionCode(e.code || "REQUEST_FAILED");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const failed = (e) => {
      setConnectionCode(e.detail);
      setHandoff(null);
    };
    const ask = (e) => {
      const ref = e.detail;
      if (ref && typeof ref.kind === "string" && typeof ref.id === "string")
        setHandoff({
          text: `Resolve ${ref.kind}: ${ref.id} through HOI using your own assistant identity. Cite the currently permitted evidence. Do not approve or execute changes automatically.`,
        });
    };
    window.addEventListener("hoi:connection-error", failed);
    window.addEventListener("hoi:authenticated", refresh);
    window.addEventListener("hoi:ask-knowledge", ask);
    refresh();
    return () => {
      window.removeEventListener("hoi:connection-error", failed);
      window.removeEventListener("hoi:authenticated", refresh);
      window.removeEventListener("hoi:ask-knowledge", ask);
    };
  }, []);
  useEffect(() => {
    setNavigationOpen(false);
  }, [search]);
  async function useSkill(id, starter) {
    setSkillBusy(true);
    setError("");
    try {
      const d = await api("skills/" + encodeURIComponent(id)),
        active = d.active;
      if (!d.enabled || !active?.compatible)
        throw Error(
          "This skill is unavailable. Review its active revision and compatibility first.",
        );
      const example =
        starter === undefined
          ? ""
          : (active.presentation || d.bundled?.presentation)?.examples?.[
              starter
            ];
      if (starter !== undefined && typeof example !== "string")
        throw Error(
          "This example has changed. Reopen the skill to choose a current request.",
        );
      setHandoff({
        text: `Use HOI skill ${d.id}. Resolve and verify revision ${active.revisionId}, checksum ${active.checksum}, through the engine using your own assistant identity. Stop if the revision is no longer active or permitted.\n${example || "Ask me for the intended outcome before proceeding."}\nKeep all source permissions and review boundaries.`,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setSkillBusy(false);
    }
  }
  const loadingView = <p role="status">Loading your workspace…</p>;
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
          <img src="/mark.png" alt="HOI OS" className="logo-mark" />
          <span>
            HOI OS<span className="subbrand">KNOWLEDGE HUB</span>
          </span>
        </div>
        <div
          id="workspace-navigation"
          className={`workspace-navigation ${navigationOpen ? "is-open" : ""}`}
        >
          <span className="nav-group">Knowledge</span>
          {views.map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => {
                navigate(id);
                requestAnimationFrame(() =>
                  document.getElementById("workspace-main")?.focus(),
                );
              }}
            >
              {label}
            </button>
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
              {views.find(([id]) => id === view)?.[1] || "Related record"}
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
          {error && !connectionCode && (
            <div role="alert" className="app-error">
              {error}{" "}
              <button className="secondary" onClick={refresh}>
                Retry workspace data
              </button>
            </div>
          )}
          {skillBusy && <p role="status">Checking active skill…</p>}
          <ViewErrorBoundary key={view}>
            {loading ? (
              loadingView
            ) : connectionCode || !workspace ? (
              <RecoveryState
                code={connectionCode || "REQUEST_FAILED"}
                onRetry={refresh}
              />
            ) : workspace.schemaVersion < 15 ? (
              <p>
                Back up and upgrade a separate workspace copy before using the
                Knowledge Hub editor.
              </p>
            ) : (
              <Suspense fallback={loadingView}>
                {view === "knowledge" ? (
                  <Hub
                    api={api}
                    token={token}
                    views={{
                      overview: <Brain graph={graph} />,
                      wiki: <Wiki api={api} />,
                      memory: (
                        <Memory
                          api={api}
                          memories={memories}
                          refresh={refresh}
                          setError={setError}
                        />
                      ),
                      reviews: <Maintenance api={api} refresh={refresh} />,
                    }}
                  />
                ) : view === "skills" ? (
                  <Skills
                    api={api}
                    schemaVersion={workspace.schemaVersion}
                    onLaunch={useSkill}
                  />
                ) : view === "configuration" ? (
                  <Configuration api={api} />
                ) : (
                  <RelatedRecord key={search} api={api} search={search} />
                )}
              </Suspense>
            )}
          </ViewErrorBoundary>
          {handoff && !connectionCode && (
            <Drawer title="Ask your assistant" onClose={() => setHandoff(null)}>
              <button className="secondary" onClick={() => setHandoff(null)}>
                Close handoff
              </button>
              <h2>Ask your assistant</h2>
              <p>
                Open this private workspace in your configured assistant. No
                request has been sent. Assistant access and disclosure
                permissions still apply.
              </p>
              <label>
                Record reference
                <textarea readOnly value={handoff.text} />
              </label>
            </Drawer>
          )}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(
  <ViewErrorBoundary>
    <KnowledgeHubApp />
  </ViewErrorBoundary>,
);
