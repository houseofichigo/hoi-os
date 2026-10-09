import Onboarding from "./onboarding.jsx";
import { GoogleWritePolicy } from "./email-drafts.jsx";
import AISettings from "./ai-settings.jsx";
import { ViewTabs } from "./shell.jsx";
import { requested, focusRecord, useSubview } from "./destination.js";
import ProcessingQueue from "./processing.jsx";
import React, { useState, useEffect } from "react";
export default function Configuration({ api }) {
  const [tab, setTab] = useSubview(
    "configuration",
    [
      "Onboarding",
      "Connections",
      "Skills & capabilities",
      "Assistant & search",
      "Security",
      "Workspace & recovery",
    ],
    "Connections",
  );
  const [data, setData] = useState(null),
    [connections, setConnections] = useState([]),
    [queue, setQueue] = useState([]),
    [provider, setProvider] = useState("files"),
    [label, setLabel] = useState(""),
    [scope, setScope] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [coverageMode, setCoverageMode] = useState("fixed"),
    [rollingDays, setRollingDays] = useState(30),
    [fileIds, setFileIds] = useState(""),
    [oauth, setOauth] = useState(null),
    [clientId, setClientId] = useState(""),
    [clientSecret, setSecret] = useState(""),
    [writeActions, setWriteActions] = useState(false),
    [authUrl, setAuthUrl] = useState(""),
    [preview, setPreview] = useState(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    const [c, all, q] = await Promise.all([
      api("configuration"),
      api("sync"),
      api("sync/queue"),
    ]);
    setData(c);
    setConnections(all);
    if (requested("connection")) {
      if (all.some((c) => c.id === requested("connection")))
        focusRecord("connection-" + requested("connection"));
      else setError("Requested connection is unavailable.");
    }
    setQueue(q);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
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
  const adapter = (action, host) =>
    act(async () => {
      const r = await api("adapters/update", { action, hosts: [host] });
      setNotice(
        `Adapter ${action} completed. Verified backup: ${r.backup}. Preserved skills: ${r.archive}. ${r.conflicts.length ? `${r.conflicts.length} customized files retained; inspect adapter status and the preserved archive.` : "No preservation conflicts."}`,
      );
    });
  const create = () =>
    api("sync/create", {
      provider,
      label,
      ...(provider === "files"
        ? { folder: scope }
        : provider === "gmail"
          ? { query: scope }
          : provider === "calendar"
            ? { calendarId: scope, from, to, coverageMode, rollingDays }
            : {
                folderIds: scope
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
                fileIds: fileIds
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean),
              }),
    });
  return (
    <>
      <h1>Configuration</h1>
      <ViewTabs
        label="Configuration views"
        values={[
          "Onboarding",
          "Connections",
          "Skills & capabilities",
          "Assistant & search",
          "Security",
          "Workspace & recovery",
        ]}
        value={tab}
        onChange={setTab}
      />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button disabled={busy} onClick={() => act(load)}>
        Refresh configuration
      </button>
      {tab === "Connections" && (
        <>
          <h2>Connected sources</h2>
          <p>
            Read-only sync every five minutes while this server runs. Select a
            bounded scope and review its preview before activating.
          </p>
          <details className="connection-setup">
            <summary>Add a connection</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(create);
              }}
            >
              <label>
                Name
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <label>
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {["files", "gmail", "calendar", "drive"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label>
                {provider === "files"
                  ? "Local folder"
                  : provider === "gmail"
                    ? "Gmail query"
                    : provider === "calendar"
                      ? "Calendar ID"
                      : "Drive folder IDs (comma separated)"}
                <input
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                />
              </label>
              {provider === "files" && window.hoiDesktop && (
                <button
                  type="button"
                  onClick={() =>
                    act(async () => {
                      const folder =
                        await window.hoiDesktop.chooseSourceFolder();
                      if (folder) setScope(folder);
                    })
                  }
                >
                  Choose source folder
                </button>
              )}
              {provider === "drive" && (
                <label>
                  Drive file IDs (comma separated)
                  <input
                    value={fileIds}
                    onChange={(e) => setFileIds(e.target.value)}
                  />
                </label>
              )}
              {provider === "calendar" && (
                <>
                  <label>
                    Calendar coverage
                    <select
                      value={coverageMode}
                      onChange={(e) => setCoverageMode(e.target.value)}
                    >
                      <option value="fixed">Fixed dates</option>
                      <option value="rolling">Rolling forward window</option>
                    </select>
                  </label>
                  {coverageMode === "rolling" && (
                    <label>
                      Days ahead
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={rollingDays}
                        onChange={(e) => setRollingDays(Number(e.target.value))}
                      />
                    </label>
                  )}
                  <label>
                    From (date and timezone offset)
                    <input
                      placeholder="2026-10-01T00:00:00+02:00"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    To (date and timezone offset)
                    <input value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </>
              )}
              <button disabled={busy}>Add selected connection</button>
            </form>
          </details>
          {!connections.length && (
            <p>
              No connections configured. Add a selected folder or connect a
              bounded Google scope.
            </p>
          )}
          {connections.map((c) => (
            <article key={c.id} id={"connection-" + c.id} tabIndex={-1}>
              <h3>{c.label}</h3>
              <p>
                {c.provider} · {c.accountEmail || "Local / account unverified"}{" "}
                · {c.state} · Last successful sync: {c.lastSuccess || "Unknown"}
              </p>
              <p>
                {c.folder ||
                  c.query ||
                  c.calendarId ||
                  (c.folderIds || []).join(", ")}{" "}
                {c.error}
              </p>
              {c.provider !== "files" && (
                <button
                  onClick={() => {
                    setOauth(c.id);
                    setAuthUrl("");
                  }}
                >
                  Connect / reconnect Google
                </button>
              )}
              <button
                disabled={busy || c.state === "active" || c.state === "syncing"}
                onClick={() =>
                  act(async () =>
                    setPreview({
                      id: c.id,
                      ...(await api("sync/preview", { id: c.id })),
                    }),
                  )
                }
              >
                Preview selected scope
              </button>
              <button
                disabled={busy || c.state !== "active"}
                onClick={() => act(() => api("sync/run", { id: c.id }))}
              >
                Sync now
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(() => api("sync/control", { id: c.id, action: "pause" }))
                }
              >
                Pause
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(() =>
                    api("sync/control", { id: c.id, action: "disconnect" }),
                  )
                }
              >
                Disconnect
              </button>
              <details>
                <summary>Sync history</summary>
                <p>
                  Coverage: {c.coverage?.mode || "Unknown"} ·{" "}
                  {c.coverage?.state || "unknown"}
                </p>
                {c.items?.map((i, n) => (
                  <p key={n}>
                    {i.name} · {i.state} · {i.reason || "Recorded"}
                  </p>
                ))}
                {c.runs.map((r) => (
                  <p key={r.id}>
                    {r.at} · {r.state} · {r.processed} processed · {r.error}
                  </p>
                ))}
              </details>
            </article>
          ))}
          {oauth && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  const secret = clientSecret;
                  setSecret("");
                  const r = await api("sync/oauth", {
                    id: oauth,
                    credentials: {
                      clientId,
                      clientSecret: secret,
                      writeActions,
                    },
                  });
                  setAuthUrl(r.url);
                });
              }}
            >
              <h3>Your Google desktop OAuth application</h3>
              <GoogleWritePolicy api={api} />
              <p>
                Credentials are sent only to your local server and kept in the
                operating-system credential store. Use a Desktop OAuth client
                with the required Google APIs enabled.
              </p>
              <label>
                Client ID
                <input
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </label>
              <label>
                Client secret
                <input
                  required
                  type="password"
                  autoComplete="off"
                  value={clientSecret}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={writeActions}
                  onChange={(e) => setWriteActions(e.target.checked)}
                />
                Enable reviewed Gmail drafts or Calendar preparation events.
                This requests additional Google permissions; HOI never sends
                email.
              </label>
              <button disabled={busy}>Prepare Google sign-in</button>
              {authUrl && (
                <a href={authUrl} target="_blank" rel="noreferrer">
                  Sign in with Google
                </a>
              )}
            </form>
          )}
          {preview && (
            <section aria-label="Connection preview">
              <h3>{preview.items.length} selected items</h3>
              <ul>
                {preview.items.map((i) => (
                  <li key={i.id}>
                    {i.name} {i.size ? `· ${i.size} bytes` : ""}{" "}
                    {i.reason ? `· ${i.reason}` : ""}{" "}
                    {i.contextOnly
                      ? "· reply context from selected thread"
                      : ""}
                  </li>
                ))}
              </ul>
              <button
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await api("sync/control", {
                      id: preview.id,
                      action: "activate",
                      digest: preview.digest,
                    });
                    setPreview(null);
                  })
                }
              >
                Activate reviewed scope
              </button>
            </section>
          )}
          <ProcessingQueue api={api} />
        </>
      )}
      {tab === "Skills & capabilities" && (
        <>
          <h2>Installed workspace adapters</h2>
          <p>
            The app works without skills. Installing instructions does not
            install or run an assistant.
          </p>
          {data?.adapters?.map((a) => (
            <article key={a.host}>
              <h3>
                {a.host} · {a.status}
              </h3>
              <p>
                {a.version || "No version"} · API {a.apiVersion || "Unknown"} ·
                Runtime {a.runtimeAvailable}
              </p>
              <p>{a.detail}</p>
              <button
                disabled={busy}
                onClick={() => adapter("install", a.host)}
              >
                Install / repair {a.host} adapter
              </button>
              <button
                disabled={busy || a.status === "not-installed"}
                onClick={() => adapter("remove", a.host)}
              >
                Remove {a.host} adapter
              </button>
              {(a.modified?.length > 0 || a.missing?.length > 0) && (
                <p>
                  {a.modified.length} modified files · {a.missing.length}{" "}
                  missing files. Modified instructions are preserved during
                  repair.
                </p>
              )}
            </article>
          ))}
          <h2>Skill library</h2>
          <p>
            <a href="/app?view=skills">
              Open Skills to import, edit and review instructions.
            </a>
          </p>
          <h2>Executable engine tools</h2>
          <p>
            Engine API {data?.engineApiVersion}. Availability does not override
            source permissions or required approvals.
          </p>
          <details>
            <summary>Registered operations</summary>
            {data?.engineTools?.map((t) => (
              <p key={t.name}>
                {t.name} · {t.action} · {t.availability}
              </p>
            ))}
          </details>
          <h2>Executable capabilities</h2>
          {data?.capabilities.map((c) => (
            <p key={c.id}>
              {c.id} · {c.version} · {c.state}
            </p>
          ))}
        </>
      )}
      {tab === "Skills & capabilities" && (
        <>
          <h2>Recent executions in this host</h2>
          {data?.executions.map((r) => (
            <p key={r.id}>
              {r.capability} · {r.state} · {r.started_at}
            </p>
          ))}
        </>
      )}
      {tab === "Assistant & search" && (
        <>
          <AISettings api={api} />
          <h2>Assistant handoff</h2>
          <p>{data?.assistant.mode}</p>
          <p>{data?.assistant.webSearch}</p>
          <p>Codex/Claude handoff remains available without an API key.</p>
        </>
      )}
      {tab === "Security" && (
        <>
          <h2>Security checks</h2>
          <p>{data?.security.scope}</p>
          <p>Checked: {data?.security.at}</p>
          <p className="mono">
            Build {data?.security.buildId?.slice(0, 12)} · check version{" "}
            {data?.security.checkVersion}
          </p>
          <button
            onClick={() =>
              act(async () =>
                setData({ ...data, security: await api("security") }),
              )
            }
          >
            Run read-only security check
          </button>
          {data?.security.checks.map((c) => (
            <article key={c.code}>
              <strong>
                {c.code} · {c.status}
              </strong>
              <p>{c.detail}</p>
              <p>{c.scope}</p>
              <p>
                Evidence: {c.testedAt || "Not recorded"}
                {c.environment
                  ? ` · ${c.environment.platform}/${c.environment.arch} · Node ${c.environment.node}`
                  : ""}
              </p>
            </article>
          ))}
        </>
      )}
      {tab === "Onboarding" && <Onboarding api={api} />}
      {tab === "Workspace & recovery" && (
        <>
          <h2>Workspace health</h2>
          {window.hoiDesktop && (
            <button
              onClick={() =>
                window.hoiDesktop.setup().catch((e) => setError(e.message))
              }
            >
              Desktop workspace and engine controls
            </button>
          )}
          <p>Selected workspace: {data?.workspace}</p>
          <p>
            Schema {data?.schemaVersion}. Back up before upgrading; restore into
            a separate directory to rehearse recovery.
          </p>
          <pre>{JSON.stringify(data?.health, null, 2)}</pre>
        </>
      )}
    </>
  );
}
