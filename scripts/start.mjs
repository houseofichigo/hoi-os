import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const product = fileURLToPath(new URL("..", import.meta.url));
try {
  const { values: v } = parseArgs({
    options: {
      workspace: { type: "string" },
      host: { type: "string" },
      port: { type: "string" },
      "no-open": { type: "boolean" },
      surface: { type: "string", default: "hub" },
    },
  });
  if (!v.workspace || !["codex", "claude", "local"].includes(v.host || "local"))
    throw Error(
      'START_ARGUMENTS: Use npm start -- --workspace "<private directory>" --host codex|claude|local',
    );
  const workspace = resolve(v.workspace);
  if (!["app", "hub"].includes(v.surface))
    throw Error("SURFACE_INVALID: Choose app or hub.");
  // Preserve old launcher flags as aliases, never load retired UI assets.
  const web = "dist/hub";
  if (!existsSync(join(workspace, ".hoi/workspace.json")))
    throw Error(
      "WORKSPACE_MISSING: Run npm run setup with this workspace first.",
    );
  if (
    !existsSync(join(product, "dist/core/server.js")) ||
    !existsSync(join(product, web, "hub.html"))
  )
    throw Error(
      "BUILD_MISSING: Run npm ci and npm run build, then launch again.",
    );
  const port = v.port === undefined ? 4640 : Number(v.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error(
      "PORT_INVALID: Choose a port from 1 to 65535, or 0 for an available port.",
    );
  const { Store } = await import("../dist/core/store.js");
  const { serve } = await import("../dist/core/server.js");
  const s = new Store(workspace);
  let running;
  try {
    running = await serve(s, v.host || "local", join(product, web), port, {
      app: true,
      hub: true,
    });
  } catch (e) {
    s.close();
    throw e;
  }
  console.log(
    `HOI OS Knowledge Hub is running. Open ${running.url}\nStop with Ctrl+C. Use the complete authenticated URL.`,
  );
  if (!v["no-open"]) {
    const executable =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32.exe"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", running.url]
        : [running.url];
    const browser = spawn(executable, args, { stdio: "ignore" });
    browser.on("error", () =>
      console.log("BROWSER_UNAVAILABLE: Open the printed URL in your browser."),
    );
    browser.on("exit", (code) => {
      if (code)
        console.log(
          "BROWSER_UNAVAILABLE: Open the printed URL in your browser.",
        );
    });
    browser.unref();
  }
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      running.server.close(() => {
        s.close();
        process.exit(0);
      });
      running.server.closeIdleConnections();
    });
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
