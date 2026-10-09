import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { importWork } from "../../dist/core/work-intake.js";
import { saveRecord } from "../../dist/core/workspace.js";
import { createProposal } from "../../dist/core/tasks.js";
let root, s, running, sourceId, proposal;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-d-signals-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  const p = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: { name: "Fictional Orchard" },
    },
    "local",
  );
  const r = await importWork(
    s,
    {
      kind: "email",
      account: "fictional",
      remoteId: "question",
      threadId: "thread",
      title: "Orchard reply request",
      occurredAt: "2020-01-01T00:00:00Z",
      updatedAt: "2020-01-01T00:00:00Z",
      checkedAt: new Date().toISOString(),
      projectId: p.id,
      segments: [{ text: "Please confirm the Orchard brief." }],
      email: {
        direction: "incoming",
        sender: "orchard@example.test",
        recipients: ["owner@example.test"],
      },
    },
    "local",
  );
  sourceId = s.one(
    "SELECT source_id FROM revisions WHERE id=?",
    r.revisionId,
  ).source_id;
  const ref = s.one("SELECT * FROM passages WHERE revision_id=?", r.revisionId);
  proposal = createProposal(
    s,
    {
      key: "orchard",
      task: {
        projectId: p.id,
        title: "Review Orchard brief",
        outcome: "Confirm the brief",
      },
      evidence: [
        { revisionId: r.revisionId, passageId: ref.id, quote: ref.text },
      ],
    },
    "local",
  );
  s.exec(
    "INSERT INTO assistant_queue VALUES(?,?,?)",
    sourceId,
    r.revisionId,
    "awaiting-assistant",
  );
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("email source and proposal destinations focus the exact record, with honest processing handoff", async ({
  page,
}) => {
  await page.goto(running.url);
  await expect(
    page.getByRole("region", { name: "Email awaiting reply", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/batch-d-home.png",
    fullPage: true,
  });
  const mail = page.getByRole("region", {
    name: "Email awaiting reply",
    exact: true,
  });
  await expect(mail).toContainText("orchard@example.test");
  await mail.getByRole("link", { name: "Open source", exact: true }).click();
  await expect(page.locator('[id="source-' + sourceId + '"]')).toBeFocused();
  await page.getByRole("link", { name: "Back to Home", exact: true }).click();
  await page
    .getByRole("link", { name: "Review this proposal", exact: true })
    .click();
  await expect(
    page.locator('[id="proposal-' + proposal.id + '"]'),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare assistant handoff", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Assistant handoff", exact: true }),
  ).toHaveValue(/Processing request/);
  await page
    .getByRole("button", { name: "Mark user review complete", exact: true })
    .click();
  await expect(
    page.getByText(
      "User-marked review — no validated assistant result implied",
      { exact: true },
    ),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
});
