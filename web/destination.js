import { useSyncExternalStore } from "react";
export const requested = (kind) =>
  new URLSearchParams(location.search).get(kind);
const views = [
  "home",
  "inbox",
  "knowledge",
  "projects",
  "clients",
  "chat",
  "skills",
  "configuration",
];
const subscribe = (callback) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("hoi:navigate", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hoi:navigate", callback);
  };
};
export function useLocationSearch() {
  return useSyncExternalStore(subscribe, () => location.search);
}
export function routeView(search = location.search) {
  const q = new URLSearchParams(search);
  if (views.includes(q.get("view"))) return q.get("view");
  if (["project", "task", "proposal"].some((k) => q.has(k))) return "projects";
  if (q.has("client")) return "clients";
  if (q.has("source")) return "knowledge";
  if (q.has("connection")) return "configuration";
  return "home";
}
export function navigate(view, subview) {
  const q = new URLSearchParams({ view });
  if (subview) q.set("section", subview);
  const next = `/app?${q}`;
  if (location.pathname + location.search !== next) {
    history.pushState(null, "", next);
    window.dispatchEvent(new Event("hoi:navigate"));
  }
}
export function useSubview(view, allowed, fallback) {
  const search = useLocationSearch();
  const value = new URLSearchParams(search).get("section");
  return [
    allowed.includes(value) ? value : fallback,
    (value) => navigate(view, value),
  ];
}
export function focusRecord(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    el?.focus();
    el?.scrollIntoView({ block: "center" });
  });
}
export function recordRoute(kind, id) {
  const q = new URLSearchParams(location.search);
  if (id) q.set(kind, id);
  else q.delete(kind);
  const url = `/app${q.size ? "?" + q : ""}`;
  if (url !== location.pathname + location.search) {
    history.pushState(null, "", url);
    window.dispatchEvent(new Event("hoi:navigate"));
  }
}
