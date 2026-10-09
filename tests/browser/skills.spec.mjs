import JSZip from "jszip";
import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { seedExecutiveDemo } from "../../scripts/executive-demo.mjs";
import { Store } from "../../dist/core/store.js";
import { serve } from "../../dist/core/server.js";
let root, s, running;
test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "hoi-skills-ui-"));
  const d = await seedExecutiveDemo(join(root, "workspace"));
  s = new Store(d.workspace);
  running = await serve(s, "local", resolve("dist/web"), 0, { app: true });
});
test.afterAll(async () => {
  await new Promise((ok) => running.server.close(ok));
  s.close();
  rmSync(root, { recursive: true, force: true });
});
test("mixed delivery projects share records and unscheduled training is explicit", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("tab", { name: "Trainings", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Lumen leadership workshop (fictional)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No session scheduled.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Consulting", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Lumen leadership workshop (fictional)",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Lumen leadership workshop (fictional)",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/project=/);
});
test("reviewed skill drafts activate and enter a bounded handoff with selected documents", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page.getByRole("button", { name: "Import skill", exact: true }).click();
  await page.getByLabel("Import package").setInputFiles({
    name: "SKILL.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "---\nname: browser-review\ndescription: Fictional browser review\nengineApiVersion: 1\nrequiredOperations: []\n---\nReview only supplied evidence.",
    ),
  });
  await page
    .getByRole("button", { name: "Import reviewed draft", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Activate reviewed revision", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Disable", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close skill", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();

  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByLabel("Selected skill").selectOption("browser-review");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add context", exact: true }).click();
  await page.locator(".context-picker input[type=checkbox]").first().check();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Review the selected document");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByLabel("Response mode", { exact: true })
    .selectOption("handoff");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Prepare request", exact: true })
    .click();
  await expect(page.getByLabel("Chat request", { exact: true })).toBeVisible();
  const req = JSON.parse(
    await page.getByLabel("Chat request", { exact: true }).inputValue(),
  );
  expect(req.skillInstructions.name).toBe("browser-review");
  expect(req.context[0].selectedDocuments).toHaveLength(1);
  await expect(
    page.getByText(/Skill instructions supplied/).first(),
  ).toBeVisible();
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
});

test("chat reviews uploaded transcripts before import and pins them with a task skill", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page
    .getByLabel("Chat project", { exact: true })
    .selectOption({ index: 1 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await page.getByLabel("Selected skill").selectOption("hoi-task-intake");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add context", exact: true }).click();
  const before = s.one("SELECT count(*) n FROM sources").n;
  await page.getByLabel("Files for chat").setInputFiles({
    name: "fictional-transcript.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "Alex: I will prepare the fictional workshop outline. The deadline is not confirmed.",
    ),
  });
  await page
    .getByRole("button", { name: "Review attachments", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Import and attach reviewed files",
      exact: true,
    }),
  ).toBeVisible();
  expect(s.one("SELECT count(*) n FROM sources").n).toBe(before);
  await page
    .getByRole("button", {
      name: "Import and attach reviewed files",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Indexed and attached", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add context", exact: true }).click();
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Propose a to-do from this transcript.");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page
    .getByLabel("Response mode", { exact: true })
    .selectOption("handoff");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Prepare request", exact: true })
    .click();
  await expect(page.getByLabel("Chat request", { exact: true })).toBeVisible();
  const request = JSON.parse(
    await page.getByLabel("Chat request", { exact: true }).inputValue(),
  );
  expect(request.skillInstructions.name).toBe("hoi-task-intake");
  expect(JSON.stringify(request.context)).toContain(
    "deadline is not confirmed",
  );
  expect(request.context[0].selectedDocuments).toHaveLength(1);
});

test("portfolio charts reflect filters, preserve record navigation and respect reduced motion", async ({
  page,
}) => {
  await page.goto(running.url);
  const charts = page.getByRole("region", { name: "Project portfolio charts" });
  await expect(charts.getByText("3 recorded projects")).toBeVisible();
  await expect(
    charts.getByRole("figure", { name: "Delivery mix" }),
  ).toContainText("Mixed delivery");
  await page.getByRole("button", { name: "Projects", exact: true }).click();
  await page.getByLabel("Search Projects", { exact: true }).fill("leadership");
  await page.getByText("Insights", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Project portfolio charts" }),
  ).toContainText("1 recorded projects");
  await page
    .getByText("Project completion · accepted tasks", { exact: true })
    .click();
  await page
    .getByRole("region", { name: "Project portfolio charts" })
    .getByRole("button", {
      name: "Lumen leadership workshop (fictional)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("figure", { name: "Accepted task completion" }),
  ).toContainText("Not measured");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".chart-fill")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  }
});

test("gallery starters open unsent drafts, protect existing messages and restore focus", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  const tile = page.locator(".skill-tile").filter({
    has: page.getByRole("button", { name: "Extract to-dos", exact: true }),
  });
  await expect(tile).toContainText("Example requests");
  await tile
    .getByRole("button", { name: "Extract to-dos from these documents." })
    .click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Extract to-dos from these documents.",
  );
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await expect(page.getByLabel("Selected skill")).toHaveValue(
    "hoi-task-intake",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Chat request", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Your message", { exact: true })
    .fill("Keep my unsent draft");
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page
    .locator(".skill-tile")
    .filter({
      has: page.getByRole("button", {
        name: "Meeting preparation",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Use skill" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep draft", exact: true }).click();
  await expect(page.getByLabel("Your message", { exact: true })).toHaveValue(
    "Keep my unsent draft",
  );
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await page
    .getByRole("button", { name: "Extract to-dos", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const width of [390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `test-results/skills-gallery-${width}.png`,
      fullPage: true,
    });
  }
});

test("gallery visual baseline", async ({ page }) => {
  test.skip(
    process.platform !== "darwin",
    "Visual baselines recorded on macOS; other platform baselines require review.",
  );
  await page.goto(running.url);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  const tile = page.locator(".skill-tile").filter({
    has: page.getByRole("button", { name: "Chief of Staff", exact: true }),
  });
  await expect(tile).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(tile).toHaveScreenshot(`chief-of-staff-${width}.png`, {
      animations: "disabled",
    });
  }
});

test("visual drill-down, source gallery and unsaved record guard keep the same records", async ({
  page,
}) => {
  await page.goto(running.url);
  await page
    .getByRole("figure", { name: "Project status", exact: true })
    .getByRole("link", { name: "Blocked", exact: true })
    .click();
  await expect(page.locator(".record-toolbar select").first()).toHaveValue(
    "blocked",
  );
  await expect(
    page.getByRole("button", { name: "Cedar (fictional)", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Lumen leadership workshop (fictional)",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Name", { exact: true })
    .fill("Unsent project rename");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Name", { exact: true }),
  ).toHaveValue("Unsent project rename");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Sources", exact: true }).click();
  await expect(page.locator(".source-library tbody tr").first()).toBeVisible();
  const count = await page.locator(".source-library tbody tr").count();
  await page
    .getByLabel("Source layout", { exact: true })
    .selectOption("gallery");
  await expect(page.locator(".source-library.gallery tbody tr")).toHaveCount(
    count,
  );
  await page.locator(".source-library.gallery .record-link").first().click();
  await expect(
    page.getByRole("dialog", { name: "Source preview" }),
  ).toBeVisible();
});

test("discovery filters, management and .skill preview preserve reviewed activation", async ({
  page,
}) => {
  await page.goto(running.url);
  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create skill", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Discover", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("Disabled");
  await expect(page.locator(".skill-tile")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByRole("button", { name: "Import skill", exact: true }).click();
  const zip = new JSZip();
  zip.file(
    "gallery-import/SKILL.md",
    "---\nname: gallery-import\ndescription: Fictional gallery import\n---\nDo not execute scripts.",
  );
  zip.file(
    "gallery-import/scripts/no.py",
    "raise Exception('must not execute')",
  );
  await page.getByLabel("Import package").setInputFiles({
    name: "gallery.skill",
    mimeType: "application/zip",
    buffer: await zip.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByText("Instructions to review", { exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Skill import preview" }),
  ).toContainText("Do not execute scripts.");
  await page
    .getByRole("button", { name: "Import reviewed draft", exact: true })
    .click();
  await page.getByRole("button", { name: "Close skill", exact: true }).click();
  await page.getByRole("tab", { name: "My skills", exact: true }).click();
  await page
    .getByLabel("Search skills", { exact: true })
    .fill("gallery-import");
  await expect(page.locator(".skill-tile")).toHaveCount(1);
  await expect(
    page
      .locator(".skill-tile")
      .getByRole("button", { name: "Use skill", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Manage skills", exact: true })
    .click();
  await page
    .locator(".skill-tile")
    .getByRole("button", { name: "Manage", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Activate reviewed revision",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
