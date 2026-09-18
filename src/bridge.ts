import { z } from "zod";
import { Store } from "./store.js";
import { ingest } from "./intake.js";
import { metadata, type Host } from "./schema.js";
import { atomic, uid, now, sha, readYaml } from "./files.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const bridge = z
  .object({
    provider: z.enum(["gmail", "calendar", "drive", "github"]),
    account: z.string().min(1),
    remoteId: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url().optional(),
    updatedAt: z.string().datetime({ offset: true }),
    checkedAt: z.string().datetime({ offset: true }),
    text: z.string().min(1).max(2_000_000),
    metadata: metadata.optional(),
  })
  .strict();
export async function importConnection(s: Store, input: unknown, host: Host) {
  const item = bridge.parse(input);
  s.assertHost(host);
  const registry = readYaml(s.path("connections/registry.yaml")) as any;
  const connection = registry.connections.find(
    (x: any) => x.provider === item.provider && x.host === host,
  );
  if (!connection || !["available", "export-only"].includes(connection.status))
    throw Error(
      "Register a verified host connection or export-only source first",
    );
  const archive = `archives/${now().slice(0, 10)}/${uid("provider")}.json`;
  atomic(s.path(archive), JSON.stringify(item, null, 2));
  const dir = mkdtempSync(join(tmpdir(), "hoi-bridge-"));
  try {
    const path = join(dir, "export.md");
    atomic(
      path,
      `# ${item.title}\n\nProvider: ${item.provider}\nUpdated: ${item.updatedAt}\n${item.url ? "Source: " + item.url + "\n" : ""}\n${item.text}`,
    );
    const sourceKey = `${item.provider}:${sha(item.account)}:${item.remoteId}`;
    const result = await ingest(s, path, {
      sourceKey,
      metadata: { ...(item.metadata ?? {}), title: item.title },
    });
    s.exec(
      "UPDATE sources SET location=? WHERE id=?",
      item.url ?? `${item.provider}:${item.remoteId}`,
      result.sourceId,
    );
    s.log("connection.imported", {
      sourceId: result.sourceId,
      provider: item.provider,
      exportArchive: archive,
      checkedAt: item.checkedAt,
    });
    return { ...result, exportArchive: archive };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
