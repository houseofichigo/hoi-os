import React, { useRef, useEffect } from "react";
export default function Evidence({
  data,
  error,
  onOpen,
  onClose,
  passage,
  onOriginal,
}) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    return () => previous?.focus();
  }, []);
  function keys(e) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab" || !matchMedia("(max-width:760px)").matches) return;
    const items = [
      ...panel.current.querySelectorAll("button,a[href],input,summary"),
    ];
    const first = items[0],
      last = items.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === panel.current)
    ) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  return (
    <aside
      ref={panel}
      tabIndex={-1}
      onKeyDown={keys}
      className="evidence-panel"
      aria-label="Evidence"
    >
      <div className="panel-heading">
        <h2>Evidence</h2>
        <button className="secondary" onClick={onClose}>
          Close evidence
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Select a turn to inspect its evidence.</p>
      ) : (
        <>
          <p>
            Retrieved material was supplied to the assistant. Cited passages
            were explicitly referenced in its response.
          </p>
          {data.memory?.length > 0 && (
            <section>
              <h3>Memory</h3>
              {data.memory.map((m) => (
                <article key={m.memoryId}>
                  <a
                    href={
                      "/app?view=knowledge&section=Memory&memory=" +
                      encodeURIComponent(m.memoryId)
                    }
                  >
                    Open reviewed memory
                  </a>
                  <blockquote>{m.quote}</blockquote>
                  {m.asOf && <p>Historical context · {m.asOf}</p>}
                  <p>
                    {m.attribution ?? "Attribution unknown"} ·{" "}
                    {m.cited ? "Cited" : "Supplied"}
                  </p>
                  <details>
                    <summary>Revision</summary>
                    <code>{m.memoryRevision}</code>
                  </details>
                </article>
              ))}
            </section>
          )}
          {data.wiki?.length > 0 && (
            <section>
              <h3>Wiki knowledge</h3>
              {data.wiki.map((w, i) => (
                <article key={i}>
                  <a
                    href={
                      "/app?view=knowledge&section=Wiki&wiki=" +
                      encodeURIComponent(w.wikiRevisionId)
                    }
                  >
                    {w.title}
                  </a>
                  <blockquote>{w.quote}</blockquote>
                  {w.asOf && <p>Historical context · {w.asOf}</p>}
                  <p>
                    {w.provenance} {w.author ? `· ${w.author}` : ""} ·{" "}
                    {w.cited ? "Cited" : "Supplied"}
                  </p>
                </article>
              ))}
            </section>
          )}
          {[
            ["Retrieved documents", data.supplied],
            ["Cited passages", data.cited],
          ].map(([title, items]) => (
            <section key={title}>
              <h3>{title}</h3>
              {!items.length ? (
                <p className="muted">None recorded.</p>
              ) : (
                items.map((e, i) => (
                  <article key={e.passageId}>
                    <button className="record-link" onClick={() => onOpen(e)}>
                      {e.title}
                    </button>
                    <blockquote>{e.quote}</blockquote>
                    {e.asOf && <p>Historical context · {e.asOf}</p>}
                    <p className="meta">
                      {e.authority} · {e.location || "Location unknown"}
                    </p>
                    <p className="meta">
                      Effective date: {e.freshness || "Unknown"}
                    </p>
                    {onOriginal && (
                      <button
                        className="secondary"
                        onClick={() => onOriginal(e)}
                      >
                        Open original source
                      </button>
                    )}
                    <details>
                      <summary>Revision details</summary>
                      <p className="mono">{e.revisionId}</p>
                      <p>Recorded: {e.recordedAt}</p>
                    </details>
                  </article>
                ))
              )}
            </section>
          ))}
          {data.liveRecords?.length > 0 && (
            <section>
              <h3>Live records</h3>
              {data.liveRecords.map((r) => (
                <article key={r.kind + r.id}>
                  <a
                    href={
                      r.kind === "connection"
                        ? "/app?view=configuration&section=Connections"
                        : r.kind === "event"
                          ? `/app?view=inbox&section=Calendar&event=${encodeURIComponent(r.id)}`
                          : `/app?view=${r.kind === "client" ? "clients" : r.kind === "source" ? "knowledge" : "projects"}&${r.kind}=${encodeURIComponent(r.id)}`
                    }
                  >
                    {r.title}
                  </a>
                  <p>
                    {r.cited ? "Cited" : "Supplied"} · {r.kind}
                    {r.version !== undefined ? ` · revision ${r.version}` : ""}
                  </p>
                  {r.quote && <p>{r.quote}</p>}
                  {r.coverage && <small>{r.coverage}</small>}
                  {r.freshness && <p>Freshness: {r.freshness}</p>}
                  {r.reason && <p>Why included: {r.reason}</p>}
                </article>
              ))}
            </section>
          )}
          <section>
            <h3>Related records</h3>
            {data.relatedRecords.length ? (
              data.relatedRecords.map((r) => (
                <a
                  key={r.id}
                  href={`/app?${r.kind}=${encodeURIComponent(r.id)}`}
                >
                  {r.title}
                </a>
              ))
            ) : (
              <p>None recorded.</p>
            )}
          </section>
          <section>
            <h3>Web references</h3>
            {data.web.length ? (
              <>
                <p>Assistant-supplied; not independently fetched by HOI.</p>
                {data.web.map((w, i) => (
                  <article key={i}>
                    <a href={w.url} target="_blank" rel="noreferrer">
                      {w.title}
                    </a>
                    <p>{w.snippet}</p>
                    <p>Retrieved {w.retrievedAt}</p>
                  </article>
                ))}
              </>
            ) : (
              <p>None supplied.</p>
            )}
          </section>
        </>
      )}
      {passage && (
        <section aria-label="Chat source passage">
          <h3>{passage.title}</h3>
          <p className="passage-text">{passage.text}</p>
        </section>
      )}
    </aside>
  );
}
