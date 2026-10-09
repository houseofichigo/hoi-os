import React, { useEffect, useState } from "react";
export default function RetrievalStatus({ api }) {
  const [status, setStatus] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const load = () => api("knowledge/index-status").then(setStatus);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function run(path, input) {
    setBusy(true);
    setError("");
    try {
      await api(path, input);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="app-note">
      <summary>
        Search coverage
        {status ? ` · Lexical available · Semantic ${status.semantic}` : ""}
      </summary>
      <p>
        Local multilingual search is optional. Text stays on this computer.
        Index readiness is not a knowledge-quality score.
      </p>
      {status && (
        <>
          <p>
            Model package: {Math.ceil(status.modelBytes / 1024 / 1024)} MiB.
            Allow additional disk space for temporary downloads and the index.
            Changes are checked every 30 seconds while the app server runs,
            after you enable search and install the model.
          </p>
          <p>
            Index maintenance: {status.maintenance?.state ?? "idle"}
            {status.maintenance?.reason
              ? ` · ${status.maintenance.reason.replaceAll("_", " ").toLowerCase()}`
              : ""}
          </p>
          <ul>
            {Object.entries(status.domains ?? {}).map(([domain, counts]) => (
              <li key={domain}>
                {domain}: {counts.indexed} of {counts.eligible} eligible
                passages indexed; {counts.pending} pending
              </li>
            ))}
          </ul>
          <button
            disabled={busy}
            onClick={() => load().catch((e) => setError(e.message))}
          >
            Refresh coverage
          </button>
          <div className="toolbar">
            <button
              disabled={busy}
              onClick={() =>
                run("knowledge/configure-search", {
                  enabled: status.semantic === "disabled",
                  confirm: true,
                })
              }
            >
              {status.semantic === "disabled"
                ? "Enable local semantic search"
                : "Disable semantic search"}
            </button>
            {status.semantic !== "disabled" && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    run("knowledge/install-model", { confirm: true })
                  }
                >
                  Download verified model
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run("knowledge/rebuild", {
                      requestKey: crypto.randomUUID(),
                    })
                  }
                >
                  Rebuild local index
                </button>
              </>
            )}
          </div>
          <p>
            Download contacts Hugging Face for the pinned model files only.
            Lexical search remains available if the model cannot load.
          </p>
        </>
      )}
      {busy && (
        <p role="status">
          Working on the local model or index. Intake jobs retain rebuild status
          and support cancellation.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
