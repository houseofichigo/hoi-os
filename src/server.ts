import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from "node:fs";
import { resolve, extname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { Store } from "./store.js";
import { graph } from "./graph.js";
import { safePath, atomic } from "./files.js";
import type { Host } from "./schema.js";
export async function serve(
  s: Store,
  host: Host,
  webRoot: string,
  port = 4640,
) {
  s.assertHost(host);
  if (!existsSync(resolve(webRoot, "index.html")))
    throw Error("Map not built. Run npm run build.");
  const token = randomBytes(32).toString("hex");
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    try {
      const address = server.address() as any,
        origin = `http://127.0.0.1:${address.port}`;
      if (
        req.headers.host !== `127.0.0.1:${address.port}` ||
        (req.headers.origin && req.headers.origin !== origin)
      )
        throw Error("Untrusted origin");
      if (req.method !== "GET") {
        res.writeHead(405);
        res.end("Read-only service");
        return;
      }
      const url = new URL(req.url ?? "/", origin),
        pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith("/api/")) {
        const bearer = Buffer.from(
          (req.headers.authorization ?? "").replace(/^Bearer /, ""),
        );
        if (
          bearer.length !== token.length ||
          !timingSafeEqual(bearer, Buffer.from(token))
        ) {
          res.writeHead(401);
          res.end("Open the map URL printed by the CLI.");
          return;
        }
        let result: any;
        if (pathname === "/api/graph") result = graph(s, host);
        else if (pathname.startsWith("/api/passage/")) {
          const id = pathname.split("/").pop();
          const p = s.one(
            "SELECT p.*,s.id source_id,s.title,s.metadata FROM passages p JOIN revisions r ON r.id=p.revision_id JOIN sources s ON s.id=r.source_id WHERE p.id=?",
            id,
          );
          if (!p || !s.allowed({ id: p.source_id, metadata: p.metadata }, host))
            throw Error("Passage unavailable");
          result = {
            id: p.id,
            revisionId: p.revision_id,
            sourceId: p.source_id,
            title: p.title,
            location: p.location,
            text: p.text,
          };
        } else if (pathname.startsWith("/api/original/")) {
          const id = pathname.split("/").pop(),
            source = s.one("SELECT * FROM sources WHERE id=?", id);
          if (!source || !s.allowed(source, host))
            throw Error("Source unavailable");
          const r = s.one(
            "SELECT * FROM revisions WHERE source_id=? AND id=?",
            id,
            url.searchParams.get("revision") ?? source.current_revision,
          );
          if (!r) throw Error("Revision unavailable");
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="original${extname(r.original_path).replace(/[^.a-z0-9]/gi, "")}"`,
          );
          res.end(readFileSync(s.path(r.original_path)));
          return;
        } else {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      const file = safePath(
        webRoot,
        pathname === "/" ? "index.html" : pathname.slice(1),
      );
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const types: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] ?? "application/octet-stream",
      );
      res.end(readFileSync(file));
    } catch (e) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  await new Promise<void>((ok, bad) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      bad(
        error.code === "EADDRINUSE"
          ? Error(
              "PORT_IN_USE: Choose --port 0 for an available port, or another port. Leave unrelated services running.",
            )
          : error,
      ),
    );
    server.listen(port, "127.0.0.1", ok);
  });
  const address = server.address() as any;
  const reader = s.path(`.hoi/readers/${process.pid}-${address.port}`);
  atomic(reader, "map server");
  server.on("close", () => rmSync(reader, { force: true }));
  return { server, token, url: `http://127.0.0.1:${address.port}/#${token}` };
}
