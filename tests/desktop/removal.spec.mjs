import { test, expect, _electron as electron } from "@playwright/test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { initialize, Store } from "../../dist/core/store.js";
import { ingest, retrieve } from "../../dist/core/intake.js";
import { inspectLock } from "../../dist/core/locks.js";

// Explicitly gated: staged tests cannot claim app-bundle removal verification.
test("packaged Mac removal preserves separate workspace and reinstall retrieves evidence", async () => {
  test.skip(
    process.platform !== "darwin" || !process.env.HOI_DESKTOP_TEST_BUNDLE,
    "Requires an explicit local macOS app bundle",
  );
  const bundle = resolve(process.env.HOI_DESKTOP_TEST_BUNDLE);
  const root = mkdtempSync(join(tmpdir(), "hoi removal rehearsal "));
  const installed = join(root, "Installed HOI OS.app"),
    workspace = join(root, "Separate workspace");
  let app;
  function snapshot(path) {
    const result = {};
    function visit(directory, relative = "") {
      for (const e of readdirSync(directory, { withFileTypes: true })) {
        const key = relative + e.name;
        if (e.isDirectory()) visit(join(directory, e.name), key + "/");
        else
          result[key] = createHash("sha256")
            .update(readFileSync(join(directory, e.name)))
            .digest("hex");
      }
    }
    visit(path);
    return result;
  }
  try {
    initialize(workspace);
    const file = join(root, "fictional.md");
    writeFileSync(
      file,
      "Fictional Juniper recovery code JUN-718. Preserve the original notebook.",
    );
    let s = new Store(workspace),
      refs;
    try {
      await ingest(s, file, { host: "local" });
      refs = retrieve(s, "JUN-718", "local").results;
      expect(refs.length).toBeGreaterThan(0);
    } finally {
      s.close();
    }
    const launch = async () => {
      app = await electron.launch({
        executablePath: join(installed, "Contents/MacOS/HOI OS"),
        args: [
          "--hoi-profile",
          join(root, "profile"),
          "--workspace",
          workspace,
        ],
        env: { ...process.env, PATH: "" },
      });
      await expect(await app.firstWindow()).toHaveURL(/127\.0\.0\.1.*\/app/);
      await app.close();
      app = null;
    };
    execFileSync("/usr/bin/ditto", [bundle, installed]);
    await launch();
    expect(inspectLock(workspace).state).toBe("clear");
    const before = snapshot(workspace);
    // Remove only the disposable installation owned by this test, never the source bundle.
    rmSync(installed, { recursive: true });
    expect(existsSync(installed)).toBe(false);
    expect(snapshot(workspace)).toEqual(before);
    execFileSync("/usr/bin/ditto", [bundle, installed]);
    await launch();
    s = new Store(workspace);
    try {
      expect(retrieve(s, "JUN-718", "local").results).toEqual(refs);
      expect(s.one("SELECT COUNT(*) n FROM ai_providers").n).toBe(0);
    } finally {
      s.close();
    }
    expect(existsSync(join(workspace, "AGENTS.md"))).toBe(false);
  } finally {
    if (app) await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
