export const INTAKE_RELIABILITY_SQL = `
CREATE TABLE IF NOT EXISTS intake_jobs(id TEXT PRIMARY KEY,host TEXT NOT NULL,state TEXT NOT NULL,payload TEXT NOT NULL,result TEXT,reason TEXT,attempts INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_locations(source_id TEXT NOT NULL REFERENCES sources(id),path TEXT NOT NULL,fs_identity TEXT,checksum TEXT NOT NULL,recorded_at TEXT NOT NULL,PRIMARY KEY(source_id,path));
CREATE INDEX IF NOT EXISTS source_locations_identity ON source_locations(fs_identity);
CREATE TABLE IF NOT EXISTS sync_checkpoints(connection_id TEXT PRIMARY KEY,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_run_items(run_id TEXT NOT NULL,remote_id TEXT NOT NULL,state TEXT NOT NULL,reason TEXT,payload TEXT NOT NULL,source_id TEXT,PRIMARY KEY(run_id,remote_id));
CREATE TABLE IF NOT EXISTS entity_merges(id TEXT PRIMARY KEY,host TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_dates(target_id TEXT PRIMARY KEY,effective_date TEXT,recorded_at TEXT NOT NULL,host TEXT NOT NULL);
`;
