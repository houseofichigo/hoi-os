import { writeYaml } from "../dist/core/files.js";
import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { createConnection } from "../dist/core/sync.js";
import { importWork } from "../dist/core/work-intake.js";
import {
  proposeEmail,
  reviewEmailAction,
  executeEmailAction,
  emailAction,
} from "../dist/core/google-actions.js";
async function data(t) {
  const { s } = fixture(t),
    c = createConnection(
      s,
      { provider: "gmail", label: "Pilot", query: "label:pilot" },
      "local",
    );
  const i = await importWork(
    s,
    {
      kind: "email",
      account: "fictional",
      remoteId: "m1",
      threadId: "t1",
      title: "Fictional request",
      occurredAt: "2026-09-27T09:00:00Z",
      updatedAt: "2026-09-27T09:00:00Z",
      checkedAt: "2026-09-27T09:00:00Z",
      segments: [{ text: "Please share the notes." }],
    },
    "local",
  );
  s.exec(
    "INSERT INTO sync_items VALUES(?,?,?,?)",
    c.id,
    "m1",
    "one",
    s.one("SELECT source_id FROM work_intake WHERE id=?", i.id).source_id,
  );
  const policy = s.policy();
  policy.actions.external = "approve";
  writeYaml(s.path("policies/actions.yaml"), policy);
  const p = proposeEmail(
    s,
    {
      key: "reply",
      intakeId: i.id,
      connectionId: c.id,
      to: ["alex@example.invalid"],
      subject: "Re: Fictional request",
      body: "I will check the notes.",
    },
    "local",
  );
  return { s, p };
}
test("exact email approval is idempotent and saves only one draft", async (t) => {
  const { s, p } = await data(t);
  assert.throws(
    () =>
      reviewEmailAction(
        s,
        { id: p.id, expectedVersion: 1, digest: "bad", decision: "approved" },
        "local",
      ),
    /CHANGED/,
  );
  const review = {
    id: p.id,
    expectedVersion: 1,
    digest: p.digest,
    decision: "approved",
  };
  reviewEmailAction(s, review, "local");
  reviewEmailAction(s, review, "local");
  let writes = 0;
  const adapter = {
    find: async () => null,
    create: async (_p, id, digest) => {
      writes++;
      return { id: "external-draft", digest };
    },
  };
  await executeEmailAction(s, p.id, "local", adapter);
  await executeEmailAction(s, p.id, "local", adapter);
  assert.equal(writes, 1);
  assert.equal(emailAction(s, p.id, "local").state, "executed");
});
test("uncertain Gmail write is not retried when reconciliation finds nothing", async (t) => {
  const { s, p } = await data(t);
  reviewEmailAction(
    s,
    { id: p.id, expectedVersion: 1, digest: p.digest, decision: "approved" },
    "local",
  );
  let writes = 0;
  const adapter = {
    find: async () => null,
    create: async () => {
      writes++;
      throw Error("offline");
    },
  };
  await assert.rejects(
    () => executeEmailAction(s, p.id, "local", adapter),
    /UNCERTAIN/,
  );
  await assert.rejects(
    () => executeEmailAction(s, p.id, "local", adapter),
    /UNCERTAIN/,
  );
  assert.equal(writes, 1);
  assert.equal(emailAction(s, p.id, "local").state, "uncertain");
});
