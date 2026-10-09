export function presentation(r) {
  const p = r.presentation || {};
  return {
    displayName:
      p.displayName || r.id.replace(/^hoi-/, "").replaceAll("-", " "),
    shortDescription: p.shortDescription || r.description,
    category: p.category || "Workspace",
    icon: p.icon || "knowledge",
    examples: Array.isArray(p.examples) ? p.examples.slice(0, 2) : [],
  };
}
export function launchSkill(id, starter) {
  const q = new URLSearchParams({ view: "chat", launchSkill: id });
  if (starter !== undefined) q.set("starter", String(starter));
  history.pushState(null, "", `/app?${q}`);
  window.dispatchEvent(new Event("hoi:navigate"));
}
export const chatDrafts = new Map();
