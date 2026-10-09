import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedTaskDemo } from "../../scripts/task-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running, workspace;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-task-ui-"));
  workspace = join(root, "workspace");
  await seedTaskDemo(workspace);
  s = new Store(workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("keyboard approval, evidence, status/history and restart retain one task", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page
    .getByRole("tab", { name: "Tasks & approvals", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Send revised Cedar proposal" }),
  ).toBeVisible();
  await page.getByText("Inspect 3 evidence references").click();
  await page
    .getByRole("button", { name: "Read evidence 1", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Source passage" }),
  ).toContainText("Morgan: Please send");
  const approve = page.getByRole("button", {
    name: "Approve task",
    exact: true,
  });
  await approve.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Task approved");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Send revised Cedar proposal", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Task details" }),
  ).toBeVisible();
  await page.getByLabel("Task status", { exact: true }).selectOption("waiting");
  await expect(
    page.getByRole("region", { name: "Task details" }),
  ).toContainText("status: waiting");
  await page.getByLabel("Status filter").selectOption("done");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("Status filter").selectOption("waiting");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/tasks-mobile.png",
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
  await expect(page.locator("tbody")).toContainText("waiting");
  await expect(
    page.getByRole("button", { name: "Approve task", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: "test-results/tasks-desktop.png",
    fullPage: true,
  });
});
