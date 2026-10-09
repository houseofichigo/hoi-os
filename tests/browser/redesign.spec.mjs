import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedDailyDemo } from "../../scripts/daily-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-redesign-"));
  const demo = await seedDailyDemo(join(root, "workspace with spaces"));
  s = new Store(demo.workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  if (running) await new Promise((ok) => running.server.close(ok));
  s?.close();
  rmSync(root, { recursive: true, force: true });
});
test("knowledge upload, archive impact and restoration are usable through the app", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await page.getByLabel("Choose documents", { exact: true }).setInputFiles({
    name: "review-note.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("Fictional workshop preparation evidence."),
  });
  await page.getByRole("button", { name: "Review import manifest" }).click();
  await page.getByRole("button", { name: "Import reviewed files" }).click();
  await expect(page.getByText("review-note.md · indexed")).toBeVisible();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "review-note.md" });
  await row.getByRole("button", { name: "Review archive" }).click();
  await page.getByRole("button", { name: "Confirm archive" }).click();
  await expect(row).toContainText("archived");
  await row.getByRole("button", { name: "Review restore" }).click();
  await page.getByRole("button", { name: "Confirm restore" }).click();
  await expect(row).toContainText("active");
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Knowledge views" }),
  ).toBeVisible();
});
test("client gallery and project detail editing persist and configuration reports honest availability", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Clients", exact: true }).click();
  await page.getByRole("button", { name: "New client", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit client" });
  await editor.getByLabel("Name", { exact: true }).fill("Fictional Orchard");
  await editor
    .getByRole("button", { name: "Save client", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fictional Orchard", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const p = page.getByRole("dialog", { name: "Edit project" });
  await p.getByLabel("Name", { exact: true }).fill("Orchard workshop");
  await p.getByLabel("Fictional Orchard", { exact: true }).check();
  await p.getByLabel("Objective", { exact: true }).fill("Prepare the workshop");
  await p.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Orchard workshop" }),
  ).toContainText("Fictional Orchard");
  await page.reload();
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Orchard workshop", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await expect(page.getByText("CREDENTIAL_STORAGE · not-tested")).toBeVisible();
  await page
    .getByRole("tab", { name: "Assistant & search", exact: true })
    .click();
  await expect(page.getByText(/Assistant-mediated only/)).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
  await page.screenshot({
    path: "test-results/redesign-mobile.png",
    fullPage: true,
  });
});

test("optional adapters can be installed and removed through Configuration", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Skills & capabilities", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "codex · not-installed", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Install / repair codex adapter",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "codex · verified", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Executable engine tools", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove codex adapter", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "codex · not-installed", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Knowledge Hub", exact: true }),
  ).toBeVisible();
});

test("durable extraction gaps can be cancelled without removing their originals", async ({
  page,
}) => {
  const { writeFileSync } = await import("node:fs");
  const { ingest } = await import("../../dist/core/intake.js");
  const path = join(root, "unknown-format.bin");
  writeFileSync(path, "Fictional unsupported content");
  const job = await ingest(s, path);
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  const row = page.locator("article").filter({ hasText: job.jobId });
  await expect(row).toContainText("extraction-gap");
  await row.getByRole("button", { name: "Cancel intake", exact: true }).click();
  await expect(row).toContainText("cancelled");
  await page.reload();
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await expect(
    page.locator("article").filter({ hasText: job.jobId }),
  ).toContainText("cancelled");
  expect(
    s.one("SELECT source_id FROM revisions WHERE id=?", job.revisionId)
      .source_id,
  ).toBe(job.sourceId);
});

test("Home opens exact task evidence and exact meeting with keyboard actions", async ({
  page,
}) => {
  await page.goto(running.url);
  const deadlines = page.getByRole("region", {
    name: "Deadlines",
    exact: true,
  });
  await deadlines
    .getByRole("link", { name: "Open task", exact: true })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("region", {
    name: "Task details",
    exact: true,
  });
  await expect(detail).toContainText("Bring the Cedar proposal");
  await detail
    .getByRole("button", { name: "Read evidence 1", exact: true })
    .click();
  await expect(page.getByRole("blockquote").last()).toContainText("Alex");
  await page.getByRole("link", { name: "Back to Home", exact: true }).click();
  await page
    .getByRole("region", { name: "Meetings", exact: true })
    .getByRole("link", { name: "Prepare this meeting", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Meeting brief", exact: true }),
  ).toContainText("Cedar proposal review");
  await expect(
    page.getByRole("region", { name: "Meeting brief", exact: true }),
  ).toContainText("Alex (fictional)");
});

test("saved project views survive a new browser context without localStorage", async ({
  page,
  browser,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View 1", exact: true }),
  ).toBeVisible();
  const ctx = await browser.newContext();
  try {
    const other = await ctx.newPage();
    await other.goto(running.url);
    await other.getByRole("button", { name: "Projects", exact: true }).click();
    await expect(
      other.getByRole("button", { name: "View 1", exact: true }),
    ).toBeVisible();
    await other.getByRole("button", { name: "View 1", exact: true }).click();
  } finally {
    await ctx.close();
  }
});

test("security findings show scoped evidence and honest live-provider gaps on narrow screens", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await page.getByRole("tab", { name: "Security", exact: true }).click();
  await expect(page.getByText(/Build [a-f0-9]{12}/)).toBeVisible();
  await expect(page.getByText("CREDENTIAL_STORAGE · not-tested")).toBeVisible();
  await expect(
    page.getByText("LIVE_PROVIDER_ACCESS · not-tested"),
  ).toBeVisible();
  await expect(page.getByText("DATABASE_INTEGRITY · pass")).toBeVisible();
  await expect(
    page.getByText("Live OS credential store", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
});

test("source library opens a readable preview and restores keyboard focus; map has one workspace shell", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await page.getByLabel("Search sources").fill("review-note");
  const open = page.getByRole("button", {
    name: "review-note.md",
    exact: true,
  });
  await open.focus();
  await page.keyboard.press("Enter");
  const reader = page.getByRole("dialog", { name: "Source preview" });
  await expect(reader).toContainText(
    "Fictional workshop preparation evidence.",
  );
  await page.keyboard.press("Escape");
  await expect(reader).toHaveCount(0);
  await expect(open).toBeFocused();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Knowledge views" }),
  ).toBeVisible();
});
