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
  automationStatus,
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
import {
  runAutomationReview,
  automationDisclosureAllowed,
} from "../dist/core/automation-review.js";
import { importSnapshot } from "../dist/core/external-snapshots.js";
import {
  scanKnowledge,
  listKnowledgeReviews,
  reviewKnowledge,
} from "../dist/core/maintenance.js";
import { readYaml, writeYaml } from "../dist/core/files.js";
import { mkdtempSync, writeFileSync } from "node:fs";
import { triggerAutomationClient } from "../dist/core/automation-client.js";
import { atomic, sha } from "../dist/core/files.js";
import { hostname } from "node:os";

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
    const credentialFile = join(s.root, ".hoi/automation-credentials/fixture");
    atomic(credentialFile, token);
    const { chmodSync } = await import("node:fs");
    chmodSync(credentialFile, 0o600);
    atomic(
      join(s.root, ".hoi/engine-session/endpoint.json"),
      JSON.stringify({
        workspace: sha(resolve(s.root)),
        hostname: hostname(),
        port: Number(url.port),
      }),
    );
    const replay = await triggerAutomationClient(s.root, credentialFile, {
      triggerId: "http_fixture_1",
    });
    assert.equal(replay.replayed, true);
    const status = await triggerAutomationClient(
      s.root,
      credentialFile,
      {},
      "status",
    );
    assert.equal(status.definitionId, d.id);
    assert.ok(!JSON.stringify(status).includes("Atlas"));
    chmodSync(credentialFile, 0o644);
    await assert.rejects(
      () =>
        triggerAutomationClient(s.root, credentialFile, {
          triggerId: "http_fixture_1",
        }),
      /CREDENTIAL_PERMISSIONS/,
    );
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
test("scope-isolated exports never broaden a subsequent maintenance pass", async (t) => {
  const { s } = fixture(t);
  const make = (scope) =>
    setup(
      s,
      definition("unused", {
        scope: {
          kind: "export",
          namespace: "fictional-notes",
          account: "account",
          scope,
          contentTypes: ["document"],
        },
        recipe: "intake-health",
        importBacklog: true,
      }),
    );
  const a = make("public"),
    b = make("private");
  const snap = (scope) => ({
    schemaVersion: 2,
    namespace: "fictional-notes",
    account: "account",
    scope,
    objectId: scope,
    title: scope,
    text: "Fictional knowledge",
    contentType: "document",
    observedAt: new Date().toISOString(),
    updatedAt: null,
    revision: null,
    coverage: "partial",
    original: { mediaType: "text/plain", text: "Original" },
  });
  for (const [d, scope] of [
    [a, "public"],
    [b, "private"],
  ]) {
    startAutomation(
      s,
      { id: d.id, triggerId: "scope_" + scope, snapshot: snap(scope) },
      "local",
    );
    await waitAutomations(s);
  }
  startAutomation(
    s,
    { id: a.id, triggerId: "scope_repeat", snapshot: snap("public") },
    "local",
  );
  await waitAutomations(s);
  const run = automationHistory(s, "local", { id: a.id }).items[0];
  const privateRevision = s.one(
    "SELECT revision_id FROM automation_snapshots WHERE scope='private'",
  ).revision_id;
  assert.ok(!run.revisionIds.includes(privateRevision));
  assert.equal(run.revisionIds.length, 1);
  assert.equal(
    s.one("SELECT count(*) n FROM automation_backlog_revisions").n,
    2,
  );
});
test("item limits rotate checked sources; scope revocation removes titles, history and counts", async (t) => {
  const { s, file } = fixture(t),
    a = await source(s, file),
    b = await ingest(
      s,
      file("other.md", "# Another fictional source\nDifferent evidence."),
    );
  const d = setup(
    s,
    definition(a.sourceId, {
      scope: { kind: "sources", sourceIds: [a.sourceId, b.sourceId] },
      maxItems: 1,
    }),
  );
  for (const triggerId of ["bounded_1", "bounded_2"]) {
    startAutomation(s, { id: d.id, triggerId }, "local");
    await waitAutomations(s);
  }
  const runs = automationHistory(s, "local").items;
  assert.equal(runs.length, 2);
  assert.ok(runs.every((x) => x.revisionIds.length === 1));
  assert.notEqual(runs[0].revisionIds[0], runs[1].revisionIds[0]);
  const first = automationHistory(s, "local", { limit: 1 });
  assert.ok(first.nextCursor);
  assert.notEqual(
    automationHistory(s, "local", { limit: 1, cursor: first.nextCursor })
      .items[0].id,
    first.items[0].id,
  );
  const policy = readYaml(s.path("policies/actions.yaml"));
  policy.deniedSources = [a.sourceId];
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.equal(automationStatus(s, "local").definitions.length, 0);
  assert.equal(automationHistory(s, "local").items.length, 0);
  assert.throws(
    () => startAutomation(s, { id: d.id, triggerId: "revoked_1" }, "local"),
    /SOURCE_UNAVAILABLE/,
  );
});
test("daily triggers coalesce and pause cancels before work begins", async (t) => {
  const { s, file } = fixture(t),
    src = await source(s, file),
    d = setup(
      s,
      definition(src.sourceId, {
        scheduler: {
          kind: "codex",
          timezone: "Europe/Paris",
          cadence: "daily",
        },
      }),
    );
  const a = startAutomation(s, { id: d.id, triggerId: "codex_first" }, "local"),
    b = startAutomation(s, { id: d.id, triggerId: "n8n_second" }, "local");
  assert.equal(a.id, b.id);
  pauseAutomation(
    s,
    { id: d.id, expectedVersion: d.version, confirm: true },
    "local",
  );
  await waitAutomations(s);
  assert.equal(automationHistory(s, "local").items[0].state, "cancelled");
  assert.equal(s.one("SELECT count(*) n FROM automation_checks").n, 0);
});
test("invalid citations and uncertain dispatch remain blocked without a second paid call", async (t) => {
  const { s, file } = fixture(t),
    src = await source(s, file),
    cfg = {
      model: "fixture",
      inputPerMillion: 1,
      outputPerMillion: 1,
      pricingDate: new Date().toISOString().slice(0, 10),
      allowWorkspaceContext: true,
    };
  s.exec("INSERT INTO ai_providers VALUES('openai',?,1)", JSON.stringify(cfg));
  s.exec("INSERT INTO ai_disclosures VALUES(?,'openai')", src.sourceId);
  const d = setup(
    s,
    definition(src.sourceId, {
      recipe: "assisted-review",
      provider: "openai",
      analyzeBacklog: true,
    }),
  );
  const input = {
    definitionId: d.id,
    runId: "invalid_fixture",
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
            explanation: "Invented",
            evidence: [
              {
                revisionId: src.revisionId,
                passageId: "invented",
                quote: "not evidence",
              },
            ],
          },
        ],
      }),
      usage: { input_tokens: 100, output_tokens: 50 },
    };
  };
  await assert.rejects(
    () =>
      runAutomationReview(s, input, new AbortController().signal, () => {}, {
        key: "fictional",
        stream,
      }),
    /INVALID_EVIDENCE/,
  );
  assert.equal(s.one("SELECT state FROM ai_jobs").state, "failed");
  assert.equal(s.one("SELECT count(*) n FROM knowledge_reviews").n, 0);
  await assert.rejects(
    () =>
      runAutomationReview(s, input, new AbortController().signal, () => {}, {
        key: "fictional",
        stream,
      }),
    /RECONCILIATION/,
  );
  assert.equal(calls, 1);
  const other = {
    ...input,
    definitionId: "other-approved-fixture",
    runId: "uncertain_fixture",
  };
  const failure = async () => {
    calls++;
    throw Error("Network after dispatch");
  };
  await assert.rejects(
    () =>
      runAutomationReview(s, other, new AbortController().signal, () => {}, {
        key: "fictional",
        stream: failure,
      }),
    /Network/,
  );
  assert.equal(
    s.one("SELECT count(*) n FROM ai_jobs WHERE state='uncertain'").n,
    1,
  );
  await assert.rejects(
    () =>
      runAutomationReview(s, other, new AbortController().signal, () => {}, {
        key: "fictional",
        stream: failure,
      }),
    /RECONCILIATION/,
  );
  assert.equal(calls, 2);
  const costly = {
    ...input,
    definitionId: "costly",
    definition: { ...d.definition, maxCost: 0.000001 },
  };
  await assert.rejects(() =>
    runAutomationReview(s, costly, new AbortController().signal, () => {}, {
      key: "fictional",
      stream,
    }),
  );
  assert.equal(calls, 2);
});
test("future disclosure is explicit, scoped, excludes backlog and stops on provider changes", async (t) => {
  const { s } = fixture(t),
    cfg = {
      model: "fixture",
      inputPerMillion: 1,
      outputPerMillion: 1,
      pricingDate: new Date().toISOString().slice(0, 10),
      allowWorkspaceContext: true,
    };
  s.exec("INSERT INTO ai_providers VALUES('openai',?,1)", JSON.stringify(cfg));
  const scope = {
    kind: "export",
    namespace: "fictional",
    account: "account",
    scope: "selected",
    contentTypes: ["document"],
  };
  const d = setup(
    s,
    definition("unused", {
      scope,
      recipe: "intake-review",
      provider: "openai",
      discloseFutureSources: true,
      importBacklog: true,
    }),
  );
  await new Promise((ok) => setTimeout(ok, 5));
  const timestamp = new Date().toISOString();
  const snapshot = {
    schemaVersion: 2,
    namespace: scope.namespace,
    account: scope.account,
    scope: scope.scope,
    objectId: "doc",
    title: "Fictional",
    contentType: "document",
    text: "Scope-limited new evidence",
    observedAt: timestamp,
    updatedAt: timestamp,
    revision: null,
    coverage: "complete",
    original: { mediaType: "text/plain", text: "Original" },
  };
  const imported = await importSnapshot(
    s,
    snapshot,
    d.definition,
    d.enabledAt,
    "local",
    () => {},
  );
  assert.equal(
    automationDisclosureAllowed(
      s,
      d.id,
      imported.sourceId,
      imported.revisionId,
      "openai",
    ),
    true,
  );
  assert.equal(
    automationDisclosureAllowed(
      s,
      d.id,
      imported.sourceId,
      imported.revisionId,
      "anthropic",
    ),
    false,
  );
  s.exec(
    "INSERT INTO automation_backlog_revisions VALUES(?,?)",
    d.id,
    imported.revisionId,
  );
  assert.equal(
    automationDisclosureAllowed(
      s,
      d.id,
      imported.sourceId,
      imported.revisionId,
      "openai",
    ),
    false,
  );
  s.exec("DELETE FROM automation_backlog_revisions");
  s.exec("UPDATE ai_providers SET version=2");
  assert.equal(
    automationDisclosureAllowed(
      s,
      d.id,
      imported.sourceId,
      imported.revisionId,
      "openai",
    ),
    false,
  );
  assert.throws(
    () =>
      startAutomation(
        s,
        { id: d.id, triggerId: "changed_provider", snapshot },
        "local",
      ),
    /REVIEW_REQUIRED/,
  );
  assert.equal(s.one("SELECT count(*) n FROM ai_disclosures").n, 0);
});
test("schema 19 migration and isolated backup restore retain records and interrupt without replay", async (t) => {
  const { s, file, root } = fixture(t),
    src = await source(s, file);
  // Reconstruct the pre-upgrade schema, rather than only lowering its version.
  for (const { name } of s.all(
    "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'automation_%'",
  ))
    s.db.exec(`DROP TRIGGER ${name}`);
  for (const { name } of s.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'automation_%' AND name!='automation_definitions'",
  ))
    s.db.exec(`DROP TABLE ${name}`);
  s.db.exec("DROP TABLE automation_definitions");
  s.db.exec("PRAGMA user_version=19");
  s.close();
  const old = new Store(join(root, "workspace"));
  assert.equal(
    old.one("SELECT name FROM sqlite_master WHERE name='automation_runs'"),
    undefined,
  );
  const b = backup(old, join(root, "before"));
  verifyBackup(b.destination);
  migrate(old);
  old.close();
  const upgraded = new Store(join(root, "workspace"));
  assert.equal(upgraded.schemaVersion, 20);
  assert.equal(upgraded.one("SELECT id FROM sources").id, src.sourceId);
  const d = setup(upgraded, definition(src.sourceId));
  const credential = automationCredential(
    upgraded,
    { id: d.id, expectedVersion: d.version, confirm: true },
    "local",
  );
  atomic(upgraded.path(".hoi/automation-credentials/test"), credential.token);
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
  assert.equal(
    restored.one("SELECT state FROM automation_definitions").state,
    "paused",
  );
  assert.equal(authenticateAutomation(restored, credential.token), undefined);
  const { existsSync } = await import("node:fs");
  assert.equal(
    existsSync(restored.path(".hoi/automation-credentials/test")),
    false,
  );
  restored.close();
});
