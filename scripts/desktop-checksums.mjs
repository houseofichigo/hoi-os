import { readdirSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
const dir = process.argv[2] || "desktop-release";
function artifacts(base, prefix = "") {
  return readdirSync(base)
    .sort()
    .flatMap((n) => {
      const path = join(base, n),
        relative = prefix + n,
        stat = lstatSync(path);
      if (stat.isSymbolicLink()) return [];
      if (stat.isDirectory()) return artifacts(path, relative + "/");
      return /\.(zip|exe|dmg)$/.test(n) ? [relative] : [];
    });
}
const lines = artifacts(dir)
  .sort()
  .map(
    (n) =>
      createHash("sha256")
        .update(readFileSync(join(dir, n)))
        .digest("hex") +
      "  " +
      n,
  );
if (!lines.length) throw Error("No desktop artifacts found");
writeFileSync(join(dir, "SHA256SUMS"), lines.join("\n") + "\n");
console.log(
  "Checksums written for " + lines.length + " local desktop artifacts",
);
