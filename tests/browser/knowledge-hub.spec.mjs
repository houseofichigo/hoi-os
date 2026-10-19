import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { listSkills } from "../../dist/core/skill-library.js";
import { saveRecord } from "../../dist/core/workspace.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-hub-surface-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  running = await serve(s, "local", resolve("dist/hub"), 0, { hub: true });
});

test("standalone Hub skill handoff stays unsent, restores focus and handles old app links", async ({
  page,
}) => {
  const mutations = [],
    resources = [];
  page.on("request", (r) => {
    if (r.method() === "POST") mutations.push(r.url());
    resources.push(r.url());
  });
  await page.goto(running.url);
  await expect(
    page.getByRole("heading", { name: "Your knowledge, connected." }),
  ).toBeVisible();
  expect(resources.some((url) => url.includes("react-force-graph"))).toBe(
    false,
  );
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  const selected = listSkills(s, "local").find(
    (r) => r.enabled && r.compatible && r.presentation?.examples?.length,
  );
  const tile = page.locator(".skill-tile").filter({
    has: page.getByRole("button", {
      name: selected.presentation.displayName,
      exact: true,
    }),
  });
  await tile.getByRole("button", { name: "Use skill", exact: true }).click();
  const handoff = page.getByRole("dialog", {
    name: "Ask your assistant",
    exact: true,
  });
  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole("textbox")).toHaveValue(
    new RegExp(selected.checksum),
  );
  await page.keyboard.press("Escape");
  await expect(
    tile.getByRole("button", { name: "Use skill", exact: true }),
  ).toBeFocused();
  await tile
    .getByRole("button", {
      name: selected.presentation.examples[0],
      exact: false,
    })
    .click();
  await expect(handoff.getByRole("textbox")).toHaveValue(
    new RegExp(selected.id),
  );
  expect(await handoff.getByRole("textbox").inputValue()).toContain(
    selected.presentation.examples[0],
  );
  await page.keyboard.press("Escape");
  expect(mutations).toEqual([]);
  await page.goto(new URL("/app?view=chat", running.url).href);
  await expect(
    page.getByRole("heading", { name: "Related workflow" }),
  ).toBeVisible();
  await expect(page.getByText(/No action has been taken/)).toBeVisible();
  await page.getByRole("button", { name: "Back to Knowledge Hub" }).click();
  await expect(page).toHaveURL(/\/hub\?view=knowledge/);
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Configuration", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [width, height] of [
    [375, 812],
    [812, 375],
    [768, 950],
    [1280, 950],
    [1440, 950],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});
test.afterAll(async () => {
  if (running) await new Promise((ok) => running.server.close(ok));
  s?.close();
  rmSync(root, { recursive: true, force: true });
});
test("Hub retains reviewed memory and reads related records without legacy editors", async ({
  page,
}) => {
  const project = saveRecord(
    s,
    {
      kind: "project",
      expectedVersion: 0,
      record: {
        name: "Fictional Orchard linked project",
        objective: "Prepare the workshop",
        owner: "Morgan",
      },
    },
    "local",
  );
  await page.goto(running.url);
  await page.getByRole("tab", { name: "Memory", exact: true }).click();
  await page
    .getByRole("button", { name: "Add attributed note", exact: true })
    .click();
  await page
    .getByLabel("Your statement", { exact: true })
    .fill("Orchard prefers small-group exercises.");
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
  await expect(
    page.getByText("Orchard prefers small-group exercises.", { exact: true }),
  ).toBeVisible();
  await page.goto(new URL("/hub?project=" + project.id, running.url).href);
  await expect(
    page.getByRole("heading", {
      name: "Fictional Orchard linked project",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Prepare the workshop", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save project", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Create wiki draft", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/hub\?view=knowledge&section=Wiki&wikiSubject=/,
  );
  await expect(
    page.getByRole("dialog", { name: "Wiki draft", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(new URL("/hub?project=project_missing", running.url).href);
  await expect(
    page.getByText("This record is unavailable or no longer permitted."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Fictional Orchard linked project",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("hub needs no skills or AI and retains reviewed import, wiki editing, map and history", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect(existsSync(join(root, "workspace", "AGENTS.md"))).toBe(false);
  await page.goto(running.url.split("#")[0]);
  await expect(
    page.getByRole("heading", { name: "Open your secure workspace link" }),
  ).toBeVisible();
  await page.goto(running.url);
  await expect(
    page.getByRole("heading", { name: "Your knowledge, connected." }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Workspace", exact: true });
  for (const name of ["Home", "Inbox", "Projects", "Clients", "Chat"])
    await expect(nav.getByRole("button", { name, exact: true })).toHaveCount(0);
  for (const name of [
    "Overview",
    "Sources",
    "Ingestion",
    "Wiki",
    "Memory",
    "Map",
    "Reviews",
  ])
    await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await page.getByLabel("Choose documents", { exact: true }).setInputFiles({
    name: "fictional-brief.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "Fictional Orchard workshop requires two preparation days.",
    ),
  });
  await page.getByRole("button", { name: "Review import manifest" }).click();
  await page.getByRole("button", { name: "Import reviewed files" }).click();
  await expect(page.getByText("fictional-brief.md · indexed")).toBeVisible();
  await page.getByRole("tab", { name: "Wiki", exact: true }).click();
  await page
    .getByRole("button", { name: "Create wiki draft", exact: true })
    .click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Fictional Orchard note");
  await page
    .getByLabel("Provenance", { exact: true })
    .selectOption("user-authored");
  await page
    .getByLabel("Markdown", { exact: true })
    .fill("A manually attributed test note.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Compare and publish", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Publish reviewed revision", exact: true })
    .click();
  await page.getByRole("button", { name: "Close wiki", exact: true }).click();
  await page.getByRole("tab", { name: "Map", exact: true }).click();
  await page
    .getByRole("button", { name: /Fictional Orchard note/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Fictional Orchard note", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/hub-wiki-before-handoff.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("dialog", { name: "Fictional Orchard note", exact: true })
    .getByRole("button", { name: "Ask about this", exact: true })
    .click({ timeout: 5000 });
  await expect(
    page.getByRole("dialog", { name: "Ask your assistant", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/No request has been sent/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Memory", exact: true }).click();
  await expect(page).toHaveURL(/\/hub\?view=knowledge&section=Memory/);
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "Memory", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "Map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Fictional Orchard note/ }).first(),
  ).toBeVisible();
  const wiki = page.getByRole("dialog", {
    name: "Fictional Orchard note",
    exact: true,
  });
  if (!(await wiki.isVisible()))
    await page
      .getByRole("button", { name: /Fictional Orchard note/ })
      .first()
      .click();
  await expect(wiki).toBeVisible();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    const header = await wiki.locator(".wiki-panel-header").boundingBox();
    const action = await wiki
      .getByRole("button", { name: "Ask about this", exact: true })
      .boundingBox();
    expect(action.y + action.height).toBeLessThanOrEqual(
      header.y + header.height,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `test-results/hub-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
});
