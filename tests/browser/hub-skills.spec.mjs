import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";

let root, store, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-hub-skills-"));
  initialize(join(root, "workspace"));
  store = new Store(join(root, "workspace"));
  running = await serve(store, "local", resolve("dist/hub"), 0, { hub: true });
});
test.afterAll(async () => {
  await new Promise((resolve) => running.server.close(resolve));
  store.close();
  rmSync(root, { recursive: true, force: true });
});

test("Hub imports remain drafts, activation is explicit and use opens an unsent reference", async ({
  page,
}) => {
  const url = new URL(running.url);
  url.searchParams.set("view", "skills");
  await page.goto(url.href);
  await expect(
    page.getByRole("button", { name: "Create skill", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("Disabled");
  await expect(page.locator(".skill-tile")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters" }).click();
  await page.getByRole("button", { name: "Import skill", exact: true }).click();
  const zip = new JSZip();
  zip.file(
    "gallery-import/SKILL.md",
    "---\nname: gallery-import\ndescription: Fictional gallery import\n---\nDo not execute scripts.\n",
  );
  zip.file(
    "gallery-import/scripts/no.py",
    "raise Exception('must not execute')\n",
  );
  await page.getByLabel("Import package", { exact: true }).setInputFiles({
    name: "gallery-import.skill",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByText("Instructions to review", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Skill import preview" }),
  ).toContainText("Do not execute scripts.");
  await page.getByRole("button", { name: "Import reviewed draft" }).click();
  await page.getByRole("button", { name: "Close skill", exact: true }).click();
  await page.getByRole("tab", { name: "My skills", exact: true }).click();
  const tile = page
    .locator(".skill-tile")
    .filter({ hasText: "Fictional gallery import" });
  await expect(tile).toHaveCount(1);
  await expect(
    tile.getByRole("button", { name: "Use skill", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Manage skills", exact: true })
    .click();
  await tile.getByRole("button", { name: "Manage", exact: true }).click();
  await page
    .getByRole("button", { name: "Activate reviewed revision", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    tile.getByRole("button", { name: "Manage", exact: true }),
  ).toBeFocused();
  await tile.getByRole("button", { name: "Use skill", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Ask your assistant", exact: true })
      .getByRole("textbox"),
  ).toHaveValue(/gallery-import.*Resolve and verify revision/s);
  await page.keyboard.press("Escape");
  await tile.getByRole("button", { name: "Manage", exact: true }).click();
  let release;
  const responseHeld = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/skills/control", async (route) => {
    const response = await route.fetch();
    await responseHeld;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await page.keyboard.press("Escape");
  release();
  await expect(
    page.getByRole("dialog", { name: "Skill details", exact: true }),
  ).toHaveCount(0);
  await expect(
    tile.getByRole("button", { name: "Use skill", exact: true }),
  ).toBeDisabled();
});

test("Hub skill gallery remains usable at each supported width", async ({
  page,
}) => {
  const url = new URL(running.url);
  url.searchParams.set("view", "skills");
  await page.goto(url.href);
  await expect(page.locator(".skill-tile").first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    const first = await page.locator(".skill-tile").nth(0).boundingBox();
    const second = await page.locator(".skill-tile").nth(1).boundingBox();
    if (width >= 1280) expect(second.x).toBeGreaterThan(first.x);
    else if (width === 390) expect(second.x).toBe(first.x);
    // Baselines are scoped to the platform on which they were inspected.
    if (process.platform === "darwin")
      await expect(page).toHaveScreenshot(`hub-skills-${width}.png`, {
        fullPage: true,
        animations: "disabled",
      });
  }
});
