import { Store } from "./store.js";
import type { Host } from "./schema.js";
import { now, readYaml } from "./files.js";
import { readdirSync } from "node:fs";
export function graph(s: Store, host: Host) {
  s.assertHost(host);
  const nodes: any[] = [],
    links: any[] = [];
  const sources = s.all(
    "SELECT s.*,r.status extraction_status FROM sources s JOIN revisions r ON r.id=s.current_revision",
  );
  const visible = sources.filter((r) => s.allowed(r, host));
  for (const r of visible) {
    const m = JSON.parse(r.metadata);
    nodes.push({
      id: r.id,
      type: "document",
      name: r.title,
      sourceId: r.id,
      authority: m.authority,
      status: m.status,
      extractionStatus: r.extraction_status,
      date: m.effectiveDate,
      recordedAt: r.created_at,
      client: m.client,
      project: m.project,
      revisionId: r.current_revision,
    });
    for (const id of [
      ...m.entities,
      ...[m.client, m.project].filter(Boolean),
    ]) {
      links.push({
        id: `${r.id}-${id}`,
        source: r.id,
        target: id,
        type:
          id === m.project
            ? "BELONGS_TO"
            : id === m.client
              ? "RELATES_TO"
              : "MENTIONS",
        basis: "manual",
        evidence: [],
        date: m.effectiveDate,
      });
    }
  }
  // Entities are manually declared registry entries. Source-derived names must only be created after review.
  for (const e of s
    .all("SELECT * FROM entities")
    .filter((e) => JSON.parse(e.allowed_hosts).includes(host)))
    nodes.push({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: JSON.parse(e.aliases),
      date: e.date,
      recordedAt: e.created_at,
    });
  for (const m of s.memories()) {
    if (
      !m.allowedHosts.includes(host) ||
      !s.evidenceVisible(m.evidence, host, false)
    )
      continue;
    const stale = !s.evidenceVisible(m.evidence, host);
    nodes.push({
      id: m.id,
      type: "memory",
      name: m.content.slice(0, 100),
      content: m.content,
      state: m.state,
      stale,
      date: m.validFrom,
      recordedAt: m.createdAt,
      evidence: m.evidence,
    });
    for (const e of m.evidence) {
      const r = s.one(
        "SELECT source_id FROM revisions WHERE id=?",
        e.revisionId,
      );
      links.push({
        id: `${m.id}-${e.passageId}`,
        source: r.source_id,
        target: m.id,
        type: m.state === "approved" ? "SUPPORTS" : "REFERENCES",
        basis: m.state === "approved" ? "supported" : "inferred",
        evidence: [e],
        date: m.validFrom,
      });
    }
    for (const id of m.entities)
      links.push({
        id: `${m.id}-${id}`,
        source: m.id,
        target: id,
        type: "RELATES_TO",
        basis: "manual",
        evidence: [],
        date: m.validFrom,
      });
  }
  if (s.schemaVersion >= 2)
    for (const w of s
      .all(
        "SELECT * FROM wiki_pages WHERE status IN ('draft','reviewed','canonical')",
      )
      .filter((row) => JSON.parse(row.allowed_hosts).includes(host))) {
      nodes.push({
        id: w.id,
        type: "wiki",
        name: w.title,
        slug: w.slug,
        pageType: w.type,
        status: w.status,
        date: w.effective_date,
        recordedAt: w.created_at,
      });
      for (const entityId of JSON.parse(w.entities))
        links.push({
          id: `${w.id}-${entityId}`,
          source: w.id,
          target: entityId,
          type: "DESCRIBES",
          basis: "manual",
          evidence: [],
          date: w.effective_date,
        });
      for (const e of s.all(
        "SELECT * FROM wiki_evidence WHERE page_id=?",
        w.id,
      )) {
        const evidence = {
          revisionId: e.revision_id,
          passageId: e.passage_id,
          quote: e.quote,
        };
        if (!s.evidenceVisible([evidence], host, false)) continue;
        const r = s.one(
          "SELECT source_id FROM revisions WHERE id=?",
          e.revision_id,
        );
        links.push({
          id: `${w.id}-${e.passage_id}`,
          source: r.source_id,
          target: w.id,
          type: w.status === "canonical" ? "SUPPORTS" : "REFERENCES",
          basis: w.status === "canonical" ? "supported" : "inferred",
          evidence: [evidence],
          date: w.effective_date,
        });
      }
    }
  for (const r of s.all("SELECT * FROM relationships")) {
    const evidence = JSON.parse(r.evidence);
    if (!s.evidenceVisible(evidence, host, false)) continue;
    links.push({
      id: r.id,
      source: r.from_id,
      target: r.to_id,
      type: r.type,
      basis: r.basis,
      evidence,
      date: r.date,
    });
  }
  for (const file of readdirSync(s.path("capabilities")).filter((f) =>
    f.endsWith(".yaml"),
  )) {
    const c = s.capability(file.slice(0, -5));
    nodes.push({
      id: `capability_${c.id}`,
      type: "capability",
      name: c.purpose,
      status: c.state,
      date: null,
    });
    for (const step of c.steps) {
      const toolId = `tool_${step.tool}`;
      if (!nodes.some((n) => n.id === toolId))
        nodes.push({ id: toolId, type: "tool", name: step.tool, date: null });
      links.push({
        id: `${c.id}-${step.id}`,
        source: `capability_${c.id}`,
        target: toolId,
        type: "USES_TOOL",
        basis: "manual",
        evidence: [],
        date: null,
      });
    }
  }
  for (const execution of s.all(
    "SELECT * FROM executions WHERE host=? AND output IS NOT NULL",
    host,
  )) {
    const output = JSON.parse(execution.output);
    for (const e of output.evidence ?? []) {
      if (!s.evidenceVisible([e], host, false)) continue;
      links.push({
        id: `${execution.id}-${e.passageId}`,
        source: `capability_${execution.capability}`,
        target: e.sourceId,
        type: "USED_SOURCE",
        basis: "supported",
        evidence: [
          { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote },
        ],
        date: execution.started_at.slice(0, 10),
      });
    }
  }
  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    links: links.filter((l) => ids.has(l.source) && ids.has(l.target)),
    generatedAt: now(),
    host,
    note: "Dates represent recorded effective dates. Unknown dates are not inferred.",
  };
}
