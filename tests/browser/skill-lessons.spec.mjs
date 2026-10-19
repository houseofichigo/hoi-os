import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { initialize, Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
import { ingest } from "../../dist/core/intake.js";
import { skillDetail } from "../../dist/core/skill-library.js";
import { memoryList } from "../../dist/core/reviewed-memory.js";

let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-lessons-browser-"));
  initialize(join(root, "workspace"));
  s = new Store(join(root, "workspace"));
  const report = join(root, "cedar-rehearsal.md");
  writeFileSync(
    report,
    "# Cedar rehearsal — fictional\n\nInspect the original passage before proposing a commitment. This observation comes from a scripted engine rehearsal, not a live assistant evaluation.",
  );
  await ingest(s, report);
  running = await serve(s, "local", resolve("dist/hub"), 0, { hub: true });
});
test.afterAll(async () => {
  await new Promise((resolve) => running.server.close(resolve));
  s.close();
  rmSync(root, { recursive: true, force: true });
});

test("record, compare and review a scoped lesson without activating or editing the skill", async ({
  page,
}) => {
  const before = skillDetail(s, "hoi-chief-of-staff", "local");
  const url = new URL(running.url);
  url.searchParams.set("view", "skills");
  url.searchParams.set("section", "Improvement");
  await page.goto(url.href);
  await page
    .getByRole("button", { name: "Record lesson", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Record lesson", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Record lesson", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Record procedural lesson" });
  await form
    .getByLabel("Skill", { exact: true })
    .selectOption("hoi-chief-of-staff");
  await expect(
    form.getByLabel("Skill revision", { exact: true }),
  ).not.toHaveValue("");
  await form.getByLabel("Observation type").selectOption("engine-rehearsal");
  await form
    .getByLabel("Lesson", { exact: true })
    .fill("Check the original passage before proposing commitments.");
  await form
    .getByLabel("Applies to")
    .fill("Fictional Cedar meeting briefs only.");
  await form
    .getByLabel("Limitations")
    .fill("No live assistant or independent owner evaluation.");
  await expect(
    form.getByRole("button", { name: "Save lesson for review" }),
  ).toBeDisabled();
  await form.getByLabel("Find report or observation").fill("Cedar rehearsal");
  await form.getByRole("button", { name: "Search passages" }).click();
  await form
    .getByRole("radio", { name: /Inspect the original passage/ })
    .check();
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await form.evaluate((el) => {
      el.scrollTop = 0;
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      form.getByRole("button", { name: "Save lesson for review" }),
    ).toBeEnabled();
    if (process.platform === "darwin")
      await expect(page).toHaveScreenshot(`skill-lesson-form-${width}.png`, {
        animations: "disabled",
      });
  }
  await form.getByRole("button", { name: "Save lesson for review" }).click();
  await expect(form).toHaveCount(0);
  await expect(
    page.getByText("Lesson saved for review.", { exact: false }),
  ).toBeVisible();
  expect(
    memoryList(s, "local", "proposed").filter((m) => m.lesson),
  ).toHaveLength(1);
  await page.reload();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  let review = page.getByRole("dialog", { name: "Memory review", exact: true });
  await expect(review).toContainText("Pinned to the active revision");
  await review
    .getByRole("button", { name: "Compare changes", exact: true })
    .click();
  const compare = page.getByRole("dialog", {
    name: "Compare memory draft",
    exact: true,
  });
  await expect(compare).toContainText(
    "No live assistant or independent owner evaluation.",
  );
  await compare
    .getByRole("button", { name: "Approve exact version", exact: true })
    .click();
  await expect(compare).toHaveCount(0);
  await page.getByRole("tab", { name: "Current", exact: true }).click();
  await expect(
    page.getByText("Check the original passage before proposing commitments.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(skillDetail(s, "hoi-chief-of-staff", "local")).toEqual(before);
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await review
    .getByRole("button", { name: "Propose correction", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit memory draft" });
  await expect(editor.getByLabel("Memory type")).toBeDisabled();
  await editor
    .getByLabel("Your statement")
    .fill(
      "Check the exact source revision and passage before proposing commitments.",
    );
  await editor.getByRole("button", { name: "Save draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect & history", exact: true })
    .click();
  await review.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.getByText("procedural · rejected", { exact: false }),
  ).toBeVisible();
  expect(memoryList(s, "local").filter((m) => m.lesson)).toHaveLength(1);
  await page
    .getByRole("button", { name: "Manage skills", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "My skills", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".skill-tile").first()).toBeVisible();
});
