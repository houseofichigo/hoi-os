import React, { useEffect, useState } from "react";
import ChatUpload from "./chat-upload.jsx";
export default function Transcripts({ api, token, onChange }) {
  const [sources, setSources] = useState([]),
    [projects, setProjects] = useState([]),
    [source, setSource] = useState(""),
    [preview, setPreview] = useState(null),
    [speakers, setSpeakers] = useState({}),
    [project, setProject] = useState(""),
    [occurred, setOccurred] = useState(""),
    [request, setRequest] = useState(null),
    [response, setResponse] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    setSources((await api("hub/sources")).filter((s) => s.state === "active"));
    setProjects(await api("projects"));
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
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function open(s) {
    const p = await api("intake/transcript-preview", {
      sourceId: s.id,
      revisionId: s.currentRevision,
    });
    setPreview(p);
    setSpeakers({});
    setRequest(null);
    setResponse("");
    setOccurred("");
    setProject("");
  }
  return (
    <section aria-label="Transcript workflow">
      <h2>Turn a transcript into reviewed actions</h2>
      <p>
        1. Select a document · 2. Review text and speakers · 3. Extract and
        review suggestions
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? "Working…" : notice}</p>
      <details>
        <summary>Upload a transcript</summary>
        <ChatUpload
          api={api}
          token={token}
          capacity={1}
          onAttached={async (result) => {
            await load();
            if (result.status === "ready") {
              const all = await api("hub/sources");
              const s = all.find((x) => x.id === result.sourceId);
              if (s) await open(s);
            } else
              setNotice(
                "Original preserved. Resolve the extraction gap before transcript review.",
              );
          }}
        />
      </details>
      <label>
        Existing transcript document
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">Select a Knowledge Hub document</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy || !source}
        onClick={() => act(() => open(sources.find((s) => s.id === source)))}
      >
        Review transcript
      </button>
      {preview && (
        <section aria-label="Transcript review">
          <h3>{preview.title}</h3>
          <p>
            Original text is preserved. Speaker labels below are your attributed
            interpretation; leave unknown speakers blank. For mixed speakers in
            one passage, leave its label blank and use the names stated in the
            text.
          </p>
          <label>
            Optional project
            <select
              value={project}
              disabled={!!request}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Standalone — no project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Meeting time (optional, ISO with timezone)
            <input
              placeholder="Leave blank when unknown"
              value={occurred}
              disabled={!!request}
              onChange={(e) => setOccurred(e.target.value)}
            />
          </label>
          {preview.segments.map((p, i) => (
            <article key={p.passageId}>
              <label>
                Speaker for passage {i + 1}
                <input
                  value={speakers[p.passageId] || ""}
                  disabled={!!request}
                  onChange={(e) =>
                    setSpeakers({ ...speakers, [p.passageId]: e.target.value })
                  }
                  placeholder="Unknown"
                />
              </label>
              <blockquote style={{ whiteSpace: "pre-wrap" }}>
                {p.text}
              </blockquote>
            </article>
          ))}
          <button
            disabled={busy || !!request}
            onClick={() =>
              act(async () => {
                const r = await api("intake/transcript-commit", {
                  sourceId: preview.sourceId,
                  revisionId: preview.revisionId,
                  digest: preview.digest,
                  projectId: project || null,
                  occurredAt: occurred || null,
                  speakers: preview.segments.map((p) => ({
                    passageId: p.passageId,
                    speaker: speakers[p.passageId]?.trim() || null,
                  })),
                  confirm: true,
                });
                setRequest(await api("intake/prepare", { id: r.id }));
                await onChange();
                setNotice(
                  "Review saved. Assistant request prepared; no AI has run and no task is approved.",
                );
              })
            }
          >
            Confirm review and prepare extraction
          </button>
        </section>
      )}
      {request && (
        <section aria-label="Transcript assistant handoff">
          <h3>Extract suggestions with your assistant</h3>
          <p>
            Copy the request to Codex or Claude, then validate its response
            here. Suggestions still require duplicate review and approval.
          </p>
          <button
            onClick={() =>
              act(async () => {
                await navigator.clipboard.writeText(
                  JSON.stringify(
                    {
                      ...request,
                      responseContract: {
                        runId: request.runId,
                        requestDigest: request.requestDigest,
                        adapter: "codex or claude",
                        extractionVersion: "commitments-v1",
                        mentions: [
                          {
                            task: {
                              projectId: request.projectId,
                              title: "Required",
                              outcome: "Required",
                              owner: null,
                              dueDate: null,
                              dueTime: null,
                              timezone: null,
                            },
                            evidence: [
                              {
                                revisionId: "exact source revision",
                                passageId: "exact passage",
                                quote: "exact quote",
                              },
                            ],
                            intent: "commitment or suggestion or context",
                            actor: null,
                            recurrenceId: null,
                          },
                        ],
                      },
                    },
                    null,
                    2,
                  ),
                );
                setNotice("Request copied.");
              })
            }
          >
            Copy extraction request
          </button>
          <details>
            <summary>Assistant response exchange</summary>
            <label>
              Assistant extraction response
              <textarea
                rows={8}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !response}
              onClick={() =>
                act(async () => {
                  const v = JSON.parse(response);
                  if (
                    v.runId !== request.runId ||
                    v.requestDigest !== request.requestDigest
                  )
                    throw Error("Response belongs to another request.");
                  await api("intake/submit", v);
                  setResponse("");
                  await onChange();
                  setNotice(
                    "Response validated. Review extracted mentions and possible duplicates below before approving tasks.",
                  );
                })
              }
            >
              Validate transcript suggestions
            </button>
            <details>
              <summary>Technical request</summary>
              <pre>{JSON.stringify(request, null, 2)}</pre>
            </details>
          </details>
        </section>
      )}
    </section>
  );
}
