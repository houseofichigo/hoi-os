export const MAINTENANCE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS knowledge_reviews(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL UNIQUE,payload TEXT NOT NULL,state TEXT NOT NULL,version INTEGER NOT NULL,decision TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_dispositions(target_id TEXT PRIMARY KEY,action TEXT NOT NULL,replacement_id TEXT,review_id TEXT NOT NULL REFERENCES knowledge_reviews(id),created_at TEXT NOT NULL);
`;
