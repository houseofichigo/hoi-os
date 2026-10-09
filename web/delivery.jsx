import React, { useState, useEffect } from "react";
import Records from "./records.jsx";
import { EmptyState } from "./shell.jsx";
export default function Delivery({ api, type }) {
  const [data, setData] = useState(null),
    [status, setStatus] = useState("active"),
    [create, setCreate] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("dashboard", {}), api("records/training")])
      .then(([d, sessions]) => setData({ ...d, trainings: sessions }))
      .catch((e) => setError(e.message));
  }, [type, create]);
  if (create)
    return (
      <>
        <button className="secondary" onClick={() => setCreate(false)}>
          Back to delivery view
        </button>
        <Records api={api} kind="project" initialDeliveryType={type} />
      </>
    );
  if (!data)
    return (
      <p role={error ? "alert" : "status"}>
        {error || "Loading delivery projects…"}
      </p>
    );
  const sessions = data.trainings ?? [],
    projects = data.projects
      .filter(
        (p) =>
          (p.deliveryTypes ?? []).includes(type) ||
          (type === "training" && sessions.some((t) => t.projectId === p.id)),
      )
      .filter((p) =>
        status === "active"
          ? !["completed", "cancelled"].includes(p.status)
          : p.status === status,
      );
  return (
    <section
      aria-label={
        type === "training" ? "Training projects" : "Consulting projects"
      }
    >
      <div className="record-toolbar">
        <h2>
          {type === "training" ? "Training delivery" : "Consulting delivery"}
        </h2>
        <button onClick={() => setCreate(true)}>New {type} project</button>
        <label>
          Delivery status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active work</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      {!projects.length && (
        <EmptyState title="No matching delivery projects">
          Classify projects in their Overview drawer. A project may include both
          training and consulting.
        </EmptyState>
      )}
      {projects.map((p) => (
        <article className="delivery-project" key={p.id}>
          <h3>
            <a href={"/app?project=" + p.id}>{p.name}</a>
          </h3>
          <p>
            {p.clientIds
              .map((id) => data.clients.find((c) => c.id === id)?.name)
              .filter(Boolean)
              .join(", ") || "No linked client"}{" "}
            · {p.owner || "Owner unknown"} · {p.status}
          </p>
          <p>
            Project deadline: {p.dueDate || "Not set"} ·{" "}
            {p.progress?.percent == null
              ? "Progress not measured"
              : `${p.progress.done} / ${p.progress.total} accepted tasks complete (${p.progress.percent}%)`}
          </p>
          <p>Next milestone: {p.milestones || "Not recorded"}</p>
          <p>Next step: {p.nextSteps || "Not recorded"}</p>
          {type === "training" &&
            (sessions.some((t) => t.projectId === p.id) ? (
              sessions
                .filter((t) => t.projectId === p.id)
                .map((t) => (
                  <p key={t.id}>
                    <a href={"/app?training=" + t.id}>{t.name}</a> · {t.start} ·{" "}
                    {t.timezone} · {t.status}
                  </p>
                ))
            ) : (
              <p>No session scheduled.</p>
            ))}
        </article>
      ))}
      {type === "training" && (
        <details open={new URLSearchParams(location.search).has("training")}>
          <summary>Manage training sessions</summary>
          <Records api={api} kind="training" />
        </details>
      )}
    </section>
  );
}
