import { z } from "zod";
import { graph } from "./graph.js";
import { Store } from "./store.js";
import type { Host } from "./schema.js";

export const graphQueryInput = z
  .object({
    source: z.string().min(1).max(200),
    target: z.string().min(1).max(200).optional(),
    depth: z.number().int().min(1).max(2).default(1),
  })
  .strict();

// Traversal is over the engine's authorized projection, never raw model IDs.
export function graphQuery(
  s: Store,
  host: Host,
  mode: "path" | "impact",
  raw: unknown,
) {
  const v = graphQueryInput.parse(raw);
  const g = graph(s, host);
  const nodes = new Map(g.nodes.map((n: any) => [n.id, n]));
  if (
    !nodes.has(v.source) ||
    (mode === "path" && (!v.target || !nodes.has(v.target)))
  )
    return { state: "unavailable", nodes: [], links: [], partial: false };
  const edges = g.links.filter(
    (e: any) =>
      e.basis !== "inferred" &&
      ["CITES", "SUPPORTS", "DESCRIBES", "CONTRADICTS", "SUPERSEDES"].includes(
        e.type,
      ) &&
      nodes.has(e.source) &&
      nodes.has(e.target) &&
      s.evidenceVisible(e.evidence ?? [], host),
  );
  const seen = new Set([v.source]);
  let frontier: string[] = [v.source];
  const found: any[] = [];
  let partial = false;
  for (let hop = 0; hop < v.depth && frontier.length; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of edges
        .filter((e: any) =>
          mode === "path"
            ? e.source === id
            : e.type === "SUPPORTS"
              ? e.source === id
              : e.target === id,
        )
        .sort((a: any, b: any) => a.id.localeCompare(b.id))) {
        const target =
          mode === "path" || e.type === "SUPPORTS" ? e.target : e.source;
        if (seen.has(target)) continue;
        if (seen.size >= 100 || found.length >= 200) {
          partial = true;
          continue;
        }
        seen.add(target);
        next.push(target);
        found.push(e);
      }
    }
    frontier = next;
  }
  if (mode === "path") {
    if (!seen.has(v.target!))
      return { state: "no-path-within-bound", nodes: [], links: [], partial };
    const path: any[] = [];
    let cursor = v.target!;
    while (cursor !== v.source) {
      const edge = found.find((e) => e.target === cursor);
      if (!edge) break;
      path.unshift(edge);
      cursor = edge.source;
    }
    const ids = new Set([v.source, ...path.map((e) => e.target)]);
    return {
      state: "ready",
      nodes: [...ids].map((id) => nodes.get(id)),
      links: path,
      partial,
    };
  }
  return {
    state: "ready",
    nodes: [...seen].map((id) => nodes.get(id)),
    links: found,
    partial,
    note: "Potential review impact within selected depth; no record was changed.",
  };
}
