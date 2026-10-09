import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fixture } from "./helpers.mjs";
import { writeYaml } from "../dist/core/files.js";
import { sourceImpact, changeSource } from "../dist/core/hub.js";
import { ingest } from "../dist/core/intake.js";
import { knowledgeSearch, knowledgeEvidence } from "../dist/core/retrieval.js";

test("read policy cache observes atomic policy replacement and clears after failure", (t) => {
  const { s } = fixture(t),
    path = s.path("policies/actions.yaml"),
    original = s.policy();
  let first;
  assert.throws(
    () =>
      s.withReadPolicyCache(() => {
        first = s.policy();
        assert.equal(s.policy(), first);
        s.withReadPolicyCache(() => assert.equal(s.policy(), first));
        writeYaml(path, { ...original, deniedHosts: ["codex"] });
      }),
    /POLICY_CHANGED_DURING_READ/,
  );
  assert.throws(() => s.assertHost("codex"), /denied/);
  assert.notEqual(s.policy(), s.policy());
  assert.throws(() =>
    s.withReadPolicyCache(() => {
      s.policy();
      writeFileSync(path, "actions: [invalid");
      s.policy();
    }),
  );
  assert.throws(() => s.policy());
  writeYaml(path, original);
  assert.doesNotThrow(() => s.assertHost("codex"));
  assert.notEqual(s.policy(), s.policy());
});

test("repeated searches recheck policy, source lifecycle and current revision", async (t) => {
  const { s, file } = fixture(t),
    path = file(
      "cache-source.md",
      "Cache marker: fictional delivery evidence.",
    );
  const imported = await ingest(s, path, { host: "local" });
  const query = { query: "Cache marker" };
  const first = knowledgeSearch(s, query, "codex").evidence.find(
    (x) => x.kind === "source",
  );
  assert.ok(first);
  const policy = s.policy();
  writeYaml(s.path("policies/actions.yaml"), {
    ...policy,
    deniedSources: [imported.sourceId],
  });
  assert.equal(knowledgeSearch(s, query, "codex").evidence.length, 0);
  assert.throws(() =>
    knowledgeEvidence(s, { kind: "source", ...first.reference }, "codex"),
  );
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.ok(knowledgeSearch(s, query, "codex").evidence.length);
  let impact = sourceImpact(s, imported.sourceId, "local");
  changeSource(
    s,
    {
      id: imported.sourceId,
      expectedVersion: impact.source.version,
      digest: impact.digest,
      state: "archived",
    },
    "local",
  );
  assert.equal(knowledgeSearch(s, query, "codex").evidence.length, 0);
  impact = sourceImpact(s, imported.sourceId, "local");
  changeSource(
    s,
    {
      id: imported.sourceId,
      expectedVersion: impact.source.version,
      digest: impact.digest,
      state: "active",
    },
    "local",
  );
  writeFileSync(path, "Cache marker: revised fictional delivery evidence.");
  await ingest(s, path, { host: "local" });
  assert.throws(
    () => knowledgeEvidence(s, { kind: "source", ...first.reference }, "codex"),
    /stale/,
  );
  assert.ok(
    knowledgeSearch(s, query, "codex").evidence.every(
      (x) => x.reference.revisionId !== first.reference.revisionId,
    ),
  );
});

test("search discards assembled results when policy changes during the read", async (t) => {
  const { s, file } = fixture(t);
  await ingest(s, file("mid-read.md", "Transient policy marker."), {
    host: "local",
  });
  const policy = s.policy(),
    allowed = s.allowed.bind(s);
  let changed = false;
  s.allowed = (...args) => {
    if (!changed) {
      changed = true;
      writeYaml(s.path("policies/actions.yaml"), {
        ...policy,
        deniedHosts: ["codex"],
      });
    }
    return allowed(...args);
  };
  assert.throws(
    () => knowledgeSearch(s, { query: "Transient policy" }, "codex"),
    /POLICY_CHANGED_DURING_READ/,
  );
  assert.throws(
    () => knowledgeSearch(s, { query: "Transient policy" }, "codex"),
    /denied/,
  );
  s.allowed = allowed;
  writeYaml(s.path("policies/actions.yaml"), policy);
  assert.ok(
    knowledgeSearch(s, { query: "Transient policy" }, "codex").evidence.length,
  );
});
