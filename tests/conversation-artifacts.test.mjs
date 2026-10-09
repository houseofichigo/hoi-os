import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import { ingest } from "../dist/core/intake.js";
import { knowledgeSearch } from "../dist/core/retrieval.js";
import { saveConversationArtifact } from "../dist/core/conversation-artifacts.js";
import { writeYaml } from "../dist/core/files.js";
test("derived discovery returns originals, retains short statements and refuses invented evidence", async (t) => {
  const { s, file } = fixture(t);
  const i = await ingest(
    s,
    file(
      "fictional.md",
      "I will send the agenda tomorrow.\n\nNo extra travel is required.",
    ),
    { host: "local" },
  );
  const passages = s.all(
    "SELECT id passageId,revision_id revisionId,text FROM passages WHERE revision_id=?",
    i.revisionId,
  );
  const e = {
    revisionId: i.revisionId,
    passageId: passages[0].passageId,
    quote: passages[0].text,
  };
  const artifact = {
    topic: "Workshop logistics",
    questions: ["Who is responsible for preparation?"],
    summary: [{ text: "Preparation commitment", evidence: [e] }],
    decisions: [],
    proposedActions: [],
    openQuestions: [],
  };
  const saved = saveConversationArtifact(s, "local", artifact, { passages });
  assert.deepEqual(
    saveConversationArtifact(s, "local", artifact, { passages }),
    saved,
  );
  const found = knowledgeSearch(s, { query: "logistics" }, "local");
  assert.equal(found.evidence[0].excerpt, e.quote);
  assert.equal(found.evidence[0].kind, "source");
  assert.ok(knowledgeSearch(s, { query: "travel" }, "local").evidence.length);
  assert.throws(() =>
    saveConversationArtifact(
      s,
      "local",
      {
        ...artifact,
        summary: [
          { text: "Invented", evidence: [{ ...e, quote: "Invented quote" }] },
        ],
      },
      { passages },
    ),
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [i.sourceId],
  });
  assert.equal(
    knowledgeSearch(s, { query: "logistics" }, "local").evidence.length,
    0,
  );
});
