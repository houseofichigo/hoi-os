import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { importWork, intakeDetail } from "../../dist/core/work-intake.js";
import { createProposal } from "../../dist/core/tasks.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-activity-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  const item = await importWork(
    s,
    {
      kind: "transcript",
      account: "fictional",
      remoteId: "activity-workshop",
      title: "Workshop preparation",
      occurredAt: "2026-09-30T09:00:00Z",
      updatedAt: "2026-09-30T09:00:00Z",
      checkedAt: "2026-09-30T09:00:00Z",
      segments: [
        { speaker: "Alex", text: "I will prepare the workshop agenda." },
      ],
    },
    "local",
  );
  const d = intakeDetail(s, item.id, "local");
  createProposal(
    s,
    {
      key: "activity-agenda",
      task: {
        title: "Prepare workshop agenda",
        outcome: "Agenda ready for review",
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
test("global Activity preserves drafts, restores focus and opens the same proposal", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Keep this unsent draft");
  const trigger = page.getByRole("button", { name: /^Activity/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Activity" });
  await expect(dialog).toContainText("Prepare workshop agenda");
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await expect(dialog).toHaveScreenshot(`activity-${width}.png`, {
      animations: "disabled",
    });
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Keep this unsent draft",
  );
  await trigger.click();
  await dialog.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/proposal=/);
  await expect(
    page.getByRole("button", { name: "Approve task", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Keep this unsent draft",
  );
});
test("suggestion evidence and dismissal share engine identity and persist after reload", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Inbox", exact: true }).click();
  await page.getByRole("tab", { name: "Suggestions", exact: true }).click();
  await page
    .getByRole("button", { name: "Open evidence", exact: true })
    .click();
  await expect(page.getByLabel("Supporting evidence")).toContainText(
    "prepare the workshop agenda",
  );
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prepare workshop agenda" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Prepare workshop agenda" }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prepare workshop agenda" }),
  ).toBeVisible();
});
