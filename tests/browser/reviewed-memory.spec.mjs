import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-memory-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterEach(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("attributed memory requires review, preserves history, and fits supported widths", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Memory", exact: true }).click();
  await page
    .getByRole("button", { name: "Add attributed note", exact: true })
    .click();
  await page
    .getByLabel("Your statement", { exact: true })
    .fill("Orchard prefers afternoon workshops.");
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(
    page.getByText("Orchard prefers afternoon workshops.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve exact version", exact: true })
    .click();
  await page.getByRole("tab", { name: "Current", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Version 2 · approved" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Inspect & history", exact: true }),
  ).toBeFocused();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((e) => e.clientWidth),
    );
  }
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "No longer use this", exact: true })
    .click();
  await expect(
    page.getByText("No current memories.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByText("Orchard prefers afternoon workshops.", { exact: true }),
  ).toBeVisible();
});

test("saved corrections compare and restore without changing approved memory early", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Memory", exact: true }).click();
  await page
    .getByRole("button", { name: "Add attributed note", exact: true })
    .click();
  await page
    .getByLabel("Your statement", { exact: true })
    .fill("Cedar prefers morning sessions.");
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Approve exact version", exact: true })
    .click();
  await page.getByRole("tab", { name: "Current", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Propose correction", exact: true })
    .click();
  await page
    .getByLabel("Your statement", { exact: true })
    .fill("Cedar prefers afternoon sessions.");
  await page.getByLabel("Effective from", { exact: true }).fill("2025-01-01");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "Proposed", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare changes", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByText("Cedar prefers morning sessions.", { exact: true }),
  ).toBeVisible();
  await expect(
    drawer.getByText("Cedar prefers afternoon sessions.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve exact version", exact: true })
    .click();
  await page.getByRole("tab", { name: "Current", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Restore version 1 as draft", exact: true })
    .click();
  await expect(page.getByLabel("Your statement", { exact: true })).toHaveValue(
    "Cedar prefers morning sessions.",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Current", exact: true }).click();
  await expect(
    page.getByText("Cedar prefers afternoon sessions.", { exact: true }),
  ).toBeVisible();
});
