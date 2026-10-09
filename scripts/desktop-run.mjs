import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
const root = fileURLToPath(new URL("..", import.meta.url)),
  require = createRequire(import.meta.url),
  electron = require("electron");
if (!existsSync(root + "/.desktop-stage/desktop/target.json"))
  throw Error("Run npm run desktop:stage first");
const target = JSON.parse(
  readFileSync(root + "/.desktop-stage/desktop/target.json", "utf8"),
);
if (target.platform !== process.platform || target.arch !== process.arch)
  throw Error("Re-stage for this machine before launching");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  electron,
  [root + "/.desktop-stage", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
child.on("exit", (code) => (process.exitCode = code || 0));
child.on("error", (e) => {
  console.error(e.message);
  process.exitCode = 1;
});
