import { requested, focusRecord } from "./destination.js";
import Intake from "./intake.jsx";
import React, { useState, useEffect } from "react";
const statuses = [
  "open",
  "in-progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
];
export default function Tasks({
  api,
  graph = { nodes: [] },
  schemaVersion,
  standalone = false,
}) {
  const [projects, setProjects] = useState([]),
    [tasks, setTasks] = useState([]),
    [proposals, setProposals] = useState([]);
  const [project, setProject] = useState(standalone ? "standalone" : ""),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [passage, setPassage] = useState(null);
  async function refresh() {
    const [p, t, r] = await Promise.all([
      api("projects"),
      api("tasks"),
      api("tasks/proposals"),
    ]);
    setProjects(p);
    setTasks(t);
    setProposals(r);
  }
  useEffect(() => {
    if (schemaVersion >= 3) refresh().catch((e) => setError(e.message));
  }, [schemaVersion]);
  useEffect(() => {
    const key = requested("task");
    if (key && tasks.length && !selected) inspect(key);
    if (requested("proposal")) {
      if (proposals.some((p) => p.id === requested("proposal")))
        focusRecord("proposal-" + requested("proposal"));
      else if (proposals.length) setError("Requested proposal is unavailable.");
    }
  }, [tasks.length, proposals.length]);
  async function act(fn) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
      setSelected(null);
      setPassage(null);
      setHistory([]);
      await refresh().catch(() => {
        setTasks([]);
        setProposals([]);
        setProjects([]);
      });
    } finally {
      setBusy(false);
    }
  }
  async function inspect(id) {
    await act(async () => {
      const t = await api(`tasks/${id}`);
      const h = await api(`tasks/${id}/history`);
      setSelected(t);
      focusRecord("selected-task");
      setHistory(h);
      setPassage(null);
    });
  }
  async function showEvidence(e) {
    await act(async () => setPassage(await api(`passage/${e.passageId}`)));
  }
  function refs(items) {
    return (
      <ul>
        {items.map((e, i) => (
          <li key={`${e.passageId}-${i}`}>
            <button disabled={busy} onClick={() => showEvidence(e)}>
              Read evidence {i + 1}
            </button>
            <blockquote>{e.quote}</blockquote>
            <span className="mono">Revision {e.revisionId}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (schemaVersion < 3)
    return (
      <>
        <h1>Projects &amp; Tasks</h1>
        <p>
          Take a verified backup and run the workspace upgrade before using
          tasks. Existing Brain features remain available.
        </p>
      </>
    );
  return (
    <>
      <h1>Projects &amp; Tasks</h1>
      <p className="lede">
        Review proposed work against its sources. Approval creates a local task.
      </p>
      <p className="app-note">
        Task proposals require approval. Intake supports structured assistant
        extraction and reviewable cross-source matching.
      </p>
      {error && (
        <p role="alert" className="app-error">
          {error}
        </p>
      )}
      <p role="status">{busy ? "Saving or loading…" : message}</p>
      <details>
        <summary>Create project from a Brain entity</summary>
        <form
          className="task-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const data = new FormData(f);
            act(async () => {
              await api("projects/create", {
                entityId: data.get("entityId"),
                objective: data.get("objective"),
                owner: data.get("owner") || null,
              });
              f.reset();
              setMessage("Project created.");
            });
          }}
        >
          <label>
            Project entity
            <select name="entityId" required>
              {graph.nodes
                .filter((n) => n.type === "project")
                .map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Objective
            <input name="objective" required maxLength={4000} />
          </label>
          <label>
            Project owner
            <input name="owner" maxLength={4000} />
          </label>
          <button
            disabled={busy || !graph.nodes.some((n) => n.type === "project")}
          >
            Create project
          </button>
          <p>
            Create a project entity with the assistant first if it is not
            listed.
          </p>
        </form>
      </details>
      <div className="task-filters">
        <label>
          Project filter
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All work</option>
            <option value="standalone">Standalone tasks</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status filter
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          onClick={() =>
            act(async () => {
              setSelected(null);
              setPassage(null);
              setMessage("Refreshed.");
            })
          }
        >
          Refresh tasks
        </button>
      </div>
      {project &&
        projects
          .filter((p) => p.id === project)
          .map((p) => (
            <section key={p.id}>
              <h2>{p.name}</h2>
              <p>{p.objective}</p>
              <p>Owner: {p.owner || "Unknown"}</p>
            </section>
          ))}
      {schemaVersion >= 4 && <Intake api={api} onChange={refresh} />}
      <section aria-label="Task review queue">
        <h2>Review queue</h2>
        {proposals
          .filter(
            (p) =>
              p.state === "proposed" &&
              (!project ||
                (project === "standalone"
                  ? !p.task.projectId
                  : p.task.projectId === project)),
          )
          .map((p) => (
            <article
              className="task-proposal"
              key={p.id}
              id={"proposal-" + p.id}
              tabIndex={-1}
            >
              <h3>{p.task.title}</h3>
              <p>{p.task.outcome}</p>
              <p>
                Owner: {p.task.owner || "Unknown"} · Due:{" "}
                {p.task.dueDate || "Unknown"} {p.task.dueTime || ""}{" "}
                {p.task.timezone || ""}
              </p>
              {!p.evidenceCurrent && (
                <p role="note">
                  Evidence has changed. Review the current source before
                  approving a new proposal.
                </p>
              )}
              <details>
                <summary>
                  Inspect {p.evidence.length} evidence references
                </summary>
                {refs(p.evidence)}
              </details>
              <div className="task-filters">
                {["approved", "rejected"].map((decision) => (
                  <button
                    key={decision}
                    disabled={
                      busy || (decision === "approved" && !p.evidenceCurrent)
                    }
                    onClick={() =>
                      act(async () => {
                        await api("tasks/review", {
                          id: p.id,
                          expectedVersion: p.version,
                          decision,
                        });
                        setMessage(
                          decision === "approved"
                            ? "Task approved."
                            : "Proposal rejected.",
                        );
                      })
                    }
                  >
                    {decision === "approved"
                      ? "Approve task"
                      : "Reject proposal"}
                  </button>
                ))}
              </div>
            </article>
          ))}
        {!proposals.some(
          (p) =>
            p.state === "proposed" &&
            (!project ||
              (project === "standalone"
                ? !p.task.projectId
                : p.task.projectId === project)),
        ) && <p>No proposals awaiting review in this project scope.</p>}
      </section>
      <section>
        <h2>Tasks</h2>
        <div className="task-table">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Owner</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks
                .filter(
                  (t) =>
                    (!project ||
                      (project === "standalone"
                        ? !t.projectId
                        : t.projectId === project)) &&
                    (!status || t.status === status),
                )
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button onClick={() => inspect(t.id)} disabled={busy}>
                        {t.title}
                      </button>
                    </td>
                    <td>
                      {projects.find((p) => p.id === t.projectId)?.name ||
                        "Standalone"}
                    </td>
                    <td>{t.owner || "Unknown"}</td>
                    <td className="mono">
                      {t.dueDate || "Unknown"} {t.dueTime || ""}{" "}
                      {t.timezone || ""}
                    </td>
                    <td>{t.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!tasks.length && <p>No approved tasks yet.</p>}
      </section>
      {selected && (
        <section aria-label="Task details" id="selected-task" tabIndex={-1}>
          <h2>{selected.title}</h2>
          <p>{selected.outcome}</p>
          <p className="mono">Version {selected.version}</p>
          {!selected.evidenceCurrent && (
            <p>
              Supporting evidence is no longer current. This task retains its
              history.
            </p>
          )}
          <label>
            Task status
            <select
              aria-label="Task status"
              value={selected.status}
              disabled={busy}
              onChange={(e) => {
                const status = e.target.value;
                act(async () => {
                  const t = await api("tasks/update", {
                    id: selected.id,
                    expectedVersion: selected.version,
                    status,
                  });
                  setSelected(t);
                  setHistory(await api(`tasks/${t.id}/history`));
                  setMessage("Task updated.");
                });
              }}
            >
              {statuses.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {schemaVersion >= 16 && (
            <label>
              Linked project
              <select
                aria-label="Linked project"
                value={selected.projectId || ""}
                disabled={busy}
                onChange={(e) =>
                  act(async () => {
                    const t = await api("tasks/assign", {
                      id: selected.id,
                      expectedVersion: selected.version,
                      projectId: e.target.value || null,
                    });
                    setSelected(t);
                    setHistory(await api(`tasks/${t.id}/history`));
                  })
                }
              >
                <option value="">Standalone task</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <h3>Evidence</h3>
          {refs(selected.evidence)}
          <h3>History</h3>
          <ol>
            {history.map((h) => (
              <li key={h.id}>
                <span className="mono">{h.at}</span> · {h.event.type}:{" "}
                {h.event.to || h.event.status} · {h.host}
              </li>
            ))}
          </ol>
        </section>
      )}
      {passage && (
        <section aria-label="Source passage">
          <h2>{passage.title}</h2>
          <p>{passage.location}</p>
          <blockquote>{passage.text}</blockquote>
          <p className="mono">{passage.revisionId}</p>
        </section>
      )}
      <details>
        <summary>Reviewed proposals</summary>
        <ul>
          {proposals
            .filter(
              (p) =>
                p.state !== "proposed" &&
                (!project ||
                  (project === "standalone"
                    ? !p.task.projectId
                    : p.task.projectId === project)),
            )
            .map((p) => (
              <li key={p.id}>
                {p.task.title} — {p.state}
              </li>
            ))}
        </ul>
      </details>
    </>
  );
}
