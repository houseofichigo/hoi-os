import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { records } from "./workspace.js";
import { intakeList, intakeDetail } from "./work-intake.js";
import { connections } from "./sync.js";
import { knowledgeSearch, eligibleMemories } from "./retrieval.js";
import { wikiDetail } from "./wiki-core.js";
import { now, sha } from "./files.js";

// Only permission-filtered read models enter model context; connector credentials/config never do.
export function connectedRead(
  s: Store,
  h: Host,
  v: { kind: string; query?: string; id?: string; offset?: number },
  projectId?: string,
) {
  let rows: any[];
  if (v.kind === "projects" || v.kind === "clients") {
    rows = records(s, v.kind === "projects" ? "project" : "client", h);
    if (projectId) {
      const projects = records(s, "project", h).filter(
        (p) => p.id === projectId,
      );
      rows = rows.filter((r) =>
        v.kind === "projects"
          ? r.id === projectId
          : projects.some((p) => p.clientIds.includes(r.id)),
      );
    }
  } else if (v.kind === "connections") {
    rows = connections(s, h).map((c) => ({
      id: c.id,
      provider: c.provider,
      state: c.state,
      coverage: c.coverage,
      lastSuccess: c.lastSuccess,
    }));
  } else {
    const kind =
      v.kind === "calendar"
        ? "calendar"
        : v.kind === "transcripts"
          ? "transcript"
          : "email";
    rows = intakeList(s, h).filter(
      (i) => i.kind === kind && (!projectId || i.projectId === projectId),
    );
  }
  const terms = (v.query || "")
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (v.id) rows = rows.filter((r) => r.id === v.id);
  else if (terms.length)
    rows = rows.filter((r) =>
      terms.some((t) => JSON.stringify(r).toLocaleLowerCase().includes(t)),
    );
  const total = rows.length;
  rows = rows.slice(v.offset || 0, (v.offset || 0) + 5);
  if (v.id && ["email", "calendar", "transcripts"].includes(v.kind))
    rows = rows.map((r) => {
      const detail = intakeDetail(s, r.id, h);
      return {
        ...r,
        item: detail.item,
        evidence: detail.passages.slice(0, 5).map((p) => ({
          revisionId: r.revisionId,
          passageId: p.id,
          quote: p.text.slice(0, 2000),
        })),
      };
    });
  return {
    kind: v.kind,
    records: rows.map((r) => ({
      ...r,
      recordKind:
        v.kind === "connections"
          ? undefined
          : v.kind === "projects"
            ? "project"
            : v.kind === "clients"
              ? "client"
              : v.kind === "calendar"
                ? "event"
                : "source",
      recordId:
        ["email", "calendar", "transcripts"].includes(v.kind) &&
        v.kind !== "calendar"
          ? r.sourceId
          : r.id,
    })),
    total,
    nextOffset:
      (v.offset || 0) + rows.length < total
        ? (v.offset || 0) + rows.length
        : null,
    retrievedAt: now(),
    coverage:
      "Selected synchronized scope only; no live synchronization performed",
  };
}
export function workspaceChatContext(
  s: Store,
  h: Host,
  scope: string,
  query: string,
  projectId?: string,
) {
  const entity = projectId ? s.one("SELECT entity_id FROM projects WHERE id=?", projectId)?.entity_id : undefined;
  const memories = knowledgeSearch(s, {query, project: entity, limit:10}, h).evidence
    .filter(e => e.kind === "memory").map(e => e.data);
  return {
    memories,
    ...(scope === "workspace"
      ? {
          projects: connectedRead(s, h, { kind: "projects", query }, projectId),
          clients: connectedRead(s, h, { kind: "clients", query }, projectId),
          connectors: connectedRead(s, h, { kind: "connections" }, projectId),
        }
      : {}),
  };
}

export function selectedKnowledge(
  s: Store,
  h: Host,
  refs: { kind: "wiki" | "memory"; id: string }[],
) {
  return refs.map((ref) => {
    if (ref.kind === "memory") {
      const m = eligibleMemories(s, h).find((m: any) => m.id === ref.id);
      if (!m) throw Error("SELECTED_KNOWLEDGE_UNAVAILABLE");
      return { kind: "memory", ...m, memoryRevision: sha(JSON.stringify(m)) };
    }
    const page = wikiDetail(s, ref.id, h);
    if (page.status !== "canonical") throw Error("SELECTED_WIKI_NOT_PUBLISHED");
    return {
      kind: "wiki",
      pageId: page.pageId,
      title: page.title,
      sections: page.blocks
        .filter((b: any) => !["question", "unverified"].includes(b.kind))
        .map((b: any) => ({
          wikiRevisionId: page.id,
          blockId: b.id,
          quote: b.text,
          provenance: b.kind,
          evidence: b.evidence,
        })),
    };
  });
}
