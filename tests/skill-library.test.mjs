import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.mjs";
import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  listSkills,
  skillDetail,
  draftSkill,
  controlSkill,
  previewSkill,
  commitSkill,
  resolveSkill,
  previewSkillSync,
  syncSkill,
} from "../dist/core/skill-library.js";
import { saveRecord, records } from "../dist/core/workspace.js";
import { ingest } from "../dist/core/intake.js";
import {
  createConversation,
  appendConversation,
  submitChat,
  getConversation,
} from "../dist/core/chat.js";
import { backup, restore } from "../dist/core/backup.js";
import { Store, migrate } from "../dist/core/store.js";
import { writeYaml } from "../dist/core/files.js";
const md = (
  name = "test-helper",
  text = "Use permitted evidence only.",
  api = 1,
) =>
  `---\nname: ${name}\ndescription: Fictional test instructions.\nengineApiVersion: ${api}\nrequiredOperations: []\n---\n\n${text}\n`;
const create = (s, text = md()) =>
  draftSkill(
    s,
    { name: "test-helper", expectedVersion: 0, markdown: text },
    "local",
  );
function activate(s, d) {
  const r = d.revisions[0];
  return controlSkill(
    s,
    {
      name: d.id,
      expectedVersion: d.version,
      action: "activate",
      revisionId: r.revisionId,
      checksum: r.checksum,
    },
    "local",
  );
}
test("mixed project delivery classifications retain shared identities and old records default unclassified", (t) => {
  const { s } = fixture(t);
  const p = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Mixed fictional delivery",
        deliveryTypes: ["training", "consulting"],
      },
    },
    "local",
  );
  assert.deepEqual(records(s, "project", "local")[0].deliveryTypes, [
    "training",
    "consulting",
  ]);
  assert.equal(records(s, "project", "local")[0].id, p.id);
  assert.throws(
    () =>
      saveRecord(
        s,
        {
          kind: "project",
          id: p.id,
          expectedVersion: 0,
          record: { name: "stale" },
        },
        "local",
      ),
    /Stale/,
  );
});
test("skill drafts require exact reviewed activation; revisions, disable and rollback persist", (t) => {
  const { s } = fixture(t);
  assert.ok(listSkills(s, "local").some((x) => x.id === "hoi-audit"));
  let d = create(s);
  assert.equal(d.active, null);
  assert.throws(
    () =>
      controlSkill(
        s,
        {
          name: d.id,
          expectedVersion: d.version,
          action: "activate",
          revisionId: d.revisions[0].revisionId,
          checksum: "wrong",
        },
        "local",
      ),
    /REVIEW/,
  );
  d = activate(s, d);
  const first = d.active;
  assert.ok(
    resolveSkill(
      s,
      { name: d.id, revisionId: first.revisionId, checksum: first.checksum },
      "codex",
    ).instructions.includes("permitted"),
  );
  d = draftSkill(
    s,
    {
      name: d.id,
      expectedVersion: d.version,
      markdown: md("test-helper", "Version two"),
      fromRevision: first.revisionId,
    },
    "local",
  );
  assert.equal(d.active.revisionId, first.revisionId);
  d = activate(s, d);
  assert.throws(
    () =>
      controlSkill(
        s,
        { name: d.id, expectedVersion: 1, action: "disable" },
        "local",
      ),
    /STALE/,
  );
  d = controlSkill(
    s,
    { name: d.id, expectedVersion: d.version, action: "disable" },
    "local",
  );
  assert.throws(
    () =>
      resolveSkill(
        s,
        { name: d.id, revisionId: first.revisionId, checksum: first.checksum },
        "codex",
      ),
    /UNAVAILABLE/,
  );
  d = controlSkill(
    s,
    {
      name: d.id,
      expectedVersion: d.version,
      action: "activate",
      revisionId: first.revisionId,
      checksum: first.checksum,
    },
    "local",
  );
  assert.equal(d.active.revisionId, first.revisionId);
});
test("ZIP and .skill import preserve original and supporting files, rejects malicious paths and incompatible activation", async (t) => {
  const { s } = fixture(t);
  const z = new JSZip();
  z.file("test-helper/SKILL.md", md());
  z.file("test-helper/scripts/example.py", 'raise Exception("Never executed")');
  const bytes = await z.generateAsync({ type: "nodebuffer" });
  const preview = await previewSkill(
    s,
    { filename: "example.zip", base64: bytes.toString("base64") },
    "local",
  );
  const packaged = await previewSkill(
    s,
    { filename: "example.skill", base64: bytes.toString("base64") },
    "local",
  );
  assert.equal(packaged.checksum, preview.checksum);
  assert.equal(packaged.instructions, md());
  assert.equal(packaged.filename, "example.skill");
  await assert.rejects(() =>
    previewSkill(
      s,
      {
        filename: "broken.skill",
        base64: Buffer.from("not zip").toString("base64"),
      },
      "local",
    ),
  );
  const large = new JSZip();
  large.file("SKILL.md", md());
  large.file("huge.txt", "x".repeat(524289));
  await assert.rejects(
    async () =>
      previewSkill(
        s,
        {
          filename: "large.skill",
          base64: await large.generateAsync({
            type: "base64",
            compression: "DEFLATE",
          }),
        },
        "local",
      ),
    /EXPANDED_LIMIT/,
  );
  const many = new JSZip();
  many.file("SKILL.md", md());
  for (let i = 0; i < 64; i++) many.file(`file${i}.txt`, "x");
  await assert.rejects(
    async () =>
      previewSkill(
        s,
        {
          filename: "many.skill",
          base64: await many.generateAsync({ type: "base64" }),
        },
        "local",
      ),
    /FILE_LIMIT/,
  );
  assert.equal(preview.files.length, 2);
  let d = commitSkill(s, { id: preview.id, digest: preview.digest }, "local");
  assert.equal(
    commitSkill(s, { id: preview.id, digest: preview.digest }, "local").version,
    d.version,
  );
  assert.ok(d.revisions[0].payload.files["scripts/example.py"]);
  assert.equal(d.active, null);
  await assert.rejects(
    () =>
      previewSkill(
        s,
        { filename: "example.zip", base64: bytes.toString("base64") },
        "local",
      ),
    /EXISTS/,
  );
  const bad = new JSZip();
  bad.file("../SKILL.md", md());
  await assert.rejects(
    () =>
      bad
        .generateAsync({ type: "base64" })
        .then((base64) =>
          previewSkill(s, { filename: "bad.skill", base64 }, "local"),
        ),
    /PATH/,
  );
  const symlink = new JSZip();
  symlink.file("SKILL.md", md());
  symlink.file("target", "x", { unixPermissions: 0o120777 });
  await assert.rejects(
    () =>
      symlink
        .generateAsync({ type: "base64", platform: "UNIX" })
        .then((base64) =>
          previewSkill(s, { filename: "bad.skill", base64 }, "local"),
        ),
    /SYMLINK/,
  );
  d = draftSkill(
    s,
    {
      name: d.id,
      expectedVersion: d.version,
      markdown: md("test-helper", "Different engine", 99),
    },
    "local",
  );
  assert.throws(() => activate(s, d), /INCOMPATIBLE/);
});
test("chat pins skill and selected source revisions; disabled skills and revoked evidence cannot enter new handoffs", async (t) => {
  const { s, file } = fixture(t);
  const source = await ingest(
    s,
    file("note.md", "Fictional consulting preparation evidence."),
  );
  let d = activate(s, create(s));
  let c = createConversation(s, { host: "codex" }, "local");
  const ref = {
    name: d.id,
    revisionId: d.active.revisionId,
    checksum: d.active.checksum,
  };
  c = appendConversation(
    s,
    {
      id: c.id,
      expectedVersion: c.version,
      message: "Prepare a note",
      skill: ref,
      documents: [{ sourceId: source.sourceId, revisionId: source.revisionId }],
    },
    "local",
  );
  const r = c.turns[0];
  assert.equal(r.skill.revisionId, ref.revisionId);
  assert.match(r.request.skillInstructions.instructions, /permitted/);
  assert.equal(
    r.request.context[0].selectedDocuments[0].sourceId,
    source.sourceId,
  );
  submitChat(
    s,
    r.id,
    r.version,
    { type: "answer", text: "Fictional result", citations: [] },
    "local",
  );
  controlSkill(
    s,
    { name: d.id, expectedVersion: d.version, action: "disable" },
    "local",
  );
  assert.equal(
    getConversation(s, c.id, "local").turns[0].skill.revisionId,
    ref.revisionId,
  );
  assert.throws(
    () =>
      appendConversation(
        s,
        { id: c.id, expectedVersion: c.version, message: "next", skill: ref },
        "local",
      ),
    /UNAVAILABLE/,
  );
  writeYaml(s.path("policies/actions.yaml"), {
    ...s.policy(),
    deniedSources: [source.sourceId],
  });
  assert.equal(getConversation(s, c.id, "local").turns[0].state, "unavailable");
});
test("schema 13 migration and backup restoration preserve skills and prior workspace records", async (t) => {
  const { s, root } = fixture(t);
  s.db.exec(
    "DROP TABLE workspace_skills; DROP TABLE skill_revisions; DROP TABLE skill_events; DROP TABLE skill_imports; PRAGMA user_version=13",
  );
  s.close();
  const old = new Store(join(root, "workspace"));
  migrate(old);
  old.close();
  const current = new Store(join(root, "workspace"));
  assert.equal(current.schemaVersion, 19);
  const d = activate(current, create(current));
  backup(current, join(root, "backup"));
  await restore(join(root, "backup"), join(root, "restored"));
  const copy = new Store(join(root, "restored"));
  assert.equal(
    skillDetail(copy, d.id, "local").active.checksum,
    d.active.checksum,
  );
  copy.close();
  current.close();
});
test("reviewed adapter sync preserves customized files and binds the preview to exact targets", async (t) => {
  const { s } = fixture(t);
  const { updateAdapters } = await import("../dist/core/adapters.js");
  updateAdapters(s, "local", { action: "install", hosts: ["codex"] });
  let d = activate(s, create(s));
  let p = previewSkillSync(s, { name: d.id, host: "codex" }, "local");
  const result = syncSkill(
    s,
    { name: d.id, host: "codex", digest: p.digest },
    "local",
  );
  assert.ok(existsSync(result.backup));
  const path = s.path(".agents/skills/hoi-user-test-helper/SKILL.md");
  assert.equal(readFileSync(path, "utf8"), md());
  d = draftSkill(
    s,
    {
      name: d.id,
      expectedVersion: d.version,
      markdown: md("test-helper", "Updated"),
    },
    "local",
  );
  d = activate(s, d);
  p = previewSkillSync(s, { name: d.id, host: "codex" }, "local");
  writeFileSync(path, "User custom instructions");
  assert.throws(
    () =>
      syncSkill(s, { name: d.id, host: "codex", digest: p.digest }, "local"),
    /CHANGED/,
  );
  p = previewSkillSync(s, { name: d.id, host: "codex" }, "local");
  assert.ok(p.targets.some((x) => x.conflict));
  assert.throws(
    () =>
      syncSkill(s, { name: d.id, host: "codex", digest: p.digest }, "local"),
    /CONFLICT/,
  );
  assert.equal(readFileSync(path, "utf8"), "User custom instructions");
});
