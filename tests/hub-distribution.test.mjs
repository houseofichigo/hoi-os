import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  assertHubModules,
  excludedHubModules,
} from "../scripts/hub-boundary.mjs";
import { stageHub } from "../scripts/hub-stage.mjs";
import { serve } from "../dist/core/server.js";
import { buildIdentity } from "../dist/core/security-evidence.js";
import { fixture } from "./helpers.mjs";

test("Hub build rejects legacy entry points and retains lazy map chunks", () => {
  for (const name of excludedHubModules)
    assert.throws(
      () => assertHubModules(["web/" + name]),
      /HUB_LEGACY_DEPENDENCY/,
    );
  assert.throws(
    () => assertHubModules(["node_modules/electron/index.js"]),
    /HUB_LEGACY_DEPENDENCY/,
  );
  assert.throws(
    () => assertHubModules(["desktop/main.cjs"]),
    /HUB_LEGACY_DEPENDENCY/,
  );
  const manifest = JSON.parse(readFileSync("dist/hub/hub-build.json", "utf8"));
  assertHubModules(manifest.modules);
  assert.ok(manifest.modules.includes("web/hub-app.jsx"));
  assert.ok(manifest.modules.includes("web/map.jsx"));
  const entries = manifest.chunks.filter((c) => c.entry);
  assert.equal(entries.length, 2);
  for (const entry of entries)
    assert.ok(!entry.imports.some((n) => n.includes("react-force-graph")));
  for (const file of ["hub.html", "index.html"])
    assert.ok(existsSync("dist/hub/" + file));
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  assert.ok(
    !Object.keys(lock.packages).some((name) =>
      /node_modules\/(electron|electron-builder|@electron)(\/|$)/.test(name),
    ),
  );
  assert.ok(
    manifest.chunks.some((c) =>
      c.dynamicImports.some((n) => n.includes("react-force-graph")),
    ),
  );
  assert.equal(existsSync("dist/hub/app.html"), false);
});

test("Hub serves only its own entry while preserving authentication and the legacy URL alias", async (t) => {
  const { s } = fixture(t);
  const running = await serve(s, "local", resolve("dist/hub"), 0, {
    hub: true,
  });
  t.after(() => new Promise((ok) => running.server.close(ok)));
  const origin = new URL(running.url).origin;
  for (const path of ["/", "/hub", "/app"]) {
    const r = await fetch(origin + path);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /HOI OS · Knowledge Hub/);
  }
  assert.equal((await fetch(origin + "/app.html")).status, 404);
  assert.equal((await fetch(origin + "/api/workspace")).status, 401);
  assert.equal(
    (
      await fetch(origin + "/api/workspace", {
        headers: { Authorization: `Bearer ${running.token}` },
      })
    ).status,
    200,
  );
});

test("Hub distribution preserves guides and method, excludes desktop/UI runtimes and refuses overwrite", (t) => {
  const root = mkdtempSync(join(tmpdir(), "hoi-stage-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const out = join(root, "package");
  const staged = stageHub(out);
  assert.equal(staged.electron, false);
  const pkg = JSON.parse(readFileSync(join(out, "package.json"), "utf8"));
  assert.equal(pkg.devDependencies, undefined);
  for (const key of [
    "electron",
    "react",
    "react-dom",
    "react-force-graph-3d",
    "radix-ui",
  ])
    assert.equal(pkg.dependencies[key], undefined);
  for (const name of [
    "desktop",
    "dist/web",
    "src",
    "web",
    "workspaces",
    ".secrets",
    "node_modules",
  ])
    assert.equal(existsSync(join(out, name)), false, name);
  for (const name of [
    "method/JOURNEY.md",
    "method/PROVENANCE.json",
    "docs/GUIDES.json",
    "docs/CHIEF_OF_STAFF_RECIPE.md",
    "scripts/chief-recipe.mjs",
    "scripts/hub-acceptance.mjs",
    "docs/HUB_INSTALLATION.md",
    "docs/HOST_ACCEPTANCE.md",
    "examples/chief-of-staff/scenarios.json",
    "dist/hub/hub-build.json",
  ])
    assert.ok(existsSync(join(out, name)), name);
  const manifest = JSON.parse(
    readFileSync(join(out, "HUB_PACKAGE.json"), "utf8"),
  );
  for (const f of manifest.files)
    assert.equal(
      createHash("sha256")
        .update(readFileSync(join(out, f.path)))
        .digest("hex"),
      f.sha256,
      f.path,
    );
  assert.throws(() => stageHub(out), /HUB_STAGE_EXISTS/);
  const identity = buildIdentity(out);
  const recipe = join(out, "scripts/chief-recipe.mjs");
  const recipeBytes = readFileSync(recipe);
  writeFileSync(
    recipe,
    Buffer.concat([recipeBytes, Buffer.from("\n// changed recipe fixture\n")]),
  );
  assert.notEqual(buildIdentity(out), identity);
  writeFileSync(recipe, recipeBytes);
  writeFileSync(
    join(out, "dist/hub/hub.html"),
    readFileSync(join(out, "dist/hub/hub.html"), "utf8") +
      "\n<!-- changed fixture -->",
  );
  assert.notEqual(buildIdentity(out), identity);
  rmSync(join(out, "dist/hub"), { recursive: true });
  assert.throws(() => buildIdentity(out), /ENOENT/);
});
