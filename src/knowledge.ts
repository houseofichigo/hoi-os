import { existsSync, readdirSync, readFileSync } from "node:fs";
import { Store } from "./store.js";
import {
  entityInput,
  relationInput,
  memoryInput,
  host as hostSchema,
  type Host,
} from "./schema.js";
import {
  uid,
  now,
  readNote,
  writeNote,
  atomic,
  sha,
  readYaml,
  writeYaml,
} from "./files.js";

export function context(
  s: Store,
  host: Host,
  options: { files?: string[]; entities?: string[] } = {},
) {
  s.assertHost(host);
  let remaining = Math.floor(s.policy().maxContextChars / 3);
  const notes = [];
  for (const file of options.files ?? ["profile.md"]) {
    if (!/^[a-zA-Z0-9_-]+\.md$/.test(file))
      throw Error("Invalid context route");
    if (!existsSync(s.path(`context/${file}`))) continue;
    const note = readNote(s.path(`context/${file}`));
    if (!Array.isArray(note.allowedHosts) || !note.allowedHosts.includes(host))
      continue;
    const content = String(note.content).slice(0, remaining);
    remaining -= content.length;
    if (content) notes.push({ file, content });
  }
  const allMemories = s.memories();
  const replaced = new Set(
    allMemories
      .filter((m) => m.state === "approved")
      .map((m) => m.supersedes)
      .filter(Boolean),
  );
  const memories = allMemories.filter(
    (m) =>
      !replaced.has(m.id) &&
      m.state === "approved" &&
      m.allowedHosts?.includes(host) &&
      (!options.entities?.length ||
        !m.entities.length ||
        m.entities.some((id: string) => options.entities!.includes(id))) &&
      (!m.validUntil || m.validUntil >= now().slice(0, 10)) &&
      (!m.validFrom || m.validFrom <= now().slice(0, 10)) &&
      s.evidenceVisible(m.evidence, host),
  );
  const selected = [];
  for (const m of memories) {
    if (remaining <= 0) break;
    const size = JSON.stringify(m).length;
    if (size > remaining) continue;
    remaining -= size;
    selected.push(m);
  }
  return {
    notes,
    memories: selected,
    memoryCoverage: { eligible: memories.length, returned: selected.length },
  };
}
export function onboard(s: Store, answers: Record<string, unknown>) {
  const allowed = [
    "name",
    "role",
    "organization",
    "offering",
    "goals",
    "recurringWork",
    "tools",
    "restrictions",
  ];
  for (const key of Object.keys(answers))
    if (!allowed.includes(key)) throw Error(`Unknown onboarding field ${key}`);
  const path = s.path("context/profile.md");
  const previous = readNote(path);
  const merged = { ...previous.answers, ...answers };
  for (const v of Object.values(merged))
    if (typeof v !== "string" || v.length > 20000)
      throw Error(
        "Onboarding answers must be strings, up to 20,000 characters",
      );
  atomic(
    s.path(`archives/${now().slice(0, 10)}/${uid("profile")}.md`),
    readFileSync(path),
  );
  writeNote(path, {
    schemaVersion: 1,
    allowedHosts: previous.allowedHosts,
    answers: merged,
    updatedAt: now(),
    content: Object.entries(merged)
      .map(([k, v]) => `## ${k}\n\n${v}`)
      .join("\n\n"),
  });
  s.log("context.updated", { fields: Object.keys(answers) });
  return {
    saved: Object.keys(answers),
    remaining: allowed.filter((k) => !merged[k]),
    note: "Restrictions recorded as context; configure policies/actions.yaml to enforce them in HOI commands.",
  };
}
export function entity(s: Store, input: unknown) {
  const e = entityInput.parse(input);
  const prior = e.id
    ? s.one("SELECT * FROM entities WHERE id=?", e.id)
    : e.identity
      ? s.one(
          "SELECT * FROM entities WHERE identity=?",
          `${e.type}:${e.identity.toLowerCase()}`,
        )
      : null;
  const id = prior?.id ?? e.id ?? uid("entity");
  if (prior && prior.type !== e.type) throw Error("Entity type cannot change");
  s.exec(
    "INSERT INTO entities VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,aliases=excluded.aliases,allowed_hosts=excluded.allowed_hosts,date=excluded.date",
    id,
    e.type,
    e.name,
    e.identity ? `${e.type}:${e.identity.toLowerCase()}` : null,
    JSON.stringify(e.aliases),
    JSON.stringify(e.allowedHosts),
    e.date,
    now(),
  );
  s.log("entity.saved", { id });
  return { id, ...e };
}
export function nodeExists(s: Store, id: string) {
  return (
    !!s.one(
      "SELECT id FROM entities WHERE id=? UNION SELECT id FROM sources WHERE id=?",
      id,
      id,
    ) || existsSync(s.path(`memory/${id}.md`))
  );
}
export function relationship(s: Store, input: unknown, host: Host) {
  const r = relationInput.parse(input);
  if (!nodeExists(s, r.from) || !nodeExists(s, r.to))
    throw Error("Unknown relationship endpoint");
  if (r.basis === "supported" && !r.evidence.length)
    throw Error("Supported relationships require evidence");
  s.validateEvidence(r.evidence, host, true);
  const id = uid("relation");
  s.exec(
    "INSERT INTO relationships VALUES(?,?,?,?,?,?,?,?)",
    id,
    r.from,
    r.to,
    r.type,
    r.basis,
    JSON.stringify(r.evidence),
    r.date,
    now(),
  );
  return { id, ...r };
}
export function capture(s: Store, input: unknown, host: Host) {
  const m = memoryInput.parse(input);
  s.assertHost(host);
  s.validateEvidence(m.evidence, host, true);
  for (const id of m.entities)
    if (!nodeExists(s, id)) throw Error(`Unknown entity ${id}`);
  if (m.supersedes && !existsSync(s.path(`memory/${m.supersedes}.md`)))
    throw Error("Unknown superseded memory");
  const id = uid("memory");
  writeNote(s.path(`memory/${id}.md`), {
    schemaVersion: 1,
    id,
    ...m,
    state: "proposed",
    createdAt: now(),
    updatedAt: now(),
  });
  s.log("memory.proposed", { id });
  return { id, state: "proposed" };
}
export function reviewMemory(
  s: Store,
  id: string,
  state: "approved" | "rejected",
  host: Host,
) {
  if (!/^memory_[a-z0-9]+$/.test(id)) throw Error("Invalid memory ID");
  const path = s.path(`memory/${id}.md`),
    m = readNote(path);
  if (!m.allowedHosts?.includes(host))
    throw Error("Memory is not permitted for this host");
  memoryInput.parse(
    Object.fromEntries(
      Object.entries(m).filter(([k]) =>
        [
          "type",
          "content",
          "evidence",
          "entities",
          "durability",
          "validFrom",
          "validUntil",
          "supersedes",
          "allowedHosts",
        ].includes(k),
      ),
    ),
  );
  s.validateEvidence(m.evidence, host, true);
  if (m.state === "superseded")
    throw Error("Superseded memory cannot be reapproved");
  atomic(
    s.path(`archives/${now().slice(0, 10)}/${uid("memory")}.md`),
    readFileSync(path),
  );
  writeNote(path, { ...m, state, updatedAt: now(), reviewedAt: now() });
  if (state === "approved" && m.supersedes) {
    const oldPath = s.path(`memory/${m.supersedes}.md`),
      old = readNote(oldPath);
    atomic(
      s.path(`archives/${now().slice(0, 10)}/${uid("memory")}.md`),
      readFileSync(oldPath),
    );
    writeNote(oldPath, {
      ...old,
      state: "superseded",
      supersededBy: id,
      updatedAt: now(),
    });
  }
  s.log("memory.review", { id, state });
  return { id, state };
}
export function consolidate(s: Store, host: Host) {
  s.assertHost(host);
  const memories = s
    .memories()
    .filter(
      (m) =>
        m.allowedHosts.includes(host) &&
        s.evidenceVisible(m.evidence, host, false),
    );
  const groups = new Map<string, string[]>();
  for (const m of memories) {
    const key = sha(m.content.trim().toLowerCase());
    groups.set(key, [...(groups.get(key) ?? []), m.id]);
  }
  return {
    proposed: memories.filter((m) => m.state === "proposed").map((m) => m.id),
    stale: memories
      .filter(
        (m) =>
          !s.evidenceVisible(m.evidence, host) ||
          (m.validUntil && m.validUntil < now().slice(0, 10)),
      )
      .map((m) => m.id),
    duplicates: [...groups.values()].filter((g) => g.length > 1),
    changesApplied: false,
  };
}
export function connect(s: Store, input?: any) {
  const path = s.path("connections/registry.yaml");
  const registry = readYaml(path) as any;
  if (!input) return registry;
  if (
    !["gmail", "calendar", "drive", "github", "files"].includes(input.provider)
  )
    throw Error("Unsupported connector");
  const host = hostSchema.parse(input.host);
  if (!["unavailable", "available", "export-only"].includes(input.status))
    throw Error("Invalid connection status");
  const entry = {
    provider: input.provider,
    host,
    status: input.status,
    checkedAt: now(),
    mechanism: input.status === "available" ? "host-mediated" : "export",
    verifiedBy: input.status === "available" ? "host-attestation" : null,
  };
  registry.connections = registry.connections.filter(
    (r: any) => r.provider !== entry.provider || r.host !== host,
  );
  registry.connections.push(entry);
  writeYaml(path, registry);
  return entry;
}
