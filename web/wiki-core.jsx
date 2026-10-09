import React, { useState, useEffect } from "react";
import { Drawer } from "./product-ui.jsx";
const newBlock = (heading = "Notes") => ({
  id: "block_" + crypto.randomUUID().replaceAll("-", ""),
  heading,
  text: "",
  kind: "unverified",
  evidence: [],
});
const fields = [
  "title",
  "type",
  "summary",
  "aliases",
  "language",
  "tags",
  "subjects",
  "relatedPages",
  "owner",
  "effectiveDate",
  "reviewDate",
  "allowedHosts",
];
function draftOf(p) {
  const d = {};
  for (const k of fields) if (p[k] !== undefined) d[k] = p[k];
  return {
    ...d,
    pageId: p.pageId,
    expectedVersion: p.version,
    blocks: p.blocks?.map(({ author, recordedAt, ...b }) => b) ?? [
      {
        ...newBlock("Legacy content"),
        text: p.content,
        kind: "source-backed",
        evidence: p.evidence,
        evidenceScope: "page",
      },
    ],
  };
}
function Markdown({ text }) {
  return (
    <div className="wiki-reading">
      {text.split(/\n\n+/).map((p, i) =>
        p.startsWith("#") ? (
          <h3 key={i}>{p.replace(/^#+\s*/, "")}</h3>
        ) : (
          <p style={{ whiteSpace: "pre-wrap" }} key={i}>
            {p}
          </p>
        ),
      )}
    </div>
  );
}
export function WikiPanel({ api, refId, onClose, onChanged, subjectId }) {
  const [page, setPage] = useState(null),
    [draft, setDraft] = useState(null),
    [templates, setTemplates] = useState({}),
    [tags, setTags] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState("read"),
    [compare, setCompare] = useState(null),
    [history, setHistory] = useState([]),
    [links, setLinks] = useState([]),
    [citation, setCitation] = useState(null),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState([]),
    [preview, setPreview] = useState(false),
    [subjects, setSubjects] = useState([]),
    [allPages, setAllPages] = useState([]);
  const call = async (path, body) => api(path, body);
  async function load(id = refId) {
    try {
      const [t, tg] = await Promise.all([
        call("wiki-core/templates"),
        call("wiki-core/taxonomy"),
      ]);
      setTemplates(t);
      setTags(tg);
      setSubjects(await call("wiki-core/subjects"));
      setAllPages(await call("wiki-core"));
      if (id) {
        const p = await call("wiki-core/page/" + id);
        setPage(p);
        setMode("read");
        setLinks(await call("wiki-core/backlinks/" + p.pageId));
      } else {
        setDraft({
          title: "",
          type: "topic",
          summary: "",
          language: "unknown",
          tags: [],
          subjects: subjectId ? [subjectId] : [],
          aliases: [],
          relatedPages: [],
          blocks: [newBlock("Explanation")],
          expectedVersion: 0,
        });
        setMode("edit");
      }
    } catch (e) {
      setPage(null);
      setDraft(null);
      setCompare(null);
      setHistory([]);
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [refId]);
  async function action(fn) {
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
  function close() {
    if (
      mode === "edit" &&
      !window.confirm(
        "Discard unsaved wiki changes? Saved revisions remain available.",
      )
    )
      return;
    onClose();
  }
  function patchBlock(i, v) {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b, j) => (i === j ? { ...b, ...v } : b)),
    }));
  }
  async function save() {
    await action(async () => {
      const p = await call("wiki-core/save", draft);
      setPage(p);
      setDraft(null);
      setMode("read");
      onChanged?.();
    });
  }
  return (
    <Drawer title={page?.title ?? "Wiki draft"} onClose={close}>
      <header>
        <p className="eyebrow">HOI KNOWLEDGE</p>
        <h2>{page?.title ?? "Create wiki draft"}</h2>
        {page?.status === "canonical" && (
          <button
            className="secondary"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("hoi:ask-knowledge", {
                  detail: { kind: "wiki", id: page.id },
                }),
              );
              close();
            }}
          >
            Ask about this
          </button>
        )}
        <button onClick={close}>Close wiki</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {mode === "read" && page && (
        <>
          <p>
            {page.type} ·{" "}
            {page.status === "canonical" ? "Published" : page.status} ·{" "}
            {page.evidenceCurrent
              ? "Evidence current"
              : "Evidence needs review"}
            {page.legacy ? " · Legacy page-level evidence" : ""}
          </p>
          <p>{page.summary}</p>
          <div className="actions">
            <button
              onClick={() =>
                action(async () => {
                  const p = page.draftId
                    ? await call("wiki-core/page/" + page.draftId)
                    : page;
                  setDraft(draftOf(p));
                  setMode("edit");
                })
              }
            >
              Edit draft
            </button>
            <button
              onClick={() =>
                action(async () => {
                  setCompare(await call("wiki-core/compare/" + page.pageId));
                  setMode("compare");
                })
              }
            >
              Compare and publish
            </button>
            <button
              onClick={() =>
                action(async () => {
                  setHistory(await call("wiki-core/history/" + page.pageId));
                  setMode("history");
                })
              }
            >
              History
            </button>
            <a
              href={
                "?view=knowledge&section=Wiki&wiki=" +
                encodeURIComponent(page.pageId)
              }
            >
              Open page
            </a>
          </div>
          {page.blocks ? (
            page.blocks.map((b) => (
              <section className="wiki-block" key={b.id}>
                <h3>{b.heading}</h3>
                <small>
                  {b.kind === "user-authored"
                    ? `Attributed statement · ${b.author} · ${b.recordedAt}`
                    : b.kind}
                  {b.evidenceScope === "page" ? " · Page-level evidence" : ""}
                </small>
                <Markdown text={b.text} />
                {b.evidence.map((e, i) => (
                  <button
                    className="text-link"
                    key={i}
                    onClick={() => setCitation(e)}
                  >
                    {e.relation ?? "supports"} · View evidence
                  </button>
                ))}
              </section>
            ))
          ) : (
            <Markdown text={page.content} />
          )}
          <h3>Related records</h3>
          {page.records?.length ? (
            page.records.map((r) => (
              <div key={r.id}>
                <strong>{r.name ?? r.title}</strong>
                <p>
                  {r.kind} {r.status ? `· ${r.status}` : ""}{" "}
                  {r.dueDate ? `· Due ${r.dueDate}` : ""}
                </p>
                <a
                  href={
                    "?view=" +
                    (r.kind === "client" ? "clients" : "projects") +
                    "&" +
                    (r.kind === "client" ? "client" : "project") +
                    "=" +
                    encodeURIComponent(r.projectId ?? r.recordId ?? r.id)
                  }
                >
                  Open record
                </a>
                <button
                  onClick={() =>
                    action(async () => {
                      await call("wiki-core/primary", {
                        subjectId: r.id,
                        pageId: page.pageId,
                        expectedVersion: page.version,
                      });
                      await load(page.pageId);
                    })
                  }
                >
                  Set as primary wiki
                </button>
              </div>
            ))
          ) : (
            <p>No linked records.</p>
          )}
          <h3>Backlinks</h3>
          {links.length ? (
            links.map((p) => (
              <button key={p.pageId} onClick={() => load(p.pageId)}>
                {p.title}
              </button>
            ))
          ) : (
            <p>No visible backlinks.</p>
          )}
          {page.evidence?.length > 0 && (
            <details>
              <summary>Page evidence</summary>
              {page.evidence.map((e, i) => (
                <button key={i} onClick={() => setCitation(e)}>
                  Evidence {i + 1}
                </button>
              ))}
            </details>
          )}
        </>
      )}
      {mode === "edit" && draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Title
            <input
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Page type
            <select
              value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
            >
              {Object.keys(templates).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                blocks: [
                  ...draft.blocks,
                  ...templates[draft.type]
                    .filter((h) => !draft.blocks.some((b) => b.heading === h))
                    .map((h) => newBlock(h)),
                ],
              })
            }
          >
            Add template sections
          </button>
          <label>
            Summary
            <textarea
              value={draft.summary ?? ""}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <label>
            Aliases (comma separated)
            <input
              defaultValue={(draft.aliases ?? []).join(", ")}
              onBlur={(e) =>
                setDraft({
                  ...draft,
                  aliases: e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            Language
            <select
              value={draft.language ?? "unknown"}
              onChange={(e) => setDraft({ ...draft, language: e.target.value })}
            >
              {["unknown", "en", "fr", "mixed"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Topic tags
            <select
              multiple
              value={draft.tags ?? []}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  tags: Array.from(e.target.selectedOptions, (x) => x.value),
                })
              }
            >
              {tags.map((x) => (
                <option key={x.tag}>{x.tag}</option>
              ))}
            </select>
          </label>
          <label>
            Effective date
            <input
              type="date"
              value={draft.effectiveDate ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, effectiveDate: e.target.value || null })
              }
            />
          </label>
          <label>
            Next review
            <input
              type="date"
              value={draft.reviewDate ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, reviewDate: e.target.value || null })
              }
            />
          </label>
          <label>
            Linked records
            <select
              multiple
              value={draft.subjects ?? []}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  subjects: Array.from(
                    e.target.selectedOptions,
                    (x) => x.value,
                  ),
                })
              }
            >
              {subjects.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} · {r.kind}
                </option>
              ))}
            </select>
          </label>
          <label>
            Related wiki pages
            <select
              multiple
              value={draft.relatedPages ?? []}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  relatedPages: Array.from(
                    e.target.selectedOptions,
                    (x) => x.value,
                  ),
                })
              }
            >
              {allPages
                .filter((p) => p.pageId !== draft.pageId)
                .map((p) => (
                  <option key={p.pageId} value={p.pageId}>
                    {p.title}
                  </option>
                ))}
            </select>
          </label>
          <p>
            Live record status and deadlines are read from the linked records.
            Editing prose does not update them.
          </p>
          {draft.blocks.map((b, i) => (
            <fieldset key={b.id}>
              <legend>Section {i + 1}</legend>
              <label>
                Heading
                <input
                  value={b.heading}
                  onChange={(e) => patchBlock(i, { heading: e.target.value })}
                />
              </label>
              <label>
                Provenance
                <select
                  aria-label="Provenance"
                  value={b.kind}
                  onChange={(e) => patchBlock(i, { kind: e.target.value })}
                >
                  <option value="unverified">
                    Unverified proposal (draft only)
                  </option>
                  <option value="source-backed">Source-backed</option>
                  <option value="user-authored">My attributed statement</option>
                  <option value="question">Open question</option>
                </select>
              </label>
              <label>
                Markdown
                <textarea
                  aria-label="Markdown"
                  rows={6}
                  required
                  value={b.text}
                  onChange={(e) => patchBlock(i, { text: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => patchBlock(i, { text: b.text + "\n\n- " })}
              >
                Add bullet
              </button>
              <button
                type="button"
                onClick={() => {
                  setCitation({ blockIndex: i });
                  setHits([]);
                }}
              >
                Insert citation
              </button>
              <small>{b.evidence.length} citations</small>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    blocks: draft.blocks.filter((_, j) => j !== i),
                  })
                }
              >
                Remove section
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraft({ ...draft, blocks: [...draft.blocks, newBlock()] })
            }
          >
            Add section
          </button>
          <button type="button" onClick={() => setPreview(!preview)}>
            Toggle preview
          </button>
          {preview &&
            draft.blocks.map((b) => (
              <section key={b.id}>
                <h3>{b.heading}</h3>
                <Markdown text={b.text} />
              </section>
            ))}
          <button disabled={busy || !draft.blocks.length}>Save draft</button>
        </form>
      )}
      {mode === "compare" && (
        <>
          <h3>Review changes</h3>
          {compare?.after ? (
            <>
              <p>
                Review the content, metadata and evidence before publishing.
                Attributed statements are not independently verified.
              </p>
              <div className="wiki-comparison">
                {[
                  ["Published", compare.before],
                  ["Draft", compare.after],
                ].map(([label, p]) => (
                  <section key={label}>
                    <h3>{label}</h3>
                    {p ? (
                      <>
                        <h4>{p.title}</h4>
                        <Markdown text={p.content} />
                        <details>
                          <summary>Properties and evidence</summary>
                          <pre>
                            {JSON.stringify(
                              {
                                type: p.type,
                                summary: p.summary,
                                tags: p.tags,
                                aliases: p.aliases,
                                subjects: p.subjects,
                                relatedPages: p.relatedPages,
                                blocks: p.blocks,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </>
                    ) : (
                      <p>Not yet published</p>
                    )}
                  </section>
                ))}
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const p = await call("wiki-core/publish", {
                      pageId: page.pageId,
                      revisionId: compare.after.id,
                      expectedVersion: compare.version,
                      confirm: true,
                    });
                    setPage(p);
                    setMode("read");
                    onChanged?.();
                  })
                }
              >
                Publish reviewed revision
              </button>
            </>
          ) : (
            <p>No saved draft to publish.</p>
          )}
          <button onClick={() => setMode("read")}>Back to page</button>
        </>
      )}
      {mode === "history" && (
        <>
          <h3>Revision history</h3>
          {history.map((p) => (
            <section key={p.id}>
              <h4>
                {p.title} · {p.status}
              </h4>
              <time>{p.createdAt}</time>
              <Markdown text={p.content} />
              <button
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const d = await call("wiki-core/restore", {
                      revisionId: p.id,
                      expectedVersion: page.version,
                    });
                    setPage(d);
                    setMode("read");
                    onChanged?.();
                  })
                }
              >
                Restore as draft
              </button>
            </section>
          ))}
          <button onClick={() => setMode("read")}>Back to page</button>
        </>
      )}
      {citation && (
        <section role="region" aria-label="Citation inspector">
          <h3>Evidence</h3>
          {citation.blockIndex !== undefined ? (
            <>
              <label>
                Search source passages
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  action(async () =>
                    setHits(
                      (await call("retrieve?q=" + encodeURIComponent(query)))
                        .results,
                    ),
                  )
                }
              >
                Find evidence
              </button>
              {hits.map((e) => (
                <div key={e.passageId}>
                  <strong>{e.title}</strong>
                  <p>{e.quote}</p>
                  <button
                    onClick={() => {
                      const i = citation.blockIndex;
                      patchBlock(i, {
                        kind: "source-backed",
                        evidence: [
                          ...draft.blocks[i].evidence,
                          {
                            revisionId: e.revisionId,
                            passageId: e.passageId,
                            quote: e.quote,
                            relation: "supports",
                          },
                        ],
                      });
                      setCitation(null);
                    }}
                  >
                    Cite this passage
                  </button>
                </div>
              ))}
            </>
          ) : (
            <>
              <blockquote>{citation.quote}</blockquote>
              <p>
                {citation.relation} · {citation.revisionId}
              </p>
              <button
                onClick={() =>
                  action(async () => {
                    const p = await call("passage/" + citation.passageId);
                    setCitation({
                      ...citation,
                      quote: p.text ?? p.quote ?? citation.quote,
                      sourceId: p.sourceId,
                    });
                  })
                }
              >
                Recheck passage access
              </button>
              {citation.sourceId && (
                <a
                  href={
                    "/app?view=knowledge&section=Sources&source=" +
                    encodeURIComponent(citation.sourceId)
                  }
                >
                  Open source and original
                </a>
              )}
            </>
          )}
          <button onClick={() => setCitation(null)}>Close evidence</button>
        </section>
      )}
    </Drawer>
  );
}
export default function WikiLibrary({ api }) {
  const [pages, setPages] = useState([]),
    [selected, setSelected] = useState(
      new URLSearchParams(location.search).get("wiki"),
    ),
    [creating, setCreating] = useState(
      Boolean(new URLSearchParams(location.search).get("wikiSubject")),
    ),
    [q, setQ] = useState(""),
    [error, setError] = useState("");
  const load = () =>
    api("wiki-core")
      .then(setPages)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const onPop = () =>
      setSelected(new URLSearchParams(location.search).get("wiki"));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  function select(id) {
    setSelected(id);
    const u = new URL(location.href);
    if (id) u.searchParams.set("wiki", id);
    else u.searchParams.delete("wiki");
    history.pushState({}, "", u);
  }
  return (
    <>
      <h2>Wiki</h2>
      <TaxonomyEditor api={api} />
      <p>Maintained knowledge, exact evidence and attributed experience.</p>
      <div className="toolbar">
        <input
          aria-label="Search wiki pages"
          placeholder="Search titles and aliases"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={() => setCreating(true)}>Create wiki draft</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul className="row-list">
        {pages
          .filter((p) =>
            [p.title, ...(p.aliases ?? [])]
              .join(" ")
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
          .map((p) => (
            <li key={p.pageId}>
              <button className="text-link" onClick={() => select(p.pageId)}>
                {p.title}
              </button>
              <span>
                {p.status === "canonical" ? "Published" : p.status} · {p.type}
                {p.draftId ? " · Draft available" : ""}
              </span>
            </li>
          ))}
      </ul>
      {!pages.length && (
        <p>
          No pages yet. Create a cited draft or record your own attributed
          knowledge.
        </p>
      )}
      {(selected || creating) && (
        <WikiPanel
          api={api}
          subjectId={new URLSearchParams(location.search).get("wikiSubject")}
          refId={creating ? null : selected}
          onClose={() => {
            setCreating(false);
            const u = new URL(location.href);
            u.searchParams.delete("wikiSubject");
            history.replaceState({}, "", u);
            select(null);
          }}
          onChanged={load}
        />
      )}
    </>
  );
}

export function WikiLinks({ api, subjectId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (subjectId)
      api("wiki-core/node/" + subjectId)
        .then(setData)
        .catch(() => setData(null));
  }, [subjectId]);
  return data ? (
    <section>
      <h3>Associated wiki pages</h3>
      {data.pages.length ? (
        data.pages.map((p) => (
          <p key={p.pageId}>
            <a
              href={
                "/app?view=knowledge&section=Wiki&wiki=" +
                encodeURIComponent(p.pageId)
              }
            >
              {p.title}
              {data.primary?.pageId === p.pageId ? " · Primary" : ""}
            </a>
          </p>
        ))
      ) : (
        <a
          href={
            "/app?view=knowledge&section=Wiki&wikiSubject=" +
            encodeURIComponent(subjectId)
          }
        >
          Create wiki draft
        </a>
      )}
    </section>
  ) : null;
}
function TaxonomyEditor({ api }) {
  const [items, setItems] = useState([]),
    [tag, setTag] = useState(""),
    [aliases, setAliases] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState("");
  const load = () => api("wiki-core/taxonomy").then(setItems);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function save(merge) {
    try {
      setError("");
      if (merge) {
        const old = items.find((x) => x.tag === from);
        await api("wiki-core/tag-merge", {
          from,
          to,
          expectedVersion: old?.version ?? 0,
          confirm: true,
        });
      } else
        await api("wiki-core/taxonomy", {
          tag,
          aliases: aliases
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          expectedVersion: items.find((x) => x.tag === tag)?.version ?? 0,
        });
      await load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <details>
      <summary>Review topic vocabulary</summary>
      <p>
        Tags classify subjects. They do not create factual graph relationships.
        Renaming or merging preserves historical revisions.
      </p>
      {error && <p role="alert">{error}</p>}
      <ul>
        {items.map((x) => (
          <li key={x.tag}>
            {x.tag} · {x.aliases.join(", ")}{" "}
            <button
              onClick={() => {
                setTag(x.tag);
                setAliases(x.aliases.join(", "));
              }}
            >
              Edit aliases
            </button>
          </li>
        ))}
      </ul>
      <label>
        Topic tag
        <input
          placeholder="topic/new-subject"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </label>
      <label>
        French/English aliases
        <input value={aliases} onChange={(e) => setAliases(e.target.value)} />
      </label>
      <button onClick={() => save(false)}>Save reviewed topic</button>
      <label>
        Rename or merge from
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Choose tag</option>
          {items.map((x) => (
            <option key={x.tag}>{x.tag}</option>
          ))}
        </select>
      </label>
      <label>
        Target topic tag
        <input value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <button
        disabled={!from || !to}
        onClick={() => {
          if (
            window.confirm(
              `Merge ${from} into ${to}? Prior revisions will be preserved.`,
            )
          )
            save(true);
        }}
      >
        Confirm tag merge
      </button>
    </details>
  );
}
