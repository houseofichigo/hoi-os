import { test, expect } from "@playwright/test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Store, initialize } from "../../dist/core/store.js";
import { updateAdapters } from "../../dist/core/adapters.js";
import { serve } from "../../dist/core/server.js";
test("adapter settings explain untracked content and disable mutation during interrupted recovery", async ({
  page,
}) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-harness-ui-"));
  const workspace = join(root, "Fictional workspace");
  initialize(workspace);
  const s = new Store(workspace);
  let running;
  try {
    const receipt = updateAdapters(s, "local", {
      action: "install",
      hosts: ["codex"],
    });
    writeFileSync(
      s.path(".agents/skills/hoi-retrieve/unknown.py"),
      "fictional source; never executed",
    );
    running = await serve(s, "local", resolve("dist/hub"), 0, { hub: true });
    const url = new URL(running.url);
    url.searchParams.set("view", "configuration");
    url.searchParams.set("section", "Skills & capabilities");
    await page.goto(url.href);
    await expect(
      page.getByRole("heading", { name: "codex · modified", exact: true }),
    ).toBeVisible();
    await page
      .getByText("Preserved content needs review", { exact: true })
      .click();
    await expect(
      page.getByText(".agents/skills/hoi-retrieve/unknown.py", { exact: true }),
    ).toBeVisible();
    writeFileSync(
      s.path(".hoi/adapter-update.json"),
      JSON.stringify({
        version: 1,
        backup: receipt.backup,
        archive: receipt.archive,
      }),
    );
    await page.reload();
    await expect(
      page.getByText(/An adapter update was interrupted/).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Install / repair codex adapter" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Remove codex adapter" }),
    ).toBeDisabled();
    for (const width of [390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  } finally {
    if (running) await new Promise((ok) => running.server.close(ok));
    s.close();
    rmSync(root, { recursive: true, force: true });
  }
});
