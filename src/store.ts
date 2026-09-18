import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { resolve, join } from "node:path";
import {
  safePath,
  atomic,
  writeYaml,
  readYaml,
  readNote,
  writeNote,
  uid,
  now,
} from "./files.js";
import {
  defaultPolicy,
  policySchema,
  capabilitySchema,
  type Host,
  type Evidence,
} from "./schema.js";

export class Store {
  readonly root: string;
  readonly db: Database.Database;
  constructor(root: string) {
    this.root = resolve(root);
    if (existsSync(`${this.root}.hoi-restore`))
      throw Error(
        "RESTORE_PENDING: Run recover-restore after the restoring process stops.",
      );
    safePath(this.root, ".hoi/workspace.json");
    if (!existsSync(join(this.root, ".hoi/workspace.json")))
      throw Error("Workspace not initialized. Run init first.");
    this.db = new Database(safePath(this.root, ".hoi/os.sqlite"));
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;",
    );
    const version = Number(
      (this.db.prepare("PRAGMA user_version").get() as any).user_version,
    );
    if (version !== 1) {
      this.db.close();
      throw Error(
        `Unsupported schema ${version}; run a compatible release or restore backup`,
      );
    }
  }
  path(p: string) {
    return safePath(this.root, p);
  }
  all(sql: string, ...args: any[]): any[] {
    return this.db.prepare(sql).all(...args);
  }
  one(sql: string, ...args: any[]): any {
    return this.db.prepare(sql).get(...args);
  }
  exec(sql: string, ...args: any[]) {
    return this.db.prepare(sql).run(...args);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const v = fn();
      this.db.exec("COMMIT");
      return v;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
  policy() {
    return policySchema.parse(readYaml(this.path("policies/actions.yaml")));
  }
  allowed(source: any, host: Host) {
    const p = this.policy();
    const m =
      typeof source.metadata === "string"
        ? JSON.parse(source.metadata)
        : source.metadata;
    return (
      p.actions.read === "allow" &&
      !p.deniedHosts.includes(host) &&
      !p.deniedSources.includes(source.id) &&
      m.allowedHosts.includes(host) &&
      (m.sensitivity !== "restricted" || p.allowRestrictedHosts.includes(host))
    );
  }
  assertHost(host: Host) {
    if (
      this.policy().actions.read === "deny" ||
      this.policy().deniedHosts.includes(host)
    )
      throw Error(`Host ${host} is denied`);
  }
  validateEvidence(items: Evidence[], host?: Host, current = false) {
    for (const e of items) {
      const p = this.one(
        "SELECT p.*,r.source_id,s.metadata,s.current_revision FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.id=r.source_id WHERE p.id=? AND p.revision_id=?",
        e.passageId,
        e.revisionId,
      );
      if (!p || !p.text.includes(e.quote))
        throw Error("Evidence does not match its immutable passage");
      if (
        host &&
        !this.allowed({ id: p.source_id, metadata: p.metadata }, host)
      )
        throw Error("Evidence is not permitted for this host");
      if (current && p.current_revision !== e.revisionId)
        throw Error("Evidence is stale; review the current revision");
    }
  }
  evidenceVisible(items: Evidence[], host: Host, current = true) {
    try {
      this.validateEvidence(items, host, current);
      return true;
    } catch {
      return false;
    }
  }
  memories() {
    return readdirSync(this.path("memory"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => readNote(this.path(`memory/${f}`)));
  }
  log(kind: string, details: unknown) {
    const id = uid("audit");
    this.exec(
      "INSERT INTO audit VALUES(?,?,?,?)",
      id,
      now(),
      kind,
      JSON.stringify(details),
    );
    return id;
  }
  capability(id: string) {
    if (!/^[a-z][a-z0-9_-]+$/.test(id)) throw Error("Invalid capability ID");
    return capabilitySchema.parse(
      readYaml(this.path(`capabilities/${id}.yaml`)),
    );
  }
}

export const workspaceDirectories = [
  ".hoi",
  "context",
  "memory",
  "capabilities",
  "policies",
  "sources",
  "originals",
  "archives",
  "working",
  "executions",
  "connections",
  "models",
  "information-architecture",
];

export function initialize(root: string) {
  root = resolve(root);
  safePath(root, ".hoi/workspace.json");
  if (existsSync(join(root, ".hoi/workspace.json")))
    return { root, created: false };
  if (existsSync(root) && readdirSync(root).length)
    throw Error("Choose an empty directory for a new private workspace");
  for (const p of workspaceDirectories)
    mkdirSync(join(root, p), { recursive: true, mode: 0o700 });
  const db = new Database(join(root, ".hoi/os.sqlite"));
  db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE sources(id TEXT PRIMARY KEY,source_key TEXT NOT NULL UNIQUE,title TEXT NOT NULL,location TEXT NOT NULL,metadata TEXT NOT NULL,current_revision TEXT,created_at TEXT NOT NULL,last_checked TEXT NOT NULL);
 CREATE TABLE revisions(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(id),checksum TEXT NOT NULL,original_path TEXT NOT NULL,metadata_snapshot TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL,UNIQUE(source_id,checksum));
 CREATE TABLE occurrences(id TEXT PRIMARY KEY,source_id TEXT NOT NULL REFERENCES sources(id),revision_id TEXT NOT NULL REFERENCES revisions(id),location TEXT NOT NULL,imported_at TEXT NOT NULL,original_path TEXT NOT NULL);
 CREATE TABLE passages(id TEXT PRIMARY KEY,revision_id TEXT NOT NULL REFERENCES revisions(id),location TEXT NOT NULL,text TEXT NOT NULL);
 CREATE VIRTUAL TABLE passage_search USING fts5(text,passage_id UNINDEXED,tokenize='unicode61');
 CREATE TABLE entities(id TEXT PRIMARY KEY,type TEXT NOT NULL,name TEXT NOT NULL,identity TEXT UNIQUE,aliases TEXT NOT NULL,allowed_hosts TEXT NOT NULL,date TEXT,created_at TEXT NOT NULL);
 CREATE TABLE structured_rows(id TEXT PRIMARY KEY,revision_id TEXT NOT NULL REFERENCES revisions(id),row_number INTEGER NOT NULL,data TEXT NOT NULL);
 CREATE TABLE relationships(id TEXT PRIMARY KEY,from_id TEXT NOT NULL,to_id TEXT NOT NULL,type TEXT NOT NULL,basis TEXT NOT NULL,evidence TEXT NOT NULL,date TEXT,created_at TEXT NOT NULL);
 CREATE TABLE executions(id TEXT PRIMARY KEY,capability TEXT NOT NULL,version INTEGER NOT NULL,input TEXT NOT NULL,host TEXT NOT NULL,state TEXT NOT NULL,checkpoint TEXT NOT NULL,output TEXT,error TEXT,started_at TEXT NOT NULL,completed_at TEXT);
 CREATE TABLE approvals(id TEXT PRIMARY KEY,action_hash TEXT NOT NULL,policy_hash TEXT NOT NULL,created_at TEXT NOT NULL,consumed_at TEXT);
 CREATE TABLE plans(id TEXT PRIMARY KEY,kind TEXT NOT NULL,payload TEXT NOT NULL,hash TEXT NOT NULL,state TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE evaluations(id TEXT PRIMARY KEY,capability TEXT NOT NULL,digest TEXT NOT NULL,passed INTEGER NOT NULL,report TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE audit(id TEXT PRIMARY KEY,at TEXT NOT NULL,kind TEXT NOT NULL,details TEXT NOT NULL);
 PRAGMA user_version=1;`);
  db.close();
  chmodSync(join(root, ".hoi/os.sqlite"), 0o600);
  writeYaml(join(root, "policies/actions.yaml"), defaultPolicy);
  writeYaml(join(root, "sources/registry.yaml"), {
    version: 1,
    note: "Source and revision records are canonical in SQLite. Use audit and retrieve to inspect them.",
  });
  writeYaml(join(root, "connections/registry.yaml"), {
    version: 1,
    connections: [],
  });
  writeYaml(join(root, "models/registry.yaml"), {
    version: 1,
    default: "active-host",
    hosts: ["codex", "claude"],
    apiProviders: [],
    automaticSwitching: false,
  });
  writeYaml(join(root, "information-architecture/taxonomy.yaml"), {
    version: 1,
    dimensions: ["client", "project", "documentType"],
    originals: "immutable",
    structuralChanges: "approval-required",
  });
  writeNote(join(root, "context/profile.md"), {
    schemaVersion: 1,
    allowedHosts: ["codex", "claude", "local"],
    content: "# Profile\n\nRun hoi-onboard to add your goals and work context.",
  });
  writeYaml(join(root, "capabilities/meeting-prep.yaml"), {
    schemaVersion: 1,
    id: "meeting-prep",
    version: 1,
    purpose: "Prepare an evidence-linked meeting brief for human review",
    state: "active",
    autonomy: "A2",
    steps: [
      { id: "load_context", tool: "context" },
      { id: "find_evidence", tool: "retrieve" },
      { id: "draft_brief", tool: "meeting-brief" },
    ],
    evaluation: { minEvidence: 1, requireCitations: true },
  });
  atomic(join(root, ".gitignore"), "*\n");
  atomic(
    join(root, "README.md"),
    "# Private HOI OS workspace\n\nYour original files, knowledge, memory, and execution records live here. Keep this directory private and outside the product checkout. Use backup before upgrades.\n",
  );
  atomic(
    join(root, ".hoi/workspace.json"),
    JSON.stringify(
      { schemaVersion: 1, id: uid("workspace"), createdAt: now() },
      null,
      2,
    ),
  );
  return { root, created: true };
}
