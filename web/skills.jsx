import React, { useState, useEffect } from "react";
import { presentation, launchSkill } from "./skill-presentation.js";
import { Drawer, SkillIcon } from "./product-ui.jsx";
import { PageHeader, ViewTabs, EmptyState } from "./shell.jsx";
import {
  useSubview,
  recordRoute,
  requested,
  useLocationSearch,
} from "./destination.js";
const decode = (b) =>
  new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));
export default function Skills({ api, schemaVersion }) {
  const [tab, setTab] = useSubview(
    "skills",
    ["Discover", "My skills", "Bundled", "Workspace", "Archived"],
    "Discover",
  );
  const route = useLocationSearch();
  const [layout, setLayout] = useState("gallery"),
    [category, setCategory] = useState(""),
    [availability, setAvailability] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false),
    [managing, setManaging] = useState(false),
    [importOpen, setImportOpen] = useState(false);
  const [rows, setRows] = useState([]),
    [query, setQuery] = useState(""),
    [detail, setDetail] = useState(null),
    [markdown, setMarkdown] = useState(""),
    [name, setName] = useState(""),
    [editing, setEditing] = useState(false),
    [from, setFrom] = useState(null),
    [revision, setRevision] = useState(null),
    [preview, setPreview] = useState(null),
    [sync, setSync] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [config, setConfig] = useState(null);
  useEffect(() => {
    if (tab === "Archived") {
      setManaging(true);
      setAvailability("Disabled");
      setTab("My skills");
    } else if (tab === "Bundled" || tab === "Workspace") {
      setTab(tab === "Bundled" ? "Discover" : "My skills");
    }
  }, [tab]);
  async function load() {
    setRows(await api("skills"));
    setConfig(await api("configuration"));
  }
  useEffect(() => {
    if (schemaVersion >= 14) load().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    setDetail(null);
    setEditing(false);
    setRevision(null);
    setPreview(null);
    setSync(null);
    const n = requested("skill");
    if (n)
      api("skills/" + encodeURIComponent(n))
        .then((d) => {
          setDetail(d);
          setName(d.id);
          setRevision(d.revisions[0] ?? d.active ?? d.bundled);
        })
        .catch((e) => setError(e.message));
  }, [route]);
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
  function begin(d) {
    const r = d?.revisions[0] ?? d?.active ?? d?.bundled;
    setDetail(d);
    setName(d?.id ?? "");
    setMarkdown(
      r
        ? decode(r.payload.files["SKILL.md"])
        : "---\nname: my-skill\ndescription: Describe when to use this skill.\nengineApiVersion: 1\nrequiredOperations: []\n---\n\n# Instructions\n\n",
    );
    setFrom(r?.revisionId ?? null);
    setEditing(true);
    setPreview(null);
  }
  function closeDetails() {
    if (
      editing &&
      !window.confirm(
        "Discard the open skill draft editor? Saved revisions are preserved.",
      )
    )
      return;
    recordRoute("skill", null);
    setDetail(null);
    setEditing(false);
  }
  async function imported(file) {
    if (!file) return;
    if (file.size > 512 * 1024) throw Error("Skill package limit: 512 KiB");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    setPreview(
      await api("skills/preview", {
        filename: file.name,
        base64: btoa(binary),
        expectedVersion: detail?.version ?? 0,
      }),
    );
  }
  async function control(action, r) {
    const d = await api("skills/control", {
      name: detail.id,
      expectedVersion: detail.version,
      action,
      ...(r ? { revisionId: r.revisionId, checksum: r.checksum } : {}),
    });
    setDetail(d);
    setNotice(
      action === "activate"
        ? "Reviewed skill activated. Adapter files have not changed."
        : action === "disable"
          ? "Skill disabled for new requests. Installed assistant copies are unchanged."
          : "Bundled version restored.",
    );
  }
  if (schemaVersion < 14)
    return (
      <EmptyState title="Skill library upgrade required">
        Back up and restore a workspace copy before upgrading to schema 14.
      </EmptyState>
    );
  const stateOf = (r) =>
    !r.enabled
      ? "Disabled"
      : !r.activeRevision
        ? "Draft only"
        : !r.compatible
          ? "Incompatible"
          : "Ready";
  const mySkills = (r) =>
    r.origin === "workspace" ||
    r.draftCount > 0 ||
    (r.activeRevision && !r.activeRevision.startsWith("bundled:"));
  const selectedTab = ["Workspace", "Archived"].includes(tab)
    ? "My skills"
    : tab === "Bundled"
      ? "Discover"
      : tab;
  const inView = rows.filter(
    (r) =>
      managing ||
      (selectedTab === "Discover" ? r.origin === "bundled" : mySkills(r)),
  );
  const visible = inView.filter(
    (r) =>
      (!category || presentation(r).category === category) &&
      (!(availability || (tab === "Archived" ? "Disabled" : "")) ||
        stateOf(r) === (availability || "Disabled")) &&
      `${r.id} ${r.description} ${presentation(r).displayName}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  visible.sort((a, b) => {
    const order = [
      "hoi-chief-of-staff",
      "hoi-project-intake",
      "hoi-task-intake",
      "hoi-meeting-prep",
      "hoi-knowledge-review",
      "hoi-security",
    ];
    return (
      (order.indexOf(a.id) < 0 ? 99 : order.indexOf(a.id)) -
        (order.indexOf(b.id) < 0 ? 99 : order.indexOf(b.id)) ||
      presentation(a).displayName.localeCompare(presentation(b).displayName)
    );
  });
  return (
    <>
      <PageHeader
        eyebrow="YOUR REUSABLE WORKFLOWS"
        title="Skills"
        actions={
          <>
            <button
              onClick={() => setImportOpen(!importOpen)}
              aria-expanded={importOpen}
            >
              Import skill
            </button>
            <button
              className="secondary"
              aria-pressed={managing}
              onClick={() => setManaging(!managing)}
            >
              Manage skills
            </button>
          </>
        }
      >
        <p>
          Find the right skill for your next task, or bring your own. You choose
          what to use and activate.
        </p>
      </PageHeader>
      <ViewTabs
        label="Skill library views"
        values={["Discover", "My skills"]}
        value={selectedTab}
        onChange={(v) => {
          setTab(v);
          setManaging(false);
          setAvailability("");
        }}
      />
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="record-toolbar">
        <label>
          Search skills
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button
          className="secondary"
          aria-expanded={filtersOpen}
          aria-controls="skill-filters"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters{category || availability ? " · active" : ""}
        </button>
        <label>
          Layout
          <select
            aria-label="Skill layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            <option value="gallery">Gallery</option>
            <option value="list">List</option>
          </select>
        </label>
        {importOpen && (
          <label>
            Import package
            <input
              type="file"
              accept=".md,.zip,.skill"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files[0];
                e.target.value = "";
                act(() => imported(file));
              }}
            />
          </label>
        )}
        {importOpen && (
          <small>SKILL.md, .zip or .skill · 512 KiB maximum · 64 files</small>
        )}
      </div>
      {filtersOpen && (
        <section
          id="skill-filters"
          className="record-toolbar"
          aria-label="Skill filters"
        >
          <label>
            Category
            <select
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[...new Set(inView.map((r) => presentation(r).category))]
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </select>
          </label>
          <label>
            Availability
            <select
              aria-label="Availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
            >
              <option value="">All states</option>
              {["Ready", "Draft only", "Disabled", "Incompatible"].map((a) => (
                <option key={a} value={a}>
                  {a} (
                  {
                    inView.filter(
                      (r) =>
                        stateOf(r) === a &&
                        (!category || presentation(r).category === category),
                    ).length
                  }
                  )
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              setCategory("");
              setAvailability("");
              setQuery("");
            }}
          >
            Reset filters
          </button>
        </section>
      )}
      <p className="meta" role="status">
        {visible.length} of {inView.length} skills ·{" "}
        {managing
          ? "Managing all skills — open a skill to edit, activate or restore it."
          : selectedTab === "Discover"
            ? "Curated by House of Ichigo"
            : "Your imports and workspace overrides"}
      </p>
      {preview && (
        <section className="skill-review" aria-label="Skill import preview">
          <h2>Review {preview.name}</h2>
          <p>{preview.warning}</p>
          <p>
            Origin: Local import · {preview.filename} · {preview.bytes} bytes
          </p>
          <details>
            <summary>Instructions to review</summary>
            <pre className="skill-instructions">{preview.instructions}</pre>
          </details>
          <details>
            <summary>Checksum and validation</summary>
            <p className="meta">{preview.checksum}</p>
            <p>
              Package layout, paths and size limits checked. This is not a
              security certification.
            </p>
          </details>
          <ul>
            {preview.files.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p>
            {preview.compatibility.compatible
              ? "Compatible engine requirements"
              : "Incompatible engine requirements; activation will be blocked"}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                const d = await api("skills/commit", {
                  id: preview.id,
                  digest: preview.digest,
                });
                setPreview(null);
                setDetail(d);
                setRevision(d.revisions[0]);
                recordRoute("skill", d.id);
                setNotice(
                  "Original preserved. Draft imported; review it before activation.",
                );
              })
            }
          >
            Import reviewed draft
          </button>
          <button className="secondary" onClick={() => setPreview(null)}>
            Cancel import
          </button>
        </section>
      )}
      <div className="skills-layout">
        <div className={"skill-list skill-" + layout}>
          {!visible.length && (
            <EmptyState title="No matching skills">
              Change your filters or import a skill to review.
            </EmptyState>
          )}
          {visible.map((r) => {
            const p = presentation(r),
              usable = r.enabled && r.activeRevision && r.compatible;
            return (
              <article key={r.id} className="skill-tile">
                <div className="skill-cover" aria-hidden="true">
                  <SkillIcon kind={p.icon} />
                  <span>{p.category}</span>
                  <div className="skill-cover-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className="skill-tile-head">
                  <h2>
                    <button
                      className="record-link"
                      onClick={() => recordRoute("skill", r.id)}
                    >
                      {p.displayName}
                    </button>
                  </h2>
                </div>
                <p className="skill-purpose">{p.shortDescription}</p>
                <div className="skill-publisher">
                  {r.origin === "bundled"
                    ? "House of Ichigo"
                    : "Workspace import · publisher unverified"}
                </div>
                <span
                  className={
                    "workspace-status " + (usable ? "ready" : "warning")
                  }
                >
                  {!r.enabled
                    ? "Disabled"
                    : !r.activeRevision
                      ? "Draft only"
                      : !r.compatible
                        ? "Incompatible"
                        : "Ready"}
                </span>
                {!usable && (
                  <small>
                    {!r.enabled
                      ? "Restore this skill before using it."
                      : !r.activeRevision
                        ? "Review and activate a revision first."
                        : "Required engine operations or version are unavailable."}
                  </small>
                )}
                {r.id === "hoi-project-intake" && (
                  <small>
                    Project Action requires separate integration. This skill
                    prepares a brief.
                  </small>
                )}
                <div className="skill-tile-actions">
                  {" "}
                  <button
                    className="secondary"
                    disabled={!usable}
                    onClick={() => launchSkill(r.id)}
                  >
                    Use skill
                  </button>
                  <button
                    className="secondary"
                    onClick={() => recordRoute("skill", r.id)}
                  >
                    {managing ? "Manage" : "Details"}
                  </button>
                </div>
                {p.examples.length > 0 && (
                  <div className="skill-examples">
                    <span>Example requests</span>
                    {p.examples.map((x, i) => (
                      <button
                        className="secondary"
                        disabled={!usable}
                        key={i}
                        onClick={() => launchSkill(r.id, i)}
                      >
                        {x}
                        <span aria-hidden="true"> ↗</span>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {(detail || editing) && (
          <Drawer title="Skill details" onClose={closeDetails}>
            <section className="skill-detail" aria-label="Skill details">
              <button className="secondary" onClick={closeDetails}>
                Close skill
              </button>
              <h2>{detail?.id ?? "New workspace skill"}</h2>
              {detail && (
                <>
                  <p>
                    {detail.origin} · record version {detail.version} ·{" "}
                    {detail.enabled ? "Enabled" : "Disabled"}
                  </p>
                  <div className="record-toolbar">
                    <button className="secondary" onClick={() => begin(detail)}>
                      Edit draft
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || !detail.enabled}
                      onClick={() => act(() => control("disable"))}
                    >
                      Disable
                    </button>
                    {detail.bundled && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => act(() => control("revert"))}
                      >
                        Revert to bundled
                      </button>
                    )}
                  </div>
                  <label>
                    Inspect revision
                    <select
                      aria-label="Inspect revision"
                      value={revision?.revisionId ?? ""}
                      onChange={(e) =>
                        setRevision(
                          [detail.bundled, ...detail.revisions].find(
                            (r) => r?.revisionId === e.target.value,
                          ),
                        )
                      }
                    >
                      {[detail.bundled, ...detail.revisions]
                        .filter(Boolean)
                        .map((r) => (
                          <option key={r.revisionId} value={r.revisionId}>
                            {r.payload.origin} · {r.createdAt ?? "Bundled"} ·{" "}
                            {r.revisionId === detail.active?.revisionId
                              ? "Active"
                              : "Not active"}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      const d = await api("skills/draft", {
                        name,
                        expectedVersion: detail?.version ?? 0,
                        markdown,
                        ...(from ? { fromRevision: from } : {}),
                      });
                      setDetail(d);
                      setRevision(d.revisions[0]);
                      setEditing(false);
                      recordRoute("skill", d.id);
                      setNotice("Draft saved. Review and activate separately.");
                    });
                  }}
                >
                  <label>
                    Skill name
                    <input
                      required
                      value={name}
                      disabled={!!detail}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Skill instructions
                    <textarea
                      aria-label="Skill instructions"
                      required
                      rows={18}
                      maxLength={128000}
                      value={markdown}
                      onChange={(e) => setMarkdown(e.target.value)}
                    />
                  </label>
                  <p>
                    Keep the frontmatter name equal to the skill name. Editing
                    bundled instructions creates a workspace override.
                  </p>
                  <button disabled={busy}>Save draft</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditing(false)}
                  >
                    Cancel edit
                  </button>
                </form>
              ) : (
                revision && (
                  <>
                    <p>{revision.payload.manifest.description}</p>
                    <p>
                      Engine API: {revision.payload.manifest.engineApiVersion} ·
                      Required operations:{" "}
                      {revision.payload.manifest.requiredOperations.join(
                        ", ",
                      ) || "None declared"}
                    </p>
                    <pre className="skill-instructions">
                      {decode(revision.payload.files["SKILL.md"])}
                    </pre>
                    <details>
                      <summary>Supporting files</summary>
                      {Object.entries(revision.payload.files)
                        .filter(([p]) => p !== "SKILL.md")
                        .map(([p, b]) => (
                          <details key={p}>
                            <summary>{p}</summary>
                            <pre>
                              {/\.(md|txt|json|yaml|yml|js|ts|py|sh|csv)$/i.test(
                                p,
                              )
                                ? decode(b)
                                : "Binary file preserved; not executed or rendered."}
                            </pre>
                          </details>
                        ))}
                    </details>
                    <details>
                      <summary>Compare with active version</summary>
                      <div className="skill-diff">
                        <div>
                          <h3>Active</h3>
                          <pre>
                            {detail?.active
                              ? decode(detail.active.payload.files["SKILL.md"])
                              : "No active version"}
                          </pre>
                        </div>
                        <div>
                          <h3>Selected revision</h3>
                          <pre>
                            {decode(revision.payload.files["SKILL.md"])}
                          </pre>
                        </div>
                      </div>
                    </details>
                    {!revision.revisionId.startsWith("bundled:") && (
                      <button
                        disabled={
                          busy ||
                          detail.active?.revisionId === revision.revisionId
                        }
                        onClick={() => act(() => control("activate", revision))}
                      >
                        Activate reviewed revision
                      </button>
                    )}
                    <p className="meta">Checksum: {revision.checksum}</p>
                  </>
                )
              )}
              {detail && (
                <>
                  <h3>Adapter installation</h3>
                  {config?.adapters.map((a) => (
                    <p key={a.host}>
                      {a.host}: {a.status}{" "}
                      <button
                        className="secondary"
                        disabled={busy || !detail.active}
                        onClick={() =>
                          act(async () =>
                            setSync(
                              await api("skills/sync-preview", {
                                name: detail.id,
                                host: a.host,
                              }),
                            ),
                          )
                        }
                      >
                        Preview {a.host} sync
                      </button>
                    </p>
                  ))}
                  {sync && (
                    <section aria-label="Skill adapter preview">
                      <p>
                        Sync the active revision to {sync.host}. A verified
                        backup is taken before writing.
                      </p>
                      {sync.targets.map((t) => (
                        <p key={t.path}>
                          {t.path}:{" "}
                          {t.conflict
                            ? "Conflict — custom file preserved"
                            : t.current === t.desired
                              ? "Already matching"
                              : "Will update"}
                        </p>
                      ))}
                      <button
                        disabled={busy || sync.targets.some((t) => t.conflict)}
                        onClick={() =>
                          act(async () => {
                            await api("skills/sync", {
                              name: sync.name,
                              host: sync.host,
                              digest: sync.digest,
                            });
                            setSync(null);
                            setNotice(
                              "Adapter skill synchronized after verified backup.",
                            );
                          })
                        }
                      >
                        Confirm adapter sync
                      </button>
                    </section>
                  )}
                  <details>
                    <summary>Version and activation history</summary>
                    {detail.history.map((r, i) => (
                      <p key={i}>
                        {r.at} · {r.action} ·{" "}
                        {r.revisionId || "Bundled / disabled"}
                      </p>
                    ))}
                  </details>
                </>
              )}
            </section>
          </Drawer>
        )}
      </div>
    </>
  );
}
