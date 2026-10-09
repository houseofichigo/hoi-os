import React from "react";
const states = [
  ["planned", "Planned", "cobalt"],
  ["in-progress", "In progress", "learn"],
  ["waiting", "Waiting", "warn"],
  ["blocked", "Blocked", "danger"],
  ["completed", "Completed", "build"],
  ["cancelled", "Cancelled", "slate"],
];
function Bars({ title, rows, caption }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="work-chart" aria-label={title}>
      <figcaption>
        <h3>{title}</h3>
        <p>{caption}</p>
      </figcaption>
      <div className="chart-bars">
        {rows.map((r) => (
          <div className="chart-row" key={r.label}>
            <a href={r.href}>{r.label}</a>
            <span className="chart-track" aria-hidden="true">
              <i
                className={"chart-fill chart-" + r.color}
                style={{ width: (100 * r.value) / max + "%" }}
              />
            </span>
            <strong className="mono">{r.value}</strong>
          </div>
        ))}
      </div>
    </figure>
  );
}
export function ProjectProgress({ progress }) {
  const total = progress?.total ?? 0,
    done = progress?.done ?? 0,
    pct = total ? Math.round((done / total) * 100) : null;
  return (
    <figure className="completion-chart" aria-label="Accepted task completion">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="48" className="completion-track" />
        <circle
          cx="60"
          cy="60"
          r="48"
          className="completion-fill"
          pathLength="100"
          strokeDasharray={`${pct ?? 0} 100`}
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="64" textAnchor="middle">
          {pct == null ? "—" : pct + "%"}
        </text>
      </svg>
      <figcaption>
        <h3>Accepted task completion</h3>
        <p>
          {total
            ? `${done} of ${total} accepted tasks complete`
            : "Not measured — no accepted tasks"}
        </p>
        <small>
          Cancelled tasks excluded. This is task completion, not a measure of
          project scope or effort.
        </small>
      </figcaption>
    </figure>
  );
}
export default function WorkCharts({
  projects,
  metrics,
  scope = "Visible workspace projects",
  onOpen,
}) {
  const rows = projects.map((p) => ({
    ...p,
    progress: metrics?.[p.id] ?? p.progress,
  }));
  const delivery = [
    [
      "Training only",
      "learn",
      (p) =>
        p.deliveryTypes?.includes("training") &&
        !p.deliveryTypes?.includes("consulting"),
    ],
    [
      "Consulting only",
      "lead",
      (p) =>
        p.deliveryTypes?.includes("consulting") &&
        !p.deliveryTypes?.includes("training"),
    ],
    [
      "Mixed delivery",
      "cobalt",
      (p) =>
        p.deliveryTypes?.includes("training") &&
        p.deliveryTypes?.includes("consulting"),
    ],
    ["Unclassified", "slate", (p) => !p.deliveryTypes?.length],
  ];
  return (
    <section
      className="portfolio-visuals"
      aria-label="Project portfolio charts"
    >
      <div className="chart-heading">
        <h2>Portfolio at a glance</h2>
        <span>
          {scope} · <b className="mono">{rows.length}</b> recorded projects
        </span>
      </div>
      {!rows.length ? (
        <p>
          No projects in this view. Charts appear when records are available.
        </p>
      ) : (
        <>
          <div className="chart-pair">
            <Bars
              title="Project status"
              caption="Current record status · projects, not tasks"
              rows={states.map(([status, label, color]) => ({
                label,
                color,
                href: `/app?view=projects&status=${encodeURIComponent(status)}`,
                value: rows.filter((p) => p.status === status).length,
              }))}
            />
            <Bars
              title="Delivery mix"
              caption="Each project counted once; mixed delivery has its own group"
              rows={delivery.map(([label, color, match]) => ({
                label,
                color,
                href: `/app?view=projects&delivery=${encodeURIComponent(label)}`,
                value: rows.filter(match).length,
              }))}
            />
          </div>
          <details className="chart-progress-list">
            <summary>Project completion · accepted tasks</summary>
            {rows.map((p) => (
              <div className="project-chart-row" key={p.id}>
                {onOpen ? (
                  <button className="text-link" onClick={() => onOpen(p)}>
                    {p.name}
                  </button>
                ) : (
                  <a href={"/app?project=" + p.id}>{p.name}</a>
                )}
                <span className="chart-track" aria-hidden="true">
                  <i
                    className="chart-fill chart-build"
                    style={{ width: (p.progress?.percent ?? 0) + "%" }}
                  />
                </span>
                <span className="mono">
                  {p.progress?.percent == null
                    ? "Not measured"
                    : p.progress.percent + "%"}
                </span>
              </div>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
