import { test, expect, _electron as electron } from "@playwright/test";
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initialize, Store, migrate } from "../../dist/core/store.js";
import JSZip from "jszip";
import { backup, restore, verifyBackup } from "../../dist/core/backup.js";
import { retrieve } from "../../dist/core/intake.js";
import { inspectLock } from "../../dist/core/locks.js";
const require = createRequire(import.meta.url),
  executable = process.env.HOI_DESKTOP_TEST_EXECUTABLE || require("electron"),
  exec = promisify(execFile);
const stage = resolve(".desktop-stage");
let root, app;
test.beforeEach(() => (root = mkdtempSync(join(tmpdir(), "hoi desktop "))));
test.afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
  rmSync(root, { recursive: true, force: true });
});
async function launch(workspace) {
  app = await electron.launch({
    executablePath: executable,
    env:
      process.env.HOI_DESKTOP_TEST_NO_SYSTEM_TOOLS === "1"
        ? { ...process.env, PATH: "" }
        : process.env,
    args: [
      ...(process.env.HOI_DESKTOP_TEST_EXECUTABLE ? [] : [stage]),
      "--hoi-profile",
      join(root, "profile"),
      ...(workspace ? ["--workspace", workspace] : []),
    ],
  });
  return app.firstWindow();
}
async function setup(page) {
  await page.goto("hoi://desktop/index.html");
  await expect(
    page.getByRole("heading", { name: "Engine status" }),
  ).toBeVisible();
}
test("isolated renderer, app-only import, bundled CLI, restart and clean quit", async () => {
  const workspace = join(root, "private workspace");
  const page = await launch();
  await expect(
    page.getByRole("button", { name: "Create workspace", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: join(root, "first-launch.png") });
  expect(await page.evaluate(() => typeof require)).toBe("undefined");
  expect(await page.evaluate(() => typeof process)).toBe("undefined");
  const prefs = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );
  expect(await app.evaluate(() => process.versions.electron)).toBe(
    JSON.parse(readFileSync("package.json", "utf8")).devDependencies.electron,
  );
  expect(prefs.sandbox).toBe(true);
  expect(prefs.contextIsolation).toBe(true);
  expect(prefs.nodeIntegration).toBe(false);
  const setupURL = page.url();
  await page.evaluate(() => {
    location.href = "file:///etc/passwd";
  });
  await expect(page).toHaveURL(setupURL);
  expect(
    await page.evaluate(async () => {
      try {
        await fetch("https://example.test/");
        return "allowed";
      } catch {
        return "denied";
      }
    }),
  ).toBe("denied");
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, workspace);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/127\.0\.0\.1.*\/app/);
  expect(existsSync(join(workspace, ".agents"))).toBe(false);
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await expect(page.getByLabel("knowledge chat")).toBeVisible();
  await page.getByRole("button", { name: "Context", exact: true }).click();
  await expect(page.getByLabel("Context scope")).toHaveValue("knowledge");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await page.getByLabel("Choose documents", { exact: true }).setInputFiles({
    name: "orchard.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Orchard\nFictional Orchard workshop preparation notes.",
    ),
  });
  await page.getByRole("button", { name: "Review import manifest" }).click();
  await page.getByRole("button", { name: "Import reviewed files" }).click();
  await expect(page.getByText("orchard.md · indexed")).toBeVisible();
  const docx = new JSZip();
  docx.file(
    "word/document.xml",
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Fictional Orchard training guide.</w:t></w:r></w:p></w:body></w:document>',
  );
  await page.getByLabel("Choose documents", { exact: true }).setInputFiles({
    name: "training.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await docx.generateAsync({ type: "nodebuffer" }),
  });
  await page.getByRole("button", { name: "Review import manifest" }).click();
  await page.getByRole("button", { name: "Import reviewed files" }).click();
  await expect(page.getByText("training.docx · indexed")).toBeVisible();
  const activity = page.getByRole("button", { name: /^Activity/ });
  await activity.click();
  const drawer = page.getByRole("dialog", { name: "Activity" });
  await drawer.getByRole("tab", { name: "Completed", exact: true }).click();
  await expect(drawer).toContainText("training.docx");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(activity).toBeFocused();
  const cli = async () =>
    JSON.parse(
      (
        await exec(
          executable,
          [
            stage,
            "--hoi-cli",
            "retrieve",
            "Orchard",
            "--workspace",
            workspace,
            "--host",
            "codex",
            "--json",
          ],
          { timeout: 30000, env: { ...process.env, ELECTRON_RUN_AS_NODE: "" } },
        )
      ).stdout,
    );
  await expect
    .poll(async () => (await cli()).results.length)
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Configuration", exact: true })
    .click();
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
  }, root);
  await page.getByText("Add a connection", { exact: true }).click();
  await page
    .getByRole("button", { name: "Choose source folder", exact: true })
    .click();
  await expect(page.getByLabel("Local folder")).toHaveValue(root);
  await page
    .getByRole("tab", { name: "Skills & capabilities", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Install / repair codex adapter",
      exact: true,
    })
    .click();
  await expect
    .poll(() => existsSync(join(workspace, ".hoi/runtime.json")))
    .toBe(true);
  const runtime = JSON.parse(
    readFileSync(join(workspace, ".hoi/runtime.json")),
  );
  expect(runtime.command.args).toContain("--hoi-cli");
  const guideManifest = JSON.parse(
    readFileSync(join(workspace, ".hoi/adapters/codex.json")),
  ).guides;
  for (const name of [
    "RULES.md",
    "FILESYSTEM.md",
    "TOOL_CONVENTIONS.md",
    "OPERATIONS_REFERENCE.md",
  ]) {
    expect(
      existsSync(join(workspace, ".hoi/guides", guideManifest.digest, name)),
    ).toBe(true);
    expect(readFileSync(join(workspace, "AGENTS.md"), "utf8")).toContain(
      `.hoi/guides/${guideManifest.digest}/${name}`,
    );
  }
  const adapterResult = JSON.parse(
    (
      await exec(
        runtime.command.executable,
        [
          ...runtime.command.args,
          "retrieve",
          "Orchard",
          "--workspace",
          workspace,
          "--host",
          "codex",
          "--json",
        ],
        { timeout: 30000 },
      )
    ).stdout,
  );
  expect(adapterResult.results.length).toBeGreaterThan(0);
  await page
    .getByRole("tab", { name: "Workspace & recovery", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Desktop workspace and engine controls" })
    .click();
  await page.getByRole("button", { name: "Restart engine" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1.*\/app/);
  expect((await cli()).results.length).toBeGreaterThan(0);
  await app.close();
  app = null;
  expect(inspectLock(workspace).state).toBe("clear");
  expect(existsSync(join(workspace, ".hoi/workspace.json"))).toBe(true);
});
test("older workspace needs an explicit verified upgraded copy", async () => {
  const old = join(root, "old workspace"),
    copy = join(root, "upgraded workspace");
  initialize(old);
  const s = new Store(old);
  s.db.pragma("user_version = 11");
  s.close();
  const page = await launch(old);
  await expect(
    page.getByRole("button", { name: "Create upgraded copy" }),
  ).toBeVisible();
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, old);
  await page.getByRole("button", { name: "Create upgraded copy" }).click();
  await expect(page.getByRole("alert")).toContainText("UPGRADE_LOCATION");
  await page.getByRole("button", { name: "Restart engine" }).click();
  await expect(
    page.getByRole("button", { name: "Create upgraded copy" }),
  ).toBeVisible();
  const occupied = join(root, "occupied");
  mkdirSync(occupied);
  writeFileSync(join(occupied, "keep.txt"), "Preserve this file");
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, occupied);
  await page.getByRole("button", { name: "Create upgraded copy" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "UPGRADE_DESTINATION_NOT_EMPTY",
  );
  expect(readFileSync(join(occupied, "keep.txt"), "utf8")).toBe(
    "Preserve this file",
  );
  await page.getByRole("button", { name: "Restart engine" }).click();
  await expect(
    page.getByRole("button", { name: "Create upgraded copy" }),
  ).toBeVisible();
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, copy);
  await page.getByRole("button", { name: "Create upgraded copy" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1.*\/app/);
  await app.close();
  app = null;
  const a = new Store(old),
    b = new Store(copy);
  try {
    expect(a.schemaVersion).toBe(11);
    expect(b.schemaVersion).toBe(19);
  } finally {
    a.close();
    b.close();
  }
  expect(
    JSON.parse(readFileSync(join(root, "profile/desktop.json"))).workspace,
  ).toBe(copy);
});

test("app-only onboarding, full relaunch and separate recovery copies retain evidence", async () => {
  const workspace = join(root, "app-only workspace");
  let page = await launch();
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, workspace);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/127\.0\.0\.1.*\/app/);
  await page
    .getByRole("button", { name: "Continue setup", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Fictional Rowan");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByLabel("Timezone (IANA name)").fill("Europe/Paris");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await expect(page.getByLabel("Preferred experience")).toHaveValue("none");
  await page
    .getByRole("button", { name: "Save and continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page.getByRole("button", { name: "Skip for now", exact: true }).click();
  await page
    .getByRole("button", { name: "Save and finish", exact: true })
    .click();
  await expect(
    page.getByText(
      "Setup checklist complete. Skipped features remain unconfigured.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Knowledge Hub", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ingestion", exact: true }).click();
  await page.getByLabel("Choose documents", { exact: true }).setInputFiles({
    name: "rowan.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Rowan\nFictional Rowan workshop reference ROW-409 uses a blue notebook.",
    ),
  });
  await page.getByRole("button", { name: "Review import manifest" }).click();
  await page.getByRole("button", { name: "Import reviewed files" }).click();
  await expect(page.getByText("rowan.md · indexed")).toBeVisible();
  await app.close();
  app = null;
  const noAdapters = () => {
    for (const file of [
      "AGENTS.md",
      "CLAUDE.md",
      ".agents",
      ".claude",
      ".hoi/runtime.json",
    ])
      expect(existsSync(join(workspace, file))).toBe(false);
  };
  noAdapters();
  let s = new Store(workspace);
  let original;
  try {
    expect(s.one("SELECT COUNT(*) n FROM ai_providers").n).toBe(0);
    original = retrieve(s, "ROW-409", "local").results;
    expect(original.length).toBeGreaterThan(0);
  } finally {
    s.close();
  }
  page = await launch(workspace);
  await expect(page).toHaveURL(/127\.0\.0\.1.*\/app/);
  await app.close();
  app = null;
  noAdapters();
  s = new Store(workspace);
  const snapshot = join(root, "verified backup"),
    restored = join(root, "restored copy"),
    upgraded = join(root, "upgraded copy");
  try {
    expect(retrieve(s, "ROW-409", "local").results).toEqual(original);
    expect(backup(s, snapshot).verified).toBe(true);
    verifyBackup(snapshot);
  } finally {
    s.close();
  }
  restore(snapshot, restored);
  restore(snapshot, upgraded);
  for (const path of [restored, upgraded]) {
    const copy = new Store(path);
    try {
      // Exercises the sequential migration entrypoint on an isolated copy.
      // This is a schema marker fixture, not a genuine historical release database.
      if (path === upgraded) {
        copy.db.pragma("user_version = 18");
        migrate(copy);
      }
      expect(copy.schemaVersion).toBe(19);
      expect(retrieve(copy, "ROW-409", "local").results).toEqual(original);
      expect(copy.one("SELECT COUNT(*) n FROM ai_providers").n).toBe(0);
    } finally {
      copy.close();
    }
  }
  s = new Store(workspace);
  try {
    expect(retrieve(s, "ROW-409", "local").results).toEqual(original);
  } finally {
    s.close();
  }
  expect(inspectLock(workspace).state).toBe("clear");
});
