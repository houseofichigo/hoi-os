import React, { useState, useEffect } from "react";
export default function AISettings({ api }) {
  const [status, setStatus] = useState(null),
    [sources, setSources] = useState([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [connections, setConnections] = useState([]),
    [preview, setPreview] = useState(null),
    [autoProvider, setAutoProvider] = useState("openai"),
    [backlog, setBacklog] = useState(false);
  async function load() {
    setStatus(await api("ai/status"));
    setSources(await api("hub/sources"));
    setConnections(await api("sync"));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(fn) {
    setError("");
    setNotice("");
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
  return (
    <section aria-label="Model API configuration">
      <h2>In-app AI providers</h2>
      <p>
        API access is separate from assistant subscriptions. Keys are stored in
        the operating-system credential store. Only explicitly permitted context
        may be disclosed.
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? "Working…" : notice}</p>
      {status?.providers.map((p) => (
        <details key={p.provider}>
          <summary>
            {p.provider === "openai" ? "OpenAI" : "Anthropic"} · {p.state}
          </summary>
          {p.verification && (
            <p>
              Last credential check: {p.verification.checkedAt}.{" "}
              {p.verification.scope}. {p.verification.code || ""}
            </p>
          )}
          <form
            className="task-form"
            key={p.provider + JSON.stringify(p)}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = new FormData(form);
              const key = data.get("key");
              act(async () => {
                await api("ai/configure", {
                  provider: p.provider,
                  model: data.get("model"),
                  ...(key ? { key } : {}),
                  inputPerMillion: Number(data.get("inputRate")),
                  outputPerMillion: Number(data.get("outputRate")),
                  pricingDate: data.get("pricingDate"),
                  allowWorkspaceContext: data.get("context") === "on",
                  sourceIds: data.getAll("source"),
                  confirm: true,
                });
                form.querySelector("[name=key]").value = "";
                setNotice("Configuration saved. Test connection before use.");
              });
            }}
          >
            <label>
              API key (leave empty to keep saved key)
              <input name="key" type="password" autoComplete="off" />
            </label>
            <label>
              Exact model ID
              <input name="model" defaultValue={p.model || ""} required />
            </label>
            <p>
              Verify this model’s current pricing before enabling requests.
              Rates are USD per million tokens; stale pricing pauses requests.
            </p>
            <label>
              Input rate
              <input
                name="inputRate"
                type="number"
                step="any"
                min="0.001"
                defaultValue={p.inputPerMillion || ""}
                required
              />
            </label>
            <label>
              Output rate
              <input
                name="outputRate"
                type="number"
                step="any"
                min="0.001"
                defaultValue={p.outputPerMillion || ""}
                required
              />
            </label>
            <label>
              Pricing verified on
              <input
                name="pricingDate"
                type="date"
                defaultValue={p.pricingDate || ""}
                required
              />
            </label>
            <label>
              <input
                name="context"
                type="checkbox"
                defaultChecked={p.allowWorkspaceContext}
              />
              Permit supplied chat messages, selected skill instructions and
              visible workspace context to this provider
            </label>
            <fieldset>
              <legend>Permitted source documents</legend>
              {sources
                .filter((s) => s.state === "active")
                .map((s) => (
                  <label key={s.id}>
                    <input
                      type="checkbox"
                      name="source"
                      value={s.id}
                      defaultChecked={p.sourceIds?.includes(s.id)}
                    />
                    {s.title}
                  </label>
                ))}
            </fieldset>
            <button disabled={busy}>
              Review and save provider permissions
            </button>
            <button
              type="button"
              disabled={busy || p.state === "not-configured"}
              onClick={() =>
                act(async () => {
                  const r = await api("ai/test", { provider: p.provider });
                  setNotice(
                    `Credential check passed (generation not verified). Listed models: ${r.models
                      .map((m) => m.id)
                      .slice(0, 12)
                      .join(", ")}`,
                  );
                })
              }
            >
              Test connection
            </button>
          </form>
        </details>
      ))}
      <h3>Automatic scoped analysis</h3>
      <p>
        New selected communications can be analyzed while the server is running.
        Outputs enter review; no tasks or external actions are approved
        automatically.
      </p>
      <label>
        Analysis provider
        <select
          value={autoProvider}
          onChange={(e) => setAutoProvider(e.target.value)}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      {connections.map((c) => (
        <article key={c.id}>
          <strong>{c.config?.label || c.label || c.id}</strong>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                setPreview(
                  await api("ai/analysis-preview", { connectionId: c.id }),
                );
                setBacklog(false);
              })
            }
          >
            Preview analysis scope
          </button>
        </article>
      ))}
      {preview && (
        <section>
          <p>
            {preview.items.length} existing communications in the selected
            scope.
          </p>
          <ul>
            {preview.items.map((i) => (
              <li key={i.id}>
                {i.title} · {i.kind}
              </li>
            ))}
          </ul>
          <label>
            <input
              type="checkbox"
              checked={backlog}
              onChange={(e) => setBacklog(e.target.checked)}
            />
            Also analyze this reviewed backlog
          </label>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("ai/analysis-configure", {
                  connectionId: preview.connectionId,
                  provider: autoProvider,
                  enabled: true,
                  kinds: ["email", "calendar", "transcript"],
                  includeBacklog: backlog,
                  previewDigest: preview.digest,
                  confirm: true,
                });
                setPreview(null);
                setNotice("Automatic analysis enabled for the reviewed scope.");
              })
            }
          >
            Enable selected analysis
          </button>
        </section>
      )}
      {status?.scopes?.map((scope) => (
        <p key={scope.id}>
          {scope.id} · {scope.enabled ? "Enabled" : "Paused"} ·{" "}
          {scope.lastError || "Ready"}
          <button
            onClick={() =>
              act(async () => {
                const p = await api("ai/analysis-preview", {
                  connectionId: scope.id,
                });
                await api("ai/analysis-configure", {
                  connectionId: scope.id,
                  provider: scope.provider,
                  enabled: false,
                  kinds: scope.kinds,
                  includeBacklog: false,
                  previewDigest: p.digest,
                  confirm: true,
                });
              })
            }
          >
            Pause
          </button>
        </p>
      ))}
      {status?.jobs?.map((j) => (
        <p key={j.id}>
          {j.provider} · {j.state} · {j.error || "Recorded"}
          {["queued", "running"].includes(j.state) && (
            <button onClick={() => act(() => api("ai/cancel", { id: j.id }))}>
              Cancel
            </button>
          )}
        </p>
      ))}
      <h3>Usage</h3>
      <p>
        Automatic-analysis allowance: $25/month. Manual requests use a separate
        $0.25 maximum estimate by default. Uncertain charges retain their
        reservation.
      </p>
      {status?.usage.map((u) => (
        <p key={u.month + u.category}>
          {u.month} · {u.category} · ${u.amount.toFixed(4)} recorded/reserved ·
          ${u.uncertain.toFixed(4)} unresolved
        </p>
      ))}
      <p>Automatic analysis: {status?.automaticState || "unavailable"}</p>
    </section>
  );
}
export function AIResponse({ api, runId, onComplete }) {
  const [provider, setProvider] = useState("openai"),
    [job, setJob] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setJob(null);
    setError("");
  }, [runId]);
  useEffect(() => {
    if (!job || !["queued", "running"].includes(job.state)) return;
    let live = true;
    const timer = setInterval(async () => {
      try {
        const next = await api(`ai/job/${job.id}`);
        if (!live) return;
        setJob(next);
        if (next.state === "completed") onComplete();
      } catch (e) {
        if (live) {
          setError(e.message);
          setJob(null);
        }
      }
    }, 700);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job?.id, job?.state]);
  return (
    <section aria-label="In-app response">
      <h3>Answer in HOI</h3>
      <p>
        Uses only permitted supplied context. API billing applies; maximum
        estimate $0.25 for this request.
      </p>
      <label>
        Provider
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={busy || ["running", "queued"].includes(job?.state)}
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      <button
        disabled={busy || !!job}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setJob(await api("ai/run", { runId, provider, maxCost: 0.25 }));
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Generate cited answer
      </button>
      {job && (
        <>
          <p role="status">
            {job.state}
            {job.error ? " · " + job.error : ""}
          </p>
          {["queued", "running"].includes(job.state) && (
            <button
              onClick={async () =>
                setJob(await api("ai/cancel", { id: job.id }))
              }
            >
              Cancel generation
            </button>
          )}
          {job.preview && (
            <details>
              <summary>Live structured response · not yet validated</summary>
              <pre>{job.preview}</pre>
            </details>
          )}
        </>
      )}
      {error && (
        <p role="alert">
          {error}{" "}
          <a href="?view=configuration&section=Assistant+%26+search">
            Configure provider permissions
          </a>
        </p>
      )}
    </section>
  );
}
