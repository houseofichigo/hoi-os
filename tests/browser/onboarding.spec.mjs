import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-onboarding-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((r) => running.server.close(r));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("app-only setup saves and resumes at narrow width without enabling AI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Continue setup", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Fictional Alex");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Time and working hours", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Time and working hours", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Timezone (IANA name)").fill("UTC");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(page.getByLabel("Preferred experience")).toHaveValue("none");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page
    .getByRole("button", { name: "Save and finish", exact: true })
    .click();
  await expect(
    page.getByText(
      "Setup checklist complete. Skipped features remain unconfigured.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
