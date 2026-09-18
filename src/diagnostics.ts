import { existsSync, readFileSync } from "node:fs";
import { Store } from "./store.js";
import { inspectLock } from "./locks.js";
import { verifyBackup } from "./backup.js";
import type { Host } from "./schema.js";
export function diagnostics(s: Store, host: Host) {
  const checks: { code: string; severity: string }[] = [];
  try {
    checks.push({
      code:
        s.one("PRAGMA integrity_check").integrity_check === "ok"
          ? "DATABASE_OK"
          : "DATABASE_CORRUPT",
      severity:
        s.one("PRAGMA integrity_check").integrity_check === "ok"
          ? "ok"
          : "error",
    });
  } catch {
    checks.push({ code: "DATABASE_UNAVAILABLE", severity: "error" });
  }
  const sources = s
    .all(
      "SELECT s.*, r.status FROM sources s LEFT JOIN revisions r ON r.id=s.current_revision",
    )
    .filter((x) => s.allowed(x, host));
  const gaps = sources.filter((x) => x.status !== "ready").length;
  checks.push({
    code: gaps ? "EXTRACTION_GAPS" : "EXTRACTION_OK",
    severity: gaps ? "warning" : "ok",
  });
  const lock = inspectLock(s.root);
  checks.push({
    code: lock.code,
    severity: lock.state === "clear" ? "ok" : "warning",
  });
  for (const runtime of ["codex", "claude"]) {
    const folder = runtime === "codex" ? ".agents" : ".claude";
    let valid = false;
    try {
      const config = JSON.parse(
        readFileSync(s.path(".hoi/runtime.json"), "utf8"),
      );
      valid =
        config.hosts.includes(runtime) &&
        existsSync(config.entrypoint) &&
        existsSync(s.path(`${folder}/skills/hoi-meeting-prep/SKILL.md`));
    } catch {}
    checks.push({
      code: `${runtime.toUpperCase()}_ADAPTER_${valid ? "OK" : "MISSING"}`,
      severity: valid ? "ok" : "warning",
    });
  }
  let backupCode = "BACKUP_MISSING";
  try {
    const marker = JSON.parse(
      readFileSync(s.path(".hoi/last-backup.json"), "utf8"),
    );
    verifyBackup(marker.destination);
    backupCode =
      Date.now() - Date.parse(marker.verifiedAt) <= 7 * 86400000
        ? "BACKUP_VERIFIED"
        : "BACKUP_OLD";
  } catch {
    if (existsSync(s.path(".hoi/last-backup.json")))
      backupCode = "BACKUP_INVALID";
  }
  checks.push({
    code: backupCode,
    severity: backupCode === "BACKUP_VERIFIED" ? "ok" : "warning",
  });
  return {
    schemaVersion: 1,
    checks,
    counts: {
      sources: sources.length,
      ready: sources.length - gaps,
      extractionGaps: gaps,
    },
  };
}
// Explicit allowlist: never serialize exceptions, configuration or record objects.
export function supportReport(s: Store, host: Host) {
  return {
    productVersion: JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ).version,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    ...diagnostics(s, host),
  };
}
