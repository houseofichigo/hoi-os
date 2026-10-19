import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { hubBoundary } from "./scripts/hub-boundary.mjs";
export default defineConfig({
  root: "web",
  plugins: [react(), hubBoundary(fileURLToPath(new URL(".", import.meta.url)))],
  build: {
    outDir: "../dist/hub",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("web/index.html", import.meta.url)),
        hub: fileURLToPath(new URL("web/hub.html", import.meta.url)),
      },
    },
  },
  server: { host: "127.0.0.1" },
});
