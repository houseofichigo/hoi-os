import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import { join, resolve } from "node:path";
import { fixture } from "./helpers.mjs";
import { acquireLock, inspectLock, recoverLock } from "../dist/core/locks.js";
import { health, supportReport } from "../dist/core/diagnostics.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
import { ingest, retrieve } from "../dist/core/intake.js";
import { Store } from "../dist/core/store.js";
import { capture, reviewMemory } from "../dist/core/knowledge.js";
const product = resolve(".");
test("lock recovery refuses active and uncertain owners; recovers verified dead owner", (t) => {
  const { s } = fixture(t);
  const release = acquireLock(s.root, "test");
  assert.equal(inspectLock(s.root).code, "LOCK_ACTIVE");
  assert.throws(() => recoverLock(s.root), /LOCK_ACTIVE/);
  assert.throws(() => acquireLock(s.root, "competing"), /LOCK_BUSY/);
  release();
  const child = spawnSync(
    process.execPath,
    ["-e", "console.log(process.pid)"],
    { encoding: "utf8" },
  );
  mkdirSync(s.path(".hoi/lock"));
  writeFileSync(
    s.path(".hoi/lock/owner.json"),
    JSON.stringify({ pid: Number(child.stdout), hostname: hostname() }),
  );
  assert.equal(recoverLock(s.root).code, "LOCK_RECOVERED");
  mkdirSync(s.path(".hoi/lock"));
  writeFileSync(
    s.path(".hoi/lock/owner.json"),
    JSON.stringify({ pid: 999999, hostname: "another-machine" }),
  );
  assert.throws(() => recoverLock(s.root), /LOCK_UNKNOWN/);
});
test("support diagnostics export only allowlisted aggregate fields and verify backup contents", async (t) => {
  const { s, file, root } = fixture(t);
  await ingest(
    s,
    file("SECRET_ACCOUNT.md", "SECRET_CONTENT secret@example.invalid"),
  );
  const b = join(root, "backup");
  backup(s, b);
  let report = supportReport(s, "codex");
  assert.ok(report.checks.some((c) => c.code === "BACKUP_VERIFIED"));
  assert.doesNotMatch(
    JSON.stringify(report),
    /SECRET|example.invalid|workspace|destination/,
  );
  writeFileSync(join(b, ".hoi/workspace.json"), "corrupt");
  assert.ok(
    supportReport(s, "codex").checks.some((c) => c.code === "BACKUP_INVALID"),
  );
});
test("health reports current schema and privacy-safe operational counts", async (t) => {
  const { s, file } = fixture(t);
  await ingest(s, file("private-title.md", "private content"));
  const report = health(s, "codex");
  assert.equal(report.schemaCurrent, true);
  assert.equal(report.schemaVersion, report.currentSchemaVersion);
  assert.equal(report.counts.sources, 1);
  assert.equal(report.counts.revisions, 1);
  assert.equal(report.revisionOutcomes.ready, 1);
  assert.doesNotMatch(JSON.stringify(report), /private-title|private content/);
});
test("failed disk write retains old atomic file and cleans temp files", (t) => {
  const { file, root } = fixture(t);
  const target = file("stable.txt", "original");
  const script = `import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module'; const original=fs.writeFileSync; fs.writeFileSync=()=>{const e=Error('disk full');e.code='ENOSPC';throw e;}; syncBuiltinESMExports(); const {atomic}=await import('./dist/core/files.js'); try {atomic(process.argv[1],'replacement');process.exitCode=2;} catch(e){if(e.code!=='ENOSPC')throw e;}`;
  assert.equal(
    spawnSync(process.execPath, ["--input-type=module", "-e", script, target], {
      cwd: product,
    }).status,
    0,
  );
  assert.equal(readFileSync(target, "utf8"), "original");
  assert.equal(
    readdirSync(root).some((x) => x.endsWith(".tmp")),
    false,
  );
});
test("interrupted backup is never published as complete", async (t) => {
  const { s, root, file } = fixture(t);
  await ingest(s, file("a.md", "Evidence"));
  const dest = join(root, "interrupted");
  const script = `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.renameSync;fs.renameSync=(a,b)=>{if(String(b).endsWith('manifest.json'))process.exit(77);return original(a,b);};syncBuiltinESMExports();const {Store}=await import('./dist/core/store.js');const {backup}=await import('./dist/core/backup.js');backup(new Store(process.argv[1]),process.argv[2]);`;
  assert.equal(
    spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, s.root, dest],
      { cwd: product },
    ).status,
    77,
  );
  assert.equal(existsSync(dest), false);
  assert.throws(() => verifyBackup(dest));
  assert.ok(backup(s, dest).verified);
});
test("restore, reinstall adapters, reindex and rollback preserve source identity and approved memory", async (t) => {
  const { s, root, file } = fixture(t);
  const a = await ingest(
    s,
    file("a.md", "Atlas launch approved September evidence"),
  );
  const m = capture(
    s,
    { type: "decision", content: "Confirmed pilot decision" },
    "codex",
  );
  reviewMemory(s, m.id, "approved", "codex");
  writeFileSync(s.path("AGENTS.md"), "Unrelated instructions remain.\n");
  const b = join(root, "backup"),
    restored = join(root, "relocated");
  backup(s, b);
  restore(b, restored);
  const setup = spawnSync(
    process.execPath,
    [
      "scripts/setup.mjs",
      "--workspace",
      restored,
      "--hosts",
      "both",
      "--non-interactive",
      "--skip-build",
    ],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(setup.status, 0, setup.stderr);
  const cli = spawnSync(
    process.execPath,
    ["bin/hoi.mjs", "reindex", "--workspace", restored, "--host", "codex"],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr);
  const r = new Store(restored);
  t.after(() => r.close());
  assert.equal(retrieve(r, "Atlas", "codex").results[0].sourceId, a.sourceId);
  for (const rev of r.all("SELECT * FROM revisions"))
    assert.ok(existsSync(r.path(rev.original_path)));
  assert.match(
    readFileSync(join(restored, "AGENTS.md"), "utf8"),
    /Unrelated instructions/,
  );
  assert.ok(r.memories().some((x) => x.id === m.id && x.state === "approved"));
  const preUpdate = join(root, "before-update");
  backup(r, preUpdate);
  writeFileSync(join(restored, "AGENTS.md"), "changed");
  r.close();
  restore(preUpdate, restored);
  assert.match(
    readFileSync(join(restored, "AGENTS.md"), "utf8"),
    /Unrelated instructions/,
  );
});
test("killed restore between directory swaps recovers previous workspace", async (t) => {
  const { s, root, file } = fixture(t);
  await ingest(s, file("a.md", "Atlas stable original"));
  const b = join(root, "backup"),
    target = join(root, "target");
  backup(s, b);
  restore(b, target);
  writeFileSync(join(target, "sentinel.txt"), "previous workspace");
  const script = `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=fs.renameSync;fs.renameSync=(a,b)=>{const result=original(a,b);if(String(b).includes('.previous_'))process.exit(78);return result;};syncBuiltinESMExports();const {restore}=await import('./dist/core/backup.js');restore(process.argv[1],process.argv[2]);`;
  assert.equal(
    spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, b, target],
      { cwd: product },
    ).status,
    78,
  );
  assert.equal(existsSync(target), false);
  const { recoverRestore } = await import("../dist/core/backup.js");
  assert.equal(recoverRestore(target).code, "RESTORE_RECOVERED");
  assert.equal(
    readFileSync(join(target, "sentinel.txt"), "utf8"),
    "previous workspace",
  );
  restore(b, target);
  assert.ok(existsSync(join(target, ".hoi/os.sqlite")));
});
test("ingestion disk failure never publishes an unpreserved revision", async (t) => {
  const { s, root, file } = fixture(t);
  const source = file("a.md", "Atlas preserved");
  const first = await ingest(s, source);
  writeFileSync(source, "changed content");
  const script = `import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';fs.writeFileSync=()=>{const e=Error('full');e.code='ENOSPC';throw e;};syncBuiltinESMExports();const {Store}=await import('./dist/core/store.js');const {ingest}=await import('./dist/core/intake.js');const s=new Store(process.argv[1]);try{await ingest(s,process.argv[2]);process.exitCode=2;}catch(e){if(e.code!=='ENOSPC')throw e;}finally{s.close();}`;
  assert.equal(
    spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, s.root, source],
      { cwd: product },
    ).status,
    0,
  );
  assert.equal(
    s.one("SELECT current_revision FROM sources WHERE id=?", first.sourceId)
      .current_revision,
    first.revisionId,
  );
  assert.equal((await ingest(s, source)).status, "ready");
});
test("launcher reports actionable argument and missing workspace errors", () => {
  const a = spawnSync(process.execPath, ["scripts/start.mjs"], {
    cwd: product,
    encoding: "utf8",
  });
  assert.equal(a.status, 1);
  assert.match(a.stderr, /START_ARGUMENTS/);
  const b = spawnSync(
    process.execPath,
    [
      "scripts/start.mjs",
      "--workspace",
      "/nonexistent-hoi-test-workspace",
      "--host",
      "codex",
      "--no-open",
    ],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(b.status, 1);
  assert.match(b.stderr, /WORKSPACE_MISSING/);
});
test("killed import resumes preserved pending revision and stale writer can recover", async (t) => {
  const { s, file } = fixture(t);
  const input = file("a.md", "Cedar survives interruption");
  const script = `const {Store}=await import('./dist/core/store.js');const {acquireLock}=await import('./dist/core/locks.js');const {ingest}=await import('./dist/core/intake.js');const s=new Store(process.argv[1]);acquireLock(s.root,'interrupted-import');const tx=s.tx.bind(s);s.tx=fn=>{const result=tx(fn);if(s.one("SELECT id FROM revisions WHERE status='pending'"))process.exit(79);return result;};await ingest(s,process.argv[2]);`;
  assert.equal(
    spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script, s.root, input],
      { cwd: product },
    ).status,
    79,
  );
  const pending = s.one("SELECT * FROM revisions");
  assert.equal(pending.status, "pending");
  assert.equal(
    readFileSync(s.path(pending.original_path), "utf8"),
    "Cedar survives interruption",
  );
  assert.equal(recoverLock(s.root).code, "LOCK_RECOVERED");
  assert.equal((await ingest(s, input)).revisionId, pending.id);
});
test("private pilot importer takes verified backup and evaluator records bilingual labeled results", async (t) => {
  const { s, root, file } = fixture(t);
  const { entity } = await import("../dist/core/knowledge.js");
  const { sha } = await import("../dist/core/files.js");
  const p = entity(s, { type: "project", name: "Synthetic pilot" });
  const files = Array.from({ length: 50 }, (_, i) => {
    const text = `pilotword${i} valid evidence`,
      path = file(`pilot-${i}.md`, text);
    return { path, sha256: sha(text) };
  });
  const manifest = file(
    "selection.json",
    JSON.stringify({ projectId: p.id, files }),
  );
  const imported = spawnSync(
    process.execPath,
    [
      "scripts/import-pilot.mjs",
      "--workspace",
      s.root,
      "--input",
      manifest,
      "--backup",
      join(root, "pilot-backup"),
    ],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(imported.status, 0, imported.stderr);
  verifyBackup(join(root, "pilot-backup"));
  assert.equal(s.one("SELECT COUNT(*) n FROM sources").n, 50);
  const cases = Array.from({ length: 30 }, (_, i) => {
    const missing = i >= 28;
    const result = missing
      ? null
      : retrieve(s, `pilotword${i}`, "codex").results[0];
    return {
      id: `q${i}`,
      question: missing ? "unanswerable9922" : `pilotword${i}`,
      language: i % 2 ? "fr" : "en",
      category:
        i === 29
          ? "restricted"
          : missing
            ? "missing"
            : i % 2
              ? "outdated"
              : "current",
      expected: result
        ? [{ sourceId: result.sourceId, revisionId: result.revisionId }]
        : [],
      forbiddenSourceIds: [],
    };
  });
  const questions = file("questions.json", JSON.stringify(cases)),
    output = join(root, "results.json");
  const evaluation = spawnSync(
    process.execPath,
    [
      "scripts/evaluate-retrieval.mjs",
      "--workspace",
      s.root,
      "--input",
      questions,
      "--host",
      "codex",
      "--output",
      output,
    ],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(evaluation.status, 0, evaluation.stderr);
  assert.equal(JSON.parse(readFileSync(output, "utf8")).recallAt5, 1);
});
test("restoring a workspace with empty memory and source directories remains usable", (t) => {
  const { s, root } = fixture(t),
    b = join(root, "backup"),
    target = join(root, "restored");
  backup(s, b);
  restore(b, target);
  const restored = new Store(target);
  try {
    assert.deepEqual(restored.memories(), []);
    assert.ok(existsSync(join(target, "originals")));
    assert.ok(existsSync(join(target, "working")));
  } finally {
    restored.close();
  }
  const setup = spawnSync(
    process.execPath,
    [
      "scripts/setup.mjs",
      "--workspace",
      target,
      "--hosts",
      "both",
      "--non-interactive",
      "--skip-build",
    ],
    { cwd: product, encoding: "utf8" },
  );
  assert.equal(setup.status, 0, setup.stderr);
});
test("backup rejects an original changed outside HOI even if the manifest hashes match", async (t) => {
  const { s, root, file } = fixture(t);
  await ingest(s, file("a.md", "Preserved original"));
  const revision = s.one("SELECT * FROM revisions");
  writeFileSync(s.path(revision.original_path), "external corruption");
  assert.throws(
    () => backup(s, join(root, "bad-backup")),
    /recorded revision checksum/,
  );
  assert.equal(existsSync(join(root, "bad-backup")), false);
});
