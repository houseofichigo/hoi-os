import { z } from "zod";
import JSZip from "jszip";
import YAML from "yaml";
import {
  readFileSync,
  readdirSync,
  lstatSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.js";
import { type Host } from "./schema.js";
import { uid, now, sha, atomic, safePath } from "./files.js";
import { operationCatalog } from "./operations.js";
import { ENGINE_API_VERSION } from "./protocol.js";
import { backup } from "./backup.js";
export const SKILL_LIBRARY_SQL = `CREATE TABLE IF NOT EXISTS workspace_skills(id TEXT PRIMARY KEY,version INTEGER NOT NULL,enabled INTEGER NOT NULL,active_revision TEXT,allowed_hosts TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_revisions(id TEXT PRIMARY KEY,skill_id TEXT NOT NULL,payload TEXT NOT NULL,checksum TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_events(id TEXT PRIMARY KEY,skill_id TEXT NOT NULL,action TEXT NOT NULL,revision_id TEXT,at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_imports(id TEXT PRIMARY KEY,host TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,committed_revision TEXT,created_at TEXT NOT NULL);`;
const root = fileURLToPath(new URL("../../skills/", import.meta.url));
const nameSchema = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const manifestSchema = z.object({
  name: nameSchema,
  description: z.string().min(1).max(2000),
  engineApiVersion: z.number().int().positive().default(ENGINE_API_VERSION),
  requiredOperations: z.array(z.string().max(100)).max(100).default([]),
});
const MAX = 512 * 1024;
function access(s: Store, h: Host, write = false) {
  s.assertSchema(14, "Skill library");
  s.assertHost(h);
  if (write && s.policy().actions.draft !== "allow")
    throw Error("Skill changes require draft: allow");
}
function cleanPath(p: string) {
  if (
    !p ||
    p.length > 240 ||
    p.includes("\\") ||
    p
      .split("/")
      .some(
        (x) =>
          !x ||
          x.startsWith(".") ||
          x === "." ||
          x === ".." ||
          !/^[a-zA-Z0-9_. -]+$/.test(x) ||
          /[. ]$/.test(x) ||
          /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(x),
      )
  )
    throw Error("SKILL_UNSAFE_PATH");
  return p;
}
function manifest(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw Error("SKILL_FRONTMATTER_REQUIRED");
  return manifestSchema.parse(YAML.parse(match[1]));
}
function walk(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n),
        st = lstatSync(p);
      if (st.isSymbolicLink()) throw Error("SKILL_SYMLINK");
      return st.isDirectory() ? walk(p) : [p];
    });
}
let bundleCache: any[] | null = null;
function bundled() {
  if (bundleCache) return bundleCache;
  const catalog = JSON.parse(readFileSync(join(root, "catalog.json"), "utf8"));
  return (bundleCache = catalog.skills.map((c: any) => {
    const files = Object.fromEntries(
      walk(join(root, c.name)).map((p) => [
        relative(join(root, c.name), p).replaceAll("\\", "/"),
        readFileSync(p).toString("base64"),
      ]),
    );
    const markdown = Buffer.from(
      files["SKILL.md"] as string,
      "base64",
    ).toString("utf8");
    const m = {
      ...manifest(markdown),
      requiredOperations: c.requiredOperations ?? [],
      engineApiVersion: c.compatibility?.engineApiVersion ?? 1,
    };
    const payload = {
      manifest: m,
      files,
      origin: "bundled",
      description: m.description,
    };
    const checksum = sha(JSON.stringify(payload));
    return {
      presentation: c.presentation,
      id: c.name,
      revisionId: "bundled:" + checksum,
      checksum,
      payload,
      createdAt: null,
    };
  }));
}
function visibleRow(s: Store, name: string, h: Host) {
  const row = s.one("SELECT * FROM workspace_skills WHERE id=?", name);
  if (row && !JSON.parse(row.allowed_hosts).includes(h))
    throw Error("Skill unavailable");
  return row;
}
function compatibility(m: any) {
  const available = new Set(operationCatalog().map((x) => x.name));
  const missing = m.requiredOperations.filter((x: string) => !available.has(x));
  return {
    compatible: m.engineApiVersion === ENGINE_API_VERSION && !missing.length,
    missingOperations: missing,
    engineApiVersion: m.engineApiVersion,
  };
}
function revision(s: Store, rid: string) {
  const r = s.one("SELECT * FROM skill_revisions WHERE id=?", rid);
  if (!r) throw Error("Skill revision unavailable");
  return {
    id: r.skill_id,
    revisionId: r.id,
    checksum: r.checksum,
    payload: JSON.parse(r.payload),
    createdAt: r.created_at,
  };
}
export function skillDetail(s: Store, name: string, h: Host) {
  access(s, h);
  nameSchema.parse(name);
  const row = visibleRow(s, name, h),
    base = bundled().find((b: any) => b.id === name);
  if (!row && !base) throw Error("Skill unavailable");
  const revisions = s
    .all(
      "SELECT id FROM skill_revisions WHERE skill_id=? ORDER BY created_at DESC,rowid DESC",
      name,
    )
    .map((r) => revision(s, r.id));
  const active =
    row?.enabled === 0
      ? null
      : row?.active_revision
        ? revision(s, row.active_revision)
        : (base ?? null);
  return {
    id: name,
    version: row?.version ?? 0,
    origin: base ? "bundled" : "workspace",
    enabled: row?.enabled !== 0,
    active: active
      ? { ...active, ...compatibility(active.payload.manifest) }
      : null,
    bundled: base ?? null,
    revisions,
    history: s.all(
      "SELECT action,revision_id revisionId,at FROM skill_events WHERE skill_id=? ORDER BY at DESC",
      name,
    ),
  };
}
export function listSkills(s: Store, h: Host) {
  access(s, h);
  return [
    ...new Set<string>([
      ...bundled().map((b: any) => b.id),
      ...s.all("SELECT id FROM workspace_skills").map((r) => r.id),
    ]),
  ].flatMap((name) => {
    try {
      const d = skillDetail(s, name, h),
        r = d.active ?? d.revisions[0] ?? d.bundled;
      return [
        {
          id: name,
          presentation:
            d.origin === "bundled"
              ? bundled().find((b: any) => b.id === name)?.presentation
              : undefined,
          version: d.version,
          origin: d.origin,
          enabled: d.enabled,
          description: r?.payload.manifest.description ?? "",
          activeRevision: d.active?.revisionId ?? null,
          checksum: d.active?.checksum ?? null,
          compatible: d.active?.compatible ?? false,
          missingOperations: d.active?.missingOperations ?? [],
          draftCount: d.revisions.filter(
            (r) => r.revisionId !== d.active?.revisionId,
          ).length,
        },
      ];
    } catch {
      return [];
    }
  });
}
function event(s: Store, name: string, action: string, rid: string | null) {
  s.exec(
    "INSERT INTO skill_events VALUES(?,?,?,?,?)",
    uid("skill_event"),
    name,
    action,
    rid,
    now(),
  );
}
function saveRevision(
  s: Store,
  payload: any,
  expectedVersion: number,
  h: Host,
) {
  const name = payload.manifest.name,
    row = visibleRow(s, name, h);
  if ((row?.version ?? 0) !== expectedVersion)
    throw Error("STALE_VERSION: Skill changed");
  const checksum = sha(JSON.stringify(payload));
  const same = s.one(
    "SELECT id FROM skill_revisions WHERE skill_id=? AND checksum=?",
    name,
    checksum,
  );
  if (same) return same.id;
  const rid = uid("skill_revision");
  s.exec(
    "INSERT INTO skill_revisions VALUES(?,?,?,?,?)",
    rid,
    name,
    JSON.stringify(payload),
    checksum,
    now(),
  );
  if (row)
    s.exec("UPDATE workspace_skills SET version=version+1 WHERE id=?", name);
  else
    s.exec(
      "INSERT INTO workspace_skills VALUES(?,1,1,NULL,?)",
      name,
      JSON.stringify(["local", "codex", "claude"]),
    );
  event(s, name, "draft", rid);
  return rid;
}
export async function previewSkill(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      filename: z.string().max(240),
      base64: z.string().max(700000),
      expectedVersion: z.number().int().nonnegative().default(0),
    })
    .strict()
    .parse(input);
  const original = Buffer.from(v.base64, "base64");
  if (!original.length || original.length > MAX)
    throw Error("SKILL_PACKAGE_LIMIT: Maximum 512 KiB");
  let files: Record<string, string> = {};
  if (/\.(zip|skill)$/i.test(v.filename)) {
    const zip = await JSZip.loadAsync(original);
    const entries = Object.values(zip.files).filter((f) => !f.dir);
    if (entries.length > 64) throw Error("SKILL_FILE_LIMIT");
    let total = 0;
    const seen = new Set<string>();
    for (const f of entries) {
      cleanPath((f as any).unsafeOriginalName ?? f.name);
      cleanPath(f.name);
      const portable = f.name.toLowerCase();
      if (seen.has(portable)) throw Error("SKILL_PATH_COLLISION");
      seen.add(portable);
      if ((Number(f.unixPermissions) & 0o170000) === 0o120000)
        throw Error("SKILL_SYMLINK");
      total += Number((f as any)._data?.uncompressedSize ?? 0);
      if (total > MAX) throw Error("SKILL_EXPANDED_LIMIT");
    }
    const roots = entries.filter((f) => /(^|\/)SKILL\.md$/.test(f.name));
    if (roots.length !== 1)
      throw Error("SKILL_LAYOUT: One root skill required");
    const prefix = roots[0].name.slice(0, -8);
    for (const f of entries) {
      if (!f.name.startsWith(prefix)) throw Error("SKILL_LAYOUT");
      const path = cleanPath(f.name.slice(prefix.length));
      const bytes = await f.async("nodebuffer");
      files[path] = bytes.toString("base64");
    }
    if (
      Object.values(files).reduce(
        (n, b) => n + Buffer.from(b, "base64").length,
        0,
      ) > MAX
    )
      throw Error("SKILL_EXPANDED_LIMIT");
  } else if (v.filename === "SKILL.md")
    files = { "SKILL.md": original.toString("base64") };
  else
    throw Error("SKILL_FORMAT: Select SKILL.md, a skill ZIP or .skill package");
  const m = manifest(Buffer.from(files["SKILL.md"], "base64").toString("utf8"));
  const row = visibleRow(s, m.name, h);
  if ((row?.version ?? 0) !== v.expectedVersion)
    throw Error(
      "SKILL_EXISTS: Open the existing skill before importing an update",
    );
  const payload = {
    manifest: m,
    files,
    origin: "local-import",
    original: {
      filename: v.filename,
      checksum: sha(original),
      base64: v.base64,
    },
    expectedVersion: v.expectedVersion,
  };
  const digest = sha(JSON.stringify(payload)),
    key = uid("skill_import");
  s.exec(
    "INSERT INTO skill_imports VALUES(?,?,?,?,NULL,?)",
    key,
    h,
    JSON.stringify(payload),
    digest,
    now(),
  );
  return {
    id: key,
    digest,
    name: m.name,
    files: Object.keys(files),
    bytes: original.length,
    filename: v.filename,
    checksum: sha(original),
    instructions: Buffer.from(files["SKILL.md"], "base64").toString("utf8"),
    compatibility: compatibility(m),
    warning:
      "Instructions are untrusted until reviewed. Scripts are preserved, never executed. Import creates a draft.",
  };
}
export function commitSkill(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({ id: z.string(), digest: z.string() })
    .strict()
    .parse(input);
  return s.tx(() => {
    const p = s.one(
      "SELECT * FROM skill_imports WHERE id=? AND host=?",
      v.id,
      h,
    );
    if (!p || p.digest !== v.digest) throw Error("SKILL_PREVIEW_CHANGED");
    const data = JSON.parse(p.payload);
    if (!p.committed_revision) {
      const { expectedVersion, original, ...payload } = data;
      const rid = saveRevision(s, payload, expectedVersion, h);
      atomic(
        s.path(`archives/${now().slice(0, 10)}/skill-imports/${v.id}/original`),
        Buffer.from(original.base64, "base64"),
      );
      atomic(
        s.path(
          `archives/${now().slice(0, 10)}/skill-imports/${v.id}/provenance.json`,
        ),
        JSON.stringify({
          filename: original.filename,
          checksum: original.checksum,
          importedAt: now(),
        }),
      );
      s.exec(
        "UPDATE skill_imports SET committed_revision=? WHERE id=?",
        rid,
        v.id,
      );
    }
    return skillDetail(s, data.manifest.name, h);
  });
}
export function draftSkill(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      name: nameSchema,
      expectedVersion: z.number().int().nonnegative(),
      markdown: z.string().min(1).max(128000),
      fromRevision: z.string().optional(),
    })
    .strict()
    .parse(input);
  const m = manifest(v.markdown);
  if (m.name !== v.name) throw Error("SKILL_NAME_CHANGED");
  let files: Record<string, string> = {};
  if (v.fromRevision) {
    const d = skillDetail(s, v.name, h);
    const r = [d.bundled, ...d.revisions].find(
      (x) => x?.revisionId === v.fromRevision,
    );
    if (!r) throw Error("Skill revision unavailable");
    files = { ...r.payload.files };
  }
  files["SKILL.md"] = Buffer.from(v.markdown).toString("base64");
  return s.tx(() => {
    saveRevision(
      s,
      { manifest: m, files, origin: "workspace-edit" },
      v.expectedVersion,
      h,
    );
    return skillDetail(s, v.name, h);
  });
}
export function controlSkill(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      name: nameSchema,
      expectedVersion: z.number().int().nonnegative(),
      action: z.enum(["activate", "disable", "revert"]),
      revisionId: z.string().optional(),
      checksum: z.string().optional(),
    })
    .strict()
    .parse(input);
  return s.tx(() => {
    const d = skillDetail(s, v.name, h);
    if (d.version !== v.expectedVersion)
      throw Error("STALE_VERSION: Skill changed");
    let rid: string | null = null;
    if (v.action === "activate") {
      const r = d.revisions.find((r) => r.revisionId === v.revisionId);
      if (!r || r.checksum !== v.checksum) throw Error("SKILL_REVIEW_CHANGED");
      if (!compatibility(r.payload.manifest).compatible)
        throw Error("SKILL_INCOMPATIBLE");
      rid = r.revisionId;
    }
    if (v.action === "revert" && !d.bundled) throw Error("No bundled version");
    const old = visibleRow(s, v.name, h);
    if (old)
      s.exec(
        "UPDATE workspace_skills SET active_revision=?,enabled=?,version=version+1 WHERE id=?",
        rid,
        v.action === "disable" ? 0 : 1,
        v.name,
      );
    else
      s.exec(
        "INSERT INTO workspace_skills VALUES(?,1,?,?,?)",
        v.name,
        v.action === "disable" ? 0 : 1,
        rid,
        JSON.stringify(["local", "codex", "claude"]),
      );
    event(s, v.name, v.action, rid);
    return skillDetail(s, v.name, h);
  });
}
export function resolveSkill(
  s: Store,
  ref: { name: string; revisionId: string; checksum: string },
  h: Host,
) {
  const d = skillDetail(s, ref.name, h),
    a = d.active;
  if (
    !a ||
    !a.compatible ||
    a.revisionId !== ref.revisionId ||
    a.checksum !== ref.checksum
  )
    throw Error("SKILL_UNAVAILABLE: Re-select an active compatible revision");
  return {
    ...ref,
    instructions: Buffer.from(a.payload.files["SKILL.md"], "base64").toString(
      "utf8",
    ),
  };
}

export function previewSkillSync(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({ name: nameSchema, host: z.enum(["codex", "claude"]) })
    .strict()
    .parse(input);
  if (h !== "local" && h !== v.host) throw Error("Adapter host mismatch");
  const d = skillDetail(s, v.name, h),
    a = d.active;
  if (!a || !a.compatible) throw Error("SKILL_UNAVAILABLE");
  const runtime = existsSync(s.path(".hoi/runtime.json"))
    ? JSON.parse(readFileSync(s.path(".hoi/runtime.json"), "utf8"))
    : {};
  if (!runtime.hosts?.includes(v.host))
    throw Error(
      "ADAPTER_REQUIRED: Install this optional adapter in Configuration first",
    );
  const dir = v.host === "codex" ? ".agents" : ".claude",
    installedName = bundled().some((b: any) => b.id === v.name)
      ? v.name
      : "hoi-user-" + v.name;
  const manifestPath = `.hoi/skill-adapters/${v.host}/${v.name}.json`;
  const prior = existsSync(s.path(manifestPath))
    ? JSON.parse(readFileSync(s.path(manifestPath), "utf8"))
    : { files: {} };
  const baseManifest = JSON.parse(
    readFileSync(s.path(`.hoi/adapters/${v.host}.json`), "utf8"),
  );
  const targets = Object.entries<string>(a.payload.files).map(([p, data]) => {
    cleanPath(p);
    const path = `${dir}/skills/${installedName}/${p}`;
    const target = s.path(path);
    let current = null;
    if (existsSync(target)) {
      if (lstatSync(target).isSymbolicLink() || !lstatSync(target).isFile())
        throw Error("ADAPTER_SYMLINK");
      current = sha(readFileSync(target));
    }
    const desired = sha(Buffer.from(data, "base64")),
      known = prior.files[path] ?? baseManifest.files?.[path];
    return {
      file: p,
      remove: false,
      path,
      current,
      desired,
      conflict: current !== null && current !== desired && current !== known,
    };
  });
  for (const [path, checksum] of Object.entries(prior.files ?? {})) {
    if (targets.some((t) => t.path === path)) continue;
    if (!path.startsWith(`${dir}/skills/${installedName}/`))
      throw Error("ADAPTER_PATH");
    const target = s.path(path);
    if (
      existsSync(target) &&
      (!lstatSync(target).isFile() || lstatSync(target).isSymbolicLink())
    )
      throw Error("ADAPTER_SYMLINK");
    const current = existsSync(target) ? sha(readFileSync(target)) : null;
    targets.push({
      file: "",
      path,
      current,
      desired: "",
      remove: true,
      conflict: current !== null && current !== checksum,
    });
  }
  const plan = {
    name: v.name,
    host: v.host,
    revisionId: a.revisionId,
    checksum: a.checksum,
    targets,
  };
  return { ...plan, digest: sha(JSON.stringify(plan)) };
}
export function syncSkill(s: Store, input: unknown, h: Host) {
  access(s, h, true);
  const v = z
    .object({
      name: nameSchema,
      host: z.enum(["codex", "claude"]),
      digest: z.string(),
    })
    .strict()
    .parse(input);
  const plan = previewSkillSync(s, { name: v.name, host: v.host }, h);
  if (plan.digest !== v.digest) throw Error("SKILL_SYNC_CHANGED");
  if (plan.targets.some((t) => t.conflict))
    throw Error(
      "SKILL_SYNC_CONFLICT: Preserve customized files and resolve them before syncing",
    );
  const a = skillDetail(s, v.name, h).active!;
  const destination = `${s.root}.before-skill-sync-${uid("backup")}`;
  backup(s, destination);
  const manifestPath = `.hoi/skill-adapters/${v.host}/${v.name}.json`;
  const managed: Record<string, string> = {};
  for (const t of plan.targets) {
    if (t.remove) {
      if (existsSync(s.path(t.path))) unlinkSync(s.path(t.path));
      continue;
    }
    const p = t.file;
    atomic(s.path(t.path), Buffer.from(a.payload.files[p], "base64"));
    managed[t.path] = t.desired;
  }
  atomic(
    s.path(manifestPath),
    JSON.stringify({ revisionId: a.revisionId, files: managed, at: now() }),
  );
  event(s, v.name, "sync:" + v.host, a.revisionId);
  return { synced: true, backup: destination, revisionId: a.revisionId };
}
