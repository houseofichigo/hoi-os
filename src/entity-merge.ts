import { z } from "zod";
import { Store } from "./store.js";
import { type Host, id } from "./schema.js";
import { now, sha, uid } from "./files.js";
function pair(s: Store, h: Host, from: string, to: string) {
  s.assertSchema(11, "Entity merge");
  s.assertHost(h);
  const rows = [from, to].map((key) =>
    s.one("SELECT * FROM entities WHERE id=?", key),
  );
  if (
    from === to ||
    rows.some((r) => !r || !JSON.parse(r.allowed_hosts).includes(h))
  )
    throw Error("Entities unavailable");
  if (
    rows[0].type !== rows[1].type ||
    JSON.stringify(JSON.parse(rows[0].allowed_hosts).sort()) !==
      JSON.stringify(JSON.parse(rows[1].allowed_hosts).sort())
  )
    throw Error("Entity merges require matching type and permissions");
  return rows;
}
export function entityMerges(s: Store, h: Host) {
  s.assertSchema(11, "Entity merge");
  s.assertHost(h);
  return s
    .all("SELECT * FROM entity_merges WHERE host=? ORDER BY at DESC", h)
    .filter((row) => {
      const p = JSON.parse(row.payload);
      try {
        pair(s, h, p.from, p.to);
        return true;
      } catch {
        return false;
      }
    })
    .map((row) => ({ ...row, payload: JSON.parse(row.payload) }));
}
export function mergeEntity(s: Store, h: Host, raw: unknown) {
  const v = z
    .object({
      action: z.enum(["propose", "approve", "reject", "undo"]),
      from: id.optional(),
      to: id.optional(),
      id: id.optional(),
      digest: z.string().optional(),
      reason: z.string().min(1).max(2000).optional(),
    })
    .strict()
    .parse(raw);
  s.assertHost(h);
  if (s.policy().actions.draft !== "allow") throw Error("POLICY_DENIED");
  if (v.action === "propose") {
    if (!v.from || !v.to || !v.reason)
      throw Error("Select entities and give an evidence-based explanation");
    const rows = pair(s, h, v.from, v.to),
      payload = {
        from: v.from,
        to: v.to,
        reason: v.reason,
        digest: sha(JSON.stringify(rows)),
        basis: "manual",
      };
    const key = uid("merge");
    s.exec(
      "INSERT INTO entity_merges VALUES(?,?,?,?,?)",
      key,
      h,
      JSON.stringify(payload),
      "proposed",
      now(),
    );
    return { id: key, state: "proposed", ...payload };
  }
  const row = entityMerges(s, h).find((r) => r.id === v.id);
  if (!row) throw Error("Merge unavailable");
  if (v.digest !== row.payload.digest)
    throw Error("STALE_VERSION: Exact merge digest required");
  if (v.action === "undo") {
    if (row.state !== "approved") throw Error("Merge is not active");
    s.exec("UPDATE entity_merges SET state='undone' WHERE id=?", row.id);
    return { id: row.id, state: "undone" };
  }
  if (row.state !== "proposed")
    throw Error("STALE_VERSION: Merge already reviewed");
  const rows = pair(s, h, row.payload.from, row.payload.to);
  if (sha(JSON.stringify(rows)) !== row.payload.digest)
    throw Error("STALE_VERSION: Entities changed");
  if (v.action === "approve") {
    for (const other of s.all(
      "SELECT payload FROM entity_merges WHERE state='approved'",
    )) {
      const p = JSON.parse(other.payload);
      if (
        [p.from, p.to].some((key) =>
          [row.payload.from, row.payload.to].includes(key),
        )
      )
        throw Error("MERGE_CONFLICT: Review existing merge first");
    }
  }
  const state = v.action === "approve" ? "approved" : "rejected";
  s.exec("UPDATE entity_merges SET state=? WHERE id=?", state, row.id);
  return { id: row.id, state };
}
export function mergedEntity(s: Store, h: Host, key: string) {
  if (s.schemaVersion < 11) return key;
  // Only a reviewed, still permission-compatible redirect changes the derived map.
  for (const row of s.all(
    "SELECT payload FROM entity_merges WHERE state='approved'",
  )) {
    const p = JSON.parse(row.payload);
    if (p.from === key) {
      try {
        pair(s, h, p.from, p.to);
        return p.to;
      } catch {
        return key;
      }
    }
  }
  return key;
}
