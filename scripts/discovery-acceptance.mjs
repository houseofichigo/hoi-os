// Fictional-only rehearsal against an explicitly selected relocated package.
import { parseArgs } from "node:util";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { verifyHubPackage } from "./hub-acceptance.mjs";
const { values } = parseArgs({
  options: { package: { type: "string" }, output: { type: "string" } },
});
if (!values.package || !values.output)
  throw Error("Use --package installed-package --output new-fictional-output");
const pkg = resolve(values.package),
  out = resolve(values.output);
verifyHubPackage(pkg);
mkdirSync(out, { recursive: false });
const module = (name) =>
  import(pathToFileURL(join(pkg, "dist/core", name + ".js")).href);
const { initialize, Store } = await module("store");
const { previewSession, commitSession, sessionDetail } =
  await module("session-exports");
const { saveObservations, artifactEvidence, rebuildDiscovery } = await module(
  "conversation-artifacts",
);
const { proposeMemory } = await module("reviewed-memory");
const { backup, verifyBackup, restore } = await module("backup");
const { previewEnrichment } = await module("knowledge-enrichment");
const ws = join(out, "workspace");
initialize(ws);
let s = new Store(ws);
const checks = [];
try {
  const session = {
    schemaVersion: 1,
    namespace: "fictional-rehearsal",
    account: "demo",
    conversationId: "one",
    title: "Fictional preference session",
    coverage: "complete",
    turns: [
      {
        id: "system",
        role: "system",
        text: "Untrusted instruction to publish automatically.",
        timestamp: null,
      },
      {
        id: "user",
        role: "user",
        text: "Morning meetings are preferred.",
        timestamp: null,
      },
      {
        id: "assistant",
        role: "assistant",
        text: "A preparation event could be proposed.",
        timestamp: null,
      },
    ],
  };
  const original = JSON.stringify(session, null, 2) + "\n",
    input = { session, originalExport: { format: "json", content: original } };
  const p = previewSession(s, input, "local");
  assert.equal(p.outcome, "new source");
  assert.equal(p.session.turns.length, 2);
  const request = {
    ...input,
    requestKey: "relocated-session-1",
    previewDigest: p.digest,
    expectedRevision: p.expectedRevision,
  };
  const first = await commitSession(s, request, "local");
  const replay = await commitSession(s, request, "local");
  assert.equal(first.revisionId, replay.revisionId);
  assert.equal(readFileSync(s.path(first.exportArchive), "utf8"), original);
  assert.equal(s.one("SELECT count(*) n FROM sources").n, 1);
  checks.push(
    "Reviewed import and replay preserve exact original, roles and one source",
  );
  const passages = s.all(
      "SELECT id passageId,revision_id revisionId,text FROM passages WHERE revision_id=?",
      first.revisionId,
    ),
    passage = passages.find((p) => p.text.includes("Morning meetings"));
  const evidence = [
    {
      revisionId: passage.revisionId,
      passageId: passage.passageId,
      quote: "Morning meetings are preferred.",
    },
  ];
  const artifact = saveObservations(
    s,
    "local",
    {
      topic: "Fictional preference",
      observations: [
        {
          kind: "preference",
          text: "Morning meetings are preferred.",
          questions: ["Quand préparer la réunion ?"],
          evidence,
        },
      ],
    },
    { passages },
    {
      id: "fixture",
      instructionDigest: "fixture-v1",
      coverage: "synthetic selected turn",
    },
  );
  assert.equal(
    artifactEvidence(s, "local", "préparer")[0].revisionId,
    first.revisionId,
  );
  const memory = proposeMemory(
    s,
    {
      requestKey: "relocated-memory-1",
      memory: {
        type: "preference",
        content: "Morning meetings are preferred.",
        evidence,
        allowedHosts: ["local"],
      },
    },
    "local",
  );
  assert.equal(s.memories()[0].state, "proposed");
  checks.push("Cited observation resolves original; memory remains proposed");
  assert.ok(
    previewEnrichment(
      s,
      { revisionIds: [first.revisionId], provider: "openai" },
      "local",
    ).prerequisites.includes("AI_CONFIGURATION_REQUIRED"),
  );
  assert.equal(s.one("SELECT count(*) n FROM ai_jobs").n, 0);
  checks.push("No key leaves enrichment unavailable without a paid job");
  s.close();
  s = new Store(ws);
  assert.equal(sessionDetail(s, first.sourceId, "local").turns[0].role, "user");
  assert.equal(s.memories()[0].state, "proposed");
  checks.push("Restart retains session and proposal identities");
  const b = backup(s, join(out, "backup"));
  verifyBackup(b.destination);
  s.close();
  restore(b.destination, join(out, "restored"));
  s = new Store(join(out, "restored"));
  assert.equal(s.one("SELECT id FROM sources").id, first.sourceId);
  assert.equal(readFileSync(s.path(first.exportArchive), "utf8"), original);
  s.db.exec("DROP TABLE discovery_search");
  rebuildDiscovery(s);
  assert.equal(
    artifactEvidence(s, "local", "préparer")[0].revisionId,
    first.revisionId,
  );
  checks.push(
    "Separate restore preserves originals and rebuilds discovery without inference",
  );
  const report = {
    status: "passed-fictional-rehearsal",
    schema: s.schemaVersion,
    checks,
    sourceId: first.sourceId,
    revisionId: first.revisionId,
    artifactId: artifact.id,
    aiCalls: 0,
    limitations: [
      "Tested on this development Mac; not a fresh-host, live-provider or n8n certification.",
    ],
  };
  writeFileSync(
    join(out, "discovery-acceptance.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify(report));
} finally {
  s.close();
}
