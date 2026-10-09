import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { connections } from "./sync.js";
export function providerCoverage(
  s: Store,
  h: Host,
  provider: string,
  window: { from: number; to: number },
  at: Date,
) {
  const selected =
    s.schemaVersion >= 10
      ? connections(s, h).filter((c) => c.provider === provider)
      : [];
  const externalKind = provider === "gmail" ? "email" : "calendar";
  const visible = s
    .all(
      "SELECT w.*,s.metadata,s.current_revision FROM work_intake w JOIN sources s ON s.id=w.source_id WHERE w.state='ready'",
    )
    .filter(
      (r) =>
        JSON.parse(r.item).kind === externalKind &&
        r.revision_id === r.current_revision &&
        s.allowed({ id: r.source_id, metadata: r.metadata }, h),
    );
  const scopes = selected.map((c) => {
    const refreshed = c.lastSuccess ? Date.parse(c.lastSuccess) : NaN;
    const recent =
      Number.isFinite(refreshed) &&
      refreshed <= +at &&
      +at - refreshed <= 15 * 60000;
    const scope = provider === "gmail" ? c.query : c.calendarId;
    const hidden = s
      .all(
        "SELECT s.* FROM sync_items i JOIN sources s ON s.id=i.source_id WHERE i.connection_id=?",
        c.id,
      )
      .some((src) => !s.allowed(src, h));
    let state = "current";
    if (!c.lastSuccess) state = "unknown";
    else if (
      !recent ||
      !["active", "syncing"].includes(c.state) ||
      c.error === "RECONNECT_REQUIRED"
    )
      state = "stale";
    else if (
      c.error ||
      hidden ||
      (provider === "calendar" &&
        (!c.coverage.from ||
          !c.coverage.to ||
          Date.parse(c.coverage.from) > window.from ||
          Date.parse(c.coverage.to) < window.to))
    )
      state = "partial";
    return {
      id: c.id,
      label: c.label,
      scope,
      state,
      lastSuccess: c.lastSuccess,
      from: c.coverage.from,
      to: c.coverage.to,
    };
  });
  const linked = new Set(
    selected.flatMap((c) =>
      s
        .all("SELECT source_id FROM sync_items WHERE connection_id=?", c.id)
        .map((r) => r.source_id),
    ),
  );
  const untracked = visible.some((r) => !linked.has(r.source_id));
  let state = scopes.length
    ? scopes.every((c) => c.state === "current") && !untracked
      ? "current"
      : scopes.some((c) => c.state === "stale")
        ? "stale"
        : "partial"
    : visible.length
      ? "partial"
      : "unknown";
  if (
    scopes.length &&
    scopes.every((c) => c.state === "unknown") &&
    !visible.length
  )
    state = "unknown";
  return {
    state,
    scope: scopes.length
      ? scopes.map((c) => c.label + ": " + c.scope).join("; ")
      : "Selected visible exports only",
    lastSuccess: scopes.every((c) => c.lastSuccess)
      ? scopes.map((c) => c.lastSuccess!).sort()[0] || null
      : null,
    scopes,
    explanation:
      "Selected permitted scope only; this does not establish coverage of all accounts or commitments. Refresh older than 15 minutes is stale.",
  };
}
