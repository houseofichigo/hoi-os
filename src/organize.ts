import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Store } from "./store.js";
import { uid, now, sha, atomic, contained } from "./files.js";
import type { Host } from "./schema.js";
function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .slice(0, 80) || "unclassified"
  );
}
export function organize(s: Store, host: Host) {
  s.assertHost(host);
  const entries = s
    .all(
      "SELECT s.*,r.original_path,r.checksum FROM sources s JOIN revisions r ON r.id=s.current_revision",
    )
    .filter((r) => s.allowed(r, host))
    .map((r) => {
      const m = JSON.parse(r.metadata);
      return {
        sourceId: r.id,
        revisionId: r.current_revision,
        from: r.original_path,
        to: join(
          "working",
          slug(m.client ?? "general"),
          slug(m.documentType),
          `${r.id}-${basename(r.original_path)}`,
        ),
        checksum: r.checksum,
      };
    });
  const payload = {
      host,
      entries,
      mode: "copy-working-files; originals retained",
    },
    id = uid("plan"),
    hash = sha(JSON.stringify(payload));
  s.exec(
    "INSERT INTO plans VALUES(?,?,?,?,?,?)",
    id,
    "organize",
    JSON.stringify(payload),
    hash,
    "proposed",
    now(),
  );
  return { id, hash, ...payload };
}
export function approve(s: Store, planId: string, hash: string) {
  const p = s.one("SELECT * FROM plans WHERE id=?", planId);
  if (!p || p.hash !== hash || p.state !== "proposed")
    throw Error("Plan changed, completed, or unknown");
  const action = p.kind === "run" ? "draft" : "organize";
  if (s.policy().actions[action] === "deny")
    throw Error("Action denied by policy");
  const id = uid("approval");
  s.exec(
    "INSERT INTO approvals VALUES(?,?,?,?,?)",
    id,
    hash,
    sha(JSON.stringify(s.policy())),
    now(),
    null,
  );
  s.log("action.approved", { id, planId, hash });
  return { id, planId, hash };
}
export function applyOrganization(
  s: Store,
  planId: string,
  approvalId: string,
  host: Host,
) {
  s.assertHost(host);
  const p = s.one("SELECT * FROM plans WHERE id=?", planId),
    a = s.one("SELECT * FROM approvals WHERE id=?", approvalId);
  if (
    !p ||
    !a ||
    a.action_hash !== p.hash ||
    a.policy_hash !== sha(JSON.stringify(s.policy())) ||
    a.consumed_at ||
    p.state !== "proposed"
  )
    throw Error("Approval is missing, stale, or consumed");
  const payload = JSON.parse(p.payload);
  if (payload.host !== host) throw Error("Host changed since plan");
  if (s.policy().actions.organize !== "approve")
    throw Error("Organization denied");
  for (const e of payload.entries) {
    const source = s.one("SELECT * FROM sources WHERE id=?", e.sourceId);
    if (
      !source ||
      source.current_revision !== e.revisionId ||
      !s.allowed(source, host)
    )
      throw Error("Source changed or denied; create a new plan");
    if (!contained(s.path("working"), s.path(e.to)))
      throw Error("Invalid destination");
    if (sha(readFileSync(s.path(e.from))) !== e.checksum)
      throw Error("Original checksum mismatch");
    if (
      existsSync(s.path(e.to)) &&
      sha(readFileSync(s.path(e.to))) !== e.checksum
    )
      throw Error("Destination contains different content");
  }
  for (const e of payload.entries)
    if (!existsSync(s.path(e.to)))
      atomic(s.path(e.to), readFileSync(s.path(e.from)));
  s.tx(() => {
    s.exec("UPDATE plans SET state=? WHERE id=?", "applied", planId);
    s.exec("UPDATE approvals SET consumed_at=? WHERE id=?", now(), approvalId);
  });
  s.log("organize.applied", { planId, count: payload.entries.length });
  return { planId, count: payload.entries.length, originalsPreserved: true };
}
