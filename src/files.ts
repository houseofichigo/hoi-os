import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  lstatSync,
  readdirSync,
  realpathSync,
  rmSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import YAML from "yaml";
export const uid = (prefix: string) =>
  `${prefix}_${randomUUID().replaceAll("-", "")}`;
export const sha = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
export const now = () => new Date().toISOString();
export function contained(root: string, path: string) {
  const r = relative(resolve(root), resolve(path));
  return (
    r === "" || (!r.startsWith(`..${sep}`) && r !== ".." && !isAbsolute(r))
  );
}
export function safePath(root: string, path: string) {
  const target = resolve(root, path);
  if (!contained(root, target)) throw Error("Path escapes workspace");
  let p = target;
  while (contained(root, p)) {
    if (existsSync(p) && lstatSync(p).isSymbolicLink())
      throw Error("Symlink paths are not supported");
    if (p === resolve(root)) break;
    p = dirname(p);
  }
  return target;
}
export function atomic(path: string, text: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    const fd = openSync(tmp, "wx", 0o600);
    try {
      writeFileSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, path);
  } finally {
    rmSync(tmp, { force: true });
  }
}
export function readYaml(path: string): unknown {
  return YAML.parse(readFileSync(path, "utf8"));
}
export function writeYaml(path: string, data: unknown) {
  atomic(path, YAML.stringify(data));
}
export function readNote(path: string) {
  const raw = readFileSync(path, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw Error(`Missing frontmatter: ${path}`);
  return { ...YAML.parse(match[1]), content: match[2].trim() };
}
export function writeNote(path: string, data: Record<string, unknown>) {
  const { content, ...frontmatter } = data;
  atomic(path, `---\n${YAML.stringify(frontmatter)}---\n${content ?? ""}\n`);
}
export const excluded = new Set([
  ".git",
  ".secrets",
  "node_modules",
  ".env",
  ".claude",
  ".agents",
  ".codex",
  "backups",
  "dist",
]);
export function walk(root: string): string[] {
  if (lstatSync(root).isSymbolicLink()) throw Error("Symlinks are excluded");
  return readdirSync(root, { withFileTypes: true }).flatMap((e) => {
    if (
      e.isSymbolicLink() ||
      excluded.has(e.name) ||
      e.name.startsWith(".env") ||
      e.name.endsWith(".tmp")
    )
      return [];
    const p = resolve(root, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
export function assertInput(path: string) {
  const p = resolve(path);
  if (p.split(/[\\/]/).some((x) => excluded.has(x) || x.startsWith(".env")))
    throw Error("Excluded input path");
  let cursor = p;
  while (dirname(cursor) !== cursor) {
    if (
      lstatSync(cursor).isSymbolicLink() &&
      !["/var", "/tmp"].includes(cursor)
    )
      throw Error("Symlink input is excluded");
    cursor = dirname(cursor);
  }
  const actual = realpathSync(p);
  if (
    actual.split(/[\\/]/).some((x) => excluded.has(x) || x.startsWith(".env"))
  )
    throw Error("Excluded resolved input path");
  return actual;
}
