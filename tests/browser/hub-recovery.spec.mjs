import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, store, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-hub-recovery-"));
  initialize(join(root, "workspace"));
  store = new Store(join(root, "workspace"));
  running = await serve(store, "local", resolve("dist/hub"), 0, { hub: true });
});
test.afterAll(async () => {
  await new Promise((resolve) => running.server.close(resolve));
  store.close();
  rmSync(root, { recursive: true, force: true });
});

test("plain links, API failures and expired sessions recover without a blank screen", async ({
  page,
}) => {
  const origin = new URL(running.url).origin;
  await page.goto(origin + "/app?view=home");
  await expect(
    page.getByRole("heading", { name: "Open your secure workspace link" }),
  ).toBeVisible();
  // Same-document fragment recovery must work without a reload.
  await page.goto(origin + "/app?view=home#" + running.token);
  await expect(
    page.getByRole("heading", { name: "Your knowledge, connected." }),
  ).toBeVisible();
  await page.route("**/api/workspace", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The local engine is unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/workspace");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("heading", { name: "Your knowledge, connected." }),
  ).toBeVisible();
  await page.route("**/api/workspace", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"error":"expired"}',
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Open your secure workspace link" }),
  ).toBeVisible();
});

test("Hub tabs retain URL navigation and responsive overview", async ({
  page,
}) => {
  await page.goto(running.url);
  for (const name of ["Sources", "Ingestion", "Wiki", "Memory", "Reviews"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp("section=" + name));
    await page.reload();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Memory", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(
    page.getByRole("tab", { name: "Reviews", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (process.platform === "darwin")
      await expect(page).toHaveScreenshot(`hub-overview-${width}.png`, {
        fullPage: true,
        animations: "disabled",
      });
  }
});
