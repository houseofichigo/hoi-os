import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { ingest } from "../../dist/core/intake.js";
import { serve } from "../../dist/core/server.js";
import { waitAutomations } from "../../dist/core/automations.js";
let root, store, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-automations-ui-"));
  initialize(join(root, "workspace"));
  store = new Store(join(root, "workspace"));
  const input = join(root, "fictional.md");
  writeFileSync(
    input,
    "# Fictional Orchard\nThe workshop requires two preparation days.",
  );
  await ingest(store, input, { metadata: { title: "Fictional Orchard" } });
  running = await serve(store, "local", resolve("dist/hub"), 0, { hub: true });
});
test.afterAll(async () => {
  await waitAutomations(store);
  await new Promise((ok) => running.server.close(ok));
  store.close();
  rmSync(root, { recursive: true, force: true });
});
test("review, enable, run, pause and edit a fictional automation without AI or a schedule", async ({
  page,
}) => {
  await page.goto(
    new URL(
      "/hub?view=configuration&section=Automations#" + running.token,
      running.url,
    ).href,
  );
  await expect(
    page.getByRole("heading", { name: "Automations", exact: true }),
  ).toBeVisible();
  const create = page.getByRole("button", {
    name: "New automation",
    exact: true,
  });
  await create.click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Orchard knowledge health");
  await dialog.getByLabel("Fictional Orchard", { exact: true }).check();
  await dialog.getByRole("button", { name: "Preview scope" }).click();
  await expect(
    dialog.getByRole("region", { name: "Automation preview" }),
  ).toContainText("1 recorded sources");
  await dialog
    .getByRole("button", { name: "Save disabled definition" })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("article")).toContainText("disabled");
  await page.getByRole("button", { name: "Review to enable" }).click();
  await page.getByRole("button", { name: "Confirm scope and enable" }).click();
  await expect(page.getByRole("article")).toContainText("enabled");
  await page.getByRole("button", { name: "Run once", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Automations", exact: true }),
  ).toContainText("completed", { timeout: 10000 });
  await page.getByRole("button", { name: "Pause now" }).click();
  await expect(page.getByRole("article")).toContainText("paused");
  expect(store.one("SELECT count(*) n FROM ai_jobs").n).toBe(0);
  expect(store.one("SELECT count(*) n FROM automation_runs").n).toBe(1);
  await page
    .getByRole("button", { name: "Orchard knowledge health", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit definition" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("revokes its scheduler credential");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await create.click();
  await page.keyboard.press("Escape");
  await expect(create).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(page).toHaveScreenshot(`automations-${width}.png`, {
      fullPage: true,
      animations: "disabled",
      mask: [page.getByRole("list"), page.getByText(/^Last run:/)],
    });
  }
});
