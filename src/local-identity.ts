import { statSync, existsSync } from "node:fs";
import { Store } from "./store.js";
import { now } from "./files.js";
export function filesystemIdentity(path: string) {
  const st = statSync(path);
  return st.ino && st.birthtimeMs > 0
    ? `${st.dev}:${st.ino}:${st.birthtimeMs}`
    : null;
}
export function localSource(s: Store, path: string, checksum: string) {
  if (s.schemaVersion < 11) return null;
  const identity = filesystemIdentity(path);
  const rows = s
    .all(
      "SELECT * FROM source_locations WHERE fs_identity=? OR checksum=?",
      identity,
      checksum,
    )
    .filter(
      (r) =>
        !s
          .all(
            "SELECT path FROM source_locations WHERE source_id=?",
            r.source_id,
          )
          .some(
            (location) => location.path !== path && existsSync(location.path),
          ),
    );
  // A move requires disappearance of the old location. Copies retain distinct identity.
  let matches = rows.filter(
    (r) =>
      r.path !== path &&
      !existsSync(r.path) &&
      identity &&
      r.fs_identity === identity,
  );
  if (!matches.length)
    matches = rows.filter(
      (r) => r.path !== path && !existsSync(r.path) && r.checksum === checksum,
    );
  const ids = [...new Set(matches.map((r) => r.source_id))];
  if (ids.length > 1)
    throw Error(
      "IDENTITY_REVIEW_REQUIRED: Multiple possible moved sources; choose a source explicitly",
    );
  return ids.length ? s.one("SELECT * FROM sources WHERE id=?", ids[0]) : null;
}
export function recordLocation(
  s: Store,
  source: string,
  path: string,
  checksum: string,
) {
  if (s.schemaVersion < 11) return;
  s.exec(
    "INSERT INTO source_locations VALUES(?,?,?,?,?) ON CONFLICT(source_id,path) DO UPDATE SET fs_identity=excluded.fs_identity,checksum=excluded.checksum,recorded_at=excluded.recorded_at",
    source,
    path,
    filesystemIdentity(path),
    checksum,
    now(),
  );
}
