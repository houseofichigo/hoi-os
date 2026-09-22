export function filterGraph(
  data,
  {
    query = "",
    type = "",
    view = "all",
    scope = "",
    source = "",
    basis = "",
    cutoff = "",
    unknown = true,
    focus = "",
  } = {},
) {
  const nodeId = (v) => (typeof v === "object" ? v.id : v);
  const scoped = !!scope || ["project", "client"].includes(view);
  const selected = new Set(
    scope
      ? [scope]
      : scoped
        ? data.nodes.filter((n) => n.type === view).map((n) => n.id)
        : [],
  );
  if (scoped) {
    for (const l of data.links)
      if (l.type === "FOR_CLIENT" && selected.has(nodeId(l.target)))
        selected.add(nodeId(l.source));
    for (const n of data.nodes)
      if (selected.has(n.client) || selected.has(n.project)) selected.add(n.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const l of data.links) {
        const a = nodeId(l.source),
          b = nodeId(l.target);
        if (
          selected.has(a) &&
          !selected.has(b) &&
          data.nodes.find((n) => n.id === b)?.type === "memory"
        ) {
          selected.add(b);
          changed = true;
        }
      }
    }
  }
  const neighbors = new Set(focus ? [focus] : []);
  if (focus)
    for (const l of data.links) {
      const a = nodeId(l.source),
        b = nodeId(l.target);
      if (a === focus) neighbors.add(b);
      if (b === focus) neighbors.add(a);
    }
  const sourceIds = new Set(source ? [source] : []);
  if (source)
    for (const l of data.links) {
      if (nodeId(l.source) === source) sourceIds.add(nodeId(l.target));
      if (nodeId(l.target) === source) sourceIds.add(nodeId(l.source));
    }
  let nodes = data.nodes.filter(
    (n) =>
      (!query ||
        `${n.name} ${(n.aliases ?? []).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!type || n.type === type) &&
      (view !== "memory" || n.type === "memory") &&
      (view !== "wiki" || n.type === "wiki") &&
      (!scoped || selected.has(n.id)) &&
      (!source || sourceIds.has(n.id)) &&
      (!focus || neighbors.has(n.id)) &&
      (!cutoff || (n.date ? n.date <= cutoff : unknown)),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const links = data.links
    .filter(
      (l) =>
        ids.has(nodeId(l.source)) &&
        ids.has(nodeId(l.target)) &&
        (!basis || l.basis === basis) &&
        (!cutoff || (l.date ? l.date <= cutoff : unknown)),
    )
    .map((l) => ({ ...l, source: nodeId(l.source), target: nodeId(l.target) }));
  return { nodes: nodes.map((n) => ({ ...n })), links };
}
