import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { recoverRestore, restore } from "./backup.js";
import { callEngine } from "./engine.js";
import { atomic, readYaml } from "./files.js";
import { acquireLock, recoverLock } from "./locks.js";
import { doctorOcr } from "./ocr.js";
import { executeOperation } from "./operations.js";
import { host as hostSchema } from "./schema.js";
import { serve } from "./server.js";
import { Store, initialize } from "./store.js";
const strings = [
  "request-id",
  "workspace",
  "host",
  "input",
  "metadata",
  "source-id",
  "source-key",
  "client",
  "project",
  "limit",
  "resume",
  "approval",
  "hash",
  "state",
  "port",
  "output",
  "column",
  "operation",
  "language",
  "plan-hash",
  "max-files",
  "max-bytes",
];
const booleans = ["json", "latest", "apply", "activate", "help"];
export async function main(args = process.argv.slice(2)) {
  const { values: values, positionals: p } = parseArgs({
    args,
    allowPositionals: true,
    options: Object.fromEntries([
      ...strings.map((k) => [k, { type: "string" }]),
      ...booleans.map((k) => [k, { type: "boolean" }]),
    ]) as any,
  });
  const v = values as Record<string, string | boolean | undefined>;
  const command = p[0] ?? "help";
  const print = (value: unknown) =>
    console.log(
      v.json
        ? JSON.stringify(value)
        : typeof value === "string"
          ? value
          : JSON.stringify(value, null, 2),
    );
  if (command === "help" || v.help) {
    print(
      "HOI OS\n\nhoi <command> --workspace <private directory> --host codex|claude|local [--json]\n\nCommands: views, preferences, processing, jobs, entity-merge, adapter, engine, init, doctor, health, onboard, connect, ingest-plan, ingest, organize, approve, retrieve, context, capture, review-memory, consolidate, entity, relate, wiki, project, task, intake, daily, knowledge, chat, build-capability, run, evaluate, audit, map, app, backup, restore, upgrade, diagnostics, recover-lock, recover-restore\n\nWiki: wiki list | wiki get REF | wiki propose --input page.json | wiki review ID --state reviewed|rejected | wiki canonical ID | wiki contradictions\n\nUse --input file.json for structured inputs. See docs/CLI.md for examples.",
    );
    return;
  }
  if (command === "doctor-ocr") {
    print(doctorOcr());
    return;
  }
  const root = resolve(String(v.workspace ?? process.env.HOI_WORKSPACE ?? ""));
  if (!v.workspace && !process.env.HOI_WORKSPACE)
    throw Error(
      "Specify --workspace or HOI_WORKSPACE; no implicit writes to the current folder.",
    );
  const host = hostSchema.parse(v.host ?? "local");
  const input = () => {
    if (!v.input) throw Error("--input file is required");
    return readYaml(resolve(String(v.input)));
  };
  if (command === "init") {
    print(initialize(root));
    return;
  }
  if (command === "restore") {
    if (!p[1]) throw Error("restore requires a backup directory");
    print(restore(p[1], root));
    return;
  }
  if (command === "recover-restore") {
    print(recoverRestore(root));
    return;
  }
  if (command === "recover-lock") {
    print(recoverLock(root));
    return;
  }
  const options: Record<string, any> = {};
  for (const [key, value] of Object.entries(v))
    if (
      ![
        "workspace",
        "host",
        "json",
        "input",
        "help",
        "port",
        "request-id",
      ].includes(key) &&
      value !== undefined
    )
      options[key] = value;
  if (v.output) options.output = resolve(String(v.output));
  if (v.metadata) options.metadata = true;
  const argsForEngine = p.slice(1);
  if (
    ["ingest", "ingest-plan", "backup", "upgrade", "ocr"].includes(command) &&
    argsForEngine[0]
  )
    argsForEngine[0] = resolve(argsForEngine[0]);
  const request = {
    command,
    args: argsForEngine,
    options,
    ...(v.input ? { input: input() } : {}),
    ...(v.metadata ? { metadata: readYaml(resolve(String(v.metadata))) } : {}),
  };
  if (!["app", "map"].includes(command)) {
    const remote = await callEngine(
      root,
      host,
      request,
      v["request-id"] as string | undefined,
    );
    if (remote.connected) {
      print(remote.result);
      return;
    }
  }
  // A command without a running server is a short-lived engine owner.
  const release =
    !["app", "map"].includes(command) &&
    existsSync(resolve(root, ".hoi/workspace.json"))
      ? acquireLock(root, command)
      : undefined;
  let s: Store;
  try {
    s = new Store(root);
  } catch (e) {
    release?.();
    if (["doctor", "health", "diagnostics"].includes(command)) {
      const report = {
        schemaVersion: 1,
        checks: [{ code: "DATABASE_UNAVAILABLE", severity: "error" }],
      };
      if (v.output && command === "diagnostics") {
        const path = resolve(String(v.output));
        if (existsSync(path)) throw Error("Diagnostic output already exists");
        atomic(path, JSON.stringify(report));
      }
      print(report);
      process.exitCode = 1;
      return;
    }
    throw e;
  }
  let keepOpen = false;
  try {
    let result: any;
    if (command === "app" || command === "map") {
      const webRoot = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../web",
      );
      const running = await serve(
        s,
        host,
        webRoot,
        v.port ? Number(v.port) : command === "app" ? 4641 : 4640,
        { app: command === "app" },
      );
      print({
        url: running.url,
        note:
          command === "app"
            ? "Local workspace engine. CLI clients share this engine; stop with Ctrl+C."
            : "Read-only, localhost only. Stop with Ctrl+C.",
      });
      keepOpen = true;
      for (const signal of ["SIGINT", "SIGTERM"] as const)
        process.once(signal, () =>
          running.server.close(() => {
            s.close();
            process.exit(0);
          }),
        );
      return;
    } else {
      result = await executeOperation(s, host, request);
    }
    print(result);
  } finally {
    if (release) release();
    if (!keepOpen) s.close();
  }
}
