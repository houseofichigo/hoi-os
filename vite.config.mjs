import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("web/index.html", import.meta.url)),
        app: fileURLToPath(new URL("web/app.html", import.meta.url)),
      },
    },
  },
  server: { host: "127.0.0.1" },
});
