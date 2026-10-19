import React, { useEffect, useState } from "react";
import { Drawer } from "./product-ui.jsx";
import { StatusLabel } from "./shell.jsx";

const blank = {
  label: "Knowledge health",
  scope: { kind: "sources", sourceIds: [] },
  accessHost: "local",
  recipe: "knowledge-health",
  objective: "Check changed sources, recorded contradictions and due reviews.",
  maxItems: 25,
  futureRevisions: true,
  importBacklog: false,
  analyzeBacklog: false,
  maxCost: 0.25,
  scheduler: {
    kind: "manual",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cadence: "manual",
  },
};
export default function Automations({ api }) {
  const [data, setData] = useState(null),
    [runs, setRuns] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(null),
    [preview, setPreview] = useState(null),
    [selection, setSelection] = useState(""),
    [sources, setSources] = useState([]),
    [connections, setConnections] = useState([]),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null),
    [observation, setObservation] = useState({schedulerId:"",state:"unknown",evidence:""}),
    [secret, setSecret] = useState(null);
  async function load() {
    const [d, h] = await Promise.all([
      api("automations"),
      api("automations/history"),
    ]);
    setData(d);
    setRuns(h.items);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    Promise.all([api("sources"), api("sync")])
      .then(([s, c]) => {
        setSources(Array.isArray(s) ? s : (s.sources ?? []));
        setConnections(c);
      })
      .catch(() => {});
    const timer = setInterval(() => {
      if (!document.hidden) load().catch((e) => setError(e.message));
    }, 4000);
    return () => clearInterval(timer);
  }, []);
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
  function change(p) {
    setForm({ ...form, ...p });
    setPreview(null);
  }
  function candidate() {
    return {
      ...form,
      scope:
        form.scope.kind === "sources"
          ? {
              kind: "sources",
              sourceIds: selection
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            }
          : form.scope.kind === "connection"
            ? { kind: "connection", connectionId: selection }
            : form.scope,
    };
  }
  const controls = (d) => ({
    id: d.id,
    expectedVersion: d.version,
    confirm: true,
  });
  return (
    <section aria-label="Automations" className="automations">
      <div className="product-toolbar">
        <div>
          <h2>Automations</h2>
          <p>
            Scoped intake, checks and reviewable drafts. You choose when work
            runs.
          </p>
        </div>
        <button
          onClick={() => {
            setForm(structuredClone(blank));
            setSelection("");
            setPreview(null);
            setEditing(null);
            setError("");
          }}
        >
          New automation
        </button>
      </div>
      <p>
        External schedules are separate from engine authorization. Without an AI
        key, imports and mechanical checks still work.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section aria-label="Automatic analysis budget">
        <strong>$25 monthly automatic-analysis limit</strong>
        <p>
          Each run is limited to $0.25. Recorded usage and unresolved
          reservations are kept separately.
        </p>
        {data?.usage.map((u) => (
          <p key={u.month}>
            {u.month}: ${Number(u.actual ?? 0).toFixed(4)} recorded · $
            {Number(u.reserved ?? 0).toFixed(4)} reserved
          </p>
        ))}
      </section>
      {!data ? (
        <p role="status">Loading automations…</p>
      ) : !data.definitions.length ? (
        <p>
          No automations configured. Create a definition and review its scope
          before enabling it.
        </p>
      ) : (
        data.definitions.map((d) => (
          <article key={d.id} className="automation-row">
            <div>
              <h3>
                <button className="link-button" onClick={() => setSelected(d)}>
                  {d.definition.label}
                </button>
              </h3>
              <StatusLabel>{d.state}</StatusLabel>
              <p>
                {d.definition.recipe} · {d.definition.scheduler.kind} ·{" "}
                {d.definition.scheduler.timezone}
              </p>
              <p>
                Scheduler:{" "}
                {d.schedulerObservation.stale
                  ? "verification stale"
                  : d.schedulerObservation.state}
                . Next run: {d.schedulerObservation.nextRun ?? "unknown"}.
              </p>
              <p>
                Last run:{" "}
                {d.lastRun
                  ? `${d.lastRun.state} · ${d.lastRun.updatedAt}`
                  : "not run"}
              </p>
            </div>
            <div className="product-toolbar">
              <button
                disabled={busy || d.state === "enabled"}
                onClick={() =>
                  act(async () => {
                    const p = await api("automations/preview", d.definition);
                    setSelected({ ...d, reviewPreview: p });
                  })
                }
              >
                Review to enable
              </button>
              <button
                disabled={
                  busy ||
                  d.state !== "enabled" ||
                  d.definition.scope.kind === "export"
                }
                onClick={() =>
                  act(async () => {
                    await api("automations/run", {
                      id: d.id,
                      triggerId: crypto.randomUUID(),
                    });
                    setNotice(
                      "Run requested. Inspect the status below; uncertain outcomes are never retried automatically.",
                    );
                  })
                }
              >
                Run once
              </button>
              <button
                disabled={busy || d.state !== "enabled"}
                onClick={() =>
                  act(async () => {
                    await api("automations/pause", controls(d));
                    setNotice(
                      "Engine paused. Check and pause the external scheduler separately. An already dispatched provider request may still complete.",
                    );
                  })
                }
              >
                Pause now
              </button>
            </div>
          </article>
        ))
      )}
      <h3>Recent runs</h3>
      <ul>
        {runs.map((r) => (
          <li key={r.id}>
            <strong>{r.state}</strong> · {r.stage} · {r.updatedAt}
            {r.error && <p>{r.error}</p>}
            {r.notice && <p>{r.notice}</p>}
            {r.reviewIds?.length > 0 && (
              <a href="/hub?view=knowledge&section=Reviews">
                Open review findings
              </a>
            )}
          </li>
        ))}
      </ul>
      {form && (
        <Drawer title={editing ? "Edit automation" : "New automation"} onClose={() => setForm(null)}>
          <h2>{editing ? "Edit automation" : "New automation"}</h2>
          <button onClick={() => setForm(null)}>Close</button>
          {error && <p role="alert">{error}</p>}
          {editing && <p>Saving disables this definition and revokes its scheduler credential. Review and enable the revised scope separately.</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act(async () =>
                setPreview(await api("automations/preview", candidate())),
              );
            }}
          >
            <label>
              Name
              <input
                value={form.label}
                onChange={(e) => change({ label: e.target.value })}
                required
              />
            </label>
            <label>
              Work to perform
              <select
                value={form.recipe}
                onChange={(e) =>
                  change({
                    recipe: e.target.value,
                    ...(e.target.value.includes("review")
                      ? { provider: form.provider ?? "openai" }
                      : { provider: undefined }),
                  })
                }
              >
                {[
                  "knowledge-health",
                  "intake-health",
                  "assisted-review",
                  "intake-review",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Review objective
              <textarea
                required
                value={form.objective}
                onChange={(e) => change({ objective: e.target.value })}
              />
            </label>
            <label>
              Source scope
              <select
                value={form.scope.kind}
                onChange={(e) => {
                  change({
                    scope:
                      e.target.value === "export"
                        ? {
                            kind: "export",
                            namespace: "",
                            account: "",
                            scope: "",
                            contentTypes: ["document"],
                          }
                        : { kind: e.target.value },
                  });
                  setSelection("");
                }}
              >
                <option value="sources">Existing sources</option>
                <option value="connection">Reviewed connection</option>
                <option value="export">Third-party exports</option>
              </select>
            </label>
            {form.scope.kind === "sources" && (
              <>
                <fieldset><legend>Selected sources</legend>
                  {sources.map(s=><label key={s.id}><input type="checkbox" checked={selection.split(",").includes(s.id)} onChange={e=>{const chosen=selection.split(",").filter(Boolean);setSelection((e.target.checked?[...chosen,s.id]:chosen.filter(id=>id!==s.id)).join(","));setPreview(null);}}/>{s.title}</label>)}
                </fieldset>
                <details><summary>Source identities</summary>
                <label>
                  Source IDs (comma separated)
                  <input
                    required
                    value={selection}
                    onChange={(e) => {
                      setSelection(e.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
                <details>
                  <summary>Available source identities</summary>
                  <ul>
                    {sources.map((s) => (
                      <li key={s.id}>
                        {s.title} · <code>{s.id}</code>
                      </li>
                    ))}
                  </ul>
                </details>
                </details>
              </>
            )}
            {form.scope.kind === "connection" && (
              <label>
                Connection
                <select
                  required
                  value={selection}
                  onChange={(e) => {
                    setSelection(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">
                    Select an active, reviewed connection
                  </option>
                  {connections
                    .filter((c) => c.state === "active")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} · maximum {c.maxItems} items
                      </option>
                    ))}
                </select>
              </label>
            )}
            {form.scope.kind === "export" &&
              ["namespace", "account", "scope"].map((k) => (
                <label key={k}>
                  {k}
                  <input
                    required
                    value={form.scope[k]}
                    onChange={(e) =>
                      change({ scope: { ...form.scope, [k]: e.target.value } })
                    }
                  />
                </label>
              ))}
            <label>
              Maximum items per run
              <input
                type="number"
                min="1"
                max="100"
                value={form.maxItems}
                onChange={(e) => change({ maxItems: Number(e.target.value) })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.futureRevisions}
                onChange={(e) => change({ futureRevisions: e.target.checked })}
              />
              Allow future matching revisions
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.importBacklog}
                onChange={(e) => change({ importBacklog: e.target.checked })}
              />
              Import existing backlog
            </label>
            {form.recipe.includes("review") && (
              <>
                <label>
                  AI provider
                  <select
                    value={form.provider}
                    onChange={(e) => change({ provider: e.target.value })}
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={form.analyzeBacklog}
                    onChange={(e) =>
                      change({ analyzeBacklog: e.target.checked })
                    }
                  />
                  Analyze existing backlog (requires source disclosure
                  permission)
                </label>
              </>
            )}
            <label>
              Scheduler
              <select
                value={form.scheduler.kind}
                onChange={(e) =>
                  change({
                    scheduler: {
                      ...form.scheduler,
                      kind: e.target.value,
                      cadence: e.target.value === "manual" ? "manual" : "daily",
                    },
                  })
                }
              >
                {["manual", "codex", "n8n"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Timezone
              <input
                required
                value={form.scheduler.timezone}
                onChange={(e) =>
                  change({
                    scheduler: { ...form.scheduler, timezone: e.target.value },
                  })
                }
              />
            </label>
            {form.scheduler.kind !== "manual" && (
              <label>
                Cadence
                <select
                  value={form.scheduler.cadence}
                  onChange={(e) =>
                    change({
                      scheduler: { ...form.scheduler, cadence: e.target.value },
                    })
                  }
                >
                  {["quarter-hour", "daily", "weekly"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            )}
            <button disabled={busy}>Preview scope</button>
          </form>
          {preview && (
            <section aria-label="Automation preview">
              <h3>Review scope</h3>
              <p>
                {preview.backlog.recordedSources} recorded sources ·{" "}
                {preview.backlog.previewItems} preview items
              </p>
              <p>
                {preview.steps.join(" → ")} · Maximum $
                {preview.budget.perRun.toFixed(2)} per run
              </p>
              <p>
                {preview.prerequisites.join(" · ") ||
                  "Manual prerequisites satisfied"}
              </p>
              <p>
                Saving creates a disabled definition. Enabling does not create a
                scheduler.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api("automations/save", {
                      ...(editing ? {id:editing.id} : {}),
                      definition: candidate(),
                      expectedVersion: editing?.version ?? 0,
                      previewDigest: preview.digest,
                    });
                    setForm(null);
                    setNotice(
                      "Saved disabled. Review the definition before enabling.",
                    );
                  })
                }
              >
                Save disabled definition
              </button>
            </section>
          )}
        </Drawer>
      )}
      {selected && (
        <Drawer
          title="Automation details"
          onClose={() => {
            setSelected(null);
            setSecret(null);
          }}
        >
          <h2>{selected.definition.label}</h2>
          <button
            onClick={() => {
              setSelected(null);
              setSecret(null);
            }}
          >
            Close
          </button>
          <p>{selected.definition.objective}</p>
          {error && <p role="alert">{error}</p>}
          <p>
            Engine: {selected.state}. Scheduler:{" "}
            {selected.schedulerObservation.state}.
          </p>
          <p>
            Permissions: import authorized originals, write findings and produce
            reviewable drafts only. No approvals, publication or external
            writes.
          </p>
          <details>
            <summary>Scope and exact instruction revisions</summary>
            <pre>
              {JSON.stringify(
                {
                  scope: selected.definition.scope,
                  skills: selected.skills,
                  provider: selected.provider,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <button disabled={busy || selected.lastRun?.state === "running"} onClick={()=>{
            setEditing(selected);setForm(structuredClone(selected.definition));setSelection(selected.definition.scope.kind==="sources" ? selected.definition.scope.sourceIds.join(",") : selected.definition.scope.connectionId??"");setPreview(null);setSelected(null);setSecret(null);setError("");
          }}>Edit definition</button>
          {selected.state!=="enabled" && selected.definition.scope.kind==="connection" && <button disabled={busy} onClick={()=>act(async()=>{await api("automations/release-connection",controls(selected));setSelected(null);setNotice("Scheduling ownership released. The connection remains paused until you preview and activate it again.");})}>Release connection ownership</button>}
          {selected.definition.scheduler.kind!=="manual" && <details><summary>Record scheduler verification</summary>
            <p>Inspect the actual scheduler before recording this observation. This records your read-back; it does not create, activate or pause a schedule.</p>
            <form onSubmit={e=>{e.preventDefault();act(async()=>{const updated=await api("automations/observe",{id:selected.id,expectedVersion:selected.version,...observation});setSelected(updated);setNotice("Scheduler observation saved.");});}}>
              <label>Actual scheduler identity<input required value={observation.schedulerId} onChange={e=>setObservation({...observation,schedulerId:e.target.value})}/></label>
              <label>Observed scheduler state<select value={observation.state} onChange={e=>setObservation({...observation,state:e.target.value})}>{["configured","verified-active","paused","unavailable","unknown"].map(x=><option key={x}>{x}</option>)}</select></label>
              <label>Read-back evidence<textarea required value={observation.evidence} onChange={e=>setObservation({...observation,evidence:e.target.value})}/></label>
              <button disabled={busy}>Record observation</button>
            </form>
          </details>}
          {selected.reviewPreview && (
            <section>
              <h3>Enable this exact scope?</h3>
              <p>
                {selected.reviewPreview.backlog.previewItems} preview items.
                Backlog import: {String(selected.definition.importBacklog)}.
                Backlog analysis: {String(selected.definition.analyzeBacklog)}.
              </p>
              {selected.definition.scope.kind==="connection" && <p>
                Connection polling transfers to this definition. External
                schedule setup remains separate.
              </p>}
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api("automations/enable", {
                      ...controls(selected),
                      digest: selected.reviewPreview.digest,
                    });
                    setSelected(null);
                    setNotice(
                      "Definition enabled. No external schedule was created.",
                    );
                  })
                }
              >
                Confirm scope and enable
              </button>
            </section>
          )}
          {selected.state === "enabled" && (
            <section>
              <h3>Scheduler credential</h3>
              <p>
                Create a credential for this definition only. This replaces any
                previous scheduler credential. Store it in the scheduler
                credential store.
              </p>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const c = await api(
                      "automations/credential",
                      controls(selected),
                    );
                    setSecret(c.token);
                  })
                }
              >
                Create scoped credential
              </button>
              {secret && (
                <label>
                  One-time credential
                  <input readOnly type="password" value={secret} />
                  <button
                    onClick={() =>
                      act(async () => {
                        await navigator.clipboard.writeText(secret);
                        setNotice(
                          "Credential copied. Store it securely; it will be cleared when you close this panel.",
                        );
                      })
                    }
                  >
                    Copy credential
                  </button>
                </label>
              )}
            </section>
          )}
        </Drawer>
      )}
    </section>
  );
}
