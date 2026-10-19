import { relative } from "node:path";
// Check the emitted module graph, including lazy chunks, not just the navigation.
export const excludedHubModules = [
  "app.jsx",
  "chat.jsx",
  "chat-composer.jsx",
  "chat-workspace.jsx",
  "dashboard.jsx",
  "daily.jsx",
  "delivery.jsx",
  "inbox.jsx",
  "records.jsx",
  "tasks.jsx",
  "transcripts.jsx",
  "calendar.jsx",
  "email-drafts.jsx",
  "suggestions.jsx",
  "showcase.jsx",
  "work-charts.jsx",
];
export function assertHubModules(modules) {
  const invalid = modules.filter(
    (path) =>
      /(^|\/)desktop\//.test(path) ||
      /(^|\/)node_modules\/(electron|electron-builder|@electron)\//.test(
        path,
      ) ||
      excludedHubModules.some(
        (name) => path.endsWith("/web/" + name) || path === "web/" + name,
      ),
  );
  if (invalid.length)
    throw Error("HUB_LEGACY_DEPENDENCY: " + invalid.join(", "));
}
export function hubBoundary(root) {
  return {
    name: "hoi-hub-boundary",
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (item) => item.type === "chunk",
      );
      const modules = [
        ...new Set(chunks.flatMap((c) => Object.keys(c.modules))),
      ]
        .map((id) => relative(root, id).replaceAll("\\", "/"))
        .sort();
      assertHubModules(modules);
      this.emitFile({
        type: "asset",
        fileName: "hub-build.json",
        source: JSON.stringify(
          {
            schemaVersion: 1,
            surface: "knowledge-hub",
            modules: modules.filter((id) => id.startsWith("web/")),
            excluded: excludedHubModules,
            chunks: chunks.map((c) => ({
              file: c.fileName,
              entry: c.isEntry,
              bytes: Buffer.byteLength(c.code),
              imports: c.imports,
              dynamicImports: c.dynamicImports,
            })),
          },
          null,
          2,
        ),
      });
    },
  };
}
