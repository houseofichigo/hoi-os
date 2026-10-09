import { TurnResults } from "./activity.jsx";
import { Popover } from "radix-ui";
import React, { useState, useEffect, useRef } from "react";
import { PageHeader, EmptyState } from "./shell.jsx";
import { useLocationSearch, recordRoute } from "./destination.js";
import Evidence from "./evidence.jsx";
import ChatUpload from "./chat-upload.jsx";
import { presentation, chatDrafts } from "./skill-presentation.js";
import { navigate } from "./destination.js";
import { Drawer } from "./product-ui.jsx";
function ComposerIcon({ kind }) {
  const paths = {
    attach: "M8 12l7-7a3 3 0 014 4L9 19a5 5 0 01-7-7L12 2 M6 14l9-9",
    history: "M3 11a9 9 0 119 10 M3 4v7h7 M12 7v6l4 2",
    assistant: "M8 4h8v4h4v12H4V8h4z M8 12h1 M15 12h1 M8 16h8",
    context: "M3 7V5h7l2 2h9v13H3z",
    send: "M19 4v9H5 M10 8l-5 5 5 5",
    stop: "M6 6h12v12H6z",
    plus: "M12 4v16 M4 12h16",
    close: "M6 6l12 12 M6 18L18 6",
    mail: "M3 5h18v14H3z M3 5l9 8 9-8",
    calendar: "M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind] || paths.context} />
    </svg>
  );
}
function ComposerMenu({ label, icon, text, children, open, onOpenChange }) {
  const [narrow, setNarrow] = useState(innerWidth <= 760);
  useEffect(() => {
    const m = matchMedia("(max-width:760px)");
    const change = () => setNarrow(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  return (
    <Popover.Root modal={narrow} open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={"composer-control " + (!text ? "icon-only" : "")}
          aria-label={label}
          title={label}
        >
          <ComposerIcon kind={icon} />
          {text && <span>{text}</span>}
          {label === "Assistant" && <span aria-hidden="true">⌄</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="composer-menu"
          sideOffset={8}
          align="start"
          aria-label={label}
        >
          <h3>{label}</h3>
          {children}
          <Popover.Close className="secondary" aria-label={"Close " + label}>
            Done
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
function Answer({ text }) {
  return (
    <div className="chat-answer">
      {text
        .split(/\n\s*\n/)
        .map((p, i) =>
          p.startsWith("#") ? (
            <h3 key={i}>{p.replace(/^#+\s*/, "")}</h3>
          ) : (
            <p key={i}>{p}</p>
          ),
        )}
    </div>
  );
}
export default function Chat({ api, token, schemaVersion, entry = null }) {
  const search = useLocationSearch(),
    cid = entry ? null : new URLSearchParams(search).get("conversation");
  const [list, setList] = useState([]),
    [conversation, setConversation] = useState(null),
    [projects, setProjects] = useState([]),
    [project, setProject] = useState(""),
    [host, setHost] = useState("codex"),
    [message, setMessage] = useState(""),
    [query, setQuery] = useState(""),
    [web, setWeb] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [response, setResponse] = useState(""),
    [handoff, setHandoff] = useState(false),
    [selected, setSelected] = useState(null),
    [evidence, setEvidence] = useState(null),
    [evidenceError, setEvidenceError] = useState(""),
    [passage, setPassage] = useState(null),
    [showEvidence, setShowEvidence] = useState(false),
    [showList, setShowList] = useState(!!cid && innerWidth >= 1024),
    [rename, setRename] = useState(null),
    [archived, setArchived] = useState(false),
    [notice, setNotice] = useState("");
  const [skills, setSkills] = useState([]),
    [skillName, setSkillName] = useState(""),
    [documents, setDocuments] = useState([]),
    [sources, setSources] = useState([]),
    [connections, setConnections] = useState([]),
    [contextOpen, setContextOpen] = useState(false),
    [showConnectors, setShowConnectors] = useState(true),
    [historyOpen, setHistoryOpen] = useState(false),
    [knowledge, setKnowledge] = useState([]);
  const [scope, setScope] = useState(
      entry === "knowledge" ? "knowledge" : "workspace",
    ),
    [mode, setMode] = useState(""),
    [providers, setProviders] = useState([]),
    [job, setJob] = useState(null);
  const sendIdentity = useRef(null);
  const listPanel = useRef(null);
  useEffect(() => {
    const narrow = matchMedia("(max-width:760px)");
    const collapse = () => {
      if (narrow.matches) setShowList(false);
    };
    narrow.addEventListener("change", collapse);
    return () => narrow.removeEventListener("change", collapse);
  }, []);
  useEffect(() => {
    if (!showList || !matchMedia("(max-width:760px)").matches) return;
    const previous = document.activeElement;
    listPanel.current?.focus();
    return () => previous?.focus();
  }, [showList]);
  function listKeys(e) {
    if (e.key !== "Tab" || !matchMedia("(max-width:760px)").matches) return;
    const items = [...listPanel.current.querySelectorAll("button,input")],
      first = items[0],
      last = items.at(-1);
    if (
      e.shiftKey &&
      [first, listPanel.current].includes(document.activeElement)
    ) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  useEffect(() => {
    if (entry !== "knowledge") return;
    const attach = (e) => {
      const r = e.detail;
      if (r.kind === "source")
        setDocuments((old) =>
          [
            ...old.filter((d) => d.sourceId !== r.id),
            { sourceId: r.id, revisionId: r.revisionId },
          ].slice(0, 10),
        );
      else
        setKnowledge((old) =>
          [
            ...old.filter((d) => d.id !== r.id),
            { kind: r.kind, id: r.id },
          ].slice(0, 10),
        );
      requestAnimationFrame(() => {
        composer.current?.scrollIntoView({ block: "center" });
        composer.current?.focus();
      });
    };
    window.addEventListener("hoi:ask-knowledge", attach);
    return () => window.removeEventListener("hoi:ask-knowledge", attach);
  }, [entry]);
  const [launchPending, setLaunchPending] = useState(null);
  const launchHandled = useRef(false);
  useEffect(() => {
    const d = chatDrafts.get(token + (entry || "chat"));
    if (d) {
      setMessage(d.message);
      setProject(d.project);
      setHost(d.host);
      setSkillName(d.skillName);
      setWeb(d.web);
      setDocuments(d.documents || []);
      setKnowledge(d.knowledge || []);
      setScope(d.scope || (entry === "knowledge" ? "knowledge" : "workspace"));
      setMode(d.mode || "");
    }
  }, []);
  useEffect(() => {
    chatDrafts.set(token + (entry || "chat"), {
      message,
      project,
      host,
      skillName,
      web,
      documents,
      knowledge,
      scope,
      mode,
    });
  }, [
    message,
    project,
    host,
    skillName,
    web,
    documents,
    knowledge,
    scope,
    mode,
  ]);
  function acceptLaunch(l) {
    setMessage(l.text);
    setSkillName(l.id);
    setLaunchPending(null);
    const q = new URLSearchParams(location.search);
    q.delete("launchSkill");
    q.delete("starter");
    history.replaceState(null, "", `/app?${q}`);
    composer.current?.focus();
  }
  useEffect(() => {
    const q = new URLSearchParams(search),
      id = q.get("launchSkill");
    if (!id || !skills.length || launchHandled.current) return;
    launchHandled.current = true;
    const sk = skills.find((x) => x.id === id);
    if (!sk || !sk.enabled || !sk.activeRevision || !sk.compatible) {
      setError("This skill is unavailable for a new request.");
      return;
    }
    const starter = q.get("starter"),
      p = presentation(sk),
      l = {
        id,
        text: starter === null ? "" : p.examples[Number(starter)] || "",
      };
    if (chatDrafts.get(token + (entry || "chat"))?.message?.trim())
      setLaunchPending(l);
    else acceptLaunch(l);
  }, [skills, search]);
  const alive = useRef(0),
    composer = useRef(null);
  useEffect(() => {
    const el = composer.current;
    if (el) {
      el.style.height = "50px";
      el.style.height = Math.min(200, el.scrollHeight) + "px";
    }
  }, [message]);
  const turns = conversation?.turns ?? [],
    last = turns.at(-1),
    waiting = last?.state === "awaiting-assistant";
  async function refresh() {
    setList(await api("conversations"));
  }
  useEffect(() => {
    if (schemaVersion >= 16) {
      api("ai/status")
        .then((r) => setProviders(r.providers))
        .catch(() => {});
      api("onboarding")
        .then((r) => {
          if (["openai", "anthropic"].includes(r.assistant))
            setMode((old) => old || r.assistant);
        })
        .catch(() => {});
    }
    api("projects")
      .then(setProjects)
      .catch((e) => setError(e.message));
    if (schemaVersion >= 14) {
      api("skills")
        .then(setSkills)
        .catch((e) => setError(e.message));
      api("hub/sources")
        .then(setSources)
        .catch((e) => setError(e.message));
      api("sync")
        .then(setConnections)
        .catch(() => setConnections([]));
    }
    if (schemaVersion >= 13) refresh().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const generation = ++alive.current;
    if (cid) setDocuments([]);
    if (cid) setSkillName("");
    setContextOpen(false);
    setConversation(null);
    setEvidence(null);
    setPassage(null);
    setSelected(null);
    setResponse("");
    setHandoff(false);
    setError("");
    if (cid)
      api(`conversations/${cid}`)
        .then((c) => {
          if (generation === alive.current) {
            setConversation(c);
            setProject(c.projectId ?? "");
            if (c.host !== "local") setHost(c.host);
            if (c.context) {
              setScope(c.context.scope);
              setMode(c.context.provider);
            }
            if (schemaVersion >= 16)
              api("ai/status")
                .then((r) =>
                  setJob(
                    r.jobs.find((j) => j.runId === c.turns.at(-1)?.id) || null,
                  ),
                )
                .catch(() => {});
            setHandoff(c.turns.at(-1)?.state === "awaiting-assistant");
          }
        })
        .catch((e) => setError(e.message));
    return () => {
      alive.current++;
    };
  }, [cid]);
  // Poll genuine execution state only. There is no token-stream simulation.
  useEffect(() => {
    if (!cid || !waiting) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const c = await api(`conversations/${cid}`);
        if (!stopped) {
          setConversation(c);
          const status = await api("ai/status");
          const latestJob = status.jobs.find(
            (j) => j.runId === c.turns.at(-1)?.id,
          );
          const detail = latestJob ? await api(`ai/job/${latestJob.id}`) : null;
          if (!stopped) setJob(detail);
          if (c.turns.at(-1)?.state !== "awaiting-assistant") {
            setHandoff(false);
            refresh();
          }
        }
      } catch (e) {
        if (!stopped) {
          setConversation(null);
          setEvidence(null);
          setPassage(null);
          setError(e.message);
        }
      }
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [cid, waiting]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
      if (/unavailable|denied|CONTEXT_CHANGED/i.test(e.message)) {
        setConversation(null);
        setEvidence(null);
        setPassage(null);
      }
    } finally {
      setBusy(false);
    }
  }
  function fresh() {
    setDocuments([]);
    setSkillName("");
    setContextOpen(false);
    recordRoute("conversation", null);
    setConversation(null);
    setSelected(null);
    setEvidence(null);
    setPassage(null);
    setResponse("");
    setHandoff(false);
    setRename(null);
    setJob(null);
    composer.current?.focus();
  }
  async function inspect(t) {
    setSelected(t.id);
    setShowEvidence(true);
    setEvidence(null);
    setPassage(null);
    setEvidenceError("");
    try {
      setEvidence(await api(`chat/evidence/${t.id}`));
    } catch (e) {
      setEvidenceError(
        "Evidence is no longer available. Refresh the conversation to recheck access.",
      );
      setConversation(null);
    }
  }
  async function openPassage(e) {
    setPassage(null);
    try {
      setPassage(await api(`passage/${e.passageId}`));
    } catch {
      setEvidence(null);
      setEvidenceError("This passage is no longer available.");
    }
  }
  const composerView = (
    <form
      className="chat-composer connected-composer"
      onSubmit={(e) => {
        e.preventDefault();
        act(async () => {
          if (
            skillName &&
            !skills.some(
              (x) =>
                x.id === skillName &&
                x.enabled &&
                x.activeRevision &&
                x.compatible,
            )
          )
            throw Error(
              "Select an available skill before preparing a request.",
            );
          if (mode !== "handoff") {
            if (!["openai", "anthropic"].includes(mode))
              throw Error(
                "Choose and configure an assistant in Configuration → Assistant and search.",
              );
            if (schemaVersion < 17)
              throw Error(
                "Connected Chat requires a backed-up workspace upgrade to schema 17.",
              );
            const draft = {
              origin: entry || "chat",
              scope,
              message,
              host,
              provider: mode,
              maxCost: 0.25,
              documents,
              knowledge,
              ...(project ? { projectId: project } : {}),
              ...(conversation
                ? {
                    conversationId: conversation.id,
                    expectedVersion: conversation.version,
                  }
                : {}),
              ...(skillName
                ? {
                    skill: (() => {
                      const x = skills.find((x) => x.id === skillName);
                      return {
                        name: x.id,
                        revisionId: x.activeRevision,
                        checksum: x.checksum,
                      };
                    })(),
                  }
                : {}),
            };
            const fingerprint = JSON.stringify(draft);
            if (sendIdentity.current?.fingerprint !== fingerprint)
              sendIdentity.current = { fingerprint, key: crypto.randomUUID() };
            const sent = await api("chat/send", {
              ...draft,
              requestKey: sendIdentity.current.key,
            });
            setMessage("");
            setDocuments([]);
            setKnowledge([]);
            sendIdentity.current = null;
            chatDrafts.delete(token + (entry || "chat"));
            navigate("chat");
            recordRoute("conversation", sent.conversationId);
            setJob({ id: sent.jobId, state: sent.state });
            return;
          }
          let c = conversation;
          if (!c)
            c = await api("conversations/create", {
              title: "New conversation",
              scope,
              origin: entry || "chat",
              host,
              ...(project ? { projectId: project } : {}),
            });
          const next = await api("conversations/append", {
            id: c.id,
            expectedVersion: c.version,
            message,
            documents,
            knowledge,
            ...(skillName
              ? {
                  skill: (() => {
                    const x = skills.find((x) => x.id === skillName);
                    return {
                      name: x.id,
                      revisionId: x.activeRevision,
                      checksum: x.checksum,
                    };
                  })(),
                }
              : {}),
            ...(web ? { webQuery: web } : {}),
          });
          if (entry) navigate("chat");
          if (cid !== c.id) recordRoute("conversation", c.id);
          setConversation(next);
          setMessage("");
          setWeb("");
          setHandoff(true);
        });
      }}
    >
      <label>
        Your message
        <textarea
          ref={composer}
          aria-label="Your message"
          required
          rows={1}
          maxLength={8000}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            e.target.style.height = "50px";
            e.target.style.height = Math.min(200, e.target.scrollHeight) + "px";
          }}
          placeholder="Ask anything — notes, emails, meetings…"
        />
      </label>
      <div className="context-chips">
        {knowledge.map((k) => (
          <button
            type="button"
            className="secondary"
            key={k.id}
            onClick={() =>
              setKnowledge((old) => old.filter((x) => x.id !== k.id))
            }
          >
            Selected {k.kind} ×
          </button>
        ))}
        {documents.map((d) => (
          <button
            type="button"
            className="secondary"
            key={d.sourceId}
            onClick={() =>
              setDocuments(documents.filter((x) => x.sourceId !== d.sourceId))
            }
          >
            {sources.find((s) => s.id === d.sourceId)?.title ||
              "Selected document"}{" "}
            ×
          </button>
        ))}
        {skillName && (
          <button
            type="button"
            className="secondary"
            onClick={() => setSkillName("")}
          >
            {
              presentation(
                skills.find((x) => x.id === skillName) || {
                  id: skillName,
                },
              ).displayName
            }{" "}
            ×
          </button>
        )}
      </div>
      <div className="composer-footer">
        <ComposerMenu
          label="Add context"
          icon="attach"
          open={contextOpen}
          onOpenChange={setContextOpen}
        >
          {" "}
          <section className="context-picker" aria-label="Choose context">
            <p>
              Relevant permitted knowledge is retrieved automatically.
              Attachments supply up to five passages per document; the context
              budget still applies.
            </p>
            <ChatUpload
              key={project + host}
              api={api}
              token={token}
              projectEntity={projects.find((p) => p.id === project)?.entity_id}
              capacity={10 - documents.length}
              onAttached={async (result, stillCurrent) => {
                const refreshed = await api("hub/sources");
                if (!stillCurrent()) return;
                setSources(refreshed);
                const source = refreshed.find(
                  (x) => x.id === result.sourceId && x.state === "active",
                );
                if (
                  result.status === "ready" &&
                  source &&
                  (!project ||
                    !source.metadata.project ||
                    source.metadata.project ===
                      projects.find((p) => p.id === project)?.entity_id)
                )
                  setDocuments((old) =>
                    old.some((x) => x.sourceId === source.id)
                      ? old
                      : [
                          ...old,
                          {
                            sourceId: source.id,
                            revisionId: source.currentRevision,
                          },
                        ].slice(0, 10),
                  );
              }}
            />
            {sources
              .filter(
                (x) =>
                  x.state === "active" &&
                  (!project ||
                    !x.metadata.project ||
                    x.metadata.project ===
                      projects.find((p) => p.id === project)?.entity_id),
              )
              .map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={documents.some((d) => d.sourceId === x.id)}
                    disabled={
                      !documents.some((d) => d.sourceId === x.id) &&
                      documents.length >= 10
                    }
                    onChange={() =>
                      setDocuments(
                        documents.some((d) => d.sourceId === x.id)
                          ? documents.filter((d) => d.sourceId !== x.id)
                          : [
                              ...documents,
                              {
                                sourceId: x.id,
                                revisionId: x.currentRevision,
                              },
                            ],
                      )
                    }
                  />
                  {x.title}
                </label>
              ))}
            <h3>Connection availability</h3>
            {connections.length ? (
              connections.map((c) => (
                <p key={c.id}>
                  {c.label}: {c.state} · last successful sync{" "}
                  {c.lastSuccess || "Unknown"}
                </p>
              ))
            ) : (
              <p>No connected source coverage established.</p>
            )}
          </section>
        </ComposerMenu>
        <ComposerMenu
          label="Conversation history"
          icon="history"
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        >
          <label>
            Search conversations
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          {list
            .filter(
              (c) =>
                c.state !== "archived" &&
                c.title.toLowerCase().includes(query.toLowerCase()),
            )
            .map((c) => (
              <button
                type="button"
                className="conversation-item secondary"
                key={c.id}
                onClick={() => {
                  setHistoryOpen(false);
                  navigate("chat");
                  recordRoute("conversation", c.id);
                }}
              >
                {c.title}
              </button>
            ))}
          {!list.length && <p>No saved conversations yet.</p>}
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setHistoryOpen(false);
              fresh();
              navigate("chat");
            }}
          >
            New conversation
          </button>
        </ComposerMenu>
        <ComposerMenu
          label="Assistant"
          icon="assistant"
          text={
            mode === "handoff"
              ? "Handoff"
              : mode === "openai"
                ? "OpenAI"
                : mode === "anthropic"
                  ? "Anthropic"
                  : "Assistant"
          }
        >
          {" "}
          <label>
            Assistant
            <select
              aria-label="Response mode"
              value={mode}
              onChange={(e) => {
                if (conversation) fresh();
                setMode(e.target.value);
              }}
            >
              <option value="">Choose assistant</option>
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>
                  {p.provider}
                  {p.model ? ` · ${p.model}` : " · setup required"}
                </option>
              ))}
              <option value="handoff">Codex / Claude handoff</option>
            </select>
          </label>
          {mode === "handoff" && (
            <label>
              Assistant host
              <select
                value={host}
                onChange={(e) => {
                  fresh();
                  setHost(e.target.value);
                }}
              >
                <option value="codex">Codex</option>
                <option value="claude">Claude</option>
              </select>
            </label>
          )}
          <p className="meta">
            {mode === "handoff"
              ? "Explicit assistant handoff."
              : "Maximum estimate $0.25 per request. No automatic provider switching."}
          </p>
        </ComposerMenu>
        <span className="composer-divider" aria-hidden="true" />
        <ComposerMenu label="Context" icon="context" text="Context">
          {" "}
          <div className="composer-scope">
            <label>
              Context
              <select
                aria-label="Context scope"
                value={scope}
                onChange={(e) => {
                  if (conversation) fresh();
                  setScope(e.target.value);
                }}
              >
                <option value="workspace">Workspace-wide</option>
                <option value="knowledge">HOI Brain</option>
              </select>
            </label>
            <label>
              Chat project
              <select
                aria-label="Chat project"
                value={project}
                onChange={(e) => {
                  fresh();
                  setProject(e.target.value);
                }}
              >
                <option value="">Whole workspace</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Skill — project or to-do
              <select
                aria-label="Selected skill"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              >
                <option value="">No skill</option>
                {skills
                  .filter((x) => x.enabled && x.activeRevision)
                  .map((x) => (
                    <option key={x.id} value={x.id} disabled={!x.compatible}>
                      {x.id === "hoi-project-intake"
                        ? "Project brief · hoi-project-intake"
                        : x.id === "hoi-task-intake"
                          ? "To-do proposal · hoi-task-intake"
                          : presentation(x).displayName}
                      {x.compatible ? "" : " — incompatible"}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {mode === "handoff" && (
            <details>
              <summary>Optional web research</summary>
              <label>
                Exact public web query
                <input
                  value={web}
                  maxLength={500}
                  onChange={(e) => setWeb(e.target.value)}
                />
              </label>
              <p>
                Your assistant may search only this query. HOI does not search
                automatically.
              </p>
            </details>
          )}
          <label>
            <input
              type="checkbox"
              checked={showConnectors}
              onChange={(e) => setShowConnectors(e.target.checked)}
            />{" "}
            Show connectors
          </label>
        </ComposerMenu>
        {waiting && job ? (
          <button
            className="composer-send"
            aria-label={
              ["queued", "running"].includes(job.state)
                ? "Cancel generation"
                : "Close request"
            }
            type="button"
            disabled={busy}
            onClick={() =>
              act(async () => {
                if (["queued", "running"].includes(job.state))
                  await api("ai/cancel", { id: job.id });
                await api("chat/cancel", { runId: last.id });
                setConversation(await api(`conversations/${cid}`));
                setJob(null);
              })
            }
          >
            <ComposerIcon kind="stop" />
          </button>
        ) : (
          <button
            className="composer-send"
            aria-label={mode === "handoff" ? "Prepare request" : "Send"}
            title={mode === "handoff" ? "Prepare request" : "Send"}
            disabled={
              !message.trim() ||
              busy ||
              waiting ||
              conversation?.state === "archived"
            }
          >
            <ComposerIcon kind="send" />
          </button>
        )}
      </div>
      {showConnectors && (
        <div className="composer-connections">
          <button
            type="button"
            className="connector-label"
            onClick={() => navigate("configuration", "Connections")}
          >
            Connectors
          </button>
          <div className="connector-icons">
            {connections.length ? (
              connections.map((c) => (
                <button
                  type="button"
                  className="composer-control icon-only"
                  key={c.id}
                  aria-label={`${c.label || c.provider}: ${c.state}`}
                  title={`${c.label || c.provider} · ${c.state} · Last sync: ${c.lastSuccess || "Unknown"}`}
                  onClick={() => navigate("configuration", "Connections")}
                >
                  <ComposerIcon
                    kind={
                      c.provider.includes("gmail")
                        ? "mail"
                        : c.provider.includes("calendar")
                          ? "calendar"
                          : "context"
                    }
                  />
                </button>
              ))
            ) : (
              <span className="connector-empty">No connections</span>
            )}
            <button
              type="button"
              className="composer-control icon-only"
              aria-label="Add connection"
              title="Add connection"
              onClick={() => navigate("configuration", "Connections")}
            >
              <ComposerIcon kind="plus" />
            </button>
            <button
              type="button"
              className="composer-control icon-only connector-hide"
              aria-label="Hide connectors"
              onClick={() => setShowConnectors(false)}
            >
              <ComposerIcon kind="close" />
            </button>
          </div>
        </div>
      )}
    </form>
  );
  if (entry)
    return (
      <section
        className={`chat-entry chat-entry-${entry}`}
        aria-label={`${entry} chat`}
      >
        <h2>
          {entry === "knowledge"
            ? "Ask your HOI Brain."
            : "Ask your Chief of Staff…"}
        </h2>
        {error && (
          <p role="alert">
            {error}{" "}
            <button
              className="text-link"
              onClick={() => navigate("configuration", "Assistant and search")}
            >
              Assistant settings
            </button>
          </p>
        )}
        {composerView}
        <div className="chat-starters">
          {[
            "Prepare my next meeting",
            "Review my priorities",
            "Turn a transcript into actions",
          ].map((text) => (
            <button
              className="secondary"
              key={text}
              onClick={() => setMessage(text)}
            >
              {text}
            </button>
          ))}
        </div>
      </section>
    );
  if (schemaVersion < 13)
    return (
      <EmptyState title="Conversation upgrade required">
        Take a verified backup and restore rehearsal, then upgrade this
        workspace to use persistent conversations.
      </EmptyState>
    );
  return (
    <div
      className={`chat-workspace ${!turns.length ? "chat-empty" : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setShowList(false);
          setShowEvidence(false);
          setContextOpen(false);
          composer.current?.focus();
        }
      }}
    >
      {launchPending && (
        <Drawer
          title="Keep your current draft?"
          onClose={() => {
            setLaunchPending(null);
            const q = new URLSearchParams(location.search);
            q.delete("launchSkill");
            q.delete("starter");
            history.replaceState(null, "", `/app?${q}`);
          }}
        >
          <h2>Keep your current draft?</h2>
          <p>
            Starting this skill replaces the unsent message. Nothing will be
            submitted.
          </p>
          <button
            onClick={() => {
              setLaunchPending(null);
              const q = new URLSearchParams(location.search);
              q.delete("launchSkill");
              q.delete("starter");
              history.replaceState(null, "", `/app?${q}`);
            }}
          >
            Keep draft
          </button>
          <button
            className="secondary"
            onClick={() => acceptLaunch(launchPending)}
          >
            Start new draft
          </button>
        </Drawer>
      )}
      <PageHeader
        eyebrow="CHAT"
        title="Talk with your work."
        actions={
          <>
            <button
              className="secondary"
              onClick={() => setShowList(!showList)}
              aria-expanded={showList}
            >
              Conversations
            </button>
            <button
              className="secondary"
              onClick={() => setShowEvidence(!showEvidence)}
              aria-expanded={showEvidence}
            >
              Evidence
            </button>
          </>
        }
      >
        <span>
          One conversation with your knowledge and work · Evidence stays
          inspectable.
        </span>
      </PageHeader>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div
        className={`chat-layout ${showList ? "with-list" : ""} ${showEvidence ? "with-evidence" : ""}`}
      >
        {showList && (
          <aside
            ref={listPanel}
            tabIndex={-1}
            onKeyDown={listKeys}
            className="conversation-list"
            aria-label="Conversations"
          >
            <button
              className="text-link"
              onClick={() => {
                setShowList(false);
                composer.current?.focus();
              }}
            >
              Close conversations
            </button>
            <button onClick={fresh}>New conversation</button>
            <label>
              Search conversations
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label>
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />{" "}
              Show archived
            </label>
            {list
              .filter(
                (c) =>
                  (c.state === "archived") === archived &&
                  c.title.toLowerCase().includes(query.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.id}
                  className="conversation-item secondary"
                  aria-current={c.id === cid ? "page" : undefined}
                  onClick={() => {
                    recordRoute("conversation", c.id);
                    if (innerWidth < 1024) setShowList(false);
                  }}
                >
                  {c.title}
                  <span>
                    {c.host} · {c.turnCount} turns
                  </span>
                </button>
              ))}
          </aside>
        )}
        <div className="conversation-main">
          <div className="conversation-heading">
            <h2>{conversation?.title ?? "New conversation"}</h2>
            {conversation && (
              <>
                <button
                  className="secondary"
                  onClick={() => setRename(conversation.title)}
                >
                  Rename
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    act(async () =>
                      setConversation(
                        await api("conversations/update", {
                          id: cid,
                          expectedVersion: conversation.version,
                          state:
                            conversation.state === "active"
                              ? "archived"
                              : "active",
                        }),
                      ),
                    )
                  }
                >
                  {conversation.state === "active" ? "Archive" : "Restore"}
                </button>
              </>
            )}
          </div>
          {rename !== null && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  setConversation(
                    await api("conversations/update", {
                      id: cid,
                      expectedVersion: conversation.version,
                      title: rename,
                    }),
                  );
                  setRename(null);
                });
              }}
            >
              <label>
                Conversation title
                <input
                  maxLength={160}
                  required
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                />
              </label>
              <button disabled={busy}>Save title</button>
              <button
                type="button"
                className="secondary"
                onClick={() => setRename(null)}
              >
                Cancel
              </button>
            </form>
          )}
          <section
            className="conversation-transcript"
            aria-label="Chat conversation"
          >
            {!turns.length && (
              <EmptyState title="Start with a question">
                Search your workspace, prepare a meeting or explore a project.
                HOI uses permitted knowledge and registered tools to answer with
                evidence.
              </EmptyState>
            )}
            {turns.map((t, i) => (
              <article
                key={t.id}
                className={`chat-turn ${selected === t.id ? "selected" : ""}`}
              >
                <p className="meta">
                  Turn {i + 1} ·{" "}
                  {t.createdAt ? new Date(t.createdAt).toLocaleString() : ""}
                </p>
                {t.state === "unavailable" ? (
                  <p>
                    Context unavailable. Permissions or knowledge changed; start
                    a new conversation.
                  </p>
                ) : (
                  <>
                    {t.skill && (
                      <p className="meta">
                        Skill instructions supplied: {t.skill.name} ·{" "}
                        {t.skill.revisionId}
                      </p>
                    )}
                    <p className="speaker">You</p>
                    <p className="chat-message">{t.message}</p>
                    <p className="speaker">
                      {conversation.context?.provider ||
                        (conversation.host === "codex" ? "Codex" : "Claude")}
                    </p>
                    {t.answer ? (
                      <>
                        <Answer text={t.answer.text} />
                        <div className="citation-links">
                          {t.answer.citations.map((e, n) => (
                            <button
                              className="secondary"
                              key={n}
                              onClick={async () => {
                                await inspect(t);
                                await openPassage(e);
                              }}
                            >
                              Read chat source {n + 1}
                            </button>
                          ))}
                        </div>
                        {schemaVersion < 18 && t.answer.taskProposal && (
                          <section
                            className="proposal-preview"
                            aria-label="Chat task proposal"
                          >
                            <h3>{t.answer.taskProposal.task.title}</h3>
                            <p>{t.answer.taskProposal.task.outcome}</p>
                            {t.acceptedProposal ? (
                              <a
                                href={`/app?proposal=${t.acceptedProposal.id}`}
                              >
                                Review this proposal
                              </a>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  act(async () => {
                                    await api("chat/propose", {
                                      runId: t.id,
                                      expectedVersion: t.version,
                                    });
                                    setConversation(
                                      await api(`conversations/${cid}`),
                                    );
                                  })
                                }
                              >
                                Save for task review
                              </button>
                            )}
                          </section>
                        )}
                      </>
                    ) : (
                      <p role="status">
                        {t.state === "awaiting-assistant"
                          ? job
                            ? `AI ${job.state}${job.error ? " · " + job.error : ""}`
                            : "Request prepared — waiting for your assistant handoff."
                          : t.state === "cancelled"
                            ? "Request cancelled."
                            : t.state}
                      </p>
                    )}
                    {schemaVersion >= 18 && (
                      <TurnResults
                        api={api}
                        turn={t}
                        onChanged={async () =>
                          setConversation(await api(`conversations/${cid}`))
                        }
                        onEvidence={() => inspect(t)}
                      />
                    )}
                    {t.id === last?.id && job?.preview && (
                      <details>
                        <summary>Live response · not yet validated</summary>
                        <pre className="live-response">{job.preview}</pre>
                      </details>
                    )}
                    <button className="secondary" onClick={() => inspect(t)}>
                      Inspect turn {i + 1} evidence
                    </button>
                  </>
                )}
              </article>
            ))}
          </section>
          {waiting && (
            <div className="handoff-controls">
              <button
                className="secondary"
                onClick={() => setHandoff(!handoff)}
                aria-expanded={handoff}
              >
                Open assistant handoff
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    if (job && ["queued", "running"].includes(job.state))
                      await api("ai/cancel", { id: job.id });
                    await api("chat/cancel", { runId: last.id });
                    setConversation(await api(`conversations/${cid}`));
                    setHandoff(false);
                    setResponse("");
                  })
                }
              >
                Cancel chat
              </button>
            </div>
          )}
          {handoff && waiting && !job && (
            <section className="handoff-panel" aria-label="Assistant handoff">
              <h3>
                Copy for {host === "codex" ? "Codex" : "Claude"}, then validate
              </h3>
              <p>
                Give the request to your assistant and paste its structured
                response. Nothing runs automatically.
              </p>
              <textarea
                aria-label="Chat request"
                readOnly
                rows={5}
                value={JSON.stringify(last.request, null, 2)}
              />
              <button
                className="secondary"
                onClick={() =>
                  act(async () => {
                    await navigator.clipboard.writeText(
                      JSON.stringify(last.request, null, 2),
                    );
                    setNotice("Request copied.");
                  })
                }
              >
                Copy request
              </button>
              <label>
                Assistant response JSON
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                />
              </label>
              <button
                disabled={busy || !response.trim()}
                onClick={() =>
                  act(async () => {
                    const r = await api("chat/submit", {
                      runId: last.id,
                      expectedVersion: last.version,
                      response: JSON.parse(response),
                    });
                    setConversation(await api(`conversations/${cid}`));
                    setResponse("");
                    setHandoff(r.state === "awaiting-assistant");
                    setNotice(
                      r.state === "completed"
                        ? "Response validated."
                        : "Tool result ready. Copy the updated request.",
                    );
                  })
                }
              >
                Submit assistant response
              </button>
            </section>
          )}

          {!turns.length && (
            <div className="chat-starters">
              {[
                "Prepare my next meeting",
                "Review consulting priorities",
                "Find related documents",
              ].map((text) => (
                <button
                  key={text}
                  className="secondary"
                  onClick={() => {
                    setMessage(text);
                    composer.current?.focus();
                  }}
                >
                  {text}
                </button>
              ))}
              <button className="secondary" onClick={() => navigate("skills")}>
                All skills
              </button>
            </div>
          )}
          {composerView}
        </div>
        {showEvidence && (
          <Evidence
            data={evidence}
            error={evidenceError}
            passage={passage}
            onOpen={openPassage}
            onOriginal={async (e) => {
              try {
                const r = await fetch(
                  `/api/original/${e.sourceId}?revision=${encodeURIComponent(e.revisionId)}`,
                  { headers: { Authorization: `Bearer ${token}` } },
                );
                if (!r.ok) throw Error("Original source unavailable");
                const url = URL.createObjectURL(await r.blob());
                const a = document.createElement("a");
                a.href = url;
                a.download = e.title;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch {
                setEvidenceError(
                  "Original source unavailable. Access may have changed.",
                );
                setEvidence(null);
                setPassage(null);
              }
            }}
            onClose={() => setShowEvidence(false)}
          />
        )}
      </div>
    </div>
  );
}
