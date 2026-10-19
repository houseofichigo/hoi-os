import React, { useEffect, useState } from "react";
export function SessionImport({ api, onImported }) {
  const [session, setSession] = useState(null),
    [originalExport, setOriginalExport] = useState(null),
    [selection, setSelection] = useState(null),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const input = () => ({
    session,
    ...(originalExport ? { originalExport } : {}),
    ...(selection ? { selectedTurnIds: selection } : {}),
  });
  return (
    <details className="app-note">
      <summary>Import selected conversation</summary>
      <p>
        Choose a deliberately exported session. No host folders are watched.
        Import preserves the original and does not send it to an AI provider.
      </p>
      <label>
        Conversation export (.json, .md or .txt)
        <input
          type="file"
          accept=".json,.md,.txt"
          disabled={busy}
          onChange={(e) =>
            act(async () => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 512 * 1024)
                throw Error("Choose an export smaller than 512 KiB.");
              const text = await file.text();
              setOriginalExport({
                format: file.name.endsWith(".json") ? "json" : "text",
                content: text,
              });
              setSession(
                file.name.endsWith(".json")
                  ? JSON.parse(text)
                  : {
                      schemaVersion: 1,
                      namespace: "selected-export",
                      account: "manual",
                      conversationId: file.name,
                      title: file.name,
                      coverage: "unknown",
                      text,
                    },
              );
              setSelection(null);
              setPreview(null);
              setNotice("");
            })
          }
        />
      </label>
      {session && (
        <>
          <label>
            Stable conversation identity
            <input
              value={session.conversationId ?? ""}
              onChange={(e) => {
                setSession({ ...session, conversationId: e.target.value });
                setPreview(null);
              }}
            />
          </label>
          <p>
            Reuse this identity when importing a revised selection of the same
            conversation.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => setPreview(await api("session/preview", input())))
            }
          >
            Preview selected export
          </button>
        </>
      )}
      {preview && (
        <>
          <h3>{preview.session.title}</h3>
          <p>
            {preview.outcome} · Coverage: {preview.session.coverage}.{" "}
            {preview.disclosure}
          </p>
          <fieldset>
            <legend>Included turns</legend>
            {preview.availableTurns.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  disabled={busy || !t.selectable}
                  checked={(
                    selection ?? preview.session.turns.map((x) => x.id)
                  ).includes(t.id)}
                  onChange={(e) => {
                    const ids =
                      selection ?? preview.session.turns.map((x) => x.id);
                    setSelection(
                      e.target.checked
                        ? [...ids, t.id]
                        : ids.filter((id) => id !== t.id),
                    );
                    setPreview(null);
                  }}
                />
                {t.id} · {t.role} · {t.timestamp ?? "Time unknown"}
                {!t.selectable ? " · credential-like content excluded" : ""}
              </label>
            ))}
          </fieldset>
          {preview.session.turns.map((t) => (
            <details key={t.id}>
              <summary>
                {t.role} · {t.id}
              </summary>
              <p className="passage-text">{t.text}</p>
            </details>
          ))}
          {preview.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const r = await api("session/commit", {
                  ...input(),
                  requestKey: crypto.randomUUID(),
                  previewDigest: preview.digest,
                  expectedRevision: preview.expectedRevision,
                });
                setNotice("Session imported. Analysis has not started.");
                setPreview(null);
                setSession(null);
                await onImported?.(r);
              })
            }
          >
            Import reviewed selection
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
export function DiscoveryReader({ api, source }) {
  const [session, setSession] = useState(null),
    [notice, setNotice] = useState(""),
    [artifacts, setArtifacts] = useState([]),
    [provider, setProvider] = useState(""),
    [preview, setPreview] = useState(null),
    [job, setJob] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setSession(null);
    setArtifacts([]);
    setPreview(null);
    setJob(null);
    Promise.all([
      api("knowledge/session?sourceId=" + encodeURIComponent(source.id)),
      api("knowledge/artifacts?sourceId=" + encodeURIComponent(source.id)),
    ])
      .then(([s, a]) => {
        setSession(s);
        setArtifacts(a.items);
      })
      .catch((e) => setError(e.message));
  }, [source.id]);
  useEffect(() => {
    if (job?.state === "completed")
      api("knowledge/artifacts?sourceId=" + encodeURIComponent(source.id))
        .then((a) => setArtifacts(a.items))
        .catch((e) => setError(e.message));
    if (!job || job.state !== "running") return;
    const timer = setInterval(() => {
      if (!document.hidden)
        api(
          "knowledge/enrich-status?requestKey=" +
            encodeURIComponent(job.requestKey),
        )
          .then(setJob)
          .catch((e) => setError(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [job?.requestKey, job?.state]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const input = () => ({
    revisionIds: [source.currentRevision],
    provider,
    maxCost: 0.25,
  });
  return (
    <section aria-label="Source knowledge processing">
      {session && (
        <>
          <h3>Selected session · {session.coverage}</h3>
          <p>
            {session.omitted.length} omitted turns · Speaker labels describe the
            export, not verified authorship.
          </p>
          <nav aria-label="Session turns">
            {session.turns.map((t, i) => (
              <a key={t.id} href={"#session-turn-" + i}>
                {t.role} {i + 1}{" "}
              </a>
            ))}
          </nav>
          {session.turns.map((t, i) => (
            <details id={"session-turn-" + i} key={t.id}>
              <summary>
                {t.role} · {t.timestamp ?? "Time unknown"} · {t.id}
              </summary>
              <p className="passage-text">{t.text}</p>
            </details>
          ))}
        </>
      )}
      <details>
        <summary>Discovery observations · {artifacts.length}</summary>
        <p>
          Derived, unreviewed. Original passages remain the evidence. Use
          Reviews to prepare governed changes.
        </p>
        {artifacts.map((a) => (
          <article key={a.id}>
            <h4>{a.topic}</h4>
            <p>{a.coverage}</p>
            {(
              a.observations ?? [
                ...a.summary,
                ...a.decisions,
                ...a.proposedActions,
                ...a.openQuestions,
              ]
            ).map((o, i) => (
              <details key={o.id ?? i}>
                <summary>
                  {o.kind ?? "Legacy claim"}: {o.text}
                </summary>
                <p>{o.attribution ?? "Legacy source-level attribution"}</p>
                {o.evidence.map((e, j) => (
                  <blockquote key={j}>{e.quote}</blockquote>
                ))}
                {o.id && ["preference", "decision"].includes(o.kind) && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(async () => {
                        const m = await api("memory/propose", {
                          requestKey: "discovery:" + o.id,
                          memory: {
                            type: o.kind,
                            content: o.text,
                            evidence: o.evidence,
                            allowedHosts: ["local"],
                          },
                        });
                        setNotice(
                          "Memory proposal saved for review. It has not been approved.",
                        );
                      })
                    }
                  >
                    Propose memory for review
                  </button>
                )}
              </details>
            ))}
          </article>
        ))}
      </details>
      <details>
        <summary>Prepare discovery enrichment</summary>
        <p>
          One bounded window per run, up to $0.25 within the $25 automatic
          monthly budget. Existing source disclosure is required.
        </p>
        <label>
          Provider
          <select
            aria-label="Enrichment provider"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">Select configured provider</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </label>
        <button
          disabled={!provider || busy || job?.state === "running"}
          onClick={() =>
            act(async () =>
              setPreview(await api("knowledge/enrich-preview", input())),
            )
          }
        >
          Preview enrichment
        </button>
        {preview && (
          <>
            <p>
              {preview.windowCount} windows · {preview.coverage}
            </p>
            {preview.prerequisites.map((x) => (
              <p key={x}>{x.replaceAll("_", " ")}</p>
            ))}
            <button
              disabled={
                busy ||
                preview.prerequisites.length > 0 ||
                job?.state === "running"
              }
              onClick={() =>
                act(async () =>
                  setJob(
                    await api("knowledge/enrich", {
                      ...input(),
                      previewDigest: preview.digest,
                      requestKey: crypto.randomUUID(),
                    }),
                  ),
                )
              }
            >
              Process next window
            </button>
          </>
        )}
        {job && (
          <p role="status">
            {job.state}{" "}
            {job.pendingWindows != null
              ? `· ${job.pendingWindows} windows pending`
              : ""}{" "}
            {job.error} {job.notice}
          </p>
        )}
        {job?.state === "running" && (
          <button
            onClick={() =>
              act(async () =>
                setJob(
                  await api("knowledge/enrich-cancel", {
                    requestKey: job.requestKey,
                  }),
                ),
              )
            }
          >
            Cancel enrichment
          </button>
        )}
      </details>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function PipelineHealth({ api }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = () =>
    api("knowledge/health")
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <details className="app-note">
      <summary>Knowledge pipeline health</summary>
      <button className="secondary" onClick={load}>
        Refresh health
      </button>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p>
            Checked {new Date(data.checkedAt).toLocaleString()}. Freshness is
            not a quality score.
          </p>
          {data.connections.map((c) => (
            <p key={c.id}>
              {c.label}: {c.state} · Last success {c.lastSuccess ?? "unknown"}
            </p>
          ))}
          <div className="table-scroll" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Extraction</th>
                  <th>Lexical index</th>
                  <th>Semantic index</th>
                  <th>Enrichment</th>
                  <th>Source coverage</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.sourceId}>
                    <td>
                      <a
                        href={
                          "/hub?view=knowledge&section=Sources&source=" +
                          encodeURIComponent(s.sourceId)
                        }
                      >
                        {s.title}
                      </a>
                    </td>
                    <td>{s.extraction}</td>
                    <td>{s.lexical}</td>
                    <td>{s.semantic}</td>
                    <td>
                      {s.enrichment}
                      {s.pendingWindows !== null
                        ? ` · ${s.pendingWindows} windows pending`
                        : ""}
                    </td>
                    <td>{s.upstreamCoverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.limitations.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </>
      )}
    </details>
  );
}
