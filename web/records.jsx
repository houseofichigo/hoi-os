import { WikiLinks } from "./wiki-core.jsx";
import WorkCharts, { ProjectProgress } from "./work-charts.jsx";
import { requested, recordRoute, useLocationSearch } from "./destination.js";
import { EmptyState } from "./shell.jsx";
import React, { useState, useEffect, useRef } from "react";
const labelFor = (field) =>
  ({
    dueDate: "Due date",
    startDate: "Start date",
    nextSteps: "Next steps",
    name: "Name",
    owner: "Owner",
    status: "Status",
    priority: "Priority",
    objective: "Objective",
    scope: "Scope",
    deliverables: "Deliverables",
    milestones: "Milestones",
    risks: "Risks",
    notes: "Notes",
    start: "Delivery start",
    end: "Delivery end",
    timezone: "Timezone",
  })[field] || field;
const defaults = {
  client: { name: "", owner: null, notes: "", status: "active", contacts: [] },
  project: {
    name: "",
    owner: null,
    notes: "",
    deliveryTypes: [],
    clientIds: [],
    status: "planned",
    priority: "normal",
    objective: "",
    scope: "",
    deliverables: "",
    startDate: null,
    dueDate: null,
    milestones: "",
    risks: "",
    nextSteps: "",
    knowledgeIds: [],
  },
  training: {
    name: "",
    owner: null,
    notes: "",
    projectId: "",
    clientIds: [],
    start: "",
    end: "",
    timezone: "Europe/Paris",
    eventId: null,
    taskIds: [],
    status: "planned",
  },
};
export default function Records({ api, kind, children, initialDeliveryType }) {
  const routeSearch = useLocationSearch();
  const [rows, setRows] = useState([]),
    [clients, setClients] = useState([]),
    [projects, setProjects] = useState([]),
    [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState(kind === "client" ? "gallery" : "table"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(requested("status") || ""),
    [sort, setSort] = useState("name"),
    [columns, setColumns] = useState(["status", "owner", "dueDate"]),
    [saved, setSaved] = useState([]),
    [viewVersion, setViewVersion] = useState(0);
  const editor = useRef(null),
    opener = useRef(null),
    baseline = useRef(null);
  const [detailTab, setDetailTab] = useState("Overview");
  const [metrics, setMetrics] = useState({}),
    [sources, setSources] = useState([]),
    [tasks, setTasks] = useState([]),
    [events, setEvents] = useState([]);
  useEffect(() => {
    if (selected && editor.current && !editor.current.open)
      editor.current.showModal();
  }, [selected]);
  async function load() {
    const [r, c, p] = await Promise.all([
      api("records/" + kind),
      api("records/client"),
      api("records/project"),
    ]);
    const views = await api("views/" + kind);
    setSaved(views.views);
    setViewVersion(views.version);
    setRows(r);
    setClients(c);
    setProjects(p);
    const d = await api("dashboard", {});
    setMetrics(
      Object.fromEntries(
        [...d.projects, ...d.clients].map((r) => [r.id, r.progress]),
      ),
    );
    setSources(await api("hub/sources"));
    setTasks(await api("tasks"));
    setEvents(await api("intake"));
    if (!selected && requested(kind)) {
      const row = r.find((x) => x.id === requested(kind));
      if (row) setSelected(row);
      else setError("Requested record is unavailable.");
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [kind]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const visible = rows
    .filter(
      (r) =>
        (!filter || r.status === filter) &&
        (!requested("delivery") ||
          {
            "Training only":
              r.deliveryTypes?.includes("training") &&
              !r.deliveryTypes?.includes("consulting"),
            "Consulting only":
              r.deliveryTypes?.includes("consulting") &&
              !r.deliveryTypes?.includes("training"),
            "Mixed delivery":
              r.deliveryTypes?.includes("training") &&
              r.deliveryTypes?.includes("consulting"),
            Unclassified: !r.deliveryTypes?.length,
          }[requested("delivery")]) &&
        r.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => String(a[sort] || "").localeCompare(String(b[sort] || "")));
  const title =
    kind === "client"
      ? "Clients"
      : kind === "project"
        ? "Projects"
        : "Trainings";
  function edit(r) {
    baseline.current = JSON.stringify(r);
    opener.current = document.activeElement;
    setDetailTab("Overview");
    if (r.id) recordRoute(kind, r.id);
    setSelected(r);
    setHistory([]);
  }
  function closeEditor(event, force = false) {
    event?.preventDefault?.();
    if (
      !force &&
      baseline.current &&
      JSON.stringify(selected) !== baseline.current &&
      !window.confirm("Discard unsaved record changes?")
    )
      return;
    setSelected(null);
    requestAnimationFrame(() => opener.current?.focus());
    if (requested(kind)) recordRoute(kind, null);
  }
  useEffect(() => {
    const id = requested(kind);
    if (!id) {
      if (selected?.id) setSelected(null);
      return;
    }
    const record = rows.find((r) => r.id === id);
    if (record) {
      baseline.current = JSON.stringify(record);
      setSelected(record);
      setHistory([]);
    }
  }, [routeSearch]);
  async function save() {
    const { id, version, ...record } = selected;
    await api("records/save", {
      kind,
      ...(id ? { id } : {}),
      expectedVersion: version || 0,
      record,
    });
    closeEditor(null, true);
  }
  const statuses =
    kind === "client"
      ? ["active", "past"]
      : kind === "training"
        ? ["planned", "confirmed", "completed", "cancelled"]
        : [
            "planned",
            "in-progress",
            "waiting",
            "blocked",
            "completed",
            "cancelled",
          ];
  const item = (r) => (
    <button className="record-link" onClick={() => edit(r)}>
      {r.name}
    </button>
  );
  return (
    <section aria-label={title}>
      <h1>{title}</h1>
      {requested("delivery") && (
        <p>
          Delivery: {requested("delivery")}{" "}
          <button
            className="text-link"
            onClick={() => recordRoute("delivery", null)}
          >
            Clear delivery filter
          </button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {kind === "project" && (
        <details className="project-insights">
          <summary>Insights</summary>
          <WorkCharts
            projects={visible}
            metrics={metrics}
            scope="Current project filters"
            onOpen={edit}
          />
        </details>
      )}
      <div className="record-toolbar">
        <button
          onClick={() =>
            edit({
              ...defaults[kind],
              ...(kind === "project" && initialDeliveryType
                ? { deliveryTypes: [initialDeliveryType] }
                : {}),
            })
          }
        >
          New {kind}
        </button>
        <label>
          Search {title}
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          View
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option>table</option>
            <option>gallery</option>
            {kind === "project" && <option>board</option>}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Name</option>
            <option value="dueDate">Due date</option>
            <option value="status">Status</option>
          </select>
        </label>
        <details>
          <summary>Columns</summary>
          {[
            "status",
            "owner",
            "priority",
            "startDate",
            "dueDate",
            "objective",
          ].map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={columns.includes(c)}
                onChange={() =>
                  setColumns(
                    columns.includes(c)
                      ? columns.filter((x) => x !== c)
                      : [...columns, c],
                  )
                }
              />
              {labelFor(c)}
            </label>
          ))}
        </details>
        <button
          disabled={busy}
          onClick={() =>
            act(async () => {
              const result = await api("views/save", {
                kind,
                expectedVersion: viewVersion,
                views: [
                  ...saved,
                  {
                    name: "View " + (saved.length + 1),
                    query,
                    filter,
                    sort,
                    columns,
                    view,
                  },
                ],
              });
              setSaved(result.views);
              setViewVersion(result.version);
            })
          }
        >
          Save view
        </button>
        {saved.map((s) => (
          <button
            key={s.name}
            onClick={() => {
              setQuery(s.query);
              setFilter(s.filter);
              setSort(s.sort);
              setColumns(s.columns);
              setView(s.view);
            }}
          >
            {s.name}
          </button>
        ))}
      </div>
      {view === "table" ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                {columns.map((c) => (
                  <th key={c}>{labelFor(c)}</th>
                ))}
                <th>Linked projects / clients</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>{item(r)}</td>
                  {columns.map((c) => (
                    <td key={c}>{r[c] || "Unknown"}</td>
                  ))}
                  <td>
                    {kind === "client"
                      ? projects
                          .filter((p) => p.clientIds.includes(r.id))
                          .map((p) => (
                            <a key={p.id} href={"/app?project=" + p.id}>
                              {p.name}{" "}
                            </a>
                          ))
                      : (r.clientIds || [])
                          .map((id) => clients.find((c) => c.id === id)?.name)
                          .filter(Boolean)
                          .join(", ")}
                  </td>
                  <td>
                    {metrics[r.id]?.percent == null
                      ? "Not measured"
                      : metrics[r.id].percent + "%"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "board" ? (
        <div className="record-gallery">
          {statuses.map((status) => (
            <section key={status}>
              <h2>{status}</h2>
              {visible
                .filter((r) => r.status === status)
                .map((r) => (
                  <p key={r.id}>{item(r)}</p>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="record-gallery">
          {visible.map((r) => (
            <article key={r.id}>
              <h2>{item(r)}</h2>
              <p>
                {r.status} · {r.owner || "Owner unknown"}
              </p>
              <p>{r.notes}</p>
              <p>
                {metrics[r.id]?.percent == null
                  ? "Progress not measured"
                  : metrics[r.id].percent +
                    "% — " +
                    metrics[r.id].done +
                    " / " +
                    metrics[r.id].total +
                    " visible accepted tasks complete"}
              </p>
              {kind === "client" &&
                projects
                  .filter((p) => p.clientIds.includes(r.id))
                  .map((p) => (
                    <p key={p.id}>
                      <a href={"/app?project=" + p.id}>{p.name}</a>
                    </p>
                  ))}
            </article>
          ))}
        </div>
      )}
      {!visible.length && (
        <EmptyState
          title={
            rows.length
              ? "No matching records"
              : `No ${title.toLowerCase()} yet`
          }
        >
          {rows.length
            ? "Change the search or status filter to see your records."
            : `Create a ${kind} to start organizing your work.`}
        </EmptyState>
      )}
      {selected && (
        <dialog
          ref={editor}
          className="record-editor"
          aria-label={"Edit " + kind}
          onCancel={closeEditor}
        >
          <h2>
            {selected.id ? "Edit" : "Create"} {kind}
          </h2>
          <button className="secondary" onClick={closeEditor}>
            Close editor
          </button>
          <nav className="view-tabs" aria-label="Record details">
            {["Overview", "Tasks", "Knowledge", "History"].map((t) => (
              <button
                key={t}
                aria-pressed={detailTab === t}
                onClick={() => {
                  setDetailTab(t);
                  if (t === "History" && selected.id)
                    act(async () =>
                      setHistory(await api("records/history/" + selected.id)),
                    );
                }}
              >
                {t}
              </button>
            ))}
          </nav>
          {error && <p role="alert">{error}</p>}
          {detailTab === "Tasks" && (
            <section>
              <h3>Linked tasks</h3>
              {tasks
                .filter((t) =>
                  kind === "project"
                    ? t.projectId === selected.id
                    : kind === "training"
                      ? (selected.taskIds ?? []).includes(t.id)
                      : projects
                          .filter((p) => p.clientIds.includes(selected.id))
                          .some((p) => p.id === t.projectId),
                )
                .map((t) => (
                  <p key={t.id}>
                    <a href={"/app?task=" + t.id}>{t.title}</a> · {t.status}
                  </p>
                ))}
            </section>
          )}
          {detailTab === "Knowledge" && (
            <section>
              <h3>Linked knowledge</h3>
              <WikiLinks api={api} subjectId={selected.id} />
              {sources
                .filter((s) => (selected.knowledgeIds ?? []).includes(s.id))
                .map((s) => (
                  <p key={s.id}>
                    <a href={"/app?source=" + s.id}>{s.title}</a>
                  </p>
                ))}
              {!selected.knowledgeIds?.length && (
                <p>No explicitly linked sources.</p>
              )}
            </section>
          )}
          <div hidden={detailTab !== "Overview"}>
            {kind === "project" && selected.id && (
              <ProjectProgress progress={metrics[selected.id]} />
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(save);
              }}
            >
              {Object.entries(defaults[kind]).map(([field, def]) =>
                field === "deliveryTypes" ? (
                  <fieldset key={field}>
                    <legend>Delivery types</legend>
                    {["training", "consulting"].map((type) => (
                      <label key={type}>
                        <input
                          type="checkbox"
                          checked={(selected.deliveryTypes ?? []).includes(
                            type,
                          )}
                          onChange={() =>
                            setSelected({
                              ...selected,
                              deliveryTypes: (
                                selected.deliveryTypes ?? []
                              ).includes(type)
                                ? selected.deliveryTypes.filter(
                                    (x) => x !== type,
                                  )
                                : [...(selected.deliveryTypes ?? []), type],
                            })
                          }
                        />
                        {type === "training" ? "Training" : "Consulting"}
                      </label>
                    ))}
                  </fieldset>
                ) : field === "clientIds" ? (
                  <fieldset key={field}>
                    <legend>Linked clients</legend>
                    {clients.map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          checked={(selected.clientIds || []).includes(c.id)}
                          onChange={() =>
                            setSelected({
                              ...selected,
                              clientIds: selected.clientIds.includes(c.id)
                                ? selected.clientIds.filter((x) => x !== c.id)
                                : [...selected.clientIds, c.id],
                            })
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </fieldset>
                ) : field === "projectId" ? (
                  <label key={field}>
                    Project
                    <select
                      required
                      value={selected.projectId}
                      onChange={(e) =>
                        setSelected({ ...selected, projectId: e.target.value })
                      }
                    >
                      <option value="">Choose project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : field === "status" ? (
                  <label key={field}>
                    Status
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        setSelected({ ...selected, status: e.target.value })
                      }
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                ) : field === "contacts" ? (
                  <fieldset key={field}>
                    <legend>Contacts</legend>
                    {(selected.contacts || []).map((contact, i) => (
                      <div key={i}>
                        <label>
                          Contact name
                          <input
                            value={contact.name}
                            onChange={(e) =>
                              setSelected({
                                ...selected,
                                contacts: selected.contacts.map((x, j) =>
                                  i === j ? { ...x, name: e.target.value } : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          Contact email
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) =>
                              setSelected({
                                ...selected,
                                contacts: selected.contacts.map((x, j) =>
                                  i === j ? { ...x, email: e.target.value } : x,
                                ),
                              })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSelected({
                              ...selected,
                              contacts: selected.contacts.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                        >
                          Remove contact
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          ...selected,
                          contacts: [
                            ...(selected.contacts || []),
                            { name: "", email: "" },
                          ],
                        })
                      }
                    >
                      Add contact
                    </button>
                  </fieldset>
                ) : field === "knowledgeIds" || field === "taskIds" ? (
                  <fieldset key={field}>
                    <legend>
                      {field === "knowledgeIds"
                        ? "Linked knowledge"
                        : "Preparation tasks"}
                    </legend>
                    {(field === "knowledgeIds"
                      ? sources.filter((s) => s.state === "active")
                      : tasks.filter((t) => t.projectId === selected.projectId)
                    ).map((r) => (
                      <label key={r.id}>
                        <input
                          type="checkbox"
                          checked={(selected[field] || []).includes(r.id)}
                          onChange={() =>
                            setSelected({
                              ...selected,
                              [field]: selected[field].includes(r.id)
                                ? selected[field].filter((x) => x !== r.id)
                                : [...selected[field], r.id],
                            })
                          }
                        />
                        {r.title}
                      </label>
                    ))}
                  </fieldset>
                ) : field === "eventId" ? (
                  <label key={field}>
                    Calendar occurrence
                    <select
                      value={selected.eventId || ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          eventId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">No linked event</option>
                      {events
                        .filter((e) => e.kind === "calendar")
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.title}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : field === "priority" ? (
                  <label key={field}>
                    Priority
                    <select
                      value={selected.priority}
                      onChange={(e) =>
                        setSelected({ ...selected, priority: e.target.value })
                      }
                    >
                      {["low", "normal", "high"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                ) : [
                    "objective",
                    "scope",
                    "deliverables",
                    "milestones",
                    "risks",
                    "nextSteps",
                    "notes",
                  ].includes(field) ? (
                  <label key={field}>
                    {labelFor(field)}
                    <textarea
                      rows={3}
                      value={selected[field] || ""}
                      onChange={(e) =>
                        setSelected({ ...selected, [field]: e.target.value })
                      }
                    />
                  </label>
                ) : (
                  <label key={field}>
                    {labelFor(field)}
                    <input
                      required={
                        field === "name" || ["start", "end"].includes(field)
                      }
                      type={field.endsWith("Date") ? "date" : "text"}
                      value={selected[field] || ""}
                      placeholder={
                        ["start", "end"].includes(field)
                          ? "2026-10-01T09:00:00+02:00"
                          : ""
                      }
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          [field]: e.target.value || (def === null ? null : ""),
                        })
                      }
                    />
                  </label>
                ),
              )}
              <button disabled={busy}>Save {kind}</button>
            </form>
          </div>
          <div hidden={detailTab !== "History"}>
            {selected.id && (
              <button
                onClick={() =>
                  act(async () =>
                    setHistory(await api("records/history/" + selected.id)),
                  )
                }
              >
                Show history
              </button>
            )}
            {history.map((r) => (
              <details key={r.version}>
                <summary>
                  Version {r.version} · {r.at}
                </summary>
                <pre>{JSON.stringify(r.record, null, 2)}</pre>
              </details>
            ))}
          </div>
        </dialog>
      )}
      {children}
    </section>
  );
}
