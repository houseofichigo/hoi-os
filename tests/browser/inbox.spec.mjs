import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { importWork, intakeDetail } from "../../dist/core/work-intake.js";
import { createProposal, listTasks } from "../../dist/core/tasks.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-inbox-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  const item = await importWork(
    s,
    {
      kind: "transcript",
      account: "fictional",
      remoteId: "notes",
      title: "Fictional workshop discussion",
      occurredAt: "2026-09-27T09:00:00Z",
      updatedAt: "2026-09-27T09:00:00Z",
      checkedAt: "2026-09-27T09:00:00Z",
      segments: [{ speaker: "Alex", text: "I will share the workshop notes." }],
    },
    "local",
  );
  const d = intakeDetail(s, item.id, "local");
  createProposal(
    s,
    {
      key: "notes",
      task: {
        title: "Share workshop notes",
        outcome: "Notes shared",
        owner: "Alex",
      },
      evidence: d.passages.map((p) => ({
        revisionId: d.revisionId,
        passageId: p.id,
        quote: p.text,
      })),
    },
    "local",
  );
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("Inbox opens evidence and approves a standalone task without a project", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("tab", { name: "Transcripts", exact: true }).click();
  await page
    .getByRole("button", { name: "Fictional workshop discussion", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "I will share the workshop notes.",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Suggestions", exact: true }).click();
  await page.getByRole("link", { name: "Review", exact: true }).click();
  const approve = page.getByRole("button", {
    name: "Approve task",
    exact: true,
  });
  await expect(page.locator("article.task-proposal")).toBeFocused();
  await approve.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Task approved");
  expect(listTasks(s, "local")).toHaveLength(1);
  expect(listTasks(s, "local")[0].projectId).toBeNull();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Share workshop notes", exact: true }),
  ).toBeVisible();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
test("uploaded transcript is reviewed once, keeps unknown dates and validates assistant suggestions", async ({
  page,
}) => {
  const before = s.one("SELECT COUNT(*) n FROM sources").n;
  await page.goto(running.url);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("tab", { name: "Transcripts", exact: true }).click();
  await page.getByText("Upload a transcript", { exact: true }).click();
  await page.getByLabel("Files for chat").setInputFiles({
    name: "fictional-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Morgan: I will send the agenda."),
  });
  await page
    .getByRole("button", { name: "Review attachments", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Import and attach reviewed files",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Transcript review" }),
  ).toContainText("Morgan: I will send the agenda.");
  await page.getByLabel("Speaker for passage 1").fill("Morgan");
  await page
    .getByRole("button", { name: "Confirm review and prepare extraction" })
    .click();
  const handoff = page.getByRole("region", {
    name: "Transcript assistant handoff",
  });
  await expect(handoff).toBeVisible();
  expect(s.one("SELECT COUNT(*) n FROM sources").n).toBe(before + 1);
  const req = JSON.parse(await handoff.locator("pre").textContent());
  expect(req.occurredAt).toBeNull();
  await handoff
    .getByText("Assistant response exchange", { exact: true })
    .click();
  const response = {
    runId: req.runId,
    requestDigest: req.requestDigest,
    adapter: "codex",
    extractionVersion: "commitments-v1",
    mentions: [
      {
        task: {
          title: "Send agenda",
          outcome: "Agenda shared",
          owner: "Morgan",
        },
        evidence: [
          {
            revisionId: req.passages[0].revisionId,
            passageId: req.passages[0].passageId,
            quote: "I will send the agenda.",
          },
        ],
        actor: "Morgan",
        intent: "commitment",
      },
    ],
  };
  await page
    .getByLabel("Assistant extraction response")
    .fill(JSON.stringify(response));
  await page
    .getByRole("button", { name: "Validate transcript suggestions" })
    .click();
  await expect(
    page.getByRole("region", { name: "Transcript workflow" }),
  ).toContainText("Response validated.");
  await expect(
    page.getByRole("region", { name: "Intake review" }),
  ).toContainText("Send agenda");
  expect(s.one("SELECT COUNT(*) n FROM tasks").n).toBe(1);
});
