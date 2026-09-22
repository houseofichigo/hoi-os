import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "./helpers.mjs";
import { ingest, retrieve } from "../dist/core/intake.js";
import { connect } from "../dist/core/knowledge.js";
import {
  proposeWiki,
  listWiki,
  getWiki,
  reviewWiki,
  canonicalWiki,
  wikiContradictions,
} from "../dist/core/wiki.js";
import { organize, approve, applyOrganization } from "../dist/core/organize.js";
import { saveCapability } from "../dist/core/workflow.js";
import { registerConnector } from "../dist/core/connectors.js";
import { registerHost, isRegisteredHost } from "../dist/core/hosts.js";
import { registerTool, toolNames } from "../dist/core/tools.js";

async function evidenceFor(s, file, query) {
  await ingest(s, file);
  const found = retrieve(s, query, "local");
  assert.ok(found.results.length, "expected retrievable evidence");
  const e = found.results[0];
  return { revisionId: e.revisionId, passageId: e.passageId, quote: e.quote };
}

test("wiki pages move draft -> reviewed -> canonical with evidence", async (t) => {
  const { s, file } = fixture(t);
  const evidence = await evidenceFor(
    s,
    file("positioning.md", "House of Ichigo sells training and advisory"),
    "training advisory",
  );
  const proposed = proposeWiki(
    s,
    {
      slug: "house-of-ichigo",
      title: "House of Ichigo",
      type: "company",
      content: "## Positioning\n\nTraining and advisory.",
      evidence: [evidence],
    },
    "local",
  );
  assert.equal(proposed.status, "draft");
  assert.ok(existsSync(s.path(proposed.contentPath)));
  assert.equal(listWiki(s, "local").length, 1);
  reviewWiki(s, proposed.id, "reviewed", "local");
  canonicalWiki(s, proposed.id, "local");
  const page = getWiki(s, "house-of-ichigo", "local");
  assert.equal(page.status, "canonical");
  assert.equal(page.evidenceCount, 1);
  assert.ok(page.content.includes("Positioning"));
  // Canonical pages are never replaced silently.
  assert.throws(
    () =>
      proposeWiki(
        s,
        {
          slug: "house-of-ichigo",
          title: "House of Ichigo",
          type: "company",
          content: "New view.",
          evidence: [evidence],
        },
        "local",
      ),
    /never replaced silently/,
  );
  const successor = proposeWiki(
    s,
    {
      slug: "house-of-ichigo",
      title: "House of Ichigo",
      type: "company",
      content: "New view.",
      supersedes: proposed.id,
      evidence: [evidence],
    },
    "local",
  );
  reviewWiki(s, successor.id, "reviewed", "local");
  canonicalWiki(s, successor.id, "local");
  assert.equal(getWiki(s, "house-of-ichigo", "local").id, successor.id);
  assert.equal(getWiki(s, proposed.id, "local").status, "superseded");
  const report = wikiContradictions(s, "local");
  assert.deepEqual(report.duplicateActivePages, []);
  assert.deepEqual(report.staleEvidence, []);
});

test("wiki rejects unverifiable evidence", async (t) => {
  const { s, file } = fixture(t);
  const evidence = await evidenceFor(s, file("a.md", "alpha content"), "alpha");
  assert.throws(
    () =>
      proposeWiki(
        s,
        {
          slug: "bad-page",
          title: "Bad",
          type: "topic",
          content: "x",
          evidence: [{ ...evidence, quote: "text that is not in the passage" }],
        },
        "local",
      ),
    /immutable passage/,
  );
});

test("organize scaffolds per-connector folders and routes connector sources", async (t) => {
  const { s, file } = fixture(t);
  connect(s, { provider: "calendar", host: "local", status: "export-only" });
  await ingest(s, file("notes.md", "general working notes"));
  await ingest(s, file("event.md", "client pilot review event"), {
    sourceKey: "calendar:abc123:event-1",
  });
  const plan = organize(s, "local");
  assert.ok(plan.scaffold.includes(join("working", "files")));
  assert.ok(plan.scaffold.includes(join("working", "connections", "calendar")));
  const routed = plan.entries.find((e) =>
    e.to.includes(join("connections", "calendar")),
  );
  assert.ok(routed, "connector source routed under its provider folder");
  const approval = approve(s, plan.id, plan.hash);
  const applied = applyOrganization(s, plan.id, approval.id, "local");
  assert.equal(applied.scaffolded, 2);
  assert.ok(existsSync(s.path(join("working", "connections", "calendar"))));
});

test("registries stay open: connectors, hosts, and tools extend at runtime", (t) => {
  const { s } = fixture(t);
  assert.throws(
    () =>
      connect(s, { provider: "notion", host: "local", status: "available" }),
    /Unsupported connector/,
  );
  registerConnector({
    provider: "notion",
    mechanism: "host-mediated",
    importable: true,
  });
  const entry = connect(s, {
    provider: "notion",
    host: "local",
    status: "available",
  });
  assert.equal(entry.provider, "notion");
  assert.ok(!isRegisteredHost("gemini"));
  registerHost({ name: "gemini", kind: "assistant" });
  assert.ok(isRegisteredHost("gemini"));
  assert.throws(
    () =>
      saveCapability(s, {
        schemaVersion: 1,
        id: "custom-cap",
        version: 1,
        purpose: "test",
        steps: [{ id: "step-one", tool: "unknown-tool" }],
        evaluation: { minEvidence: 0, requireCitations: false },
      }),
    /Unregistered capability tool/,
  );
  registerTool({ name: "unknown-tool", run: () => ({ ok: true }) });
  assert.ok(toolNames().includes("unknown-tool"));
  const saved = saveCapability(s, {
    schemaVersion: 1,
    id: "custom-cap",
    version: 1,
    purpose: "test",
    steps: [{ id: "step-one", tool: "unknown-tool" }],
    evaluation: { minEvidence: 0, requireCitations: false },
  });
  assert.equal(saved.state, "draft");
});

test("capability tool constraints are enforced from tool metadata", (t) => {
  const { s } = fixture(t);
  assert.throws(
    () =>
      saveCapability(s, {
        schemaVersion: 1,
        id: "bad-brief",
        version: 1,
        purpose: "test",
        autonomy: "A2",
        steps: [{ id: "step-one", tool: "meeting-brief" }],
        evaluation: { minEvidence: 0, requireCitations: true },
      }),
    /requires a preceding retrieve step/,
  );
  assert.throws(
    () =>
      saveCapability(s, {
        schemaVersion: 1,
        id: "no-citations",
        version: 1,
        purpose: "test",
        steps: [{ id: "step-one", tool: "retrieve" }],
        evaluation: { minEvidence: 0, requireCitations: true },
      }),
    /produces citations/,
  );
});
