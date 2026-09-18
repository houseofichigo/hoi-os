import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialize, Store } from "../dist/core/store.js";
export function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "hoi-test-")),
    workspace = join(root, "workspace");
  initialize(workspace);
  const s = new Store(workspace);
  t.after(() => {
    try {
      s.close();
    } catch {}
    rmSync(root, { recursive: true, force: true });
  });
  return {
    root,
    s,
    file: (name, text) => {
      const p = join(root, name);
      writeFileSync(p, text);
      return p;
    },
  };
}
