import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { validateAction, trustedURL, allowedNavigation, safeAsset } =
  createRequire(import.meta.url)("../desktop/boundary.cjs");
test("desktop bridge validates fixed actions and refuses arbitrary inputs", () => {
  assert.equal(validateAction({ action: "status" }), "status");
  for (const input of [
    { action: "exec" },
    { action: "status", path: "/tmp" },
    null,
    [],
    { action: "__proto__" },
  ])
    assert.throws(() => validateAction(input));
});
test("desktop trust is bound to the selected engine and exact asset allowlist", () => {
  const origin = "http://127.0.0.1:12345";
  assert.ok(trustedURL(origin + "/app", origin));
  assert.ok(trustedURL("hoi://desktop/index.html", origin));
  for (const u of [
    "https://evil.test/app",
    "http://127.0.0.1:12346/app",
    origin + "/api/source",
    "file:///etc/passwd",
  ])
    assert.ok(!trustedURL(u, origin));
  assert.ok(allowedNavigation(origin + "/", origin));
  assert.ok(!trustedURL(origin + "/", origin));
  for (const u of [
    "hoi://desktop/../../secret",
    "hoi://other/index.html",
    "https://desktop/index.html",
    "hoi://desktop/package.json",
  ])
    assert.throws(() => safeAsset(u, "/tmp"));
});

test("failed engine bootstrap reports an actionable redacted error and can stop", async (t) => {
  const { mkdtempSync, copyFileSync, writeFileSync, rmSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { fork } = await import("node:child_process");
  const root = mkdtempSync(join(tmpdir(), "hoi-boot-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  copyFileSync(
    resolve("desktop/engine-entry.cjs"),
    join(root, "engine-entry.cjs"),
  );
  writeFileSync(
    join(root, "engine.mjs"),
    'throw Error("private-token private-path");',
  );
  const child = fork(join(root, "engine-entry.cjs"), [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  t.after(() => child.kill());
  const message = await new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(Error("boot timeout")), 5000);
    child.once("message", (m) => {
      clearTimeout(timer);
      ok(m);
    });
    child.once("error", bad);
  });
  assert.match(message.message, /ENGINE_BOOT_FAILED/);
  assert.ok(!message.message.includes("private"));
  const stopped = new Promise((ok) => child.once("exit", ok));
  child.send({ type: "stop" });
  await stopped;
});

test("engine bootstrap retains an immediate request while imports are pending", async (t) => {
  const { mkdtempSync, copyFileSync, writeFileSync, rmSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { fork } = await import("node:child_process");
  const root = mkdtempSync(join(tmpdir(), "hoi-boot-queue-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  copyFileSync(
    resolve("desktop/engine-entry.cjs"),
    join(root, "engine-entry.cjs"),
  );
  writeFileSync(
    join(root, "engine.mjs"),
    'await new Promise(r=>setTimeout(r,100)); process.on("message",m=>{process.send(m);process.disconnect();});',
  );
  const child = fork(join(root, "engine-entry.cjs"), [], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  t.after(() => child.kill());
  const reply = new Promise((ok, bad) => {
    const timer = setTimeout(() => bad(Error("queued message lost")), 5000);
    child.once("message", (m) => {
      clearTimeout(timer);
      ok(m);
    });
    child.once("error", bad);
  });
  child.send({ type: "start", fixture: true });
  assert.deepEqual(await reply, { type: "start", fixture: true });
});
