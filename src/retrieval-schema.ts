export const RETRIEVAL_SQL = `
CREATE TABLE IF NOT EXISTS memory_revisions(memory_id TEXT NOT NULL,version INTEGER NOT NULL,checksum TEXT NOT NULL,path TEXT NOT NULL,recorded_at TEXT NOT NULL,PRIMARY KEY(memory_id,version));
CREATE TABLE IF NOT EXISTS memory_write_journal(id TEXT PRIMARY KEY,host TEXT NOT NULL,request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,writes TEXT NOT NULL,result TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(host,request_key));
CREATE TABLE IF NOT EXISTS knowledge_artifacts(id TEXT PRIMARY KEY,source_revision TEXT NOT NULL,instruction_version TEXT NOT NULL,payload TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(source_revision,instruction_version));
CREATE TABLE IF NOT EXISTS knowledge_index_generations(id TEXT PRIMARY KEY,model_fingerprint TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL,activated_at TEXT);
CREATE TABLE IF NOT EXISTS knowledge_search_units(id TEXT PRIMARY KEY,kind TEXT NOT NULL,record_id TEXT NOT NULL,revision TEXT NOT NULL,checksum TEXT NOT NULL,payload TEXT NOT NULL,generation_id TEXT);
CREATE TABLE IF NOT EXISTS knowledge_model_manifests(fingerprint TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_retrieval_config(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
`;
