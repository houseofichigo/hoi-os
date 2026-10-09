import React, { useState, useEffect } from "react";
import { focusRecord } from "./destination.js";
export default function Maintenance({ api, refresh }) {
  const [rows, setRows] = useState([]),
    [choices, setChoices] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [json, setJson] = useState(""),
    [message, setMessage] = useState("");
  async function load() {
    const [r, c] = await Promise.all([
      api("knowledge"),
      api("knowledge/replacements"),
    ]);
    setRows(r);
    setChoices(c);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("finding");
    if (id && rows.some((r) => r.id === id)) focusRecord("finding-" + id);
  }, [rows]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      await refresh();
      setMessage("Knowledge review updated.");
    } catch (e) {
      setRows([]);
      setChoices([]);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Knowledge maintenance">
      <h2>Knowledge review</h2>
      <p>
        Review source changes, recorded contradictions, duplicates and expired
        memory. Original knowledge is retained.
      </p>
      <button
        disabled={busy}
        onClick={() => act(() => api("knowledge/scan", {}))}
      >
        Scan knowledge
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <details>
        <summary>Propose a cited wiki or memory update</summary>
        <p>
          Submit a new draft with current evidence. Review it through Wiki or
          Memory before selecting it as a replacement.
        </p>
        <label>
          Knowledge proposal JSON
          <textarea
            rows={7}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => act(() => api("knowledge/propose", JSON.parse(json)))}
        >
          Create cited proposal
        </button>
      </details>
      {rows
        .filter((r) => r.state === "pending" && r.current)
        .map((r) => (
          <Review
            key={r.id}
            r={r}
            choices={choices}
            busy={busy}
            act={(v) => act(() => api("knowledge/review", v))}
          />
        ))}
      <details>
        <summary>Review history</summary>
        <ul>
          {rows
            .filter((r) => r.state !== "pending" || !r.current)
            .map((r) => (
              <li key={r.id} id={"finding-" + r.id} tabIndex={-1}>
                {r.type}: {r.targets.map((t) => t.title).join(" / ")} ·{" "}
                {r.decision?.action ?? "outdated finding"}
                {!r.current ? " · source or record changed" : ""}
              </li>
            ))}
        </ul>
      </details>
    </section>
  );
}
function Review({ r, choices, busy, act }) {
  const [target, setTarget] = useState(r.targets[0].id),
    [replacement, setReplacement] = useState("");
  const selected = r.targets.find((t) => t.id === target),
    choice = choices.find((c) => c.id === replacement);
  const submit = (action) =>
    act({
      id: r.id,
      expectedVersion: r.version,
      targetId: target,
      action,
      ...(["update", "merge", "supersede"].includes(action)
        ? { replacementId: replacement, replacementDigest: choice?.digest }
        : {}),
    });
  return (
    <article
      className="task-proposal"
      id={"finding-" + r.id}
      tabIndex={-1}
      aria-label={`Knowledge finding ${r.type}`}
    >
      <h3>{r.type}</h3>
      <p>{r.reason}</p>
      <label>
        Record to review
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setReplacement("");
          }}
        >
          {r.targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {t.state} · {t.id.slice(-6)}
            </option>
          ))}
        </select>
      </label>
      <p>{selected.content}</p>
      <details>
        <summary>Supporting quotations</summary>
        {selected.evidence.map((e, i) => (
          <blockquote key={i}>
            {e.quote}
            <p className="mono">
              {e.passageId} · {e.revisionId}
            </p>
          </blockquote>
        ))}
      </details>
      <label>
        Reviewed replacement
        <select
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
        >
          <option value="">Select a cited replacement</option>
          {choices
            .filter((c) => c.kind === selected.kind && c.id !== target)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
        </select>
      </label>
      {choice && (
        <section aria-label="Replacement preview">
          <h4>Reviewed replacement</h4>
          <p>{choice.content}</p>
          {choice.evidence.map((e, i) => (
            <blockquote key={i}>
              {e.quote}
              <p className="mono">
                {e.passageId} · {e.revisionId}
              </p>
            </blockquote>
          ))}
        </section>
      )}
      <div className="task-filters">
        {["keep", "reject", "archive", "update", "merge", "supersede"].map(
          (action) => (
            <button
              key={action}
              disabled={
                busy ||
                (["update", "merge", "supersede"].includes(action) && !choice)
              }
              onClick={() => submit(action)}
            >
              {action}
            </button>
          ),
        )}
      </div>
      <p>
        Keep or reject closes this unchanged finding. Archive removes this
        record from active views. Update, merge and supersede retire it in favor
        of the selected reviewed replacement; they do not generate or combine
        text.
      </p>
    </article>
  );
}
