import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedDailyDemo } from "../../scripts/daily-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-shell-"));
  const demo = await seedDailyDemo(join(root, "Fictional executive demo"));
  const meta = join(demo.workspace, ".hoi/workspace.json");
  writeFileSync(
    meta,
    JSON.stringify({
      ...JSON.parse(readFileSync(meta, "utf8")),
      environment: "demo",
    }),
  );
  s = new Store(demo.workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  if (running) await new Promise((ok) => running.server.close(ok));
  s?.close();
  rmSync(root, { recursive: true, force: true });
});
const nav = (page, name) =>
  page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name, exact: true });
test("missing, expired and offline sessions recover without blank screens", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(running.url.split("#")[0]);
  await expect(
    page.getByRole("heading", { name: "Open your secure workspace link" }),
  ).toBeVisible();
  await page.goto(running.url);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What needs your attention." }),
  ).toBeVisible();
  await page.route("**/api/dashboard", (r) =>
    r.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"error":"denied"}',
    }),
  );
  await page.getByRole("button", { name: "Refresh dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Open your secure workspace link" }),
  ).toBeVisible();
  await page.unroute("**/api/dashboard");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("heading", { name: "What needs your attention." }),
  ).toBeVisible();
  await page.route("**/api/workspace", (r) => r.abort());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The local engine is unavailable" }),
  ).toBeVisible();
  await page.unroute("**/api/workspace");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByText("Fictional executive demo", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("views, subviews and record routes survive refresh and browser history", async ({
  page,
}) => {
  await page.goto(running.url);
  await nav(page, "Knowledge Hub").click();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(page).toHaveURL(/view=knowledge&section=Sources/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Sources", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav(page, "Configuration").click();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Connections", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Sources", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Configuration", exact: true }),
  ).toBeVisible();
  await nav(page, "Projects").click();
  await page
    .getByRole("button", { name: "Cedar (fictional)", exact: true })
    .click();
  await expect(page).toHaveURL(/project=/);
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "Edit project" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(page).not.toHaveURL(/project=/);
  await page.goBack();
  await expect(
    page.getByRole("dialog", { name: "Edit project" }),
  ).toBeVisible();
});
test("view failures are contained and optional data failure leaves recovery available", async ({
  page,
}) => {
  await page.route("**/api/dashboard", (r) =>
    r.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto(running.url);
  await expect(
    page.getByRole("heading", { name: "This view could not load" }),
  ).toBeVisible();
  await nav(page, "Clients").click();
  await expect(
    page.getByRole("heading", { name: "Clients", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/dashboard");
  await page.route("**/api/graph", (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: '{"error":"Unavailable"}',
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry workspace data" }),
  ).toBeVisible();
  await page.unroute("**/api/graph");
  await page.getByRole("button", { name: "Retry workspace data" }).click();
  await expect(
    page.getByRole("button", { name: "Retry workspace data" }),
  ).toHaveCount(0);
});
test("responsive shell keeps keyboard navigation usable and skip links do not replace authentication", async ({
  page,
}) => {
  await page.goto(running.url);
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 761) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    }
    await nav(page, "Knowledge Hub").click();
    await expect(
      page.getByRole("heading", { name: "Knowledge Hub", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width < 761) await expect(nav(page, "Home")).toBeHidden();
  }
  await page.getByRole("link", { name: "Skip to workspace" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Knowledge Hub", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/executive-shell.png" });
});
test("executive dashboard leads with four truthful indicators and links to underlying work", async ({
  page,
}) => {
  await page.goto(running.url);
  const kpis = page.getByLabel("Executive indicators");
  await expect(kpis.getByRole("button")).toHaveCount(4);
  await expect(kpis).toContainText("Needs decision");
  await expect(kpis).toContainText("Due this week");
  await kpis.getByRole("button", { name: /Due this week/ }).click();
  await expect(page.locator("#signal-deadlines")).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Meetings", exact: true }),
  ).toContainText("Cedar proposal review");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/executive-home-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.screenshot({
    path: "test-results/executive-home.png",
    fullPage: true,
  });
});
