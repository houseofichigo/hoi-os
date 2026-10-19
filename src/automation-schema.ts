// Schema 20: definitions are authorization records; jobs/reviews remain authoritative.
export const AUTOMATION_SQL = `
CREATE TABLE IF NOT EXISTS automation_definitions(id TEXT PRIMARY KEY,version INTEGER NOT NULL,state TEXT NOT NULL,host TEXT NOT NULL,payload TEXT NOT NULL,approval_digest TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automation_definition_revisions(definition_id TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,payload TEXT NOT NULL,approval_digest TEXT,recorded_at TEXT NOT NULL,PRIMARY KEY(definition_id,version));
CREATE TRIGGER IF NOT EXISTS automation_definition_created AFTER INSERT ON automation_definitions BEGIN INSERT INTO automation_definition_revisions VALUES(NEW.id,NEW.version,NEW.state,NEW.payload,NEW.approval_digest,NEW.updated_at); END;
CREATE TRIGGER IF NOT EXISTS automation_definition_changed AFTER UPDATE ON automation_definitions WHEN NEW.version != OLD.version BEGIN INSERT INTO automation_definition_revisions VALUES(NEW.id,NEW.version,NEW.state,NEW.payload,NEW.approval_digest,NEW.updated_at); END;
CREATE TABLE IF NOT EXISTS automation_runs(id TEXT PRIMARY KEY,definition_id TEXT NOT NULL REFERENCES automation_definitions(id),definition_version INTEGER NOT NULL,trigger_key TEXT NOT NULL,request_digest TEXT NOT NULL,state TEXT NOT NULL,checkpoint TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(definition_id,trigger_key));
CREATE UNIQUE INDEX IF NOT EXISTS automation_single_running ON automation_runs((1)) WHERE state='running';
CREATE TABLE IF NOT EXISTS automation_grants(id TEXT PRIMARY KEY,definition_id TEXT NOT NULL REFERENCES automation_definitions(id),definition_version INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,revoked INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automation_schedule_observations(definition_id TEXT PRIMARY KEY REFERENCES automation_definitions(id),payload TEXT NOT NULL,observed_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automation_source_owners(connection_id TEXT PRIMARY KEY REFERENCES sync_connections(id),definition_id TEXT NOT NULL REFERENCES automation_definitions(id));
CREATE TABLE IF NOT EXISTS automation_snapshots(namespace TEXT NOT NULL,account TEXT NOT NULL,object_id TEXT NOT NULL,checksum TEXT NOT NULL,source_id TEXT NOT NULL,revision_id TEXT NOT NULL,archive_path TEXT NOT NULL,observed_at TEXT NOT NULL,scope TEXT NOT NULL,content_type TEXT NOT NULL,PRIMARY KEY(namespace,account,object_id,checksum));
CREATE TABLE IF NOT EXISTS automation_checks(definition_id TEXT NOT NULL,revision_id TEXT NOT NULL,checked_at TEXT NOT NULL,PRIMARY KEY(definition_id,revision_id));
CREATE TABLE IF NOT EXISTS automation_backlog_revisions(definition_id TEXT NOT NULL,revision_id TEXT NOT NULL,PRIMARY KEY(definition_id,revision_id));
CREATE TABLE IF NOT EXISTS automation_processing(definition_id TEXT NOT NULL,revision_id TEXT NOT NULL,instruction_digest TEXT NOT NULL,job_id TEXT NOT NULL,PRIMARY KEY(definition_id,revision_id,instruction_digest));
CREATE TABLE IF NOT EXISTS automation_events(id TEXT PRIMARY KEY,definition_id TEXT NOT NULL,run_id TEXT,kind TEXT NOT NULL,at TEXT NOT NULL);
`;
