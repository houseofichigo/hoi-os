import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { ingest, retrieve } from "../../dist/core/intake.js";
import {
  entity,
  relationship,
  capture,
  reviewMemory,
} from "../../dist/core/knowledge.js";
import { metadata } from "../../dist/core/schema.js";
import { serve } from "../../dist/core/server.js";
let root, s, server, url;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-browser-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  const client = entity(s, {
    id: "entity_atlas",
    name: "Atlas",
    type: "client",
  });
  const project = entity(s, {
    id: "entity_cedar",
    name: "Cedar",
    type: "project",
  });
  relationship(
    s,
    { from: project.id, to: client.id, type: "FOR_CLIENT", basis: "manual" },
    "codex",
  );
  const f = join(root, "brief.md");
  writeFileSync(f, "Cedar launch is approved for September.");
  await ingest(s, f, {
    metadata: {
      title: "Cedar brief",
      client: client.id,
      project: project.id,
      effectiveDate: "2026-09-01",
    },
  });
  const { revisionId, passageId, quote } = retrieve(s, "Cedar", "codex")
    .results[0];
  const m = capture(
    s,
    {
      type: "decision",
      content: "Confirmed Cedar choice",
      entities: [project.id],
      evidence: [{ revisionId, passageId, quote }],
    },
    "codex",
  );
  reviewMemory(s, m.id, "approved", "codex");
  ({ server, url } = await serve(s, "codex", resolve("dist/web"), 0));
});
test.afterAll(async () => {
  await new Promise((ok) => server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("all views, search, evidence, originals, keyboard and narrow viewport", async ({
  page,
}) => {
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: /^Cedar brief document/ }),
  ).toBeVisible();
  for (const name of [
    "Projects",
    "Clients",
    "Memory",
    "Timeline",
    "Overview",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("searchbox").fill("Cedar");
  await page.getByRole("button", { name: /^Cedar brief document/ }).click();
  await expect(
    page.getByRole("button", { name: /supporting passage/ }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /supporting passage/ })
    .first()
    .click();
  await expect(page.locator("blockquote")).toContainText("September");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Open this source revision" }).click();
  expect((await download).suggestedFilename()).toBeTruthy();
  await page.getByRole("searchbox").focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe(
    "SELECT",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
});
test("WebGL unavailable retains functional record list", async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind.startsWith("webgl") ? null : get.call(this, kind, ...args);
    };
  });
  await page.goto(url);
  await page.getByRole("button", { name: "3D map", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "3D rendering is unavailable",
  );
  await expect(
    page.getByRole("button", { name: /^Cedar brief document/ }),
  ).toBeVisible();
});
test("reduced motion, real 3D, expired sessions and stopped server messages", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(url);
  await page.getByRole("button", { name: "3D map", exact: true }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume rendering" }),
  ).toBeVisible();
  await page.route("**/api/graph", (route) =>
    route.fulfill({ status: 401, body: "expired" }),
  );
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("alert")).toContainText("expired");
  await expect(
    page.getByRole("button", { name: /^Cedar brief document/ }),
  ).toHaveCount(0);
  await page.unroute("**/api/graph");
  await page.route("**/api/graph", (route) => route.abort());
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "local server is unavailable",
  );
});
test("1000-document map performance on recorded machine", async ({
  page,
}, info) => {
  // Use real source/revision/passage records, populated in one transaction for benchmark setup.
  s.tx(() => {
    for (let i = 0; i < 1000; i++) {
      const id = `benchmark_${i}`,
        r = `benchrev_${i}`,
        date = "2026-09-01T00:00:00Z";
      s.exec(
        "INSERT INTO sources VALUES(?,?,?,?,?,?,?,?)",
        id,
        id,
        `Benchmark ${i}`,
        id,
        JSON.stringify(metadata.parse({ project: "entity_cedar" })),
        r,
        date,
        date,
      );
      s.exec(
        "INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?)",
        r,
        id,
        "0".repeat(64),
        "unused",
        "{}",
        "ready",
        null,
        date,
      );
    }
  });
  const start = Date.now();
  await page.goto(url);
  await expect(
    page.getByRole("button", { name: /^Benchmark 999 document/ }),
  ).toBeAttached();
  const listMs = Date.now() - start;
  const graphStart = Date.now();
  await page.getByRole("button", { name: "3D map", exact: true }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Pause rendering" }).click();
  const graphMs = Date.now() - graphStart;
  console.log(
    JSON.stringify({
      benchmark: "1000-document map",
      cpu: cpus()[0].model,
      listMs,
      graphMs,
    }),
  );
  await info.attach("performance.json", {
    body: JSON.stringify({
      node: process.version,
      platform: process.platform,
      cpu: cpus()[0].model,
      documents: 1001,
      listMs,
      graphMs,
    }),
    contentType: "application/json",
  });
  // Timing gates apply to the recorded local pilot machine; shared CI reports measurements.
  if (!process.env.CI) {
    expect(listMs).toBeLessThan(2000);
    expect(graphMs).toBeLessThan(5000);
  }
});
