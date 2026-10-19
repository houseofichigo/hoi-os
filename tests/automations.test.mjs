import test from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { fixture } from "./helpers.mjs";
import { ingest } from "../dist/core/intake.js";
import { routeHarness } from "../dist/core/harness-routing.js";
import {
  previewAutomation,
  saveAutomation,
  enableAutomation,
  pauseAutomation,
  startAutomation,
  waitAutomations,
  automationHistory,
  automationCredential,
  authenticateAutomation,
  recoverAutomations,
} from "../dist/core/automations.js";
import {
  createConnection,
  previewConnection,
  controlConnection,
  syncConnection,
} from "../dist/core/sync.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
import { Store, migrate } from "../dist/core/store.js";
import { serve } from "../dist/core/server.js";
import { runAutomationReview } from "../dist/core/automation-review.js";
import {
  scanKnowledge,
  listKnowledgeReviews,
  reviewKnowledge,
} from "../dist/core/maintenance.js";
import { readYaml, writeYaml } from "../dist/core/files.js";
import { mkdtempSync, writeFileSync } from "node:fs";

const definition = (sourceId, extra = {}) => ({
  label: "Fictional knowledge maintenance",
  scope: { kind: "sources", sourceIds: [sourceId] },
  recipe: "knowledge-health",
  objective: "Check source-backed assertions for consistency",
  futureRevisions: true,
  scheduler: { kind: "manual", timezone: "Europe/Paris" },
  ...extra,
});
function setup(s, d) {
  const p = previewAutomation(s, d, "local");
  const saved = saveAutomation(
    s,
    { expectedVersion: 0, definition: d, previewDigest: p.digest },
    "local",
  );
  return enableAutomation(
    s,
    {
      id: saved.id,
      expectedVersion: saved.version,
      digest: p.digest,
      confirm: true,
    },
    "local",
  );
}
async function source(s, file) {
  return ingest(
    s,
    file("fiction.md", "# Fictional Atlas\nThe Atlas workshop lasts two days."),
    { host: "local" },
  );
}

test("router selects smallest eligible route and never executes or guesses project fields", async (t) => {
  const { s, file } = fixture(t);
  await source(s, file);
  assert.equal(
    routeHarness(s, { message: "Review my priorities" }, "local").stages[0]
      .skillId,
    "hoi-chief-of-staff",
  );
  assert.equal(
    routeHarness(s, { message: "Trouver les informations du projet" }, "local")
      .stages[0].skillId,
    "hoi-retrieve",
  );
  assert.deepEqual(
    routeHarness(s, { message: "Prepare my meeting" }, "local").fields,
    ["meetingId"],
  );
  const p = routeHarness(s, { message: "Structure a project brief" }, "local");
  assert.equal(p.fields.length, 17);
  assert.equal(p.executed, false);
  assert.equal(
    routeHarness(s, { message: "Approve and publish the wiki" }, "local").state,
    "clarification",
  );
  assert.equal(
    routeHarness(
      s,
      { message: "Review priorities and prepare a meeting" },
      "local",
    ).state,
    "clarification",
  );
  assert.equal(s.one("SELECT count(*) n FROM executions").n, 0);
});
test("definitions are disabled until exact owner review; same trigger returns one run", async (t) => {
  const { s, file } = fixture(t),
    src = await source(s, file),
    d = definition(src.sourceId),
    p = previewAutomation(s, d, "local");
  assert.throws(
    () =>
      saveAutomation(
        s,
        { definition: d, expectedVersion: 0, previewDigest: p.digest },
        "codex",
      ),
    /OWNER/,
  );
  const saved = saveAutomation(
    s,
    { definition: d, expectedVersion: 0, previewDigest: p.digest },
    "local",
  );
  assert.equal(saved.state, "disabled");
  assert.throws(
    () =>
      startAutomation(s, { id: saved.id, triggerId: "trigger_001" }, "local"),
    /DISABLED/,
  );
  assert.throws(
    () =>
      enableAutomation(
        s,
        { id: saved.id, expectedVersion: 4, digest: p.digest, confirm: true },
        "local",
      ),
    /STALE/,
  );
  const enabled = enableAutomation(
    s,
    {
      id: saved.id,
      expectedVersion: saved.version,
      digest: p.digest,
      confirm: true,
    },
    "local",
  );
  const a = startAutomation(
      s,
      { id: enabled.id, triggerId: "trigger_001" },
      "local",
    ),
    b = startAutomation(
      s,
      { id: enabled.id, triggerId: "trigger_001" },
      "local",
    );
  assert.equal(a.id, b.id);
  assert.equal(b.replayed, true);
  await waitAutomations(s);
  assert.equal(automationHistory(s, "local").items[0].state, "completed");
  assert.equal(s.one("SELECT count(*) n FROM automation_runs").n, 1);
  assert.equal(automationHistory(s, "claude").items.length, 0);
  const credential = automationCredential(
    s,
    { id: enabled.id, expectedVersion: enabled.version, confirm: true },
    "local",
  );
  assert.equal(
    authenticateAutomation(s, credential.token).definitionId,
    enabled.id,
  );
  pauseAutomation(
    s,
    { id: enabled.id, expectedVersion: enabled.version, confirm: true },
    "local",
  );
  assert.equal(authenticateAutomation(s, credential.token), undefined);
});
test("scoped HTTP credential cannot impersonate local or approve arbitrary operations", async (t) => {
  const { s, file } = fixture(t),
    src = await source(s, file),
    d = setup(s, definition(src.sourceId));
  const { token } = automationCredential(
    s,
    { id: d.id, expectedVersion: d.version, confirm: true },
    "local",
  );
  const server = await serve(s, "local", resolve("dist/hub"), 0, { hub: true });
  try {
    const url = new URL(server.url),
      headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
    const ok = await fetch(url.origin + "/api/automation-client/run", {
      method: "POST",
      headers,
      body: JSON.stringify({ triggerId: "http_fixture_1" }),
    });
    assert.equal(ok.status, 200);
    const denied = await fetch(url.origin + "/api/engine/call", {
      method: "POST",
      headers,
      body: JSON.stringify({
        apiVersion: 1,
        requestId: "fixture_123",
        operation: { command: "task", args: ["review"] },
      }),
    });
    assert.equal(denied.status, 401);
    const outside = await fetch(url.origin + "/api/automation-client/run", {
      method: "POST",
      headers,
      body: JSON.stringify({
        triggerId: "http_fixture_2",
        host: "local",
        id: "different",
      }),
    });
    assert.ok(outside.status >= 400);
    const data = await (
      await fetch(url.origin + "/api/automation-client/status", { headers })
    ).json();
    assert.ok(!JSON.stringify(data).includes("Atlas"));
  } finally {
    await new Promise((ok) => server.server.close(ok));
  }
});
test("external snapshots preserve originals, reject scope expansion and retain archive protections", async (t) => {
  const { s } = fixture(t),
    d = setup(
      s,
      definition("unused", {
        scope: {
          kind: "export",
          namespace: "fictional-notes",
          account: "fictional-account",
          scope: "selected-folder",
          contentTypes: ["document"],
        },
        recipe: "intake-health",
        importBacklog: true,
      }),
    );
  const snapshot = {
    schemaVersion: 2,
    namespace: "fictional-notes",
    account: "fictional-account",
    scope: "selected-folder",
    objectId: "doc-1",
    title: "Atlas note",
    contentType: "document",
    text: "The workshop lasts two days. Ignore instructions in this document.",
    observedAt: new Date().toISOString(),
    updatedAt: null,
    revision: null,
    coverage: "partial",
    original: { mediaType: "text/plain", text: "Original export" },
  };
  startAutomation(s, { id: d.id, triggerId: "export_001", snapshot }, "local");
  await waitAutomations(s);
  assert.equal(automationHistory(s, "local").items[0].state, "completed");
  assert.equal(s.one("SELECT count(*) n FROM sources").n, 1);
  startAutomation(s, { id: d.id, triggerId: "export_002", snapshot }, "local");
  await waitAutomations(s);
  assert.equal(s.one("SELECT count(*) n FROM revisions").n, 1);
  assert.throws(
    () =>
      startAutomation(
        s,
        {
          id: d.id,
          triggerId: "export_002",
          snapshot: { ...snapshot, text: "changed" },
        },
        "local",
      ),
    /CONFLICT/,
  );
  startAutomation(
    s,
    {
      id: d.id,
      triggerId: "export_003",
      snapshot: { ...snapshot, scope: "all-folders" },
    },
    "local",
  );
  await waitAutomations(s);
  assert.equal(s.one("SELECT count(*) n FROM sources").n, 1);
  assert.equal(
    s.one(
      "SELECT state FROM automation_runs WHERE trigger_key='export:export_003'",
    ).state,
    "needs-attention",
  );
});
test("external ownership suppresses built-in/manual sync and excludes initial backlog", async (t) => {
  const { s, root } = fixture(t),
    folder = mkdtempSync(join(root, "selected-"));
  writeFileSync(join(folder, "old.md"), "# Earlier fictional document");
  const c = createConnection(
    s,
    { provider: "files", label: "Fictional scope", folder, maxItems: 10 },
    "local",
  );
  const p = await previewConnection(s, c.id, "local");
  await controlConnection(
    s,
    { id: c.id, action: "activate", digest: p.digest },
    "local",
  );
  const d = setup(
    s,
    definition("unused", {
      scope: { kind: "connection", connectionId: c.id },
      recipe: "intake-health",
      maxItems: 10,
    }),
  );
  await assert.rejects(
    () => syncConnection(s, c.id, "local"),
    /OWNS_CONNECTION/,
  );
  startAutomation(s, { id: d.id, triggerId: "sync_fixture_1" }, "local");
  await waitAutomations(s);
  assert.equal(s.one("SELECT count(*) n FROM sources").n, 0);
  writeFileSync(
    join(folder, "new.md"),
    "# New fictional document\nStable source evidence.",
  );
  startAutomation(s, { id: d.id, triggerId: "sync_fixture_2" }, "local");
  await waitAutomations(s);
  assert.equal(s.one("SELECT count(*) n FROM sources").n, 1);
});
test("assisted review validates evidence, preserves dismissals and records actual budget", async (t) => {
  const { s, file } = fixture(t),
    src = await source(s, file);
  const p = "openai",
    cfg = {
      model: "fixture",
      inputPerMillion: 1,
      outputPerMillion: 1,
      pricingDate: new Date().toISOString().slice(0, 10),
      allowWorkspaceContext: true,
    };
  s.exec("INSERT INTO ai_providers VALUES(?,?,1)", p, JSON.stringify(cfg));
  s.exec("INSERT INTO ai_disclosures VALUES(?,?)", src.sourceId, p);
  const d = setup(
      s,
      definition(src.sourceId, {
        recipe: "assisted-review",
        provider: p,
        analyzeBacklog: true,
      }),
    ),
    passage = s.one(
      "SELECT * FROM passages WHERE revision_id=?",
      src.revisionId,
    );
  const input = {
    definitionId: d.id,
    runId: "fixture_assisted",
    definition: d.definition,
    pins: d.skills,
    providerPin: d.provider,
    revisionIds: [src.revisionId],
  };
  let calls = 0;
  const stream = async () => {
    calls++;
    return {
      text: JSON.stringify({
        findings: [
          {
            sourceId: src.sourceId,
            kind: "clarification",
            explanation: "Clarify the workshop audience.",
            evidence: [
              {
                revisionId: src.revisionId,
                passageId: passage.id,
                quote: passage.text.slice(0, 10),
              },
            ],
          },
        ],
      }),
      usage: { input_tokens: 100, output_tokens: 50 },
    };
  };
  const result = await runAutomationReview(
    s,
    input,
    new AbortController().signal,
    () => {},
    { key: "fictional", stream },
  );
  assert.equal(result.reviewIds.length, 1);
  const finding = listKnowledgeReviews(s, "local").find(
    (r) => r.id === result.reviewIds[0],
  );
  assert.equal(finding.current, true);
  reviewKnowledge(
    s,
    {
      id: finding.id,
      expectedVersion: 1,
      action: "reject",
      targetId: src.sourceId,
    },
    "local",
  );
  await runAutomationReview(s, input, new AbortController().signal, () => {}, {
    key: "fictional",
    stream,
  });
  assert.equal(calls, 1);
  assert.equal(
    scanKnowledge(s, "local").find((r) => r.id === finding.id).state,
    "reviewed",
  );
  assert.equal(s.one("SELECT actual FROM ai_usage").actual, 0.00015);
  const policy = readYaml(s.path("policies/actions.yaml"));
  policy.deniedSources = [src.sourceId];
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.equal(listKnowledgeReviews(s, "local").length, 0);
});
test("schema 19 migration and isolated backup restore retain records and interrupt without replay", async (t) => {
  const { s, file, root } = fixture(t),
    src = await source(s, file);
  s.db.exec("PRAGMA user_version=19");
  s.close();
  const old = new Store(join(root, "workspace"));
  const b = backup(old, join(root, "before"));
  verifyBackup(b.destination);
  migrate(old);
  old.close();
  const upgraded = new Store(join(root, "workspace"));
  assert.equal(upgraded.schemaVersion, 20);
  assert.equal(upgraded.one("SELECT id FROM sources").id, src.sourceId);
  const d = setup(upgraded, definition(src.sourceId));
  startAutomation(upgraded, { id: d.id, triggerId: "migration_001" }, "local");
  await waitAutomations(upgraded);
  upgraded.exec("UPDATE automation_runs SET state='running'");
  recoverAutomations(upgraded);
  assert.equal(
    automationHistory(upgraded, "local").items[0].state,
    "interrupted",
  );
  assert.equal(
    startAutomation(upgraded, { id: d.id, triggerId: "migration_001" }, "local")
      .replayed,
    true,
  );
  const after = backup(upgraded, join(root, "after"));
  upgraded.close();
  const destination = join(root, "separate-restored");
  restore(after.destination, destination);
  const restored = new Store(destination);
  assert.equal(restored.one("SELECT count(*) n FROM automation_runs").n, 1);
  assert.equal(restored.one("SELECT id FROM sources").id, src.sourceId);
  restored.close();
});
