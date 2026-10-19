import React from "react";
export default function Brain({ graph }) {
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
