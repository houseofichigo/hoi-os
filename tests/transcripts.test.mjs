import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { ingest } from "../dist/core/intake.js";
import {
  previewTranscript,
  commitTranscript,
} from "../dist/core/transcripts.js";
import {
  prepareExtraction,
  submitExtraction,
  listMentions,
  resolveMention,
} from "../dist/core/work-intake.js";
import { reviewProposal, listTasks } from "../dist/core/tasks.js";
async function seed(t) {
  const f = fixture(t);
  await ingest(
    f.s,
    f.file(
      "transcript.md",
      "Alex: I will share the workshop notes.\nMorgan: Merci.",
    ),
    {},
  );
  const r = f.s.one("SELECT * FROM sources LIMIT 1");
  const p = previewTranscript(
    f.s,
    { sourceId: r.id, revisionId: r.current_revision },
    "local",
  );
  const v = {
    sourceId: p.sourceId,
    revisionId: p.revisionId,
    digest: p.digest,
    speakers: p.segments.map((x) => ({
      passageId: x.passageId,
      speaker: null,
    })),
    confirm: true,
  };
  return { ...f, p, v };
}
test("transcript review reuses original evidence and approval creates one standalone task", async (t) => {
  const { s, p, v } = await seed(t);
  assert.throws(() => commitTranscript(s, v, "codex"), /LOCAL_REVIEW_REQUIRED/);
  const count = s.one("SELECT COUNT(*) n FROM sources").n;
  const row = commitTranscript(s, v, "local");
  assert.equal(row.item.occurredAt, null);
  assert.equal(commitTranscript(s, v, "local").id, row.id);
  assert.equal(s.one("SELECT COUNT(*) n FROM sources").n, count);
  const req = prepareExtraction(s, row.id, "local");
  const result = {
    runId: req.runId,
    requestDigest: req.requestDigest,
    adapter: "codex",
    extractionVersion: "commitments-v1",
    mentions: [
      {
        task: {
          title: "Share workshop notes",
          outcome: "Notes shared",
          owner: "Alex",
        },
        evidence: [
          {
            revisionId: p.revisionId,
            passageId: p.segments[0].passageId,
            quote: "I will share the workshop notes.",
          },
        ],
        intent: "commitment",
        actor: "Alex",
      },
    ],
  };
  submitExtraction(s, result, "local");
  submitExtraction(s, result, "local");
  const m = listMentions(s, "local")[0];
  const resolved = resolveMention(
    s,
    { id: m.id, expectedVersion: m.version, decision: "separate" },
    "local",
  );
  const prop = s.one("SELECT id,version FROM task_proposals LIMIT 1");
  reviewProposal(
    s,
    { id: prop.id, expectedVersion: prop.version, decision: "approved" },
    "local",
  );
  assert.equal(listTasks(s, "local").length, 1);
  assert.equal(listTasks(s, "local")[0].projectId, null);
});
test("changed revisions, altered manifests and archived sources reject transcript review", async (t) => {
  const { s, p, v } = await seed(t);
  assert.throws(() => commitTranscript(s, v, "codex"), /LOCAL_REVIEW_REQUIRED/);
  assert.throws(
    () => commitTranscript(s, { ...v, digest: "changed" }, "local"),
    /CHANGED/,
  );
  assert.throws(
    () => commitTranscript(s, { ...v, speakers: [] }, "local"),
    /SEGMENTS/,
  );
  s.exec(
    "INSERT INTO source_lifecycle VALUES(?,'archived',1,?)",
    p.sourceId,
    new Date().toISOString(),
  );
  assert.throws(
    () =>
      previewTranscript(
        s,
        { sourceId: p.sourceId, revisionId: p.revisionId },
        "local",
      ),
    /UNAVAILABLE/,
  );
});
