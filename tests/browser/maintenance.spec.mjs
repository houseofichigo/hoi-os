import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedMaintenanceDemo } from "../../scripts/maintenance-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running, workspace;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-review-ui-"));
  workspace = join(root, "workspace");
  await seedMaintenanceDemo(workspace);
  s = new Store(workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("knowledge scan, keyboard keep, archive and restart preserve review decisions", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Reviews", exact: true }).click();
  await page
    .getByRole("button", { name: "Scan knowledge", exact: true })
    .click();
  const expired = page.getByRole("article", {
    name: "Knowledge finding expired-memory",
    exact: true,
  });
  await expect(expired).toBeVisible();
  await expired.getByRole("button", { name: "archive", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(expired).toHaveCount(0);
  const stale = page.getByRole("article", {
    name: "Knowledge finding stale-evidence",
    exact: true,
  });
  await expect(stale).toHaveCount(1);
  await stale.getByRole("button", { name: "keep", exact: true }).click();
  await expect(stale).toHaveCount(0);
  await page
    .getByRole("button", { name: "Scan knowledge", exact: true })
    .click();
  await expect(stale).toHaveCount(0);
  await page.getByText("Review history", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Knowledge maintenance" }),
  ).toContainText("archive");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/knowledge-mobile.png",
    fullPage: true,
  });
  await new Promise((ok) => running.server.close(ok));
  s.close();
  s = new Store(workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
  await page.goto(running.url);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Reviews", exact: true }).click();
  await page
    .getByRole("button", { name: "Scan knowledge", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: /Knowledge finding/ }),
  ).toHaveCount(0);
});
