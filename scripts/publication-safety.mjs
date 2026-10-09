import { readFileSync, writeFileSync, mkdirSync, lstatSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export function safePath(path) {
  return (
    typeof path === "string" &&
    !path.includes("\\") &&
    !path.startsWith("/") &&
    !path.split("/").some((p) => !p || p === "." || p === "..") &&
    !/(^|\/)(audits|workspaces|archives|backups|logs|node_modules|dist|release|desktop-release|test-results|playwright-report|coverage|\.git|\.local|\.secrets|\.verification|\.desktop-stage)(\/|$)/i.test(
      path,
    ) &&
    !/(^|\/)\.env[^/]*$|\.(db|sqlite|sqlite3|log|pem|key)$/i.test(path) &&
    !path.startsWith("docs/verification/")
  );
}
export function scan(bytes) {
  const text = bytes.toString("utf8");
  return [
    [
      "PRIVATE_HOME_PATH",
      /(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)[a-zA-Z0-9_.-]+/,
    ],
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    [
      "PROVIDER_CREDENTIAL",
      /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,})\b/,
    ],
    [
      "PRIVATE_WEBHOOK",
      /https:\/\/[^\s"'<>]+\/webhook\/[0-9a-f]{8}-[0-9a-f-]{27,}/i,
    ],
    [
      "AUTH_URL",
      /https?:\/\/[^\s"'<>]+[?#](?:[^\s"'<>]*&)?(?:token|access_token|api_key)=[A-Za-z0-9_-]{20,}/i,
    ],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([code]) => code);
}
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function candidate(root, manifest) {
  if (
    !Array.isArray(manifest.files) ||
    new Set(manifest.files).size !== manifest.files.length
  )
    throw Error("Invalid or duplicate manifest entries");
  return manifest.files.map((path) => {
    if (!safePath(path)) throw Error("Forbidden manifest path");
    let current = root;
    for (const part of path.split("/")) {
      current = resolve(current, part);
      if (lstatSync(current).isSymbolicLink()) throw Error("Symlink excluded");
    }
    if (!lstatSync(current).isFile())
      throw Error("Manifest entry is not a file");
    const bytes = readFileSync(current);
    return { path, bytes, sha256: sha(bytes), findings: scan(bytes) };
  });
}
export function main(root) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, "publication/manifest.json")),
  );
  const entries = candidate(root, manifest);
  const git = (args) =>
    execFileSync("git", args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
  const inventory = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .toString()
    .split("\0")
    .filter(Boolean);
  const unclassified = inventory.filter(
    (p) => !manifest.files.includes(p) && !manifest.excludedFiles.includes(p),
  );
  const findings = entries.flatMap((e) =>
    e.findings.map((code) => ({ path: e.path, code })),
  );
  // Scan every unique reachable blob, not commit messages or credential stores.
  const objects = git(["rev-list", "--objects", "--all"])
    .toString()
    .trim()
    .split("\n");
  const historyFindings = [];
  let blobs = 0;
  for (const row of objects) {
    const [id, ...parts] = row.split(" ");
    if (git(["cat-file", "-t", id]).toString().trim() !== "blob") continue;
    blobs++;
    const codes = scan(git(["cat-file", "blob", id]));
    if (parts.length && !safePath(parts.join(" ")))
      codes.push("EXCLUDED_HISTORY_PATH");
    for (const code of codes) historyFindings.push({ object: id, code });
  }
  const report = {
    generatedAt: new Date().toISOString(),
    status:
      findings.length || historyFindings.length || unclassified.length
        ? "blocked"
        : "candidate-prepared",
    files: entries.length,
    historyBlobsScanned: blobs,
    findings,
    historyFindings,
    unclassified,
    limitations: [
      "Pattern scan is not a comprehensive secret or business-data audit.",
      "Binary assets require visual review.",
      "No Git history was rewritten; no staging or publication performed.",
      "Candidate is not release approval; platform, live-provider and pilot gates remain.",
    ],
  };
  const out = resolve(
    root,
    ".local/publication",
    new Date().toISOString().replaceAll(":", "-"),
  );
  mkdirSync(out, { recursive: true });
  writeFileSync(
    resolve(out, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(resolve(out, "inventory.txt"), git(["status", "--short"]));
  writeFileSync(
    resolve(out, "SHA256SUMS"),
    entries.map((e) => `${e.sha256}  ${e.path}`).join("\n") + "\n",
  );
  if (report.status === "candidate-prepared")
    for (const e of entries) {
      const target = resolve(out, "source", e.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, e.bytes, {
        mode: lstatSync(resolve(root, e.path)).mode & 0o777,
      });
    }
  console.log(
    JSON.stringify(
      { ...report, unclassified: unclassified.length, output: out },
      null,
      2,
    ),
  );
  if (report.status === "blocked") process.exitCode = 1;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main(fileURLToPath(new URL("..", import.meta.url)));
