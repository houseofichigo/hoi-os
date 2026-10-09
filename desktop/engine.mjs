import { join, resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  initialize,
  Store,
  CURRENT_SCHEMA_VERSION,
  migrate,
} from "../dist/core/store.js";
import { serve } from "../dist/core/server.js";
import { backup, restore, verifyBackup } from "../dist/core/backup.js";
import { acquireLock, inspectLock } from "../dist/core/locks.js";
import { diagnostics } from "../dist/core/diagnostics.js";
import { contained } from "../dist/core/files.js";
const product = fileURLToPath(new URL("..", import.meta.url));
let store,
  running,
  stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (running)
    await new Promise((ok, reject) =>
      running.server.close((e) => (e ? reject(e) : ok())),
    );
  store?.close();
  process.disconnect?.();
  process.exit(0);
}
process.on("disconnect", () => void stop());
process.on("SIGTERM", () => void stop());
process.on("message", async (msg) => {
  try {
    if (msg.type === "stop") {
      await stop();
      return;
    }
    if (msg.type !== "start" || store || running)
      throw Error("ENGINE_START_INVALID");
    let workspace = resolve(msg.workspace);
    if (contained(product, workspace) || contained(workspace, product))
      throw Error(
        "WORKSPACE_LOCATION: Select a private folder separate from the app",
      );
    if (msg.create) initialize(workspace);
    if (!existsSync(join(workspace, ".hoi/workspace.json")))
      throw Error(
        "WORKSPACE_MISSING: Select an initialized workspace or create a new one",
      );
    const lock = inspectLock(workspace);
    if (lock.state !== "clear")
      throw Error(
        lock.code +
          ": Another engine or uncertain lock owns this workspace. Stop it or use explicit lock recovery first.",
      );
    store = new Store(workspace);
    if (store.schemaVersion < CURRENT_SCHEMA_VERSION) {
      if (!msg.upgradeDestination) {
        process.send?.({
          type: "needs-upgrade",
          schema: store.schemaVersion,
          currentSchema: CURRENT_SCHEMA_VERSION,
        });
        store.close();
        store = undefined;
        return;
      }
      const destination = resolve(msg.upgradeDestination);
      if (
        contained(product, destination) ||
        contained(destination, product) ||
        contained(workspace, destination) ||
        contained(destination, workspace)
      )
        throw Error("UPGRADE_LOCATION: Choose a separate empty folder");
      if (existsSync(destination) && readdirSync(destination).length)
        throw Error(
          "UPGRADE_DESTINATION_NOT_EMPTY: Choose a new or empty folder",
        );
      const release = acquireLock(workspace, "desktop-upgrade-copy");
      try {
        backup(store, msg.backupPath);
        verifyBackup(msg.backupPath);
        restore(msg.backupPath, msg.upgradeDestination);
        const copy = new Store(msg.upgradeDestination);
        try {
          migrate(copy);
        } finally {
          copy.close();
        }
      } finally {
        release();
        store.close();
        store = undefined;
      }
      workspace = resolve(msg.upgradeDestination);
      store = new Store(workspace);
    }
    const health = diagnostics(store, "local");
    if (health.checks?.some((c) => c.severity === "error"))
      throw Error(
        "WORKSPACE_HEALTH: Run diagnostics and recovery before opening",
      );
    running = await serve(store, "local", join(product, "dist/web"), 0, {
      app: true,
    });
    process.send?.({
      type: "ready",
      url: running.url,
      workspace,
      schema: store.schemaVersion,
      node: process.versions.node,
      health,
    });
  } catch (e) {
    store?.close();
    store = undefined;
    process.send?.({
      type: "error",
      message:
        e.code === "ERR_DLOPEN_FAILED" || e.code === "MODULE_NOT_FOUND"
          ? "ENGINE_NATIVE_DEPENDENCY: Reinstall the matching desktop build for this platform; the workspace has not been migrated."
          : e.message,
    });
  }
});
