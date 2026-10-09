import type { Store } from "./store.js";
import { now, uid } from "./files.js";
export const ACTIVITY_SQL = `
CREATE TABLE IF NOT EXISTS chat_progress(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES chat_runs(id),job_id TEXT,sequence INTEGER NOT NULL,stage TEXT NOT NULL,operation TEXT,recorded_at TEXT NOT NULL,UNIQUE(run_id,sequence));
CREATE TABLE IF NOT EXISTS chat_result_links(run_id TEXT NOT NULL REFERENCES chat_runs(id),kind TEXT NOT NULL,record_id TEXT NOT NULL,version INTEGER,PRIMARY KEY(run_id,kind,record_id));
`;
export function progressEvent(
  s: Store,
  runId: string,
  jobId: string | null,
  stage: string,
  operation: string | null = null,
) {
  if (s.schemaVersion < 18) return;
  s.tx(() => {
    const sequence = s.one(
      "SELECT COALESCE(MAX(sequence),0)+1 n FROM chat_progress WHERE run_id=?",
      runId,
    ).n;
    s.exec(
      "INSERT INTO chat_progress VALUES(?,?,?,?,?,?,?)",
      uid("progress"),
      runId,
      jobId,
      sequence,
      stage,
      operation,
      now(),
    );
  });
}
export function resultLink(
  s: Store,
  runId: string,
  kind: string,
  id: string,
  version?: number,
) {
  if (s.schemaVersion < 18) return;
  s.exec(
    "INSERT INTO chat_result_links VALUES(?,?,?,?) ON CONFLICT(run_id,kind,record_id) DO UPDATE SET version=excluded.version",
    runId,
    kind,
    id,
    version ?? null,
  );
}
