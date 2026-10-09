import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedDailyDemo } from "../../scripts/daily-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { proposeCalendar } from "../../dist/core/calendar.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-calendar-"));
  const demo = await seedDailyDemo(join(root, "workspace with spaces"));
  s = new Store(demo.workspace);
  const p = s.one("SELECT * FROM passages LIMIT 1");
  proposeCalendar(
    s,
    {
      calendarId: "fictional-calendar",
      title: "Prepare Cedar review",
      start: "2035-01-01T09:00:00Z",
      end: "2035-01-01T09:30:00Z",
      timezone: "Europe/Paris",
      evidence: [
        {
          revisionId: p.revision_id,
          passageId: p.id,
          quote: p.text.slice(0, 20),
        },
      ],
    },
    "local",
  );
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  if (running) await new Promise((ok) => running.server.close(ok));
  s?.close();
  rmSync(root, { recursive: true, force: true });
});
test("keyboard approval persists, execution stays disabled and narrow layout remains usable", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  const region = page.getByRole("region", { name: "Calendar approvals" });
  await expect(region).toContainText("Prepare Cedar review");
  await region.getByRole("button", { name: "Approve exact event" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    region.getByRole("button", {
      name: "Check availability and create approved event",
    }),
  ).toBeVisible();
  await region
    .getByRole("button", {
      name: "Check availability and create approved event",
    })
    .click();
  await expect(region.getByRole("alert")).toContainText(
    "EXTERNAL_ACTION_DENIED",
  );
  await page.reload();
  await page.getByRole("tab", { name: "Today", exact: true }).click();
  await expect(region).toContainText("approved");
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(375);
});
