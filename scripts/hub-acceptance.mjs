// Offline acceptance of a staged package. Never accepts an existing workspace.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import {
  join,
  resolve,
  relative,
  dirname,
  basename,
  isAbsolute,
  sep,
} from "node:path";
import { cpus, release, totalmem } from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify, parseArgs } from "node:util";
import assert from "node:assert/strict";
const exec = promisify(execFile);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const ownRoot = fileURLToPath(new URL("..", import.meta.url));
const fail = (code) => {
  throw Error(code);
};
function physical(path) {
  if (existsSync(path)) return realpathSync(path);
  return join(physical(dirname(path)), basename(path));
}
const within = (a, b) => {
  const p = relative(a, b);
  return !p || (p !== ".." && !p.startsWith(".." + sep) && !isAbsolute(p));
};
function regular(root, name) {
  if (
    typeof name !== "string" ||
    !name ||
    /[\\:\x00-\x1f]/.test(name) ||
    name.split("/").some((p) => !p || p === "." || p === "..")
  )
    fail("PACKAGE_PATH_INVALID");
  let path = root;
  const parts = name.split("/");
  for (const [i, part] of parts.entries()) {
    path = join(path, part);
    const st = lstatSync(path);
    if (st.isSymbolicLink()) fail("PACKAGE_SYMLINK");
    if (i === parts.length - 1 ? !st.isFile() : !st.isDirectory())
      fail("PACKAGE_FILE_INVALID");
  }
  return path;
}
export function verifyHubPackage(root) {
  root = realpathSync(root);
  const manifestPath = regular(root, "HUB_PACKAGE.json");
  if (lstatSync(manifestPath).size > 2 * 1024 * 1024)
    fail("PACKAGE_MANIFEST_TOO_LARGE");
  const bytes = readFileSync(manifestPath),
    manifest = JSON.parse(bytes);
  if (
    manifest.version !== 1 ||
    manifest.surface !== "knowledge-hub" ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > 10000
  )
    fail("PACKAGE_MANIFEST_INVALID");
  const names = new Set();
  for (const f of manifest.files) {
    if (
      !f ||
      typeof f.path !== "string" ||
      !/^[a-f0-9]{64}$/.test(f.sha256) ||
      names.has(f.path.toLowerCase()) ||
      f.path === "HUB_PACKAGE.json" ||
      f.path.split("/")[0] === "node_modules"
    )
      fail("PACKAGE_MANIFEST_INVALID");
    const path = regular(root, f.path);
    names.add(f.path.toLowerCase());
    if (sha(readFileSync(path)) !== f.sha256) fail("PACKAGE_CHECKSUM_MISMATCH");
  }
  // An unlisted runtime file would escape the manifest; dependencies are separately installed.
  function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name),
        rel = relative(root, path).split(sep).join("/");
      if (rel === "node_modules" || rel === "HUB_PACKAGE.json") continue;
      if (e.isSymbolicLink()) fail("PACKAGE_SYMLINK");
      if (e.isDirectory()) walk(path);
      else if (!e.isFile() || !names.has(rel.toLowerCase()))
        fail("PACKAGE_UNLISTED_FILE");
    }
  }
  walk(root);
  for (const p of [
    "package.json",
    "package-lock.json",
    "bin/hoi.mjs",
    "scripts/setup.mjs",
    "scripts/start.mjs",
    "scripts/hub-acceptance.mjs",
    "dist/core/store.js",
    "dist/hub/hub.html",
    "docs/HUB_INSTALLATION.md",
    "docs/HOST_ACCEPTANCE.md",
  ])
    if (!names.has(p.toLowerCase())) fail("PACKAGE_REQUIRED_FILE_MISSING");
  return {
    digest: sha(bytes),
    files: manifest.files.length,
    sourceVersion: manifest.sourceVersion,
  };
}
// Strip inherited provider keys and host-specific settings from subprocess environments.
function childEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env))
    if (
      [
        "PATH",
        "HOME",
        "USERPROFILE",
        "SYSTEMROOT",
        "WINDIR",
        "COMSPEC",
        "TEMP",
        "TMP",
        "TMPDIR",
        "LOCALAPPDATA",
        "APPDATA",
        "LANG",
        "LC_ALL",
        "DBUS_SESSION_BUS_ADDRESS",
        "XDG_RUNTIME_DIR",
      ].includes(k.toUpperCase())
    )
      env[k] = v;
  return env;
}
async function node(root, args) {
  try {
    return await exec(process.execPath, args, {
      cwd: root,
      env: childEnv(),
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (e) {
    // Never persist raw launcher output or error paths/tokens in the shareable report.
    const code = String(e.stderr || "").match(/\b[A-Z][A-Z_]{5,60}\b/)?.[0];
    fail(code || (e.killed ? "CHILD_TIMEOUT" : "CHILD_FAILED"));
  }
}
async function launch(root, workspace) {
  const child = spawn(
    process.execPath,
    ["scripts/start.mjs", "--workspace", workspace, "--port", "0", "--no-open"],
    {
      cwd: root,
      env: childEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let stopped = false;
  const ended = new Promise((ok) =>
    child.once("close", () => {
      stopped = true;
      ok();
    }),
  );
  const stop = async () => {
    if (stopped) return;
    child.kill("SIGTERM");
    let timer;
    try {
      await Promise.race([
        ended,
        new Promise((_, no) => {
          timer = setTimeout(() => no(Error("SHUTDOWN_TIMEOUT")), 15000);
        }),
      ]);
    } catch (e) {
      child.kill("SIGKILL");
      await ended;
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    const url = await new Promise((ok, no) => {
      let data = "";
      const timer = setTimeout(() => no(Error("LAUNCH_TIMEOUT")), 30000);
      const finish = (fn, value) => {
        clearTimeout(timer);
        fn(value);
      };
      child.once("error", () => finish(no, Error("LAUNCH_FAILED")));
      child.once("exit", () => finish(no, Error("LAUNCH_EXITED")));
      child.stderr.on("data", () => {}); // Drain, do not archive credentials or local paths.
      child.stdout.on("data", (b) => {
        data = (data + b.toString()).slice(-65536);
        const link = data.match(
          /http:\/\/127\.0\.0\.1:\d+\/hub[^\s]*#[a-f0-9]{64}/,
        );
        if (link) finish(ok, new URL(link[0]));
      });
    });
    const request = (path, input, authenticated = true) =>
      fetch(url.origin + path, {
        method: input === undefined ? "GET" : "POST",
        signal: AbortSignal.timeout(20000),
        headers: {
          ...(authenticated
            ? { Authorization: `Bearer ${url.hash.slice(1)}` }
            : {}),
          "content-type": "application/json",
        },
        ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      });
    return { pid: child.pid, request, stop };
  } catch (e) {
    await stop();
    throw e;
  }
}

export async function runAcceptance({ packageRoot = ownRoot, output, signal }) {
  if (!output) fail("OUTPUT_REQUIRED");
  const root = realpathSync(packageRoot),
    out = physical(resolve(output));
  if (existsSync(out)) fail("OUTPUT_EXISTS");
  if (within(root, out) || within(out, root)) fail("OUTPUT_OVERLAPS_PACKAGE");
  const packageInfo = verifyHubPackage(root); // Before runtime imports or workspace writes.
  mkdirSync(out, { recursive: true, mode: 0o700 });
  const report = {
    version: 1,
    kind: "packaged-hub-acceptance",
    startedAt: new Date().toISOString(),
    status: "running",
    package: packageInfo,
    environment: {
      platform: process.platform,
      arch: process.arch,
      osRelease: release(),
      node: process.version,
      nodeAbi: process.versions.modules,
      cpu: cpus()[0]?.model || "unknown",
      memoryBytes: totalmem(),
    },
    scope: {
      fictionalDataOnly: true,
      providerDispatches: 0,
      modelDownloads: 0,
      hostSessionsRun: 0,
      review: "scripted fixture only",
      dependencies: "preinstalled; this command does not download or install",
      cleanMachine: "not-attested",
    },
    checks: [],
    pending: [
      "Fresh machine / test-user dependency installation",
      "Fresh Codex session discovery and execution",
      "Fresh Claude Code session discovery and execution",
      "Independent owner review and skill effectiveness",
      "Manual browser accessibility on target platform",
      "Removal of installation on target platform",
      "Historical released-workspace migration",
      "Live providers and connectors",
    ],
  };
  const save = () => {
    const p = join(out, "acceptance.json");
    writeFileSync(p + ".tmp", JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
    renameSync(p + ".tmp", p);
  };
  const check = async (name, action) => {
    const entry = {
      name,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    report.checks.push(entry);
    save();
    try {
      if (signal?.aborted) fail("ACCEPTANCE_CANCELLED");
      const detail = await action();
      entry.status = "passed";
      if (detail) entry.detail = detail;
    } catch (e) {
      entry.status = "failed";
      entry.code =
        e.message.match(/^[A-Z][A-Z_]+(?=[:\n]|$)/)?.[0] || "CHECK_FAILED";
      throw e;
    } finally {
      entry.finishedAt = new Date().toISOString();
      save();
    }
  };
  const write = (name, data) => {
    const path = join(out, name);
    writeFileSync(
      path,
      typeof data === "string" ? data : JSON.stringify(data, null, 2),
      { mode: 0o600 },
    );
    return path;
  };
  const ws = join(out, "workspace"),
    restored = join(out, "restored-workspace"),
    conflicts = join(out, "conflict-workspace");
  const setup = (workspace) =>
    node(root, [
      "scripts/setup.mjs",
      "--skip-build",
      "--workspace",
      workspace,
      "--non-interactive",
    ]);
  const cli = async (workspace, host, ...args) =>
    JSON.parse(
      (
        await node(root, [
          "bin/hoi.mjs",
          ...args,
          "--workspace",
          workspace,
          "--host",
          host,
          "--json",
        ])
      ).stdout,
    );
  let running;
  try {
    await check("Native dependencies load from this installation", async () => {
      const req = createRequire(join(root, "package.json"));
      const modules = realpathSync(join(root, "node_modules"));
      if (!within(root, modules)) fail("DEPENDENCIES_NOT_ISOLATED");
      const versions = {};
      for (const [name, expected] of Object.entries(
        json(join(root, "package.json")).dependencies,
      )) {
        const installed = join(modules, name, "package.json");
        if (!within(modules, realpathSync(installed)))
          fail("DEPENDENCY_OUTSIDE_PACKAGE");
        if (json(installed).version !== expected)
          fail("DEPENDENCY_VERSION_MISMATCH");
      }
      for (const name of ["better-sqlite3", "sqlite-vec", "@napi-rs/keyring"]) {
        if (!within(modules, realpathSync(req.resolve(name))))
          fail("DEPENDENCY_OUTSIDE_PACKAGE");
        versions[name] = json(join(modules, name, "package.json")).version;
      }
      const Database = req("better-sqlite3"),
        db = new Database(":memory:");
      try {
        req("sqlite-vec").load(db);
        assert.ok(db.prepare("select vec_version() v").get().v);
      } finally {
        db.close();
      }
      req("@napi-rs/keyring");
      const { buildIdentity } = await import(
        pathToFileURL(join(root, "dist/core/security-evidence.js"))
      );
      report.buildId = buildIdentity(root);
      return {
        versions,
        keyring: "module-load only; AI credential read/write not tested",
      };
    });
    await check("Onboarding without adapters or AI configuration", async () => {
      await setup(ws);
      for (const n of ["AGENTS.md", "CLAUDE.md", ".agents", ".claude"])
        assert.equal(existsSync(join(ws, n)), false);
      assert.ok(
        (await cli(ws, "local", "adapter", "status")).every(
          (r) => r.status === "not-installed",
        ),
      );
      const state = await cli(ws, "local", "engine", "status");
      report.schemaVersion = state.schemaVersion;
      report.apiVersion = state.apiVersion;
      assert.equal(state.schemaVersion, 19);
    });
    await check(
      "Launcher, authentication and shared engine ownership",
      async () => {
        running = await launch(root, ws);
        assert.equal(
          (await running.request("/api/workspace", undefined, false)).status,
          401,
        );
        assert.equal((await running.request("/api/workspace")).status, 200);
        const page = await running.request("/hub", undefined, false);
        assert.match(await page.text(), /HOI OS · Knowledge Hub/);
        for (const host of ["codex", "claude"])
          assert.equal(
            (await cli(ws, host, "engine", "status")).apiVersion,
            report.apiVersion,
          );
        assert.equal(
          json(join(ws, ".hoi/engine-session/endpoint.json")).pid,
          running.pid,
        );
        await assert.rejects(
          node(root, [
            "bin/hoi.mjs",
            "hub",
            "--workspace",
            ws,
            "--port",
            "0",
            "--json",
          ]),
        );
      },
    );
    let source, passage, task;
    await check(
      "Fictional import, duplicate intake and host-filtered retrieval",
      async () => {
        const file = write(
          "fictional-acceptance.md",
          "# Orchard acceptance\n\nAcceptance marker ORCHARD-ACCEPT-17. Prepare the reviewed workshop checklist. This is fictional installation evidence.\n",
        );
        const meta = write("source-metadata.json", {
          title: "Orchard acceptance",
          status: "approved",
          authority: "primary",
        });
        source = await cli(ws, "local", "ingest", file, "--metadata", meta);
        assert.equal(
          (await cli(ws, "local", "ingest", file, "--metadata", meta))
            .revisionId,
          source.revisionId,
        );
        const restricted = write(
          "fictional-local-only.md",
          "FICTIONAL-LOCAL-ONLY-17: this record must not appear to either assistant host.",
        );
        const privateMeta = write("local-only-metadata.json", {
          allowedHosts: ["local"],
          title: "Fictional local-only record",
        });
        await cli(ws, "local", "ingest", restricted, "--metadata", privateMeta);
        const results = await Promise.all(
          ["codex", "claude"].map(async (h) => {
            const r = await cli(ws, h, "retrieve", "ORCHARD-ACCEPT-17");
            assert.ok(
              r.results.some((p) => p.revisionId === source.revisionId),
            );
            assert.equal(
              (await cli(ws, h, "retrieve", "FICTIONAL-LOCAL-ONLY-17")).results
                .length,
              0,
            );
            return r;
          }),
        );
        passage = results[0].results.find(
          (p) => p.revisionId === source.revisionId,
        );
        report.evidence = {
          sourceId: source.sourceId,
          revisionId: passage.revisionId,
          passageId: passage.passageId,
          quote: passage.quote,
        };
      },
    );
    await check(
      "Scripted proposal retry, exact review and one persisted task",
      async () => {
        const input = write("proposal.json", {
          key: "acceptance-task",
          task: {
            title: "Prepare Orchard checklist",
            outcome: "Workshop checklist ready for review",
          },
          evidence: [
            {
              revisionId: passage.revisionId,
              passageId: passage.passageId,
              quote: passage.quote,
            },
          ],
        });
        const proposal = await cli(
          ws,
          "codex",
          "task",
          "propose",
          "--input",
          input,
          "--request-id",
          "acceptance-task-001",
        );
        const retry = await cli(
          ws,
          "codex",
          "task",
          "propose",
          "--input",
          input,
          "--request-id",
          "acceptance-task-001",
        );
        assert.equal(retry.replayed, true, "RETRY_NOT_ACKNOWLEDGED");
        const proposals = await cli(ws, "codex", "task", "proposals");
        assert.equal(proposals.length, 1, "PROPOSAL_COUNT_MISMATCH");
        assert.equal(proposals[0].id, proposal.id, "PROPOSAL_ID_MISMATCH");
        const stale = await running.request("/api/tasks/review", {
          id: proposal.id,
          expectedVersion: 999,
          decision: "approved",
        });
        assert.notEqual(stale.status, 200, "STALE_REVIEW_ACCEPTED");
        const response = await running.request("/api/tasks/review", {
          id: proposal.id,
          expectedVersion: 1,
          decision: "approved",
        });
        assert.equal(response.status, 200, "REVIEW_RESPONSE_FAILED");
        const tasks = await cli(ws, "claude", "task", "list");
        assert.equal(tasks.length, 1, "TASK_COUNT_MISMATCH");
        task = tasks[0];
        report.taskId = task.id;
      },
    );
    await check(
      "Optional adapters, versioned guides and owner manual preservation",
      async () => {
        writeFileSync(
          join(ws, "AGENTS.md"),
          "Fictional owner note: preserve this paragraph.\n",
        );
        writeFileSync(
          join(ws, "CLAUDE.md"),
          "Fictional owner note: preserve this paragraph.\n",
        );
        await cli(ws, "local", "adapter", "install", "both");
        const states = await cli(ws, "local", "adapter", "status");
        assert.ok(
          states.every(
            (s) =>
              s.status === "verified" && s.documentationStatus === "current",
          ),
        );
        for (const n of ["AGENTS.md", "CLAUDE.md"]) {
          const text = readFileSync(join(ws, n), "utf8");
          assert.match(text, /Fictional owner note/);
          assert.match(text, /\.hoi\/guides\//);
        }
        const count = json(join(root, "skills/catalog.json")).skills.length;
        return {
          hosts: ["codex", "claude"],
          skillPackagesPerHost: count,
          statusMeaning: "instruction integrity; no assistant session executed",
        };
      },
    );
    const snapshot = join(out, "backup");
    await check("Verified backup excludes live credentials", async () => {
      assert.equal((await cli(ws, "local", "backup", snapshot)).verified, true);
      const manifest = json(join(snapshot, "manifest.json"));
      assert.ok(
        Object.keys(manifest.files).some((n) =>
          n.startsWith(".agents/skills/"),
        ),
      );
      assert.ok(
        Object.keys(manifest.files).some((n) =>
          n.startsWith(".claude/skills/"),
        ),
      );
      assert.ok(
        !Object.keys(manifest.files).some((n) =>
          /engine-session|\.secrets|\.env/.test(n),
        ),
      );
    });
    await check(
      "Orderly shutdown and restart preserve exact identities",
      async () => {
        await running.stop();
        running = undefined;
        assert.equal(existsSync(join(ws, ".hoi/engine-session")), false);
        running = await launch(root, ws);
        assert.equal((await cli(ws, "codex", "task", "list"))[0].id, task.id);
        assert.ok(
          (
            await cli(ws, "claude", "retrieve", "ORCHARD-ACCEPT-17")
          ).results.some((p) => p.passageId === passage.passageId),
        );
        await running.stop();
        running = undefined;
      },
    );
    await check("Separate restore and runtime relocation", async () => {
      await cli(restored, "local", "restore", snapshot);
      await setup(restored);
      assert.equal(
        realpathSync(json(join(restored, ".hoi/runtime.json")).workspace),
        realpathSync(restored),
      );
      assert.ok(
        (await cli(restored, "local", "adapter", "status")).every(
          (s) => s.status === "verified",
        ),
      );
      running = await launch(root, restored);
      assert.equal(
        (await cli(restored, "codex", "task", "list"))[0].id,
        task.id,
      );
      assert.ok(
        (
          await cli(restored, "claude", "retrieve", "ORCHARD-ACCEPT-17")
        ).results.some((p) => p.passageId === passage.passageId),
      );
      await running.stop();
      running = undefined;
    });
    await check(
      "Same-version upgrade guard takes a verified backup",
      async () => {
        const result = await cli(
          restored,
          "local",
          "upgrade",
          join(out, "before-upgrade"),
        );
        assert.equal(result.backup.verified, true);
        assert.equal(
          (await cli(restored, "local", "engine", "status")).schemaVersion,
          report.schemaVersion,
        );
        return { migration: "not exercised: current-schema copy only" };
      },
    );
    await check(
      "Adapter update/removal preserves customized instructions on a copy",
      async () => {
        await cli(conflicts, "local", "restore", snapshot);
        await setup(conflicts);
        const custom = join(conflicts, ".agents/skills/hoi-retrieve/SKILL.md");
        writeFileSync(
          custom,
          "Fictional customized instructions. Never overwrite.\n",
        );
        const installed = await cli(
          conflicts,
          "local",
          "adapter",
          "install",
          "codex",
        );
        assert.ok(installed.conflicts.length);
        const removed = await cli(
          conflicts,
          "local",
          "adapter",
          "remove",
          "codex",
        );
        assert.ok(removed.conflicts.length);
        assert.equal(
          readFileSync(custom, "utf8"),
          "Fictional customized instructions. Never overwrite.\n",
        );
        assert.match(
          readFileSync(join(conflicts, "AGENTS.md"), "utf8"),
          /Fictional owner note/,
        );
        assert.ok(
          (await cli(ws, "local", "adapter", "status")).every(
            (s) => s.status === "verified",
          ),
        );
        assert.equal((await cli(ws, "local", "task", "list"))[0].id, task.id);
      },
    );
    await check(
      "Package and report artifacts retain their fingerprints",
      async () => {
        assert.deepEqual(verifyHubPackage(root), packageInfo);
        report.artifacts = Object.fromEntries(
          [
            "fictional-acceptance.md",
            "fictional-local-only.md",
            "source-metadata.json",
            "local-only-metadata.json",
            "proposal.json",
          ].map((n) => [n, sha(readFileSync(join(out, n)))]),
        );
        write(
          "HOST_REVIEW.md",
          readFileSync(join(root, "docs/HOST_ACCEPTANCE.md"), "utf8"),
        );
        report.artifacts["HOST_REVIEW.md"] = sha(
          readFileSync(join(out, "HOST_REVIEW.md")),
        );
      },
    );
    report.status = "passed-local-checks";
  } catch {
    report.status = signal?.aborted ? "interrupted" : "failed";
  } finally {
    if (running) {
      try {
        await running.stop();
      } catch {
        report.status = "failed";
        report.cleanup =
          "Inspect the fictional workspace process and lock before reuse.";
      }
    }
    report.finishedAt = new Date().toISOString();
    save();
  }
  return report;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { values } = parseArgs({
      options: { output: { type: "string" }, package: { type: "string" } },
    });
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    process.once("SIGTERM", cancel);
    let report;
    try {
      report = await runAcceptance({
        packageRoot: values.package || ownRoot,
        output: values.output,
        signal: controller.signal,
      });
    } finally {
      process.removeListener("SIGINT", cancel);
      process.removeListener("SIGTERM", cancel);
    }
    console.log(
      JSON.stringify({
        status: report.status,
        checks: report.checks.map(({ name, status, code }) => ({
          name,
          status,
          ...(code ? { code } : {}),
        })),
        pending: report.pending,
      }),
    );
    if (report.status !== "passed-local-checks") process.exitCode = 1;
  } catch (e) {
    console.error(
      JSON.stringify({
        error: /^[A-Z][A-Z_]+$/.test(e.message)
          ? e.message
          : "ACCEPTANCE_PREFLIGHT_FAILED",
        guidance:
          "Use an intact staged package with installed production dependencies and a new output directory outside the package.",
      }),
    );
    process.exitCode = 1;
  }
}
