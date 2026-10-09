export const CHAT_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS chat_runs(id TEXT PRIMARY KEY,host TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`;

export const CONVERSATION_SQL = `
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,host TEXT NOT NULL,project_id TEXT,state TEXT NOT NULL DEFAULT 'active',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conversation_turns(conversation_id TEXT NOT NULL REFERENCES conversations(id),run_id TEXT NOT NULL UNIQUE REFERENCES chat_runs(id),ordinal INTEGER NOT NULL,PRIMARY KEY(conversation_id,ordinal));
INSERT OR IGNORE INTO conversations(id,title,host,project_id,created_at,updated_at)
SELECT id,'Legacy conversation',host,json_extract(payload,'$.projectId'),created_at,updated_at FROM chat_runs;
INSERT OR IGNORE INTO conversation_turns SELECT id,id,1 FROM chat_runs;
`;

export const CHAT_SEND_SQL = `
CREATE TABLE IF NOT EXISTS chat_sends(request_key TEXT PRIMARY KEY,host TEXT NOT NULL,payload_hash TEXT NOT NULL,conversation_id TEXT NOT NULL,run_id TEXT NOT NULL,job_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conversation_context(conversation_id TEXT PRIMARY KEY REFERENCES conversations(id),scope TEXT NOT NULL,origin TEXT NOT NULL,provider TEXT NOT NULL);
`;
