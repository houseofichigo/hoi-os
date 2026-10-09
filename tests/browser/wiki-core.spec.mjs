import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-wiki-ui-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("wiki draft persists, requires explicit publication, and opens from the map", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Wiki", exact: true }).click();
  await page
    .getByRole("button", { name: "Create wiki draft", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Orchard knowledge");
  await page
    .getByLabel("Provenance", { exact: true })
    .selectOption("user-authored");
  await page
    .getByLabel("Markdown", { exact: true })
    .fill("Orchard workshops need two preparation days.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText(/Attributed statement · workspace-user/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare and publish", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish reviewed revision", exact: true })
    .click();
  await expect(page.getByText(/topic · Published/)).toBeVisible();
  await page.getByRole("button", { name: "Close wiki", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Orchard knowledge", exact: true })
    .click();
  await expect(
    page.getByText("Orchard workshops need two preparation days.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: /Orchard knowledge/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText(/Attributed statement · workspace-user/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.locator("body")).toHaveJSProperty(
      "scrollWidth",
      await page.locator("body").evaluate((e) => e.clientWidth),
    );
  }
});
