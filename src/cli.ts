import { parseArgs } from "node:util";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireLock, recoverLock } from "./locks.js";
import { diagnostics, health, supportReport } from "./diagnostics.js";
import { doctorOcr, ocr } from "./ocr.js";
import { importConnection } from "./bridge.js";
import { queryData } from "./structured.js";
import {
  Store,
  initialize,
  CURRENT_SCHEMA_VERSION,
  WIKI_SCHEMA_SQL,
} from "./store.js";
import {
  proposeWiki,
  listWiki,
  getWiki,
  reviewWiki,
  canonicalWiki,
  wikiContradictions,
} from "./wiki.js";
import { ingest, planIngest, retrieve } from "./intake.js";
import {
  onboard,
  context,
  capture,
  reviewMemory,
  consolidate,
  entity,
  relationship,
  connect,
} from "./knowledge.js";
import { run, evaluate, saveCapability, activate } from "./workflow.js";
import { organize, approve, applyOrganization } from "./organize.js";
import { backup, restore, recoverRestore } from "./backup.js";
import { serve } from "./server.js";
import { host as hostSchema } from "./schema.js";
import { readYaml, atomic } from "./files.js";
const strings = [
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
      "HOI OS\n\nhoi <command> --workspace <private directory> --host codex|claude|local [--json]\n\nCommands: init, doctor, health, onboard, connect, ingest-plan, ingest, organize, approve, retrieve, context, capture, review-memory, consolidate, entity, relate, wiki, build-capability, run, evaluate, audit, map, app, backup, restore, upgrade, diagnostics, recover-lock, recover-restore\n\nWiki: wiki list | wiki get REF | wiki propose --input page.json | wiki review ID --state reviewed|rejected | wiki canonical ID | wiki contradictions\n\nUse --input file.json for structured inputs. See docs/CLI.md for examples.",
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
  let s: Store;
  try {
    s = new Store(root);
  } catch (e) {
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
  const readOnly = [
    "retrieve",
    "context",
    "doctor",
    "health",
    "audit",
    "ingest-plan",
    "diagnostics",
    "consolidate",
    "map",
  ];
  let release: (() => void) | undefined,
    keepOpen = false;
  try {
    if (!readOnly.includes(command)) release = acquireLock(root, command);
    let result: any;
    switch (command) {
      case "health":
        result = health(s, host);
        break;
      case "doctor":
      case "audit": {
        const sources = s
          .all(
            "SELECT s.*,r.status,r.error FROM sources s LEFT JOIN revisions r ON r.id=s.current_revision",
          )
          .filter((x) => s.allowed(x, host));
        result = {
          diagnostics: diagnostics(s, host),
          schemaVersion: s.schemaVersion,
          node: process.version,
          integrity: s.one("PRAGMA integrity_check"),
          sources: sources.length,
          ready: sources.filter((r) => r.status === "ready").length,
          gaps: sources
            .filter((r) => r.status !== "ready")
            .map((r) => ({ sourceId: r.id, status: r.status, error: r.error })),
          memory: consolidate(s, host),
          connections: connect(s),
          release: "alpha; client acceptance pending",
          policyBoundary:
            "HOI commands only; host-native tools have independent permissions",
        };
        break;
      }
      case "diagnostics":
        result = supportReport(s, host);
        if (v.output) {
          const target = resolve(String(v.output));
          if (existsSync(target))
            throw Error("Diagnostic output already exists");
          atomic(target, JSON.stringify(result, null, 2));
        }
        break;
      case "ocr":
        if (!p[1] || !v.output)
          throw Error("ocr requires an image and --output");
        result = ocr(p[1], String(v.output), String(v.language ?? "eng"));
        s.log("ocr.completed", { output: result.output });
        break;
      case "onboard":
        result = onboard(s, input() as any);
        break;
      case "context":
        result = context(s, host);
        break;
      case "connect":
        result = connect(s, v.input ? input() : undefined);
        break;
      case "import-connection":
        result = await importConnection(s, input(), host);
        break;
      case "ingest-plan":
        if (!p[1]) throw Error("ingest-plan requires a file or directory");
        result = planIngest(s, p[1], {
          maxFiles: v["max-files"] ? Number(v["max-files"]) : undefined,
          maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
        });
        break;
      case "ingest":
        if (!p[1]) throw Error("ingest requires a file or directory");
        result = await ingest(s, p[1], {
          metadata: v.metadata
            ? readYaml(resolve(String(v.metadata)))
            : undefined,
          sourceId: v["source-id"] as string,
          sourceKey: v["source-key"] as string,
          planHash: v["plan-hash"] as string,
          maxFiles: v["max-files"] ? Number(v["max-files"]) : undefined,
          maxBytes: v["max-bytes"] ? Number(v["max-bytes"]) : undefined,
        });
        break;
      case "retrieve":
        result = retrieve(s, p.slice(1).join(" "), host, {
          client: v.client as string,
          project: v.project as string,
          sourceId: v["source-id"] as string,
          limit: v.limit ? Number(v.limit) : 8,
          latest: !!v.latest,
        });
        break;
      case "query-data":
        result = queryData(
          s,
          String(v["source-id"] ?? ""),
          String(v.column ?? ""),
          String(v.operation ?? "count"),
          host,
        );
        break;
      case "entity":
        result = entity(s, input());
        break;
      case "relate":
        result = relationship(s, input(), host);
        break;
      case "capture":
        result = capture(s, input(), host);
        break;
      case "review-memory":
        if (!p[1] || !["approved", "rejected"].includes(String(v.state)))
          throw Error(
            "review-memory requires an ID and --state approved|rejected",
          );
        result = reviewMemory(s, p[1], v.state as any, host);
        break;
      case "consolidate":
        result = consolidate(s, host);
        break;
      case "organize":
        result = v.apply
          ? applyOrganization(s, p[1], String(v.approval ?? ""), host)
          : organize(s, host);
        break;
      case "approve":
        if (!p[1] || !v.hash)
          throw Error("approve requires a plan ID and --hash");
        result = approve(s, p[1], String(v.hash));
        break;
      case "build-capability":
        result = v.activate ? activate(s, p[1]) : saveCapability(s, input());
        break;
      case "run":
        result = await run(s, p[1] ?? "meeting-prep", input(), host, {
          resume: v.resume as string,
          approval: v.approval as string,
        });
        break;
      case "evaluate":
        result = await evaluate(
          s,
          p[1] ?? "meeting-prep",
          input() as any[],
          host,
        );
        break;
      case "reindex":
        s.tx(() => {
          s.exec("DELETE FROM passage_search");
          s.exec(
            "INSERT INTO passage_search(text,passage_id) SELECT text,id FROM passages",
          );
        });
        result = {
          indexed: s.one("SELECT COUNT(*) count FROM passages").count,
        };
        break;
      case "backup":
        if (!p[1]) throw Error("backup requires a new destination directory");
        result = backup(s, p[1]);
        break;
      case "upgrade": {
        if (!p[1]) throw Error("upgrade requires a backup destination");
        const verified = backup(s, p[1]);
        if (s.schemaVersion < CURRENT_SCHEMA_VERSION) {
          mkdirSync(s.path("wiki"), { recursive: true, mode: 0o700 });
          s.db.exec(
            `${WIKI_SCHEMA_SQL}\nPRAGMA user_version=${CURRENT_SCHEMA_VERSION};`,
          );
          s.log("schema.migrated", {
            from: s.schemaVersion,
            to: CURRENT_SCHEMA_VERSION,
          });
          result = {
            backup: verified,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            status: `Migrated schema ${s.schemaVersion} -> ${CURRENT_SCHEMA_VERSION} after verified backup.`,
          };
        } else
          result = {
            backup: verified,
            schemaVersion: s.schemaVersion,
            status:
              "Already at current schema; backup verified by checksum manifest.",
          };
        break;
      }
      case "wiki": {
        const sub = p[1] ?? "list";
        if (sub === "list") result = listWiki(s, host);
        else if (sub === "get") {
          if (!p[2]) throw Error("wiki get requires a page ID or slug");
          result = getWiki(s, p[2], host);
        } else if (sub === "propose") result = proposeWiki(s, input(), host);
        else if (sub === "review") {
          if (!p[2] || !["reviewed", "rejected"].includes(String(v.state)))
            throw Error(
              "wiki review requires an ID and --state reviewed|rejected",
            );
          result = reviewWiki(s, p[2], v.state as any, host);
        } else if (sub === "canonical") {
          if (!p[2]) throw Error("wiki canonical requires a page ID");
          result = canonicalWiki(s, p[2], host);
        } else if (sub === "contradictions")
          result = wikiContradictions(s, host);
        else throw Error(`Unknown wiki subcommand: ${sub}`);
        break;
      }
      case "app":
      case "map": {
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
              ? "Local workspace app. Reviewable actions only; holds the workspace lock while running. Stop with Ctrl+C."
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
      }
      default:
        throw Error(`Unknown command: ${command}`);
    }
    print(result);
  } finally {
    if (release) release();
    if (!keepOpen) s.close();
  }
}
