// Schema 21. Originals/artifact payloads are authoritative; FTS is disposable.
export const DISCOVERY_SQL = `
CREATE TABLE IF NOT EXISTS discovery_units(id TEXT PRIMARY KEY,artifact_id TEXT NOT NULL,source_revision TEXT NOT NULL,payload TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS discovery_search USING fts5(title,context,questions,claim,unit_id UNINDEXED,tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS session_imports(request_key TEXT PRIMARY KEY,host TEXT NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,result TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS session_exports(source_id TEXT NOT NULL,revision_id TEXT PRIMARY KEY,payload TEXT NOT NULL,archive_path TEXT NOT NULL,checksum TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_enrichment_requests(request_key TEXT PRIMARY KEY,host TEXT NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,result TEXT,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS enrichment_single_running ON knowledge_enrichment_requests((1)) WHERE state='running';
CREATE TRIGGER IF NOT EXISTS enrichment_excludes_automation BEFORE INSERT ON knowledge_enrichment_requests WHEN NEW.state='running' AND EXISTS(SELECT 1 FROM automation_runs WHERE state='running') BEGIN SELECT RAISE(ABORT,'WORKSPACE_JOB_RUNNING'); END;
CREATE TRIGGER IF NOT EXISTS automation_excludes_enrichment BEFORE INSERT ON automation_runs WHEN NEW.state='running' AND EXISTS(SELECT 1 FROM knowledge_enrichment_requests WHERE state='running') BEGIN SELECT RAISE(ABORT,'WORKSPACE_JOB_RUNNING'); END;
`;
