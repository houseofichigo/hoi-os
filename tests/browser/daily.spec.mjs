import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedDailyDemo } from "../../scripts/daily-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running, demo;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-daily-"));
  demo = await seedDailyDemo(join(root, "workspace with spaces"));
  s = new Store(demo.workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("daily priorities, promises, waiting, keyboard Kanban, cited meeting and mobile layout", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill(demo.date);
  await page.getByLabel("Timezone", { exact: true }).fill("Europe/Paris");
  await page.getByLabel("Your recorded owner name").fill(demo.owner);
  await page
    .getByRole("button", { name: "Refresh daily work", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Coverage gaps" }),
  ).toContainText("has not been confirmed");
  await expect(
    page.getByRole("region", { name: "Daily task list" }).getByRole("heading"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "My promises", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Daily task list" }),
  ).toContainText("Bring the Cedar proposal");
  await expect(
    page.getByRole("region", { name: "Daily task list" }).getByRole("heading"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Waiting for", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Daily task list" }),
  ).toContainText("Confirm Cedar budget");
  await page
    .getByRole("button", { name: "Project Kanban", exact: true })
    .click();
  const move = page.getByLabel("Move Bring the Cedar proposal");
  await move.focus();
  await expect(move).toBeFocused();
  await move.selectOption("in-progress");
  await expect(
    page.getByRole("region", { name: "Kanban in-progress", exact: true }),
  ).toContainText("Bring the Cedar proposal");
  await page
    .getByRole("button", {
      name: "Prepare Cedar proposal review (synthetic)",
      exact: true,
    })
    .click();
  const brief = page.getByRole("region", { name: "Meeting brief" });
  await expect(brief).toContainText("Alex (fictional)");
  await expect(brief).toContainText("Bring the Cedar proposal");
  await brief
    .getByText(/Inspect evidence/)
    .first()
    .click();
  await brief
    .getByRole("button", { name: "Read source 1", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Daily source passage" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/daily-mobile.png",
    fullPage: true,
  });
});
