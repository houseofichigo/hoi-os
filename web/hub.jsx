import RetrievalStatus from "./retrieval-status.jsx";
import { WikiLinks } from "./wiki-core.jsx";
import { requested, focusRecord, useSubview } from "./destination.js";
import { PageHeader, ViewTabs } from "./shell.jsx";
import ProcessingQueue from "./processing.jsx";
import React, { useState, useEffect, lazy, Suspense, useRef } from "react";
const KnowledgeMap = lazy(() => import("./map.jsx"));
const tabs = [
  "Overview",
  "Sources",
  "Ingestion",
  "Wiki",
  "Memory",
  "Map",
  "Reviews",
];
export default function Hub({ api, token, views, composer }) {
  const [tab, setTab] = useSubview(
    "knowledge",
    tabs,
    requested("source") ? "Sources" : "Overview",
  );
  const [sourceQuery, setSourceQuery] = useState(""),
    [sourceState, setSourceState] = useState(""),
    [sourceType, setSourceType] = useState(""),
    [sourceProject, setSourceProject] = useState(""),
    [sourceClient, setSourceClient] = useState(""),
    [sourceExtraction, setSourceExtraction] = useState(""),
    [detail, setDetail] = useState(null);
  const sourceDialog = useRef(null),
    sourceOpener = useRef(null);
  function closeSource() {
    setDetail(null);
    requestAnimationFrame(() => sourceOpener.current?.focus());
  }
  useEffect(() => {
    if (detail && sourceDialog.current && !sourceDialog.current.open)
      sourceDialog.current.showModal();
  }, [detail]);
  const [sourceLayout, setSourceLayout] = useState("list");
  const [sources, setSources] = useState([]),
    [jobs, setJobs] = useState([]),
    [intakeJobs, setIntakeJobs] = useState([]),
    [files, setFiles] = useState([]),
    [manifest, setManifest] = useState(null),
    [impact, setImpact] = useState(null),
    [history, setHistory] = useState([]),
    [historicalPassage, setHistoricalPassage] = useState(null),
    [reviews, setReviews] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [assignment, setAssignment] = useState({ project: null, client: null }),
    [projects, setProjects] = useState([]),
    [clients, setClients] = useState([]);
  async function load() {
    const [src, j, r, p] = await Promise.all([
      api("hub/sources"),
      api("hub/jobs"),
      api("hub/reviews"),
      api("projects"),
    ]);
    try {
      setIntakeJobs(await api("intake/jobs"));
    } catch {}
    setSources(src);
    if (requested("source")) {
      if (!src.some((x) => x.id === requested("source")))
        setError("Requested source is unavailable.");
    }
    setJobs(j);
    setReviews(r);
    setProjects(p);
    setClients(await api("records/client"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const sourceTarget = requested("source");
  useEffect(() => {
    if (tab === "Sources" && sources.some((s) => s.id === sourceTarget))
      focusRecord("source-" + sourceTarget);
  }, [sources, tab, sourceTarget]);
  async function act(fn) {
    setError("");
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function plan() {
    const items = [];
    for (const f of files) {
      if (f.size > 50 * 1024 * 1024) throw Error("File exceeds 50 MB");
      const hash = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
      items.push({
        name: f.name,
        size: f.size,
        checksum: [...new Uint8Array(hash)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      });
    }
    setManifest(await api("hub/plan", { files: items, ...assignment }));
  }
  async function upload() {
    for (let i = 0; i < manifest.length; i++) {
      const r = await fetch("/api/hub/upload/" + manifest[i].id, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/octet-stream",
        },
        body: files[i],
      });
      if (!r.ok) throw Error((await r.json()).error || "Upload failed");
    }
    setManifest(null);
    setFiles([]);
  }
  return (
    <>
      <h1 className="screen-reader-only">Knowledge Hub</h1>
      {composer}
      <ViewTabs
        label="Knowledge Hub views"
        values={tabs}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setImpact(null);
        }}
      />
      {error && <p role="alert">{error}</p>}
      {detail && (
        <dialog
          ref={sourceDialog}
          className="source-reader"
          aria-label="Source preview"
          onCancel={closeSource}
        >
          <button className="secondary" onClick={closeSource}>
            Close source
          </button>
          <h2>{detail.source.title}</h2>
          {detail.source.state === "active" && (
            <button
              className="secondary"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("hoi:ask-knowledge", {
                    detail: {
                      kind: "source",
                      id: detail.source.id,
                      revisionId: detail.source.currentRevision,
                    },
                  }),
                );
                closeSource();
              }}
            >
              Ask about this
            </button>
          )}
          <WikiLinks api={api} subjectId={detail.source.id} />
          <p>
            {detail.source.extractionStatus} ·{" "}
            {detail.source.metadata.authority || "Authority unknown"}
          </p>
          <p>
            {detail.source.state === "archived"
              ? "Archived — restore explicitly before using in active context."
              : "Active source"}
          </p>
          {detail.passages.map((p) => (
            <article key={p.id}>
              <h3>{p.location || "Passage"}</h3>
              <p className="passage-text">{p.text}</p>
            </article>
          ))}
          <h3>Revision history</h3>
          {detail.revisions.map((r) => (
            <p key={r.id}>
              {r.created_at} · {r.status}
            </p>
          ))}
          <h3>Linked records</h3>
          {detail.linked.map((r) => (
            <p key={r.id}>{r.title}</p>
          ))}
          <button
            className="secondary"
            onClick={() =>
              act(async () => {
                const r = await fetch("/api/original/" + detail.source.id, {
                  method: body ? "POST" : "GET",
                  body: body ? JSON.stringify(body) : undefined,
                  headers: {
                    Authorization: "Bearer " + token,
                    ...(body ? { "Content-Type": "application/json" } : {}),
                  },
                });
                if (!r.ok) throw Error("Original unavailable");
                const url = URL.createObjectURL(await r.blob());
                const a = document.createElement("a");
                a.href = url;
                a.download = detail.source.title;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              })
            }
          >
            Open original source
          </button>
        </dialog>
      )}
      {tab === "Overview" && (
        <>
          <RetrievalStatus api={api}/>
          <div className="stat-band">
            <p>
              {sources.filter((s) => s.state === "active").length} active
              sources
            </p>
            <p>
              {
                sources.filter(
                  (s) => s.extractionStatus !== "ready" && s.state === "active",
                ).length
              }{" "}
              extraction gaps
            </p>
            <p>
              {reviews.filter((r) => r.state === "pending").length} source
              reviews
            </p>
          </div>
          {views.overview}
        </>
      )}
      {tab === "Sources" && (
        <>
          <div className="source-toolbar">
            <label>
              Search sources
              <input
                value={sourceQuery}
                onChange={(e) => setSourceQuery(e.target.value)}
              />
            </label>
            <label>
              State
              <select
                value={sourceState}
                onChange={(e) => setSourceState(e.target.value)}
              >
                <option value="">All</option>
                <option>active</option>
                <option>archived</option>
              </select>
            </label>
            <label>
              File type
              <input
                placeholder="pdf, md, docx…"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value.toLowerCase())}
              />
            </label>
            <label>
              Project
              <select
                value={sourceProject}
                onChange={(e) => setSourceProject(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.entity_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client
              <select
                value={sourceClient}
                onChange={(e) => setSourceClient(e.target.value)}
              >
                <option value="">All clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Extraction
              <select
                value={sourceExtraction}
                onChange={(e) => setSourceExtraction(e.target.value)}
              >
                <option value="">All</option>
                {[...new Set(sources.map((s) => s.extractionStatus))]
                  .filter(Boolean)
                  .map((x) => (
                    <option key={x}>{x}</option>
                  ))}
              </select>
            </label>
            <button className="secondary" onClick={() => act(load)}>
              Refresh sources
            </button>
          </div>
          <label>
            Source layout
            <select
              aria-label="Source layout"
              value={sourceLayout}
              onChange={(e) => setSourceLayout(e.target.value)}
            >
              <option value="list">List</option>
              <option value="gallery">Gallery</option>
            </select>
          </label>
          <div className={"table-scroll source-library " + sourceLayout}>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>State</th>
                  <th>Extraction</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .filter(
                    (s) =>
                      (!sourceQuery ||
                        s.title
                          .toLowerCase()
                          .includes(sourceQuery.toLowerCase())) &&
                      (!sourceState || s.state === sourceState) &&
                      (!sourceType ||
                        s.title.toLowerCase().endsWith("." + sourceType)) &&
                      (!sourceProject ||
                        s.metadata.project === sourceProject) &&
                      (!sourceClient || s.metadata.client === sourceClient) &&
                      (!sourceExtraction ||
                        s.extractionStatus === sourceExtraction),
                  )
                  .map((s) => (
                    <tr key={s.id} id={"source-" + s.id} tabIndex={-1}>
                      <td>
                        {sourceLayout === "gallery" && (
                          <span className="source-filetype" aria-hidden="true">
                            {s.title.split(".").pop().slice(0, 8).toUpperCase()}
                          </span>
                        )}
                        <button
                          className="record-link"
                          onClick={(event) => {
                            sourceOpener.current = event.currentTarget;
                            act(async () =>
                              setDetail(await api("hub/source/" + s.id)),
                            );
                          }}
                        >
                          {s.title}
                        </button>
                      </td>
                      <td>{s.state}</td>
                      <td>{s.extractionStatus}</td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(
                              async () => (
                                setHistory([]),
                                setHistoricalPassage(null),
                                setImpact(await api("hub/impact/" + s.id))
                              ),
                            )
                          }
                        >
                          Review{" "}
                          {s.state === "archived" ? "restore" : "archive"}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {impact && (
        <section aria-label="Source impact">
          <h2>{impact.source.title}</h2>
          <button
            onClick={() =>
              act(async () => {
                setHistory(await api("hub/history/" + impact.source.id));
                setHistoricalPassage(null);
              })
            }
          >
            Inspect source history
          </button>
          {history
            .filter((r) => true)
            .map((r) => (
              <details key={r.id}>
                <summary>
                  {r.created_at} · {r.status} · {r.id}
                </summary>
                {r.passages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      act(async () =>
                        setHistoricalPassage(
                          await api("passage/" + p.id + "?history=1"),
                        ),
                      )
                    }
                  >
                    {p.location}
                  </button>
                ))}
              </details>
            ))}
          {historicalPassage && (
            <blockquote>{historicalPassage.text}</blockquote>
          )}
          <button
            onClick={() =>
              act(async () => {
                const r = await fetch(
                  "/api/original/" + impact.source.id + "?history=1",
                  { headers: { Authorization: "Bearer " + token } },
                );
                if (!r.ok) throw Error("Original unavailable");
                const u = URL.createObjectURL(await r.blob());
                const a = document.createElement("a");
                a.href = u;
                a.download = impact.source.title;
                a.click();
                setTimeout(() => URL.revokeObjectURL(u), 1000);
              })
            }
          >
            Download preserved original
          </button>
          <p>
            {impact.wiki.length} wiki pages · {impact.memories.length} memories
            · {impact.tasks.length} visible tasks · {impact.citations} passages
          </p>
          <p>
            Originals and history are preserved. Archiving excludes this source
            and its derived evidence from active views.
          </p>
          {[...impact.wiki, ...impact.tasks, ...impact.memories].map((r) => (
            <p key={r.id}>{r.title || r.content}</p>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("hub/source", {
                  id: impact.source.id,
                  expectedVersion: impact.source.version,
                  digest: impact.digest,
                  state:
                    impact.source.state === "archived" ? "active" : "archived",
                });
                setImpact(null);
              })
            }
          >
            Confirm {impact.source.state === "archived" ? "restore" : "archive"}
          </button>
          <button onClick={() => setImpact(null)}>Cancel</button>
        </section>
      )}
      {tab === "Ingestion" && (
        <section
          aria-label="Manual intake"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFiles([...e.dataTransfer.files]);
            setManifest(null);
          }}
        >
          <h2>Add documents</h2>
          <p>
            Select files or a folder, or drop files here. 50 MB per file, 150
            files and 1 GB per import. Unsupported formats are preserved with
            extraction gaps.
          </p>
          <label>
            Choose documents
            <input
              type="file"
              multiple
              onChange={(e) => {
                setFiles([...e.target.files]);
                setManifest(null);
              }}
            />
          </label>
          <label>
            Choose folder
            <input
              type="file"
              multiple
              webkitdirectory=""
              onChange={(e) => {
                setFiles([...e.target.files]);
                setManifest(null);
              }}
            />
          </label>
          <label>
            Project assignment
            <select
              value={assignment.project || ""}
              onChange={(e) =>
                setAssignment({
                  ...assignment,
                  project: e.target.value || null,
                })
              }
            >
              <option value="">Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.entity_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Client assignment
            <select
              value={assignment.client || ""}
              onChange={(e) =>
                setAssignment({ ...assignment, client: e.target.value || null })
              }
            >
              <option value="">Unassigned</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <p>{files.length} selected files</p>
          <button disabled={busy || !files.length} onClick={() => act(plan)}>
            Review import manifest
          </button>
          {manifest && (
            <>
              <ul>
                {manifest.map((j) => (
                  <li key={j.id}>
                    {j.name} · {j.size} bytes ·{" "}
                    {j.duplicate ? "Existing content" : "New content"}
                  </li>
                ))}
              </ul>
              <button disabled={busy} onClick={() => act(upload)}>
                Import reviewed files
              </button>
            </>
          )}
          <ProcessingQueue api={api} />
          <h3>Durable intake jobs</h3>
          <button
            onClick={() =>
              api("intake/jobs")
                .then(setIntakeJobs)
                .catch((e) => setError(e.message))
            }
          >
            Refresh job status
          </button>
          {intakeJobs.map((j) => (
            <article key={j.id}>
              <p>
                {j.name || "Intake item"} · {j.state} ·{" "}
                {j.reason || "No reported gap"} · {j.attempts} attempts
              </p>
              <details>
                <summary>Technical details</summary>
                <p className="mono">{j.id}</p>
              </details>
              {["failed", "interrupted", "extraction-gap", "queued"].includes(
                j.state,
              ) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api("intake/jobs/control", {
                        id: j.id,
                        action: "resume",
                      }),
                    )
                  }
                >
                  Retry preserved intake
                </button>
              )}
              {!["completed", "cancelled"].includes(j.state) && (
                <button
                  onClick={() =>
                    api("intake/jobs/control", { id: j.id, action: "cancel" })
                      .then(() => api("intake/jobs"))
                      .then(setIntakeJobs)
                      .catch((e) => setError(e.message))
                  }
                >
                  Cancel intake
                </button>
              )}
            </article>
          ))}
          <h3>Upload jobs</h3>
          {jobs.map((j) => (
            <p key={j.id}>
              {j.name} · {j.state}
            </p>
          ))}
        </section>
      )}
      {tab === "Wiki" && views.wiki}
      {tab === "Memory" && views.memory}
      {tab === "Map" && (
        <div className="integrated-map">
          <Suspense fallback={<p>Loading map controls…</p>}>
            <KnowledgeMap
              embedded
              api={async (path, body) => {
                const r = await fetch("/api/" + path, {
                  method: body ? "POST" : "GET",
                  body: body ? JSON.stringify(body) : undefined,
                  headers: {
                    Authorization: "Bearer " + token,
                    ...(body ? { "Content-Type": "application/json" } : {}),
                  },
                });
                if (!r.ok)
                  throw Error(
                    "Map record unavailable. Reopen the authenticated app if your session expired.",
                  );
                return r;
              }}
            />
          </Suspense>
        </div>
      )}
      {tab === "Reviews" && (
        <>
          <h2>Source reviews</h2>
          <button
            disabled={busy}
            onClick={() => act(() => api("hub/scan", {}))}
          >
            Audit sources
          </button>
          {reviews.map((r) => (
            <article key={r.id}>
              <h3>{r.payload.title}</h3>
              <p>
                {r.payload.problems.join(" · ")} · {r.state}
              </p>
              {r.state === "pending" &&
                ["keep", "verify", "update", "archive"].map((decision) => (
                  <button
                    key={decision}
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const result = await api("hub/review", {
                          id: r.id,
                          decision,
                        });
                        if (decision === "archive") setImpact(result);
                      })
                    }
                  >
                    {decision}
                  </button>
                ))}
            </article>
          ))}
          {views.reviews}
        </>
      )}
    </>
  );
}
