import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import {
  Store,
  migrate,
  WIKI_SCHEMA_SQL,
  CURRENT_SCHEMA_VERSION,
} from "../dist/core/store.js";
import { TASK_SCHEMA_SQL } from "../dist/core/task-schema.js";
import { INTAKE_SCHEMA_SQL } from "../dist/core/work-intake-schema.js";
import { MAINTENANCE_SCHEMA_SQL } from "../dist/core/maintenance-schema.js";
import { CHAT_SCHEMA_SQL } from "../dist/core/chat-schema.js";
import { CALENDAR_SQL } from "../dist/core/calendar.js";
import { HUB_SQL } from "../dist/core/hub.js";
import { WORKSPACE_SQL } from "../dist/core/workspace.js";
import { SYNC_SQL } from "../dist/core/sync.js";
import { INTAKE_RELIABILITY_SQL } from "../dist/core/intake-schema.js";
import { DAILY_WORKSPACE_SQL } from "../dist/core/daily-workspace.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { capture, reviewMemory } from "../dist/core/knowledge.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
const migrations = [
  WIKI_SCHEMA_SQL,
  TASK_SCHEMA_SQL,
  INTAKE_SCHEMA_SQL,
  MAINTENANCE_SCHEMA_SQL,
  CHAT_SCHEMA_SQL,
  CALENDAR_SQL,
  HUB_SQL,
  WORKSPACE_SQL,
  SYNC_SQL,
  INTAKE_RELIABILITY_SQL,
  DAILY_WORKSPACE_SQL,
];
for (let version = 1; version < CURRENT_SCHEMA_VERSION; version++)
  test(`schema ${version}: absent later tables are recreated; backup, relocated upgrade and rollback preserve base records`, async (t) => {
    const f = fixture(t),
      r = await ingest(
        f.s,
        f.file("original.md", "Fictional Orchard stable evidence."),
      );
    const memory = capture(
      f.s,
      { type: "decision", content: "Confirmed fictional workshop choice" },
      "codex",
    );
    reviewMemory(f.s, memory.id, "approved", "codex");
    f.s.exec(
      "INSERT INTO approvals VALUES(?,?,?,?,?)",
      "fixture-approval",
      "exact-fixture-hash",
      "fixture-policy",
      "2026-09-01T00:00:00Z",
      null,
    );
    writeFileSync(f.s.path("AGENTS.md"), "Keep unrelated host instructions.\n");
    const original = f.s.one(
        "SELECT * FROM revisions WHERE id=?",
        r.revisionId,
      ),
      bytes = readFileSync(f.s.path(original.original_path));
    // Remove all features introduced after this version, rather than only lowering PRAGMA.
    const absent = migrations
      .slice(version - 1)
      .flatMap((sql) =>
        [...sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]),
      );
    f.s.db.exec("PRAGMA foreign_keys=OFF");
    for (const table of absent.reverse())
      f.s.db.exec("DROP TABLE IF EXISTS " + table);
    f.s.db.exec(`PRAGMA user_version=${version}`);
    f.s.close();
    const old = new Store(f.s.root);
    assert.equal(old.schemaVersion, version);
    for (const table of absent)
      assert.equal(
        old.one(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          table,
        ),
        undefined,
      );
    const dest = join(f.root, "verified backup"),
      copyPath = join(f.root, "upgraded copy"),
      rollbackPath = join(f.root, "rollback copy");
    backup(old, dest);
    old.close();
    verifyBackup(dest);
    restore(dest, copyPath);
    let copy = new Store(copyPath);
    migrate(copy);
    copy.close();
    copy = new Store(copyPath);
    try {
      assert.equal(copy.schemaVersion, CURRENT_SCHEMA_VERSION);
      assert.equal(
        retrieve(copy, "Orchard", "codex").results[0].revisionId,
        r.revisionId,
      );
      assert.deepEqual(readFileSync(copy.path(original.original_path)), bytes);
      assert.equal(
        copy.memories().find((m) => m.id === memory.id).state,
        "approved",
      );
      assert.equal(
        copy.one(
          "SELECT action_hash FROM approvals WHERE id=?",
          "fixture-approval",
        ).action_hash,
        "exact-fixture-hash",
      );
      assert.equal(
        readFileSync(copy.path("AGENTS.md"), "utf8"),
        "Keep unrelated host instructions.\n",
      );
      for (const table of absent)
        assert.ok(
          copy.one(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            table,
          ),
        );
      assert.deepEqual(copy.all("PRAGMA foreign_key_check"), []);
    } finally {
      copy.close();
    }
    restore(dest, rollbackPath);
    const rollback = new Store(rollbackPath),
      untouched = new Store(f.s.root);
    try {
      assert.equal(rollback.schemaVersion, version);
      assert.equal(untouched.schemaVersion, version);
      assert.deepEqual(
        readFileSync(rollback.path(original.original_path)),
        bytes,
      );
    } finally {
      rollback.close();
      untouched.close();
    }
  });
