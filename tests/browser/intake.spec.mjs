import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedIntakeDemo } from "../../scripts/intake-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, workspace, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-intake-ui-"));
  workspace = join(root, "space workspace");
  await seedIntakeDemo(workspace);
  s = new Store(workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("keyboard matching, deadline review, reversible merge and restart keep one task", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tasks & approvals", exact: true })
    .click();
  const mentions = page.getByRole("article", {
    name: "Mention Send Cedar proposal",
  });
  await expect(mentions).toHaveCount(2);
  const cal = mentions.filter({ hasText: "context · calendar" });
  await expect(
    cal.getByRole("button", { name: "Keep separate", exact: true }),
  ).toBeDisabled();
  await cal.getByRole("combobox").selectOption({ index: 1 });
  await cal
    .getByRole("button", { name: "Attach evidence", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(mentions).toHaveCount(1);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByText("Matching history", { exact: true }).click();
  await page.getByRole("button", { name: "Undo merge", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Undo merge", exact: true }),
  ).toBeDisabled();
  await mentions.getByRole("combobox").selectOption({ index: 1 });
  await expect(mentions).toContainText("2026-10-02");
  await mentions
    .getByRole("button", { name: "Apply reviewed fields", exact: true })
    .click();
  await expect(mentions).toHaveCount(0);
  await expect(page.locator("tbody")).toContainText("2026-10-02");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/intake-mobile.png",
    fullPage: true,
  });
  await new Promise((ok) => running.server.close(ok));
  s.close();
  s = new Store(workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
  await page.goto(running.url);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tasks & approvals", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("2026-10-02");
});
