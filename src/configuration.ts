import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readYaml } from "./files.js";
import {
  buildIdentity,
  evidenceChecks,
  CHECK_VERSION,
} from "./security-evidence.js";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { diagnostics } from "./diagnostics.js";
import { connections } from "./sync.js";
import { adapterStatus } from "./adapters.js";
import { operationCatalog, ENGINE_API_VERSION } from "./operations.js";
const loadedBuild = buildIdentity();
export function security(s: Store, h: Host) {
  s.assertHost(h);
  const at = new Date().toISOString(),
    policy = s.policy();
  let diskBuild: string | undefined;
  try {
    diskBuild = buildIdentity();
  } catch {}
  const health = diagnostics(s, h),
    backup = health.checks.find((c) => c.code.startsWith("BACKUP_"));
  const checks: any[] = [
    {
      code: "BUILD_INTEGRITY",
      status: diskBuild === loadedBuild ? "pass" : "fail",
      detail:
        diskBuild === loadedBuild
          ? "Runtime files match the identity captured when this process loaded"
          : "BUILD_CHANGED: Restart after completing the installation",
    },
    {
      code: "DATABASE_INTEGRITY",
      status:
        s.one("PRAGMA integrity_check").integrity_check === "ok"
          ? "pass"
          : "fail",
    },
    {
      code: "DEFAULT_EXTERNAL_DENY",
      status: policy.actions.external === "deny" ? "pass" : "fail",
    },
    {
      code: "CONNECTOR_SCOPE",
      status:
        s.schemaVersion >= 10 &&
        connections(s, h).every((c) =>
          c.provider === "files"
            ? !!c.folder
            : c.provider === "gmail"
              ? !!c.query
              : c.provider === "calendar"
                ? !!c.calendarId
                : !!c.fileIds?.length || !!c.folderIds?.length,
        )
          ? "pass"
          : "not-tested",
      detail:
        "Configured visible scopes only; no upstream access or completeness claim",
    },
    {
      code: "BACKUP_STATUS",
      status: backup?.code === "BACKUP_VERIFIED" ? "pass" : "fail",
      detail: backup?.code ?? "BACKUP_UNAVAILABLE",
    },
  ].map((c) => ({
    ...c,
    buildId: loadedBuild,
    checkVersion: CHECK_VERSION,
    testedAt: at,
    scope: "Current selected workspace; deterministic read-only check",
  }));
  const recorded = evidenceChecks(
    diskBuild === loadedBuild ? loadedBuild : "changed",
  );
  return {
    at,
    buildId: loadedBuild,
    checkVersion: CHECK_VERSION,
    scope:
      "Read-only workspace checks and local build test records. Local records are not signed attestations or security certification.",
    checks: [
      ...checks,
      ...recorded,
      {
        code: "CREDENTIAL_STORAGE",
        status: "not-tested",
        detail:
          "No live OS credential-store round trip performed; mock/provider regressions are separate",
        buildId: loadedBuild,
        checkVersion: CHECK_VERSION,
        testedAt: null,
        scope: "Live OS credential store",
      },
      {
        code: "LIVE_PROVIDER_ACCESS",
        status: "not-tested",
        detail:
          "Requires user-selected live scopes and fresh provider verification",
        buildId: loadedBuild,
        checkVersion: CHECK_VERSION,
        testedAt: null,
        scope: "Live Gmail, Calendar and Drive",
      },
    ],
  };
}
export function configuration(s: Store, h: Host) {
  s.assertHost(h);
  let catalog: any = { skills: [] };
  try {
    catalog = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../skills/catalog.json", import.meta.url)),
        "utf8",
      ),
    );
  } catch {}
  return {
    schemaVersion: s.schemaVersion,
    engineApiVersion: ENGINE_API_VERSION,
    adapters: adapterStatus(s),
    engineTools: operationCatalog().map((op) => ({
      ...op,
      availability:
        s.policy().actions[op.action as "read" | "draft" | "external"] ===
        "deny"
          ? "policy-restricted"
          : "registered; per-record permissions apply",
    })),
    workspace: s.root,
    executions: s.all(
      "SELECT id,capability,version,state,started_at FROM executions WHERE host=? ORDER BY started_at DESC LIMIT 30",
      h,
    ),
    skills: catalog.skills.map((x: any) => ({
      ...x,
      compatible:
        x.compatibility?.engineApiVersion === ENGINE_API_VERSION &&
        (x.requiredOperations || []).every((name: string) =>
          operationCatalog().some((o) => o.name === name),
        ),
      availability:
        "Bundled instructions, not executable tools; adapter installation is optional",
    })),
    capabilities: readdirSync(s.path("capabilities"))
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => {
        const r: any = readYaml(s.path("capabilities/" + f));
        return { id: r.id, version: r.version, state: r.state };
      }),
    assistant: {
      mode: "Claude/Codex handoff",
      webSearch:
        "Assistant-mediated only; no native search provider configured",
    },
    health: diagnostics(s, h),
    security: security(s, h),
  };
}
