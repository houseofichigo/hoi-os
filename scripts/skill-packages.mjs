import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
export function files(root) {
  return readdirSync(root)
    .sort()
    .flatMap((name) => {
      const path = join(root, name),
        stat = lstatSync(path);
      if (stat.isSymbolicLink())
        throw Error("Skill packages must not contain symlinks");
      return stat.isDirectory() ? files(path) : [path];
    });
}
export function catalog(root, version) {
  return {
    schemaVersion: 1,
    version,
    skills: readdirSync(join(root, "skills"))
      .filter((name) => lstatSync(join(root, "skills", name)).isDirectory())
      .sort()
      .map((name) => {
        const path = join(root, "skills", name),
          text = readFileSync(join(path, "SKILL.md"), "utf8"),
          front = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const meta = front && YAML.parse(front[1]);
        if (
          !meta ||
          meta.name !== name ||
          !meta.description ||
          !/^hoi-[a-z0-9-]+$/.test(name)
        )
          throw Error(`Invalid skill ${name}`);
        for (const match of text.matchAll(
          /\]\((references\/[^)#]+)(?:#[^)]*)?\)/g,
        ))
          readFileSync(join(path, match[1]));
        return {
          name,
          description: meta.description,
          version,
          kind: name === "hoi-install" ? "installer" : "operational",
          requires:
            name === "hoi-install"
              ? []
              : [
                  "HOI OS core",
                  "private workspace",
                  "local Codex or Claude Code",
                ],
          files: files(path).map((f) =>
            relative(path, f).replaceAll("\\", "/"),
          ),
        };
      }),
  };
}
export function table(data) {
  return (
    "| Skill | Purpose |\n| --- | --- |\n" +
    data.skills
      .filter((s) => s.kind === "operational")
      .map((s) => `| \`${s.name}\` | ${s.description.replaceAll("|", "\\|")} |`)
      .join("\n")
  );
}
