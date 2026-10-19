import React, { useEffect, useState } from "react";
import { navigate } from "./destination.js";
import { WikiLinks } from "./wiki-core.jsx";

const readers = {
  project: "records/project",
  client: "records/client",
  training: "records/training",
  task: "tasks",
  proposal: "tasks/proposals",
};
export function RelatedRecord({ api, search }) {
  const q = new URLSearchParams(search),
    kind = Object.keys(readers).find((k) => q.has(k)),
    id = kind && q.get(kind);
  const [record, setRecord] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (id)
      api(readers[kind])
        .then((rows) => {
          if (!active) return;
          const found = rows.find((r) => r.id === id);
          if (!found)
            setError("This record is unavailable or no longer permitted.");
          else setRecord(found);
        })
        .catch(() => {
          if (active)
            setError(
              "This record could not be loaded. Access or evidence may have changed.",
            );
        });
    return () => {
      active = false;
    };
  }, [kind, id]);
  return (
    <section aria-label="Related record">
      <button className="secondary" onClick={() => navigate("knowledge")}>
        Back to Knowledge Hub
      </button>
      <h1>
        {record?.name ||
          record?.title ||
          record?.task?.title ||
          "Related workflow"}
      </h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : id && !record ? (
        <p role="status">Loading record…</p>
      ) : record ? (
        <>
          <p>
            Live engine record · {kind} · Version{" "}
            {record.version ?? "not recorded"}
          </p>
          <dl>
            {Object.entries({
              Status: record.status || record.state,
              Owner: record.owner || record.task?.owner,
              "Due date": record.dueDate || record.task?.dueDate,
              Objective:
                record.objective || record.outcome || record.task?.outcome,
              "Next steps": record.nextSteps,
            }).map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value || "Not recorded"}</dd>
              </React.Fragment>
            ))}
          </dl>
          <WikiLinks api={api} subjectId={id} />
          <p>
            Changes and approvals use the registered engine operations in your
            configured assistant.
          </p>
          <button
            className="secondary"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("hoi:ask-knowledge", { detail: { kind, id } }),
              )
            }
          >
            Ask about this
          </button>
        </>
      ) : (
        <p>
          This workflow belongs to an assistant or a user-built application. The
          Knowledge Hub keeps sources, wikis, memory and reviews. No action has
          been taken.
        </p>
      )}
    </section>
  );
}
